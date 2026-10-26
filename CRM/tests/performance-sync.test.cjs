const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function compile(file, scope) {
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, scope);
}
test('database pool survives module reloads and retains idle connections', () => {
  const settings = [], global = {};
  const scope = { exports: {}, globalThis: global, process: { env: { DATABASE_URL: 'mysql://test' } }, require: () => ({ createPool(options) { settings.push(options); return {}; } }) };
  compile('lib/db.ts', scope);
  const first = scope.exports.getDbPool();
  const next = { ...scope, exports: {} };
  compile('lib/db.ts', next);
  assert.equal(next.exports.getDbPool(), first);
  assert.equal(settings.length, 1);
  assert.equal(settings[0].maxIdle, settings[0].connectionLimit);
  assert.equal(settings[0].idleTimeout, 600000);
  assert.equal(settings[0].enableKeepAlive, true);
});
test('unchanged workspace sync does not trigger directory reloads', async () => {
  const events = [], storage = new Map();
  const scope = { exports: {}, console, Event: class { constructor(type) { this.type = type; } }, window: { dispatchEvent(event) { events.push(event.type); } },
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    fetch: async () => ({ ok: true, json: async () => ({ success: true, data: [] }) }),
    require: () => ({ cleanDirectoryDataset: (_, rows) => rows }),
  };
  compile('lib/shared-data-client.ts', scope);
  for (const key of Object.values(scope.exports.SHARED_BROWSER_DATASETS)) storage.set(key, '[]');
  await scope.exports.syncAllSharedBrowserData();
  assert.equal(events.length, 0);
  storage.delete('fastonmed_people');
  await scope.exports.syncAllSharedBrowserData();
  assert.deepEqual(events, ['fastonmed_shared_data_synced', 'fastonmed_people_updated']);
});
test('overlapping lead refreshes share one request and unchanged data emits no event', async () => {
  const storage = new Map([['fastonmed_leads', '[]']]), events = [], calls = [];
  const scope = { exports: {}, console, Event: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent(event) { events.push(event.type); } },
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    fetch: () => new Promise(resolve => calls.push(resolve)),
    require: () => ({ getRetiredIds: () => [], filterRetiredRecords: (_, rows) => rows, getZohoLiveQuotes: () => [] }),
  };
  compile('lib/client-store.ts', scope);
  const first = scope.exports.syncLeadsFromServer();
  const second = scope.exports.syncLeadsFromServer();
  assert.equal(first, second);
  assert.equal(calls.length, 1);
  calls[0]({ ok: true, json: async () => ({ leads: [] }) });
  await first;
  assert.equal(events.length, 0);
  const next = scope.exports.syncLeadsFromServer();
  assert.equal(calls.length, 2);
  calls[1]({ ok: true, json: async () => ({ leads: [] }) });
  await next;
});
