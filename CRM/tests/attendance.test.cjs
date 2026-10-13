const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/attendance.ts'), 'utf8');
const sandbox = { exports: {}, Intl, Date };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const { attendanceDate, updateAttendance, workedSeconds } = sandbox.exports;
const entry = () => ({ id: 'day', date: '2026-10-01', checkIn: '2026-10-01T03:30:00Z', lastSeen: '2026-10-01T03:30:00Z', breakSeconds: 0 });
test('India date changes at local midnight, independent of UTC month', () => {
  assert.equal(attendanceDate(new Date('2026-09-30T18:29:59Z')), '2026-09-30');
  assert.equal(attendanceDate(new Date('2026-09-30T18:30:00Z')), '2026-10-01');
  assert.equal(attendanceDate(new Date('2026-12-31T18:30:00Z')), '2027-01-01');
});
test('reopening preserves first check-in and does not end a break', () => {
  const first = entry();
  const onBreak = updateAttendance(first, 'break', '2026-10-01T04:30:00Z');
  const reopened = updateAttendance(onBreak, 'open', '2026-10-01T05:00:00Z');
  assert.equal(reopened.checkIn, first.checkIn);
  assert.equal(reopened.breakStarted, onBreak.breakStarted);
  assert.equal(workedSeconds(reopened, new Date('2026-10-01T05:00:00Z')), 3600);
});
test('resume and checkout deduct breaks once and stop the timer', () => {
  let record = updateAttendance(entry(), 'break', '2026-10-01T04:30:00Z');
  record = updateAttendance(record, 'resume', '2026-10-01T05:00:00Z');
  record = updateAttendance(record, 'resume', '2026-10-01T05:01:00Z');
  assert.equal(record.breakSeconds, 1800);
  record = updateAttendance(record, 'checkout', '2026-10-01T06:30:00Z');
  assert.equal(workedSeconds(record, new Date('2026-10-01T09:00:00Z')), 9000);
  const reopened = updateAttendance(record, 'open', '2026-10-01T10:00:00Z');
  assert.equal(reopened.checkOut, record.checkOut);
});
test('a prior day without checkout stops at its last recorded activity', () => {
  const record = { ...entry(), lastSeen: '2026-10-01T04:30:00Z' };
  assert.equal(workedSeconds(record, new Date('2026-10-02T04:30:00Z')), 3600);
});
test('checkout during a break closes and deducts the break', () => {
  const record = updateAttendance(updateAttendance(entry(), 'break', '2026-10-01T04:30:00Z'), 'checkout', '2026-10-01T05:00:00Z');
  assert.equal(record.breakSeconds, 1800);
  assert.equal(record.breakStarted, undefined);
  assert.equal(workedSeconds(record, new Date('2026-10-01T06:00:00Z')), 3600);
});

function attendanceApi(role = 'Staff') {
  const rows = new Map();
  const query = async (sql, params = []) => {
    if (sql.startsWith('SELECT id FROM Company')) return [[{ id: 'company' }]];
    if (sql.startsWith('INSERT IGNORE')) { if (!rows.has(params[0])) rows.set(params[0], params[3]); return [{}]; }
    if (sql.startsWith('SELECT `value` FROM CompanySetting WHERE id')) return [[{ value: rows.get(params[0]) }]];
    if (sql.startsWith('UPDATE CompanySetting')) { rows.set(params[1], params[0]); return [{}]; }
    if (sql.startsWith('SELECT `value` FROM CompanySetting WHERE `key` LIKE')) return [[...rows.values()].map(value => ({ value }))];
    throw new Error(sql);
  };
  const connection = { query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  const scope = { exports: {}, Date, console, AbortSignal, process: { env: {} },
    fetch: async () => ({ ok: true, json: async () => ({ success: true, data: { id: 'signed-in', email: 'staff@example.com', name: 'Staff', role } }) }),
    require: name => {
      if (name === 'crypto') return require('node:crypto');
      if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
      if (name === '@/lib/db') return { getDbPool: () => ({ query, getConnection: async () => connection }) };
      if (name === '@/lib/attendance') return sandbox.exports;
      throw new Error(name);
    }
  };
  const route = fs.readFileSync(require('node:path').join(__dirname, '../app/api/ems/attendance/route.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, scope);
  const request = (body, authorization = 'Bearer signed-token', search = '') => ({ headers: new Headers(authorization ? { authorization } : {}), nextUrl: new URL('https://crm.example.com/api/ems/attendance' + search), json: async () => body });
  return { route: scope.exports, request, rows };
}
test('attendance requires authentication and records verified identity, preserving one daily check-in', async () => {
  const { route, request, rows } = attendanceApi();
  assert.equal((await route.POST(request({ action: 'open' }, ''))).status, 401);
  assert.equal((await route.POST(request({ action: 'open' }, 'Bearer session-token-staff'))).status, 401);
  assert.equal(rows.size, 0);
  const first = await route.POST(request({ action: 'open', email: 'other@example.com' }));
  const second = await route.POST(request({ action: 'open' }));
  assert.equal(first.data.record.email, 'staff@example.com');
  assert.equal(first.data.record.checkIn, second.data.record.checkIn);
  assert.equal(rows.size, 1);
  assert.equal((await route.GET(request({}, undefined, '?team=true'))).status, 403);
});


test('staff cannot read another employee; managers can read only the selected profile', async () => {
  const staff = attendanceApi();
  assert.equal((await staff.route.GET(staff.request({}, undefined, '?email=another@example.com'))).status, 403);
  const manager = attendanceApi('Operations Manager');
  const date = attendanceDate();
  manager.rows.set('one', JSON.stringify({ ...entry(), date, email: 'one@example.com' }));
  manager.rows.set('two', JSON.stringify({ ...entry(), date, email: 'two@example.com' }));
  const result = await manager.route.GET(manager.request({}, undefined, `?month=${date.slice(0, 7)}&email=two%40example.com`));
  assert.equal(result.status, 200);
  assert.equal(result.data.records.length, 1);
  assert.equal(result.data.records[0].email, 'two@example.com');
  assert.equal(manager.rows.size, 2);
});
