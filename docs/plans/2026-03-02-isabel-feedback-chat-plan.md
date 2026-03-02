# Isabel Feedback Chat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Give Feedback" button to Isabel's proposal card that opens her agent chat with proposal context, enables real-time design iteration via client-side Canvas rendering, and lets the user select a design directly from chat.

**Architecture:** IsabelProposal emits a callback when "Give Feedback" is clicked. The agents page converts this into a `CommandCenter` prop that opens AgentChat with Isabel pre-selected and a context prompt pre-filled. The agent-chat API augments Isabel's system prompt to output structured design specs. AgentChat parses these specs and renders Canvas previews inline. A new `isabel-canvas.ts` module ports the Python Pillow drawing functions to JavaScript Canvas.

**Tech Stack:** Next.js 14 App Router, React client components, HTML Canvas API, Anthropic Claude API (streaming), inline CSS with CSS variables.

---

### Task 1: Client-side Canvas Renderer (`isabel-canvas.ts`)

**Files:**
- Create: `dashboard/lib/isabel-canvas.ts`

**Step 1: Create the canvas renderer module**

This is a pure function module — no React, no side effects. It ports the 6 Python drawing functions from `scripts/agents/isabel_proposal.py` (lines 135-340) to Canvas.

```typescript
// dashboard/lib/isabel-canvas.ts

type RGB = [number, number, number];

type DrawCategory = "Paintings" | "Plants" | "Rug" | "Bookcases" | "Loveseats" | "Coffee Table";

export interface DesignSpec {
  category: DrawCategory;
  footprint: { w: number; h: number };
  options: {
    label: string;
    description: string;
    colors: RGB[];
  }[];
}

/** Render a single design option to a base64 PNG data URI. */
export function renderDesign(
  category: DrawCategory,
  w: number,
  h: number,
  colors: RGB[]
): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  switch (category) {
    case "Paintings": drawPainting(ctx, w, h, colors); break;
    case "Plants": drawPlant(ctx, w, h, colors); break;
    case "Rug": drawRug(ctx, w, h, colors); break;
    case "Bookcases": drawBookcase(ctx, w, h, colors); break;
    case "Loveseats": drawLoveseat(ctx, w, h, colors); break;
    case "Coffee Table": drawCoffeeTable(ctx, w, h, colors); break;
  }

  return canvas.toDataURL("image/png");
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number, a = 255) {
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  ctx.fillRect(x, y, 1, 1);
}

function clamp(v: number, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, v)); }
function noise(v: number, range = 10) { return clamp(v + Math.floor(Math.random() * range * 2) - range); }

// Port each Python draw function — same pixel-level logic, Canvas API instead of Pillow
// See scripts/agents/isabel_proposal.py lines 135-340 for reference

function drawPainting(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  // Frame
  const frame: RGB = [40, 30, 20];
  for (let x = 0; x < w; x++) { px(ctx, x, 0, ...frame); px(ctx, x, h - 1, ...frame); }
  for (let y = 0; y < h; y++) { px(ctx, 0, y, ...frame); px(ctx, w - 1, y, ...frame); }
  // Inner gradient with noise
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const ratio = (x / w) * 0.6 + (y / h) * 0.4;
      const idx = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 1);
      const c = colors[idx];
      px(ctx, x, y, noise(c[0]), noise(c[1]), noise(c[2]));
    }
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const potColor = colors[4] || [120, 70, 40];
  const potDark: RGB = [Math.max(0, potColor[0] - 30), Math.max(0, potColor[1] - 30), Math.max(0, potColor[2] - 30)];
  const potTop = Math.floor(h * 2 / 3);
  // Pot
  for (let y = potTop; y < h; y++) {
    const indent = Math.max(0, Math.floor((y - potTop) / 3));
    for (let x = 2 + indent; x < w - 2 - indent; x++) {
      const c = x < w / 2 ? potColor : potDark;
      px(ctx, x, y, ...c);
    }
  }
  // Pot rim
  for (let x = 1; x < w - 1; x++) {
    px(ctx, x, potTop, ...potColor);
    px(ctx, x, potTop - 1, ...potDark);
  }
  // Foliage
  const leafColors = colors.slice(0, 3);
  for (let y = 2; y < potTop - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const centerX = Math.floor(w / 2);
      const dist = Math.abs(x - centerX);
      const maxDist = Math.floor((potTop - y) * w / (2 * potTop)) + 2;
      if (dist <= maxDist && Math.random() > 0.25) {
        const c = leafColors[Math.floor(Math.random() * leafColors.length)];
        px(ctx, x, y, noise(c[0], 8), noise(c[1], 8), noise(c[2], 8));
      }
    }
  }
}

function drawRug(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const base = colors[0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(ctx, x, y, ...base);
  const border = colors[3] || colors[0];
  for (let x = 0; x < w; x++) { px(ctx, x, 0, ...border); px(ctx, x, h - 1, ...border); }
  for (let y = 0; y < h; y++) { px(ctx, 0, y, ...border); px(ctx, w - 1, y, ...border); }
  const a1 = colors[1], a2 = colors[2];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if ((x + y) % 4 === 0) px(ctx, x, y, ...a1);
      else if ((x + y) % 4 === 2) px(ctx, x, y, ...a2);
    }
  }
  const fringe = colors[4] || colors[1];
  for (let x = 1; x < w - 1; x += 2) { px(ctx, x, 0, ...fringe); px(ctx, x, h - 1, ...fringe); }
}

function drawBookcase(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const wood = colors[0], woodLight = colors[1];
  const woodDark: RGB = [Math.max(0, wood[0] - 20), Math.max(0, wood[1] - 20), Math.max(0, wood[2] - 20)];
  // Frame
  for (let y = 0; y < h; y++) { px(ctx, 0, y, ...woodDark); px(ctx, 1, y, ...wood); px(ctx, w - 2, y, ...wood); px(ctx, w - 1, y, ...woodDark); }
  for (let x = 0; x < w; x++) { px(ctx, x, 0, ...woodDark); px(ctx, x, h - 1, ...woodDark); }
  // Shelves
  const shelfYs = [Math.floor(h / 4), Math.floor(h / 2), Math.floor(3 * h / 4)];
  for (const sy of shelfYs) {
    for (let x = 1; x < w - 1; x++) { px(ctx, x, sy, ...woodLight); px(ctx, x, sy + 1, ...woodDark); }
  }
  // Books
  const bookColors = colors.length > 3 ? colors.slice(3) : [[80, 80, 120] as RGB, [150, 50, 50] as RGB];
  for (let s = 0; s < shelfYs.length; s++) {
    const startY = shelfYs[s] + 2;
    const sectionH = s === 0 ? shelfYs[0] : shelfYs[s] - shelfYs[s - 1] - 2;
    let x = 2;
    while (x < w - 3) {
      const bw = 2 + Math.floor(Math.random() * 3);
      const bh = Math.max(2, sectionH - Math.floor(Math.random() * 4));
      const bc = bookColors[Math.floor(Math.random() * bookColors.length)];
      for (let by = startY; by < startY + bh && by < h - 1; by++) {
        for (let bx = x; bx < x + bw && bx < w - 2; bx++) px(ctx, bx, by, ...bc);
      }
      x += bw + 1;
    }
  }
}

function drawLoveseat(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const main = colors[1], dark = colors[0], light = colors[2], accent = colors[3] || colors[2];
  const outline: RGB = [15, 15, 10];
  const backH = Math.floor(h / 2);
  // Seat back
  for (let y = 2; y < backH; y++) for (let x = 2; x < w - 2; x++) px(ctx, x, y, ...(y > 3 ? main : dark));
  // Arms
  for (let y = 3; y < h - 6; y++) { px(ctx, 1, y, ...dark); px(ctx, w - 2, y, ...dark); }
  // Cushion
  for (let y = backH; y < backH + 5 && y < h; y++) for (let x = 2; x < w - 2; x++) px(ctx, x, y, ...(y === backH ? light : main));
  // Legs
  for (let y = h - 3; y < h; y++) { px(ctx, 2, y, ...accent); px(ctx, w - 3, y, ...accent); }
  // Outline
  for (let y = 2; y < backH; y++) { px(ctx, 1, y, ...outline); px(ctx, w - 2, y, ...outline); }
  for (let x = 1; x < w - 1; x++) px(ctx, x, 2, ...outline);
}

function drawCoffeeTable(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const top = colors[0], topLight = colors[1], leg = colors[3] || colors[2];
  const topDark: RGB = [Math.max(0, top[0] - 20), Math.max(0, top[1] - 20), Math.max(0, top[2] - 20)];
  const topH = Math.floor(h / 2) + 2;
  // Table top
  for (let y = 4; y < topH; y++) for (let x = 2; x < w - 2; x++) px(ctx, x, y, ...(y === 4 ? topLight : top));
  // Top edge shadow
  for (let x = 2; x < w - 2; x++) px(ctx, x, topH, ...topDark);
  // Legs
  for (let y = topH + 1; y < h; y++) { px(ctx, 4, y, ...leg); px(ctx, 5, y, ...leg); px(ctx, w - 6, y, ...leg); px(ctx, w - 5, y, ...leg); }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add dashboard/lib/isabel-canvas.ts
git commit -m "feat: client-side Canvas pixel art renderer for Isabel designs"
```

