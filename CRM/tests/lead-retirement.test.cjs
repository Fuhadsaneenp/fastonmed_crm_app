const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const retired = require('../config/retired-records.json');
const source = fs.readFileSync(path.join(__dirname, '../lib/retired-records.ts'), 'utf8');
const sandbox = { exports: {}, require: () => retired };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, sandbox);
const { filterRetiredRecords } = sandbox.exports;
const lead = (time, dateOnly = false) => ({ id: `lead-${Date.parse(time)}`, createdAt: dateOnly ? time.slice(0, 10) : time });
test('new manual leads survive filtering immediately and on subsequent reads', () => {
  for (const dateOnly of [false, true]) {
    const record = lead('2026-10-19T19:35:00.000Z', dateOnly);
    const saved = filterRetiredRecords('leads', [record]);
    assert.equal(saved.length, 1);
    assert.equal(filterRetiredRecords('leads', JSON.parse(JSON.stringify(saved)))[0].id, record.id);
  }
});
test('leads created before cleanup stay removed, including legacy date-only leads', () => {
  for (const dateOnly of [false, true]) {
    assert.equal(filterRetiredRecords('leads', [lead('2026-10-19T18:00:00.000Z', dateOnly)]).length, 0);
  }
});
test('explicit retirement still overrides a recent creation time', () => {
  const record = { id: retired.leads[0], createdAt: '2026-10-20T01:00:00.000Z' };
  assert.ok(record.id);
  assert.equal(filterRetiredRecords('leads', [record]).length, 0);
});
