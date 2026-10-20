import { filterRetiredRecords, getRetiredIds } from "@/lib/retired-records";
import { mockServiceTickets } from "@/lib/mock-data";
import { getStoredTasks, saveStoredTasks } from "@/lib/task-store";
import type { ServiceTicket, ServiceStatus, Task, TaskPriority, TaskStatus } from "@/types";
import { persistSharedDataset } from "@/lib/shared-data-client";

export const SERVICES_STORAGE_KEY = "fastonmed_service_tickets_v1";
export const ENGINEERS_STORAGE_KEY = "fastonmed_service_engineers_v1";
export const SERVICE_TYPES_STORAGE_KEY = "fastonmed_service_types_v1";

export const DUMMY_TO_REAL_ENGINEERS: Record<string, string> = {
  "Rahul Kumar": "Hashim",
  "Sneha Pillai": "Riyas",
  "Deepa Suresh": "Fuhad",
};

export const DEFAULT_ENGINEERS = ["Hashim", "Riyas", "Fuhad", "Fidha", "User 1"];
export const DEFAULT_SERVICE_TYPES = [
  "Inspection & corrective",
  "Installation",
  "PPM",
  "AMC & CMC",
  "QA QB & calibration",
  "Clinical Service",
  "DHA Inspection",
];
const SERVICE_TASK_ID_PREFIX = "service-ticket-task-";
const DEMO_SERVICE_TICKET_IDS = new Set(mockServiceTickets.map((ticket) => ticket.id));

export function getStoredEngineers(): string[] {
  if (typeof window === "undefined") return DEFAULT_ENGINEERS;
  try {
    const raw = localStorage.getItem(ENGINEERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ENGINEERS_STORAGE_KEY, JSON.stringify(DEFAULT_ENGINEERS));
      return DEFAULT_ENGINEERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const filtered = parsed.filter((name) => typeof name === "string" && !DUMMY_TO_REAL_ENGINEERS[name]);
      const merged = Array.from(new Set([...DEFAULT_ENGINEERS, ...filtered]));
      return merged;
    }
    return DEFAULT_ENGINEERS;
  } catch {
    return DEFAULT_ENGINEERS;
  }
}

export function addStoredEngineer(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getStoredEngineers();
  const current = getStoredEngineers();
  if (!current.includes(trimmed)) {
    const updated = [...current, trimmed];
    if (typeof window !== "undefined") {
      localStorage.setItem(ENGINEERS_STORAGE_KEY, JSON.stringify(updated));
      void persistSharedDataset("service-engineers", updated).catch(() => {});
      window.dispatchEvent(new CustomEvent("fastonmed_engineers_updated", { detail: updated }));
    }
    return updated;
  }
  return current;
}

export function getStoredServiceTypes(): string[] {
  if (typeof window === "undefined") return DEFAULT_SERVICE_TYPES;
  try {
    const raw = localStorage.getItem(SERVICE_TYPES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SERVICE_TYPES_STORAGE_KEY, JSON.stringify(DEFAULT_SERVICE_TYPES));
      return DEFAULT_SERVICE_TYPES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(new Set([...DEFAULT_SERVICE_TYPES, ...parsed.filter((item) => typeof item === "string" && item.trim())]));
    }
  } catch (err) {
    console.error("Failed to load service types:", err);
  }
  return DEFAULT_SERVICE_TYPES;
}

export function addStoredServiceType(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getStoredServiceTypes();
  const current = getStoredServiceTypes();
  const exists = current.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  const updated = exists ? current : [...current, trimmed];
  if (typeof window !== "undefined") {
    localStorage.setItem(SERVICE_TYPES_STORAGE_KEY, JSON.stringify(updated));
    void persistSharedDataset("service-types", updated).catch(() => {});
    window.dispatchEvent(new CustomEvent("fastonmed_service_types_updated", { detail: updated }));
  }
  return updated;
}

