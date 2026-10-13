"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { ensureValidAuthToken } from "@/lib/api-client";

async function enquiryFetch(url: string, options: RequestInit = {}) {
  const token = await ensureValidAuthToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status !== 401) return response;
  const renewedToken = await ensureValidAuthToken(true);
  if (!renewedToken || renewedToken === token) return response;
  headers.set("Authorization", `Bearer ${renewedToken}`);
  return fetch(url, { ...options, headers });
}

type Enquiry = {
  id: string;
  clientName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  category?: string;
  product?: string;
  stage?: string;
  source?: string;
  notes?: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
};

// Helper: parse [Tag: Value] patterns from website RFQ notes
function parseEnquiryNotes(rawNotes?: string) {
  if (!rawNotes) return { tags: [] as { label: string; value: string }[], message: "" };

  const tags: { label: string; value: string }[] = [];
  const tagRegex = /\[([^:]+):\s*([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(rawNotes)) !== null) {
    tags.push({ label: match[1].trim(), value: match[2].trim() });
  }

  // Remove the tags from the message
  let message = rawNotes.replace(/\[[^\]]+\]/g, "").trim();
  // Strip redundant leading "Notes:" or "Note:"
  message = message.replace(/^notes?:\s*/i, "").trim();

  return { tags, message };
}

// Helper: format dates into a clean, human-readable format
function formatEnquiryDate(dateStr?: string) {
  if (!dateStr) return { date: "—", time: "" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: dateStr, time: "" };

    const dateFormatted = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return { date: dateFormatted, time: timeFormatted };
  } catch {
    return { date: dateStr || "—", time: "" };
  }
}

