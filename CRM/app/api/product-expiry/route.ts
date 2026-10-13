import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { ExpiryRecord } from "@/app/(dashboard)/product-expiry/page.tsx";

export const dynamic = "force-dynamic";

const SETTING_KEY_RECORDS = "fastonmed_custom_expiry_records_v1";
const SETTING_KEY_EDITED = "fastonmed_edited_expiry_records_v1";
const SETTING_KEY_DELETED = "fastonmed_deleted_expiry_ids_v1";

const INITIAL_15_RECORDS: ExpiryRecord[] = [];

async function getValidCompanyId(pool: any): Promise<string> {
  try {
    const [rows]: any = await pool.query("SELECT id FROM Company LIMIT 1");
    if (rows && rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }
  } catch (err) {
    console.error("Could not fetch company id:", err);
  }
  return "cmrtifqe00002ty4zqy0vdpsr";
}

async function getSettingJson<T>(pool: any, key: string, fallback: T): Promise<T> {
  try {
    const [rows]: any = await pool.query(
      "SELECT value FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
      [key]
    );
    if (rows && rows.length > 0 && rows[0].value) {
      const val = rows[0].value;
      return typeof val === "string" ? JSON.parse(val) : val;
    }
  } catch (err) {
    console.error(`Error reading setting ${key}:`, err);
  }
  return fallback;
}

async function saveSettingJson(pool: any, key: string, value: any): Promise<void> {
  const companyId = await getValidCompanyId(pool);
  const jsonStr = JSON.stringify(value);
  const now = new Date();
  const id = `setting_${key.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  await pool.query(
    `INSERT INTO CompanySetting (id, companyId, \`key\`, value, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = VALUES(updatedAt)`,
    [id, companyId, key, jsonStr, now, now]
  );
}

// ─── GET: Fetch all tracked product expiry records from shared MySQL ─────────
export async function GET() {
  try {
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({
        success: true,
        customRecords: INITIAL_15_RECORDS,
        editedRecords: {},
        deletedIds: [],
        source: "memory_fallback",
      });
    }

    let customRecords = await getSettingJson<ExpiryRecord[] | null>(
      pool,
      SETTING_KEY_RECORDS,
      null
    );

    // If no records stored in DB yet, initialize with the 15 records
    if (!customRecords || !Array.isArray(customRecords) || customRecords.length === 0) {
      customRecords = INITIAL_15_RECORDS;
      await saveSettingJson(pool, SETTING_KEY_RECORDS, customRecords);
    }

    const editedRecords = await getSettingJson<Record<string, Partial<ExpiryRecord>>>(
      pool,
      SETTING_KEY_EDITED,
      {}
    );

    const deletedIds = await getSettingJson<string[]>(
      pool,
      SETTING_KEY_DELETED,
      []
    );

    return NextResponse.json({
      success: true,
      customRecords,
      editedRecords,
      deletedIds,
      source: "mysql",
    });
  } catch (error: any) {
    console.error("GET /api/product-expiry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load product expiry records" },
      { status: 500 }
    );
  }
}

