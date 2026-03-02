export default function ResearchLoading() {
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
        <div className="skeleton" style={{ width: 140, height: 22, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 220, height: 14 }} />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 12,
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 16,
          }}>
            <div className="skeleton" style={{ width: "80%", height: 14, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: "95%", height: 10, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: "65%", height: 10, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 70, height: 9 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
