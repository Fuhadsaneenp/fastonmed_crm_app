import type { Lead } from "@/types";

// Hide legacy numbered examples from the mobile overview without altering stored records.
export function isLegacyExampleOpportunity(lead: Lead): boolean {
  return /^l-(?:[1-9]|1[0-2])$/.test(lead.id) && !lead.createdBy && !lead.quotationNumber;
}
