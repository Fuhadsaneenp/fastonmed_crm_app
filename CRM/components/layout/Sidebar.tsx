"use client";
import { Suspense, useState, useEffect, useMemo, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Notification as AppNotification } from "@/types";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notification-store";
import { clearAuthSession } from "@/lib/api-client";
import FastonmedLogo, { FastonmedIcon } from "@/components/FastonmedLogo";
import {
  LayoutDashboard,
  Building2,
  Target,
  CircleDollarSign,
  Package,
  Wrench,
  ShieldCheck,
  CheckSquare2,
  BarChart3,
  LogOut,
  LayoutGrid,
  TrendingUp,
  ChevronDown,
  Boxes,
  Users,
  UserCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  Award,
  Bell,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";

type NavSubItem = {
  href: string;
  icon: any;
  label: string;
};

type NavItem = {
  href?: string;
  icon: any;
  label: string;
  children?: NavSubItem[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/clients", icon: Building2, label: "Organisation" },
  { href: "/people", icon: Users, label: "People" },
  {
    label: "Tasks",
    icon: CheckSquare2,
    children: [
      { href: "/tasks?member=my", icon: UserCheck, label: "My Tasks" },
      { href: "/calendar", icon: CalendarDays, label: "Client Work Calendar" },
      { href: "/tasks?member=my&section=completed", icon: CheckSquare2, label: "My Completed Work" },
      { href: "/tasks?member=all", icon: Users, label: "My Team Tasks" },
      { href: "/tasks?member=all&section=declined", icon: CheckSquare2, label: "Declined Tasks" },
    ],
  },
  {
    label: "Sales & Services Overview",
    icon: TrendingUp,
    children: [
      { href: "/enquiries", icon: MessageSquare, label: "Enquiries" },
      { href: "/leads", icon: Target, label: "Leads & Pipeline" },
      { href: "/quotations", icon: FileText, label: "Quotation" },
      { href: "/sales", icon: CircleDollarSign, label: "Invoice & Payment" },
      { href: "/product-expiry", icon: ClipboardList, label: "Product Expiry" },
    ],
  },
  {
    label: "Procurement",
    icon: Boxes,
    children: [
      { href: "/products", icon: Package, label: "Products" },
      { href: "/companies", icon: Building2, label: "Trader Company" },
      { href: "/brands", icon: Award, label: "Brands" },
    ],
  },
  {
    label: "Service",
    icon: Wrench,
    children: [
      { href: "/service-calendar", icon: CalendarDays, label: "Service Calendar" },
      { href: "/amc", icon: ClipboardList, label: "Service Track" },
      { href: "/maintenance-contracts", icon: ShieldCheck, label: "Maintenance Contract" },
    ],
  },
  { href: "/reports", icon: BarChart3, label: "Reports" },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  isMobile: boolean;
};

function SidebarContent({ collapsed, onToggle, onMobileClose, isMobile }: SidebarProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || "";
  const searchParams = useSearchParams();
  const [clickedHref, setClickedHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Tasks": true,
    "Sales & Services Overview": true,
    "Procurement": true,
    "Service": true,
  });

  // Reset optimistic state when navigation completes
  useEffect(() => {
    setClickedHref(null);
  }, [pathname, searchParams]);

  const isSubItemActive = (subHref: string) => {
    if (clickedHref !== null) {
      return clickedHref === subHref;
    }
    if (subHref === "/calendar" && (pathname === "/calendar" || pathname === "/tasks/calendar")) {
      return true;
    }
    if (subHref.includes("?")) {
      const [subPath, subQuery] = subHref.split("?");
      if (pathname !== subPath) return false;

      const params = new URLSearchParams(subQuery);
      const subMember = (params.get("member") || "my").toLowerCase();
      const subSection = (params.get("section") || "").toLowerCase();

      const currentMember = (searchParams?.get("member") || (pathname === "/tasks" ? "my" : "")).toLowerCase();
      const currentSection = (searchParams?.get("section") || "").toLowerCase();

      return currentMember === subMember && currentSection === subSection;
    }
    return pathname === subHref || (pathname.startsWith(subHref + "/") && subHref !== "/");
  };

  const isItemGroupActive = (children: NavSubItem[]) => {
    return children.some((sub) => {
      if (sub.href === "/calendar" && (pathname === "/calendar" || pathname === "/tasks/calendar")) {
        return true;
      }
      if (sub.href.includes("?")) {
        const [subPath] = sub.href.split("?");
        return pathname === subPath;
      }
      return pathname === sub.href || (pathname.startsWith(sub.href + "/") && sub.href !== "/");
    });
  };

  useEffect(() => {
    setExpandedGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of NAV_ITEMS) {
        if (item.children && !prev[item.label]) {
          const matches = item.children.some((sub) => {
            const subBase = sub.href.split("?")[0];
            return pathname.startsWith(subBase) || (sub.href === "/calendar" && pathname.startsWith("/tasks/calendar"));
          });
          if (matches) {
            next[item.label] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    try {
      const u = localStorage.getItem("fastonmed_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    window.location.href = "/login";
  };

  const width = collapsed ? 68 : 260;

  return (
    <aside className={isMobile ? "crm-sidebar-mobile" : "crm-sidebar-desktop"}
      style={{
        width,
        minWidth: width,
        height: "100%",
        background: "#002533",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s ease",
        overflow: "hidden",
        position: isMobile ? "fixed" : "relative",
        zIndex: isMobile ? 50 : 20,
        left: 0,
        top: 0,
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Mobile overlay */}
      {isMobile && (
        <div data-mobile-overlay="true"
          onClick={onMobileClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: -1,
          }}
        />
      )}

      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "20px 12px" : "20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 12,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        {collapsed ? (
          <FastonmedIcon size={28} />
        ) : (
          <FastonmedLogo size="sm" theme="dark" />
        )}
      </div>

      {isMobile && <button type="button" onClick={onMobileClose} aria-label="Close navigation" style={{ position: "absolute", top: 12, right: 8, width: 44, height: 44, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "#003749", color: "white", cursor: "pointer" }}><X size={20} /></button>}

      {/* Switch Workspace Hub Link */}
      <div style={{ padding: "10px 8px 4px 8px" }}>
        <Link
          href="/hub"
          onClick={() => {
            setClickedHref(null);
            if (isMobile) onMobileClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: collapsed ? "8px" : "8px 12px",
            borderRadius: 8,
            backgroundColor: "rgba(66, 182, 156, 0.12)",
            border: "1px solid rgba(66, 182, 156, 0.28)",
            color: "#42b69c",
            textDecoration: "none",
            fontSize: 12.5,
            fontWeight: 600,
            justifyContent: collapsed ? "center" : "flex-start",
            transition: "background-color 0.12s ease, color 0.12s ease",
          }}
          title="Back to Workspace Hub"
        >
          <LayoutGrid size={15} color="#42b69c" style={{ flexShrink: 0 }} />
          {!collapsed && <span>Workspace Hub</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto", opacity: isPending ? 0.7 : 1, transition: "opacity 0.1s ease" }}>
        {NAV_ITEMS.map((item) => {
          if (item.children) {
            const isGroupActive = isItemGroupActive(item.children);
            const GroupIcon = item.icon;
            const isExpanded = !!expandedGroups[item.label];

            if (collapsed) {
              return (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 2 }}>
                  {item.children.map((sub) => {
                    const subActive = isSubItemActive(sub.href);
                    const SubIcon = sub.icon;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => {
                          setClickedHref(sub.href);
                          if (isMobile) onMobileClose();
                        }}
                        title={`${item.label}: ${sub.label}`}
                        className={`sidebar-nav-link${subActive ? " active" : ""}`}
                        style={{ justifyContent: "center", padding: "10px 14px", marginBottom: 2 }}
                      >
                        <SubIcon size={18} strokeWidth={subActive ? 2.2 : 1.8} color={subActive ? "#42b69c" : "#94a3b8"} />
                      </Link>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={item.label} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={`sidebar-group-btn${isGroupActive ? " active" : ""}`}
                  style={{ padding: "9px 12px", marginBottom: 2 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <GroupIcon
                      size={18}
                      strokeWidth={isGroupActive ? 2.2 : 1.8}
                      color={isGroupActive ? "#42b69c" : "#94a3b8"}
                      style={{ flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13.5, fontWeight: isGroupActive ? 600 : 500 }}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronDown
                    size={15}
                    color={isGroupActive ? "#42b69c" : "#64748b"}
                    style={{
                      transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>

                {/* Sub-Items Indented Tree */}
                {isExpanded && (
                  <div
                    style={{
                      paddingLeft: 10,
                      marginTop: 2,
                      marginBottom: 4,
                      borderLeft: "2px solid rgba(66, 182, 156, 0.25)",
                      marginLeft: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {item.children.map((sub) => {
                      const subActive = isSubItemActive(sub.href);
                      const SubIcon = sub.icon;
                      return (
                        <div key={sub.href} style={{ display: "flex", flexDirection: "column" }}>
                          <Link
                            href={sub.href}
                            onClick={() => {
                              setClickedHref(sub.href);
                              if (isMobile) onMobileClose();
                            }}
                            className={`sidebar-sub-link${subActive ? " active" : ""}`}
                            style={{ gap: 10, padding: "7px 10px", fontSize: 13, fontWeight: subActive ? 600 : 400 }}
                          >
                            <SubIcon
                              size={15}
                              strokeWidth={subActive ? 2.2 : 1.8}
                              color={subActive ? "#42b69c" : "#94a3b8"}
                              style={{ flexShrink: 0 }}
                            />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sub.label}
                            </span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = item.href ? (clickedHref ? clickedHref === item.href : pathname.startsWith(item.href)) : false;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href || "#"}
              onClick={() => {
                setClickedHref(item.href || null);
                if (isMobile) onMobileClose();
              }}
              className={`sidebar-nav-link${active ? " active" : ""}`}
              style={{
                gap: 12,
                padding: collapsed ? "10px 14px" : "9px 12px",
                marginBottom: 2,
                whiteSpace: "nowrap",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? "#42b69c" : "#94a3b8"}
                style={{ flexShrink: 0 }}
              />
              {!collapsed && (
                <span style={{ fontSize: 13.5, fontWeight: active ? 600 : 400 }}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div
        style={{
          padding: "12px 8px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {!collapsed && user && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #004d66, #42b69c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  color: "#e2e8f0",
                  fontSize: 13,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name}
              </div>
              <div style={{ color: "#475569", fontSize: 11 }}>{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: collapsed ? "10px" : "8px 12px",
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.15)",
            borderRadius: 8,
            color: "#f87171",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
          }}
        >
          <LogOut size={16} color="#f87171" style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense
      fallback={
        <aside
          style={{
            width: props.collapsed ? 68 : 260,
            backgroundColor: "#032d38",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        />
      }
    >
      <SidebarContent {...props} />
    </Suspense>
  );
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  onMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
};

export function Header({ title, subtitle, onMobileMenu, mobileMenuOpen }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; email?: string; role?: string } | null>(null);
  const currentUserRef = useRef<{ id?: string; name: string; email?: string; role?: string } | null>(null);
  const unread = notifications.filter((n) => !n.read).length;

  const refreshNotifications = useCallback((userObj?: any) => {
    const user = userObj || currentUserRef.current;
    if (user && user.name) {
      const userNotifs = getUserNotifications(user);
      setNotifications(userNotifs);
    } else {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    const loadUserAndNotifs = () => {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("fastonmed_user") : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.name) {
            const current = currentUserRef.current;
            if (!current || current.name !== parsed.name || current.id !== parsed.id) {
              currentUserRef.current = parsed;
              setCurrentUser(parsed);
            }
            refreshNotifications(parsed);
            return;
          }
        }
        if (currentUserRef.current !== null) {
          currentUserRef.current = null;
          setCurrentUser(null);
          setNotifications([]);
        }
      } catch {}
    };

    const handleRefresh = () => refreshNotifications();

    loadUserAndNotifs();
    window.addEventListener("fastonmed_user_updated", loadUserAndNotifs);
    window.addEventListener("fastonmed_tasks_updated", handleRefresh);
    window.addEventListener("fastonmed_notifications_updated", handleRefresh);

    return () => {
      window.removeEventListener("fastonmed_user_updated", loadUserAndNotifs);
      window.removeEventListener("fastonmed_tasks_updated", handleRefresh);
      window.removeEventListener("fastonmed_notifications_updated", handleRefresh);
    };
  }, [refreshNotifications]);

  const userInitials = useMemo(() => {
    if (!currentUser?.name) return "FM";
    const parts = currentUser.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [currentUser?.name]);

  const markAllRead = () => {
    if (!currentUser) return;
    markAllNotificationsAsRead(currentUser, notifications.map((n) => n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };


  return (
    <header
      className="crm-header"
      style={{
        height: 64,
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 14,
        position: "sticky",
        top: 0,
        zIndex: 30,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {onMobileMenu && <button type="button" className="crm-mobile-menu-button" onClick={onMobileMenu} aria-label="Open all CRM sections" aria-expanded={mobileMenuOpen}><Menu size={24} aria-hidden="true" /></button>}

      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pathname === "/dashboard" ? <><span className="app-brand-title"><img src="/fastonmed-logo.png" alt="FastonMed" width={150} height={25} style={{ width: 150, height: "auto", display: "block" }} /></span><span className="app-desktop-title">{title}</span></> : title}</h1>
        {subtitle && <p style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</p>}
      </div>

      {/* Interactive Global Search */}
      <form
        className="crm-header-search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = (e.currentTarget.elements.namedItem("search") as HTMLInputElement)?.value?.trim();
          if (q) {
            router.push(`/clients?search=${encodeURIComponent(q)}`);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "5px 10px",
          fontSize: 13,
          color: "#94a3b8",
          maxWidth: 240,
        }}
      >
        <span style={{ fontSize: 13 }}>🔍</span>
        <input
          name="search"
          type="text"
          placeholder="Search... (⌘K)"
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 12.5,
            color: "#0f172a",
            width: "100%",
          }}
        />
        <span
          style={{
            background: "#e2e8f0",
            padding: "1px 5px",
            borderRadius: 4,
            fontSize: 10.5,
            fontWeight: 600,
            color: "#64748b",
          }}
        >
          ⌘K
        </span>
      </form>

      {/* Workspace Hub quick switcher */}
      <Link className="crm-header-hub"
        href="/hub"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #b2e7d9",
          backgroundColor: "#eaf8f4",
          color: "#004d66",
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
          transition: "all 0.15s ease",
        }}
        title="Switch to Workspace Hub"
      >
        <span style={{ fontSize: 13, color: "#42b69c" }}>⊞</span>
        <span>Workspace Hub</span>
      </Link>

      {/* Notifications */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            backgroundColor: showNotifications ? "#f0fdfa" : "#ffffff",
            color: showNotifications ? "#004d66" : "#475569",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f0fdfa";
            e.currentTarget.style.borderColor = "#ccfbf1";
            e.currentTarget.style.color = "#004d66";
          }}
          onMouseLeave={(e) => {
            if (!showNotifications) {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.color = "#475569";
            }
          }}
          title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        >
          <Bell size={17} />
          {unread > 0 && (
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                backgroundColor: "#dc2626",
                color: "#ffffff",
                borderRadius: 9999,
                fontSize: 9.5,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }}
            >
              {unread}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="crm-notifications"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 360,
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#ffffff",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Notifications</span>
                  {unread > 0 && (
                    <span
                      style={{
                        background: "#dc2626",
                        color: "white",
                        borderRadius: 9999,
                        padding: "1px 7px",
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </div>
                {currentUser && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    Inbox for {currentUser.name}
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#004d66",
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "34px 20px", textAlign: "center", color: "#64748b" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🔔</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>All caught up!</div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                    No new task assignments or updates for {currentUser?.name || "you"}.
                  </div>
                </div>
              ) : (
                notifications.map((n) => {
                  const icons = { info: "📋", warning: "⚠️", success: "✅", error: "🔴" };
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: "11px 16px",
                        borderBottom: "1px solid #f8fafc",
                        background: n.read ? "transparent" : "#f0f9ff",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (n.read) e.currentTarget.style.backgroundColor = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        if (n.read) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      onClick={() => {
                        if (currentUser) {
                          markNotificationAsRead(currentUser, n.id);
                        }
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
                        );
                        if (n.link) router.push(n.link);
                        setShowNotifications(false);
                      }}
                    >
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{icons[n.type] || "📋"}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 2, color: n.read ? "#334155" : "#0f172a" }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.35 }}>{n.message}</div>
                          <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>
                            {new Date(n.createdAt).toLocaleString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Account menu"
        aria-expanded={showAccountMenu}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setShowAccountMenu(value => !value); } else if (event.key === "Escape") setShowAccountMenu(false); }}
        onClick={() => setShowAccountMenu(value => !value)}
        title={currentUser ? `${currentUser.name} (${currentUser.role || "User"})` : "View employees & team directory"}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #004d66, #0284c7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          position: "relative",
          boxShadow: "0 1px 3px rgba(0, 77, 102, 0.25)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 3px 6px rgba(0, 77, 102, 0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 77, 102, 0.25)";
        }}
      >
        <span>{userInitials}</span>
        {/* Active status indicator */}
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 9,
            height: 9,
            borderRadius: "50%",
            backgroundColor: "#10b981",
            border: "2px solid #ffffff",
          }}
          title="Active online"
        />
      </div>
      {showAccountMenu && <>
        <button className="account-menu-backdrop" aria-label="Close account menu" onClick={() => setShowAccountMenu(false)} />
        <div className="crm-account-menu">
          <strong>{currentUser?.name || "Your account"}</strong><span>{currentUser?.role || ""}</span>
          <button type="button" onClick={() => { setShowAccountMenu(false); router.push("/profile"); }}><Users size={17}/>My profile</button>
          <button type="button" onClick={() => { setShowAccountMenu(false); router.push("/employees"); }}><Users size={17}/>Team directory</button>
          <button type="button" className="account-signout" onClick={() => { clearAuthSession(); window.location.href = "/login"; }}><LogOut size={17}/>Sign out</button>
        </div>
      </>}
    </header>
  );
}
