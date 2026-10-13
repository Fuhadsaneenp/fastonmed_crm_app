import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const root = process.cwd();
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const products = JSON.parse(fs.readFileSync(path.join(root, "data", "products_store.json"), "utf8"));
if (!Array.isArray(products) || products.length < 2670) throw new Error("Refusing to sync an incomplete product catalogue");

const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  await connection.beginTransaction();
  const [companies] = await connection.query("SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1");
  if (!companies[0]?.id) throw new Error("No company exists in the CRM database");
  const [current] = await connection.query(
    "SELECT `value` FROM CompanySetting WHERE `key` = ? ORDER BY updatedAt DESC LIMIT 1 FOR UPDATE",
    ["fastonmed_products_v1"]
  );
  const backupDir = path.join(root, "data", "import-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    path.join(backupDir, "database-products.before-wordpress-import.json"),
    JSON.stringify(current[0]?.value ? (typeof current[0].value === "string" ? JSON.parse(current[0].value) : current[0].value) : [], null, 2)
  );
  const now = new Date();
  await connection.query(
    `INSERT INTO CompanySetting (id, companyId, \`key\`, \`value\`, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`,
    ["setting_fastonmed_products_v1", String(companies[0].id), "fastonmed_products_v1", JSON.stringify(products), now, now]
  );
  await connection.commit();
  console.log(JSON.stringify({ success: true, products: products.length }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
