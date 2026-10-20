import organisationAliases from "@/config/organisation-aliases.json";
// Exact IDs from the retired demo suppliers and explicitly named test organisations.
// Match IDs, not business names, so real organisations with similar names survive.
const TEST_ORGANISATION_IDS = new Set([
  "c-1789977617852", "c-1789981657351",
  "comp-1789984160023", "c-1789984246711",
]);

export function isRetiredDirectoryRecord(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  const isRetiredId = (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    const id = value.replace(/^(?:trader-|client-trader-)+/, "");
    return /^comp-[1-8]$/.test(id) || TEST_ORGANISATION_IDS.has(id);
  };
  return [record.id, record.clientId, record.sourceClientId].some(isRetiredId)
    || (typeof record.id === "string" && /^(?:trader-contact-|person-trader-)comp-[1-8](?:-\d+)?$/.test(record.id));
}

type DirectoryRecord = Record<string, unknown>;
const aliases: Record<string, string> = organisationAliases;

export function canonicalOrganisationId(id: string): string {
  return aliases[id] || id;
}

export function remapOrganisationReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapOrganisationReferences);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ["clientId", "sourceClientId", "organisationId", "organizationId"].includes(key) && typeof item === "string"
      ? canonicalOrganisationId(item) : remapOrganisationReferences(item)
  ]));
}

function mergeRecords(primary: DirectoryRecord, other: DirectoryRecord): DirectoryRecord {
  const merged = { ...primary };
  for (const [key, value] of Object.entries(other)) {
    if (Array.isArray(value)) {
      const values = Array.isArray(merged[key]) ? merged[key] as unknown[] : [];
      const combined = new Map<string, unknown>();
      for (const entry of [...values, ...value]) {
        const id = entry && typeof entry === "object" ? (entry as DirectoryRecord).id : undefined;
        const entryKey = id ? `id:${id}` : JSON.stringify(entry);
        const previous = combined.get(entryKey);
        combined.set(entryKey, previous && typeof previous === "object" && entry && typeof entry === "object"
          ? mergeRecords(previous as DirectoryRecord, entry as DirectoryRecord) : entry);
      }
      merged[key] = [...combined.values()];
    } else if (key === "totalRevenue" && typeof value === "number") {
      merged[key] = Math.max(Number(merged[key]) || 0, value);
    } else if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = value;
    }
  }
  return merged;
}

export function cleanDirectoryDataset(dataset: string, items: unknown[]): unknown[] {
  if (!["clients", "people", "trader-companies"].includes(dataset)) return items;
  const clean = items.filter(item => !isRetiredDirectoryRecord(item)).map(remapOrganisationReferences);
  if (dataset !== "clients") return clean;
  const merged = new Map<string, DirectoryRecord>();
  // Prefer the canonical record's scalar fields, while retaining every linked array item.
  const sorted = [...clean].sort((a, b) => Number(Boolean(aliases[String((a as DirectoryRecord)?.id)])) - Number(Boolean(aliases[String((b as DirectoryRecord)?.id)])));
  for (const item of sorted) {
    if (!item || typeof item !== "object") continue;
    const record = item as DirectoryRecord;
    const id = canonicalOrganisationId(String(record.id));
    const canonical = { ...record, id };
    const previous = merged.get(id);
    merged.set(id, previous ? mergeRecords(previous, canonical) : canonical);
  }
  return [...merged.values()];
}
