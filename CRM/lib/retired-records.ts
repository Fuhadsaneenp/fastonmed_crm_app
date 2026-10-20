import retired from "@/config/retired-records.json";

export type RetiredDataset = keyof typeof retired;
const retiredIds = Object.fromEntries(Object.entries(retired).map(([key, ids]) => [key, new Set(ids)])) as Record<RetiredDataset, Set<string>>;

const LEADS_RESET_AT = Date.parse("2026-10-19T18:27:02.494065+00:00");

function createdAfterLeadsReset(record: { id?: string; createdAt?: string }): boolean {
  const createdAt = String(record.createdAt || "");
  // Older manual leads stored only the UTC date. Their generated ID retains
  // the actual creation time, including leads created later on reset day.
  const manualId = /^lead-(\d{13})$/.exec(String(record.id || ""));
  const createdTime = /^\d{4}-\d{2}-\d{2}$/.test(createdAt) && manualId
    ? Number(manualId[1])
    : Date.parse(createdAt);
  return createdTime > LEADS_RESET_AT;
}

// Explicitly retired IDs stay deleted when an older device syncs its local cache.
export function filterRetiredRecords<T extends { id?: string }>(dataset: RetiredDataset, records: T[]): T[] {
  return records.filter(record => record && !retiredIds[dataset].has(String(record.id)) && (dataset !== "leads" || createdAfterLeadsReset(record as T & { createdAt?: string })));
}

export function getRetiredIds(dataset: RetiredDataset): string[] {
  return [...retiredIds[dataset]];
}
