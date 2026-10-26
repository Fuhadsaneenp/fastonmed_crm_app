import type { Lead } from "@/types";
export function mergeLeadUpdates(current: Lead[], incoming: Lead[]): Lead[] {
  const merged = new Map(current.map(lead => [lead.id, lead]));
  for (const lead of incoming) {
    if (!lead?.id) continue;
    const previous = merged.get(lead.id);
    const incomingTime = Date.parse(lead.updatedAt || lead.createdAt || "") || 0;
    const previousTime = previous ? Date.parse(previous.updatedAt || previous.createdAt || "") || 0 : 0;
    // Equal timestamps are cached copies, not proof of a newer edit.
    if (!previous || incomingTime > previousTime) merged.set(lead.id, { ...previous, ...lead });
  }
  return [...merged.values()];
}