// ─── POST: Add new record OR sync local records up to MySQL ─────────────────
export async function POST(req: NextRequest) {
  try {
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { success: false, error: "Database not connected" },
        { status: 500 }
      );
    }

    const body = await req.json();

    // 1. Bulk two-way sync (e.g. from Hashim's browser localStorage)
    if (body.action === "sync") {
      let currentRecords = await getSettingJson<ExpiryRecord[]>(
        pool,
        SETTING_KEY_RECORDS,
        INITIAL_15_RECORDS
      );

      const incoming: ExpiryRecord[] = Array.isArray(body.localCustomRecords)
        ? body.localCustomRecords
        : [];

      if (incoming.length > 0) {
        const recordMap = new Map<string, ExpiryRecord>();
        for (const r of currentRecords) {
          if (r && r.id) recordMap.set(r.id, r);
        }
        // Merge incoming records
        for (const r of incoming) {
          if (r && r.id) {
            recordMap.set(r.id, { ...(recordMap.get(r.id) || {}), ...r });
          }
        }
        currentRecords = Array.from(recordMap.values());
        await saveSettingJson(pool, SETTING_KEY_RECORDS, currentRecords);
      }

      const currentEdited = await getSettingJson<Record<string, Partial<ExpiryRecord>>>(
        pool,
        SETTING_KEY_EDITED,
        {}
      );
      if (body.localEditedRecords && typeof body.localEditedRecords === "object") {
        const mergedEdited = { ...currentEdited, ...body.localEditedRecords };
        await saveSettingJson(pool, SETTING_KEY_EDITED, mergedEdited);
      }

      const currentDeleted = await getSettingJson<string[]>(
        pool,
        SETTING_KEY_DELETED,
        []
      );
      if (Array.isArray(body.localDeletedIds) && body.localDeletedIds.length > 0) {
        const mergedDeleted = Array.from(new Set([...currentDeleted, ...body.localDeletedIds]));
        await saveSettingJson(pool, SETTING_KEY_DELETED, mergedDeleted);
      }

      return NextResponse.json({
        success: true,
        customRecords: currentRecords,
        editedRecords: await getSettingJson(pool, SETTING_KEY_EDITED, {}),
        deletedIds: await getSettingJson(pool, SETTING_KEY_DELETED, []),
      });
    }

    // 2. Add a single new tracked product record
    const newRecord = body.record;
    if (!newRecord || !newRecord.productName) {
      return NextResponse.json(
        { success: false, error: "Record and productName are required" },
        { status: 400 }
      );
    }

    let currentRecords = await getSettingJson<ExpiryRecord[]>(
      pool,
      SETTING_KEY_RECORDS,
      INITIAL_15_RECORDS
    );

    const recordToAdd: ExpiryRecord = {
      ...newRecord,
      id: newRecord.id || `custom-exp-${Date.now()}`,
      isCustom: true,
    };

    const updated = [recordToAdd, ...currentRecords.filter((r) => r.id !== recordToAdd.id)];
    await saveSettingJson(pool, SETTING_KEY_RECORDS, updated);

    return NextResponse.json({
      success: true,
      record: recordToAdd,
      customRecords: updated,
    });
  } catch (error: any) {
    console.error("POST /api/product-expiry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save product expiry record" },
      { status: 500 }
    );
  }
}

// ─── PUT: Update an existing record in MySQL ─────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { success: false, error: "Database not connected" },
        { status: 500 }
      );
    }

    const { id, data } = await req.json();
    if (!id || !data) {
      return NextResponse.json(
        { success: false, error: "Record id and data are required" },
        { status: 400 }
      );
    }

    let currentRecords = await getSettingJson<ExpiryRecord[]>(
      pool,
      SETTING_KEY_RECORDS,
      INITIAL_15_RECORDS
    );

    const existsInCustom = currentRecords.some((r) => r.id === id);

    if (existsInCustom || id.startsWith("custom-")) {
      currentRecords = currentRecords.map((r) => (r.id === id ? { ...r, ...data } : r));
      await saveSettingJson(pool, SETTING_KEY_RECORDS, currentRecords);
    } else {
      // If updating a base derived record, save to editedRecords
      const currentEdited = await getSettingJson<Record<string, Partial<ExpiryRecord>>>(
        pool,
        SETTING_KEY_EDITED,
        {}
      );
      currentEdited[id] = { ...(currentEdited[id] || {}), ...data };
      await saveSettingJson(pool, SETTING_KEY_EDITED, currentEdited);
    }

    return NextResponse.json({
      success: true,
      customRecords: currentRecords,
    });
  } catch (error: any) {
    console.error("PUT /api/product-expiry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update product expiry record" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove or mark record as deleted in MySQL ───────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { success: false, error: "Database not connected" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Record id parameter is required" },
        { status: 400 }
      );
    }

    let currentRecords = await getSettingJson<ExpiryRecord[]>(
      pool,
      SETTING_KEY_RECORDS,
      INITIAL_15_RECORDS
    );

    if (id.startsWith("custom-")) {
      currentRecords = currentRecords.filter((r) => r.id !== id);
      await saveSettingJson(pool, SETTING_KEY_RECORDS, currentRecords);
    }

    const currentDeleted = await getSettingJson<string[]>(
      pool,
      SETTING_KEY_DELETED,
      []
    );
    if (!currentDeleted.includes(id)) {
      currentDeleted.push(id);
      await saveSettingJson(pool, SETTING_KEY_DELETED, currentDeleted);
    }

    return NextResponse.json({
      success: true,
      customRecords: currentRecords,
      deletedIds: currentDeleted,
    });
  } catch (error: any) {
    console.error("DELETE /api/product-expiry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete product expiry record" },
      { status: 500 }
    );
  }
}
