import { filterRetiredRecords } from "@/lib/retired-records";
import { withRetiredResponse } from "@/lib/retired-response";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { ServiceTicket } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SETTING_KEY_SERVICES = "fastonmed_services_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "services_store.json");

let memoryServicesCache: ServiceTicket[] | null = null;

function loadBackupFileServices(): ServiceTicket[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup services file:", err);
  }
  return null;
}

function saveBackupFileServices(tickets: ServiceTicket[]): void {
  tickets = filterRetiredRecords("services", tickets);
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(tickets, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup services file:", err);
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

async function getStoredServicesFromDb(pool: any): Promise<ServiceTicket[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_SERVICES]
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
    console.warn("Could not read services from MySQL DB (using local storage cache):", err?.message || err);
  }
  return null;
}

async function saveServicesToDb(pool: any, tickets: ServiceTicket[]): Promise<boolean> {
  tickets = filterRetiredRecords("services", tickets);
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(tickets);
    const now = new Date();
    const id = `setting_${SETTING_KEY_SERVICES}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_SERVICES, jsonStr, now, now]
      ),
      2000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write services to MySQL DB (saved to local backup):", err?.message || err);
    return false;
  }
}

function deduplicateTickets(tickets: ServiceTicket[]): ServiceTicket[] {
  const map = new Map<string, ServiceTicket>();
  for (const t of tickets) {
    if (!t || (!t.id && !t.ticketNumber)) continue;
    const key = t.id || t.ticketNumber;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, t);
    } else {
      map.set(key, { ...existing, ...t });
    }
  }
  return Array.from(map.values());
}

function getEffectiveServices(): ServiceTicket[] {
  if (memoryServicesCache && memoryServicesCache.length > 0) {
    return memoryServicesCache;
  }
  const fileTickets = loadBackupFileServices();
  if (fileTickets && fileTickets.length > 0) {
    memoryServicesCache = fileTickets;
    return fileTickets;
  }
  return [];
}

async function handleGET(req: NextRequest) {
  try {
    let tickets: ServiceTicket[] | null = null;
    try {
      const pool = getDbPool();
      tickets = await getStoredServicesFromDb(pool);
    } catch {}

    if (!tickets || tickets.length === 0) {
      tickets = loadBackupFileServices();
    }

    if (!tickets || tickets.length === 0) {
      tickets = memoryServicesCache || [];
    }

    const clean = deduplicateTickets(tickets);
    memoryServicesCache = clean;

    return NextResponse.json({
      success: true,
      tickets: clean,
      count: clean.length,
    });
  } catch (err: any) {
    console.error("GET /api/services error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to load services",
        tickets: memoryServicesCache || [],
      },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    let current = getEffectiveServices();

    try {
      const pool = getDbPool();
      const dbTickets = await getStoredServicesFromDb(pool);
      if (dbTickets && dbTickets.length > 0) {
        current = dbTickets;
      }
    } catch {}

    // 1. Two-way sync from client's localStorage (e.g. Hashim's laptop)
    if (body.action === "sync") {
      const incoming: ServiceTicket[] = Array.isArray(body.localTickets)
        ? body.localTickets
        : [];

      const merged = deduplicateTickets([...incoming, ...current]);
      memoryServicesCache = merged;
      saveBackupFileServices(merged);

      try {
        const pool = getDbPool();
        void saveServicesToDb(pool, merged);
      } catch (dbErr) {
        console.warn("POST /api/services sync could not persist to DB immediately:", dbErr);
      }

      return NextResponse.json({
        success: true,
        tickets: merged,
        count: merged.length,
      });
    }

    // 2. Add single service ticket or batch
    let incomingTickets: ServiceTicket[] = [];
    let isSingle = false;
    let singleSaved: ServiceTicket | null = null;

    if (Array.isArray(body.tickets)) {
      incomingTickets = body.tickets;
    } else if (body.ticket && typeof body.ticket === "object" && (body.ticket.id || body.ticket.ticketNumber)) {
      incomingTickets = [body.ticket];
      isSingle = true;
      singleSaved = body.ticket;
    } else if (body.id || body.ticketNumber) {
      incomingTickets = [body as ServiceTicket];
      isSingle = true;
      singleSaved = body as ServiceTicket;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid service payload: missing id or ticketNumber" },
        { status: 400 }
      );
    }

    const merged = deduplicateTickets([...incomingTickets, ...current]);
    memoryServicesCache = merged;
    saveBackupFileServices(merged);

    try {
      const pool = getDbPool();
      void saveServicesToDb(pool, merged);
    } catch (dbErr) {
      console.warn("POST /api/services could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({
      success: true,
      ticket: singleSaved || merged[0],
      tickets: merged,
      count: merged.length,
    });
  } catch (err: any) {
    console.error("POST /api/services error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save service ticket" },
      { status: 500 }
    );
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || body.ticketId || body.ticket?.id;
    const updateData = body.data || body.ticket || body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Service Ticket ID required" }, { status: 400 });
    }

    let current = getEffectiveServices();
    try {
      const pool = getDbPool();
      const dbTickets = await getStoredServicesFromDb(pool);
      if (dbTickets && dbTickets.length > 0) {
        current = dbTickets;
      }
    } catch {}

    const index = current.findIndex((t) => t.id === id || t.ticketNumber === id);
    let updated: ServiceTicket[];

    if (index >= 0) {
      updated = current.map((t) => (t.id === id || t.ticketNumber === id ? { ...t, ...updateData } : t));
    } else {
      updated = [{ ...updateData, id }, ...current];
    }

    const clean = deduplicateTickets(updated);
    memoryServicesCache = clean;
    saveBackupFileServices(clean);

    try {
      const pool = getDbPool();
      void saveServicesToDb(pool, clean);
    } catch (dbErr) {
      console.warn("PUT /api/services could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({
      success: true,
      tickets: clean,
      count: clean.length,
    });
  } catch (err: any) {
    console.error("PUT /api/services error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update service ticket" },
      { status: 500 }
    );
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let targetId = searchParams.get("id");

    if (!targetId) {
      try {
        const body = await req.json();
        targetId = body.id || body.ticketId;
      } catch {}
    }

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Ticket ID required for deletion" }, { status: 400 });
    }

    let current = getEffectiveServices();
    try {
      const pool = getDbPool();
      const dbTickets = await getStoredServicesFromDb(pool);
      if (dbTickets && dbTickets.length > 0) {
        current = dbTickets;
      }
    } catch {}

    const filtered = current.filter((t) => t.id !== targetId && t.ticketNumber !== targetId);
    memoryServicesCache = filtered;
    saveBackupFileServices(filtered);

    try {
      const pool = getDbPool();
      void saveServicesToDb(pool, filtered);
    } catch (dbErr) {
      console.warn("DELETE /api/services could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({
      success: true,
      id: targetId,
      tickets: filtered,
      count: filtered.length,
    });
  } catch (err: any) {
    console.error("DELETE /api/services error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete service ticket" },
      { status: 500 }
    );
  }
}

export const GET = withRetiredResponse(handleGET, "services", "tickets");
export const POST = withRetiredResponse(handlePOST, "services", "tickets");
export const PUT = withRetiredResponse(handlePUT, "services", "tickets");
export const DELETE = withRetiredResponse(handleDELETE, "services", "tickets");
