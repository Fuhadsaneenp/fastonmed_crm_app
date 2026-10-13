import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./app-mobile.css";
import MobileWorkspaceNavigation from "@/components/layout/MobileWorkspaceNavigation";
import AttendanceTracker from "@/components/AttendanceTracker";
import { Toaster } from "react-hot-toast";

export const viewport: Viewport = { themeColor: "#004d66", width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "FastonMed CRM | Medical Equipment Management Platform",
  description:
    "FastonMed — Advanced CRM & ERP platform for medical equipment sales, service, AMC and client relationship management.",
  keywords: "medical equipment CRM, hospital equipment management, AMC tracking, biomedical CRM",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <AttendanceTracker />
        {children}
        <MobileWorkspaceNavigation />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#0f1729",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px",
              fontFamily: "Inter, sans-serif",
            },
            success: {
              iconTheme: { primary: "#059669", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#dc2626", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}
