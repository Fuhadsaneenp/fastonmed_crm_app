import type { Quotation } from "@/types";

type ZohoRecord = Record<string, any>;
export function mapZohoQuotation(item: ZohoRecord, previous?: Quotation): Quotation {
  const status: Record<string, string> = { draft: "Draft", sent: "Sent", accepted: "Approved", approved: "Approved", declined: "Rejected", rejected: "Rejected", expired: "Expired", invoiced: "Approved" };
  const items = Array.isArray(item.line_items) ? item.line_items.map((line: ZohoRecord, index: number) => ({
    id: String(line.line_item_id || `${item.estimate_id}-${index}`), product: String(line.name || line.item_name || ""), description: line.description || "",
    qty: Number(line.quantity || 0), rate: Number(line.rate || 0), amount: Number(line.item_total || 0), taxRate: Number(line.tax_percentage || 0),
  })) : previous?.items || [];
  return {
    ...previous, id: String(item.estimate_id), quotationNumber: String(item.estimate_number),
    referenceNumber: item.reference_number || "", clientId: String(item.customer_id || ""), clientName: item.customer_name || "",
    date: item.date || "", validUntil: item.expiry_date || "", status: status[item.status] || item.status || "Draft",
    total: Number(item.total || 0), subtotal: Number(item.sub_total ?? item.total ?? 0), tax: Number(item.tax_total || 0), discount: Number(item.discount_total || 0),
    items, preparedBy: item.salesperson_name || item.created_by_name || previous?.preparedBy || "",
    notes: item.notes || "", terms: item.terms || "", createdAt: item.created_time || item.date || "", updatedAt: item.last_modified_time || new Date().toISOString(),
  };
}

export async function fetchAllZohoQuotations(fetchPage: (page: number) => Promise<ZohoRecord>): Promise<ZohoRecord[]> {
  const records = new Map<string, ZohoRecord>();
  for (let page = 1; page <= 1000; page++) {
    const result = await fetchPage(page);
    if ((result.code !== undefined && result.code !== 0) || !Array.isArray(result.estimates)) throw new Error(result.message || "Zoho did not return quotations. Existing quotations were preserved.");
    for (const record of result.estimates) {
      if (!record.estimate_id || !record.estimate_number) throw new Error("Zoho returned an incomplete quotation. Existing quotations were preserved.");
      records.set(String(record.estimate_id), record);
    }
    if (!result.page_context?.has_more_page) return [...records.values()];
  }
  throw new Error("Zoho quotation pagination exceeded its limit. Existing quotations were preserved.");
}
