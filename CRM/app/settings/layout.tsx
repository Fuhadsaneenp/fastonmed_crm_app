"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FastonmedLogo from "@/components/FastonmedLogo";
import { clearAuthSession, getAuthToken } from "@/lib/api-client";
import { getInitials } from "@/lib/utils";
import {
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
  ArrowLeft,
  Building2,
  Share2,
} from "lucide-react";
import toast from "react-hot-toast";
import { GlobalImpersonationBar } from "@/components/GlobalImpersonationBar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState({
    name: "Fuhad",
    email: "fuhad@fastonmed.com",
    role: "Super Admin",
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fastonmed_user");
    if (!stored) {
      clearAuthSession();
      router.push("/login");
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setUser({
        name: parsed.name || "Fuhad",
        email: parsed.email || "fuhad@fastonmed.com",
        role: parsed.role || "Super Admin",
      });
    } catch {
      clearAuthSession();
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    clearAuthSession();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <GlobalImpersonationBar />
      {/* ================= SETTINGS TOP HEADER BAR ================= */}
      <header className="mobile-workspace-header"
        style={{
          height: 64,
          backgroundColor: "#002735",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          color: "#ffffff",
          zIndex: 40,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky",
          top: 0,
        }}
      >
        {/* Left: Back Button + Brand Logo + Platform Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/hub");
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.18)",
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "#e2e8f0",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(66,182,156,0.2)";
              e.currentTarget.style.borderColor = "#42b69c";
              e.currentTarget.style.color = "#42b69c";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
              e.currentTarget.style.color = "#e2e8f0";
            }}
            title="Go Back"
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
          <Link
            href="/hub"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            <FastonmedLogo theme="dark" size="md" />
          </Link>
          <div
            style={{
              padding: "3px 9px",
              backgroundColor: "rgba(66,182,156,0.18)",
              border: "1px solid #42b69c",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#42b69c",
              letterSpacing: "0.5px",
            }}
          >
            SYSTEM SETTINGS
          </div>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>
            Company Profile & Universal Integrations
          </span>
        </div>

        {/* Right: Hub Link + User Menu */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/hub"
            style={{
              padding: "6px 12px",
              backgroundColor: "rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "#e2e8f0",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ArrowLeft size={13} />
            <span>Workspace Hub</span>
          </Link>

          {/* User Profile */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "#42b69c",
                  color: "#002735",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                }}
              >
                {getInitials(user.name)}
              </div>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  backgroundColor: "#ffffff",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0",
                  padding: 12,
                  width: 200,
                  zIndex: 50,
                  color: "#0f172a",
                }}
              >
                <div
                  style={{
                    paddingBottom: 8,
                    borderBottom: "1px solid #f1f5f9",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    {user.email}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#059669",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#fee2e2")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT (FULL WIDTH, NO SIDEBAR) ================= */}
      <main className="mobile-workspace-content"
        style={{
          flex: 1,
          padding: "36px 24px 60px",
          maxWidth: 1140,
          width: "100%",
          margin: "0 auto",
          overflowY: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
