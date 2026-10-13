"use client";
import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";
import toast from "react-hot-toast";
import {
  Search, ArrowLeft, Plus, Play, Pause, ExternalLink, Filter,
  CheckCircle2, AlertCircle, RefreshCw, Key, Target, MousePointerClick,
  TrendingUp, DollarSign, Layers, ChevronRight, Video, Globe, Award
} from "lucide-react";

interface GoogleCampaign {
  id: string;
  name: string;
  type: "Search (PPC)" | "Performance Max" | "Display Network" | "YouTube Video";
  status: "Active" | "Paused";
  dailyBudget: number;
  spent: number;
  clicks: number;
  avgCpc: number;
  conversions: number;
  costPerConversion: number;
  conversionRate: number;
  qualityScoreAvg: number;
  lastUpdated: string;
}

const INITIAL_GOOGLE_CAMPAIGNS: GoogleCampaign[] = [
  {
    id: "goog-c1",
    name: "[Search] Medical Equipment Suppliers UAE - High Intent",
    type: "Search (PPC)",
    status: "Active",
    dailyBudget: 350,
    spent: 5400,
    clicks: 1320,
    avgCpc: 4.09,
    conversions: 94,
    costPerConversion: 57.44,
    conversionRate: 7.12,
    qualityScoreAvg: 9.2,
    lastUpdated: "Today, 15:10",
  },
  {
    id: "goog-c2",
    name: "[Search] Hospital ICU Ventilator & Defibrillator Buyers",
    type: "Search (PPC)",
    status: "Active",
    dailyBudget: 280,
    spent: 3920,
    clicks: 840,
    avgCpc: 4.66,
    conversions: 62,
    costPerConversion: 63.22,
    conversionRate: 7.38,
    qualityScoreAvg: 9.0,
    lastUpdated: "Today, 12:30",
  },
  {
    id: "goog-c3",
    name: "[PMax] FastonMed Biomedical Solutions All-Emirates",
    type: "Performance Max",
    status: "Active",
    dailyBudget: 200,
    spent: 2800,
    clicks: 710,
    avgCpc: 3.94,
    conversions: 45,
    costPerConversion: 62.22,
    conversionRate: 6.33,
    qualityScoreAvg: 8.8,
    lastUpdated: "Yesterday",
  },
  {
    id: "goog-c4",
    name: "[Display] Clinic Remarketing & Hospital Decision Makers",
    type: "Display Network",
    status: "Paused",
    dailyBudget: 120,
    spent: 1140,
    clicks: 480,
    avgCpc: 2.37,
    conversions: 16,
    costPerConversion: 71.25,
    conversionRate: 3.33,
    qualityScoreAvg: 7.8,
    lastUpdated: "4 days ago",
  },
];

const dailyGoogleMetrics = [
  { day: "Mon", spend: 590, clicks: 142, conversions: 11 },
  { day: "Tue", spend: 670, clicks: 168, conversions: 14 },
  { day: "Wed", spend: 720, clicks: 180, conversions: 16 },
  { day: "Thu", spend: 690, clicks: 172, conversions: 13 },
  { day: "Fri", spend: 810, clicks: 205, conversions: 19 },
  { day: "Sat", spend: 450, clicks: 115, conversions: 8 },
  { day: "Sun", spend: 380, clicks: 92, conversions: 6 },
];

const topKeywords = [
  {
    keyword: "medical equipment supplier dubai",
    match: "Phrase Match",
    clicks: 420,
    cpc: 3.85,
    conversions: 34,
    qs: "10/10",
  },
  {
    keyword: "buy hospital ventilator uae",
    match: "Exact Match",
    clicks: 310,
    cpc: 4.90,
    conversions: 28,
    qs: "9/10",
  },
  {
    keyword: "biomedical maintenance contracts abu dhabi",
    match: "Phrase Match",
    clicks: 245,
    cpc: 4.20,
    conversions: 22,
    qs: "9/10",
  },
  {
    keyword: "patient monitor series uae",
    match: "Exact Match",
    clicks: 195,
    cpc: 3.65,
    conversions: 18,
    qs: "9/10",
  },
  {
    keyword: "hospital defibrillator supplier",
    match: "Phrase Match",
    clicks: 160,
    cpc: 4.10,
    conversions: 15,
    qs: "8/10",
  },
];

