import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDbPool } from "@/lib/db";

const ZOHO_REFRESH_TOKEN_COOKIE = "fastonmed_zoho_refresh_token";
const ZOHO_ORG_ID_COOKIE = "fastonmed_zoho_organization_id";

type ZohoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type ZohoOrganizationsResponse = {
  organizations?: {
    organization_id: string;
    is_default_org?: boolean;
  }[];
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

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const redirectTo = new URL("/quotations", "https://crm.fastonmed.com");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("fastonmed_zoho_oauth_state")?.value;
  if (!expectedState || requestUrl.searchParams.get("state") !== expectedState) {
    return NextResponse.json({ success: false, error: "Zoho connection expired. Start the connection again." }, { status: 400 });
  }
  const pool = getDbPool();
  const [savedRows]: any = await pool.query("SELECT * FROM CompanySetting WHERE `key`=? ORDER BY updatedAt DESC LIMIT 1", ["fastonmed_zoho_config_v1"]);
  const saved = typeof savedRows[0]?.value === "string" ? JSON.parse(savedRows[0].value) : savedRows[0]?.value || {};

  if (error) {
    redirectTo.searchParams.set("zoho", "error");
    redirectTo.searchParams.set("message", error);
    return NextResponse.redirect(redirectTo);
  }

  if (!code) {
    redirectTo.searchParams.set("zoho", "error");
    redirectTo.searchParams.set("message", "Zoho did not return an authorization code.");
    return NextResponse.redirect(redirectTo);
  }

  const clientId = process.env.ZOHO_CLIENT_ID || saved.clientId;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || saved.clientSecret;
  if (!clientId || !clientSecret) {
    redirectTo.searchParams.set("zoho", "error");
    redirectTo.searchParams.set("message", "Missing Zoho OAuth environment credentials.");
    return NextResponse.redirect(redirectTo);
  }

  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
  const redirectUri =
    process.env.ZOHO_REDIRECT_URI || "https://crm.fastonmed.com/api/zoho/oauth/callback";

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResp = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const tokenData = (await readJsonOrText(tokenResp)) as ZohoTokenResponse;

  if (!tokenData.refresh_token || !tokenData.access_token) {
    redirectTo.searchParams.set("zoho", "error");
    redirectTo.searchParams.set(
      "message",
      tokenData.error_description || tokenData.error || "Could not connect Zoho Books."
    );
    return NextResponse.redirect(redirectTo);
  }

  let organizationId = process.env.ZOHO_ORGANIZATION_ID || saved.organizationId || "";
  const orgResp = await fetch("https://www.zohoapis.com/books/v3/organizations", {
    headers: {
      Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
      Accept: "application/json",
    },
  });

  if (orgResp.ok) {
    const orgData = (await readJsonOrText(orgResp)) as ZohoOrganizationsResponse;
    const orgs = orgData.organizations || [];
    organizationId = organizationId ||
      orgs.find((org) => org.is_default_org)?.organization_id || orgs[0]?.organization_id || "";
  }

  if (!organizationId) return NextResponse.json({ success: false, error: "Zoho did not return an organisation. Existing connection was preserved." }, { status: 400 });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [companies]: any = await connection.query("SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1");
    if (!companies[0]?.id) throw new Error("CRM company is missing");
    const value = { ...saved, clientId, clientSecret, refreshToken: tokenData.refresh_token, organizationId, mode: "oauth", updatedAt: new Date().toISOString() };
    await connection.query("INSERT INTO CompanySetting (id,companyId,`key`,`value`,createdAt,updatedAt) VALUES (?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`),updatedAt=NOW()", [savedRows[0]?.id || "setting_fastonmed_zoho_config_v1", companies[0].id, "fastonmed_zoho_config_v1", JSON.stringify(value)]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  redirectTo.searchParams.set("zoho", "connected");
  if (organizationId) redirectTo.searchParams.set("organization_id", organizationId);

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete("fastonmed_zoho_oauth_state");
  res.cookies.set(ZOHO_REFRESH_TOKEN_COOKIE, tokenData.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  if (organizationId) {
    res.cookies.set(ZOHO_ORG_ID_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}
