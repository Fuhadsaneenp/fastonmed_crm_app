import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { AMCContract } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SETTING_KEY_CONTRACTS = "fastonmed_amc_contracts_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "maintenance_contracts_store.json");

const INITIAL_HASHIM_CONTRACTS: AMCContract[] = [];

// In-memory cache for fast local access
let memoryContractsCache: AMCContract[] | null = null;

function loadBackupFileContracts(): AMCContract[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup contracts file:", err);
  }
  return null;
}

function saveBackupFileContracts(contracts: AMCContract[]): void {
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(contracts, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup contracts file:", err);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number = 1800): Promise<T> {
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

async function getStoredContractsFromDb(pool: any): Promise<AMCContract[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_CONTRACTS]
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
    console.warn("Could not read contracts from MySQL DB (using local storage cache):", err?.message || err);
  }
  return null;
}

async function saveContractsToDb(pool: any, contracts: AMCContract[]): Promise<boolean> {
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(contracts);
    const now = new Date();
    const id = `setting_${SETTING_KEY_CONTRACTS}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_CONTRACTS, jsonStr, now, now]
      ),
      2000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write contracts to MySQL DB (saved to local backup):", err?.message || err);
    return false;
  }
}

function getEffectiveContracts(): AMCContract[] {
  if (memoryContractsCache && memoryContractsCache.length > 0) {
    return memoryContractsCache;
  }
  const fileContracts = loadBackupFileContracts();
  if (fileContracts && fileContracts.length > 0) {
    memoryContractsCache = fileContracts;
    return fileContracts;
  }
  memoryContractsCache = INITIAL_HASHIM_CONTRACTS;
  saveBackupFileContracts(INITIAL_HASHIM_CONTRACTS);
  return INITIAL_HASHIM_CONTRACTS;
}

// ─── GET: Fetch all contracts ───────────────────────────────────────────────
export async function GET() {
  try {
    const pool = getDbPool();
    if (pool) {
      const dbContracts = await getStoredContractsFromDb(pool);
      if (dbContracts && dbContracts.length > 0) {
        memoryContractsCache = dbContracts;
        saveBackupFileContracts(dbContracts);
        return NextResponse.json({
          success: true,
          contracts: dbContracts,
          source: "mysql",
        });
      }

      // If DB has no records, try saving initial records in background
      const effective = getEffectiveContracts();
      saveContractsToDb(pool, effective).catch(() => {});
      return NextResponse.json({
        success: true,
        contracts: effective,
        source: "initialized",
      });
    }

    const effective = getEffectiveContracts();
    return NextResponse.json({
      success: true,
      contracts: effective,
      source: "local_cache",
    });
  } catch (error: any) {
    console.error("GET /api/maintenance-contracts fallback:", error);
    const effective = getEffectiveContracts();
    return NextResponse.json({
      success: true,
      contracts: effective,
      source: "error_fallback",
    });
  }
}

// ─── POST: Add new contract OR sync client local storage up to MySQL ────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let currentContracts = getEffectiveContracts();

    const pool = getDbPool();
    if (pool) {
      const dbContracts = await getStoredContractsFromDb(pool);
      if (dbContracts && dbContracts.length > 0) {
        currentContracts = dbContracts;
      }
    }

    // 1. Bulk two-way sync (from any user's browser, e.g. Hashim's browser)
    if (body.action === "sync") {
      const incoming: AMCContract[] = Array.isArray(body.localContracts)
        ? body.localContracts
        : [];

      if (incoming.length > 0) {
        const contractMap = new Map<string, AMCContract>();
        // First put existing server contracts
        for (const c of currentContracts) {
          if (c && c.id) contractMap.set(c.id, c);
        }
        // Merge incoming contracts
        for (const c of incoming) {
          if (c && c.id) {
            const existing = contractMap.get(c.id);
            contractMap.set(c.id, existing ? { ...existing, ...c } : c);
          }
        }
        currentContracts = Array.from(contractMap.values());
      }

      memoryContractsCache = currentContracts;
      saveBackupFileContracts(currentContracts);
      if (pool) {
        saveContractsToDb(pool, currentContracts).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        contracts: currentContracts,
      });
    }

    // 2. Add single contract
    const contract = body.contract;
    if (!contract || (!contract.title && !contract.contractNumber)) {
      return NextResponse.json(
        { success: false, error: "Contract payload required" },
        { status: 400 }
      );
    }

    const contractToAdd: AMCContract = {
      ...contract,
      id: contract.id || `amc-${Date.now()}`,
    };

    const updated = [
      contractToAdd,
      ...currentContracts.filter((c) => c.id !== contractToAdd.id),
    ];

    memoryContractsCache = updated;
    saveBackupFileContracts(updated);
    if (pool) {
      saveContractsToDb(pool, updated).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      contract: contractToAdd,
      contracts: updated,
    });
  } catch (error: any) {
    console.error("POST /api/maintenance-contracts error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save contract" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing contract ───────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { id, data } = await req.json();
    if (!id || !data) {
      return NextResponse.json(
        { success: false, error: "Contract id and data are required" },
        { status: 400 }
      );
    }

    let currentContracts = getEffectiveContracts();
    const pool = getDbPool();
    if (pool) {
      const dbContracts = await getStoredContractsFromDb(pool);
      if (dbContracts && dbContracts.length > 0) {
        currentContracts = dbContracts;
      }
    }

    let found = false;
    currentContracts = currentContracts.map((c) => {
      if (c.id === id) {
        found = true;
        return { ...c, ...data };
      }
      return c;
    });

    if (!found) {
      currentContracts = [{ id, ...data }, ...currentContracts];
    }

    memoryContractsCache = currentContracts;
    saveBackupFileContracts(currentContracts);
    if (pool) {
      saveContractsToDb(pool, currentContracts).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      contracts: currentContracts,
    });
  } catch (error: any) {
    console.error("PUT /api/maintenance-contracts error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update contract" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove a contract ──────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Contract id parameter is required" },
        { status: 400 }
      );
    }

    let currentContracts = getEffectiveContracts();
    const pool = getDbPool();
    if (pool) {
      const dbContracts = await getStoredContractsFromDb(pool);
      if (dbContracts && dbContracts.length > 0) {
        currentContracts = dbContracts;
      }
    }

    currentContracts = currentContracts.filter((c) => c.id !== id);

    memoryContractsCache = currentContracts;
    saveBackupFileContracts(currentContracts);
    if (pool) {
      saveContractsToDb(pool, currentContracts).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      contracts: currentContracts,
    });
  } catch (error: any) {
    console.error("DELETE /api/maintenance-contracts error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete contract" },
      { status: 500 }
    );
  }
}
