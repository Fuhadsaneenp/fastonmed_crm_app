import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDbPool } from "@/lib/db";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  try {
    const [rows]: any = await getDbPool().query("SELECT `value` FROM CompanySetting WHERE `key`=? ORDER BY updatedAt DESC LIMIT 1", ["fastonmed_zoho_config_v1"]);
    const saved = typeof rows[0]?.value === "string" ? JSON.parse(rows[0].value) : rows[0]?.value || {};
    const clientId = process.env.ZOHO_CLIENT_ID || saved.clientId;
    if (!clientId) return NextResponse.json({ success: false, error: "Configure the Zoho OAuth client before connecting." }, { status: 400 });
    const state = randomBytes(32).toString("hex");
    const authUrl = new URL("/oauth/v2/auth", process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com");
    authUrl.searchParams.set("scope", "ZohoBooks.settings.READ,ZohoBooks.invoices.READ,ZohoBooks.estimates.READ");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", process.env.ZOHO_REDIRECT_URI || "https://crm.fastonmed.com/api/zoho/oauth/callback");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("fastonmed_zoho_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Could not prepare Zoho reconnection. Try again shortly." }, { status: 503 });
  }
}
