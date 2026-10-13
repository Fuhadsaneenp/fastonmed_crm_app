"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Building2,
  TrendingUp,
  DollarSign,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Users,
  ArrowUpRight,
  Activity,
  Plus,
  ChevronRight,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  Layers,
  Hospital,
  ArrowRight,
  CheckSquare2,
} from "lucide-react";
import {
  mockClients,
  mockLeads,
  mockServiceTickets,
  mockAMCContracts,
  monthlyRevenueData,
  leadSourceData,
  pipelineData,
} from "@/lib/mock-data";
import { formatCurrency, getStatusColor } from "@/lib/utils";
import { getStoredClients, syncLiveClientsFromApi, getStoredLeads, syncLeadsFromServer } from "@/lib/client-store";
import type { Client, Lead } from "@/types";
import MobileDashboard from "@/components/MobileDashboard";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  color: string;
  bgColor: string;
  trend?: { value: number; label: string };
  href?: string;
  badge?: string;
}

function ModernMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  bgColor,
  trend,
  href,
  badge,
}: MetricCardProps) {
  const content = (
    <div
      className="card hover-lift"
      style={{
        padding: "12px 14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: 10,
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        cursor: href ? "pointer" : "default",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={title}
        >
          {title}
        </span>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            backgroundColor: bgColor,
            color: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={13} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#002735",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: color,
              backgroundColor: bgColor,
              padding: "1px 5px",
              borderRadius: 4,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            color: "#64748b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={subtitle}
        >
          {subtitle}
        </span>
        {trend && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#059669",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            ↑ {trend.value}%
          </span>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
      {content}
    </Link>
  ) : (
    content
  );
}

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    // 1. Get logged in user name
    try {
      const storedUser = localStorage.getItem("fastonmed_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.name) setUserName(parsed.name.split(" ")[0]);
      }
    } catch {}

    if (window.innerWidth < 768) return;

    // 2. Load stored & live clients
    const cached = getStoredClients();
    if (cached && cached.length > 0) {
      setClients(cached);
    }
    syncLiveClientsFromApi().then((data) => {
      if (data && data.length > 0) {
        setClients(data);
      }
    });

    // 3. Load leads & synchronize from server
    const storedLeads = getStoredLeads();
    setLeads(storedLeads);
    syncLeadsFromServer().then((syncd) => {
      if (syncd && syncd.length > 0) {
        setLeads(syncd);
      }
    });
  }, []);

  // 1. Real Facilities Breakdown (Live from loaded client registry)
  const totalFacilities = clients.length;
  const hospitalCount = useMemo(() => {
    const count = clients.filter((c) => c.orgType === "Hospital").length;
    return count;
  }, [clients]);
  const clinicCount = useMemo(() => {
    const count = clients.filter((c) => ["Clinic", "Diagnostic Centre", "Day Surgery Centre", "Pharmacy"].includes(c.orgType)).length;
    return count;
  }, [clients]);
  const traderCount = useMemo(() => {
    const count = clients.filter((c) => c.orgType === "Medical Equipment Trader").length;
    return count;
  }, [clients]);

  // 2. Active Deals Pipeline Value
  const activeLeads = useMemo(() => {
    return leads.filter((l) => l && !["Won", "Lost", "Rejected"].includes(l.stage));
  }, [leads]);

  const activePipelineValue = useMemo(() => {
    const sum = activeLeads.reduce((acc: number, l: Lead) => acc + (l.estimatedValue || l.quotationValue || 0), 0);
    return sum;
  }, [activeLeads]);

  const activeDealsCount = activeLeads.length;

  // 3. Realized Revenue
  const totalRealizedRevenue = useMemo(() => {
    const clientRev = clients.reduce((acc: number, c: Client) => acc + (c.totalRevenue || 0), 0);
    const wonLeadsRev = leads.filter((l: Lead) => l.stage === "Won").reduce((acc: number, l: Lead) => acc + (l.estimatedValue || 0), 0);
    const total = clientRev + wonLeadsRev;
    return total;
  }, [clients, leads]);

  // 4. Biomedical Services
  const activeTicketsCount = useMemo(() => {
    const open = mockServiceTickets.filter((t) => !["Completed", "Closed"].includes(t.status)).length;
    return open;
  }, []);

  const criticalTicketsCount = useMemo(() => {
    return mockServiceTickets.filter((t) => t.priority === "Critical" && !["Completed", "Closed"].includes(t.status)).length;
  }, []);

  // 5. Maintenance Contracts
  const activeAMCsCount = useMemo(() => {
    const count = mockAMCContracts.filter((c) => c.status === "Active").length;
    return count;
  }, []);

  const expiringAMCsCount = useMemo(() => {
    const count = mockAMCContracts.filter((c) => c.status === "Expiring Soon").length;
    return count;
  }, []);

  // 6. Conversion Rate
  const conversionRate = useMemo(() => {
    const wonCount = leads.filter((l) => l.stage === "Won").length;
    const closedCount = leads.filter((l) => ["Won", "Lost"].includes(l.stage)).length;
    if (closedCount > 0) {
      return ((wonCount / closedCount) * 100).toFixed(1);
    }
    return "0.0";
  }, [leads]);

  const realTeam: {name:string;role:string;dept:string;deals:string;revenue:string;rating:number;avatarBg:string}[] = [];

  const recentHospitalActivity: {hospital:string;city:string;event:string;time:string;value:string;badge:string;badgeBg:string;badgeColor:string}[] = [];

  const equipmentCategories: {name:string;value:number;color:string}[] = [];

  return (
    <>
    <MobileDashboard />
    <div className="dashboard-desktop" style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.25s ease" }}>
      {/* ================= 1. SLIM EXECUTIVE COMMAND BAR ================= */}
      <div
        style={{
          background: "linear-gradient(135deg, #002735 0%, #004054 60%, #004d66 100%)",
          borderRadius: 12,
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          color: "#ffffff",
          boxShadow: "0 4px 14px -3px rgba(0, 39, 53, 0.25)",
        }}
      >
        {/* Left: Live indicator, greeting & context */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 7px",
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: "rgba(66,182,156,0.2)",
                color: "#42b69c",
                border: "1px solid rgba(66,182,156,0.35)",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#42b69c" }} />
              LIVE
            </span>
            <h1 style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}>
              Good afternoon, {userName}! 👋
            </h1>
          </div>

          <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>

          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Tracking <strong style={{ color: "#ffffff" }}>{totalFacilities} Healthcare Facilities</strong> in Dubai & Abu Dhabi
          </span>
        </div>

        {/* Right: Quick Action Shortcuts & Key Telemetry */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: 7,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: 11.5,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "#94a3b8" }}>Realized:</span>
            <strong style={{ color: "#ffffff" }}>AED {(totalRealizedRevenue / 1000000).toFixed(2)}M</strong>
            <span style={{ color: "#42b69c", fontSize: 10.5, fontWeight: 700 }}></span>
          </div>

          <div
            style={{
              padding: "4px 10px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: 7,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: 11.5,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "#94a3b8" }}>Pipeline:</span>
            <strong style={{ color: "#60a5fa" }}>AED {(activePipelineValue / 1000000).toFixed(2)}M</strong>
            <span style={{ color: "#94a3b8", fontSize: 10.5 }}>({activeDealsCount} RFQs)</span>
          </div>

          <Link
            href="/leads"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 11px",
              backgroundColor: "#42b69c",
              color: "#002735",
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 700,
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
          >
            <Plus size={12} />
            <span>New Lead</span>
          </Link>

          <Link
            href="/tasks"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 11px",
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "#ffffff",
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.15)",
              transition: "all 0.15s ease",
            }}
          >
            <CheckSquare2 size={12} />
            <span>Tasks</span>
          </Link>
        </div>
      </div>

      {/* ================= 2. HIGH-DENSITY 6-KPI METRIC GRID ================= */}
      <div data-mobile-grid="metrics"
        className="kpi-metric-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
        }}
      >
        <ModernMetricCard
          title="Facilities"
          value={totalFacilities}
          subtitle={`${hospitalCount} Hosp · ${clinicCount} Clin`}
          icon={Building2}
          color="#059669"
          bgColor="#ecfdf5"
          href="/clients"
        />

        <ModernMetricCard
          title="Deals Pipeline"
          value={`AED ${(activePipelineValue / 1000000).toFixed(2)}M`}
          subtitle={`${activeDealsCount} Hospital Tenders`}
          icon={TrendingUp}
          color="#4f46e5"
          bgColor="#eef2ff"
          href="/leads"
        />

        <ModernMetricCard
          title="Realized Revenue"
          value={`AED ${(totalRealizedRevenue / 1000000).toFixed(2)}M`}
          subtitle="Recorded invoices"
          icon={DollarSign}
          color="#0284c7"
          bgColor="#f0f9ff"
          href="/sales"
        />

        <ModernMetricCard
          title="Biomedical"
          value={activeTicketsCount}
          subtitle={`${criticalTicketsCount} ICU Critical`}
          icon={Wrench}
          color="#d97706"
          bgColor="#fffbeb"
          badge="Active"
          href="/services"
        />

        <ModernMetricCard
          title="Contracts"
          value={activeAMCsCount}
          subtitle={`${expiringAMCsCount} Due this month`}
          icon={ShieldCheck}
          color="#7c3aed"
          bgColor="#f5f3ff"
          badge="AMC"
          href="/maintenance-contracts"
        />

        <ModernMetricCard
          title="Conversion"
          value={`${conversionRate}%`}
          subtitle="Won to delivered"
          icon={CheckCircle2}
          color="#10b981"
          bgColor="#ecfdf5"
          href="/reports"
        />
      </div>

      {/* ================= 3. CORE OPERATIONAL INTELLIGENCE ================= */}
      <div data-mobile-grid="stack" className="dashboard-split-grid" style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 14 }}>
        {/* Left Column: Revenue Pacing & Live Hospital Engagements */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Monthly Revenue vs Target Area Chart */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#002735", margin: 0 }}>
                  Equipment Revenue vs Target (AED)
                </h3>
                <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0 0" }}>
                  Live delivery revenue pacing against FY 2026-27 targets
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#004d66",
                  backgroundColor: "#eaf8f4",
                  padding: "3px 8px",
                  borderRadius: 6,
                }}
              >
                No target data available
              </span>
            </div>

            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={monthlyRevenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004d66" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#004d66" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tgtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#42b69c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#42b69c" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10.5, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: unknown) => [formatCurrency(v as number), ""]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.06)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#004d66" strokeWidth={2.5} fill="url(#revGrad)" name="Delivered Revenue" />
                <Area type="monotone" dataKey="target" stroke="#42b69c" strokeWidth={1.8} strokeDasharray="4 4" fill="url(#tgtGrad)" name="Monthly Target" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Hospital Activity Stream */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#002735", margin: 0 }}>
                  Recent Hospital Engagements
                </h3>
                <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0 0" }}>
                  Live tenders, purchase orders and maintenance visits
                </p>
              </div>
              <Link href="/clients" style={{ fontSize: 11.5, color: "#004d66", fontWeight: 700, textDecoration: "none" }}>
                All facilities →
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentHospitalActivity.slice(0, 4).map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 8,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        backgroundColor: "#eaf8f4",
                        color: "#004d66",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Hospital size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#002735", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.hospital}
                        </span>
                        <span style={{ fontSize: 10, color: "#94a3b8", padding: "1px 5px", backgroundColor: "#ffffff", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                          {item.city}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.event}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: 5,
                        fontSize: 10.5,
                        fontWeight: 700,
                        backgroundColor: item.badgeBg,
                        color: item.badgeColor,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.badge}
                    </span>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Category Share & Operations Team */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Equipment Category Share */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#002735", margin: 0 }}>
                  Category Revenue Share
                </h3>
                <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0 0" }}>
                  Equipment portfolio distribution
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={equipmentCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {equipmentCategories.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>

            <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6, fontSize: 11 }}>
              {equipmentCategories.map((cat) => (
                <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: cat.color, flexShrink: 0 }} />
                  <span style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name} ({cat.value}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* FastonMed Operations Team */}
          <div
            className="card"
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              flex: 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#002735", margin: 0 }}>
                  FastonMed Team
                </h3>
                <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0 0" }}>
                  Active performance & deals closed
                </p>
              </div>
              <Link href="/employees" style={{ fontSize: 11.5, color: "#004d66", fontWeight: 700, textDecoration: "none" }}>
                Directory →
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {realTeam.map((emp) => (
                <div
                  key={emp.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 8,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        backgroundColor: emp.avatarBg,
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {emp.name[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#002735", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {emp.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {emp.role.split("/")[0].trim()}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#004d66" }}>
                      {emp.deals}
                    </div>
                    <div style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>
                      {emp.revenue}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive media rules ensuring balanced rows without orphan cards */}
      <style>{`
        @media (min-width: 1280px) {
          .kpi-metric-grid {
            grid-template-columns: repeat(6, 1fr) !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1279px) {
          .kpi-metric-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .dashboard-split-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 767px) {
          .kpi-metric-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .dashboard-split-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
    </>
  );
}
