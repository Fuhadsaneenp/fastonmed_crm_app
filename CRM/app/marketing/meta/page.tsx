"use client";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import toast from "react-hot-toast";
import {
  Share2, ArrowLeft, Plus, Play, Pause, ExternalLink, Filter,
  CheckCircle2, AlertCircle, RefreshCw, Smartphone, Eye, Users,
  TrendingUp, DollarSign, Target, MousePointerClick, FileSpreadsheet,
  Layers, ChevronRight, Zap
} from "lucide-react";

interface MetaCampaign {
  id: string;
  name: string;
  adAccount: string;
  objective: "Lead Generation" | "Conversions" | "Messages (WhatsApp)";
  status: "Active" | "Paused";
  dailyBudget: number;
  spent: number;
  leads: number;
  costPerLead: number;
  ctr: number;
  roas: number;
  placements: string[];
  lastUpdated: string;
}

const INITIAL_META_CAMPAIGNS: MetaCampaign[] = [
  {
    id: "meta-c1",
    name: "ICU Ventilators & Critical Care Equipment UAE",
    adAccount: "FastonMed Global Business (ID: 948201)",
    objective: "Lead Generation",
    status: "Active",
    dailyBudget: 250,
    spent: 3850,
    leads: 64,
    costPerLead: 60.15,
    ctr: 2.85,
    roas: 4.8,
    placements: ["Instagram Feed", "Facebook Feed", "IG Reels"],
    lastUpdated: "Today, 14:20",
  },
  {
    id: "meta-c2",
    name: "Biomedical AMC & Hospital Service Contracts Dubai",
    adAccount: "FastonMed Global Business (ID: 948201)",
    objective: "Conversions",
    status: "Active",
    dailyBudget: 180,
    spent: 2420,
    leads: 38,
    costPerLead: 63.68,
    ctr: 3.12,
    roas: 5.2,
    placements: ["Facebook Feed", "Instagram Stories", "Messenger"],
    lastUpdated: "Today, 11:45",
  },
  {
    id: "meta-c3",
    name: "Direct WhatsApp Inquiries - Ultrasound & ECG Machines",
    adAccount: "FastonMed Global Business (ID: 948201)",
    objective: "Messages (WhatsApp)",
    status: "Active",
    dailyBudget: 150,
    spent: 1680,
    leads: 29,
    costPerLead: 57.93,
    ctr: 3.45,
    roas: 4.1,
    placements: ["Instagram Feed", "Facebook Stories", "Reels"],
    lastUpdated: "Yesterday",
  },
  {
    id: "meta-c4",
    name: "Private Clinic Re-Equipping & Defibrillator Retargeting",
    adAccount: "FastonMed Global Business (ID: 948201)",
    objective: "Conversions",
    status: "Paused",
    dailyBudget: 100,
    spent: 1250,
    leads: 18,
    costPerLead: 69.44,
    ctr: 2.10,
    roas: 3.2,
    placements: ["Instagram Feed", "Facebook Feed"],
    lastUpdated: "3 days ago",
  },
];

const dailyMetaMetrics = [
  { day: "Mon", spend: 420, leads: 7, clicks: 165 },
  { day: "Tue", spend: 480, leads: 9, clicks: 192 },
  { day: "Wed", spend: 540, leads: 11, clicks: 215 },
  { day: "Thu", spend: 510, leads: 10, clicks: 198 },
  { day: "Fri", spend: 620, leads: 14, clicks: 245 },
  { day: "Sat", spend: 380, leads: 6, clicks: 135 },
  { day: "Sun", spend: 310, leads: 5, clicks: 110 },
];

const placementData = [
  { name: "Instagram Feed", value: 44, color: "#e1306c" },
  { name: "Facebook Feed", value: 30, color: "#1877f2" },
  { name: "Instagram Reels", value: 16, color: "#833ab4" },
  { name: "Instagram Stories", value: 7, color: "#f77737" },
  { name: "Messenger Chat", value: 3, color: "#0084ff" },
];

