export default function TensionsLoading() {
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
        <div className="skeleton" style={{ width: 160, height: 22, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 200, height: 14 }} />
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, overflow: "hidden",
      }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: `${50 + Math.random() * 30}%`, height: 14, marginBottom: 4 }} />
              <div className="skeleton" style={{ width: `${60 + Math.random() * 30}%`, height: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 50, height: 4, borderRadius: 2 }} />
            <div className="skeleton" style={{ width: 24, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
