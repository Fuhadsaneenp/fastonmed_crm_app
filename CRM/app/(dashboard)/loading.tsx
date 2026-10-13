"use client";

export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 300,
        width: "100%",
        padding: 40,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 36,
            height: 36,
            border: "3px solid #e2e8f0",
            borderTopColor: "#42b69c",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#64748b", fontSize: 13, fontWeight: 500, margin: 0 }}>Loading...</p>
      </div>
    </div>
  );
}
