# Isabel Feedback Chat — Design Doc

**Date:** 2026-03-02
**Status:** Approved

## Goal

Add a "Give Feedback" button to Isabel's proposal card that opens her agent chat pre-loaded with proposal context. Isabel iterates on designs in real-time using client-side Canvas rendering — no page refresh needed.

## Architecture

### Flow

1. User clicks "Give Feedback" on IsabelProposal card
2. Page scrolls to CommandCenter, opens AgentChat with `agent="isabel"` and `initialPrompt` containing proposal context
3. User types feedback, sends message
4. `/api/agent-chat` responds as Isabel, including a JSON design spec block in her response (color palettes, labels, category-specific draw instructions)
5. AgentChat frontend detects the JSON spec, renders 4 pixel art previews via Canvas, shows Select buttons inline
6. User can keep iterating — each round Isabel outputs a new spec, frontend renders new previews
7. When user clicks Select on a chat preview, it saves the design to `/proposals/isabel.json` and triggers the existing implement flow

### Components Modified

**IsabelProposal.tsx** — Add "Give Feedback" button. Emit callback with proposal context to parent.

**agents/page.tsx** — Wire callback: IsabelProposal -> CommandCenter. New state for `openAgent` + `initialPrompt`.

**CommandCenter.tsx** — Accept `openAgent`/`initialPrompt` props. When set, programmatically select agent and pass prompt to AgentChat.

**AgentChat.tsx** — Accept optional `initialPrompt` prop. Pre-fill input on mount. Parse assistant responses for `<!-- ISABEL_DESIGNS {...} -->` JSON blocks. Render Canvas previews + Select buttons inline in chat bubbles.

**New: `dashboard/lib/isabel-canvas.ts`** — Client-side Canvas pixel art renderer. One draw function per category (Plants, Paintings, Rug, Bookcases, Loveseats, Coffee Table). Takes color palette + category -> returns base64 data URI. Mirrors the Python Pillow generators.

**`/api/agent-chat/route.ts`** — When agent is "isabel" and proposal context is present, augment the system prompt to instruct Claude to output design specs in the `<!-- ISABEL_DESIGNS {...} -->` format.

### Design Spec Format

Isabel's chat responses include a hidden JSON block:

```
<!-- ISABEL_DESIGNS
{
  "category": "Plants",
  "footprint": { "w": 16, "h": 32 },
  "options": [
    {
      "label": "Tropical Fern",
      "description": "Lush cascading fronds",
      "colors": [[20,50,15], [40,100,30], [60,140,45], [80,170,60], [120,70,40]]
    },
    ...
  ]
}
-->
```

The frontend strips this from the visible text and renders it as Canvas previews.

### Canvas Renderer

Port each category's Pillow draw function to Canvas:
- **Plants**: pot (bottom rect) + stem (vertical line) + leaf clusters (circles/diamonds)
- **Paintings**: frame border + background fill + abstract shapes
- **Rug**: rectangular pattern with border + geometric fill
- **Bookcases**: shelves + book rectangles in varied colors
- **Loveseats**: seat shape + cushion + armrests
- **Coffee Table**: top surface + legs

Each takes a 5-color palette array and renders to an offscreen canvas, returns `toDataURL()`.

### Select from Chat

When user clicks Select on a chat-rendered preview:
1. Generate the base64 PNG from Canvas at production size
2. Build proposal JSON matching the existing format (with `preview` data URI, `targets` from current proposal)
3. POST to `/api/isabel-proposal` (existing endpoint) to save and trigger implement
4. Show "Implementing..." state in chat

## Non-Goals

- No changes to the Python proposal generator or implement script
- No new API routes (reuse existing agent-chat + isabel-proposal)
- No Vercel Python runtime
