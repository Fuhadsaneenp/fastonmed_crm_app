import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { Product } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Production website owns the active catalogue; CRM must use the same records.
async function sharedWebsiteCatalog(req: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  const origin = (process.env.WEBSITE_CATALOG_URL || 'https://www.fastonmed.com').replace(/\/$/, '');
  const target = `${origin}/api/admin/products${req.nextUrl.search}`;
  try {
    const response = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', 'X-Fastonmed-Catalog-Origin': 'crm' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (Array.isArray(data.products)) {
      const imageUrl = (value: string) => value?.startsWith('/') ? `${origin}${value}` : value;
      data.products = normalizeProducts(data.products).map((product: any) => ({
        ...product,
        image: imageUrl(product.image),
        galleryImages: (product.galleryImages || []).map(imageUrl),
      }));
      data.count = data.products.length;
    }
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Shared website catalogue is unavailable' }, { status: 503 });
  }
}

const SETTING_KEY_PRODUCTS = "fastonmed_products_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "products_store.json");

let memoryProductsCache: Product[] | null = null;

function productTime(product: any): number {
  const value = product?.createdAt || product?.wordpressSource?.createdAt || product?.updatedAt;
  const parsed = value ? new Date(value).getTime() : 0;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const match = String(product?.id || "").match(/(\d{12,})/);
  return match ? Number(match[1]) : 0;
}

function identityKeys(product: any): string[] {
  const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
  const sku = normalize(product?.sku);
  const slug = normalize(product?.slug);
  const id = normalize(product?.id);
  const keys: string[] = [];
  if (sku && sku !== "—" && sku !== "-") keys.push(`sku:${sku}`);
  if (slug) keys.push(`slug:${slug}`);
  if (id) keys.push(`id:${id}`);
  return keys;
}

function normalizeProducts(products: Product[]): Product[] {
  const sorted = [...products].filter((product) => product && product.id).sort((a, b) => productTime(b) - productTime(a));
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const product of sorted) {
    const keys = identityKeys(product);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    result.push(product);
  }
  return result;
}

function loadBackupFileProducts(): Product[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup products file:", err);
  }
  return null;
}

function saveBackupFileProducts(products: Product[]): void {
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(products, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup products file:", err);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DB operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function getValidCompanyId(pool: any): Promise<string> {
  try {
    const [rows]: any = await withTimeout(pool.query("SELECT id FROM Company LIMIT 1"), 3000);
    if (rows && rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }
  } catch {}
  return "cmrtifqe00002ty4zqy0vdpsr";
}

async function getStoredProductsFromDb(pool: any): Promise<Product[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_PRODUCTS]
      ),
      8000
    );
    if (rows && rows.length > 0 && rows[0].value) {
      const val = rows[0].value;
      const parsed = typeof val === "string" ? JSON.parse(val) : val;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn("Could not read products from MySQL DB (using local storage cache):", err?.message || err);
  }
  return null;
}

