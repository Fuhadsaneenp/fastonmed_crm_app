"use client";
import "./reports.css";
import { useEffect, useRef, useState } from "react";
import { getZohoLiveInvoices } from "@/lib/zoho-live-invoices";
import { getStoredLeads } from "@/lib/client-store";
import { getStoredServiceTickets } from "@/lib/service-store";
import { formatCurrency } from "@/lib/utils";
import type { Invoice, Lead, ServiceTicket } from "@/types";
import { RefreshCw, Download, Printer, ArrowUpRight, Wallet, CircleDollarSign, Clock, Target } from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [tab, setTab] = useState("sales");
  const [updated, setUpdated] = useState("");
  const refreshInFlight = useRef(false);
  const refresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setLoading(true); setError("");
    const read = async <T,>(url: string, field: string): Promise<T[]> => {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Report data refresh failed");
      const result = await response.json();
      const records = result[field] || result.data;
      if (!Array.isArray(records)) throw new Error("Invalid report response");
      return records;
    };
    try {
      // Reports only reads records; no sync writes or task-generation events.
      const results = await Promise.allSettled([
        read<Invoice>("/api/invoices?sync=0", "invoices").then(setInvoices),
        read<Lead>("/api/leads", "leads").then(setLeads),
        read<ServiceTicket>("/api/services", "tickets").then(setTickets),
      ]);
      if (results.some(result => result.status === "rejected")) setError("Some records could not refresh. Cached data remains visible. Tap refresh to retry.");
      else setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  };
  useEffect(() => {
    setInvoices(getZohoLiveInvoices()); setLeads(getStoredLeads()); setTickets(getStoredServiceTickets());
    void refresh();
    const invoiceUpdate = () => setInvoices(getZohoLiveInvoices());
    const leadUpdate = () => setLeads(getStoredLeads());
    const serviceUpdate = () => setTickets(getStoredServiceTickets());
    window.addEventListener("fastonmed_invoices_updated", invoiceUpdate);
    window.addEventListener("fastonmed_leads_updated", leadUpdate);
    window.addEventListener("fastonmed_services_updated", serviceUpdate);
    return () => { window.removeEventListener("fastonmed_invoices_updated", invoiceUpdate); window.removeEventListener("fastonmed_leads_updated", leadUpdate); window.removeEventListener("fastonmed_services_updated", serviceUpdate); };
  }, []);
  const inPeriod = (date: string) => {
    if (period === "all") return true;
    const parsed = new Date(date); const today = new Date();
    return parsed.getFullYear() === today.getFullYear() && (period === "year" || parsed.getMonth() === today.getMonth());
  };
  const valid = invoices.filter(invoice => !["draft", "void", "cancelled", "canceled"].includes(invoice.status.toLowerCase()) && inPeriod(invoice.createdAt));
  const revenue = valid.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const balance = (invoice: Invoice) => Math.min(Number(invoice.amount || 0), Math.max(0, Number(invoice.balanceDue ?? (invoice.status.toLowerCase() === "paid" ? 0 : invoice.amount))));
  const outstanding = valid.reduce((sum, invoice) => sum + balance(invoice), 0);
  const currentLeads = leads.filter(lead => inPeriod(lead.leadDate || lead.createdAt));
  const openLeads = currentLeads.filter(lead => !["Won", "Lost"].includes(lead.stage));
  const pipeline = openLeads.reduce((sum, lead) => sum + Number(lead.estimatedValue || 0), 0);
  const months = Array.from({length: 6}, (_, index) => {
    const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - 5 + index);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
    return { key, name: date.toLocaleDateString("en", { month: "short" }), value: valid.filter(invoice => invoice.createdAt?.startsWith(key)).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0) };
  });
  const max = Math.max(1, ...months.map(month => month.value));
  const clients = new Map<string, {name: string; total: number; count: number}>();
  for (const invoice of valid) { const key = invoice.clientId || invoice.clientName; const current = clients.get(key) || {name: invoice.clientName, total: 0, count: 0}; current.total += Number(invoice.amount || 0); current.count++; clients.set(key,current); }
  const topClients = [...clients.values()].sort((a,b)=>b.total-a.total);
  const exportCsv = () => {
    const quote = (value: unknown) => { const text = String(value ?? ""); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"','""')}"`; };
    const rows = [["Invoice", "Customer", "Invoice date", "Status", "Amount AED", "Outstanding AED"], ...valid.map(invoice => [invoice.invoiceNumber, invoice.clientName, invoice.createdAt, invoice.status, invoice.amount, balance(invoice)])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row=>row.map(quote).join(",")).join("\r\n")], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download="fastonmed-invoice-report.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="reports-page">
    <div className="reports-heading"><div><h1>Business overview</h1><p>Invoice, payment and operations reports</p></div><button onClick={()=>void refresh()} disabled={loading} aria-label="Refresh reports"><RefreshCw size={17} className={loading ? "animate-spin" : ""}/></button></div>
    <div className="reports-controls"><label>Reporting period<select value={period} onChange={event=>setPeriod(event.target.value)}><option value="all">All time</option><option value="month">This month</option><option value="year">This year</option></select></label><span role="status">{loading ? "Updating records…" : updated ? `Updated ${updated}` : "Cached records"}</span></div>
    {error && <p className="reports-notice" role="alert">{error}</p>}
    <div className="reports-metrics">{[
      {label:"Invoiced sales",value:revenue,Icon:CircleDollarSign,note:`${valid.length} issued invoices`},
      {label:"Collected",value:revenue-outstanding,Icon:Wallet,note:"Invoice amount less balance"},
      {label:"Outstanding",value:outstanding,Icon:Clock,note:"Balance on selected invoices"},
      {label:"Open pipeline",value:pipeline,Icon:Target,note:`${openLeads.length} active opportunities`},
    ].map(({label,value,Icon,note})=><div className="reports-metric" key={label}><div><span>{label}</span><Icon size={17}/></div><strong>{formatCurrency(value)}</strong><small>{note}</small></div>)}</div>
    <p className="reports-source">Sales use the same Zoho invoice records as Invoice & Payment. Draft and void invoices are excluded. Amounts are shown as recorded in AED.</p>
    <div className="reports-tabs" role="tablist" aria-label="Report section">{["sales","service","customers"].map(value=><button role="tab" aria-selected={tab===value} key={value} onClick={()=>setTab(value)}>{value}</button>)}</div>
    {tab==="sales" && <><section className="report-panel"><div className="report-panel-heading"><h2>Monthly invoiced sales</h2><span>Last 6 months</span></div>{revenue===0 ? <p className="report-empty">{loading ? "Loading invoice records…" : "No issued invoices in this period."}</p> : <div className="report-bars" aria-label="Monthly invoiced sales">{months.map(month=><div className="report-bar-column" key={month.key}><span>{formatCurrency(month.value)}</span><div className="report-bar-track"><div style={{height:`${month.value/max*100}%`}}/></div><small>{month.name}</small></div>)}</div>}</section><div className="reports-exports"><button onClick={exportCsv}><Download size={15}/> Export invoices CSV</button><button onClick={()=>window.print()}><Printer size={15}/> Print / PDF</button></div><Link className="report-link" href="/sales">View invoices & payments <ArrowUpRight size={16}/></Link></>}
    {tab==="customers" && <section className="report-panel"><h2>Customers by invoiced sales</h2>{!topClients.length && <p className="report-empty">No customers with issued invoices in this period.</p>}{topClients.slice(0,20).map((client,index)=><div className="report-list-row" key={index}><div><strong>{client.name}</strong><small>{client.count} invoices</small></div><b>{formatCurrency(client.total)}</b></div>)}</section>}
    {tab==="service" && <section className="report-panel"><h2>Service performance</h2><p className="reports-source">Tickets created in the selected reporting period.</p>{["Open", "Completed"].map(status=><div className="report-list-row" key={status}><strong>{status} tickets</strong><b>{tickets.filter(ticket=>inPeriod(ticket.createdAt) && (status==="Completed" ? ["Completed","Closed","Resolved"].includes(ticket.status) : !["Completed","Closed","Resolved"].includes(ticket.status))).length}</b></div>)}<Link className="report-link" href="/services">Open service management <ArrowUpRight size={16}/></Link></section>}
  </div>;
}
