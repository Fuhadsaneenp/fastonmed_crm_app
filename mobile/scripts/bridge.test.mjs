import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const script = await readFile(new URL('../native/crm-mobile-bridge.js', import.meta.url), 'utf8');
function setup(origin = 'https://crm.fastonmed.com') {
  const messages = [];
  const alerts = [];
  const objects = new Map();
  let sequence = 0;
  class Anchor { constructor() { this.href = ''; this.download = ''; } click() { this.clicked = true; } }
  class Reader { readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = `data:text/csv;base64,${Buffer.from(buffer).toString('base64')}`; this.onload(); }); } }
  const window = { FastonMedNative: { postMessage: payload => messages.push(JSON.parse(payload)) } };
  const context = { window, location: { origin }, HTMLAnchorElement: Anchor, FileReader: Reader, Map, URL: { createObjectURL: blob => { const url = `blob:sample-${++sequence}`; objects.set(url, blob); return url; }, revokeObjectURL: url => objects.delete(url) }, document: { addEventListener() {} }, alert: message => alerts.push(message), fetch: async url => { const blob = objects.get(url); if (!blob) throw Error('revoked'); return { blob: async () => blob }; } };
  vm.runInNewContext(script, context);
  return { context, Anchor, window, messages, alerts };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('export from a detached anchor survives immediate URL revocation', async () => {
  const app = setup();
  const anchor = new app.Anchor(); anchor.download = 'expiry.csv';
  anchor.href = app.context.URL.createObjectURL(new Blob(['name,value\nMonitor,42'], { type: 'text/csv' }));
  anchor.click(); app.context.URL.revokeObjectURL(anchor.href); await flush();
  assert.equal(app.messages[0].action, 'save'); assert.equal(app.messages[0].name, 'expiry.csv');
  assert.equal(Buffer.from(app.messages[0].data, 'base64').toString(), 'name,value\nMonitor,42');
  assert.equal(app.alerts.length, 0);
});
test('quotation print requests the native print dialog', () => {
  const app = setup(); app.window.print(); assert.equal(app.messages[0].action, 'print');
});
test('unrelated origins cannot install mobile hooks', () => {
  const app = setup('https://other.example'); assert.equal(app.window.__fastonmedMobileReady, undefined); assert.equal(app.window.print, undefined);
});
test('normal CRM links keep normal navigation', () => {
  const app = setup(); const anchor = new app.Anchor(); anchor.href = 'https://crm.fastonmed.com/tasks'; anchor.click(); assert.equal(anchor.clicked, true); assert.equal(app.messages.length, 0);
});
test('large exports explain how to recover instead of starting a native save', async () => {
  const app = setup(); const anchor = new app.Anchor(); anchor.download = 'large.csv'; anchor.href = app.context.URL.createObjectURL(new Blob([new Uint8Array(21 * 1024 * 1024)])); anchor.click(); await flush(); assert.equal(app.messages.length, 0); assert.match(app.alerts[0], /20 MB/);
});
