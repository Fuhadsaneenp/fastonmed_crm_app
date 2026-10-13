import type { Invoice } from "@/types";

export interface ZohoPaymentSummary {
  totalOutstandingReceivables: number;
  dueToday: number;
  dueWithin30Days: number;
  overdueInvoice: number;
  averageDaysForGettingPaid: number;
}

export const ZOHO_LIVE_SUMMARY: ZohoPaymentSummary = {
  totalOutstandingReceivables: 0,
  dueToday: 0,
  dueWithin30Days: 0,
  overdueInvoice: 0,
  averageDaysForGettingPaid: 0,
};

export const ZOHO_LIVE_INVOICES: Invoice[] = [];

export function getZohoLiveInvoices(): Invoice[] {
  if (typeof window === "undefined") return ZOHO_LIVE_INVOICES;
  try {
    const raw = localStorage.getItem("fastonmed_zoho_live_invoices");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    localStorage.setItem("fastonmed_zoho_live_invoices", JSON.stringify(ZOHO_LIVE_INVOICES));
  } catch (err) {
    console.error("Error reading zoho live invoices from localStorage:", err);
  }
  return ZOHO_LIVE_INVOICES;
}

export function saveZohoLiveInvoices(invoices: Invoice[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("fastonmed_zoho_live_invoices", JSON.stringify(invoices));
    window.dispatchEvent(new Event("fastonmed_invoices_updated"));

    // Persist to server in background for all accounts/devices
    fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", invoices }),
    }).catch((err) => console.warn("Background sync to /api/invoices failed:", err));
  } catch (err) {
    console.error("Error saving zoho live invoices to localStorage:", err);
  }
}

export async function fetchZohoLiveInvoicesFromServer(forceSync = false): Promise<Invoice[]> {
  if (typeof window === "undefined") return ZOHO_LIVE_INVOICES;
  try {
    const res = await fetch(`/api/invoices?sync=${forceSync ? "1" : "0"}`);
    if (res.ok) {
      const data = await res.json();
      const list = data?.invoices || data?.data;
      if (Array.isArray(list) && list.length > 0) {
        localStorage.setItem("fastonmed_zoho_live_invoices", JSON.stringify(list));
        window.dispatchEvent(new Event("fastonmed_invoices_updated"));
        return list;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch invoices from /api/invoices:", err);
  }
  return getZohoLiveInvoices();
}

export async function addNewInvoice(newInv: Invoice): Promise<Invoice[]> {
  const current = getZohoLiveInvoices();
  const exists = current.some((inv) => inv.id === newInv.id || (newInv.invoiceNumber && inv.invoiceNumber === newInv.invoiceNumber));
  const updated = exists
    ? current.map((inv) => (inv.id === newInv.id || inv.invoiceNumber === newInv.invoiceNumber ? newInv : inv))
    : [newInv, ...current];

  saveZohoLiveInvoices(updated);
  return updated;
}

