import type { Notification, Task } from "@/types";
import { getStoredTasks } from "@/lib/task-store";

const CUSTOM_NOTIFICATIONS_KEY = "fastonmed_custom_notifications_v1";

export type TargetedNotification = Notification & {
  targetUserId?: string;
  targetUserName?: string;
};

export function matchesUser(user: any, nameOrId?: string): boolean {
  if (!user || !nameOrId) return false;
  const target = String(nameOrId).trim().toLowerCase();
  if (target === "all" || target === "everyone") return true;

  const uName = String(user.name || "").trim().toLowerCase();
  const uId = String(user.id || "").trim().toLowerCase();
  const uEmail = String(user.email || "").trim().toLowerCase();

  if (uId && target === uId) return true;
  if (uName && (target === uName || target.includes(uName) || uName.includes(target))) return true;
  if (uEmail && target === uEmail) return true;

  // First name matching (e.g. "Hashim" matches "Hashim" or "emp-hashim")
  const firstName = uName.split(/\s+/)[0];
  if (firstName && firstName.length > 2 && (target === firstName || target.includes(firstName) || target === `emp-${firstName}`)) {
    return true;
  }

  return false;
}

function getUserStorageKey(user: any): string {
  if (!user) return "anon";
  const raw = user.id || user.email || user.name || "anon";
  return String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

export function getReadNotificationIds(user: any): Set<string> {
  if (typeof window === "undefined" || !user) return new Set();
  try {
    const key = `fastonmed_read_notifs_${getUserStorageKey(user)}`;
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markNotificationAsRead(user: any, notificationId: string): void {
  if (typeof window === "undefined" || !user || !notificationId) return;
  try {
    const key = `fastonmed_read_notifs_${getUserStorageKey(user)}`;
    const set = getReadNotificationIds(user);
    set.add(notificationId);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent("fastonmed_notifications_updated"));
  } catch {}
}

export function markAllNotificationsAsRead(user: any, notificationIds: string[]): void {
  if (typeof window === "undefined" || !user) return;
  try {
    const key = `fastonmed_read_notifs_${getUserStorageKey(user)}`;
    const set = getReadNotificationIds(user);
    notificationIds.forEach((id) => set.add(id));
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent("fastonmed_notifications_updated"));
  } catch {}
}

export function addCustomNotification(notif: TargetedNotification): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CUSTOM_NOTIFICATIONS_KEY);
    const existing: TargetedNotification[] = raw ? JSON.parse(raw) : [];
    const updated = [notif, ...existing.filter((n) => n.id !== notif.id)].slice(0, 100);
    localStorage.setItem(CUSTOM_NOTIFICATIONS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("fastonmed_notifications_updated"));
  } catch {}
}

