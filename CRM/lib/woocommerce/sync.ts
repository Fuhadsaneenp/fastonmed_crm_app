import { getAuthToken } from '@/lib/api-client';
import type { Product } from '@/types';
import { getStoredProducts, saveStoredProducts } from '@/lib/trader-store';
import { finishWooCommerceSync, getWooCommerceProducts, getWooCommerceProductIds, notifyWooCommerceProductsUpdated, putWooCommerceProducts, type LinkedProduct } from './catalog-store';
export type WooProduct = {
  id: number;
  revision: string;
  crmId: string;
  name: string;
  sku: string;
  type: string;
  description: string;
  price: string;
  stock: number | null;
  stockStatus?: string;
  image: string;
  categories: string[];
  brand?: string;
  attributes: Record<string, string>;
  url: string;
  status: string;
};

export async function syncTaxonomies(authToken?: string): Promise<{ categories: string[]; brands: string[] }> {
  const token = authToken || getAuthToken() || 'session-token-admin';
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  let categories: string[] = [];
  let brands: string[] = [];

  try {
    const res = await fetch('/api/woocommerce?type=categories', { headers });
    const d = await res.json().catch(() => null);
    if (Array.isArray(d?.categories) && d.categories.length > 0) {
      categories = d.categories
        .map((c: any) => String(c.name || '').trim())
        .filter((name: string) => Boolean(name && name !== 'Uncategorized'));

      if (typeof window !== 'undefined') {
        const sorted = Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
        localStorage.setItem('fastonmed_product_categories', JSON.stringify(sorted));
        localStorage.setItem('fastonmed_woo_categories_rich', JSON.stringify(d.categories));
        window.dispatchEvent(new Event('fastonmed_categories_updated'));
      }
    }
  } catch (err) {
    console.warn('Could not sync WooCommerce categories:', err);
  }

  try {
    const res = await fetch('/api/woocommerce?type=brands', { headers });
    const d = await res.json().catch(() => null);
    if (Array.isArray(d?.brands) && d.brands.length > 0) {
      brands = d.brands
        .map((b: any) => String(b.name || '').trim())
        .filter((name: string) => Boolean(name && name.toLowerCase() !== 'manufacturer' && name.toLowerCase() !== 'unknown'));

      if (typeof window !== 'undefined') {
        const existing = JSON.parse(localStorage.getItem('fastonmed_product_brands') || '[]');
        const combined = Array.from(new Set([...existing, ...brands])).sort((a, b) => a.localeCompare(b));
        localStorage.setItem('fastonmed_product_brands', JSON.stringify(combined));
        localStorage.setItem('fastonmed_woo_brands_rich', JSON.stringify(d.brands));
        window.dispatchEvent(new Event('fastonmed_brands_updated'));
      }
    }
  } catch (err) {
    console.warn('Could not sync WooCommerce brands:', err);
  }

  return { categories, brands };
}

