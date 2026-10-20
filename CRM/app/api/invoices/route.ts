import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { Invoice } from "@/types";
import { ZOHO_LIVE_INVOICES } from "@/lib/zoho-live-invoices";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const SETTING_KEY_INVOICES = "fastonmed_invoices_v1";
const SETTING_KEY_ZOHO_CONFIG = "fastonmed_zoho_config_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "invoices_store.json");

let memoryInvoicesCache: Invoice[] | null = null;

function loadBackupFileInvoices(): Invoice[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup invoices file:", err);
  }
  return null;
}

function saveBackupFileInvoices(invoices: Invoice[]): void {
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(invoices, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup invoices file:", err);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DB operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function getValidCompanyId(pool: any): Promise<string> {
  try {
    const [rows]: any = await withTimeout(pool.query("SELECT id FROM Company LIMIT 1"), 1500);
    if (rows && rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }
  } catch {}
  return "cmrtifqe00002ty4zqy0vdpsr";
}

async function getStoredInvoicesFromDb(pool: any): Promise<Invoice[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_INVOICES]
      ),
      1800
    );
    if (rows && rows.length > 0 && rows[0].value) {
      const val = rows[0].value;
      const parsed = typeof val === "string" ? JSON.parse(val) : val;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn("Could not read invoices from MySQL DB (using local fallback):", err?.message || err);
  }
  return null;
}

