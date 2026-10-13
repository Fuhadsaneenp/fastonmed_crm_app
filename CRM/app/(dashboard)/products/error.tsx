"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function ProductsErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Products page runtime error caught:", error);
  }, [error]);

  const handleReset = () => {
    try {
      reset();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "55vh",
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#fef2f2",
          color: "#dc2626",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <AlertTriangle size={28} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
        Unable to display products catalog
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", maxWidth: 460, margin: "0 0 20px", lineHeight: 1.5 }}>
        A temporary error occurred while rendering the products list. Click below to reload the catalog data cleanly.
      </p>
      <button
        type="button"
        onClick={handleReset}
        style={{
          backgroundColor: "#004d66",
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          padding: "9px 20px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <RefreshCw size={14} />
        <span>Reload Products</span>
      </button>
    </div>
  );
}