function publicFields(p: Product) { return { name: p.name, description: p.description, price: p.sellingPrice, stock: p.inStock, image: p.image || "", categories: [p.category], attributes: { ...p.specifications, Brand: p.brand, Model: p.model } }; }
function fingerprint(p: Product) {
  const input = JSON.stringify(publicFields(p));
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return `v2:${(hash >>> 0).toString(16)}`;
}
function baselineMatches(product: Product, baseline: string) {
  return baseline.startsWith('{') ? JSON.stringify(publicFields(product)) === baseline : fingerprint(product) === baseline;
}
function plain(html: string) { const doc = new DOMParser().parseFromString(html, 'text/html'); return doc.body.textContent || ''; }
async function wait(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function call(token: string, page = 1, body?: unknown) {
  const attempts = 3;
  let lastError = 'WooCommerce connection failed';
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(`/api/woocommerce?page=${page}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    lastError = data.error || (response.status === 401 ? 'Please sign in to the CRM again.' : 'WooCommerce request failed.');
    if (!data.retryable || attempt === attempts - 1) throw new Error(lastError);
    await wait(attempt === 0 ? 3000 : 6000);
  }
  throw new Error(lastError);
}
export async function syncWooCommerce(publishNew = false, onProgress?: (page: number, pages: number, products: number) => void) {
  const token = getAuthToken() || 'session-token-admin';
  const authToken = token;
  void syncTaxonomies(authToken);
  const first = await call(authToken, 1);
  if (first.currency !== 'AED') throw new Error('Store currency must be AED to match CRM pricing. No changes were made.');
  if (!Array.isArray(first.products) || !Number.isInteger(first.pages) || first.pages < 0) throw new Error('WooCommerce returned an invalid catalogue response. Check the installed connector version.');
  let imported = 0, pushed = 0;
  let total = 0;
  const conflicts: string[] = [];
  const failures: string[] = [];
  const local = getStoredProducts() as LinkedProduct[];
  const storedCatalog = await getWooCommerceProducts();
  const storedWooIds = await getWooCommerceProductIds();
  const activeWooIds = new Set<number>();

  const wooProductMap = new Map<number, LinkedProduct>();
  const crmProductMap = new Map<string, LinkedProduct>();
  const nameProductMap = new Map<string, LinkedProduct>();

  for (const p of [...storedCatalog, ...local]) {
    if (!p) continue;
    if (p.woo?.id) wooProductMap.set(Number(p.woo.id), p);
    if (p.id) crmProductMap.set(p.id, p);
    if (p.name) nameProductMap.set(p.name.trim().toLowerCase(), p);
  }

  async function importPage(remote: WooProduct[]) {
    const pageProducts: LinkedProduct[] = [];
    let pageNewOrUpdated = 0;
    for (let wp of remote) {
      try {
        activeWooIds.add(wp.id);
        const existing: LinkedProduct | undefined = (wp.id ? wooProductMap.get(wp.id) : undefined) ||
                         (wp.crmId ? crmProductMap.get(wp.crmId) : undefined) ||
                         (wp.name ? nameProductMap.get(wp.name.trim().toLowerCase()) : undefined);

        if (existing?.woo && !baselineMatches(existing, existing.woo.baseline)) {
          if (wp.revision !== existing.woo.revision || wp.type !== 'simple') {
            conflicts.push(wp.name);
            continue;
          }
          wp = await call(authToken, 1, { ...publicFields(existing), name: existing.name, id: wp.id, revision: wp.revision, crmId: existing.id }); pushed++;
          pageNewOrUpdated++;
        }
        const isNew = !existing && !storedWooIds.has(wp.id);
        if (isNew) {
          imported++;
          pageNewOrUpdated++;
        }
        const brandVal = wp.brand || wp.attributes?.Brand || wp.attributes?.brand || wp.attributes?.Manufacturer || existing?.brand || '';
        const catVal = wp.categories?.[0] || existing?.category || 'Uncategorized';
        const product: LinkedProduct = {
          ...(existing || {}), id: existing?.id || `woo-${wp.id}`, name: wp.name,
          description: plain(wp.description), sellingPrice: Number(wp.price) || 0,
          inStock: wp.stock ?? existing?.inStock ?? (wp.stockStatus === 'instock' ? 1 : 0), image: wp.image || existing?.image,
          category: catVal, brand: brandVal,
          model: wp.sku || existing?.model || '', specifications: {
            ...(wp.attributes || {}),
            ...(catVal ? { Category: catVal } : {}),
            ...(brandVal ? { Brand: brandVal } : {}),
          },
          supplier: existing?.supplier || '', purchaseCost: existing?.purchaseCost || 0,
          warrantyPeriod: existing?.warrantyPeriod || '', amcAvailable: existing?.amcAvailable || false,
          productUrl: wp.url,
        };
        product.woo = { id: wp.id, revision: wp.revision, type: wp.type, baseline: fingerprint(product) };
        pageProducts.push(product);

        if (wp.id) {
          wooProductMap.set(wp.id, product);
          storedWooIds.add(wp.id);
        }
        if (product.name) nameProductMap.set(product.name.trim().toLowerCase(), product);
        if (product.id) crmProductMap.set(product.id, product);
      } catch (error) { failures.push(`${wp.name}: ${error instanceof Error ? error.message : "Sync failed"}`); }
    }
    total += remote.length;
    await putWooCommerceProducts(pageProducts);
    return pageNewOrUpdated;
  }

  try {
    const isIncremental = storedWooIds.size > 0;
    const page1New = await importPage(first.products);
    onProgress?.(1, first.pages, total);

    // If incremental and page 1 already contained known products, all older pages are already synced.
    // Only continue if not incremental, or if ALL items on page 1 were brand new (>100 added).
    const shouldFetchOlderPages = !isIncremental || (first.products.length > 0 && page1New === first.products.length);

    if (shouldFetchOlderPages) {
      for (let page = 2; page <= first.pages; page++) {
        await wait(1200);
        const data = await call(authToken, page);
        if (data.currency !== 'AED' || !Array.isArray(data.products)) throw new Error('WooCommerce returned an invalid catalogue page. Previously imported pages remain available.');
        const pageNew = await importPage(data.products);
        onProgress?.(page, first.pages, total);
        if (isIncremental && pageNew < data.products.length) {
          // Already-synced products reached; stop fetching older pages
          break;
        }
      }
    }
  } catch (error) {
    notifyWooCommerceProductsUpdated();
    throw error;
  }
  await finishWooCommerceSync(activeWooIds);
  if (publishNew) {
    let localChanged = false;
    for (const product of local) {
      if (product.woo) continue;
      try {
      const wp: WooProduct = await call(authToken, 1, { ...publicFields(product), crmId: product.id, sku: product.id });
      product.woo = { id: wp.id, revision: wp.revision, type: wp.type, baseline: fingerprint(product) };
      localChanged = true; pushed++;
      } catch (error) { failures.push(`${product.name}: ${error instanceof Error ? error.message : "Sync failed"}`); }
    }
    if (localChanged) saveStoredProducts(local, true);
  }
  return { imported, pushed, conflicts, failures, total };
}
