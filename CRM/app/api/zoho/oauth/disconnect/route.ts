import { NextResponse } from "next/server";

const ZOHO_REFRESH_TOKEN_COOKIE = "fastonmed_zoho_refresh_token";
const ZOHO_ORG_ID_COOKIE = "fastonmed_zoho_organization_id";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(ZOHO_REFRESH_TOKEN_COOKIE);
  res.cookies.delete(ZOHO_ORG_ID_COOKIE);
  return res;
}
