export default function TrendsLoading() {
  return (
    <div>
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

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 120, height: 22, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 200, height: 14 }} />
      </div>

      {/* Filter bar */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 16px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="skeleton" style={{ width: 40, height: 12 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {[60, 80, 70, 50, 65].map((w, i) => (
              <div key={i} className="skeleton" style={{ width: w, height: 24, borderRadius: 99 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 12,
      }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="skeleton" style={{ width: "65%", height: 14 }} />
              <div className="skeleton" style={{ width: 32, height: 20 }} />
            </div>
            <div className="skeleton" style={{ width: "90%", height: 10, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: "70%", height: 10, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div className="skeleton" style={{ width: 50, height: 16, borderRadius: 99 }} />
              <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
