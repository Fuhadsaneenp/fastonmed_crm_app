'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { attendanceRequest } from '@/lib/attendance-client';
export default function AttendanceTracker() {
  const path = usePathname();
  useEffect(() => {
    // Local interface previews must not check employees into work.
    if (process.env.NODE_ENV === "development") return;
    if (path === '/app-preview' || path === '/login' || !localStorage.getItem('fastonmed_user')) return;
    let running = false;
    const record = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        await attendanceRequest('', 'open', true);
        window.dispatchEvent(new Event('fastonmed_attendance_updated'));
      } catch (error) { console.error('Automatic attendance check-in failed:', error); }
      finally { running = false; }
    };
    void record();
    const timer = setInterval(record, 60000);
    document.addEventListener('visibilitychange', record);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', record); };
  }, [path]);
  return null;
}
