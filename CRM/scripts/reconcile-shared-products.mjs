import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const sources = [
  path.join(root, 'Website', 'data', 'products-cache.json'),
  path.join(root, 'Website', 'data', 'products-master-baseline.json'),
  path.join(root, 'CRM', 'data', 'products_store.json')
];

const normalize = (value) => String(value || '').trim().toLowerCase();
const keysFor = (product) => {
  const sku = normalize(product?.sku);
  const slug = normalize(product?.slug);
  const id = normalize(product?.id);
  return [sku && sku !== '—' && sku !== '-' ? `sku:${sku}` : '', slug ? `slug:${slug}` : '', id ? `id:${id}` : ''].filter(Boolean);
};
const timeFor = (product) => {
  const raw = product?.createdAt || product?.wordpressSource?.createdAt || product?.updatedAt;
  const parsed = raw ? new Date(raw).getTime() : 0;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const match = String(product?.id || '').match(/(\d{12,})/);
  return match ? Number(match[1]) : 0;
};

const all = sources.flatMap((file) => {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.products || [];
});
const seen = new Set();
const products = [];
for (const product of all) {
  if (!product?.id) continue;
  const keys = keysFor(product);
  if (keys.some((key) => seen.has(key))) continue;
  keys.forEach((key) => seen.add(key));
  products.push(product);
}
products.sort((a, b) => timeFor(b) - timeFor(a));

const response = await fetch('http://127.0.0.1:3000/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'sync', products })
});
const result = await response.json();
if (!response.ok || !result.success) throw new Error(result.error || `Sync failed (${response.status})`);
console.log(JSON.stringify({ sourceRows: all.length, uniqueProducts: products.length, savedProducts: result.count }));
