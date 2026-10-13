import { ensureValidAuthToken } from '@/lib/api-client';
import type { AttendanceEntry } from '@/lib/attendance';
export async function attendanceRequest(path = '', action?: string, actualUser = false): Promise<{ records?: AttendanceEntry[]; record?: AttendanceEntry }> {
  let token: string | null = null;
  if (actualUser) {
    const original = localStorage.getItem('originalAdminSession');
    if (original) {
      token = JSON.parse(original).token;
      if (!token) throw new Error('Original account session is unavailable.');
    }
  }
  token ||= await ensureValidAuthToken();
  const response = await fetch(`/api/ems/attendance${path}`, {
    method: action ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: action ? JSON.stringify({ action }) : undefined,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Attendance unavailable');
  return data;
}
