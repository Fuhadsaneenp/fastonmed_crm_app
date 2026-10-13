import { NextResponse } from "next/server";

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
  const redirectTo = new URL("/settings", requestUrl.origin);

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

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    redirectTo.searchParams.set("zoho", "error");
    redirectTo.searchParams.set("message", "Missing Zoho OAuth environment credentials.");
    return NextResponse.redirect(redirectTo);
  }

  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
  const redirectUri =
    process.env.ZOHO_REDIRECT_URI || `${requestUrl.origin}/api/zoho/oauth/callback`;

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

  let organizationId = "";
  const orgResp = await fetch("https://www.zohoapis.com/books/v3/organizations", {
    headers: {
      Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
      Accept: "application/json",
    },
  });

  if (orgResp.ok) {
    const orgData = (await readJsonOrText(orgResp)) as ZohoOrganizationsResponse;
    const orgs = orgData.organizations || [];
    organizationId =
      orgs.find((org) => org.is_default_org)?.organization_id || orgs[0]?.organization_id || "";
  }

  redirectTo.searchParams.set("zoho", "connected");
  if (organizationId) redirectTo.searchParams.set("organization_id", organizationId);

  const res = NextResponse.redirect(redirectTo);
  res.cookies.set(ZOHO_REFRESH_TOKEN_COOKIE, tokenData.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  if (organizationId) {
    res.cookies.set(ZOHO_ORG_ID_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}
