import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "AED") {
  return `AED ${Number(amount || 0).toLocaleString("en-US")}`;
}

export function formatDate(dateString?: string) {
  if (!dateString) return "-";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getDaysUntil(dateString: string): number {
  const target = new Date(dateString)
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // Lead statuses (Updated Pipeline Stages)
    "New Lead": "bg-sky-100 text-sky-700",
    "Contacted": "bg-blue-100 text-blue-700",
    "Quotation Forwarded": "bg-amber-100 text-amber-700",
    "Quatation Forwarded": "bg-amber-100 text-amber-700",
    "Approved": "bg-emerald-100 text-emerald-700",
    "Rejected": "bg-rose-100 text-rose-700",
    "Requirement Review": "bg-purple-100 text-purple-700",
    "Qualified": "bg-teal-100 text-teal-700",
    "Proposal Sent": "bg-amber-100 text-amber-700",
    "Negotiation": "bg-orange-100 text-orange-700",
    "Waiting Review": "bg-indigo-100 text-indigo-700",
    "Follow Up Later": "bg-slate-100 text-slate-700",
    "Won": "bg-emerald-100 text-emerald-700",
    "Lost": "bg-rose-100 text-rose-700",
    // Backward compatibility
    "Requirement Collected": "bg-purple-100 text-purple-700",
    "Demo Scheduled": "bg-teal-100 text-teal-700",
    "Quotation Sent": "bg-amber-100 text-amber-700",
    "PO Received": "bg-emerald-100 text-emerald-700",
    "Installation Pending": "bg-cyan-100 text-cyan-700",
    "Completed": "bg-emerald-100 text-emerald-700",
    "Lost Deal": "bg-rose-100 text-rose-700",
    // Service statuses
    "New Request": "bg-blue-100 text-blue-700",
    Assigned: "bg-purple-100 text-purple-700",
    "Visit Scheduled": "bg-yellow-100 text-yellow-700",
    "Under Repair": "bg-orange-100 text-orange-700",
    "Waiting Parts": "bg-red-100 text-red-700",
    Closed: "bg-gray-100 text-gray-700",
    // AMC
    Active: "bg-green-100 text-green-700",
    Expired: "bg-red-100 text-red-700",
    "Expiring Soon": "bg-yellow-100 text-yellow-700",
    // Client
    Lead: "bg-blue-100 text-blue-700",
    Prospect: "bg-purple-100 text-purple-700",
    "Existing Customer": "bg-green-100 text-green-700",
    "Lost Customer": "bg-red-100 text-red-700",
    // Priority
    High: "bg-red-100 text-red-700",
    Medium: "bg-yellow-100 text-yellow-700",
    Low: "bg-green-100 text-green-700",
    Critical: "bg-red-200 text-red-800",
  }
  return map[status] ?? "bg-gray-100 text-gray-700"
}

export function truncate(str: string, length = 30): string {
  return str.length > length ? str.slice(0, length) + "…" : str
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
