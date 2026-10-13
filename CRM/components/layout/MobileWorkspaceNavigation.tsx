"use client";
import { usePathname } from "next/navigation";
import MobileNavigation from "./MobileNavigation";

export default function MobileWorkspaceNavigation() {
  const pathname = usePathname();
  if (!["/hub", "/ems", "/settings", "/marketing"].some(route => pathname === route || pathname.startsWith(`${route}/`))) return null;
  return <div className="app-workspace-tabs"><MobileNavigation /></div>;
}
