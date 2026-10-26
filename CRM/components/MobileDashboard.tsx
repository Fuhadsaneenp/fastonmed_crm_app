"use client";
import LeadReceivedDate from "@/components/LeadReceivedDate";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, ChevronRight, Building2, CalendarDays, Wrench, FileText, Check, Inbox, Receipt, ShieldAlert, Package } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { isDummyLead } from "@/lib/client-store";
import { isDummyTask, normalizeTask } from "@/lib/task-store";
import { getCurrentUser } from "@/lib/task-store";
import { isLegacyExampleOpportunity } from "@/lib/mobile-records";
import type { Client, Lead, Task } from "@/types";


export default function MobileDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [today, setToday] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setStatus("loading");
      setFullName(getCurrentUser()?.name || "");
      const date = new Date();
      setToday(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`);
      try {
        const [live, shared] = await Promise.allSettled([
          Promise.all([apiRequest<Client[]>("/api/clients"), apiRequest<Lead[]>("/api/leads"), apiRequest<Task[]>("/api/tasks")]),
          fetch("/api/mobile-overview", { cache: "no-store", signal: controller.signal }).then(async response => {
            if (!response.ok) throw new Error("CRM unavailable");
            return response.json();
          }),
        ]);
        if (live.status === "rejected" && shared.status === "rejected") throw new Error("CRM unavailable");
        const merge = <T extends { id: string }>(remote: T[], database: T[]): T[] => Array.from(new Map([...remote, ...database].filter(record => record?.id).map(record => [record.id, record])).values());
        const remote = live.status === "fulfilled" ? live.value : [[], [], []];
        const stored = shared.status === "fulfilled" ? shared.value : { clients: [], leads: [], tasks: [] };
        const data = {
          clients: merge<Client>(remote[0] as Client[], stored.clients),
          leads: merge<Lead>(remote[1] as Lead[], stored.leads).filter(lead => !isDummyLead(lead) && !isLegacyExampleOpportunity(lead)),
          tasks: merge<Task>(remote[2] as Task[], stored.tasks).map(normalizeTask).filter((task): task is Task => Boolean(task && !isDummyTask(task))),
        };
        if (controller.signal.aborted) return;
        setLeads(data.leads); setTasks(data.tasks); setStatus("ready");
      } catch {
        if (!controller.signal.aborted) { setLeads([]); setTasks([]); setStatus("error"); }
      }
    };
    void load();
    const update = () => { void load(); };
    const events = ["fastonmed_clients_updated", "fastonmed_leads_updated", "fastonmed_tasks_updated", "fastonmed_user_updated"];
    events.forEach(event => window.addEventListener(event, update));
    return () => { controller.abort(); events.forEach(event => window.removeEventListener(event, update)); };
  }, [refresh]);
  const ready = status === "ready";
  const mine = tasks.filter(task => fullName && task.assignedTo?.trim().toLowerCase() === fullName.trim().toLowerCase());
  const pending = mine.filter(task => !["Completed", "Approved", "Cancelled", "Declined"].includes(task.status));
  const due = pending.filter(task => task.dueDate && task.dueDate <= today).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const activeLeads = leads.filter(lead => !["Won", "Lost", "Lost Deal", "Rejected", "Completed"].includes(lead.stage));
  const followups = activeLeads.filter(lead => lead.nextFollowUp).sort((a,b) => (a.nextFollowUp || "").localeCompare(b.nextFollowUp || "")).slice(0, 3);
  const dateLabel = today ? new Date(`${today}T12:00:00`).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" }) : "Your workspace";
  return <div className="app-home">
    <section className="app-welcome"><p>{dateLabel}</p><h1>{fullName ? `Hello, ${fullName.split(" ")[0]}` : "Your workspace"}<span>Let’s move things forward.</span></h1></section>
    <Link className="app-focus-card" href="/tasks?member=my"><div className="app-focus-top"><span><span className="app-status-dot"/> YOUR DAY</span><ArrowUpRight size={22}/></div><div className="app-focus-number">{ready ? due.length : "—"}<span>tasks need your attention</span></div><div className="app-focus-bottom"><span>{ready ? `${pending.length} open tasks` : status === "loading" ? "Loading your tasks…" : "Tasks unavailable"}</span><span>View my tasks <ChevronRight size={15}/></span></div></Link>
    <section className="app-quick-actions" aria-label="Quick actions"><Link href="/leads?create=1"><span><Plus size={24}/></span>New lead</Link><Link href="/clients"><span><Building2 size={23}/></span>Clients</Link><Link href="/quotations"><span><FileText size={23}/></span>Quotations</Link><Link href="/services"><span><Wrench size={23}/></span>Service</Link><Link href="/calendar" aria-label="Client work calendar"><span><CalendarDays size={23}/></span>Calendar</Link></section>
    {status !== "ready" && <div className="app-data-status" role="status">{status === "loading" ? "Loading live CRM records…" : <>Live CRM data is unavailable. <button type="button" onClick={() => setRefresh(value => value+1)}>Try again</button></>}</div>}
    <div className="app-section-title"><h2>Your workspace</h2></div>
    <section className="app-module-grid" aria-label="CRM shortcuts">
      {[{href:"/enquiries",label:"Website enquiries",description:"Incoming requests",icon:Inbox},{href:"/sales",label:"Invoices & payments",description:"Billing & collections",icon:Receipt},{href:"/product-expiry",label:"Product expiry",description:"Expiry tracking",icon:ShieldAlert},{href:"/products",label:"Product catalogue",description:"Equipment & supplies",icon:Package},{href:"/companies",label:"Trader companies",description:"Procurement partners",icon:Building2},{href:"/services",label:"Service tickets",description:"Service & support",icon:Wrench}].map(item => <Link href={item.href} key={item.href}><span className="app-module-icon"><item.icon size={23}/></span><strong>{item.label}</strong><span>{item.description}</span><ArrowUpRight className="app-module-arrow" size={15}/></Link>)}
    </section>
    <div className="app-section-title"><h2>My tasks</h2><Link href="/tasks?member=my">See all <ChevronRight size={14}/></Link></div>
    <section className="app-work-list app-home-task-list" aria-label="Your upcoming tasks">{!ready ? <div className="app-empty"><p>{status === "loading" ? "Loading your tasks…" : "Unable to load your tasks."}</p></div> : pending.length ? [...due, ...pending.filter(task => task.dueDate > today)].slice(0,3).map(task => <Link href="/tasks?member=my" key={task.id}><span className="app-task-mark"/><span className="app-row-copy"><strong>{task.title}</strong><span>{task.clientName || task.type} · {task.dueDate < today ? "Overdue" : task.dueDate === today ? "Today" : task.dueDate}</span></span><ChevronRight size={17}/></Link>) : <div className="app-empty"><span><Check size={20}/></span><div><strong>You’re all caught up</strong><p>Your assigned tasks will appear here.</p></div></div>}</section>
    <div className="app-section-title"><h2>Follow-ups</h2><Link href="/calendar"><CalendarDays size={18}/><span className="sr-only">Open calendar</span></Link></div>
    <section className="app-work-list app-home-followups" aria-label="Upcoming follow-ups">{!ready ? <div className="app-empty"><p>{status === "loading" ? "Loading follow-ups…" : "Unable to load follow-ups."}</p></div> : followups.length ? followups.map(lead => <Link href="/leads" key={lead.id}><span className="app-client-avatar">{lead.clientName.slice(0,1)}</span><span className="app-row-copy"><strong>{lead.clientName}</strong><LeadReceivedDate lead={lead} /><span className="app-followup-meta">{lead.nextFollowUp && lead.nextFollowUp.split("T")[0] < today && <em>Overdue</em>}{lead.nextFollowUp && new Date(`${lead.nextFollowUp.split("T")[0]}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}<span> · {lead.stage}</span></span></span><ChevronRight size={17}/></Link>) : <div className="app-empty"><CalendarDays size={23}/><div><strong>No scheduled follow-ups</strong><p>Plan your next conversation in Pipeline.</p></div></div>}</section>
  </div>;
}
