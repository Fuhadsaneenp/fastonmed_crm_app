import { getDbPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

export const SHARED_DATASETS = {
  clients: "fastonmed_clients_v2",
  people: "fastonmed_people_v1",
  "trader-companies": "fastonmed_trader_companies_v1",
  departments: "fastonmed_departments_v1",
  "connection-types": "fastonmed_connection_types_v1",
  "product-categories": "fastonmed_product_categories_v1",
  "product-brands": "fastonmed_product_brands_v1",
  "deleted-brands": "fastonmed_deleted_brands_v1",
  "service-engineers": "fastonmed_service_engineers_v1",
  "service-types": "fastonmed_service_types_v1",
  products: "fastonmed_products_v1",
  "website-pages": "fastonmed_website_pages_v1",
  "website-posts": "fastonmed_website_posts_v1",
  "website-post-categories": "fastonmed_website_post_categories_v1",
  invoices: "fastonmed_invoices_v1",
} as const;

export type SharedDataset = keyof typeof SHARED_DATASETS;

export function isSharedDataset(value: string): value is SharedDataset {
  return Object.prototype.hasOwnProperty.call(SHARED_DATASETS, value);
}

async function getCompanyId(): Promise<string> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1");
  if (!rows[0]?.id) throw new Error("No company exists for shared CRM storage");
  return String(rows[0].id);
}

export async function readSharedData(dataset: SharedDataset): Promise<unknown[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1",
    [SHARED_DATASETS[dataset]]
  );
  if (!rows[0]?.value) return [];

  const parsed = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
  return Array.isArray(parsed) ? parsed : [];
}

function itemKey(item: unknown): string {
  if (typeof item === "string") return `string:${item.trim().toLowerCase()}`;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    if (record.id) return `id:${String(record.id)}`;
    if (record.email) return `email:${String(record.email).trim().toLowerCase()}`;
    if (record.name) return `name:${String(record.name).trim().toLowerCase()}`;
  }
  return `json:${JSON.stringify(item)}`;
}

export function mergeSharedData(current: unknown[], incoming: unknown[]): unknown[] {
  const merged = new Map<string, unknown>();
  for (const item of current) merged.set(itemKey(item), item);
  for (const item of incoming) {
    const key = itemKey(item);
    const existing = merged.get(key);
    if (existing && typeof existing === "object" && typeof item === "object" && existing && item) {
      merged.set(key, { ...(existing as object), ...(item as object) });
    } else {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values());
}

export async function writeSharedData(dataset: SharedDataset, data: unknown[]): Promise<void> {
  const pool = getDbPool();
  const companyId = await getCompanyId();
  const key = SHARED_DATASETS[dataset];
  const id = `setting_${key}`;
  const now = new Date();
  await pool.query(
    `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
    [id, companyId, key, JSON.stringify(data), now, now]
  );
}

export async function updateSharedData(
  dataset: SharedDataset,
  updater: (current: unknown[]) => unknown[]
): Promise<unknown[]> {
  const pool = getDbPool();
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [companyRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1"
    );
    if (!companyRows[0]?.id) throw new Error("No company exists for shared CRM storage");

    const key = SHARED_DATASETS[dataset];
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1 FOR UPDATE",
      [key]
    );
    let current: unknown[] = [];
    if (rows[0]?.value) {
      const parsed = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
      if (Array.isArray(parsed)) current = parsed;
    }

    const data = updater(current);
    const now = new Date();
    await connection.query(
      `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
      [`setting_${key}`, String(companyRows[0].id), key, JSON.stringify(data), now, now]
    );
    await connection.commit();
    return data;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
