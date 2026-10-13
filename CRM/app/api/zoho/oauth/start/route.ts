import { NextResponse } from "next/server";

const ZOHO_SCOPES = [
  "ZohoBooks.settings.READ",
  "ZohoBooks.contacts.READ",
  "ZohoBooks.contacts.CREATE",
  "ZohoBooks.contacts.UPDATE",
  "ZohoBooks.invoices.READ",
  "ZohoBooks.invoices.CREATE",
  "ZohoBooks.invoices.UPDATE",
  "ZohoBooks.customerpayments.READ",
  "ZohoBooks.customerpayments.CREATE",
];

export async function GET(req: Request) {
  const clientId = process.env.ZOHO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing ZOHO_CLIENT_ID. Add Zoho OAuth credentials to your environment first.",
      },
      { status: 500 }
    );
  }

  const requestUrl = new URL(req.url);
  const redirectUri =
    process.env.ZOHO_REDIRECT_URI || `${requestUrl.origin}/api/zoho/oauth/callback`;
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";

  const authUrl = new URL("/oauth/v2/auth", accountsUrl);
  authUrl.searchParams.set("scope", ZOHO_SCOPES.join(","));
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", "fastonmed_zoho_books");

  return NextResponse.redirect(authUrl);
}