function readCachedgetStoredServiceTickets(): ServiceTicket[] {
  const fallback: ServiceTicket[] = [];
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SERVICES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const userTickets = parsed.filter((ticket: ServiceTicket) => !DEMO_SERVICE_TICKET_IDS.has(ticket.id));
      if (userTickets.length === 0 && fallback.length > 0) {
        localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(fallback));
        return fallback;
      }
      let needsSave = false;
      if (userTickets.length !== parsed.length) {
        needsSave = true;
      }

      // Migrate any legacy placeholder names to real persons.
      const migrated = userTickets.map((t: ServiceTicket) => {
        let updated = { ...t };
        if (t.assignedEngineerName && DUMMY_TO_REAL_ENGINEERS[t.assignedEngineerName]) {
          needsSave = true;
          const realName = DUMMY_TO_REAL_ENGINEERS[t.assignedEngineerName];
          updated.assignedEngineerName = realName;
          updated.assignedEngineerId = `emp-${realName.toLowerCase()}`;
        }
        return updated;
      });
      if (needsSave && typeof window !== "undefined") {
        localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(migrated));
      }
      return migrated;
    }
    localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  } catch (err) {
    console.error("Failed to load stored service tickets:", err);
    return fallback;
  }
}

export async function fetchStoredServiceTicketsFromServer(): Promise<ServiceTicket[]> {
  const current = getStoredServiceTickets();
  if (typeof window === "undefined") return current;
  try {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", localTickets: current }),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const serverTickets: ServiceTicket[] = Array.isArray(data.tickets)
        ? data.tickets
        : Array.isArray(data)
        ? data
        : [];

      if (Array.isArray(data.tickets) || Array.isArray(data)) {
        localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(serverTickets));
        syncServiceTicketsToTasks(serverTickets);
        window.dispatchEvent(new CustomEvent("fastonmed_services_updated", { detail: serverTickets }));
        return serverTickets;
      }
    }
  } catch (err) {
    console.warn("Could not sync service tickets with server:", err);
  }
  return current;
}

export function saveStoredServiceTickets(tickets: ServiceTicket[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(tickets));
    syncServiceTicketsToTasks(tickets);
    window.dispatchEvent(new CustomEvent("fastonmed_services_updated", { detail: tickets }));
  } catch (err) {
    console.error("Failed to save service tickets to localStorage:", err);
  }
}

export function addStoredServiceTicket(ticket: ServiceTicket): ServiceTicket[] {
  const current = getStoredServiceTickets();
  const updated = [ticket, ...current.filter((t) => t.id !== ticket.id && t.ticketNumber !== ticket.ticketNumber)];
  saveStoredServiceTickets(updated);

  if (typeof window !== "undefined") {
    fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    }).catch((err) => console.warn("Could not sync created service ticket to server:", err));
  }

  return updated;
}

export function updateStoredServiceTicket(ticket: ServiceTicket): ServiceTicket[] {
  const current = getStoredServiceTickets();
  const updated = current.map((t) => (t.id === ticket.id ? ticket : t));
  saveStoredServiceTickets(updated);

  if (typeof window !== "undefined") {
    fetch("/api/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, data: ticket }),
    }).catch((err) => console.warn("Could not sync updated service ticket to server:", err));
  }

  return updated;
}

export function updateStoredServiceTicketStatus(ticketId: string, status: ServiceStatus): ServiceTicket[] {
  const current = getStoredServiceTickets();
  const resolvedAt = ["Completed", "Closed"].includes(status) ? new Date().toISOString().split("T")[0] : undefined;
  const updated = current.map((t) =>
    t.id === ticketId
      ? {
          ...t,
          status,
          resolvedAt: resolvedAt || t.resolvedAt,
        }
      : t
  );
  saveStoredServiceTickets(updated);

  if (typeof window !== "undefined") {
    fetch("/api/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId, data: { status, resolvedAt } }),
    }).catch((err) => console.warn("Could not sync updated service status to server:", err));
  }

  return updated;
}

export function deleteStoredServiceTicket(ticketId: string): ServiceTicket[] {
  const current = getStoredServiceTickets();
  const updated = current.filter((t) => t.id !== ticketId);
  saveStoredServiceTickets(updated);

  if (typeof window !== "undefined") {
    fetch("/api/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId }),
    }).catch((err) => console.warn("Could not sync deleted service ticket to server:", err));

    fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: serviceTicketTaskId(ticketId) }),
    }).catch((err) => console.warn("Could not sync deleted service task to server:", err));
  }

  return updated;
}