// Generate consistent soft avatar colors
const AVATAR_COLORS = [
  { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  { bg: "#f0f9ff", text: "#075985", border: "#bae6fd" },
  { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
  { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" },
];

function getInitials(name?: string) {
  if (!name) return "EN";
  const clean = name.replace(/^(dr\.|eng\.|mr\.|mrs\.|ms\.)\s*/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (clean.slice(0, 2) || "EN").toUpperCase();
}

function getAvatarStyle(name?: string) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name!.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

const STAGES = [
  { label: "New Lead", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", dot: "#10b981" },
  { label: "Contacted", bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd", dot: "#0284c7" },
  { label: "Qualified", bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe", dot: "#8b5cf6" },
  { label: "Proposal Sent", bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  { label: "Closed", bg: "#f8fafc", text: "#475569", border: "#e2e8f0", dot: "#94a3b8" },
];

export default function EnquiriesPage() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await enquiryFetch("/api/website-enquiries", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to load enquiries");
      }
      const list = (payload.leads || [])
        .filter((lead: Enquiry) => lead.source === "Website" || String(lead.id || "").startsWith("web-"))
        .sort(
          (a: Enquiry, b: Enquiry) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      setItems(list);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load enquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleUpdateStage = async (item: Enquiry, newStage: string) => {
    try {
      const response = await enquiryFetch("/api/website-enquiries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, data: { stage: newStage } }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to update status");

      setItems((prev) => prev.map((el) => (el.id === item.id ? { ...el, stage: newStage } : el)));
      if (selectedEnquiry?.id === item.id) {
        setSelectedEnquiry({ ...selectedEnquiry, stage: newStage });
      }
      toast.success(`Stage updated to ${newStage}`);
    } catch (err: any) {
      toast.error(err.message || "Could not update status");
    }
  };

  const remove = async (item: Enquiry) => {
    if (!confirm(`Delete the enquiry from ${item.contactName || item.clientName || "this customer"}?`)) {
      return;
    }
    setDeleting(item.id);
    try {
      const response = await enquiryFetch(`/api/website-enquiries?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Delete failed");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (selectedEnquiry?.id === item.id) setSelectedEnquiry(null);
      toast.success("Enquiry deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesStage =
        stageFilter === "ALL"
          ? true
          : (item.stage || "New Lead").toLowerCase() === stageFilter.toLowerCase();

      const searchTerms = [
        item.id,
        item.contactName,
        item.clientName,
        item.email,
        item.phone,
        item.product,
        item.category,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query.trim() || searchTerms.includes(query.trim().replace(/^#/, "").toLowerCase());

      return matchesStage && matchesQuery;
    });
  }, [items, query, stageFilter]);

  // Status counts for minimalist filter pills
  const counts = useMemo(() => {
    return {
      all: items.length,
      newLead: items.filter((x) => (x.stage || "New Lead") === "New Lead").length,
      contacted: items.filter((x) => x.stage === "Contacted").length,
      qualified: items.filter((x) => x.stage === "Qualified" || x.stage === "Proposal Sent").length,
    };
  }, [items]);

  return (
    <div className="mobile-enquiries-page" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Filter Tabs & Stats Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="enquiry-stage-tabs" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "ALL", label: "All Enquiries", count: counts.all },
            { id: "New Lead", label: "New Leads", count: counts.newLead, dot: "#10b981" },
            { id: "Contacted", label: "Contacted", count: counts.contacted, dot: "#0284c7" },
            { id: "Qualified", label: "Qualified", count: counts.qualified, dot: "#8b5cf6" },
          ].map((tab) => {
            const isActive = stageFilter === tab.id;
            return (
              <button
                key={tab.id}
                aria-pressed={isActive}
                onClick={() => setStageFilter(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#0f172a" : "#64748b",
                  background: isActive ? "#ffffff" : "transparent",
                  border: isActive ? "1px solid #cbd5e1" : "1px solid transparent",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.dot && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: tab.dot,
                    }}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 10,
                    backgroundColor: isActive ? "#f1f5f9" : "#e2e8f0",
                    color: isActive ? "#0f172a" : "#64748b",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Showing <strong>{filtered.length}</strong> of {items.length}
          </span>
          <button
            onClick={() => void load()}
            disabled={loading}
            title="Refresh list"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              color: "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="card mobile-enquiries-list"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
        }}
      >
        {/* Search Bar Row */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 540 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contact, hospital, product, or requirements…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 32px 8px 36px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                background: "#f8fafc",
                color: "#0f172a",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#42b69c";
                e.currentTarget.style.background = "#ffffff";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.background = "#f8fafc";
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Minimal Table */}
        <div style={{ overflowX: "auto" }}>
          <table data-mobile-cards="true"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#fbfcfd",
                  borderBottom: "1px solid #f1f5f9",
                  color: "#64748b",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                <th style={{ padding: "12px 18px", width: "26%" }}>CONTACT</th>
                <th style={{ padding: "12px 14px", width: "22%" }}>ORGANISATION</th>
                <th style={{ padding: "12px 14px", width: "28%" }}>REQUIREMENT</th>
                <th style={{ padding: "12px 14px", width: "12%" }}>STATUS</th>
                <th style={{ padding: "12px 14px", width: "14%" }}>RECEIVED</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const avatar = getAvatarStyle(item.contactName || item.clientName);
                const initials = getInitials(item.contactName);
                const { tags, message } = parseEnquiryNotes(item.notes);
                const { date, time } = formatEnquiryDate(item.createdAt);

                const currentStage =
                  STAGES.find(
                    (s) => s.label.toLowerCase() === (item.stage || "New Lead").toLowerCase()
                  ) || STAGES[0];

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedEnquiry(item)}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {/* Contact */}
                    <td data-label="CONTACT" style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            backgroundColor: avatar.bg,
                            color: avatar.text,
                            border: `1px solid ${avatar.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#0f172a",
                              fontSize: 13.5,
                              lineHeight: 1.3,
                            }}
                          >
                            {item.contactName || "Direct Inquiry"}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginTop: 4,
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            {item.email && (
                              <a
                                href={`mailto:${item.email}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#64748b",
                                  textDecoration: "none",
                                  maxWidth: 160,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={item.email}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                              >
                                <Mail size={12} style={{ flexShrink: 0 }} />
                                <span>{item.email}</span>
                              </a>
                            )}
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#64748b",
                                  textDecoration: "none",
                                  whiteSpace: "nowrap",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                              >
                                <Phone size={12} style={{ flexShrink: 0 }} />
                                <span>{item.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Organisation */}
                    <td data-label="ORGANISATION" style={{ padding: "14px", verticalAlign: "middle" }}>
                      {item.clientName ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Building2 size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                          <span
                            style={{
                              fontWeight: 500,
                              color: "#334155",
                              fontSize: 13,
                              lineHeight: 1.3,
                            }}
                          >
                            {item.clientName}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 13 }}>Private / Direct</span>
                      )}
                    </td>

                    {/* Requirement */}
                    <td data-label="REQUIREMENT" style={{ padding: "14px", verticalAlign: "middle" }}>
                      <div style={{ maxWidth: 360 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#0f172a",
                            fontSize: 13,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.product || item.category || "Medical Equipment RFQ"}
                        </div>

                        {/* Clean tag pills or brief message */}
                        {tags.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            {tags.slice(0, 2).map((t, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: 11,
                                  color: "#475569",
                                  backgroundColor: "#f1f5f9",
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {t.value}
                              </span>
                            ))}
                            {tags.length > 2 && (
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                +{tags.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : message ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              marginTop: 3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={message}
                          >
                            {message}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Status */}
                    <td data-label="STATUS" style={{ padding: "14px", verticalAlign: "middle" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: currentStage.bg,
                          color: currentStage.text,
                          border: `1px solid ${currentStage.border}`,
                          borderRadius: 20,
                          padding: "3px 9px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          lineHeight: 1.2,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: currentStage.dot,
                          }}
                        />
                        {currentStage.label}
                      </span>
                    </td>

                    {/* Received Date & Time */}
                    <td data-label="RECEIVED" style={{ padding: "14px", verticalAlign: "middle" }}>
                      <div style={{ color: "#334155", fontSize: 12.5, fontWeight: 500 }}>
                        {date}
                      </div>
                      {time && (
                        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{time}</div>
                      )}
                    </td>

                    {/* Actions */}
                    <td data-label="ACTIONS"
                      style={{
                        padding: "14px 18px",
                        textAlign: "right",
                        verticalAlign: "middle",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          onClick={() => setSelectedEnquiry(item)}
                          title="View details"
                          style={{
                            width: 30,
                            height: 30,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            color: "#64748b",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#cbd5e1";
                            e.currentTarget.style.color = "#0f172a";
                            e.currentTarget.style.background = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.color = "#64748b";
                            e.currentTarget.style.background = "#ffffff";
                          }}
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          disabled={deleting === item.id}
                          onClick={() => void remove(item)}
                          title="Delete enquiry"
                          style={{
                            width: 30,
                            height: 30,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 6,
                            border: "1px solid transparent",
                            background: "transparent",
                            color: "#94a3b8",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#fee2e2";
                            e.currentTarget.style.color = "#dc2626";
                            e.currentTarget.style.background = "#fef2f2";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "transparent";
                            e.currentTarget.style.color = "#94a3b8";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loadError && !loading && (
          <div role="status" style={{ margin: 16, padding: 20, border: "1px solid #e3eae5", borderRadius: 16, background: "white", textAlign: "center" }}>
            <RefreshCw size={24} style={{ margin: "0 auto 12px", color: "#648574" }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#244c3c" }}>Couldn’t refresh website enquiries</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#718477", lineHeight: 1.6 }}>{items.length ? "Your last loaded enquiries are shown below. Try again to get the latest updates." : "The website connection is temporarily unavailable. Please try again shortly."}</p>
            <button className="btn btn-primary" type="button" onClick={() => void load()}>Try again</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !loadError && filtered.length === 0 && (
          <div
            style={{
              padding: "56px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
              }}
            >
              <Search size={18} />
            </div>
            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>
              No website enquiries found
            </div>
            <div style={{ color: "#64748b", fontSize: 13, maxWidth: 360 }}>
              {query
                ? `No submissions match "${query}". Try adjusting your search term or filter.`
                : "No RFQs or consultation requests received yet."}
            </div>
          </div>
        )}
      </div>

      {/* Slide-over / Modal Detail View */}
      {selectedEnquiry && (
        <div className="enquiry-detail-overlay" data-mobile-overlay="true"
          onClick={() => setSelectedEnquiry(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
            animation: "fadeIn 0.15s ease",
          }}
        >
          <div
            className="enquiry-detail-dialog" role="dialog" aria-modal="true" aria-label="Enquiry details"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              height: "100%",
              backgroundColor: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* Drawer Header */}
            <div className="enquiry-detail-header"
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#ffffff",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#0284c7",
                    backgroundColor: "#e0f2fe",
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  Enquiry details
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  ID: {selectedEnquiry.id}
                </span>
              </div>
              <button aria-label="Close enquiry"
                onClick={() => setSelectedEnquiry(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="enquiry-detail-body" style={{ padding: "22px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Contact Card */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      ...getAvatarStyle(selectedEnquiry.contactName),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {getInitials(selectedEnquiry.contactName)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      {selectedEnquiry.contactName || "Direct Inquiry"}
                    </h3>
                    {selectedEnquiry.clientName && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#475569",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Building2 size={13} style={{ color: "#94a3b8" }} />
                        <span>{selectedEnquiry.clientName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct quick action buttons */}
                <div className="enquiry-contact-actions"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {selectedEnquiry.email && (
                    <a
                      href={`mailto:${selectedEnquiry.email}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "8px 12px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#0f172a",
                        textDecoration: "none",
                      }}
                    >
                      <Mail size={13} style={{ color: "#0284c7" }} />
                      <span>Email</span>
                    </a>
                  )}

                  {selectedEnquiry.phone && (
                    <a
                      href={`tel:${selectedEnquiry.phone}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "8px 12px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#0f172a",
                        textDecoration: "none",
                      }}
                    >
                      <Phone size={13} style={{ color: "#16a34a" }} />
                      <span>Call</span>
                    </a>
                  )}
                </div>

                {/* Details list */}
                <div className="enquiry-contact-details"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 12.5,
                  }}
                >
                  {selectedEnquiry.email && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>Email:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 500, color: "#0f172a" }}>
                          {selectedEnquiry.email}
                        </span>
                        <button
                          aria-label={copiedField === "email" ? "Email copied" : "Copy email address"}
                          onClick={() => handleCopy(selectedEnquiry.email!, "email")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: copiedField === "email" ? "#16a34a" : "#94a3b8",
                            padding: 2,
                          }}
                        >
                          {copiedField === "email" ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === "email" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedEnquiry.phone && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>Phone:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 500, color: "#0f172a" }}>
                          {selectedEnquiry.phone}
                        </span>
                        <button
                          aria-label={copiedField === "phone" ? "Phone copied" : "Copy phone number"}
                          onClick={() => handleCopy(selectedEnquiry.phone!, "phone")}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: copiedField === "phone" ? "#16a34a" : "#94a3b8",
                            padding: 2,
                          }}
                        >
                          {copiedField === "phone" ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === "phone" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>Received on:</span>
                    <span style={{ fontWeight: 500, color: "#0f172a" }}>
                      {formatEnquiryDate(selectedEnquiry.createdAt).date}{" "}
                      {formatEnquiryDate(selectedEnquiry.createdAt).time}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirement & Specs */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#64748b",
                    marginBottom: 8,
                  }}
                >
                  Customer request
                </label>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                    {selectedEnquiry.product || selectedEnquiry.category || "Website RFQ"}
                  </div>
                  {selectedEnquiry.category && selectedEnquiry.category !== "Website RFQ" && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                      Category: <strong>{selectedEnquiry.category}</strong>
                    </div>
                  )}

                  {/* Parsed Tags */}
                  {(() => {
                    const { tags, message } = parseEnquiryNotes(selectedEnquiry.notes);
                    return (
                      <>
                        {tags.length > 0 && (
                          <div data-mobile-grid="stack"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, 1fr)",
                              gap: 8,
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: "1px solid #f1f5f9",
                            }}
                          >
                            {tags.filter((tag) => !(tag.label.toLowerCase() === "facility" && tag.value === selectedEnquiry.clientName)).map((t, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: "8px 10px",
                                  backgroundColor: "#f8fafc",
                                  borderRadius: 6,
                                  border: "1px solid #f1f5f9",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    textTransform: "uppercase",
                                    color: "#94a3b8",
                                    fontWeight: 600,
                                  }}
                                >
                                  {t.label}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    color: "#0f172a",
                                    fontWeight: 500,
                                    marginTop: 2,
                                  }}
                                >
                                  {t.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {message && (
                          <div
                            style={{
                              marginTop: 12,
                              paddingTop: 12,
                              borderTop: "1px solid #f1f5f9",
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                              Message from customer
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "#1e293b",
                                lineHeight: 1.5,
                                marginTop: 4,
                                backgroundColor: "#fbfcfd",
                                padding: "10px 12px",
                                borderRadius: 6,
                                border: "1px solid #edf2f7",
                              }}
                            >
                              {message}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Status Updater */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#64748b",
                    marginBottom: 8,
                  }}
                >
                  Enquiry status
                </label>
                <select
                  aria-label="Enquiry status"
                  className="enquiry-status-select"
                  value={STAGES.find((stage) => stage.label.toLowerCase() === (selectedEnquiry.stage || "New Lead").toLowerCase())?.label || "New Lead"}
                  onChange={(event) => void handleUpdateStage(selectedEnquiry, event.target.value)}
                  style={{ width: "100%", minHeight: 46, padding: "10px 12px", border: "1px solid #dce7e0", borderRadius: 12, background: "white", color: "#24483d", fontSize: 14 }}
                >
                  {STAGES.map((stage) => <option key={stage.label} value={stage.label}>{stage.label}</option>)}
                </select>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="enquiry-detail-footer"
              style={{
                marginTop: "auto",
                padding: "16px 22px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#ffffff",
                position: "sticky",
                bottom: 0,
              }}
            >
              <button
                onClick={() => void remove(selectedEnquiry)}
                disabled={deleting === selectedEnquiry.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "transparent",
                  color: "#dc2626",
                  border: "1px solid #fee2e2",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = `/leads?search=${encodeURIComponent(
                    selectedEnquiry.contactName || selectedEnquiry.clientName || ""
                  )}`;
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: "#004d66",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span>Open in pipeline</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
