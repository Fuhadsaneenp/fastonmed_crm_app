import type { Quotation, Invoice } from "@/types";
import { saveZohoLiveInvoices, getZohoLiveInvoices } from "@/lib/zoho-live-invoices";

export const QUOTATIONS_STORAGE_KEY = "fastonmed_quotations";

export const INITIAL_QUOTATIONS: Quotation[] = [];

export function getStoredQuotations(): Quotation[] {
  if (typeof window === "undefined") return INITIAL_QUOTATIONS;
  try {
    const raw = localStorage.getItem(QUOTATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    localStorage.setItem(QUOTATIONS_STORAGE_KEY, JSON.stringify(INITIAL_QUOTATIONS));
  } catch (err) {
    console.error("Error reading quotations from localStorage:", err);
  }
  return INITIAL_QUOTATIONS;
}

export function saveStoredQuotations(quotations: Quotation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUOTATIONS_STORAGE_KEY, JSON.stringify(quotations));
    void fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", quotes: quotations }),
    }).then((response) => {
      if (!response.ok) throw new Error(`Database save failed with ${response.status}`);
    }).catch((error) => console.warn("Quotations are cached locally but database sync failed:", error));
    window.dispatchEvent(new Event("fastonmed_quotations_updated"));
  } catch (err) {
    console.error("Error saving quotations to localStorage:", err);
  }
}

export function convertQuotationToInvoice(quoteId: string): Invoice | null {
  const quotes = getStoredQuotations();
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) return null;

  const invoiceNumber = `FMT-INV26-00${Math.floor(Math.random() * 20 + 75)}`;
  const newInvoice: Invoice = {
    id: `inv-from-qt-${Date.now()}`,
    invoiceNumber,
    clientId: quote.clientId,
    clientName: quote.clientName,
    orderNumber: quote.quotationNumber,
    amount: quote.total,
    balanceDue: quote.total,
    status: "Pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString().slice(0, 10),
    items: quote.items.map((it) => ({
      product: it.product,
      qty: it.qty,
      rate: it.rate,
      amount: it.amount,
    })),
  };

  // Add to invoices
  const existingInvoices = getZohoLiveInvoices();
  saveZohoLiveInvoices([newInvoice, ...existingInvoices]);

  // Update quotation status to Approved
  const updatedQuotes = quotes.map((q) =>
    q.id === quoteId ? { ...q, status: "Approved", convertedToInvoiceId: newInvoice.id } : q
  );
  saveStoredQuotations(updatedQuotes);

  return newInvoice;
}
