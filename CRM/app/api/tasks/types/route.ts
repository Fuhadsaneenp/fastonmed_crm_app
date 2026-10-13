import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

const SETTING_KEY = "fastonmed_task_types_v1";

const DEFAULT_TYPES = [
  "Call",
  "Site Visit",
  "Demo",
  "Installation",
  "Service Visit",
  "Meeting",
  "Follow-up",
  "Documentation",
];

async function getCompanyId(): Promise<string> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>("SELECT id FROM Company LIMIT 1");
    return rows[0]?.id || "cmrtifqe00002ty4zqy0vdpsr";
  } catch {
    return "cmrtifqe00002ty4zqy0vdpsr";
  }
}

async function fetchTypesFromDb(): Promise<string[]> {
  try {
    const pool = getDbPool();
    const [rows] = await pool.query<any[]>(
      "SELECT `value` FROM CompanySetting WHERE `key` = ? LIMIT 1",
      [SETTING_KEY]
    );
    if (rows && rows.length > 0 && rows[0]?.value) {
      const raw = rows[0].value;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    }
  } catch (err) {
    console.error("Failed to read task types from DB:", err);
  }
  return DEFAULT_TYPES;
}

async function saveTypesToDb(types: string[]): Promise<boolean> {
  try {
    const pool = getDbPool();
    const companyId = await getCompanyId();
    const cleanTypes = Array.from(new Set(types.map((t) => t.trim()).filter(Boolean)));

    await pool.query(
      `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = NOW(3)`,
      ["setting_task_types_v1", companyId, SETTING_KEY, JSON.stringify(cleanTypes)]
    );
    return true;
  } catch (err) {
    console.error("Failed to save task types to DB:", err);
    return false;
  }
}

export async function GET() {
  const types = await fetchTypesFromDb();
  return NextResponse.json({ success: true, types });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await fetchTypesFromDb();

    let updated: string[] = [];
    if (Array.isArray(body.types)) {
      updated = body.types.map((t: string) => String(t).trim()).filter(Boolean);
    } else if (body.type) {
      const trimmed = String(body.type).trim();
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "Option name cannot be empty" }, { status: 400 });
      }
      const existing = current.find((t) => t.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        return NextResponse.json({ success: true, types: current, message: "Option already exists" });
      }
      updated = [...current, trimmed];
    } else {
      return NextResponse.json({ success: false, error: "Missing type or types payload" }, { status: 400 });
    }

    await saveTypesToDb(updated);
    return NextResponse.json({ success: true, types: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await fetchTypesFromDb();

    if (body.oldType && body.newType) {
      const oldType = String(body.oldType).trim();
      const newType = String(body.newType).trim();

      if (!newType) {
        return NextResponse.json({ success: false, error: "New option name cannot be empty" }, { status: 400 });
      }

      const updated = current.map((t) => (t.toLowerCase() === oldType.toLowerCase() ? newType : t));
      await saveTypesToDb(updated);
      return NextResponse.json({ success: true, types: updated, renamed: { oldType, newType } });
    } else if (Array.isArray(body.types)) {
      const updated = body.types.map((t: string) => String(t).trim()).filter(Boolean);
      await saveTypesToDb(updated);
      return NextResponse.json({ success: true, types: updated });
    }

    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get("type");
    let targetType = queryType;

    if (!targetType) {
      try {
        const body = await req.json();
        targetType = body.type;
      } catch {}
    }

    if (!targetType) {
      return NextResponse.json({ success: false, error: "Option name required for deletion" }, { status: 400 });
    }

    const current = await fetchTypesFromDb();
    const targetLower = targetType.trim().toLowerCase();
    const updated = current.filter((t) => t.toLowerCase() !== targetLower);

    await saveTypesToDb(updated);
    return NextResponse.json({ success: true, types: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
