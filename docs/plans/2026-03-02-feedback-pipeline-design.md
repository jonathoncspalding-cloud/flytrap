# Feedback Pipeline Design

**Date:** 2026-03-02
**Status:** Approved

## Problem

1. Feedback button submits to `/api/feedback` but `NOTION_FEEDBACK_DB` was missing from Vercel — fixed.
2. No downstream pipeline: feedback sits in Notion at "new" status forever.
3. No visibility into feedback from the dashboard.
4. No mechanism for Architect to triage and route feedback to agents.

## Design

### Part 1: Feedback Queue (Agents Page)

New `FeedbackQueue` section on the agents page, rendered between Pipeline Health and Agent Status.

- Server-side fetched via `getUserFeedback()` in `notion.ts`
- Shows feedback with status: new, triaged, in_progress
- Each card: message preview, category pill, page pill, status badge, time submitted, routed-to agent
- Summary bar: counts by status
- Sorted newest first, capped at 20

### Part 2: Architect Auto-Triage API

`POST /api/feedback/triage`

1. Query Notion for all feedback with `Status = new`
2. Send batch to Claude (Sonnet) as Architect persona
3. Architect returns: suggested `Routed To` agent + priority adjustment for each item
4. Update each item in Notion: set `Routed To`, `Status` → `triaged`, adjust `Priority`
5. Return triage report JSON

Triggered by:
- "Triage New Feedback" button on agents page
- Asking Architect in chat "triage feedback"

### Part 3: Architect Chat Integration

When user asks Architect about feedback in agent chat:
- Detect feedback-related queries (e.g., "show me feedback", "triage feedback", "feedback report")
- Query Feedback DB for current state
- Present formatted report with counts, categories, recommendations
- For triage requests, call the triage API and present results

### Part 4: Task Force / Create Plan

Each triaged feedback card has a "Create Plan" button that:
- Opens agent chat with the routed-to agent
- Pre-fills prompt with feedback context
- Agent proposes action plan in conversation

## Notion Schema (existing)

| Property | Type | Used By |
|----------|------|---------|
| Name | Title | Feedback message |
| Page | Select | Source page |
| Category | Select | bug/feature/etc |
| Priority | Select | low/medium/high/critical |
| Routed To | Select | Agent assignment |
| Status | Select | new/triaged/in_progress/resolved/wont_fix |
| Submitted | Date | Submission timestamp |
| Response | Rich Text | Agent response |

## Implementation Order

1. `getUserFeedback()` in `notion.ts`
2. `FeedbackQueue` component + wire into agents page
3. `/api/feedback/triage` endpoint
4. Architect chat feedback detection
5. "Create Plan" button + pre-filled chat
6. Deploy + verify
