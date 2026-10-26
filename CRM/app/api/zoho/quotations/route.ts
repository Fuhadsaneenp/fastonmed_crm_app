import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { fetchAllZohoQuotations, mapZohoQuotation } from "@/lib/zoho-quotation-sync";
import type { Quotation } from "@/types";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const pool = getDbPool();
    const [configRows]: any = await pool.query("SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1", ["fastonmed_zoho_config_v1"]);
    const config = typeof configRows[0]?.value === "string" ? JSON.parse(configRows[0].value) : configRows[0]?.value || {};
    const clientId = process.env.ZOHO_CLIENT_ID || config.clientId;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET || config.clientSecret;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN || config.refreshToken;
    const organizationId = process.env.ZOHO_ORGANIZATION_ID || config.organizationId;
    if (!clientId || !clientSecret || !refreshToken || !organizationId) return NextResponse.json({ success: false, error: "Connect Zoho Books in settings before syncing quotations." }, { status: 400 });
    const accounts = (process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com").replace(/\/$/, "");
    const tokenResponse = await fetch(`${accounts}/oauth/v2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }), cache: "no-store", signal: AbortSignal.timeout(20000) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) return NextResponse.json({ success: false, error: "Zoho authorization failed. Reconnect Zoho Books and try again." }, { status: 400 });
    const api = (process.env.ZOHO_API_BASE_URL || "https://www.zohoapis.com").replace(/\/$/, "");
    const raw = await fetchAllZohoQuotations(async page => {
      const url = new URL(`${api}/books/v3/estimates`);
      url.searchParams.set("organization_id", organizationId); url.searchParams.set("page", String(page)); url.searchParams.set("per_page", "200"); url.searchParams.set("sort_column", "date"); url.searchParams.set("sort_order", "D");
      const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
      if (response.status === 401 || response.status === 403) throw new Error("Zoho connection lacks quotation access. Reconnect with ZohoBooks.estimates.READ permission. Existing quotations were preserved.");
      if (!response.ok) throw new Error(`Zoho quotation request failed (${response.status}). Existing quotations were preserved.`);
      return response.json();
    });
    const connection = await pool.getConnection();
    let quotes: Quotation[] = [];
    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.query("SELECT * FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1 FOR UPDATE", ["fastonmed_quotations_v1"]);
      const previous: Quotation[] = rows[0]?.value ? (typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value) : [];
      const incomingIds = new Set(raw.map(item => String(item.estimate_id)));
      const incomingNumbers = new Set(raw.map(item => String(item.estimate_number)));
      quotes = raw.map(item => mapZohoQuotation(item, previous.find(quote => quote.id === String(item.estimate_id) || quote.quotationNumber === item.estimate_number)));
      quotes.push(...previous.filter(quote => !incomingIds.has(quote.id) && !incomingNumbers.has(quote.quotationNumber)));
      quotes.sort((a, b) => b.date.localeCompare(a.date));
      const [companies]: any = await connection.query("SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1");
      if (!companies[0]?.id) throw new Error("CRM company configuration is missing");
      // Preserve a database backup before each successful sync.
      await connection.query("INSERT INTO CompanySetting (id,companyId,`key`,`value`,createdAt,updatedAt) VALUES (?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`),updatedAt=NOW()", ["setting_fastonmed_quotations_before_zoho_sync", companies[0].id, "fastonmed_quotations_before_zoho_sync", JSON.stringify(previous)]);
      await connection.query("INSERT INTO CompanySetting (id,companyId,`key`,`value`,createdAt,updatedAt) VALUES (?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`),updatedAt=NOW()", [rows[0]?.id || "setting_fastonmed_quotations_v1", companies[0].id, "fastonmed_quotations_v1", JSON.stringify(quotes)]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    return NextResponse.json({ success: true, quotes, count: raw.length, source: "zoho_books", syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to sync Zoho quotations" }, { status: 502 });
  }
}
