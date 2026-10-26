import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { filterRetiredRecords } from "@/lib/retired-records";
import { withRetiredResponse } from "@/lib/retired-response";
import { mergeLeadUpdates } from "@/lib/lead-sync";
import type { Lead } from "@/types";
export const dynamic = "force-dynamic";
const KEY = "fastonmed_leads_v1";
function parse(value: unknown): Lead[] {
  const data = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(data)) throw new Error("Invalid stored leads");
  return filterRetiredRecords("leads", data);
}
async function mutate(updater: (leads: Lead[]) => Lead[]) {
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    const [companies]: any = await connection.query("SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1 FOR UPDATE");
    if (!companies[0]?.id) throw new Error("CRM company is missing");
    const [rows]: any = await connection.query("SELECT * FROM CompanySetting WHERE `key`=? ORDER BY updatedAt DESC LIMIT 1 FOR UPDATE", [KEY]);
    const updated = filterRetiredRecords("leads", updater(rows[0] ? parse(rows[0].value) : []));
    await connection.query("INSERT INTO CompanySetting (id,companyId,`key`,`value`,createdAt,updatedAt) VALUES (?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`),updatedAt=NOW()", [rows[0]?.id || `setting_${KEY}`, companies[0].id, KEY, JSON.stringify(updated)]);
    await connection.commit();
    return updated;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
function failure(error: unknown) {
  console.error("Lead database operation failed", error);
  return NextResponse.json({ success: false, error: "Unable to save or load leads. Please retry." }, { status: 503 });
}
async function handleGET() {
  try {
    const [rows]: any = await getDbPool().query("SELECT `value` FROM CompanySetting WHERE `key`=? ORDER BY updatedAt DESC LIMIT 1", [KEY]);
    return NextResponse.json({ success: true, leads: rows[0] ? parse(rows[0].value) : [] });
  } catch (error) { return failure(error); }
}
async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming = Array.isArray(body.leads) ? body.leads : body.lead?.id ? [body.lead] : null;
    if (!incoming) return NextResponse.json({ success: false, error: "Invalid lead payload" }, { status: 400 });
    // Background bulk sync must never replace newer records or delete unrelated leads.
    const leads = await mutate(current => mergeLeadUpdates(current, incoming));
    return NextResponse.json({ success: true, leads });
  } catch (error) { return failure(error); }
}
async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || body.data?.id;
    const data = body.data || body.lead;
    if (!id || !data) return NextResponse.json({ success: false, error: "Missing lead id or data" }, { status: 400 });
    const leads = await mutate(current => current.map(lead => lead.id === id ? { ...lead, ...data, id, updatedAt: new Date().toISOString() } : lead));
    return NextResponse.json({ success: true, leads });
  } catch (error) { return failure(error); }
}
async function handleDELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing lead id" }, { status: 400 });
    const leads = await mutate(current => current.filter(lead => lead.id !== id));
    return NextResponse.json({ success: true, deletedId: id, count: leads.length, leads });
  } catch (error) { return failure(error); }
}
export const GET = withRetiredResponse(handleGET, "leads", "leads");
export const POST = withRetiredResponse(handlePOST, "leads", "leads");
export const PUT = withRetiredResponse(handlePUT, "leads", "leads");
export const DELETE = withRetiredResponse(handleDELETE, "leads", "leads");
