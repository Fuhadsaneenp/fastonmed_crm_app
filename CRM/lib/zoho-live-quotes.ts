import type { Quotation } from "@/types";
const defaultQuotesData: Quotation[] = [];

export const DUMMY_QUOTE_NUMBERS = new Set<string>();

export const ZOHO_LIVE_QUOTES: Quotation[] = defaultQuotesData as Quotation[];

export function getZohoLiveQuotes(): Quotation[] {
  if (typeof window === "undefined") return ZOHO_LIVE_QUOTES;
  try {
    const raw = localStorage.getItem("fastonmed_zoho_live_quotes");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const quotes = parsed.filter(
          (quote: Quotation) => quote && (quote.quotationNumber || quote.id)
        );
        if (quotes.length > 0) {
          return quotes;
        }
      }
    }
    // Seed with ZOHO_LIVE_QUOTES
    localStorage.setItem("fastonmed_zoho_live_quotes", JSON.stringify(ZOHO_LIVE_QUOTES));
  } catch (err) {
    console.error("Error reading zoho live quotes from localStorage:", err);
  }
  return ZOHO_LIVE_QUOTES;
}

export function saveZohoLiveQuotes(quotes: Quotation[]): void {
  if (typeof window === "undefined") return;
  try {
    const filtered = (quotes || []).filter(
      (q) => q && (q.quotationNumber || q.id)
    );
    localStorage.setItem("fastonmed_zoho_live_quotes", JSON.stringify(filtered));
    window.dispatchEvent(new Event("fastonmed_quotes_updated"));
    window.dispatchEvent(new Event("fastonmed_leads_updated"));

    // Persist to server in background for all accounts/devices
    fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", quotes: filtered }),
    }).catch((err) => console.warn("Background sync to /api/quotations failed:", err));
  } catch (err) {
    console.error("Error saving zoho live quotes to localStorage:", err);
  }
}

export async function fetchZohoLiveQuotesFromServer(): Promise<Quotation[]> {
  if (typeof window === "undefined") return ZOHO_LIVE_QUOTES;
  try {
    const res = await fetch("/api/quotations");
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.quotes)) {
        localStorage.setItem("fastonmed_zoho_live_quotes", JSON.stringify(data.quotes));
        return data.quotes;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch quotations from /api/quotations:", err);
  }
  return getZohoLiveQuotes();
}
