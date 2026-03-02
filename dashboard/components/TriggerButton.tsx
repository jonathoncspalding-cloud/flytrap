"use client";

import { useState } from "react";

export default function TriggerButton({ agent }: { agent: string }) {
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    try {
      const resp = await fetch("/api/agent-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      if (resp.ok) {
        setTriggered(true);
        setTimeout(() => setTriggered(false), 5000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleTrigger}
      disabled={loading || triggered}
      style={{
        fontSize: 9,
        padding: "2px 8px",
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: triggered ? "rgba(42,140,74,0.15)" : "transparent",
        color: triggered ? "#2a8c4a" : "var(--text-tertiary)",
        cursor: loading || triggered ? "default" : "pointer",
        fontWeight: 500,
      }}
    >
      {loading ? "..." : triggered ? "Triggered" : "Run"}
    </button>
  );
}
