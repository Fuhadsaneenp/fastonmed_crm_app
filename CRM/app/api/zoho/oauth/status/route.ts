import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDbPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  let saved: Record<string, string> = {};
  try {
    const [rows]: any = await getDbPool().query(
      "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
      ["fastonmed_zoho_config_v1"]
    );
    const value = rows[0]?.value;
    saved = typeof value === "string" ? JSON.parse(value) : value || {};
  } catch {
    // Environment and browser credentials can still serve an existing connection.
  }
  const clientId = process.env.ZOHO_CLIENT_ID || saved.clientId;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || saved.clientSecret;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN || cookieStore.get("fastonmed_zoho_refresh_token")?.value || saved.refreshToken;
  return NextResponse.json({
    connected: Boolean(clientId && clientSecret && refreshToken),
    organizationId: process.env.ZOHO_ORGANIZATION_ID || cookieStore.get("fastonmed_zoho_organization_id")?.value || saved.organizationId || "",
    hasServerCredentials: Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET),
  });
}
