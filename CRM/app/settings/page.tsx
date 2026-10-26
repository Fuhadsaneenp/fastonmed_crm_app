"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, RefreshCw, Trash2, Copy, Check, ExternalLink, Unplug, Eye, Sliders } from "lucide-react";
import {
  getZohoConfig,
  saveZohoConfig,
  applyZohoBooksData,
  clearAllDummyData,
  type ZohoConfig,
} from "@/lib/zoho-service";

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export default function SettingsPage() {
  const [form, setForm] = useState({
    name: "Fastonmed Medical Equipment LLC",
    email: "admin@fastonmed.ae",
    phone: "+971 4 345 6789",
    website: "https://fastonmed.ae",
    vatNumber: "100456789000003",
    address: "Building 49, Healthcare District",
    city: "Dubai Healthcare City (DHCC)",
    state: "Dubai",
  });

  const [saving, setSaving] = useState(false);

  // Zoho Books Integration state
  const [zohoConfig, setZohoConfig] = useState<ZohoConfig>({ mode: "webhook", connectionName: "fastonmedcrm" });
  const [syncTab, setSyncTab] = useState<"connect" | "webhook" | "oauth" | "payload">("connect");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [orgId, setOrgId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [oauthStatus, setOauthStatus] = useState({
    connected: false,
    organizationId: "",
    hasServerCredentials: false,
  });

  // Super Admin Preferences state
  const [viewingAsBarEnabled, setViewingAsBarEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("superadmin_viewing_as_bar_enabled") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    const handleBarPrefChange = () => {
      try {
        setViewingAsBarEnabled(localStorage.getItem("superadmin_viewing_as_bar_enabled") === "true");
      } catch {}
    };
    window.addEventListener("superadmin_viewing_as_bar_change", handleBarPrefChange);
    return () => {
      window.removeEventListener("superadmin_viewing_as_bar_change", handleBarPrefChange);
    };
  }, []);

  const handleToggleViewingAsBar = (enabled: boolean) => {
    setViewingAsBarEnabled(enabled);
    try {
      localStorage.setItem("superadmin_viewing_as_bar_enabled", enabled ? "true" : "false");
    } catch {}
    window.dispatchEvent(new Event("superadmin_viewing_as_bar_change"));
    toast.success(enabled ? 'Top "Viewing As" navigation bar enabled' : 'Top "Viewing As" navigation bar hidden');
  };

  useEffect(() => {
    const cfg = getZohoConfig();
    setZohoConfig(cfg);
    if (cfg.webhookUrl) setWebhookUrl(cfg.webhookUrl);
    if (cfg.organizationId) setOrgId(cfg.organizationId);
    if (cfg.clientId) setClientId(cfg.clientId);
    if (cfg.clientSecret) setClientSecret(cfg.clientSecret);
    if (cfg.refreshToken) setRefreshToken(cfg.refreshToken);

    const params = new URLSearchParams(window.location.search);
    const zoho = params.get("zoho");
    const message = params.get("message");
    const connectedOrgId = params.get("organization_id");
    if (zoho === "connected") {
      toast.success("Zoho Books connected successfully. You can sync now.");
      if (connectedOrgId) setOrgId(connectedOrgId);
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (zoho === "error") {
      toast.error(message || "Zoho Books connection failed.");
      window.history.replaceState(null, "", window.location.pathname);
    }

    fetch("/api/zoho/oauth/status")
      .then((res) => res.json())
      .then((status) => {
        setOauthStatus({
          connected: Boolean(status.connected),
          organizationId: status.organizationId || "",
          hasServerCredentials: Boolean(status.hasServerCredentials),
        });
        if (status.organizationId) setOrgId(status.organizationId);
      })
      .catch(() => {
        setOauthStatus((prev) => ({ ...prev, hasServerCredentials: false }));
      });
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Company profile updated successfully!");
    }, 400);
  };

  const copyDelugeScript = () => {
    const script = `// Zoho CRM -> Developer Space -> Functions -> New Function
// Use your Zoho Books connection link name exactly as shown:
// connection: "fastonmedcrm"
orgResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/organizations"
    type: GET
    connection: "fastonmedcrm"
];
orgId = orgResponse.get("organizations").get(0).get("organization_id");

contactsResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/contacts?organization_id=" + orgId
    type: GET
    connection: "fastonmedcrm"
];

invoicesResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/invoices?organization_id=" + orgId
    type: GET
    connection: "fastonmedcrm"
];

estimatesResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/estimates?organization_id=" + orgId
    type: GET
    connection: "fastonmedcrm"
];

result = Map();
result.put("status", "success");
result.put("organization_id", orgId);
result.put("contacts", contactsResponse.get("contacts"));
result.put("invoices", invoicesResponse.get("invoices"));
result.put("quotes", estimatesResponse.get("estimates"));
return result;`;

    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success("Deluge script copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWipeDummyData = () => {
    if (window.confirm("Are you sure you want to wipe all dummy data? This will clear all mock healthcare organisations, contacts, and invoices from the system.")) {
      clearAllDummyData();
      toast.success("All dummy demo data wiped clean!");
    }
  };

  const handleZohoConnect = () => {
    window.location.href = "/api/zoho/oauth/start";
  };

  const handleZohoDisconnect = async () => {
    await fetch("/api/zoho/oauth/disconnect", { method: "POST" });
    setOauthStatus((prev) => ({ ...prev, connected: false, organizationId: "" }));
    toast.success("Zoho Books disconnected");
  };

  const handleZohoSync = async () => {
    setSyncing(true);
    try {
      if (syncTab === "payload") {
        if (!rawJson.trim()) {
          toast.error("Please paste your Zoho JSON payload first");
          setSyncing(false);
          return;
        }
        const parsed = JSON.parse(rawJson);
        const stats = applyZohoBooksData(parsed);
        toast.success(`Synced ${stats.clientsCount} organisations, ${stats.peopleCount} contacts, and ${stats.invoicesCount} invoices from Zoho Books!`);
        setZohoConfig(getZohoConfig());
        setSyncing(false);
        return;
      }

      const bodyPayload: {
        webhookUrl?: string;
        organizationId?: string;
        clientId?: string;
        clientSecret?: string;
        refreshToken?: string;
      } = {};
      if (syncTab === "connect") {
        const response = await fetch("/api/zoho/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Zoho Books sync failed");
        const applied = applyZohoBooksData(result.data);
        const stats = { clients: applied.clientsCount, people: applied.peopleCount, invoices: applied.invoicesCount };
        toast.success(`Synced ${stats.clients} organisations, ${stats.people} contacts, and ${stats.invoices} invoices from Zoho Books!`);
        setZohoConfig({
          ...getZohoConfig(),
          lastSyncedAt: new Date().toISOString(),
          lastSyncStats: stats,
        });
        setSyncing(false);
        return;
      } else if (syncTab === "webhook") {
        if (!webhookUrl.trim()) {
          toast.error("Please provide your Zoho Deluge Function Webhook URL");
          setSyncing(false);
          return;
        }
        bodyPayload.webhookUrl = webhookUrl.trim();
        saveZohoConfig({ ...zohoConfig, webhookUrl: webhookUrl.trim() });
      } else {
        if (!clientId || !clientSecret || !refreshToken) {
          toast.error("Please fill in Client ID, Client Secret, and Refresh Token");
          setSyncing(false);
          return;
        }
        if (orgId.trim()) bodyPayload.organizationId = orgId.trim();
        bodyPayload.clientId = clientId.trim();
        bodyPayload.clientSecret = clientSecret.trim();
        bodyPayload.refreshToken = refreshToken.trim();
        saveZohoConfig({
          ...zohoConfig,
          organizationId: orgId.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          refreshToken: refreshToken.trim(),
        });
      }

      const res = await fetch("/api/zoho/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to sync with Zoho Books");
        setSyncing(false);
        return;
      }

      const stats = applyZohoBooksData(json.data);
      toast.success(`Synced ${stats.clientsCount} organisations, ${stats.peopleCount} contacts, and ${stats.invoicesCount} invoices from Zoho Books!`);
      setZohoConfig(getZohoConfig());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="settings-page" style={{ maxWidth: 1040, margin: "0 auto", animation: "fadeIn 0.3s ease" }}>
      {/* Main Company Profile Card */}
      <div className="card settings-company-card" style={{ padding: "32px 36px", borderRadius: 14 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "#002735", margin: 0 }}>
            Company Profile
          </h1>
          <p style={{ fontSize: 13.5, color: "#64748b", margin: "4px 0 0 0" }}>
            Update your company information
          </p>
        </div>

        <form onSubmit={handleSave}>
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 24px" }}>
            {/* Company Name */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Company Name
              </label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Company Name"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Email */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Email
              </label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@fastonmed.ae"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Phone
              </label>
              <input
                type="text"
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+971 4 345 6789"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Website */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Website
              </label>
              <input
                type="text"
                className="form-input"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://fastonmed.ae"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* VAT Number (TRN) */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                VAT / TRN Number
              </label>
              <input
                type="text"
                className="form-input"
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                placeholder="100456789000003"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Address */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Address
              </label>
              <input
                type="text"
                className="form-input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Building 49, Healthcare District"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Place */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Place
              </label>
              <input
                type="text"
                className="form-input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Dubai Healthcare City (DHCC)"
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Emirate */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Emirate
              </label>
              <select
                className="form-input"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                style={{ height: 42, fontSize: 13.5 }}
              >
                {UAE_EMIRATES.map((em) => (
                  <option key={em} value={em}>
                    {em}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                backgroundColor: "#004d66",
                padding: "10px 28px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#003647")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#004d66")}
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* ─── SUPER ADMIN PREFERENCES ─────────────────────────────────────── */}
      <div style={{ marginTop: 28, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#ecfdf5",
              border: "1px solid #d1fae5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sliders size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Super Admin Preferences
            </h3>
            <p style={{ margin: "3px 0 0 0", color: "#64748b", fontSize: 13, fontWeight: 500 }}>
              Manage global workspace preview modes, developer controls, and profile switching.
            </p>
          </div>
        </div>

        {/* Section 1: Viewing As / User Switcher Banner */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            padding: "24px 28px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #d1fae5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Eye size={19} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: "#0f172a" }}>
                    Top &ldquo;Viewing As&rdquo; Navigation Bar
                  </h4>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      backgroundColor: viewingAsBarEnabled ? "#ecfdf5" : "#f1f5f9",
                      color: viewingAsBarEnabled ? "#059669" : "#64748b",
                      border: viewingAsBarEnabled ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                    }}
                  >
                    {viewingAsBarEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: 13,
                    color: "#64748b",
                    maxWidth: 600,
                    lineHeight: 1.5,
                  }}
                >
                  Shows the green navigation bar across the workspace to easily test and switch between employee profiles.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label
              style={{
                position: "relative",
                display: "inline-block",
                width: 46,
                height: 26,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={viewingAsBarEnabled}
                onChange={(e) => handleToggleViewingAsBar(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: viewingAsBarEnabled ? "#059669" : "#cbd5e1",
                  borderRadius: 30,
                  transition: "all 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    content: '""',
                    height: 20,
                    width: 20,
                    left: viewingAsBarEnabled ? 23 : 3,
                    bottom: 3,
                    backgroundColor: "#ffffff",
                    borderRadius: "50%",
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                />
              </span>
            </label>
          </div>

          {/* Banner Preview Box */}
          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                display: "block",
                marginBottom: 8,
              }}
            >
              BANNER PREVIEW
            </span>
            <div
              style={{
                height: 38,
                background: "linear-gradient(90deg, #064e3b 0%, #047857 50%, #059669 100%)",
                color: "#ffffff",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
                fontSize: 12,
                boxShadow: "0 2px 6px rgba(4, 120, 87, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    backgroundColor: "rgba(255,255,255,0.22)",
                    padding: "2px 7px",
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.03em",
                  }}
                >
                  VIEWING AS
                </span>
                <span>
                  Active Profile: <strong>Admin User</strong> (Super Admin)
                </span>
              </div>
              <span
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Switch User
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ZOHO BOOKS INTEGRATION & REAL DATA SYNC ─────────────────────────── */}
      <div className="card zoho-integration-card" style={{ padding: "32px 36px", borderRadius: 14, marginTop: 24, border: "1px solid #e2e8f0" }}>
        {/* Card Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: "#fef3c7",
                  border: "1px solid #fde68a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                📚
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 20, color: "#002735", margin: 0 }}>
                  Zoho Books Live Integration
                </h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0 0" }}>
                  Connect Zoho Books once, then sync live contacts and invoices into Fastonmed CRM without adding records manually.
                </p>
              </div>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "#ecfdf5",
                color: "#059669",
                border: "1px solid #a7f3d0",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={13} />
              {oauthStatus.connected ? "Zoho Books Connected" : "Zoho Books Ready"}
            </span>
            {zohoConfig.lastSyncedAt && (
              <span style={{ fontSize: 11.5, color: "#64748b" }}>
                Last synced: {new Date(zohoConfig.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Sync Mode Selector */}
        <div className="zoho-mode-tabs"
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: 4,
            borderRadius: 10,
            marginBottom: 24,
            gap: 4,
          }}
        >
          <button
            type="button"
            aria-pressed={syncTab === "connect"}
            onClick={() => setSyncTab("connect")}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: syncTab === "connect" ? "#ffffff" : "transparent",
              color: syncTab === "connect" ? "#004d66" : "#64748b",
              boxShadow: syncTab === "connect" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Connect
          </button>
          <button
            type="button"
            aria-pressed={syncTab === "webhook"}
            onClick={() => setSyncTab("webhook")}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: syncTab === "webhook" ? "#ffffff" : "transparent",
              color: syncTab === "webhook" ? "#004d66" : "#64748b",
              boxShadow: syncTab === "webhook" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Webhook
          </button>
          <button
            type="button"
            aria-pressed={syncTab === "oauth"}
            onClick={() => setSyncTab("oauth")}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: syncTab === "oauth" ? "#ffffff" : "transparent",
              color: syncTab === "oauth" ? "#004d66" : "#64748b",
              boxShadow: syncTab === "oauth" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            API setup
          </button>
          <button
            type="button"
            aria-pressed={syncTab === "payload"}
            onClick={() => setSyncTab("payload")}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: syncTab === "payload" ? "#ffffff" : "transparent",
              color: syncTab === "payload" ? "#004d66" : "#64748b",
              boxShadow: syncTab === "payload" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Import JSON
          </button>
        </div>

        {/* Tab 0: OAuth Connect */}
        {syncTab === "connect" && (
          <div className="zoho-connection-panel"
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "18px 20px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15, marginBottom: 4 }}>
                {oauthStatus.connected ? "Zoho Books is connected" : "Connect Zoho Books automatically"}
              </div>
              <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                {oauthStatus.connected
                  ? `Organization ID: ${oauthStatus.organizationId || "auto-detected on sync"}`
                  : oauthStatus.hasServerCredentials
                  ? "Click connect, approve Zoho Books access, then sync all contacts and invoices."
                  : "Server OAuth credentials are missing. Add ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET to enable one-click connection."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleZohoConnect}
                disabled={!oauthStatus.hasServerCredentials}
                style={{
                  backgroundColor: oauthStatus.hasServerCredentials ? "#004d66" : "#94a3b8",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ExternalLink size={15} />
                {oauthStatus.connected ? "Reconnect Zoho Books" : "Connect Zoho Books"}
              </button>
              {oauthStatus.connected && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleZohoDisconnect}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <Unplug size={15} />
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Zoho Deluge Webhook */}
        {syncTab === "webhook" && (
          <div>
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "16px 20px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
                  1. Copy this Deluge function into Zoho. It uses the connected Zoho Books link name from your screenshot:
                </span>
                <button
                  type="button"
                  onClick={copyDelugeScript}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: copied ? "#059669" : "#334155",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy Script"}
                </button>
              </div>
              <pre
                style={{
                  background: "#0f172a",
                  color: "#f1f5f9",
                  padding: "12px 14px",
                  borderRadius: 8,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  overflowX: "auto",
                  margin: 0,
                  fontFamily: "monospace",
                }}
              >
{`// Zoho CRM -> Developer Space -> Functions -> New Function
// connection: "fastonmedcrm"
orgResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/organizations"
    type: GET
    connection: "fastonmedcrm"
];
orgId = orgResponse.get("organizations").get(0).get("organization_id");

contactsResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/contacts?organization_id=" + orgId
    type: GET
    connection: "fastonmedcrm"
];

invoicesResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/invoices?organization_id=" + orgId
    type: GET
    connection: "fastonmedcrm"
];

estimatesResponse = invokeUrl [
    url: "https://www.zohoapis.com/books/v3/estimates?organization_id=" + orgId
    type: GET
    connection: "fastonmedcrm"
];

result = Map();
result.put("status", "success");
result.put("organization_id", orgId);
result.put("contacts", contactsResponse.get("contacts"));
result.put("invoices", invoicesResponse.get("invoices"));
result.put("quotes", estimatesResponse.get("estimates"));
return result;`}
              </pre>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                2. Paste your Zoho Function Webhook / Execution URL:
              </label>
              <input
                type="url"
                className="form-input"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://crm.zoho.com/crm/v2/functions/fastonmed_sync/actions/execute?auth_type=..."
                style={{ height: 42, fontSize: 13 }}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Direct REST API */}
        {syncTab === "oauth" && (
          <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px", marginBottom: 20 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Zoho Books Organization ID (optional)
              </label>
              <input
                type="text"
                className="form-input"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Leave blank to auto-detect using ZohoBooks.settings.READ"
                style={{ height: 42, fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Client ID
              </label>
              <input
                type="text"
                className="form-input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1000.XXXXXX..."
                style={{ height: 42, fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Client Secret
              </label>
              <input
                type="password"
                className="form-input"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client Secret"
                style={{ height: 42, fontSize: 13 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
                Refresh Token
              </label>
              <input
                type="password"
                className="form-input"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="1000.XXXXXX.refresh..."
                style={{ height: 42, fontSize: 13 }}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Paste JSON Payload */}
        {syncTab === "payload" && (
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontWeight: 600, color: "#334155", marginBottom: 7 }}>
              Paste Output from invokeUrl / Zoho Books Contacts API:
            </label>
            <textarea
              className="form-input"
              rows={8}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder='{ "contacts": [ ... ], "invoices": [ ... ] }'
              style={{ fontSize: 12, fontFamily: "monospace" }}
            />
          </div>
        )}

        {/* Action Buttons & Sync Status */}
        <div className="zoho-sync-actions"
          style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Wipe Demo Data button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleWipeDummyData}
            style={{
              color: "#dc2626",
              borderColor: "#fecaca",
              backgroundColor: "#fff5f5",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              padding: "8px 14px",
            }}
          >
            <Trash2 size={13} />
            Wipe All Dummy Data Now
          </button>

          {/* Sync Button */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={syncing}
              onClick={handleZohoSync}
              style={{
                backgroundColor: "#004d66",
                padding: "10px 24px",
                fontSize: 13.5,
                fontWeight: 600,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(0, 77, 102, 0.25)",
              }}
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Connecting & Syncing..." : "Sync Live Data from Zoho Books"}
            </button>
          </div>
        </div>

        {/* Live Data Summary Card */}
        {zohoConfig.lastSyncStats && (
          <div
            style={{
              marginTop: 18,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12.5,
              color: "#166534",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>
                <strong>Live Sync Active:</strong> Successfully populated{" "}
                <strong>{zohoConfig.lastSyncStats.clients}</strong> Organisations,{" "}
                <strong>{zohoConfig.lastSyncStats.people}</strong> Healthcare Contacts, and{" "}
                <strong>{zohoConfig.lastSyncStats.invoices}</strong> Invoices from Zoho Books.
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: "#15803d" }}>Production Data Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
