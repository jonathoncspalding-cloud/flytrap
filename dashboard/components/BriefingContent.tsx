"use client";

/**
 * BriefingContent — Client component that renders briefing markdown.
 * react-markdown is an ESM-only package; wrapping in a client component
 * prevents server-side import issues with Next.js bundler.
 */

import ReactMarkdown from "react-markdown";

interface BriefingContentProps {
  content: string;
}

export default function BriefingContent({ content }: BriefingContentProps) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => (
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "24px 0 10px", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "16px 0 8px" }}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, margin: "0 0 12px" }}>
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>{children}</em>
        ),
        hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />,
        ul: ({ children }) => (
          <ul style={{ paddingLeft: 20, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {children}
          </ul>
        ),
        li: ({ children }) => (
          <li style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, listStyleType: "disc" }}>
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote style={{ borderLeft: "3px solid rgba(255,255,255,0.15)", paddingLeft: 16, margin: "12px 0", color: "var(--text-tertiary)", fontStyle: "italic" }}>
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
