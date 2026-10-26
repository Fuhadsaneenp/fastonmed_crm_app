'use client';
import { attendanceDate, attendanceTime, workedSeconds, ATTENDANCE_TIME_ZONE, type AttendanceEntry } from '@/lib/attendance';

export default function AttendanceCalendar({ records, month, onMonthChange, loading, error, onRetry, onDaySelect, memberName }: {
  memberName?: string; records: AttendanceEntry[]; month: string; onMonthChange: (month: string) => void; loading: boolean; error: string; onRetry: () => void; onDaySelect: (entry: AttendanceEntry) => void;
}) {
  const [year, monthNumber] = month.split('-').map(Number);
  const title = new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const days = new Date(year, monthNumber, 0).getDate();
  const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const today = attendanceDate();
  const previous = (delta: number) => {
    const date = new Date(year, monthNumber - 1 + delta, 1);
    onMonthChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };
  const avgTime = (field: 'checkIn' | 'checkOut') => {
    const values = records.filter(r => r[field]).map(r => {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: ATTENDANCE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(r[field]!)).split(':').map(Number);
      return parts[0] * 60 + parts[1];
    });
    if (!values.length) return '—';
    const minutes = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  };
  const avgHours = records.length ? (records.reduce((sum, entry) => sum + workedSeconds(entry), 0) / records.length / 3600).toFixed(1) : '—';
  return <section className="attendance-overview">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <div><h1 style={{ fontSize: 22, color: '#003649', margin: 0 }}>{memberName ? `${memberName}’s attendance` : 'My attendance'} · {title}</h1><p style={{ color: '#64748b', fontSize: 12 }}>Recorded automatically when {memberName ? "this team member opens" : "you open"} the CRM · India time</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary" onClick={() => previous(-1)} aria-label="Previous month">‹</button><button className="btn btn-secondary" onClick={() => onMonthChange(today.slice(0, 7))}>Today</button><button className="btn btn-secondary" onClick={() => previous(1)} aria-label="Next month">›</button></div>
    </div>
    {error && <p role="alert" style={{ color: '#b45309' }}>{error} <button onClick={onRetry}>Retry</button></p>}
    {loading && <p role="status">Loading attendance…</p>}
    <div className="card attendance-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 20, padding: 24, marginBottom: 24 }}>
      {[['AVG LOGIN', avgTime('checkIn')], ['AVG LOGOUT', avgTime('checkOut')], ['AVG HOURS', avgHours], ['PRESENT', `${records.length} days`]].map(([label, value]) => <div key={label}><div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{label}</div><strong style={{ display: 'block', marginTop: 8, fontSize: 22, color: '#003649' }}>{value}</strong></div>)}
    </div>
    <div className="card attendance-month-card" style={{ padding: 20, overflowX: 'auto' }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(95px,1fr))', gap: 10, minWidth: 735 }}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} style={{ textAlign: 'center', padding: 12, color: '#64748b', fontSize: 12, fontWeight: 600 }}>{day}</div>)}
      {Array.from({ length: offset }, (_, index) => <div key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const entry = records.find(r => r.date === date);
        const isToday = date === today;
        return <button type="button" key={date} onClick={() => entry && onDaySelect(entry)} aria-label={`${date}: ${entry ? "Present, view timestamps" : "No check-in"}`} style={{ textAlign: 'left', font: 'inherit', cursor: entry ? 'pointer' : 'default', minHeight: 115, padding: 12, borderRadius: 12, border: `1px solid ${isToday ? '#0d9488' : entry ? '#b9e6d2' : '#e2e8f0'}`, background: entry ? '#f0fdf4' : '#fafbfc', boxShadow: isToday ? '0 0 0 2px #ccfbf1' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 5 }}><strong style={{ color: '#334155' }}>{day}</strong><span style={{ color: entry ? '#15803d' : '#94a3b8', fontSize: 9, fontWeight: 700 }}>{entry ? 'PRESENT' : isToday ? 'TODAY' : ''}</span></div>
          {entry ? <div style={{ color: '#37634e', fontSize: 10, lineHeight: 1.7, marginTop: 14 }}><div>IN: {attendanceTime(entry.checkIn)}</div><div>OUT: {attendanceTime(entry.checkOut)}</div><div>{(workedSeconds(entry) / 3600).toFixed(1)} hrs {entry.breakStarted ? '· On break' : ''}</div></div> : <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 20 }}>{date > today ? 'Upcoming' : 'No check-in recorded'}</div>}
        </button>;
      })}
    </div></div>
  </section>;
}
