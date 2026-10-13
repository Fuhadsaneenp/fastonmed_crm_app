"use client";
import { useState } from "react";
import {
  mockClients, mockLeads, mockServiceTickets,
  mockEmployees, monthlyRevenueData, productSalesData, leadSourceData,
} from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import toast from "react-hot-toast";

const employeeSalesData = mockEmployees
  .filter((e) => e.performance.revenue > 0)
  .map((e) => ({ name: e.name.split(" ")[0], revenue: e.performance.revenue, deals: e.performance.dealsClosed }));

const serviceData = [
  { month: "Apr", resolved: 18, open: 5 },
  { month: "May", resolved: 22, open: 7 },
  { month: "Jun", resolved: 19, open: 4 },
  { month: "Jul", resolved: 28, open: 9 },
  { month: "Aug", resolved: 25, open: 6 },
  { month: "Sep", resolved: 12, open: 5 },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "service" | "marketing" | "customers">("sales");

  const totalRevenue = mockClients.reduce((s, c) => s + c.totalRevenue, 0);
  const totalLeadValue = mockLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const conversionRate = mockLeads.length > 0 ? Math.round((mockLeads.filter((l) => l.stage === "Won").length / mockLeads.length) * 100) : 0;
  const resolvedTickets = mockServiceTickets.filter((t) => t.status === "Completed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
      {/* Header KPIs */}
      <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: "💰", color: "#059669" },
          { label: "Pipeline Value", value: formatCurrency(totalLeadValue), icon: "📊", color: "#2563eb" },
          { label: "Conversion Rate", value: `${conversionRate}%`, icon: "🎯", color: "#7c3aed" },
          { label: "Tickets Resolved", value: resolvedTickets.toString(), icon: "✅", color: "#d97706" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", padding: "0 24px", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            {(["sales", "service", "marketing", "customers"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none", border: "none", padding: "14px 16px",
                  cursor: "pointer", fontSize: 14, fontFamily: "Inter, sans-serif",
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "#2563eb" : "#64748b",
                  borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
                  textTransform: "capitalize",
                }}
              >
                {tab === "sales" ? "💰 Sales" : tab === "service" ? "🔧 Service" : tab === "marketing" ? "📢 Marketing" : "👥 Customers"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
            <button className="btn btn-secondary" onClick={() => toast.success("Report exported to PDF!")}>📄 Export PDF</button>
            <button className="btn btn-secondary" onClick={() => toast.success("Report exported to CSV!")}>📊 Export CSV</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* SALES TAB */}
          {activeTab === "sales" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Monthly Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={monthlyRevenueData}>
                      <defs>
                        <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }} />
                      <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#grad1)" name="Revenue" />
                      <Line type="monotone" dataKey="target" stroke="#0891b2" strokeWidth={2} strokeDasharray="5 4" name="Target" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Lead Sources</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={leadSourceData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {leadSourceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} iconSize={8} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Product-wise Revenue</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={productSalesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="product" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Employee-wise Revenue</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={employeeSalesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }} />
                      <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Employee table */}
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Sales Team Performance</h3>
                <div className="table-container">
                  <table data-mobile-cards="true">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Leads Assigned</th>
                        <th>Deals Closed</th>
                        <th>Conversion Rate</th>
                        <th>Revenue</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockEmployees.filter((e) => e.performance.leadsAssigned > 0).map((e) => (
                        <tr key={e.id}>
                          <td data-label="Employee" style={{ fontWeight: 600 }}>{e.name}</td>
                          <td data-label="Role" style={{ fontSize: 12, color: "#64748b" }}>{e.role}</td>
                          <td data-label="Leads Assigned">{e.performance.leadsAssigned}</td>
                          <td data-label="Deals Closed">{e.performance.dealsClosed}</td>
                          <td data-label="Conversion Rate" style={{ fontWeight: 700, color: "#7c3aed" }}>
                            {Math.round((e.performance.dealsClosed / e.performance.leadsAssigned) * 100)}%
                          </td>
                          <td data-label="Revenue" style={{ fontWeight: 700, color: "#059669" }}>{formatCurrency(e.performance.revenue)}</td>
                          <td data-label="Rating">{"⭐".repeat(Math.floor(e.performance.rating))} {e.performance.rating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SERVICE TAB */}
          {activeTab === "service" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                  { label: "Total Tickets", value: mockServiceTickets.length, color: "#2563eb" },
                  { label: "Resolved", value: resolvedTickets, color: "#059669" },
                  { label: "Open", value: mockServiceTickets.filter((t) => !["Completed", "Closed"].includes(t.status)).length, color: "#f97316" },
                  { label: "Avg Resolution", value: "2.4 days", color: "#7c3aed" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#f8fafc", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Monthly Ticket Resolution Trend</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={serviceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }} />
                    <Bar dataKey="resolved" fill="#059669" name="Resolved" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="open" fill="#f97316" name="Open" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Service Tickets Summary</h3>
                <div className="table-container">
                  <table data-mobile-cards="true">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Client</th>
                        <th>Equipment</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Engineer</th>
                        <th>Created</th>
                        <th>Resolved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockServiceTickets.map((t) => (
                        <tr key={t.id}>
                          <td data-label="Ticket" style={{ fontFamily: "monospace", fontSize: 11 }}>{t.ticketNumber}</td>
                          <td data-label="Client" style={{ fontWeight: 600, fontSize: 12 }}>{t.clientName}</td>
                          <td data-label="Equipment" style={{ fontSize: 12 }}>{t.equipment}</td>
                          <td data-label="Priority">
                            <span style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                              background: t.priority === "Critical" ? "#fee2e2" : t.priority === "High" ? "#fed7aa" : "#d1fae5",
                              color: t.priority === "Critical" ? "#dc2626" : t.priority === "High" ? "#f97316" : "#059669",
                            }}>{t.priority}</span>
                          </td>
                          <td data-label="Status" style={{ fontSize: 12 }}>{t.status}</td>
                          <td data-label="Engineer" style={{ fontSize: 12 }}>{t.assignedEngineerName}</td>
                          <td data-label="Created" style={{ fontSize: 11 }}>{t.createdAt}</td>
                          <td data-label="Resolved" style={{ fontSize: 11 }}>{t.resolvedAt || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MARKETING TAB */}
          {activeTab === "marketing" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Leads by Source</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={leadSourceData} cx="50%" cy="45%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                        {leadSourceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>ROI by Channel</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { channel: "Meta Ads", spend: 62250, leads: 85, roi: 340 },
                      { channel: "Google Ads", spend: 72900, leads: 85, roi: 280 },
                      { channel: "Referral", spend: 0, leads: 32, roi: 9999 },
                      { channel: "Exhibition", spend: 50000, leads: 12, roi: 120 },
                    ].map((r) => (
                      <div key={r.channel}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{r.channel}</span>
                          <span style={{ fontWeight: 700, color: "#059669" }}>
                            {r.roi === 9999 ? "∞" : `${r.roi}%`} ROI
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                          <span>Spend: {r.spend > 0 ? formatCurrency(r.spend) : "AED 0"}</span>
                          <span>Leads: {r.leads}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min(100, r.roi / 40)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMERS TAB */}
          {activeTab === "customers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                  { label: "Total Clients", value: mockClients.length, color: "#2563eb" },
                  { label: "Existing Customers", value: mockClients.filter((c) => c.status === "Existing Customer").length, color: "#059669" },
                  { label: "Active Leads", value: mockClients.filter((c) => c.status === "Lead").length, color: "#d97706" },
                  { label: "Avg Lifetime Value", value: formatCurrency(Math.round(mockClients.reduce((s, c) => s + c.totalRevenue, 0) / Math.max(1, mockClients.filter((c) => c.totalRevenue > 0).length))), color: "#7c3aed" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#f8fafc", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Top Clients by Revenue</h3>
                <div className="table-container">
                  <table data-mobile-cards="true">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>City</th>
                        <th>Status</th>
                        <th>Total Revenue</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...mockClients].sort((a, b) => b.totalRevenue - a.totalRevenue).map((c, i) => (
                        <tr key={c.id}>
                          <td data-label="#" style={{ fontWeight: 700, color: "#94a3b8", fontSize: 13 }}>#{i + 1}</td>
                          <td data-label="Client" style={{ fontWeight: 600 }}>{c.name}</td>
                          <td data-label="Type" style={{ fontSize: 12, color: "#64748b" }}>{c.orgType}</td>
                          <td data-label="City" style={{ fontSize: 12 }}>{c.city}</td>
                          <td data-label="Status">
                            <span style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                              background: c.status === "Existing Customer" ? "#d1fae5" : c.status === "Prospect" ? "#ede9fe" : "#dbeafe",
                              color: c.status === "Existing Customer" ? "#059669" : c.status === "Prospect" ? "#7c3aed" : "#2563eb",
                            }}>{c.status}</span>
                          </td>
                          <td data-label="Total Revenue" style={{ fontWeight: 700, color: "#059669" }}>{formatCurrency(c.totalRevenue)}</td>
                          <td data-label="Source" style={{ fontSize: 12, color: "#64748b" }}>{c.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
