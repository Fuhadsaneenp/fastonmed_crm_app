import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { Quotation } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SETTING_KEY_QUOTATIONS = "fastonmed_quotations_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "quotations_store.json");

let memoryQuotationsCache: Quotation[] | null = null;

function loadBackupFileQuotations(): Quotation[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup quotations file:", err);
  }
  return null;
}

function saveBackupFileQuotations(quotes: Quotation[]): void {
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(quotes, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup quotations file:", err);
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

async function getStoredQuotationsFromDb(pool: any): Promise<Quotation[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_QUOTATIONS]
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
    console.warn("Could not read quotations from MySQL DB (using local storage cache):", err?.message || err);
  }
  return null;
}

async function saveQuotationsToDb(pool: any, quotes: Quotation[]): Promise<boolean> {
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(quotes);
    const now = new Date();
    const id = `setting_${SETTING_KEY_QUOTATIONS}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_QUOTATIONS, jsonStr, now, now]
      ),
      2000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write quotations to MySQL DB (saved to local backup):", err?.message || err);
    return false;
  }
}

async function getResolvedQuotations(): Promise<Quotation[]> {
  const pool = getDbPool();
  const dbQuotes = await getStoredQuotationsFromDb(pool);
  if (dbQuotes && dbQuotes.length > 0) {
    memoryQuotationsCache = dbQuotes;
    saveBackupFileQuotations(dbQuotes);
    return dbQuotes;
  }

  const backupQuotes = loadBackupFileQuotations();
  if (backupQuotes && backupQuotes.length > 0) {
    memoryQuotationsCache = backupQuotes;
    saveQuotationsToDb(pool, backupQuotes).catch(() => {});
    return backupQuotes;
  }

  if (memoryQuotationsCache && memoryQuotationsCache.length > 0) {
    return memoryQuotationsCache;
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    const quotes = await getResolvedQuotations();
    return NextResponse.json({
      success: true,
      quotes,
      count: quotes.length,
    });
  } catch (err: any) {
    console.error("GET /api/quotations error:", err);
    const backup = loadBackupFileQuotations() || memoryQuotationsCache || [];
    return NextResponse.json({
      success: true,
      quotes: backup,
      count: backup.length,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support bulk sync
    if (body.action === "sync" && Array.isArray(body.quotes)) {
      const currentQuotes = await getResolvedQuotations();
      const byKey = new Map(currentQuotes.map(quote => [quote.quotationNumber || quote.id, quote]));
      for (const incoming of body.quotes as Quotation[]) {
        const key = incoming.quotationNumber || incoming.id;
        const existing = byKey.get(key);
        if (!existing || Date.parse(incoming.updatedAt || "") > Date.parse(existing.updatedAt || "")) byKey.set(key, incoming);
      }
      const quotes = [...byKey.values()];
      memoryQuotationsCache = quotes;
      saveBackupFileQuotations(quotes);
      const pool = getDbPool();
      await saveQuotationsToDb(pool, quotes);
      return NextResponse.json({
        success: true,
        count: quotes.length,
        quotes,
      });
    }

    // Support single quote creation
    const currentQuotes = await getResolvedQuotations();
    const newQuote: Quotation = body;
    if (!newQuote.id) {
      newQuote.id = `zoho-qt-${Date.now()}`;
    }

    const updated = [newQuote, ...currentQuotes.filter((q) => q.id !== newQuote.id)];
    memoryQuotationsCache = updated;
    saveBackupFileQuotations(updated);
    const pool = getDbPool();
    await saveQuotationsToDb(pool, updated);

    return NextResponse.json({
      success: true,
      quote: newQuote,
      quotes: updated,
    });
  } catch (err: any) {
    console.error("POST /api/quotations error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save quotation" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const quotes: Quotation[] = Array.isArray(body) ? body : body.quotes || [];

    if (!Array.isArray(quotes)) {
      return NextResponse.json({ success: false, error: "Invalid payload: array expected" }, { status: 400 });
    }

    memoryQuotationsCache = quotes;
    saveBackupFileQuotations(quotes);
    const pool = getDbPool();
    await saveQuotationsToDb(pool, quotes);

    return NextResponse.json({
      success: true,
      count: quotes.length,
      quotes,
    });
  } catch (err: any) {
    console.error("PUT /api/quotations error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update quotations" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing quote ID" }, { status: 400 });
    }

    const current = await getResolvedQuotations();
    const updated = current.filter((q) => q.id !== id);
    memoryQuotationsCache = updated;
    saveBackupFileQuotations(updated);
    const pool = getDbPool();
    await saveQuotationsToDb(pool, updated);

    return NextResponse.json({
      success: true,
      deletedId: id,
      count: updated.length,
      quotes: updated,
    });
  } catch (err: any) {
    console.error("DELETE /api/quotations error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete quotation" },
      { status: 500 }
    );
  }
}
