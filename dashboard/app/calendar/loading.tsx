export default function CalendarLoading() {
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

      <div style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 130, height: 22, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 180, height: 14 }} />
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, overflow: "hidden",
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
          }}>
            <div className="skeleton" style={{ width: 60, height: 32, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: "70%", height: 14, marginBottom: 4 }} />
              <div className="skeleton" style={{ width: 80, height: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 50, height: 18, borderRadius: 99 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