---

### Task 2: Augment Agent Chat API for Isabel Design Mode

**Files:**
- Modify: `dashboard/app/api/agent-chat/route.ts` (lines 63-68)
- Modify: `dashboard/lib/agent-prompts.ts` (Isabel's prompt, line 138+)

**Step 1: Add Isabel design mode system prompt extension**

In `dashboard/app/api/agent-chat/route.ts`, detect when the first user message contains proposal context (the `<!-- PROPOSAL_CONTEXT -->` marker we'll add from the frontend), and append design-mode instructions to Isabel's system prompt.

In the `POST` handler, after line 66 (`buildContext()`), add:

```typescript
// After: const systemPrompt = agentPrompt + context;
// Replace with:
let systemPrompt = agentPrompt + context;

// If Isabel is in design-feedback mode, add structured output instructions
if (agent === "isabel" && messages[0]?.content?.includes?.("PROPOSAL_CONTEXT")) {
  systemPrompt += `\n\nDESIGN FEEDBACK MODE:
You are reviewing your furniture proposal with the user. When the user gives feedback and you want to show new designs, include a hidden JSON block in your response using this EXACT format:

<!-- ISABEL_DESIGNS
{
  "category": "Plants",
  "footprint": { "w": 16, "h": 32 },
  "options": [
    { "label": "Name", "description": "Short desc", "colors": [[r,g,b], [r,g,b], [r,g,b], [r,g,b], [r,g,b]] }
  ]
}
-->

Rules for the design spec:
- Always include exactly 4 options in "options"
- Each option MUST have exactly 5 colors as [r,g,b] arrays (values 0-255)
- Colors meaning by index: [0]=primary, [1]=secondary, [2]=accent, [3]=detail, [4]=base/pot/frame
- The category and footprint must match the current proposal
- Write your dramatic Isabel commentary BEFORE the hidden block
- The user's browser will render these as pixel art previews automatically
- After showing designs, ask if they want to iterate further or select one`;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add dashboard/app/api/agent-chat/route.ts
git commit -m "feat: add Isabel design-feedback mode to agent chat API"
```

---

### Task 3: Parse Design Specs + Render Previews in AgentChat

**Files:**
- Modify: `dashboard/components/AgentChat.tsx`

**Step 1: Add design spec parsing and Canvas rendering**

Import the canvas renderer at the top:

```typescript
import { renderDesign, DesignSpec } from "@/lib/isabel-canvas";
```

Add a helper function to parse and strip design specs from message text:

```typescript
function parseDesignSpecs(text: string): { cleanText: string; designs: DesignSpec | null } {
  const match = text.match(/<!-- ISABEL_DESIGNS\n([\s\S]*?)\n-->/);
  if (!match) return { cleanText: text, designs: null };
  try {
    const designs = JSON.parse(match[1]) as DesignSpec;
    const cleanText = text.replace(/<!-- ISABEL_DESIGNS\n[\s\S]*?\n-->/, "").trim();
    return { cleanText, designs };
  } catch {
    return { cleanText: text, designs: null };
  }
}
```

In the message rendering section, after rendering the assistant text bubble, check for design specs and render Canvas previews:

```tsx
// Inside the messages.map() render, for assistant messages:
{(() => {
  const { cleanText, designs } = parseDesignSpecs(msg.content);
  return (
    <>
      <div style={{ /* existing bubble styles */ }}>{cleanText}</div>
      {designs && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8 }}>
          {designs.options.map((opt, i) => {
            const preview = renderDesign(designs.category, designs.footprint.w, designs.footprint.h, opt.colors);
            return (
              <div key={i} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: 8, textAlign: "center" }}>
                <img src={preview} alt={opt.label} width={designs.footprint.w * 4} height={designs.footprint.h * 4} style={{ imageRendering: "pixelated", display: "block", margin: "0 auto 6px" }} />
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 8, color: "var(--text-tertiary)", marginBottom: 6 }}>{opt.description}</div>
                <button onClick={() => handleDesignSelect(designs, i)} style={{ fontSize: 9, padding: "3px 10px", borderRadius: 4, border: "1px solid #2dd4bf44", background: "transparent", color: "#2dd4bf", cursor: "pointer", fontWeight: 600 }}>
                  Select
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
})()}
```

Add the `handleDesignSelect` function that builds a proposal and triggers implement:

```typescript
async function handleDesignSelect(designs: DesignSpec, index: number) {
  const selected = designs.options[index];
  const preview = renderDesign(designs.category, designs.footprint.w, designs.footprint.h, selected.colors);

  // Fetch current proposal to get targets
  let targets: { uid: string; type: string; col: number; row: number }[] = [];
  try {
    const resp = await fetch("/proposals/isabel.json");
    if (resp.ok) {
      const proposal = await resp.json();
      targets = proposal.targets || [];
    }
  } catch { /* no targets available */ }

  // Build and save proposal, then trigger implement
  const newProposal = {
    id: new Date().toISOString().split("T")[0],
    category: designs.category,
    description: `User-refined design via chat feedback`,
    createdAt: new Date().toISOString(),
    footprint: designs.footprint,
    wallMounted: designs.category === "Paintings",
    mustMatch: false,
    options: designs.options.map((opt) => ({
      ...opt,
      preview: renderDesign(designs.category, designs.footprint.w, designs.footprint.h, opt.colors),
    })),
    targets,
  };

  // Save proposal and trigger implement
  const resp = await fetch("/api/isabel-proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selection: index, proposal: newProposal }),
  });

  if (resp.ok) {
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: `Magnifique! Installing "${selected.label}" in the office now. You'll see it after a quick deploy, darling! ✨`,
    }]);
  }
}
```

**Step 2: Add `initialPrompt` prop to AgentChat**

Add to the component props:

```typescript
export default function AgentChat({
  agent,
  onClose,
  initialPrompt,
}: {
  agent: string;
  onClose: () => void;
  initialPrompt?: string;
}) {
```

In the `useEffect` that resets on agent change, pre-fill the input:

```typescript
useEffect(() => {
  setMessages([]);
  setInput(initialPrompt || "");
  setAttachments([]);
  setMessageAttachments(new Map());
}, [agent, initialPrompt]);
```

**Step 3: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add dashboard/components/AgentChat.tsx
git commit -m "feat: parse Isabel design specs in chat + render Canvas previews"
```

---

### Task 4: Wire "Give Feedback" Button Through the Component Tree

**Files:**
- Modify: `dashboard/components/IsabelProposal.tsx` (add button + callback)
- Modify: `dashboard/app/agents/page.tsx` (wire state between components)
- Modify: `dashboard/components/CommandCenter.tsx` (accept + forward props)

**Step 1: Add "Give Feedback" button and callback to IsabelProposal**

Add an `onFeedback` prop:

```typescript
export default function IsabelProposal({ onFeedback }: { onFeedback?: (prompt: string) => void }) {
```

Add a "Give Feedback" button in the footer area (after the targets line, before closing `</div>`):

```tsx
{/* Footer */}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
  <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
    Replacing {proposal.targets.length} {proposal.category.toLowerCase()} in the office
  </span>
  {onFeedback && (
    <button
      onClick={() => {
        const optionNames = proposal.options.map((o) => o.label).join(", ");
        const prompt = `<!-- PROPOSAL_CONTEXT category=${proposal.category} footprint=${proposal.footprint.w}x${proposal.footprint.h} options=${optionNames} -->\nIsabel, I'm looking at your ${proposal.category.toLowerCase()} proposal. You suggested: ${optionNames}. Here's my feedback: `;
        onFeedback(prompt);
      }}
      style={{
        fontSize: 10, padding: "4px 12px", borderRadius: 4,
        border: "1px solid #2dd4bf44", background: "transparent",
        color: "#2dd4bf", cursor: "pointer", fontWeight: 600,
      }}
    >
      💬 Give Feedback
    </button>
  )}
</div>
```

Replace the existing footer `<div>` with this new one.

**Step 2: Add state + wiring in agents/page.tsx**

The agents page is a **server component** that renders `CommandCenter` and `IsabelProposal`. Since we need client-side state to wire the callback, wrap both in a new client component. Add to the bottom of `agents/page.tsx`:

Create a small client wrapper:

```typescript
// At the top, add:
import IsabelFeedbackBridge from "@/components/IsabelFeedbackBridge";
```

Create `dashboard/components/IsabelFeedbackBridge.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import CommandCenter from "./CommandCenter";
import IsabelProposal from "./IsabelProposal";

type AgentData = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  status: string;
  isActive: boolean;
};

export default function IsabelFeedbackBridge({ agents }: { agents: AgentData[] }) {
  const [isabelPrompt, setIsabelPrompt] = useState<string | null>(null);
  const commandCenterRef = useRef<HTMLDivElement>(null);

  function handleFeedback(prompt: string) {
    setIsabelPrompt(prompt);
    // Scroll to CommandCenter
    commandCenterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return { commandCenterRef, isabelPrompt, handleFeedback, setIsabelPrompt };
}
```

Actually, simpler approach — since `CommandCenter` is already a client component, just pass the props through. In `agents/page.tsx`, replace the separate `<CommandCenter>` and `<IsabelProposal />` with a wrapper that shares state:

Create `dashboard/components/IsabelFeedbackBridge.tsx` as a thin client wrapper that holds the `isabelPrompt` state and renders both `CommandCenter` and `IsabelProposal` with the shared callback.

**Step 3: Update CommandCenter to accept and forward `openAgent` + `initialPrompt`**

In `dashboard/components/CommandCenter.tsx`, add props:

```typescript
export default function CommandCenter({
  agents,
  openAgent,
  initialPrompt,
}: {
  agents: AgentData[];
  openAgent?: string | null;
  initialPrompt?: string;
}) {
```

Add a `useEffect` to react to `openAgent`:

```typescript
useEffect(() => {
  if (openAgent) {
    setSelectedAgent(openAgent);
  }
}, [openAgent]);
```

Pass `initialPrompt` to `AgentChat`:

```tsx
<AgentChat agent={selectedAgent} onClose={() => setSelectedAgent(null)} initialPrompt={selectedAgent === "isabel" ? initialPrompt : undefined} />
```

**Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add dashboard/components/IsabelProposal.tsx dashboard/components/IsabelFeedbackBridge.tsx dashboard/components/CommandCenter.tsx dashboard/app/agents/page.tsx
git commit -m "feat: wire Give Feedback button through component tree to agent chat"
```

---

### Task 5: Update `/api/isabel-proposal` to Accept Chat-Generated Proposals

**Files:**
- Modify: `dashboard/app/api/isabel-proposal/route.ts`

**Step 1: Accept optional `proposal` in POST body**

The existing route only takes `{ selection }` and triggers a GitHub Action. When called from chat, it also receives a full `proposal` object that needs to be saved first.

Add to the POST handler, after parsing the body:

```typescript
const { selection, proposal: chatProposal } = await req.json();

// If a chat-generated proposal is provided, save it to the proposals file
// This happens when user iterates in chat and clicks Select
if (chatProposal) {
  // We can't write to the filesystem on Vercel, so we pass the proposal
  // data to the GitHub Action which will save it before implementing
  // Add proposal data to the dispatch inputs
}
```

Actually — Vercel can't write to the filesystem. The simplest approach: pass the selected design's base64 PNG and metadata as part of the GitHub Action dispatch inputs. But dispatch inputs have size limits.

Better approach: The chat's "Select" button writes the proposal to localStorage, then the API route just triggers the action with the selection index. The implement script on GitHub will use the proposal that was already committed.

Simplest approach: When clicking Select from chat, first POST the proposal JSON to a new `/api/isabel-proposal/save` endpoint that commits it via GitHub API, then triggers implement.

**Revised approach for chat select**: Skip the proposal save — just have the GitHub Action accept the base64 PNG directly as a workflow input. But base64 is too large for inputs.

**Final approach**: The "Select from chat" flow:
1. Chat Select button calls `/api/isabel-proposal` with `{ selection, regeneratedProposal: {...} }`
2. API route creates a new commit via GitHub Contents API that writes `proposals/isabel.json`
3. Then triggers the implement action as before

Add to the POST handler:

```typescript
if (chatProposal) {
  // Save proposal to repo via GitHub Contents API
  const content = Buffer.from(JSON.stringify(chatProposal, null, 2)).toString("base64");
  const saveResp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/dashboard/public/proposals/isabel.json`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: "feat: Isabel chat-refined proposal",
        content,
        // Get current file SHA first if it exists
      }),
    }
  );
  if (!saveResp.ok) {
    const text = await saveResp.text();
    return NextResponse.json({ error: `Failed to save proposal: ${text}` }, { status: 502 });
  }
}
```

Note: The GitHub Contents API requires the current file SHA to update. Fetch it first with a GET, then PUT.

**Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add dashboard/app/api/isabel-proposal/route.ts
git commit -m "feat: support saving chat-generated proposals via GitHub Contents API"
```

---

### Task 6: Integration Test + Deploy

**Files:**
- No new files

**Step 1: Run TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

**Step 2: Test locally**

Run: `cd dashboard && npm run dev`

1. Navigate to `/agents`
2. Verify Isabel's proposal card shows with "Give Feedback" button
3. Click "Give Feedback" — should scroll to CommandCenter with Isabel's chat open, input pre-filled
4. Send the message — Isabel should respond with design specs
5. Verify Canvas previews render inline in chat
6. Click Select on a preview — should trigger implement flow

**Step 3: Deploy**

Run: `cd dashboard && vercel --prod`

**Step 4: Push to GitHub**

```bash
git push origin main
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Isabel feedback chat with real-time Canvas design iteration"
```
