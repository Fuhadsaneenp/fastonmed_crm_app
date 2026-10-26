const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const calls = [];
  const scope = { exports: {}, console, fetch: (url) => new Promise(resolve => calls.push({ url, resolve })), require: () => ({ cleanDirectoryDataset: (_, rows) => rows }) };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/shared-data-client.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  return { read: scope.exports.fetchSharedDataset, calls };
}
test('overlapping readers share one request; a later read gets fresh server data', async () => {
  const { read, calls } = harness();
  const first = read('clients'), second = read('clients');
  assert.equal(calls.length, 1);
  calls[0].resolve({ ok: true, json: async () => ({ success: true, data: [{ id: 'first' }] }) });
  assert.equal((await first)[0].id, 'first');
  assert.equal((await second)[0].id, 'first');
  const fresh = read('clients');
  assert.equal(calls.length, 2);
  calls[1].resolve({ ok: true, json: async () => ({ success: true, data: [{ id: 'updated' }] }) });
  assert.equal((await fresh)[0].id, 'updated');
});
test('failed shared requests do not prevent retrying', async () => {
  const { read, calls } = harness();
  const failed = read('products');
  calls[0].resolve({ ok: false, json: async () => ({ success: false, error: 'Unavailable' }) });
  await assert.rejects(failed, /Unavailable/);
  const retry = read('products');
  assert.equal(calls.length, 2);
  calls[1].resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
  assert.equal((await retry).length, 0);
});
