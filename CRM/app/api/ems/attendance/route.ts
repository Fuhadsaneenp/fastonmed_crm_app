import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDbPool } from '@/lib/db';
import { attendanceDate, updateAttendance, type AttendanceEntry } from '@/lib/attendance';
import type { ApiUser } from '@/lib/api-client';
import type { RowDataPacket } from 'mysql2';
export const dynamic = 'force-dynamic';

const identities = new Map<string, { user: ApiUser; expires: number }>();
async function identity(req: NextRequest): Promise<ApiUser | null> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.includes('session-token-')) return null;
  const key = createHash('sha256').update(authorization).digest('hex');
  const cached = identities.get(key);
  if (cached && cached.expires > Date.now()) return cached.user;
  const origin = (process.env.CRM_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.fastonmed.com').replace(/\/$/, '');
  const response = await fetch(`${origin}/api/auth/me`, { headers: { Authorization: authorization }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.success || !data.data?.id || !data.data?.email) return null;
  if (identities.size > 500) identities.clear();
  identities.set(key, { user: data.data, expires: Date.now() + 60000 });
  return data.data;
}
const parse = (value: unknown): AttendanceEntry => typeof value === 'string' ? JSON.parse(value) : value as AttendanceEntry;

export async function GET(req: NextRequest) {
  try {
    const user = await identity(req);
    if (!user) return NextResponse.json({ error: 'Please sign in again to view attendance.' }, { status: 401 });
    const month = req.nextUrl.searchParams.get('month') || attendanceDate().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    const team = req.nextUrl.searchParams.get('team') === 'true';
    const email = (req.nextUrl.searchParams.get('email') || user.email).trim().toLowerCase();
    if ((team || email !== user.email.toLowerCase()) && !/admin|manager|head/i.test(user.role)) return NextResponse.json({ error: 'Team attendance requires manager access.' }, { status: 403 });
    const [rows] = await getDbPool().query<RowDataPacket[]>('SELECT `value` FROM CompanySetting WHERE `key` LIKE ?', [`fastonmed_attendance_%_${month}-%`]);
    const records = rows.map(row => parse(row.value)).filter(record => record.date.startsWith(month) && (team || record.email.toLowerCase() === email));
    return NextResponse.json({ success: true, records }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Attendance read failed:', error);
    return NextResponse.json({ error: 'Attendance database is unavailable. Please retry.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await identity(req);
    if (!user) return NextResponse.json({ error: 'Please sign in again to record attendance.' }, { status: 401 });
    const { action = 'open' } = await req.json();
    if (!['open', 'break', 'resume', 'checkout'].includes(action)) return NextResponse.json({ error: 'Invalid attendance action' }, { status: 400 });
    const now = new Date();
    const date = attendanceDate(now);
    const hash = createHash('sha256').update(user.email.toLowerCase()).digest('hex').slice(0, 24);
    const key = `fastonmed_attendance_${hash}_${date}`;
    const initial: AttendanceEntry = { id: key, userId: user.id, email: user.email, name: user.name, role: user.role, date, checkIn: now.toISOString(), lastSeen: now.toISOString(), breakSeconds: 0 };
    const connection = await getDbPool().getConnection();
    try {
      await connection.beginTransaction();
      const [companies] = await connection.query<RowDataPacket[]>('SELECT id FROM Company ORDER BY createdAt ASC LIMIT 1');
      if (!companies[0]?.id) throw new Error('No company configured');
      await connection.query('INSERT IGNORE INTO CompanySetting (id, companyId, `key`, `value`, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))', [key, companies[0].id, key, JSON.stringify(initial)]);
      const [rows] = await connection.query<RowDataPacket[]>('SELECT `value` FROM CompanySetting WHERE id = ? FOR UPDATE', [key]);
      if (!rows[0]) throw new Error('Attendance row unavailable');
      const record = updateAttendance(parse(rows[0].value), action, now.toISOString());
      await connection.query('UPDATE CompanySetting SET `value` = ?, updatedAt = NOW(3) WHERE id = ?', [JSON.stringify(record), key]);
      await connection.commit();
      return NextResponse.json({ success: true, record }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) {
    console.error('Attendance write failed:', error);
    return NextResponse.json({ error: 'Attendance could not be saved. Please retry.' }, { status: 503 });
  }
}