function mapServiceStatusToTaskStatus(status: ServiceStatus): TaskStatus {
  if (status === "Under Repair") return "In Progress";
  if (status === "Waiting Parts") return "Under Review";
  if (status === "Completed" || status === "Closed") return "Completed";
  return "Pending";
}

function mapServicePriorityToTaskPriority(priority: ServiceTicket["priority"]): TaskPriority {
  return priority === "Critical" ? "High" : priority;
}

function serviceTicketTaskId(ticketId: string): string {
  return `${SERVICE_TASK_ID_PREFIX}${ticketId}`;
}

function buildTaskFromServiceTicket(ticket: ServiceTicket, existingTask?: Task): Task {
  const dueDate = ticket.visitDate || ticket.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  let currentUser: { id?: string; name?: string } = {};
  if (typeof window !== "undefined") {
    try {
      currentUser = JSON.parse(localStorage.getItem("fastonmed_user") || "{}");
    } catch {}
  }
  return {
    id: serviceTicketTaskId(ticket.id),
    title: `${ticket.clientName} - ${ticket.equipment}`,
    type: "Service Visit",
    assignedTo: ticket.assignedEngineerName,
    assignedToId: ticket.assignedEngineerId,
    clientId: ticket.clientId,
    clientName: ticket.clientName,
    createdBy: existingTask?.createdBy || currentUser.name || "User not recorded",
    createdById: existingTask?.createdById || currentUser.id,
    dueDate,
    dueTime: existingTask?.dueTime,
    priority: mapServicePriorityToTaskPriority(ticket.priority),
    status: mapServiceStatusToTaskStatus(ticket.status),
    notes: [
      ticket.ticketNumber,
      ticket.serviceType ? `Service Type: ${ticket.serviceType}` : "",
      ticket.model ? `Model: ${ticket.model}` : "",
      ticket.serialNumber ? `Serial: ${ticket.serialNumber}` : "",
      ticket.concernedPerson ? `Concerned: ${ticket.concernedPerson}` : "",
      ticket.contactPhone ? `Phone: ${ticket.contactPhone}` : "",
      ticket.complaint,
    ]
      .filter(Boolean)
      .join("\n"),
    createdAt: ticket.createdAt || existingTask?.createdAt || new Date().toISOString().slice(0, 10),
    completedDate: ["Completed", "Closed"].includes(ticket.status) ? ticket.resolvedAt || dueDate : existingTask?.completedDate,
    completedAt: ["Completed", "Closed"].includes(ticket.status) ? existingTask?.completedAt : undefined,
    serviceTicketId: ticket.id,
  };
}

export function syncServiceTicketsToTasks(tickets: ServiceTicket[]): Task[] {
  if (typeof window === "undefined") return getStoredTasks();

  const currentTasks = getStoredTasks();
  const activeServiceTicketIds = new Set(tickets.map((ticket) => ticket.id));
  const retainedTasks = currentTasks.filter((task) => {
    if (task.serviceTicketId) return activeServiceTicketIds.has(task.serviceTicketId);
    if (task.id.startsWith(SERVICE_TASK_ID_PREFIX)) {
      return activeServiceTicketIds.has(task.id.slice(SERVICE_TASK_ID_PREFIX.length));
    }
    if (task.type === "Service Visit") return false;
    return true;
  });
  const taskById = new Map(retainedTasks.map((task) => [task.id, task]));

  tickets.forEach((ticket) => {
    const taskId = serviceTicketTaskId(ticket.id);
    taskById.set(taskId, buildTaskFromServiceTicket(ticket, taskById.get(taskId)));
  });

  const updatedTasks = Array.from(taskById.values());
  saveStoredTasks(updatedTasks);

  if (typeof window !== "undefined") {
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: updatedTasks }),
    }).catch((err) => console.warn("Could not sync service tasks to /api/tasks:", err));
  }

  return updatedTasks;
}

export function syncStoredServiceTicketsToTasks(): Task[] {
  return syncServiceTicketsToTasks(getStoredServiceTickets());
}

export function getStoredServiceTickets(): ServiceTicket[] {
  return filterRetiredRecords("services", readCachedgetStoredServiceTickets());
}
