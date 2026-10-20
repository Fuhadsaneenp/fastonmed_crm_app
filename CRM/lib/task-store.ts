import { filterRetiredRecords, getRetiredIds } from "@/lib/retired-records";
import type { Task } from "@/types";

export const TASKS_STORAGE_KEY = "fastonmed_tasks_v3";

export const DUMMY_TASK_IDS = new Set([
  "task-fuhad-1",
  "task-fuhad-2",
  "task-fuhad-3",
  "task-fuhad-4",
  "task-fuhad-5",
  "task-riyas-1",
  "task-riyas-2",
  "task-riyas-3",
  "task-hashim-1",
  "task-hashim-2",
  "task-fidha-1",
  "task-fidha-2",
  "task-user1-1",
  "task-user1-2",
  "task-user1-3",
  "task-cal-1",
  "task-cal-2",
  "task-cal-3",
  "task-cal-4",
  "task-cal-5",
  "task-cal-6",
]);

export function isDummyTask(task: Task | { id?: string; title?: string }): boolean {
  if (!task) return false;
  if (task.id && DUMMY_TASK_IDS.has(task.id)) return true;
  if (
    task.id &&
    (task.id.startsWith("task-fuhad-") ||
      task.id.startsWith("task-riyas-") ||
      task.id.startsWith("task-hashim-") ||
      task.id.startsWith("task-fidha-") ||
      task.id.startsWith("task-user1-") ||
      task.id.startsWith("task-cal-"))
  ) {
    return true;
  }
  if (task.title && task.title.toLowerCase().includes("mindray uae exclusive distribution pricing agreement")) {
    return true;
  }
  return false;
}

export function clearDummyTasks(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((t) => t && !isDummyTask(t));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent("fastonmed_tasks_updated", { detail: filtered }));
      }
    }
  } catch (err) {
    console.error("Failed to clear dummy tasks:", err);
  }
}

