"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { 
  ArrowRightLeft, 
  Eye, 
  LogOut, 
  X, 
  Search, 
  UserCircle,
} from "lucide-react";
import { getApiUrl } from "@/lib/api-client";
import { mockEmployees } from "@/lib/mock-data";

export interface TargetUser {
  id: string;
  userId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  department?: string;
  designation?: string;
  phone?: string;
  status?: string;
  isActive?: boolean;
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  "fuhad@fastonmed.com": "growth123",
  "hashim@fastonmed.com": "hashim123",
  "riyas@fastonmed.com": "riyas123",
  "fidha@fastonmed.com": "fidha123",
  "user1@fastonmed.com": "user123",
};

const INITIAL_TARGETS: TargetUser[] = [
  {
    id: "emp-fuhad",
    name: "Fuhad Saneen P K",
    email: "fuhad@fastonmed.com",
    role: "Super Admin",
    designation: "Growth Head",
    department: "Executive Management",
    status: "Active",
  },
  {
    id: "emp-hashim",
    name: "Hashim",
    email: "hashim@fastonmed.com",
    role: "Operations Manager",
    designation: "Operations Manager",
    department: "Management",
    status: "Active",
  },
  {
    id: "emp-riyas",
    name: "Riyas",
    email: "riyas@fastonmed.com",
    role: "Sales Executive",
    designation: "Sales Executive",
    department: "Sales",
    status: "Active",
  },
  {
    id: "emp-fidha",
    name: "Fidha",
    email: "fidha@fastonmed.com",
    role: "Client Relations",
    designation: "Client Relations",
    department: "Administration",
    status: "Active",
  },
  {
    id: "emp-user1",
    name: "User 1",
    email: "user1@fastonmed.com",
    role: "Sales Executive",
    designation: "Sales Executive",
    department: "Sales",
    status: "Active",
  },
];

export function GlobalImpersonationBar() {
  return (
    <Suspense fallback={null}>
      <GlobalImpersonationBarContent />
    </Suspense>
  );
}