async function saveInvoicesToDb(pool: any, invoices: Invoice[]): Promise<boolean> {
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(invoices);
    const now = new Date();
    const id = `setting_${SETTING_KEY_INVOICES}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_INVOICES, jsonStr, now, now]
      ),
      2000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write invoices to MySQL DB:", err?.message || err);
    return false;
  }
}

function mapInvoiceStatus(rawStatus?: string): "Paid" | "Pending" | "Overdue" | "Partially Paid" | "Draft" {
  const s = (rawStatus || "").toLowerCase().trim();
  if (s === "paid") return "Paid";
  if (s === "partially paid" || s === "partially_paid") return "Partially Paid";
  if (s === "overdue") return "Overdue";
  if (s === "draft") return "Draft";
  return "Pending";
}

function mapRawZohoInvoice(item: any, idx: number): Invoice {
  const total = Number(item.total || item.amount || 0);
  const balance = item.balance !== undefined ? Number(item.balance) : item.balance_due !== undefined ? Number(item.balance_due) : total;

  return {
    id: item.invoice_id || item.id || `inv-${Date.now()}-${idx}`,
    invoiceNumber: item.invoice_number || item.invoiceNumber || `FMT-INV26-0${100 + idx}`,
    orderNumber: item.reference_number || item.orderNumber || "",
    clientId: item.customer_id || item.clientId || `cust-${idx}`,
    clientName: item.customer_name || item.clientName || "Customer",
    amount: total,
    balanceDue: balance,
    status: mapInvoiceStatus(item.status),
    dueDate: item.due_date || item.dueDate || new Date().toISOString().slice(0, 10),
    createdAt: item.date || item.createdAt || new Date().toISOString().slice(0, 10),
    items: Array.isArray(item.line_items) && item.line_items.length > 0
      ? item.line_items.map((li: any, liIdx: number) => ({
          product: li.name || li.item_name || li.description || "Medical Equipment & Services",
          qty: Number(li.quantity || 1),
          rate: Number(li.rate || total),
          amount: Number(li.item_total || li.amount || total),
        }))
      : [{
          product: "Biomedical Equipment Maintenance & Solutions",
          qty: 1,
          rate: total,
          amount: total,
        }],
  };
}

function mergeInvoices(current: Invoice[], incoming: Invoice[]): Invoice[] {
  const map = new Map<string, Invoice>();
  // 1. Put incoming invoices
  for (const inv of incoming) {
    const key = (inv.invoiceNumber || inv.id || "").trim().toLowerCase();
    if (key) map.set(key, inv);
  }
  // 2. Put or merge current invoices
  for (const inv of current) {
    const key = (inv.invoiceNumber || inv.id || "").trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, inv);
    }
  }

  const merged = Array.from(map.values());
  // Sort descending by date, then invoice number
  merged.sort((a, b) => {
    const dateA = a.createdAt || "";
    const dateB = b.createdAt || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.invoiceNumber || "").localeCompare(a.invoiceNumber || "");
  });

  return merged;
}

async function trySyncFromZohoBooks(existing: Invoice[]): Promise<Invoice[] | null> {
  try {
    const cookieStore = await cookies();
    const pool = getDbPool();

    // Check stored zoho config in db
    let webhookUrl: string | undefined;
    let refreshToken = cookieStore.get("fastonmed_zoho_refresh_token")?.value || process.env.ZOHO_REFRESH_TOKEN;
    let clientId = process.env.ZOHO_CLIENT_ID;
    let clientSecret = process.env.ZOHO_CLIENT_SECRET;
    let organizationId = cookieStore.get("fastonmed_zoho_organization_id")?.value;

    try {
      const [rows]: any = await withTimeout(
        pool.query("SELECT `value` FROM CompanySetting WHERE `key` = ? LIMIT 1", [SETTING_KEY_ZOHO_CONFIG]),
        1000
      );
      if (rows && rows[0]?.value) {
        const parsed = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
        if (parsed?.webhookUrl) webhookUrl = parsed.webhookUrl;
        if (parsed?.refreshToken && !refreshToken) refreshToken = parsed.refreshToken;
        if (parsed?.clientId && !clientId) clientId = parsed.clientId;
        if (parsed?.clientSecret && !clientSecret) clientSecret = parsed.clientSecret;
        if (parsed?.organizationId && !organizationId) organizationId = parsed.organizationId;
      }
    } catch {}

    // Method 1: Webhook Deluge function
    if (webhookUrl && webhookUrl.trim().startsWith("http")) {
      const resp = await fetch(webhookUrl.trim(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (resp.ok) {
        const text = await resp.text();
        let payload: any = {};
        try { payload = JSON.parse(text); } catch { return null; }
        if (payload && typeof payload === "object" && "details" in payload && payload.details?.output) {
          try { payload = typeof payload.details.output === "string" ? JSON.parse(payload.details.output) : payload.details.output; } catch {}
        }
        const rawInvoices = Array.isArray(payload.invoices) ? payload.invoices : Array.isArray(payload) ? payload : null;
        if (rawInvoices && rawInvoices.length > 0) {
          const mapped = rawInvoices.map((item: any, idx: number) => mapRawZohoInvoice(item, idx));
          return mergeInvoices(existing, mapped);
        }
      }
    }

    // Method 2: Direct OAuth Zoho Books REST API
    if (clientId && clientSecret && refreshToken) {
      const tokenParams = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      });
      const tokenResp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });
      const tokenData = await tokenResp.json();
      if (tokenData?.access_token) {
        const accessToken = tokenData.access_token;
        const invUrl = new URL("https://www.zohoapis.com/books/v3/invoices");
        if (organizationId) invUrl.searchParams.set("organization_id", organizationId);

        const zohoResp = await fetch(invUrl.toString(), {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (zohoResp.ok) {
          const zohoJson = await zohoResp.json();
          if (Array.isArray(zohoJson?.invoices) && zohoJson.invoices.length > 0) {
            const mapped = zohoJson.invoices.map((item: any, idx: number) => mapRawZohoInvoice(item, idx));
            return mergeInvoices(existing, mapped);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Zoho automatic sync pass skipped:", err);
  }
  return null;
}

async function getResolvedInvoices(allowLiveSync = false): Promise<Invoice[]> {
  const pool = getDbPool();
  let baseInvoices: Invoice[] = [];

  const dbInvoices = await getStoredInvoicesFromDb(pool);
  if (dbInvoices && dbInvoices.length > 0) {
    baseInvoices = dbInvoices;
  } else {
    const backupInvoices = loadBackupFileInvoices();
    if (backupInvoices && backupInvoices.length > 0) {
      baseInvoices = backupInvoices;
      saveInvoicesToDb(pool, backupInvoices).catch(() => {});
    } else if (memoryInvoicesCache && memoryInvoicesCache.length > 0) {
      baseInvoices = memoryInvoicesCache;
    } else {
      // Seed default 73 Zoho Live Invoices
      baseInvoices = ZOHO_LIVE_INVOICES;
      saveInvoicesToDb(pool, ZOHO_LIVE_INVOICES).catch(() => {});
      saveBackupFileInvoices(ZOHO_LIVE_INVOICES);
    }
  }

  // If live sync is requested or periodic check
  if (allowLiveSync) {
    const synced = await trySyncFromZohoBooks(baseInvoices);
    if (synced) {
      baseInvoices = synced;
      saveInvoicesToDb(pool, synced).catch(() => {});
      saveBackupFileInvoices(synced);
    }
  }

  memoryInvoicesCache = baseInvoices;
  return baseInvoices;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doSync = searchParams.get("sync") === "1" || searchParams.get("sync") === "true";
    const invoices = await getResolvedInvoices(doSync);

    return NextResponse.json({
      success: true,
      data: invoices,
      invoices,
      count: invoices.length,
    });
  } catch (err: any) {
    console.error("GET /api/invoices error:", err);
    const backup = loadBackupFileInvoices() || memoryInvoicesCache || ZOHO_LIVE_INVOICES;
    return NextResponse.json({
      success: true,
      data: backup,
      invoices: backup,
      count: backup.length,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pool = getDbPool();
    const currentInvoices = await getResolvedInvoices(false);

    // 1. Bulk sync or array payload
    if (body.action === "sync" && Array.isArray(body.invoices)) {
      const merged = mergeInvoices(currentInvoices, body.invoices);
      memoryInvoicesCache = merged;
      saveBackupFileInvoices(merged);
      await saveInvoicesToDb(pool, merged);
      return NextResponse.json({
        success: true,
        count: merged.length,
        data: merged,
        invoices: merged,
      });
    }

    if (Array.isArray(body)) {
      const merged = mergeInvoices(currentInvoices, body);
      memoryInvoicesCache = merged;
      saveBackupFileInvoices(merged);
      await saveInvoicesToDb(pool, merged);
      return NextResponse.json({
        success: true,
        count: merged.length,
        data: merged,
        invoices: merged,
      });
    }

    // 2. Single invoice creation / update
    const newInvoice: Invoice = body.invoice || body;
    if (!newInvoice.id) {
      newInvoice.id = `inv-${Date.now()}`;
    }
    if (!newInvoice.invoiceNumber) {
      newInvoice.invoiceNumber = `FMT-INV26-00${Math.floor(Math.random() * 80 + 75)}`;
    }

    const merged = mergeInvoices(currentInvoices, [newInvoice]);
    memoryInvoicesCache = merged;
    saveBackupFileInvoices(merged);
    await saveInvoicesToDb(pool, merged);

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      data: merged,
      invoices: merged,
      count: merged.length,
    });
  } catch (err: any) {
    console.error("POST /api/invoices error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save invoice" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing invoice ID" }, { status: 400 });
    }

    const current = await getResolvedInvoices(false);
    const updated = current.filter((inv) => inv.id !== id && inv.invoiceNumber !== id);
    memoryInvoicesCache = updated;
    saveBackupFileInvoices(updated);
    const pool = getDbPool();
    await saveInvoicesToDb(pool, updated);

    return NextResponse.json({
      success: true,
      deletedId: id,
      count: updated.length,
      invoices: updated,
    });
  } catch (err: any) {
    console.error("DELETE /api/invoices error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
