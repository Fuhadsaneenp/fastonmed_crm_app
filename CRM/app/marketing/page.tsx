"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Share2,
  Search,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Target,
  Users,
  Activity,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function MarketingHubPage() {
  const [filterPlatform, setFilterPlatform] = useState<"All" | "Meta" | "Google">("All");

  const campaigns = [
    {
      id: "goog-c1",
      platform: "Google",
      name: "Medical Equipment Suppliers UAE - High Intent",
      type: "Search (PPC)",
      status: "Active",
      dailyBudget: 350,
      spent: 5400,
      leads: 94,
      costPerLead: 57.44,
      metric: "7.12% Conv. Rate",
      href: "/marketing/google-ads",
    },
    {
      id: "meta-c1",
      platform: "Meta",
      name: "ICU Ventilators & Critical Care Equipment UAE",
      type: "Lead Gen (IG / FB)",
      status: "Active",
      dailyBudget: 250,
      spent: 3850,
      leads: 64,
      costPerLead: 60.15,
      metric: "4.8x ROAS",
      href: "/marketing/meta",
    },
    {
      id: "goog-c2",
      platform: "Google",
      name: "Hospital ICU Ventilator & Defibrillator Buyers",
      type: "Search (PPC)",
      status: "Active",
      dailyBudget: 280,
      spent: 3920,
      leads: 62,
      costPerLead: 63.22,
      metric: "7.38% Conv. Rate",
      href: "/marketing/google-ads",
    },
    {
      id: "meta-c2",
      platform: "Meta",
      name: "Biomedical AMC & Hospital Service Contracts Dubai",
      type: "Conversions",
      status: "Active",
      dailyBudget: 180,
      spent: 2420,
      leads: 38,
      costPerLead: 63.68,
      metric: "5.2x ROAS",
      href: "/marketing/meta",
    },
    {
      id: "goog-c3",
      platform: "Google",
      name: "FastonMed Biomedical Solutions All-Emirates",
      type: "Performance Max",
      status: "Active",
      dailyBudget: 200,
      spent: 2800,
      leads: 45,
      costPerLead: 62.22,
      metric: "6.33% Conv. Rate",
      href: "/marketing/google-ads",
    },
    {
      id: "meta-c3",
      platform: "Meta",
      name: "Direct WhatsApp Inquiries - Ultrasound & ECG Machines",
      type: "WhatsApp Direct",
      status: "Active",
      dailyBudget: 150,
      spent: 1680,
      leads: 29,
      costPerLead: 57.93,
      metric: "4.1x ROAS",
      href: "/marketing/meta",
    },
  ];

  const filteredCampaigns =
    filterPlatform === "All"
      ? campaigns
      : campaigns.filter((c) => c.platform === filterPlatform);

  return (
    <div className="marketing-overview" style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#002735",
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            Performance Marketing Overview
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0 0" }}>
            Cross-platform campaign tracking, healthcare lead volume, and client acquisition metrics
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#004d66",
              backgroundColor: "#f0f9ff",
              border: "1px solid #bae6fd",
              padding: "5px 12px",
              borderRadius: 20,
            }}
          >
            📅 Last 30 Days · UAE Market
          </div>
        </div>
      </div>

      {/* 4 Compact Top Metric Cards */}
      <div data-mobile-grid="stack"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: "16px 18px", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Total Ad Spend
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: "#f0f9ff",
                color: "#0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={15} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#002735" }}>
            {formatCurrency(20070)}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
            Meta: <strong style={{ color: "#4338ca" }}>AED 7,950</strong> · Google:{" "}
            <strong style={{ color: "#dc2626" }}>AED 12,120</strong>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Healthcare Leads
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: "#ecfdf5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={15} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>
            359 Leads
          </div>
          <div style={{ fontSize: 11.5, color: "#059669", marginTop: 4, fontWeight: 600 }}>
            ↑ +18.4% growth vs last period
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Blended Cost / Lead
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Target size={15} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0284c7" }}>
            AED 55.90
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
            Well below target threshold (&lt; AED 65)
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Active Campaigns
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: "#f5f3ff",
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Activity size={15} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#002735" }}>
            6 Running
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
            3 Meta Lead Ads · 3 Google Search / PMax
          </div>
        </div>
      </div>

      {/* 2 Platform Command Cards (High Density & Compact) */}
      <div data-mobile-grid="stack"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Meta Ads Card */}
        <div
          className="card"
          style={{
            padding: "20px 22px",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: "#eef2ff",
                    color: "#4f46e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Share2 size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#002735", margin: 0 }}>
                    Meta Ads Workspace
                  </h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Facebook, Instagram & WhatsApp Ads</span>
                </div>
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: "#e0e7ff",
                  color: "#4338ca",
                  padding: "3px 9px",
                  borderRadius: 20,
                }}
              >
                ● 3 Active
              </span>
            </div>

            {/* Metrics mini grid */}
            <div data-mobile-grid="metrics"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                backgroundColor: "#f8fafc",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 14,
                border: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>SPENT</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#002735", marginTop: 2 }}>AED 7.95k</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>LEADS</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#059669", marginTop: 2 }}>142</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>COST/LEAD</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0284c7", marginTop: 2 }}>AED 56.00</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>AVG ROAS</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#7c3aed", marginTop: 2 }}>4.8x</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>
              Top performer: <strong>ICU Ventilators & Critical Care UAE</strong> (64 leads · AED 60.15/lead)
            </div>
          </div>

          <Link
            href="/marketing/meta"
            className="btn btn-primary"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#4f46e5",
              borderColor: "#4f46e5",
              textDecoration: "none",
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
            }}
          >
            Manage Meta Ads Workspace
            <ArrowUpRight size={15} />
          </Link>
        </div>

        {/* Google Ads Card */}
        <div
          className="card"
          style={{
            padding: "20px 22px",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Search size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#002735", margin: 0 }}>
                    Google Ads Workspace
                  </h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Search PPC, Performance Max & Display</span>
                </div>
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  padding: "3px 9px",
                  borderRadius: 20,
                }}
              >
                ● 3 Active
              </span>
            </div>

            {/* Metrics mini grid */}
            <div data-mobile-grid="metrics"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                backgroundColor: "#f8fafc",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 14,
                border: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>SPENT</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#002735", marginTop: 2 }}>AED 12.1k</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>CONV.</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#059669", marginTop: 2 }}>217</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>COST/CONV</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0284c7", marginTop: 2 }}>AED 55.85</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>CONV. RATE</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#059669", marginTop: 2 }}>7.2%</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>
              Top performer: <strong>Medical Equipment Suppliers UAE</strong> (94 conv · AED 57.44/lead)
            </div>
          </div>

          <Link
            href="/marketing/google-ads"
            className="btn btn-primary"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#dc2626",
              borderColor: "#dc2626",
              textDecoration: "none",
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
            }}
          >
            Manage Google Ads Workspace
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      {/* Active Campaigns Performance Table */}
      <div className="card" style={{ padding: "18px 20px", borderRadius: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#002735", margin: 0 }}>
              Live Campaigns Performance ({filteredCampaigns.length})
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
              Direct metrics from Meta Ads Graph API and Google Ads Customer Account
            </p>
          </div>

          <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 8, gap: 2 }}>
            <button
              className={`btn ${filterPlatform === "All" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterPlatform("All")}
              style={{
                fontSize: 11.5,
                padding: "4px 10px",
                backgroundColor: filterPlatform === "All" ? "#004d66" : "transparent",
                border: "none",
                color: filterPlatform === "All" ? "#ffffff" : "#475569",
              }}
            >
              All Platforms ({campaigns.length})
            </button>
            <button
              className={`btn ${filterPlatform === "Meta" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterPlatform("Meta")}
              style={{
                fontSize: 11.5,
                padding: "4px 10px",
                backgroundColor: filterPlatform === "Meta" ? "#4f46e5" : "transparent",
                border: "none",
                color: filterPlatform === "Meta" ? "#ffffff" : "#475569",
              }}
            >
              Meta (3)
            </button>
            <button
              className={`btn ${filterPlatform === "Google" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterPlatform("Google")}
              style={{
                fontSize: 11.5,
                padding: "4px 10px",
                backgroundColor: filterPlatform === "Google" ? "#dc2626" : "transparent",
                border: "none",
                color: filterPlatform === "Google" ? "#ffffff" : "#475569",
              }}
            >
              Google (3)
            </button>
          </div>
        </div>

        <div className="table-container" style={{ margin: 0, overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Campaign Name</th>
                <th>Objective / Type</th>
                <th>Status</th>
                <th>Daily Budget</th>
                <th>Total Spent</th>
                <th>Leads / Conv.</th>
                <th>Cost / Lead</th>
                <th>Performance</th>
                <th style={{ textAlign: "right" }}>Workspace</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: c.platform === "Meta" ? "#e0e7ff" : "#fee2e2",
                        color: c.platform === "Meta" ? "#4338ca" : "#dc2626",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {c.platform}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: "#002735", maxWidth: 280 }}>
                    {c.name}
                  </td>
                  <td style={{ color: "#64748b", fontSize: 12 }}>
                    {c.type}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: "#ecfdf5",
                        color: "#059669",
                        padding: "2px 7px",
                        borderRadius: 4,
                      }}
                    >
                      ● {c.status}
                    </span>
                  </td>
                  <td style={{ color: "#334155", fontWeight: 600 }}>
                    {formatCurrency(c.dailyBudget)}/day
                  </td>
                  <td style={{ fontWeight: 700, color: "#002735" }}>
                    {formatCurrency(c.spent)}
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, color: "#059669" }}>
                      {c.leads}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: "#0284c7" }}>
                    AED {c.costPerLead.toFixed(2)}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: "#f1f5f9",
                        color: "#334155",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {c.metric}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={c.href}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: c.platform === "Meta" ? "#4f46e5" : "#dc2626",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      Open ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