function GlobalImpersonationBarContent() {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userDesignation, setUserDesignation] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdmin, setOriginalAdmin] = useState<any>(null);
  const sessionOwner = isImpersonating ? originalAdmin : currentUser;
  const canUseSwitcher = Boolean(
    currentUser &&
    typeof sessionOwner?.role === "string" &&
    sessionOwner.role.trim().toLowerCase() === "super admin"
  );

  // Switcher modal state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [switcherSearch, setSwitcherSearch] = useState("");
  const [targets, setTargets] = useState<TargetUser[]>(() => {
    const baseMap = new Map<string, TargetUser>();
    INITIAL_TARGETS.forEach(t => baseMap.set(t.email.toLowerCase(), t));
    mockEmployees.forEach((emp: any) => {
      const email = (emp.email || "").toLowerCase();
      if (email && !baseMap.has(email)) {
        baseMap.set(email, {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          designation: emp.role,
          department: emp.department,
          status: emp.status || "Active",
        });
      }
    });
    return Array.from(baseMap.values());
  });
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Super Admin Viewing As Visibility & Preference State
  const [isBarEnabled, setIsBarEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("superadmin_viewing_as_bar_enabled") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const refreshTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
  const lastRefreshDataRef = { current: "" };

  const refreshSession = () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("fastonmed_user");
    const originalRaw = localStorage.getItem("originalAdminSession");
    const targetRaw = localStorage.getItem("activeImpersonateTarget");

    // Build a fingerprint to skip no-op updates
    const fingerprint = `${stored}|${originalRaw}|${targetRaw}`;
    if (fingerprint === lastRefreshDataRef.current) return;
    lastRefreshDataRef.current = fingerprint;

    if (!stored) {
      setCurrentUser(null);
      setIsImpersonating(false);
      setOriginalAdmin(null);
      return;
    }

    try {
      const user = JSON.parse(stored);
      setCurrentUser(user);

      if (originalRaw) {
        const parsed = JSON.parse(originalRaw);
        setIsImpersonating(true);
        setOriginalAdmin(parsed.user || parsed);
      } else {
        setIsImpersonating(false);
        setOriginalAdmin(null);
      }

      // Read active impersonate target if available
      let activeTarget: any = null;
      try {
        if (targetRaw) activeTarget = JSON.parse(targetRaw);
      } catch {}

      if (activeTarget) {
        setUserName(activeTarget.name || `${activeTarget.firstName || ""} ${activeTarget.lastName || ""}`.trim() || activeTarget.email);
        setUserDesignation(activeTarget.designation || activeTarget.role || "Member");
      } else {
        const name = user.name || (user.email === "fuhad@fastonmed.com" ? "Fuhad Saneen P K" : user.email);
        const designation = user.email === "fuhad@fastonmed.com" 
          ? "Growth Head" 
          : user.designation || user.role || "Team Member";
        setUserName(name);
        setUserDesignation(designation);
      }
    } catch {
      setCurrentUser(null);
      setIsImpersonating(false);
      setOriginalAdmin(null);
    }
  };

  const debouncedRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshSession();
      refreshTimerRef.current = null;
    }, 50);
  };

  useEffect(() => {
    refreshSession();
  }, [pathname]);

  useEffect(() => {
    const handleSessionChange = () => debouncedRefresh();
    const handleBarPrefChange = () => {
      try {
        setIsBarEnabled(localStorage.getItem("superadmin_viewing_as_bar_enabled") === "true");
      } catch {}
    };

    window.addEventListener("auth-session-changed", handleSessionChange);
    window.addEventListener("fastonmed_user_updated", handleSessionChange);
    window.addEventListener("superadmin_viewing_as_bar_change", handleBarPrefChange);

    return () => {
      window.removeEventListener("auth-session-changed", handleSessionChange);
      window.removeEventListener("fastonmed_user_updated", handleSessionChange);
      window.removeEventListener("superadmin_viewing_as_bar_change", handleBarPrefChange);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const loadTargets = () => {
    if (!canUseSwitcher) return;
    setIsSwitcherOpen(true);
    setSwitcherSearch("");

    // Ensure targets are immediately ready
    const baseMap = new Map<string, TargetUser>();
    INITIAL_TARGETS.forEach(t => baseMap.set(t.email.toLowerCase(), t));
    mockEmployees.forEach((emp: any) => {
      const email = (emp.email || "").toLowerCase();
      if (email && !baseMap.has(email)) {
        baseMap.set(email, {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          designation: emp.role,
          department: emp.department,
          status: emp.status || "Active",
        });
      }
    });
    setTargets(Array.from(baseMap.values()));

    // Non-blocking background fetch with 1500ms timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      fetch(getApiUrl("/api/employees"), { signal: controller.signal })
        .then(res => res.json())
        .then(json => {
          clearTimeout(timeoutId);
          const liveList = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          if (liveList.length > 0) {
            setTargets(prev => {
              const map = new Map<string, TargetUser>();
              prev.forEach(t => map.set(t.email.toLowerCase(), t));
              liveList.forEach((e: any) => {
                const email = (e.email || "").toLowerCase();
                if (email && !map.has(email)) {
                  map.set(email, {
                    id: e.id || e._id,
                    name: e.name || `${e.firstName || ""} ${e.lastName || ""}`.trim() || email,
                    email: e.email,
                    role: e.role || "Team Member",
                    designation: e.designation || e.role || "Team Member",
                    department: e.department || "General",
                    status: e.status || "Active",
                  });
                }
              });
              return Array.from(map.values()).filter(t => t.status !== "Inactive");
            });
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
        });
    } catch {}
  };

  const handleSwitch = async (target: TargetUser) => {
    if (!canUseSwitcher) return;
    setSwitchingId(target.id);
    try {
      const currentToken = localStorage.getItem("fastonmed_token");
      const currentUserRaw = localStorage.getItem("fastonmed_user");
      const current = currentUserRaw ? JSON.parse(currentUserRaw) : null;

      if (!localStorage.getItem("originalAdminSession") && current) {
        localStorage.setItem("originalAdminSession", JSON.stringify({
          user: current,
          token: currentToken,
        }));
      }

      localStorage.setItem("activeImpersonateTarget", JSON.stringify(target));

      // Attempt to authenticate target on backend if password is known
      const targetEmail = target.email?.toLowerCase().trim();
      const password = DEFAULT_PASSWORDS[targetEmail];
      let switchedToken = currentToken;

      if (password) {
        try {
          const res = await fetch(getApiUrl("/api/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail, password }),
          });
          const json = await res.json();
          if (json?.success && json?.data?.token) {
            switchedToken = json.data.token;
            if (json.data.user) {
              localStorage.setItem("fastonmed_user", JSON.stringify(json.data.user));
            }
          }
        } catch (err) {
          console.warn("Backend login failed for target user, continuing with client session switch:", err);
        }
      }

      if (!password || !localStorage.getItem("fastonmed_user")) {
        const switchedUser = {
          id: target.id || target.userId,
          name: target.name,
          email: target.email,
          role: target.role || target.designation || "Employee",
          department: target.department || "General",
        };
        localStorage.setItem("fastonmed_user", JSON.stringify(switchedUser));
      }

      if (switchedToken) {
        localStorage.setItem("fastonmed_token", switchedToken);
      }

      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-session-changed"));
      window.dispatchEvent(new Event("fastonmed_user_updated"));
      setIsSwitcherOpen(false);
      window.location.reload();
    } catch (err: any) {
      alert(err?.message || "Failed to switch user");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleExit = () => {
    try {
      const original = localStorage.getItem("originalAdminSession");
      if (original) {
        const parsed = JSON.parse(original);
        if (parsed.user) localStorage.setItem("fastonmed_user", JSON.stringify(parsed.user));
        if (parsed.token) localStorage.setItem("fastonmed_token", parsed.token);
      }
    } catch {}
    localStorage.removeItem("originalAdminSession");
    localStorage.removeItem("activeImpersonateTarget");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-session-changed"));
    window.dispatchEvent(new Event("fastonmed_user_updated"));
    window.location.reload();
  };

  const filteredTargets = useMemo(() => {
    let list = targets;
    if (!switcherSearch.trim()) return list;
    const q = switcherSearch.toLowerCase().trim();
    return list.filter((t) => {
      const name = (t.name || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const role = (t.role || "").toLowerCase();
      const dept = (t.department || "").toLowerCase();
      const desg = (t.designation || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q) || dept.includes(q) || desg.includes(q);
    });
  }, [targets, switcherSearch]);

  const shouldShowBar = Boolean(canUseSwitcher && isBarEnabled && pathname !== "/login");

  if (!shouldShowBar) return null;

  return (
    <>
      {/* 1. Omnipresent Top Switching Bar */}
      <div 
        className="global-impersonation-bar"
        style={{
          width: "100%",
          minHeight: "38px",
          background: isImpersonating 
            ? "linear-gradient(90deg, #064e3b 0%, #047857 50%, #059669 100%)" 
            : "linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          fontSize: "12px",
          fontWeight: 550,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          position: "sticky",
          top: 0,
          zIndex: 9999,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          gap: "8px"
        }}
      >
        {/* Left: Active Profile Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden", flex: 1 }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: isImpersonating ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.15)",
            padding: "2px 6px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            flexShrink: 0
          }}>
            {isImpersonating ? <Eye size={12} /> : <UserCircle size={12} />}
            <span>{isImpersonating ? "Viewing" : "Admin"}</span>
          </span>

          <span className="global-impersonation-text" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", fontSize: "11.5px" }}>
            <strong style={{ color: "#ffffff" }}>{userName || currentUser.email}</strong>
            <span className="global-impersonation-role" style={{ opacity: 0.85, marginLeft: "4px" }}>
              ({userDesignation || currentUser.role})
            </span>
          </span>
        </div>

        {/* Right: Switch Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={loadTargets}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              color: "#ffffff",
              borderRadius: "6px",
              padding: "3px 8px",
              fontSize: "11px",
              fontWeight: 650,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s"
            }}
          >
            <ArrowRightLeft size={11} />
            <span className="global-impersonation-btn-text">Switch</span>
          </button>

          {isImpersonating && (
            <button
              type="button"
              onClick={handleExit}
              style={{
                backgroundColor: "#ffffff",
                border: "none",
                color: "#064e3b",
                borderRadius: "6px",
                padding: "3px 10px",
                fontSize: "11px",
                fontWeight: 750,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
              }}
            >
              <LogOut size={11} />
              <span className="global-impersonation-btn-text">Exit</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem("superadmin_viewing_as_bar_enabled", "false");
              } catch {}
              setIsBarEnabled(false);
              window.dispatchEvent(new Event("superadmin_viewing_as_bar_change"));
            }}
            title="Hide Viewing As Bar (You can re-enable it anytime in Settings > Super Admin Preferences)"
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "rgba(255, 255, 255, 0.7)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              marginLeft: "2px"
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)"}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. Switch User Modal */}
      {isSwitcherOpen && (
        <div data-mobile-overlay="true" style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100000,
          padding: "20px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "18px",
            width: "100%",
            maxWidth: "580px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid #e2e8f0",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "#ecfdf5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ArrowRightLeft size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>Switch User / View As</h3>
                </div>
                <p style={{ margin: "4px 0 0 44px", fontSize: "13px", color: "#64748b" }}>
                  Select any employee to preview their dashboard, calendar, and workload.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSwitcherOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "6px", borderRadius: "8px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={16} style={{ position: "absolute", left: "14px", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Search by name (e.g. Hashim, Riyas), email, role, or department..."
                  value={switcherSearch}
                  onChange={(e) => setSwitcherSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 40px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#0f172a"
                  }}
                />
                {switcherSearch && (
                  <button
                    type="button"
                    onClick={() => setSwitcherSearch("")}
                    style={{ position: "absolute", right: "12px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Target User List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", maxHeight: "380px" }}>
              {filteredTargets.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "14px" }}>No matching employees found</p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>Try searching with another name or department.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {filteredTargets.map((target) => {
                    const isCurrent = Boolean(
                      currentUser?.email && target.email && 
                      currentUser.email.toLowerCase() === target.email.toLowerCase()
                    );
                    const isSuperAdminRole = target.role.toLowerCase().includes("admin") || target.role.toLowerCase().includes("super");
                    const isOps = target.role.toLowerCase().includes("operation");
                    const roleBadgeColor = isSuperAdminRole ? "#7c3aed" : isOps ? "#0891b2" : "#059669";
                    const roleBadgeBg = isSuperAdminRole ? "#f5f3ff" : isOps ? "#ecfeff" : "#ecfdf5";
                    
                    const initials = target.name
                      ? target.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                      : "U";

                    return (
                      <div
                        key={target.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: isCurrent ? "1.5px solid #10b981" : "1px solid #f1f5f9",
                          backgroundColor: isCurrent ? "#f0fdf4" : "#ffffff",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            backgroundColor: roleBadgeColor,
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "13px",
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                {target.name}
                              </span>
                              <span style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: roleBadgeColor,
                                backgroundColor: roleBadgeBg,
                                padding: "2px 6px",
                                borderRadius: "6px",
                                letterSpacing: "0.02em"
                              }}>
                                {target.role}
                              </span>
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span>{target.designation || target.role}</span>
                              {target.department && <span>• {target.department}</span>}
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>{target.email}</div>
                          </div>
                        </div>

                        <div>
                          {isCurrent ? (
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#047857", padding: "6px 12px", borderRadius: "6px", backgroundColor: "#d1fae5" }}>
                              Active Now
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={switchingId === target.id}
                              onClick={() => handleSwitch(target)}
                              style={{
                                backgroundColor: "#0f172a",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                padding: "6px 14px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: switchingId === target.id ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              {switchingId === target.id ? "Switching..." : "View Dashboard →"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {isImpersonating ? "In impersonation mode" : "Admin view active"}
              </span>
              {isImpersonating && (
                <button
                  type="button"
                  onClick={handleExit}
                  style={{
                    background: "none",
                    border: "1px solid #cbd5e1",
                    color: "#dc2626",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Exit to Admin Profile
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
