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

async function getStoredTasksFromDb(pool: any): Promise<Task[] | null> {
  try {
    const [rows]: any = await withTimeout(
      pool.query(
        "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
        [SETTING_KEY_TASKS]
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
    console.warn("Could not read tasks from MySQL DB (using local storage cache):", err?.message || err);
  }
  return null;
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

function deduplicateTasks(tasks: Task[]): Task[] {
  const map = new Map<string, Task>();
  for (const t of tasks) {
    if (!t || !t.id) continue;
    const existing = map.get(t.id);
    if (!existing) {
      map.set(t.id, t);
    } else {
      // Merge with precedence to latest updated
      map.set(t.id, { ...existing, ...t });
    }
  }
  return Array.from(map.values());
}

export async function GET(req: NextRequest) {
  try {
    let tasks: Task[] | null = null;
    try {
      const pool = getDbPool();
      tasks = await getStoredTasksFromDb(pool);
    } catch {}

    if (!tasks || tasks.length === 0) {
      tasks = loadBackupFileTasks();
    }

    if (!tasks || tasks.length === 0) {
      tasks = memoryTasksCache || [];
    }

    const clean = deduplicateTasks(tasks);
    memoryTasksCache = clean;

    return NextResponse.json({
      success: true,
      tasks: clean,
      count: clean.length,
    });
  } catch (err: any) {
    console.error("GET /api/tasks error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to load tasks",
        tasks: memoryTasksCache || [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let current = memoryTasksCache || loadBackupFileTasks() || [];

    let incomingTasks: Task[] = [];
    let isSingle = false;
    let singleSavedTask: Task | null = null;

    if (Array.isArray(body.tasks)) {
      incomingTasks = body.tasks;
      if (body.replace) {
        current = [];
      }
    } else if (body.task && typeof body.task === "object" && body.task.id) {
      incomingTasks = [body.task];
      isSingle = true;
      singleSavedTask = body.task;
    } else if (body.id && body.title) {
      incomingTasks = [body as Task];
      isSingle = true;
      singleSavedTask = body as Task;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid task payload: missing id or title" },
        { status: 400 }
      );
    }

    const merged = deduplicateTasks([...incomingTasks, ...current]);
    memoryTasksCache = merged;
    saveBackupFileTasks(merged);

    try {
      const pool = getDbPool();
      void saveTasksToDb(pool, merged);
    } catch (dbErr) {
      console.warn("POST /api/tasks could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({
      success: true,
      task: singleSavedTask || merged[0],
      tasks: merged,
      count: merged.length,
    });
  } catch (err: any) {
    console.error("POST /api/tasks error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save task" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const task: Task = body.task || body;

    if (!task || !task.id) {
      return NextResponse.json({ success: false, error: "Task ID required" }, { status: 400 });
    }

    let current = memoryTasksCache || loadBackupFileTasks() || [];
    const index = current.findIndex((t) => t.id === task.id);

    let updated: Task[];
    if (index >= 0) {
      updated = current.map((t) => (t.id === task.id ? { ...t, ...task } : t));
    } else {
      updated = [task, ...current];
    }

    const clean = deduplicateTasks(updated);
    memoryTasksCache = clean;
    saveBackupFileTasks(clean);

    try {
      const pool = getDbPool();
      void saveTasksToDb(pool, clean);
    } catch (dbErr) {
      console.warn("PUT /api/tasks could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({
      success: true,
      task,
      tasks: clean,
      count: clean.length,
    });
  } catch (err: any) {
    console.error("PUT /api/tasks error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let targetId = searchParams.get("id");

    if (!targetId) {
      try {
        const body = await req.json();
        targetId = body.id || body.taskId;
      } catch {}
    }

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Task ID required for deletion" }, { status: 400 });
    }

    let current = memoryTasksCache || loadBackupFileTasks() || [];
    const filtered = current.filter((t) => t.id !== targetId);
    memoryTasksCache = filtered;
    saveBackupFileTasks(filtered);

    try {
      const pool = getDbPool();
      void saveTasksToDb(pool, filtered);
    } catch (dbErr) {
      console.warn("DELETE /api/tasks could not persist to DB immediately:", dbErr);
    }

    return NextResponse.json({
      success: true,
      id: targetId,
      tasks: filtered,
      count: filtered.length,
    });
  } catch (err: any) {
    console.error("DELETE /api/tasks error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
