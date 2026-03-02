import React from "react";

/**
 * Lightweight inline markdown renderer for chat messages.
 * Handles: **bold**, *italic*, `code`, [links](url), --- (hr), bullet lists (- item),
 * numbered lists (1. item), and ### headings.
 * No external deps — just React elements.
 */
export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      result.push(
        <hr key={`hr-${i}`} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />
      );
      continue;
    }

    // Headings (### or ##)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? 15 : level === 2 ? 14 : 13;
      result.push(
        <div key={`h-${i}`} style={{ fontSize, fontWeight: 700, color: "var(--chat-text-primary, rgba(255,255,255,0.9))", margin: "10px 0 4px" }}>
          {renderInline(headingMatch[2])}
        </div>
      );
      continue;
    }

    // Bullet list items (- item or * item)
    const bulletMatch = line.match(/^[\s]*[-*\u2022\u00b7]\s+(.+)/);
    if (bulletMatch) {
      result.push(
        <div key={`li-${i}`} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
          <span style={{ color: "var(--text-tertiary)", flexShrink: 0, userSelect: "none" }}>{"\u2014"}</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
      continue;
    }

    // Numbered list items (1. item)
    const numMatch = line.match(/^[\s]*(\d+)\.\s+(.+)/);
    if (numMatch) {
      result.push(
        <div key={`ol-${i}`} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
          <span style={{ color: "var(--text-tertiary)", flexShrink: 0, minWidth: 14, textAlign: "right", userSelect: "none" }}>{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Empty line → small spacer
    if (line.trim() === "") {
      result.push(<div key={`br-${i}`} style={{ height: 6 }} />);
      continue;
    }

    // Regular line
    result.push(
      <span key={`p-${i}`}>
        {renderInline(line)}
        {i < lines.length - 1 && lines[i + 1]?.trim() !== "" ? "\n" : ""}
      </span>
    );
  }

  return result;
}

/** Parse inline markdown: **bold**, *italic*, `code`, [link](url) */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex matches: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={`b-${key++}`} style={{ fontWeight: 700, color: "var(--chat-text-primary, rgba(255,255,255,0.9))" }}>
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={`i-${key++}`} style={{ fontStyle: "italic", opacity: 0.85 }}>
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={`c-${key++}`} style={{
          fontSize: "0.9em",
          padding: "1px 5px",
          borderRadius: 4,
          background: "rgba(255,255,255,0.08)",
          fontFamily: "monospace",
        }}>
          {match[4]}
        </code>
      );
    } else if (match[5] && match[6]) {
      // [link](url)
      parts.push(
        <a key={`a-${key++}`} href={match[6]} target="_blank" rel="noopener noreferrer"
          style={{ color: "#2a8c4a", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {match[5]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
