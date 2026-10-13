import { NextResponse } from "next/server";
import { isLegacyExampleOpportunity } from "@/lib/mobile-records";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { readSharedData } from "@/lib/shared-data-store";
import type { Lead, Task } from "@/types";
import { isDummyLead } from "@/lib/client-store";
import { isDummyTask } from "@/lib/task-store";

export const dynamic = "force-dynamic";

// Read the shared CRM database only. Never hydrate from sample files or browser caches.
export async function GET() {
  try {
    const pool = getDbPool();
    const readRecords = async <T,>(key: string): Promise<T[]> => {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1", [key]
      );
      if (!rows[0]?.value) return [];
      const value = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
      if (!Array.isArray(value)) throw new Error("Invalid CRM dataset");
      return value;
    };
    const [clients, leads, tasks] = await Promise.all([
      readSharedData("clients"), readRecords<Lead>("fastonmed_leads_v1"), readRecords<Task>("fastonmed_tasks_v1"),
    ]);
    return NextResponse.json({ clients, leads: leads.filter(lead => lead?.id && !isDummyLead(lead) && !isLegacyExampleOpportunity(lead)), tasks: tasks.filter(task => task?.id && !isDummyTask(task)) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Live CRM data is unavailable. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
