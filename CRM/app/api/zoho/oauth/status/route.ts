import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ZOHO_REFRESH_TOKEN_COOKIE = "fastonmed_zoho_refresh_token";
const ZOHO_ORG_ID_COOKIE = "fastonmed_zoho_organization_id";

export async function GET() {
  const cookieStore = await cookies();
  return NextResponse.json({
    connected: Boolean(cookieStore.get(ZOHO_REFRESH_TOKEN_COOKIE)?.value),
    organizationId: cookieStore.get(ZOHO_ORG_ID_COOKIE)?.value || "",
    hasServerCredentials: Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET),
  });
}
