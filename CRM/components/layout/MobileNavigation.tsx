"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./mobile-navigation.css";
import { House, Building2, CheckSquare2, Target, Grid2X2, ChevronRight, Users, FileText, Wrench, CalendarDays, Package, BarChart3, Settings, Briefcase, Megaphone, ShieldCheck, CircleDollarSign, MessageSquare, Award, ClipboardList } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/tasks?member=my", label: "Tasks", icon: CheckSquare2 },
  { href: "/leads", label: "Pipeline", icon: Target },
];
const groups = [
  { title: "Customers & sales", items: [
    { href: "/people", label: "People directory", icon: Users },
    { href: "/enquiries", label: "Website enquiries", icon: MessageSquare },
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/sales", label: "Invoices & payments", icon: CircleDollarSign },
    { href: "/product-expiry", label: "Product expiry", icon: ClipboardList },
  ] },
  { title: "Work & service", items: [
    { href: "/tasks?member=all", label: "Team tasks", icon: Users },
    { href: "/tasks?member=my&section=completed", label: "Completed work", icon: CheckSquare2 },
    { href: "/tasks?member=all&section=declined", label: "Declined tasks", icon: ClipboardList },
    { href: "/calendar", label: "Client work calendar", icon: CalendarDays },
    { href: "/services", label: "Service tickets", icon: Wrench },
    { href: "/service-calendar", label: "Service calendar", icon: CalendarDays },
    { href: "/amc", label: "Service track", icon: ClipboardList },
    { href: "/maintenance-contracts", label: "Maintenance contracts", icon: ShieldCheck },
  ] },
  { title: "Products & procurement", items: [
    { href: "/products", label: "Product catalogue", icon: Package },
    { href: "/companies", label: "Trader companies", icon: Building2 },
    { href: "/brands", label: "Medical brands", icon: Award },
  ] },
  { title: "Workspace", items: [
    { href: "/reports", label: "Reports & analytics", icon: BarChart3 },
    { href: "/employees", label: "Employees", icon: Users },
    { href: "/ems", label: "Employee workspace", icon: Briefcase },
    { href: "/marketing", label: "Marketing", icon: Megaphone },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/hub", label: "Workspace hub", icon: Grid2X2 },
  ] },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const navigateFromMenu = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    // Retain the menu until the route commits, so its tap cannot hit the page below.
    router.push(href);
    if (pathname === href.split("?")[0]) setOpen(false);
  };
  return <>
    <nav className="crm-mobile-nav app-tabbar" aria-label="Main navigation">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = !open && (pathname.startsWith(href.split("?")[0]) || (pathname === "/app-preview" && href === "/dashboard"));
        return <Link key={href} href={pathname === "/app-preview" && href === "/dashboard" ? "/app-preview" : href} aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={() => setOpen(false)}><Icon size={23} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" /><span>{label}</span></Link>;
      })}
      <button type="button" aria-label="More sections" aria-expanded={open} aria-controls="mobile-more-sections" onClick={() => setOpen(value => !value)} className={open || (pathname !== "/app-preview" && !tabs.some(tab => pathname.startsWith(tab.href.split("?")[0]))) ? "active" : ""}><Grid2X2 size={23} aria-hidden="true" /><span>More</span></button>
    </nav>
    {open && typeof document !== "undefined" && createPortal(
      <section id="mobile-more-sections" className="app-module-menu mobile-more-panel" aria-label="All sections" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <div className="app-menu-scroll">{groups.map(group => <section key={group.title}><h3>{group.title}</h3><div className="app-menu-group">{group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={(event) => navigateFromMenu(event, href)}><span className="app-module-icon"><Icon size={20}/></span><span>{label}</span><ChevronRight size={17} aria-hidden="true"/></Link>)}</div></section>)}</div>
        <nav className="crm-mobile-nav app-tabbar app-menu-tabbar" aria-label="Main navigation">
          {tabs.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={(event) => navigateFromMenu(event, href)}><Icon size={23} strokeWidth={1.8} aria-hidden="true"/><span>{label}</span></Link>)}
          <button type="button" onClick={() => setOpen(false)} className="active" aria-label="Close More menu"><Grid2X2 size={23} aria-hidden="true"/><span>More</span></button>
        </nav>
      </section>, document.body)}
  </>;
}