function toIsoDate(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split("/");
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeTaskStatus(value: unknown): Task["status"] {
  const raw = String(value || "Pending").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (raw === "in progress" || raw === "started") return "In Progress";
  if (raw === "completed" || raw === "done") return "Completed";
  if (raw === "cancelled" || raw === "canceled") return "Cancelled";
  if (raw === "declined") return "Declined";
  if (raw === "under review") return "Under Review";
  if (raw === "edit rework" || raw === "edit / rework") return "Edit / Rework";
  if (raw === "approved") return "Approved";
  return "Pending";
}

function normalizeTaskPriority(value: unknown): Task["priority"] {
  const raw = String(value || "Medium").trim().toLowerCase();
  if (raw === "low") return "Low";
  if (raw === "high" || raw === "urgent" || raw === "critical") return "High";
  return "Medium";
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function normalizeTask(rawTask: any): Task | null {
  if (!rawTask || typeof rawTask !== "object") return null;

  const assignee = rawTask.assignee || rawTask.assignedUser || rawTask.employee || rawTask.user || {};
  const client = rawTask.client || rawTask.customer || rawTask.organisation || rawTask.organization || {};
  const assignedTo = pickString(
    rawTask.assignedTo,
    rawTask.assigned_to,
    rawTask.assigned_to_name,
    rawTask.assigneeName,
    rawTask.employeeName,
    assignee.name,
    assignee.fullName
  );
  const assignedToId = pickString(
    rawTask.assignedToId,
    rawTask.assigned_to_id,
    rawTask.assigneeId,
    rawTask.employeeId,
    assignee.id,
    assignee._id
  );
  const id = pickString(rawTask.id, rawTask._id, rawTask.taskId, rawTask.task_id);
  const title = pickString(rawTask.title, rawTask.name, rawTask.subject, rawTask.taskTitle);

  if (!id || !title) return null;

  return {
    id,
    title,
    type: pickString(rawTask.type, rawTask.taskType, rawTask.task_type, rawTask.category) || "Follow-up",
    assignedTo: assignedTo || "Unassigned",
    assignedToId: assignedToId || (assignedTo ? `emp-${assignedTo.toLowerCase().split(/\s+/)[0]}` : ""),
    clientId: pickString(rawTask.clientId, rawTask.client_id, rawTask.customerId, rawTask.customer_id, client.id, client._id) || undefined,
    clientName: pickString(rawTask.clientName, rawTask.client_name, rawTask.customerName, rawTask.customer_name, rawTask.facility, client.name) || undefined,
    createdBy: pickString(rawTask.createdBy, rawTask.created_by, rawTask.created_by_name, rawTask.creator?.name) || undefined,
    createdById: pickString(rawTask.createdById, rawTask.created_by_id, rawTask.creator?.id) || undefined,
    dueDate: toIsoDate(rawTask.dueDate || rawTask.due_date || rawTask.date || rawTask.taskDate || rawTask.scheduledDate),
    dueTime: pickString(rawTask.dueTime, rawTask.due_time, rawTask.time, rawTask.taskTime) || undefined,
    priority: normalizeTaskPriority(rawTask.priority),
    status: normalizeTaskStatus(rawTask.status),
    notes: pickString(rawTask.notes, rawTask.description, rawTask.details) || undefined,
    createdAt: toIsoDate(rawTask.createdAt || rawTask.created_at || rawTask.createdDate),
    completedDate: rawTask.completedDate || rawTask.completed_date ? toIsoDate(rawTask.completedDate || rawTask.completed_date) : undefined,
    completedAt: pickString(rawTask.completedAt, rawTask.completed_at) || undefined,
    declinedAt: pickString(rawTask.declinedAt, rawTask.declined_at) || undefined,
    declineReason: pickString(rawTask.declineReason, rawTask.decline_reason) || undefined,
    serviceTicketId: pickString(rawTask.serviceTicketId, rawTask.service_ticket_id) || undefined,
  };
}

export async function syncLiveTasksFromApi(): Promise<Task[]> {
  if (typeof window === "undefined") return getStoredTasks();
  try {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (res.ok) {
      const rawLiveTasks = await res.json();
      const liveTasks = Array.isArray(rawLiveTasks)
        ? rawLiveTasks
        : Array.isArray(rawLiveTasks?.tasks)
        ? rawLiveTasks.tasks
        : Array.isArray(rawLiveTasks?.items)
        ? rawLiveTasks.items
        : Array.isArray(rawLiveTasks?.data)
        ? rawLiveTasks.data
        : [];
      if (Array.isArray(liveTasks)) {
        const normalized = liveTasks
          .map(normalizeTask)
          .filter((task): task is Task => Boolean(task && !isDummyTask(task)));

        const currentTasks = getStoredTasks();
        const serverTaskIds = new Set(normalized.map((t) => t.id));

        const mergedMap = new Map<string, Task>();
        // Preserve existing valid local tasks
        currentTasks.forEach((t) => {
          if (t && t.id && !isDummyTask(t)) {
            mergedMap.set(t.id, t);
          }
        });
        // Overlay latest server tasks
        normalized.forEach((t) => {
          if (t && t.id) {
            mergedMap.set(t.id, t);
          }
        });

        const merged = Array.from(mergedMap.values());
        saveStoredTasks(merged);

        // In background, sync any local task to server if missing on server
        const missingOnServer = currentTasks.filter(
          (localTask) => localTask && localTask.id && !serverTaskIds.has(localTask.id) && !isDummyTask(localTask)
        );
        if (missingOnServer.length > 0) {
          fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks: missingOnServer }),
          }).catch((e) => console.warn("Background sync of local tasks to server failed:", e));
        }

        return merged;
      }
    }
  } catch (err) {
    console.warn("Could not sync live tasks from API:", err);
  }
  return getStoredTasks();
}

function readCachedgetStoredTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((t) => t && !isDummyTask(t));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(filtered));
      }
      return filtered;
    }
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify([]));
    return [];
  } catch (err) {
    console.error("Failed to load stored tasks:", err);
    return [];
  }
}

export function saveStoredTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    window.dispatchEvent(new CustomEvent("fastonmed_tasks_updated", { detail: tasks }));
  } catch (err) {
    console.error("Failed to save tasks to localStorage:", err);
  }
}

export function addStoredTask(task: Task): Task[] {
  const current = getStoredTasks();
  const updated = [task, ...current.filter((t) => t.id !== task.id)];
  saveStoredTasks(updated);

  if (typeof window !== "undefined") {
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    }).catch((err) => console.warn("Could not sync task creation to server:", err));
  }

  return updated;
}

export function updateStoredTask(task: Task): Task[] {
  const current = getStoredTasks();
  const exists = current.some((t) => t.id === task.id);
  const updated = exists
    ? current.map((t) => (t.id === task.id ? task : t))
    : [task, ...current];
  saveStoredTasks(updated);

  if (typeof window !== "undefined") {
    fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    }).catch((err) => console.warn("Could not sync task update to server:", err));
  }

  return updated;
}

