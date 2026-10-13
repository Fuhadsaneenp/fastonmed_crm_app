import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import type { Task } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SETTING_KEY_TASKS = "fastonmed_tasks_v1";
const BACKUP_FILE = path.join(process.cwd(), "data", "tasks_store.json");

let memoryTasksCache: Task[] | null = null;

function loadBackupFileTasks(): Task[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading backup tasks file:", err);
  }
  return null;
}

function saveBackupFileTasks(tasks: Task[]): void {
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving backup tasks file:", err);
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

async function saveTasksToDb(pool: any, tasks: Task[]): Promise<boolean> {
  try {
    const companyId = await getValidCompanyId(pool);
    const jsonStr = JSON.stringify(tasks);
    const now = new Date();
    const id = `setting_${SETTING_KEY_TASKS}`;

    await withTimeout(
      pool.query(
        `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
        [id, companyId, SETTING_KEY_TASKS, jsonStr, now, now]
      ),
      2000
    );
    return true;
  } catch (err: any) {
    console.warn("Could not write tasks to MySQL DB (saved to local backup):", err?.message || err);
    return false;
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const taskData: Partial<Task> = body.task || body;

    let current = memoryTasksCache || loadBackupFileTasks() || [];
    const index = current.findIndex((t) => t.id === id);

    let updatedTask: Task;
    let updatedList: Task[];

    if (index >= 0) {
      updatedTask = { ...current[index], ...taskData, id };
      updatedList = current.map((t) => (t.id === id ? updatedTask : t));
    } else {
      updatedTask = { ...taskData, id } as Task;
      updatedList = [updatedTask, ...current];
    }

    memoryTasksCache = updatedList;
    saveBackupFileTasks(updatedList);

    try {
      const pool = getDbPool();
      void saveTasksToDb(pool, updatedList);
    } catch (dbErr) {
      console.warn(`PUT /api/tasks/${id} could not persist to DB immediately:`, dbErr);
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      count: updatedList.length,
    });
  } catch (err: any) {
    console.error(`PUT /api/tasks/[id] error:`, err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    let current = memoryTasksCache || loadBackupFileTasks() || [];
    const filtered = current.filter((t) => t.id !== id);

    memoryTasksCache = filtered;
    saveBackupFileTasks(filtered);

    try {
      const pool = getDbPool();
      void saveTasksToDb(pool, filtered);
    } catch (dbErr) {
      console.warn(`DELETE /api/tasks/${id} could not persist to DB immediately:`, dbErr);
    }

    return NextResponse.json({
      success: true,
      id,
      count: filtered.length,
    });
  } catch (err: any) {
    console.error(`DELETE /api/tasks/[id] error:`, err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
