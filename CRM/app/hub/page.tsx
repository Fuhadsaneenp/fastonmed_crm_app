"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  Settings as SettingsIcon,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Clock,
  Coffee,
  LogOut,
  User,
  ShieldCheck,
  Building2,
  Cpu,
  Megaphone,
} from "lucide-react";
import FastonmedLogo from "@/components/FastonmedLogo";
import { clearAuthSession, getAuthToken } from "@/lib/api-client";
import toast from "react-hot-toast";
import { GlobalImpersonationBar } from "@/components/GlobalImpersonationBar";

interface UserInfo {
  name: string;
  email: string;
  role: string;
}

export default function WorkspaceHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo>({
    name: "Fuhad",
    email: "fuhad@fastonmed.com",
    role: "Super Admin",
  });
  const [seconds, setSeconds] = useState(8448); // 02:20:48 initial
  const [timerRunning, setTimerRunning] = useState(true);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

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
        name: parsed.name || "Fuhad P K",
        email: parsed.email || "fuhad@fastonmed.com",
        role: parsed.role || "Growth Head",
      });
    } catch (err) {
      console.error(err);
      clearAuthSession();
      router.push("/login");
    }
  }, [router]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleLogout = () => {
    clearAuthSession();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const firstName = user.name.split(" ")[0] || "User";
  const userInitials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const workspaces = [
    {
      id: "crm",
      title: "CRM",
      description: "Pipeline, leads & deals.",
      badge: "Active",
      badgeType: "crm",
      icon: TrendingUp,
      iconBg: "#e5f4f8",
      iconColor: "#004d66",
      href: "/dashboard",
    },
    {
      id: "ems",
      title: "EMS",
      description: "Directory, leaves & payroll.",
      badge: "Active",
      badgeType: "active",
      icon: Users,
      iconBg: "#eaf8f4",
      iconColor: "#42b69c",
      href: "/ems",
    },
    {
      id: "marketing",
      title: "Marketing",
      description: "Meta & Google Ads campaigns.",
      badge: "Active",
      badgeType: "marketing",
      icon: Megaphone,
      iconBg: "#fdf2f8",
      iconColor: "#db2777",
      href: "/marketing",
    },
    {
      id: "settings",
      title: "Settings",
      description: "Company profile & configuration.",
      badge: "Universal",
      badgeType: "neutral",
      icon: SettingsIcon,
      iconBg: "#f1f5f9",
      iconColor: "#475569",
      href: "/settings",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <GlobalImpersonationBar />
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="hub-header"
        style={{
          height: 64,
          backgroundColor: "#002735",
          borderBottom: "1px solid rgba(66, 182, 156, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 2px 12px rgba(0, 39, 53, 0.4)",
        }}
      >
        {/* Brand Logo */}
        <Link href="/hub" style={{ textDecoration: "none" }}>
          <FastonmedLogo size="md" theme="dark" />
        </Link>

        {/* Top Right Controls: Timer, Notification, Profile */}
        <div className="hub-header-controls" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Status & Work Timer Pill */}
          <div className="hub-timer" style={{ position: "relative" }}>
            <button
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(66, 182, 156, 0.3)",
                borderRadius: 9999,
                padding: "6px 14px",
                color: "#e2e8f0",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(66, 182, 156, 0.15)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)")
              }
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: timerRunning ? "#42b69c" : "#f59e0b",
                  boxShadow: timerRunning ? "0 0 8px #42b69c" : "none",
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
                {timerRunning ? "Working" : "Paused"}
              </span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: "#cbd5e1",
                  letterSpacing: "0.03em",
                }}
              >
                {formatTimer(seconds)}
              </span>
              <ChevronDown size={14} style={{ color: "#94a3b8", marginLeft: 2 }} />
            </button>

            {/* Timer Dropdown Menu */}
            {showTimerMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 8,
                  width: 210,
                  backgroundColor: "#ffffff",
                  borderRadius: 12,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0",
                  padding: 6,
                  zIndex: 50,
                  animation: "fadeIn 0.15s ease",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Timesheet Controls
                </div>
                <button
                  onClick={() => {
                    setTimerRunning(!timerRunning);
                    setShowTimerMenu(false);
                    toast.success(timerRunning ? "Timer paused" : "Timer resumed");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "none",
                    background: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f8fafc")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <Clock size={16} color="#42b69c" />
                  <span>{timerRunning ? "Pause Timer" : "Resume Timer"}</span>
                </button>
                <button
                  onClick={() => {
                    setTimerRunning(false);
                    setShowTimerMenu(false);
                    toast("Coffee break recorded (15 mins)", { icon: "☕" });
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "none",
                    background: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f8fafc")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <Coffee size={16} color="#d97706" />
                  <span>Take Break</span>
                </button>
              </div>
            )}
          </div>

          {/* Notification Button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(66, 182, 156, 0.25)",
                color: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                position: "relative",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(66, 182, 156, 0.15)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)")
              }
              title="Notifications"
            >
              <Bell size={17} />
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 9,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "#42b69c",
                  border: "2px solid #002735",
                }}
              />
            </button>

            {/* Notification Popover */}
            {showNotifMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 8,
                  width: 320,
                  backgroundColor: "#ffffff",
                  borderRadius: 14,
                  boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
                  border: "1px solid #e2e8f0",
                  padding: 0,
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                    Platform Activity
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      backgroundColor: "#eaf8f4",
                      color: "#004d66",
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontWeight: 600,
                    }}
                  >
                    3 New
                  </span>
                </div>
                <div style={{ maxHeight: 250, overflowY: "auto" }}>
                  {[
                    {
                      title: "Mediclinic Dubai Lead Quote",
                      sub: "Dr. Al Mansoori approved AED 145,000 Ventilator proposal",
                      time: "10m ago",
                    },
                    {
                      title: "Biomedical AMC Due",
                      sub: "American Hospital Dubai CT scanner calibration scheduled",
                      time: "45m ago",
                    },
                    {
                      title: "EMS Leave Approved",
                      sub: "Hashim approved leave for tomorrow",
                      time: "2h ago",
                    },
                  ].map((notif, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #f8fafc",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f8fafc")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "#1e293b",
                          marginBottom: 2,
                        }}
                      >
                        {notif.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#64748b",
                          lineHeight: 1.4,
                        }}
                      >
                        {notif.sub}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "#94a3b8",
                          marginTop: 4,
                        }}
                      >
                        {notif.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Badge */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "none",
                border: "none",
                padding: "4px 6px",
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(66, 182, 156, 0.1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    color: "#ffffff",
                    fontSize: 13.5,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 11,
                    marginTop: 1,
                  }}
                >
                  {user.role}
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#42b69c",
                  border: "2px solid rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#002d3d",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                }}
              >
                {userInitials}
              </div>
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 8,
                  width: 220,
                  backgroundColor: "#ffffff",
                  borderRadius: 14,
                  boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
                  border: "1px solid #e2e8f0",
                  padding: 6,
                  zIndex: 50,
                  animation: "fadeIn 0.15s ease",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>{user.email}</div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "#059669",
                      fontWeight: 600,
                      marginTop: 4,
                    }}
                  >
                    Role: {user.role}
                  </div>
                </div>

                <Link
                  href="/settings"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#334155",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f8fafc")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <User size={15} />
                  <span>Account Settings</span>
                </Link>

                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "none",
                    background: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#dc2626",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#fef2f2")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= BACKGROUND VECTOR ART ================= */}
      {/* Subtle curved contour waves matching the Fastonmed aesthetic */}
      <svg
        style={{
          position: "absolute",
          top: 64,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.7,
        }}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        {/* Top-right subtle concentric contour waves */}
        <circle
          cx="1280"
          cy="180"
          r="260"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.22"
        />
        <circle
          cx="1280"
          cy="180"
          r="380"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          opacity="0.12"
        />

        {/* Floating diamond wireframe top-left */}
        <polygon
          points="140,190 190,260 140,330 90,260"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          opacity="0.2"
          transform="rotate(15 140 260)"
        />

        {/* Floating diamond wireframe center-right */}
        <polygon
          points="800,580 840,630 800,680 760,630"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          opacity="0.2"
          transform="rotate(12 800 630)"
        />

        {/* Bottom-left subtle wavy contour lines */}
        <path
          d="M-50,750 C 180,680 320,860 600,760 C 800,690 980,840 1200,800 C 1350,770 1450,820 1500,850"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          strokeDasharray="5 7"
          opacity="0.2"
        />
        <path
          d="M-50,830 C 160,780 340,900 620,820 C 840,760 1020,890 1250,860 C 1380,840 1460,880 1500,900"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          opacity="0.14"
        />
        <circle
          cx="120"
          cy="820"
          r="160"
          fill="none"
          stroke="#42b69c"
          strokeWidth="1"
          opacity="0.14"
        />
      </svg>

      {/* ================= MAIN CONTENT ================= */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "30px 20px 40px",
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Central Greeting Header */}
        <div style={{ textAlign: "center", marginBottom: 28, maxWidth: 620 }}>
          {/* Pill Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              backgroundColor: "#eaf8f4",
              border: "1px solid #b2e7d9",
              borderRadius: 9999,
              padding: "4px 12px",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: "#42b69c",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#004d66" }}>
              {getGreeting()}
            </span>
            <span style={{ color: "#8cd7c5", fontSize: 10 }}>•</span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "#004d66" }}>
              Workspace Hub
            </span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            Welcome back,{" "}
            <span
              style={{
                color: "#42b69c",
                fontWeight: 800,
              }}
            >
              {firstName}
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(13px, 1.5vw, 14px)",
              color: "#64748b",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Select a workspace below to access your active projects, team directory, and operations.
          </p>
        </div>

        {/* ================= WORKSPACE CARDS GRID (CRM, EMS, MARKETING, SETTINGS) ================= */}
        <div className="hub-workspace-grid">
          {workspaces.map((ws) => {
            const IconComp = ws.icon;

            const cardContent = (
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: 180,
                  boxSizing: "border-box",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 24px -4px rgba(0,0,0,0.07), 0 4px 10px -2px rgba(0,0,0,0.03)";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  const arrow = e.currentTarget.querySelector(".ws-arrow") as HTMLElement;
                  if (arrow) arrow.style.transform = "translate(2px, -2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  const arrow = e.currentTarget.querySelector(".ws-arrow") as HTMLElement;
                  if (arrow) arrow.style.transform = "translate(0, 0)";
                }}
              >
                {/* Card Top: Icon & Badge */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 14,
                    }}
                  >
                    {/* Icon Container */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: ws.iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: ws.iconColor,
                      }}
                    >
                      <IconComp size={20} strokeWidth={2.2} />
                    </div>

                    {/* Badge */}
                    {ws.badgeType === "active" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: "#eaf8f4",
                          border: "1px solid #b2e7d9",
                          color: "#004d66",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2.5px 8px",
                          borderRadius: 9999,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: "#42b69c",
                          }}
                        />
                        {ws.badge}
                      </span>
                    )}

                    {ws.badgeType === "crm" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: "#e5f4f8",
                          border: "1px solid #a8dde9",
                          color: "#004d66",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2.5px 8px",
                          borderRadius: 9999,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: "#004d66",
                          }}
                        />
                        {ws.badge}
                      </span>
                    )}

                    {ws.badgeType === "marketing" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: "#fdf2f8",
                          border: "1px solid #fbcfe8",
                          color: "#db2777",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2.5px 8px",
                          borderRadius: 9999,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: "#db2777",
                          }}
                        />
                        {ws.badge}
                      </span>
                    )}

                    {ws.badgeType === "neutral" && (
                      <span
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          color: "#64748b",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2.5px 8px",
                          borderRadius: 9999,
                        }}
                      >
                        {ws.badge}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#0f172a",
                      marginBottom: 4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {ws.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#64748b",
                      lineHeight: 1.45,
                      margin: 0,
                      minHeight: 38,
                    }}
                  >
                    {ws.description}
                  </p>
                </div>

                {/* Card Footer: Open workspace */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 12,
                    marginTop: 12,
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#475569",
                    }}
                  >
                    Open workspace
                  </span>
                  <ArrowUpRight
                    className="ws-arrow"
                    size={14}
                    style={{
                      color: "#64748b",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </div>
              </div>
            );

            return (
              <Link
                key={ws.id}
                href={ws.href}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>

      </main>

      {/* Global CSS animation helpers & equal grid layout */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hub-workspace-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          width: 100%;
          max-width: 980px;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .hub-workspace-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 520px) {
          .hub-workspace-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
