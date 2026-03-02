export default function BriefingsLoading() {
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
        <div className="skeleton" style={{ width: 180, height: 14 }} />
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "24px 28px",
      }}>
        <div className="skeleton" style={{ width: 120, height: 18, marginBottom: 20 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{
            width: `${70 + Math.random() * 25}%`, height: 12, marginBottom: 10,
          }} />
        ))}
      </div>
    </div>
  );
}
