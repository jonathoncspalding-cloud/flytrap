export default function HomeLoading() {
  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Shimmer keyframes injected inline */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface-raised) 50%, var(--surface) 75%);
          background-size: 800px 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 6px;
        }
      `}</style>

      <div className="dashboard-grid">
        {/* Row 1: Briefing panel skeleton */}
        <div className="dash-card" style={{ gridColumn: "1 / 4", gridRow: "1", minHeight: 180 }}>
          <div className="skeleton" style={{ width: 120, height: 10, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: 160, height: 18, marginBottom: 14 }} />
          <div className="skeleton" style={{ width: "90%", height: 12, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: "75%", height: 12, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: "60%", height: 12, marginBottom: 20 }} />
          <div style={{
            background: "rgba(255,130,0,0.04)", border: "1px solid rgba(255,130,0,0.12)",
            borderRadius: 6, padding: "8px 10px",
          }}>
            <div className="skeleton" style={{ width: 140, height: 10, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: "80%", height: 14 }} />
          </div>
        </div>

        {/* Row 1: Signal Pulse skeleton */}
        <div className="dash-card" style={{ gridColumn: "4 / 6", gridRow: "1", minHeight: 180 }}>
          <div className="skeleton" style={{ width: 100, height: 10, marginBottom: 16 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 48, height: 28 }} />
            <div className="skeleton" style={{ width: 80, height: 12 }} />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div className="skeleton" style={{ width: 28, height: 10 }} />
              <div className="skeleton" style={{ flex: 1, height: 4 }} />
              <div className="skeleton" style={{ width: 22, height: 10 }} />
            </div>
          ))}
        </div>

        {/* Row 2: Moments skeleton */}
        <div className="dash-card" style={{ gridColumn: "1 / 4", gridRow: "2", minHeight: 200 }}>
          <div className="skeleton" style={{ width: 140, height: 10, marginBottom: 16 }} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 4 }} />
              <div className="skeleton" style={{ flex: 1, height: 12 }} />
              <div className="skeleton" style={{ width: 50, height: 16, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 28, height: 12 }} />
            </div>
          ))}
        </div>

        {/* Row 2: Calendar + Tensions skeleton */}
        <div style={{ gridColumn: "4 / 6", gridRow: "2", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="dash-card" style={{ flex: "0 0 auto" }}>
            <div className="skeleton" style={{ width: 80, height: 10, marginBottom: 14 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="skeleton" style={{ width: "85%", height: 12, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 60, height: 9 }} />
              </div>
            ))}
          </div>
          <div className="dash-card" style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 110, height: 10, marginBottom: 14 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="skeleton" style={{ flex: 1, height: 12 }} />
                <div className="skeleton" style={{ width: 40, height: 3 }} />
                <div className="skeleton" style={{ width: 20, height: 12 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
