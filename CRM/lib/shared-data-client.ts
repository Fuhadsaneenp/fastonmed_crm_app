import { cleanDirectoryDataset } from "@/lib/directory-cleanup";
export const SHARED_BROWSER_DATASETS = {
  clients: "fastonmed_clients",
  people: "fastonmed_people",
  "trader-companies": "fastonmed_companies",
  departments: "fastonmed_departments",
  "connection-types": "fastonmed_connection_types_v1",
  "product-categories": "fastonmed_product_categories",
  "product-brands": "fastonmed_product_brands",
  "deleted-brands": "fastonmed_deleted_brands",
  "service-engineers": "fastonmed_service_engineers_v1",
  "service-types": "fastonmed_service_types_v1",
  products: "fastonmed_products",
  invoices: "fastonmed_zoho_live_invoices",
} as const;

export type SharedBrowserDataset = keyof typeof SHARED_BROWSER_DATASETS;

export async function persistSharedDataset(
  dataset: SharedBrowserDataset,
  data: unknown[],
  replace = false,
  preferExisting = false
): Promise<unknown[]> {
  const response = await fetch(`/api/shared-data/${dataset}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: cleanDirectoryDataset(dataset, data), replace, preferExisting }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !Array.isArray(result.data)) {
    throw new Error(result?.error || `Unable to save ${dataset}`);
  }
  return cleanDirectoryDataset(dataset, result.data);
}

const sharedReads = new Map<SharedBrowserDataset, Promise<unknown[]>>();
export function fetchSharedDataset(dataset: SharedBrowserDataset): Promise<unknown[]> {
  const pending = sharedReads.get(dataset);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(`/api/shared-data/${dataset}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.error || `Unable to load ${dataset}`);
    }
    return cleanDirectoryDataset(dataset, result.data);
  })().finally(() => { sharedReads.delete(dataset); });
  sharedReads.set(dataset, request);
  return request;
}

export async function deleteSharedDatasetItem(
  dataset: SharedBrowserDataset,
  target: { id?: string; value?: string }
): Promise<void> {
  const response = await fetch(`/api/shared-data/${dataset}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
  if (!response.ok) throw new Error(`Unable to delete ${dataset} item`);
}

function sharedItemKey(item: unknown): string {
  if (typeof item === "string") return `string:${item.trim().toLowerCase()}`;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    if (record.id) return `id:${String(record.id)}`;
    if (record.email) return `email:${String(record.email).trim().toLowerCase()}`;
    if (record.name) return `name:${String(record.name).trim().toLowerCase()}`;
  }
  return `json:${JSON.stringify(item)}`;
}

export async function syncAllSharedBrowserData(): Promise<void> {
  if (typeof window === "undefined") return;

  const changedStorageKeys = new Set<string>();
  const entries = Object.entries(SHARED_BROWSER_DATASETS);
  // Keep the initial migration in the background without exhausting the
  // database connection pool (the workspace also loads its own data).
  for (let index = 0; index < entries.length; index += 2) {
    await Promise.all(entries.slice(index, index + 2).map(async ([dataset, storageKey]) => {
      let local: unknown[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) local = cleanDirectoryDataset(dataset, parsed);
      } catch {}

      try {
        // During login migration, database values win for matching records so a
        // stale browser cache cannot overwrite a newer edit from another user.
        // Read first and upload only records absent from the server. This
        // preserves offline additions without rewriting every dataset on each
        // workspace load (especially the large product catalogue).
        const server = await fetchSharedDataset(dataset as SharedBrowserDataset);
        const serverKeys = new Set(server.map(sharedItemKey));
        const missing = local.filter((item) => !serverKeys.has(sharedItemKey(item)));
        const merged = missing.length
          ? await persistSharedDataset(dataset as SharedBrowserDataset, missing, false, true)
          : server;
        const serialized = JSON.stringify(merged);
        if (localStorage.getItem(storageKey) !== serialized) {
          localStorage.setItem(storageKey, serialized);
          changedStorageKeys.add(storageKey);
        }
      } catch (error) {
        console.warn(`Shared database sync failed for ${dataset}:`, error);
      }
    }));
  }

  if (!changedStorageKeys.size) return;
  window.dispatchEvent(new Event("fastonmed_shared_data_synced"));
  const events: Record<string, string> = {
    fastonmed_clients: "fastonmed_clients_updated", fastonmed_people: "fastonmed_people_updated",
    fastonmed_companies: "fastonmed_companies_updated", fastonmed_departments: "fastonmed_departments_updated",
    fastonmed_product_categories: "fastonmed_categories_updated", fastonmed_product_brands: "fastonmed_brands_updated",
    fastonmed_products: "fastonmed_products_updated", fastonmed_zoho_live_invoices: "fastonmed_invoices_updated",
    fastonmed_service_engineers_v1: "fastonmed_engineers_updated", fastonmed_service_types_v1: "fastonmed_service_types_updated",
  };
  for (const storageKey of changedStorageKeys) {
    if (events[storageKey]) window.dispatchEvent(new Event(events[storageKey]));
  }
}
