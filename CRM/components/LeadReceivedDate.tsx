import { CalendarDays } from "lucide-react";

export default function LeadReceivedDate({ lead }: { lead: { leadDate?: string; createdAt?: string } }) {
  const raw = lead.leadDate || lead.createdAt;
  const date = raw ? new Date(raw.length === 10 ? `${raw}T12:00:00` : raw) : null;
  const valid = date && !Number.isNaN(date.getTime());
  return <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 12, lineHeight: 1.5, color: "#64748b", margin: "8px 0" }}>
    <CalendarDays size={14} aria-hidden="true" />
    <span>Lead received:</span>
    {valid ? <time dateTime={raw} style={{ color: "#285947", fontWeight: 600 }}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(date)}</time> : <span>Not recorded</span>}
  </span>;
}
