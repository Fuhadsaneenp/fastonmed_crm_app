"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { Sidebar, Header } from "@/components/layout/Sidebar";
import { clearAuthSession, getAuthToken, saveAuthSession } from "@/lib/api-client";
import WooCommerceSync from "@/components/WooCommerceSync";
import { syncAllSharedBrowserData } from "@/lib/shared-data-client";

import { GlobalImpersonationBar } from "@/components/GlobalImpersonationBar";

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/profile": { title: "My Profile", subtitle: "Personal details and security" },
  "/dashboard": { title: "Dashboard", subtitle: "FastonMed Business Overview" },
  "/tasks": { title: "Tasks", subtitle: "Task Management & Team Workload" },
  "/clients": { title: "Organisations", subtitle: "Hospitals, Clinics & Healthcare Facilities" },
  "/people": { title: "People Directory", subtitle: "Healthcare Professionals, Engineers & Decision Makers" },
  "/leads": { title: "Leads & Pipeline", subtitle: "Sales pipeline management" },
  "/enquiries": { title: "Website Enquiries", subtitle: "RFQs and consultation requests received from fastonmed.com" },
  "/quotations": { title: "Quotation", subtitle: "Medical equipment quotations, price estimates & client proposals" },
  "/sales": { title: "Invoice & Payment", subtitle: "Invoices, customer billing & accounts receivable" },
  "/product-expiry": { title: "Product Expiry", subtitle: "Sold products, warranty and contract expiry tracking" },
  "/products": { title: "Product Catalog", subtitle: "Medical equipment database" },
  "/service-calendar": { title: "Service Reminder Calendar", subtitle: "Only service visits, repairs, maintenance and calibration tasks" },
  "/services": { title: "Service Management", subtitle: "Tickets, repairs & maintenance" },
  "/amc": { title: "Service Track", subtitle: "Scheduled maintenance, calibration and service tasks sheet" },
  "/employees": { title: "Employees", subtitle: "Team management & performance" },
  "/companies": { title: "Trader Companies", subtitle: "UAE Medical Equipment & Consumable Suppliers" },
  "/brands": { title: "Medical Brands", subtitle: "Authorized Brands & Global Manufacturer Directory" },
  "/maintenance-contracts": { title: "Maintenance Contracts", subtitle: "Annual Maintenance Contracts & SLA" },
  "/reports": { title: "Reports & Analytics", subtitle: "FastonMed Business Performance & Metrics" },
  "/calendar": { title: "Client Work Calendar", subtitle: "Team Schedule & Activities" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("fastonmed_user");
    if (!user) {
      clearAuthSession();
      router.push("/login");
      return;
    }
    // Ensure active token is available
    if (!getAuthToken()) {
      try {
        const parsed = JSON.parse(user);
        saveAuthSession(parsed, "session-token-" + (parsed.id || Date.now()));
      } catch {
        clearAuthSession();
        router.push("/login");
        return;
      }
    }

    // Upload any records created while the server was unavailable, then hydrate
    // this browser with the shared database used by every signed-in employee.
    // Give the active page priority over the whole-workspace migration.
    const syncDelay = window.setTimeout(() => {
      if (document.visibilityState === "visible" && window.innerWidth >= 768) {
        void syncAllSharedBrowserData();
      }
    }, 15_000);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(syncDelay);
      window.removeEventListener("resize", handleResize);
    };
  }, [router]);

  // Find the closest matching page title
  const pageKey = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k)) || "/dashboard";
  const pageInfo = PAGE_TITLES[pageKey] || { title: "FastonMed" };

  return (
    <div className="crm-app-shell" style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: "#f8fafc" }}>
      <GlobalImpersonationBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        <WooCommerceSync />
        {/* Desktop sidebar */}
        {!isMobile && (
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            onMobileClose={() => setMobileOpen(false)}
            isMobile={false}
          />
        )}

        {/* Mobile sidebar overlay */}
        {isMobile && mobileOpen && (
          <Sidebar
            collapsed={false}
            onToggle={() => {}}
            onMobileClose={() => setMobileOpen(false)}
            isMobile={true}
          />
        )}

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", minWidth: 0 }}>
          <Header
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            onMobileMenu={() => setMobileOpen(true)}
            mobileMenuOpen={mobileOpen}
          />
          <main
            className="crm-main"
            style={{
              flex: 1,
              padding: isMobile ? "12px 14px" : "16px 24px",
              overflowY: "auto",
              maxWidth: 1600,
              width: "100%",
              margin: "0 auto",
            }}
          >
            {children}
          </main>
          <MobileNavigation />
        </div>
      </div>
    </div>
  );
}
