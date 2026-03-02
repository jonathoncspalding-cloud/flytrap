export default function ForecastLoading() {
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
        <div className="skeleton" style={{ width: 180, height: 22, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 240, height: 14 }} />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div className="skeleton" style={{ width: 60, height: 9, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 40, height: 24 }} />
          </div>
        ))}
      </div>

      {/* Horizon sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 100, height: 12 }} />
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          {[1, 2].map((row) => (
            <div key={row} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "12px 14px", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: "70%", height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: "90%", height: 10 }} />
              </div>
              <div className="skeleton" style={{ width: 50, height: 20, borderRadius: 3, flexShrink: 0 }} />
              <div className="skeleton" style={{ width: 32, height: 14, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
