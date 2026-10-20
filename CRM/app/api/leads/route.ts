import { filterRetiredRecords } from "@/lib/retired-records";
import { withRetiredResponse } from "@/lib/retired-response";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { Lead } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SETTING_KEY_LEADS = "fastonmed_leads_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "leads_store.json");

let memoryLeadsCache: Lead[] | null = null;

function loadBackupFileLeads(): Lead[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup leads file:", err);
  }
  return null;
}

function saveBackupFileLeads(leads: Lead[]): void {
  leads = filterRetiredRecords("leads", leads);
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(leads, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup leads file:", err);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DB operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function getValidCompanyId(pool: any): Promise<string> {
  try {
    const [rows]: any = await withTimeout(pool.query("SELECT id FROM Company LIMIT 1"), 1500);
    if (rows && rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }
  } catch {}
  return "cmrtifqe00002ty4zqy0vdpsr";
}

async function getStoredLeadsFromDb(pool: any): Promise<Lead[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_LEADS]
      ),
      1800
    );
    if (rows && rows.length > 0 && rows[0].value) {
      const val = rows[0].value;
      const parsed = typeof val === "string" ? JSON.parse(val) : val;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn("Could not read leads from MySQL DB (using local storage cache):", err?.message || err);
  }
  return null;
}

async function saveLeadsToDb(pool: any, leads: Lead[]): Promise<boolean> {
  leads = filterRetiredRecords("leads", leads);
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(leads);
    const now = new Date();
    const id = `setting_${SETTING_KEY_LEADS}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_LEADS, jsonStr, now, now]
      ),
      2000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write leads to MySQL DB (saved to local backup):", err?.message || err);
    return false;
  }
}

async function getMergedLeads(): Promise<Lead[]> {
  try {
    const pool = getDbPool();
    const dbLeads = await getStoredLeadsFromDb(pool);
    if (dbLeads && dbLeads.length > 0) {
      memoryLeadsCache = dbLeads;
      saveBackupFileLeads(dbLeads);
      return dbLeads;
    }
  } catch (err) {
    console.warn("Failed connecting to DB for leads:", err);
  }

  const fileLeads = loadBackupFileLeads();
  if (fileLeads && fileLeads.length > 0) {
    memoryLeadsCache = fileLeads;
    // Attempt saving back to DB in background
    try {
      const pool = getDbPool();
      void saveLeadsToDb(pool, fileLeads);
    } catch {}
    return fileLeads;
  }

  if (memoryLeadsCache && memoryLeadsCache.length > 0) {
    return memoryLeadsCache;
  }

  return [];
}

async function handleGET() {
  try {
    const leads = await getMergedLeads();
    return NextResponse.json({ success: true, leads });
  } catch (err: any) {
    console.error("GET /api/leads error:", err);
    const fallback = loadBackupFileLeads() || memoryLeadsCache || [];
    return NextResponse.json({ success: true, leads: fallback, error: err?.message });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const existing = await getMergedLeads();
    let updated: Lead[] = [...existing];

    if (Array.isArray(body?.leads)) {
      if (body?.replace === true) {
        // Direct replacement of full list
        updated = body.leads.filter((l: Lead) => l && l.id);
      } else {
        // Merge incoming with existing
        const incomingLeads: Lead[] = body.leads;
        const leadMap = new Map<string, Lead>();
        
        for (const l of existing) {
          if (l && l.id) leadMap.set(l.id, l);
        }
        for (const l of incomingLeads) {
          if (l && l.id) leadMap.set(l.id, l);
        }
        updated = Array.from(leadMap.values());
      }
    } else if (body?.lead && body.lead.id) {
      // Single lead upsert
      const incoming: Lead = body.lead;
      const idx = updated.findIndex((l) => l.id === incoming.id);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], ...incoming };
      } else {
        updated.unshift(incoming);
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    memoryLeadsCache = updated;
    saveBackupFileLeads(updated);

    try {
      const pool = getDbPool();
      await saveLeadsToDb(pool, updated);
    } catch (dbErr) {
      console.warn("POST /api/leads could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({ success: true, leads: updated });
  } catch (err: any) {
    console.error("POST /api/leads error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to save lead" }, { status: 500 });
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id || body?.data?.id;
    const data = body?.data || body?.lead;

    if (!id || !data) {
      return NextResponse.json({ success: false, error: "Missing id or data" }, { status: 400 });
    }

    const existing = await getMergedLeads();
    const updated = existing.map((l) => (l.id === id ? { ...l, ...data } : l));

    memoryLeadsCache = updated;
    saveBackupFileLeads(updated);

    try {
      const pool = getDbPool();
      await saveLeadsToDb(pool, updated);
    } catch (dbErr) {
      console.warn("PUT /api/leads could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({ success: true, leads: updated });
  } catch (err: any) {
    console.error("PUT /api/leads error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to update lead" }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing lead id" }, { status: 400 });
    }

    const existing = await getMergedLeads();
    const updated = existing.filter((l) => l.id !== id);

    memoryLeadsCache = updated;
    saveBackupFileLeads(updated);

    try {
      const pool = getDbPool();
      await saveLeadsToDb(pool, updated);
    } catch (dbErr) {
      console.warn("DELETE /api/leads could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({ success: true, deletedId: id, count: updated.length });
  } catch (err: any) {
    console.error("DELETE /api/leads error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to delete lead" }, { status: 500 });
  }
}

export const GET = withRetiredResponse(handleGET, "leads", "leads");
export const POST = withRetiredResponse(handlePOST, "leads", "leads");
export const PUT = withRetiredResponse(handlePUT, "leads", "leads");
export const DELETE = withRetiredResponse(handleDELETE, "leads", "leads");
