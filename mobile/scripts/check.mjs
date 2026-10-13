import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
assert.equal(config.server.url, 'https://crm.fastonmed.com');
assert.equal(config.appId, 'com.fastonmed.crm');
assert.equal(config.server.cleartext, false);
assert.equal(config.android.allowMixedContent, false);
assert.equal(config.webDir, 'www');
assert.equal(config.server.errorPath, 'offline.html');
assert.ok(!config.server.allowNavigation, 'External sites must not receive the native app bridge.');
for (const file of ['index.html', 'offline.html']) {
  const html = await readFile(new URL(`../www/${file}`, import.meta.url), 'utf8');
  assert.ok(html.includes('https://crm.fastonmed.com'));
  assert.ok(!html.includes('api.fastonmed.com'));
}
for (const platform of ['android/app/src/main/assets', 'ios/App/App']) {
  const native = JSON.parse(await readFile(new URL(`../${platform}/capacitor.config.json`, import.meta.url), 'utf8'));
  assert.equal(native.server.url, config.server.url, `${platform} must load the same live CRM.`);
}
console.log('Verified: Android and iOS target the existing HTTPS CRM; no separate CRM UI, API client, or database.');
