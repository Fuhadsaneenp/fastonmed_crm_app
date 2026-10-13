'use client';
import { useEffect, useRef, useState } from 'react';
import AttendanceCalendar from '@/components/AttendanceCalendar';
import { attendanceRequest } from '@/lib/attendance-client';
import { attendanceDate, attendanceTime, workedSeconds, type AttendanceEntry } from '@/lib/attendance';
import type { Employee } from '@/types';

export default function TeamMemberAttendance({ member, onBack }: { member: Employee; onBack: () => void }) {
  const [month, setMonth] = useState(() => attendanceDate().slice(0, 7));
  const [records, setRecords] = useState<AttendanceEntry[]>([]);
  const [selected, setSelected] = useState<AttendanceEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const detailsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) {
      detailsRef.current?.scrollIntoView({ block: 'nearest' });
      detailsRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setRecords([]);
      setSelected(null);
      try {
        const response = await attendanceRequest(`?month=${month}&email=${encodeURIComponent(member.email)}`);
        if (active) { setRecords(response.records || []); setError(''); }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'Attendance unavailable'); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const refresh = () => setRevision(value => value + 1);
    const timer = setInterval(refresh, 60000);
    window.addEventListener('fastonmed_attendance_updated', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('fastonmed_attendance_updated', refresh); };
  }, [member.email, month, revision]);
  return <section aria-label={`${member.name} attendance`}>
    <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 18 }}>← Back to team</button>
    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 18 }}>{member.role} · {member.department} · {member.email}</p>
    <AttendanceCalendar memberName={member.name} records={records} month={month} onMonthChange={setMonth} loading={loading} error={error} onRetry={() => setRevision(value => value + 1)} onDaySelect={setSelected} />
    {selected && <div ref={detailsRef} tabIndex={-1} className="card" style={{ padding: 24, marginTop: 20 }} role="region" aria-label="Daily attendance timestamps">
      <h3 style={{ color: '#003649', marginTop: 0 }}>{member.name} · {selected.date}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30 }}>
        <div>Check in<strong style={{ display: 'block', marginTop: 6 }}>{attendanceTime(selected.checkIn)}</strong></div>
        <div>Check out<strong style={{ display: 'block', marginTop: 6 }}>{attendanceTime(selected.checkOut)}</strong></div>
        <div>Working hours<strong style={{ display: 'block', marginTop: 6 }}>{(workedSeconds(selected) / 3600).toFixed(1)} hrs</strong></div>
        <div>Break time<strong style={{ display: 'block', marginTop: 6 }}>{Math.round(selected.breakSeconds / 60)} min{selected.breakStarted ? ' · On break' : ''}</strong></div>
      </div>
      <p style={{ color: '#64748b', fontSize: 12 }}>Attendance recorded from CRM activity.</p>
    </div>}
  </section>;
}
