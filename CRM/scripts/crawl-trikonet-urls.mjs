import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SITE_ORIGIN = "https://www.trikonet.com";
const SITEMAP_INDEX = `${SITE_ORIGIN}/sitemap_index.xml`;
const OUTPUT_PATH = resolve("docs/existing-url-map.md");
const MEDIA_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?.*)?$/i;

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<");
}

function extractLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    decodeXml(match[1]),
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "TrikonetMigrationInventory/1.0" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.text();
}

function publicPath(value) {
  const url = new URL(value);
  const path = `${url.pathname}${url.search}`;
  return path || "/";
}

const indexXml = await fetchText(SITEMAP_INDEX);
const sitemapUrls = extractLocations(indexXml);
const discovered = new Map();
const counts = new Map();

for (const sitemapUrl of sitemapUrls) {
  const sitemapXml = await fetchText(sitemapUrl);
  const source = new URL(sitemapUrl).pathname.slice(1);
  const urls = extractLocations(sitemapXml).filter(
    (url) => url.startsWith(SITE_ORIGIN) && !MEDIA_EXTENSION.test(url),
  );

  counts.set(source, urls.length);

  for (const url of urls) {
    const path = publicPath(url);
    if (!discovered.has(path)) discovered.set(path, source);
  }
}

const rows = [...discovered.entries()].sort(([left], [right]) =>
  left.localeCompare(right),
);
const generatedAt = new Date().toISOString();
const summary = [...counts.entries()]
  .map(([source, count]) => `| ${source} | ${count.toLocaleString("en-US")} |`)
  .join("\n");
const urlRows = rows
  .map(([path, source]) => `| ${path} | ${path} | SAME | ${source} |`)
  .join("\n");

const markdown = `# Existing Trikonet URL Map

Generated from the live Trikonet XML sitemap index at ${SITEMAP_INDEX} on ${generatedAt}.

The existing website is the source of truth. Every URL below is expected to remain available at the identical path. A change from \`SAME\` requires an intentional permanent redirect and an update to the centralized redirect map.

## Inventory summary

- Total unique public HTML URLs: ${rows.length.toLocaleString("en-US")}
- Target status: \`SAME\`
- Redirected URLs: 0
- Missing URLs: 0 (inventory target; must be verified against the completed application)

| Sitemap source | URLs |
| --- | ---: |
${summary}

## URL mapping

| OLD URL | NEW URL | STATUS | SOURCE |
| --- | --- | --- | --- |
${urlRows}
`;

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, markdown, "utf8");
console.log(`Wrote ${rows.length} unique URLs to ${OUTPUT_PATH}`);
