"use client";

import { useEffect, useState } from "react";

interface ProposalOption {
  label: string;
  description: string;
  preview: string; // base64 data URI
}

interface Proposal {
  id: string;
  category: string;
  description: string;
  createdAt: string;
  footprint: { w: number; h: number };
  options: ProposalOption[];
  targets: { uid: string; type: string; col: number; row: number }[];
}

export default function IsabelProposal() {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/proposals/isabel.json")
      .then((r) => {
        if (!r.ok) throw new Error("No proposal");
        return r.json();
      })
      .then((data) => setProposal(data))
      .catch(() => setProposal(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !proposal) return null;

  async function handleSelect(index: number) {
    setSelecting(index);
    try {
      const resp = await fetch("/api/isabel-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: index }),
      });
      if (resp.ok) {
        setDone(true);
      }
    } catch {
      setSelecting(null);
    }
  }

  if (done) {
    return (
      <div style={{
        gridColumn: "1 / -1",
        background: "var(--surface)",
        border: "1px solid #2dd4bf33",
        borderRadius: 10,
        padding: 16,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: "#2dd4bf", fontWeight: 600, marginBottom: 4 }}>
          Implementing &ldquo;{proposal.options[selecting ?? 0]?.label}&rdquo;...
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
          Isabel is working her magic. The office will update in a few minutes.
        </div>
      </div>
    );
  }

  const ZOOM = 4;

  return (
    <div style={{
      gridColumn: "1 / -1",
      background: "var(--surface)",
      border: "1px solid #2dd4bf33",
      borderRadius: 10,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Accent bar */}
      <div style={{
        height: 2,
        background: "linear-gradient(90deg, #2dd4bf, #2dd4bf33)",
      }} />

      <div style={{ padding: "16px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>🎨</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#2dd4bf" }}>
            Isabel&rsquo;s Weekly Proposal
          </span>
          <span style={{
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 4,
            background: "#2dd4bf15",
            color: "#2dd4bf",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {proposal.category}
          </span>
        </div>

        {/* Isabel's pitch */}
        <p style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          fontStyle: "italic",
          margin: "0 0 16px",
          lineHeight: 1.5,
        }}>
          &ldquo;{proposal.description}&rdquo;
        </p>

        {/* Options grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}>
          {proposal.options.map((option, i) => (
            <div
              key={i}
              style={{
                background: selecting === i ? "#2dd4bf12" : "var(--bg)",
                border: `1px solid ${selecting === i ? "#2dd4bf55" : "var(--border)"}`,
                borderRadius: 8,
                padding: 12,
                textAlign: "center",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              {/* Preview image */}
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 8,
                minHeight: proposal.footprint.h * ZOOM,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={option.preview}
                  alt={option.label}
                  width={proposal.footprint.w * ZOOM}
                  height={proposal.footprint.h * ZOOM}
                  style={{
                    imageRendering: "pixelated",
                    display: "block",
                  }}
                />
              </div>

              {/* Label */}
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 2,
              }}>
                {option.label}
              </div>

              {/* Description */}
              <div style={{
                fontSize: 9,
                color: "var(--text-tertiary)",
                marginBottom: 8,
                lineHeight: 1.4,
              }}>
                {option.description}
              </div>

              {/* Select button */}
              <button
                onClick={() => handleSelect(i)}
                disabled={selecting !== null}
                style={{
                  fontSize: 10,
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "1px solid #2dd4bf44",
                  background: selecting === i ? "#2dd4bf" : "transparent",
                  color: selecting === i ? "#000" : "#2dd4bf",
                  cursor: selecting !== null ? "default" : "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                {selecting === i ? "Selecting..." : "Select"}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          fontSize: 9,
          color: "var(--text-tertiary)",
          marginTop: 10,
          textAlign: "right",
        }}>
          Replacing {proposal.targets.length} {proposal.category.toLowerCase()} in the office
        </div>
      </div>
    </div>
  );
}