const recentLeadFormSubmissions = [
  {
    id: "lead-m1",
    name: "Dr. Zaid Al Hashemi",
    facility: "Al Zahra Private Hospital",
    phone: "+971 50 829 4412",
    product: "Mindray SV300 Ventilator",
    formName: "ICU Medical Equipment Lead Gen (UAE)",
    time: "18 mins ago",
    status: "Synced to CRM",
  },
  {
    id: "lead-m2",
    name: "Eng. Mariam Al Mansoor",
    facility: "Medeor Hospital Dubai",
    phone: "+971 55 491 8023",
    product: "Annual Biomedical Maintenance Contract (AMC)",
    formName: "Hospital AMC Inquiry Form",
    time: "1 hour ago",
    status: "Synced to CRM",
  },
  {
    id: "lead-m3",
    name: "Suresh Babu",
    facility: "Gulf Diagnostic Center Abu Dhabi",
    phone: "+971 52 710 6599",
    product: "Portable Patient Monitor Series",
    formName: "Direct WhatsApp Inquiry",
    time: "3 hours ago",
    status: "Synced to CRM",
  },
];

export default function MetaAdsPage() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>(INITIAL_META_CAMPAIGNS);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [selectedObjective, setSelectedObjective] = useState<string>("All");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignBudget, setNewCampaignBudget] = useState(200);
  const [newCampaignObjective, setNewCampaignObjective] = useState<"Lead Generation" | "Conversions" | "Messages (WhatsApp)">("Lead Generation");

  const totalSpend = campaigns.reduce((acc, c) => acc + c.spent, 0);
  const totalLeads = campaigns.reduce((acc, c) => acc + c.leads, 0);
  const avgCPL = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "0.00";
  const activeCount = campaigns.filter((c) => c.status === "Active").length;

  const toggleStatus = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "Active" ? "Paused" : "Active";
          toast.success(`Campaign "${c.name}" is now ${nextStatus}`);
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  const handleSyncLeads = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success("Meta Instant Forms & CRM Leads successfully synced! 3 new inquiries captured.");
    }, 900);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    const created: MetaCampaign = {
      id: `meta-c${Date.now()}`,
      name: newCampaignName.trim(),
      adAccount: "FastonMed Global Business (ID: 948201)",
      objective: newCampaignObjective,
      status: "Active",
      dailyBudget: Number(newCampaignBudget) || 150,
      spent: 0,
      leads: 0,
      costPerLead: 0,
      ctr: 0,
      roas: 0,
      placements: ["Instagram Feed", "Facebook Feed"],
      lastUpdated: "Just now",
    };
    setCampaigns([created, ...campaigns]);
    toast.success(`Meta Campaign "${created.name}" created and published!`);
    setShowCreateModal(false);
    setNewCampaignName("");
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchStatus = filterStatus === "All" || c.status === filterStatus;
    const matchObj = selectedObjective === "All" || c.objective === selectedObjective;
    return matchStatus && matchObj;
  });

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Top Breadcrumb & Actions Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/marketing"
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={14} /> Marketing Hub
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#e0e7ff",
                color: "#4338ca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Share2 size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#002735", margin: 0 }}>
                Meta Ads Workspace
              </h1>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Facebook & Instagram Advertising Campaigns · FastonMed Global Business
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleSyncLeads}
            disabled={isSyncing}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : "Sync Meta Leads"}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ backgroundColor: "#1877f2", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <Plus size={14} /> Create Meta Campaign
          </button>
        </div>
      </div>

      {/* Meta Account Status Banner */}
      <div
        style={{
          padding: "12px 18px",
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#16a34a" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
            Meta Conversions API & Pixel Connected
          </span>
          <span style={{ fontSize: 12, color: "#15803d" }}>
            · Pixel ID: <strong>948201-UAEMED</strong> · Event Match Quality: <strong>94% (Good)</strong>
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#166534" }}>
          <span>Active Ad Sets: <strong>8</strong></span>
          <span>Placements: <strong>IG Feed, FB Feed, Reels, WhatsApp</strong></span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 18, borderLeft: "4px solid #1877f2" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Total Meta Spend</span>
            <DollarSign size={16} color="#1877f2" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            {formatCurrency(totalSpend)}
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={12} /> +14.2% vs previous period
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #059669" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Instant Form Leads</span>
            <Target size={16} color="#059669" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            {totalLeads}
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={12} /> +22 new leads this week
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #e1306c" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Avg Cost Per Lead (CPL)</span>
            <MousePointerClick size={16} color="#e1306c" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            AED {avgCPL}
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4 }}>
            -8.5% reduction in acquisition cost
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #7c3aed" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Active Campaigns</span>
            <Layers size={16} color="#7c3aed" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            {activeCount} / {campaigns.length}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
            Daily budget: AED {campaigns.reduce((a, c) => a + (c.status === "Active" ? c.dailyBudget : 0), 0)}/day
          </div>
        </div>
      </div>

      {/* Performance Charts Row */}
      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#002735" }}>
                Daily Leads & Spend Trajectory
              </h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>Facebook & Instagram combined weekly performance</span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, backgroundColor: "#1877f2", borderRadius: 2 }} /> Spend (AED)
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, backgroundColor: "#10b981", borderRadius: 2 }} /> Leads Captured
              </span>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyMetaMetrics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="spend" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="leads" orientation="right" stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === "spend" ? `AED ${value}` : `${value} Leads`,
                    name === "spend" ? "Ad Spend" : "Leads",
                  ]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Bar yAxisId="spend" dataKey="spend" fill="#1877f2" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="leads" dataKey="leads" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0", color: "#002735" }}>
            Placement Distribution
          </h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>Where your healthcare ads convert</span>
          <div style={{ height: 180, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={placementData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {placementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, justifyContent: "center" }}>
            {placementData.map((p) => (
              <span key={p.name} style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
                {p.name} ({p.value}%)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns Filter & Table Section */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#002735" }}>
              Meta Ad Campaigns ({filteredCampaigns.length})
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Managed live via Meta Graph API & FastonMed CRM
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              className="form-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Paused">Paused Only</option>
            </select>

            <select
              className="form-input"
              value={selectedObjective}
              onChange={(e) => setSelectedObjective(e.target.value)}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              <option value="All">All Objectives</option>
              <option value="Lead Generation">Lead Generation</option>
              <option value="Conversions">Conversions</option>
              <option value="Messages (WhatsApp)">Messages (WhatsApp)</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 18px", fontWeight: 600 }}>Campaign Name</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Objective</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Daily Budget</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Total Spent</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Leads</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Cost / Lead</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "12px 18px", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 6, marginTop: 2 }}>
                      <span>CTR: {c.ctr}%</span>
                      <span>·</span>
                      <span>ROAS: {c.roas}x</span>
                      <span>·</span>
                      <span>{c.lastUpdated}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: c.objective === "Lead Generation" ? "#eff6ff" : c.objective === "Messages (WhatsApp)" ? "#ecfdf5" : "#f5f3ff",
                        color: c.objective === "Lead Generation" ? "#1d4ed8" : c.objective === "Messages (WhatsApp)" ? "#047857" : "#6d28d9",
                      }}
                    >
                      {c.objective}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>
                    AED {c.dailyBudget}/day
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a" }}>
                    {formatCurrency(c.spent)}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0284c7" }}>
                    {c.leads} leads
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>
                    AED {c.costPerLead > 0 ? c.costPerLead.toFixed(2) : "0.00"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 700,
                        backgroundColor: c.status === "Active" ? "#dcfce7" : "#f1f5f9",
                        color: c.status === "Active" ? "#15803d" : "#64748b",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: c.status === "Active" ? "#16a34a" : "#94a3b8",
                        }}
                      />
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    <button
                      onClick={() => toggleStatus(c.id)}
                      className="btn btn-secondary"
                      style={{
                        padding: "5px 10px",
                        fontSize: 11.5,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {c.status === "Active" ? <Pause size={12} /> : <Play size={12} />}
                      {c.status === "Active" ? "Pause" : "Resume"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Instant Form Leads Sync Stream */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#002735" }}>
              Live Meta Instant Form Leads
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Automatically synced into FastonMed CRM Leads Pipeline
            </span>
          </div>
          <Link href="/leads" className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }}>
            View Full CRM Pipeline →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recentLeadFormSubmissions.map((lead) => (
            <div
              key={lead.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                backgroundColor: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>{lead.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {lead.facility} · {lead.phone} · Inquiring about: <strong>{lead.product}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    backgroundColor: "#dbeafe",
                    color: "#1e40af",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  {lead.status}
                </span>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{lead.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 500, padding: 24, borderRadius: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Share2 size={20} color="#1877f2" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#002735" }}>
                  Create Meta Ad Campaign
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Campaign Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Ultrasound Diagnostic Series UAE"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  required
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Campaign Objective</label>
                <select
                  className="form-input"
                  value={newCampaignObjective}
                  onChange={(e) => setNewCampaignObjective(e.target.value as any)}
                  style={{ fontSize: 13 }}
                >
                  <option value="Lead Generation">Lead Generation (Instant Form)</option>
                  <option value="Conversions">Conversions (Website Landing Page)</option>
                  <option value="Messages (WhatsApp)">Messages (Direct WhatsApp Chat)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Daily Budget (AED) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={newCampaignBudget}
                  onChange={(e) => setNewCampaignBudget(Number(e.target.value))}
                  min={50}
                  required
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#1877f2" }}>
                  Publish Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
