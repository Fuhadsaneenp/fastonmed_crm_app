import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDbPool } from "@/lib/db";
import fs from "fs";
import path from "path";
import type { Invoice } from "@/types";

const ZOHO_REFRESH_TOKEN_COOKIE = "fastonmed_zoho_refresh_token";
const ZOHO_ORG_ID_COOKIE = "fastonmed_zoho_organization_id";
const SETTING_KEY_INVOICES = "fastonmed_invoices_v1";
const SETTING_KEY_QUOTATIONS = "fastonmed_quotations_v1";
const SETTING_KEY_ZOHO_CONFIG = "fastonmed_zoho_config_v1";

type ZohoSyncRequest = {
  resource?: "invoices";
  webhookUrl?: string;
  zohoData?: unknown;
  organizationId?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

type ZohoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type ZohoOrganization = {
  organization_id: string;
  is_default_org?: boolean;
};

async function readJsonOrText(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapZohoFunctionOutput(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;

  const record = payload as Record<string, unknown>;
  const details = record.details;
  if (details && typeof details === "object" && "output" in details) {
    const output = (details as Record<string, unknown>).output;
    if (typeof output === "string") {
      try {
        return JSON.parse(output);
      } catch {
        return output;
      }
    }
    return output;
  }

  return payload;
}

async function fetchZohoBooksJson(path: string, accessToken: string, organizationId?: string) {
  const apiBase = (process.env.ZOHO_API_BASE_URL || "https://www.zohoapis.com").replace(/\/$/, "");
  const url = new URL(`${apiBase}/books/v3/${path}`);
  if (organizationId) url.searchParams.set("organization_id", organizationId);

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const data = await readJsonOrText(resp);
  if (!resp.ok) {
    return {
      ok: false,
      status: resp.status,
      data,
    };
  }

  return { ok: true, status: resp.status, data };
}

async function persistZohoInvoices(rawInvoices: any[]): Promise<Invoice[]> {
  if (!Array.isArray(rawInvoices)) throw new Error("Zoho did not return an invoice list");
  try {
    const pool = getDbPool();
    let existing: Invoice[] = [];
    const [rows]: any = await pool.query(
      "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
      [SETTING_KEY_INVOICES]
    );
    if (rows && rows[0]?.value) {
      const parsed = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
      if (Array.isArray(parsed)) existing = parsed;
    }

    const map = new Map<string, Invoice>();
    for (const inv of rawInvoices) {
      const total = Number(inv.total || inv.amount || 0);
      const balance = inv.balance !== undefined ? Number(inv.balance) : inv.balance_due !== undefined ? Number(inv.balance_due) : total;
      const s = (inv.status || "").toLowerCase().trim();
      const status = s === "paid" ? "Paid" : s === "partially paid" || s === "partially_paid" ? "Partially Paid" : s === "overdue" ? "Overdue" : s === "draft" ? "Draft" : "Pending";

      const mapped: Invoice = {
        id: inv.invoice_id || inv.id || `inv-${Date.now()}`,
        invoiceNumber: inv.invoice_number || inv.invoiceNumber || `FMT-INV26-0000`,
        orderNumber: inv.reference_number || inv.orderNumber || "",
        clientId: inv.customer_id || inv.clientId || `cust-${Date.now()}`,
        clientName: inv.customer_name || inv.clientName || "Customer",
        amount: total,
        balanceDue: balance,
        status,
        dueDate: inv.due_date || inv.dueDate || new Date().toISOString().slice(0, 10),
        createdAt: inv.date || inv.createdAt || new Date().toISOString().slice(0, 10),
        items: Array.isArray(inv.line_items) && inv.line_items.length > 0
          ? inv.line_items.map((li: any) => ({
              product: li.name || li.item_name || "Medical Equipment & Services",
              qty: Number(li.quantity || 1),
              rate: Number(li.rate || total),
              amount: Number(li.item_total || li.amount || total),
            }))
          : [{ product: "Biomedical Equipment Maintenance", qty: 1, rate: total, amount: total }],
      };

      const key = (mapped.invoiceNumber || mapped.id).toLowerCase().trim();
      if (key) map.set(key, mapped);
    }

    for (const inv of existing) {
      const key = (inv.invoiceNumber || inv.id || "").toLowerCase().trim();
      if (key && !map.has(key)) {
        map.set(key, inv);
      }
    }

    const merged = Array.from(map.values());
    merged.sort((a, b) => {
      const dateA = a.createdAt || "";
      const dateB = b.createdAt || "";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.invoiceNumber || "").localeCompare(a.invoiceNumber || "");
    });

    const [compRows]: any = await pool.query("SELECT id FROM Company LIMIT 1");
    const companyId = compRows[0]?.id || "cmrtifqe00002ty4zqy0vdpsr";
    const now = new Date();

    await pool.query(
      `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
      [`setting_${SETTING_KEY_INVOICES}`, companyId, SETTING_KEY_INVOICES, JSON.stringify(merged), now, now]
    );

    const backupFile = path.join(process.cwd(), "data", "invoices_store.json");
    try {
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
      fs.writeFileSync(backupFile, JSON.stringify(merged, null, 2), "utf-8");
    } catch {
      console.warn("Invoice database saved; optional local backup is unavailable");
    }
    return merged;
  } catch (err) {
    console.warn("Failed to persist Zoho invoices to DB:", err);
    throw new Error("Zoho invoices were fetched but could not be saved");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ZohoSyncRequest;
    const cookieStore = await cookies();
    const pool = getDbPool();

    // Check DB for stored Zoho config if not provided in body
    let savedConfig: Record<string, unknown> = {};
    let webhookUrl = body.webhookUrl;
    let organizationId = body.organizationId || process.env.ZOHO_ORGANIZATION_ID || cookieStore.get(ZOHO_ORG_ID_COOKIE)?.value;
    let clientId = body.clientId || process.env.ZOHO_CLIENT_ID;
    let clientSecret = body.clientSecret || process.env.ZOHO_CLIENT_SECRET;
    let refreshToken = body.refreshToken || cookieStore.get(ZOHO_REFRESH_TOKEN_COOKIE)?.value || process.env.ZOHO_REFRESH_TOKEN;

    try {
      const [cfgRows]: any = await pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? LIMIT 1",
        [SETTING_KEY_ZOHO_CONFIG]
      );
      if (cfgRows && cfgRows[0]?.value) {
        const parsedCfg = typeof cfgRows[0].value === "string" ? JSON.parse(cfgRows[0].value) : cfgRows[0].value;
        savedConfig = parsedCfg || {};
        if (!webhookUrl && parsedCfg?.webhookUrl) webhookUrl = parsedCfg.webhookUrl;
        if (!organizationId && parsedCfg?.organizationId) organizationId = parsedCfg.organizationId;
        if (!clientId && parsedCfg?.clientId) clientId = parsedCfg.clientId;
        if (!clientSecret && parsedCfg?.clientSecret) clientSecret = parsedCfg.clientSecret;
        if (!refreshToken && parsedCfg?.refreshToken) refreshToken = parsedCfg.refreshToken;
      }
    } catch {}

    // Save webhookUrl to DB if newly supplied
    if (body.webhookUrl && body.webhookUrl.trim().startsWith("http")) {
      try {
        const [compRows]: any = await pool.query("SELECT id FROM Company LIMIT 1");
        const companyId = compRows[0]?.id || "cmrtifqe00002ty4zqy0vdpsr";
        const now = new Date();
        const cfgObj = {
          ...savedConfig,
          webhookUrl: body.webhookUrl.trim(),
          organizationId: organizationId || "",
          updatedAt: now.toISOString(),
        };
        await pool.query(
          `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
          [`setting_${SETTING_KEY_ZOHO_CONFIG}`, companyId, SETTING_KEY_ZOHO_CONFIG, JSON.stringify(cfgObj), now, now]
        );
      } catch {}
    }

    // Mode 1: Direct JSON payload sent from user/tester
    if (body.zohoData) {
      const delugeResult = unwrapZohoFunctionOutput(body.zohoData);
      if (delugeResult && typeof delugeResult === "object" && "invoices" in delugeResult) {
        await persistZohoInvoices((delugeResult as any).invoices);
      }
      return NextResponse.json({
        success: true,
        source: "direct_payload",
        data: delugeResult,
      });
    }

    // Mode 2: Zoho Deluge Webhook (runs invokeUrl with fastonmedcrm in Zoho)
    if (webhookUrl && webhookUrl.trim().startsWith("http")) {
      const resp = await fetch(webhookUrl.trim(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!resp.ok) {
        const errData = await readJsonOrText(resp);
        return NextResponse.json(
          {
            success: false,
            error: `Zoho function returned status ${resp.status}`,
            details: errData,
          },
          { status: 400 }
        );
      }

      const delugeResult = unwrapZohoFunctionOutput(await readJsonOrText(resp));
      const rawInvoices = Array.isArray(delugeResult) ? delugeResult : (delugeResult as any)?.invoices;
      if (!Array.isArray(rawInvoices)) {
        throw new Error("Zoho function did not return invoices. Check the saved function connection.");
      }
      const invoices = await persistZohoInvoices(rawInvoices);

      return NextResponse.json({
        invoices,
        success: true,
        source: "zoho_deluge_webhook",
        data: delugeResult,
      });
    }

    // Mode 3: Direct Zoho Books REST API OAuth
    if (clientId && clientSecret && refreshToken) {
      // 1. Get Access Token from Zoho Accounts
      const tokenParams = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      });
      const accountsUrl = (process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com").replace(/\/$/, "");
      const tokenResp = await fetch(`${accountsUrl}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      const tokenData = (await readJsonOrText(tokenResp)) as ZohoTokenResponse;
      if (!tokenData.access_token) {
        return NextResponse.json(
          {
            success: false,
            error: tokenData.error_description || tokenData.error || "Failed to generate Zoho access token",
          },
          { status: 400 }
        );
      }

      const accessToken = tokenData.access_token;
      let resolvedOrganizationId = organizationId?.trim();

      if (!resolvedOrganizationId) {
        const orgsResult = await fetchZohoBooksJson("organizations", accessToken);
        if (!orgsResult.ok) {
          return NextResponse.json(
            {
              success: false,
              error: "Could not auto-detect Zoho Books organization. Enter the Organization ID manually.",
              details: orgsResult.data,
            },
            { status: 400 }
          );
        }

        const orgsData = orgsResult.data as { organizations?: ZohoOrganization[] };
        const orgs = orgsData.organizations || [];
        resolvedOrganizationId =
          orgs.find((org) => org.is_default_org)?.organization_id || orgs[0]?.organization_id;
      }

      if (!resolvedOrganizationId) {
        return NextResponse.json(
          {
            success: false,
            error: "Zoho Books Organization ID was not found.",
          },
          { status: 400 }
        );
      }

      // 2. Fetch Invoices
      const allInvoices: any[] = [];
      let page = 1;
      while (true) {
        const result = await fetchZohoBooksJson(`invoices?page=${page}&per_page=200`, accessToken, resolvedOrganizationId);
        const payload = result.data as { code?: number; message?: string; invoices?: any[]; page_context?: { has_more_page?: boolean } };
        if (!result.ok || (payload.code !== undefined && payload.code !== 0) || !Array.isArray(payload.invoices)) {
          throw new Error(payload.message || "Zoho could not return invoices");
        }
        allInvoices.push(...payload.invoices);
        if (!payload.page_context?.has_more_page) break;
        page += 1;
      }
      const invoicesJson = { invoices: allInvoices };
      const invoices = await persistZohoInvoices(allInvoices);
      if (body.resource === "invoices") {
        return NextResponse.json({ success: true, source: "zoho_direct_api", invoices, count: invoices.length });
      }

      // 3. Fetch Contacts
      const contactsResult = await fetchZohoBooksJson("contacts", accessToken, resolvedOrganizationId);
      const contactsJson = (contactsResult.ok ? contactsResult.data : {}) as { contacts?: unknown[] };

      // 4. Fetch Quotes (Estimates in Zoho Books API)
      const estimatesResult = await fetchZohoBooksJson("estimates", accessToken, resolvedOrganizationId);
      const estimatesJson = (estimatesResult.ok ? estimatesResult.data : {}) as { estimates?: unknown[] };

      return NextResponse.json({
        success: true,
        source: "zoho_direct_api",
        invoices,
        data: {
          contacts: contactsJson.contacts || [],
          invoices: invoicesJson.invoices || [],
          quotes: estimatesJson.estimates || [],
          organization_id: resolvedOrganizationId,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: "The saved Zoho connection is unavailable on this server. Check Zoho Books connection in Settings.",
    }, { status: 409 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error during Zoho sync",
      },
      { status: 500 }
    );
  }
}