export function getUserNotifications(currentUser: any): Notification[] {
  if (!currentUser) return [];

  const readIds = getReadNotificationIds(currentUser);
  const tasks = getStoredTasks();
  const todayIso = new Date().toISOString().slice(0, 10);
  const notifs: Notification[] = [];

  // 1. Process tasks for this user
  for (const task of tasks) {
    if (!task || !task.id || !task.title) continue;

    const isAssignee = matchesUser(currentUser, task.assignedTo) || matchesUser(currentUser, task.assignedToId);
    const isCreator = matchesUser(currentUser, task.createdBy) || matchesUser(currentUser, task.createdById);

    // Case A: Someone completed a task this user created
    if (isCreator && !isAssignee && (task.status === "Completed" || task.status === "Approved")) {
      const assigneeLabel = task.assignedTo || "Assignee";
      notifs.push({
        id: `notif-task-completed-${task.id}`,
        title: "Task Completed",
        message: `${assigneeLabel} completed your task "${task.title}"`,
        type: "success",
        read: readIds.has(`notif-task-completed-${task.id}`),
        createdAt: task.completedAt || (task.completedDate ? `${task.completedDate}T12:00:00` : `${todayIso}T10:00:00`),
        link: `/tasks?id=${task.id}`,
      });
      continue;
    }

    // Case B: Someone declined a task this user created
    if (isCreator && !isAssignee && task.status === "Declined") {
      const assigneeLabel = task.assignedTo || "Assignee";
      notifs.push({
        id: `notif-task-declined-${task.id}`,
        title: "Task Declined",
        message: `${assigneeLabel} declined "${task.title}"${task.declineReason ? `: "${task.declineReason}"` : ""}`,
        type: "error",
        read: readIds.has(`notif-task-declined-${task.id}`),
        createdAt: task.declinedAt || `${todayIso}T09:00:00`,
        link: `/tasks?id=${task.id}`,
      });
      continue;
    }

    // Case C: Task created by this user is Under Review
    if (isCreator && !isAssignee && task.status === "Under Review") {
      const assigneeLabel = task.assignedTo || "Assignee";
      notifs.push({
        id: `notif-task-review-${task.id}`,
        title: "Task Ready for Review",
        message: `${assigneeLabel} submitted "${task.title}" for your review`,
        type: "warning",
        read: readIds.has(`notif-task-review-${task.id}`),
        createdAt: `${todayIso}T11:00:00`,
        link: `/tasks?id=${task.id}`,
      });
      continue;
    }

    // Case D: A task was assigned to this user
    if (isAssignee && (task.status === "Pending" || task.status === "In Progress" || task.status === "Edit / Rework")) {
      const creatorLabel = task.createdBy || "Team Manager";

      // If rework requested
      if (task.status === "Edit / Rework") {
        notifs.push({
          id: `notif-task-rework-${task.id}`,
          title: "Task Requires Rework",
          message: `${creatorLabel} requested revisions on "${task.title}"`,
          type: "warning",
          read: readIds.has(`notif-task-rework-${task.id}`),
          createdAt: `${todayIso}T08:30:00`,
          link: `/tasks?id=${task.id}`,
        });
      } else if (task.dueDate === todayIso) {
        // Due today notification
        notifs.push({
          id: `notif-task-due-${task.id}`,
          title: "Task Due Today",
          message: `"${task.title}" is scheduled for today${task.dueTime ? ` at ${task.dueTime}` : ""}`,
          type: "warning",
          read: readIds.has(`notif-task-due-${task.id}`),
          createdAt: `${todayIso}T08:00:00`,
          link: `/tasks?id=${task.id}`,
        });
      } else {
        // New task assigned
        notifs.push({
          id: `notif-task-assigned-${task.id}`,
          title: "New Task Assigned",
          message: `"${task.title}" assigned to you by ${creatorLabel}${task.dueDate ? ` (Due: ${task.dueDate})` : ""}`,
          type: "info",
          read: readIds.has(`notif-task-assigned-${task.id}`),
          createdAt: task.createdAt ? `${task.createdAt}T09:00:00` : `${todayIso}T09:00:00`,
          link: `/tasks?id=${task.id}`,
        });
      }
    }
  }

  // 2. Pull custom stored notifications for this user
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CUSTOM_NOTIFICATIONS_KEY);
      if (raw) {
        const customNotifs: TargetedNotification[] = JSON.parse(raw);
        if (Array.isArray(customNotifs)) {
          for (const cn of customNotifs) {
            if (!cn || !cn.id) continue;
            const isForUser =
              !cn.targetUserId && !cn.targetUserName
                ? true
                : matchesUser(currentUser, cn.targetUserId) || matchesUser(currentUser, cn.targetUserName);
            if (isForUser) {
              notifs.push({
                ...cn,
                read: readIds.has(cn.id) || !!cn.read,
              });
            }
          }
        }
      }
    } catch {}
  }

  // Deduplicate and sort by createdAt descending
  const uniqueMap = new Map<string, Notification>();
  notifs.forEach((n) => {
    if (!uniqueMap.has(n.id)) {
      uniqueMap.set(n.id, n);
    }
  });

  const result = Array.from(uniqueMap.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeB - timeA;
  });

  return result;
}