async function saveProductsToDb(pool: any, products: Product[]): Promise<boolean> {
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(products);
    const now = new Date();
    const id = `setting_${SETTING_KEY_PRODUCTS}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_PRODUCTS, jsonStr, now, now]
      ),
      30000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write products to MySQL DB (saved to local backup):", err?.message || err);
    return false;
  }
}

async function getResolvedProducts(): Promise<Product[]> {
  // MySQL is the shared source of truth for the CRM and storefront. The memory
  // and disk copies below are resilience fallbacks only.
  const pool = getDbPool();
  const dbProducts = await getStoredProductsFromDb(pool);
  if (dbProducts && dbProducts.length > 0) {
    memoryProductsCache = dbProducts;
    saveBackupFileProducts(dbProducts);
    return normalizeProducts(dbProducts);
  }

  if (memoryProductsCache && memoryProductsCache.length > 0) {
    return normalizeProducts(memoryProductsCache);
  }

  const backupProducts = loadBackupFileProducts();
  if (backupProducts && backupProducts.length > 0) {
    memoryProductsCache = backupProducts;
    return normalizeProducts(backupProducts);
  }

  return [];
}

export async function GET(req: NextRequest) {
  const shared = await sharedWebsiteCatalog(req);
  if (shared) return shared;
  try {
    const products = normalizeProducts(await getResolvedProducts());
    const responseProducts = req.nextUrl.searchParams.get("view") === "storefront"
      ? products.map(({ wordpressSource, ...product }) => ({
          ...product,
          sourcePostType: wordpressSource?.postType,
        }))
      : products;
    return NextResponse.json({
      success: true,
      products: responseProducts,
      count: responseProducts.length,
    });
  } catch (err: any) {
    console.error("GET /api/products error:", err);
    const backup = loadBackupFileProducts() || memoryProductsCache || [];
    return NextResponse.json({
      success: true,
      products: backup,
      count: backup.length,
    });
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const body = await req.clone().json();
    if (body.action === 'sync') {
      return NextResponse.json({ success: false, error: 'Bulk replacement is disabled for the shared catalogue. Save individual products instead.' }, { status: 409 });
    }
  }
  const shared = await sharedWebsiteCatalog(req);
  if (shared) return shared;
  try {
    const body = await req.json();

    // Bulk sync support
    if (body.action === "sync" && Array.isArray(body.products)) {
      const products: Product[] = normalizeProducts(body.products);
      memoryProductsCache = products;
      saveBackupFileProducts(products);
      const pool = getDbPool();
      const persisted = await saveProductsToDb(pool, products);
      if (!persisted) {
        return NextResponse.json({ success: false, error: "Shared MySQL catalogue write failed" }, { status: 503 });
      }
      return NextResponse.json({
        success: true,
        count: products.length,
        products,
      });
    }

    // Single product creation / update
    const currentProducts = await getResolvedProducts();
    const now = new Date().toISOString();
    const incomingKeys = new Set(identityKeys(body));
    const existingProduct = currentProducts.find((product) => identityKeys(product).some((key) => incomingKeys.has(key)));
    const newProduct: Product = {
      ...existingProduct,
      ...body,
      createdAt: body.createdAt || (existingProduct as any)?.createdAt || now,
      updatedAt: now,
    };
    if (!newProduct.id) {
      newProduct.id = `prod-${Date.now()}`;
    }

    const updated = normalizeProducts([newProduct, ...currentProducts.filter((p) => p.id !== existingProduct?.id)]);
    memoryProductsCache = updated;
    saveBackupFileProducts(updated);
    const pool = getDbPool();
    const persisted = await saveProductsToDb(pool, updated);
    if (!persisted) {
      return NextResponse.json({ success: false, error: "Shared MySQL catalogue write failed" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      product: newProduct,
      products: updated,
    });
  } catch (err: any) {
    console.error("POST /api/products error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save product" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Bulk replacement is disabled for the shared catalogue' }, { status: 409 });
  }
  try {
    const body = await req.json();
    const products: Product[] = normalizeProducts(Array.isArray(body) ? body : body.products || []);

    if (!Array.isArray(products)) {
      return NextResponse.json({ success: false, error: "Invalid payload: array expected" }, { status: 400 });
    }

    memoryProductsCache = products;
    saveBackupFileProducts(products);
    const pool = getDbPool();
    const persisted = await saveProductsToDb(pool, products);
    if (!persisted) {
      return NextResponse.json({ success: false, error: "Shared MySQL catalogue write failed" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err: any) {
    console.error("PUT /api/products error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update products" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const shared = await sharedWebsiteCatalog(req);
  if (shared) return shared;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing product ID" }, { status: 400 });
    }

    const current = await getResolvedProducts();
    const updated = current.filter((p) => p.id !== id);
    memoryProductsCache = updated;
    saveBackupFileProducts(updated);
    const pool = getDbPool();
    const persisted = await saveProductsToDb(pool, updated);
    if (!persisted) {
      return NextResponse.json({ success: false, error: "Shared MySQL catalogue write failed" }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      count: updated.length,
      products: updated,
    });
  } catch (err: any) {
    console.error("DELETE /api/products error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete product" },
      { status: 500 }
    );
  }
}