export default function GoogleAdsPage() {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>(INITIAL_GOOGLE_CAMPAIGNS);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignBudget, setNewCampaignBudget] = useState(300);
  const [newCampaignType, setNewCampaignType] = useState<"Search (PPC)" | "Performance Max" | "Display Network" | "YouTube Video">("Search (PPC)");

  const totalSpend = campaigns.reduce((acc, c) => acc + c.spent, 0);
  const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
  const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0.00";
  const costPerConv = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00";
  const activeCount = campaigns.filter((c) => c.status === "Active").length;

  const toggleStatus = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "Active" ? "Paused" : "Active";
          toast.success(`Google Campaign "${c.name}" is now ${nextStatus}`);
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Google Ads API live data synchronized! Quality scores updated.");
    }, 850);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    const created: GoogleCampaign = {
      id: `goog-c${Date.now()}`,
      name: newCampaignName.trim(),
      type: newCampaignType,
      status: "Active",
      dailyBudget: Number(newCampaignBudget) || 200,
      spent: 0,
      clicks: 0,
      avgCpc: 0,
      conversions: 0,
      costPerConversion: 0,
      conversionRate: 0,
      qualityScoreAvg: 9.0,
      lastUpdated: "Just now",
    };
    setCampaigns([created, ...campaigns]);
    toast.success(`Google Ads Campaign "${created.name}" deployed!`);
    setShowCreateModal(false);
    setNewCampaignName("");
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchType = filterType === "All" || c.type === filterType;
    const matchStatus = filterStatus === "All" || c.status === filterStatus;
    return matchType && matchStatus;
  });

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Top Header & Actions */}
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
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Search size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#002735", margin: 0 }}>
                Google Ads Workspace
              </h1>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Search (PPC), Performance Max & Display · FastonMed MCC ID: 821-492-1084
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Updating..." : "Sync Google Ads"}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ backgroundColor: "#ea4335", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <Plus size={14} /> New Google Campaign
          </button>
        </div>
      </div>

      {/* Google Account Health Status Banner */}
      <div
        style={{
          padding: "12px 18px",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#dc2626" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>
            Google Ads Enhanced Conversions Active
          </span>
          <span style={{ fontSize: 12, color: "#b91c1c" }}>
            · Search Impression Share: <strong>74.8%</strong> · Avg Quality Score: <strong>9.1 / 10</strong>
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#991b1b" }}>
          <span>Primary Conversion: <strong>Direct RFQ & Phone Clicks</strong></span>
          <span>Target ROAS: <strong>480%</strong></span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div data-mobile-grid="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 18, borderLeft: "4px solid #ea4335" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Total Google Spend</span>
            <DollarSign size={16} color="#ea4335" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            {formatCurrency(totalSpend)}
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={12} /> Search budget pacing: 98%
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #4285f4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Total Clicks</span>
            <MousePointerClick size={16} color="#4285f4" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            {totalClicks.toLocaleString()}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
            Avg CPC: <strong>AED {avgCPC}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #34a853" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Verified Conversions</span>
            <Target size={16} color="#34a853" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            {totalConversions}
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4 }}>
            Cost / Conv: <strong>AED {costPerConv}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #fbbc05" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Avg Quality Score</span>
            <Award size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#002735" }}>
            9.1 / 10
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4 }}>
            Above average expected CTR & landing page
          </div>
        </div>
      </div>

      {/* Performance Charts Row */}
      <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#002735" }}>
                Daily Clicks & High-Intent Conversions
              </h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>Google Search PPC & PMax conversion pacing</span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, backgroundColor: "#ea4335", borderRadius: 2 }} /> Clicks
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, backgroundColor: "#34a853", borderRadius: 2 }} /> Conversions
              </span>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyGoogleMetrics}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea4335" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ea4335" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34a853" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#34a853" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === "clicks" ? `${value} Clicks` : `${value} Inquiries`,
                    name === "clicks" ? "Clicks" : "Conversions",
                  ]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Area type="monotone" dataKey="clicks" stroke="#ea4335" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                <Area type="monotone" dataKey="conversions" stroke="#34a853" strokeWidth={2} fillOpacity={1} fill="url(#colorConv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Keywords Overview */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#002735" }}>
              Top Converting Keywords
            </h3>
            <Key size={16} color="#64748b" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topKeywords.map((kw) => (
              <div
                key={kw.keyword}
                style={{
                  padding: "10px 12px",
                  backgroundColor: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: "#0f172a" }}>
                    &ldquo;{kw.keyword}&rdquo;
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {kw.match} · CPC: AED {kw.cpc}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
                    {kw.conversions} conv.
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: "2px 6px",
                      borderRadius: 4,
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      fontWeight: 600,
                    }}
                  >
                    QS: {kw.qs}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Google Campaigns Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
              Google Campaigns ({filteredCampaigns.length})
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Active search ads, bidding strategies & impression shares
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
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              <option value="All">All Campaign Types</option>
              <option value="Search (PPC)">Search (PPC)</option>
              <option value="Performance Max">Performance Max</option>
              <option value="Display Network">Display Network</option>
              <option value="YouTube Video">YouTube Video</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 18px", fontWeight: 600 }}>Campaign Name</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Daily Budget</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Spent</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Clicks</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Avg CPC</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Conversions</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Cost / Conv</th>
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
                      <span>Conv. Rate: {c.conversionRate}%</span>
                      <span>·</span>
                      <span>Quality Score: {c.qualityScoreAvg}</span>
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
                        backgroundColor: c.type === "Search (PPC)" ? "#fef2f2" : "#eff6ff",
                        color: c.type === "Search (PPC)" ? "#b91c1c" : "#1d4ed8",
                      }}
                    >
                      {c.type}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>
                    AED {c.dailyBudget}/day
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a" }}>
                    {formatCurrency(c.spent)}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>
                    {c.clicks.toLocaleString()}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>
                    AED {c.avgCpc > 0 ? c.avgCpc.toFixed(2) : "0.00"}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#16a34a" }}>
                    {c.conversions}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#334155" }}>
                    AED {c.costPerConversion > 0 ? c.costPerConversion.toFixed(2) : "0.00"}
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

      {/* Create Google Campaign Modal */}
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
                <Search size={20} color="#ea4335" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#002735" }}>
                  New Google Ads Campaign
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
                  placeholder="e.g. [Search] Biomedical Diagnostic Equipment Dubai"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  required
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Campaign Type</label>
                <select
                  className="form-input"
                  value={newCampaignType}
                  onChange={(e) => setNewCampaignType(e.target.value as any)}
                  style={{ fontSize: 13 }}
                >
                  <option value="Search (PPC)">Search (PPC - High Intent Keywords)</option>
                  <option value="Performance Max">Performance Max (Automated Multi-Channel)</option>
                  <option value="Display Network">Google Display Network (Remarketing)</option>
                  <option value="YouTube Video">YouTube Video Showcase</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Daily Budget (AED) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={newCampaignBudget}
                  onChange={(e) => setNewCampaignBudget(Number(e.target.value))}
                  min={100}
                  required
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#ea4335" }}>
                  Publish Google Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
