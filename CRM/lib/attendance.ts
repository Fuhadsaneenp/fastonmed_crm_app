export const ATTENDANCE_TIME_ZONE = 'Asia/Kolkata';
export type AttendanceEntry = { id: string; userId: string; email: string; name: string; role: string; date: string; checkIn: string; checkOut?: string; lastSeen: string; breakStarted?: string; breakSeconds: number };
export function attendanceDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ATTENDANCE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function attendanceTime(value?: string): string {
  return value ? new Date(value).toLocaleTimeString('en-IN', { timeZone: ATTENDANCE_TIME_ZONE, hour: '2-digit', minute: '2-digit' }) : '—';
}
export function workedSeconds(entry: AttendanceEntry, now = new Date()): number {
  const end = new Date(entry.checkOut || entry.breakStarted || (entry.date === attendanceDate(now) ? now.toISOString() : entry.lastSeen)).getTime();
  return Math.max(0, Math.floor((end - new Date(entry.checkIn).getTime()) / 1000) - entry.breakSeconds);
}
export function updateAttendance(entry: AttendanceEntry, action: string, now: string): AttendanceEntry {
  const updated = { ...entry, lastSeen: now };
  if (entry.checkOut) return updated;
  if (action === 'break' && !entry.breakStarted) updated.breakStarted = now;
  if ((action === 'resume' || action === 'checkout') && entry.breakStarted) {
    updated.breakSeconds += Math.max(0, Math.floor((Date.parse(now) - Date.parse(entry.breakStarted)) / 1000));
    delete updated.breakStarted;
  }
  if (action === 'checkout') updated.checkOut = now;
  return updated;
}