export function declineStoredTask(taskId: string, reason: string = "Declined by user"): Task[] {
  const current = getStoredTasks();
  const target = current.find((t) => t.id === taskId);
  if (!target) return current;
  const declinedItem: Task = {
    ...target,
    status: "Declined",
    declinedAt: new Date().toISOString(),
    declineReason: reason,
  };
  return updateStoredTask(declinedItem);
}

export function deleteStoredTask(taskId: string): Task[] {
  const current = getStoredTasks();
  const updated = current.filter((t) => t.id !== taskId);
  saveStoredTasks(updated);

  if (typeof window !== "undefined") {
    fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    }).catch((err) => console.warn("Could not sync task deletion to server:", err));
  }

  return updated;
}

export function getCurrentUser(): { id?: string; name?: string; email?: string; role?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("fastonmed_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    return {
      id: parsed.id || parsed.userId,
      name: parsed.name || parsed.fullName || parsed.username,
      email: parsed.email,
      role: parsed.role || parsed.designation,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if the given user is authorized to edit, change status, or decline a task.
 * Per business rules: Only the task's Creator (createdBy/createdById) and the Assignee
 * (assignedTo/assignedToId) are allowed to edit. A 3rd user cannot edit or decline.
 */
export function canUserEditTask(
  task: Task | null | undefined,
  user?: { name?: string; id?: string; email?: string; role?: string } | null
): boolean {
  if (!task) return false;
  const currentUser = user !== undefined ? user : getCurrentUser();
  if (!currentUser || !currentUser.name) return true; // If no user session is detected, do not hard-lock

  const currentName = (currentUser.name || "").trim().toLowerCase();
  const currentRole = (currentUser.role || "").trim().toLowerCase();
  const currentEmail = (currentUser.email || "").trim().toLowerCase();

  // 1. Full Administrative & Managerial Override:
  // Super Admin, Admin, Operations Manager, Directors, and Saneen / Fuhad have full permission to edit ANY task!
  const isAdminOrManager =
    currentRole.includes("admin") ||
    currentRole.includes("manager") ||
    currentRole.includes("director") ||
    currentRole.includes("owner") ||
    currentRole.includes("lead") ||
    currentName.includes("saneen") ||
    currentName.includes("fuhad") ||
    currentEmail.includes("saneen") ||
    currentEmail.includes("fuhad");

  if (isAdminOrManager) {
    return true;
  }

  const currentFirst = currentName.split(" ")[0];
  const currentId = (currentUser.id || "").trim().toLowerCase();
  const emailPrefix = currentEmail ? currentEmail.split("@")[0] : "";

  const creatorName = (task.createdBy || "").trim().toLowerCase();
  const creatorFirst = creatorName.split(" ")[0];
  const creatorId = (task.createdById || "").trim().toLowerCase();

  const assigneeName = (task.assignedTo || "").trim().toLowerCase();
  const assigneeFirst = assigneeName.split(" ")[0];
  const assigneeId = (task.assignedToId || "").trim().toLowerCase();

  // If task has neither creator nor assignee specified, anyone can edit
  if (!creatorName && !assigneeName && !creatorId && !assigneeId) return true;

  const isCreator = Boolean(
    (creatorName && (
      currentName === creatorName ||
      currentFirst === creatorFirst ||
      currentName.includes(creatorFirst) ||
      creatorName.includes(currentFirst) ||
      (emailPrefix && (creatorName.includes(emailPrefix) || emailPrefix.includes(creatorFirst)))
    )) ||
    (creatorId && (
      currentId === creatorId ||
      currentId.includes(creatorFirst) ||
      (emailPrefix && creatorId.includes(emailPrefix))
    ))
  );

  const isAssignee = Boolean(
    (assigneeName && (
      currentName === assigneeName ||
      currentFirst === assigneeFirst ||
      currentName.includes(assigneeFirst) ||
      assigneeName.includes(currentFirst) ||
      (emailPrefix && (assigneeName.includes(emailPrefix) || emailPrefix.includes(assigneeFirst)))
    )) ||
    (assigneeId && (
      currentId === assigneeId ||
      currentId.includes(assigneeFirst) ||
      (emailPrefix && assigneeId.includes(emailPrefix))
    ))
  );

  return isCreator || isAssignee;
}

export function getStoredTasks(): Task[] {
  return filterRetiredRecords("tasks", readCachedgetStoredTasks());
}
