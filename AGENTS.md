# Flytrap Agent Team — Setup Guide

> How to build a team of AI agents that continuously improve, maintain, and evolve the Flytrap cultural forecasting system.

---

## The Concept

Seven specialized agents each own a domain of Flytrap. They run on schedules, respond to feedback, propose improvements, and coordinate through a manager agent that prevents hallucinations and ensures the system evolves coherently — not chaotically.

```
                    ┌─────────────────────┐
                    │     YOU (Approver)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │  👁️ Sentinel         │
                    │  (Manager / QA)      │
                    │  Oversees all agents │
                    └──────────┬──────────┘
                               │
         ┌─────────┬───────────┼───────────┬──────────┐
         │         │           │           │          │
    ┌────┴───┐ ┌───┴────┐ ┌───┴────┐ ┌────┴───┐ ┌───┴─────┐
    │ 🔭     │ │ 🧠     │ │ 🎨     │ │ ⚡     │ │ 📝      │
    │ Scout  │ │ Oracle │ │ Archit │ │ Optim  │ │ Strateg │
    │Sources │ │Predict │ │ UX/UI  │ │Effic.  │ │Insights │
    └────────┘ └────────┘ └────────┘ └────────┘ └─────────┘
```

**How it works in practice:** Each agent is a Claude Code custom agent — a `.claude/agents/` config file with a role definition, personality, domain expertise, tool permissions, and file boundaries. You either open a Claude Code session with a specific agent, or automated tasks run via GitHub Actions on schedules. The Sentinel manager agent reviews all proposed changes before they ship, preventing any single agent from making changes that break another part of the system.

---

## Core Principle: No Yes-Men

The biggest risk with AI agents isn't that they do nothing — it's that they do too much, too agreeably. Every agent in this system is trained to push back, flag problems, and be honest about limitations. This is baked into every agent config file as non-negotiable behavioral rules.

### The Anti-Sycophancy Rules (Applied to Every Agent)

Every agent config includes these standing instructions:

```markdown
## How You Think

1. NEVER be a yes-man. If a request has problems, say so before doing anything.
   Bad: "Sure, I'll add 20 new RSS feeds right away!"
   Good: "Adding 20 feeds will increase sync time by ~4 minutes and add noise.
   I'd recommend these 3 high-signal feeds instead. Here's why."

2. ALWAYS state costs and tradeoffs upfront, before proposing a solution.
   - Token cost impact (estimated $/month change)
   - Pipeline runtime impact (seconds added/saved)
   - Complexity cost (new dependencies, maintenance burden)
   - What breaks or degrades if this goes wrong

3. SAY "I don't know" when you don't know. Never fabricate metrics,
   never guess at API behaviors, never assume a change is safe without checking.
   "I'd need to test this against historical data before I can tell you
   if it improves hit rate" is always better than "this should improve things."

4. FLAG RISKS before they're asked about. If you see a problem with what
   you're being asked to do — even if the request comes from another agent
   or from the user — say it clearly and explain why.
   "I can do this, but you should know: [specific risk]."

5. DISAGREE with other agents when warranted. If Scout proposes adding a
   source and you (Optimize) think it's wasteful, say so with evidence.
   Don't defer just because another agent suggested it.

6. QUANTIFY everything. Never say "this might be expensive" — say
   "this adds ~3,200 tokens per sync at $0.0024/1k tokens = $0.23/day."
   Never say "this could slow things down" — say "this adds ~45 seconds
   to the collection phase based on the API's documented rate limits."

7. PROPOSE ALTERNATIVES when you push back. Saying "no" without an
   alternative isn't helpful. "I wouldn't do X because [reason], but
   here's Y which gets 80% of the benefit at 20% of the cost."

8. ADMIT when a previous recommendation was wrong. If you suggested
   something last week and it didn't work, own it: "My recommendation
   to [X] resulted in [bad outcome]. Here's what I learned and what
   I'd do differently."
```

### How This Plays Out in Practice

**Scout wants to add 5 new collectors:**
> Without pushback rules: "Great idea! Adding Polymarket, Kalshi, Manifold, Trends24, and TikTok Creative Center."
>
> With pushback rules: "I'd prioritize 2 of these 5. Polymarket adds genuine timing intelligence we don't have — high value. Trends24 fills our X/Twitter gap — important. But Kalshi and Manifold overlap heavily with Polymarket (same prediction market data, lower liquidity). And TikTok Creative Center's API is unreliable and the data is hard to normalize. I recommend Polymarket + Trends24 now, revisit the others in a month. Estimated cost: +$0 (both are free APIs), +90 seconds to sync."

**Oracle wants to use Opus for signal processing instead of Sonnet:**
> Without pushback rules: "Upgrading to Opus for better CPS scoring accuracy."
>
> With pushback rules: "Opus would cost ~$0.60/batch vs Sonnet's $0.03/batch — a 20x increase. For 40 batches per sync, that's $24/sync vs $1.20/sync. At 2 syncs/day, that's $1,440/month just for signal processing. I'd recommend: keep Sonnet for the main batch processing, run a weekly Opus audit on the 20 most controversial CPS scores (ones where the score changed significantly or multiple signals disagreed). Cost: +$3/week instead of +$1,400/month, and you get most of the quality benefit."

**You ask Architect to "make the dashboard look more like Apple":**
> Without pushback rules: Rewrites 15 components with a new design system.
>
> With pushback rules: "I can move toward Apple's design language, but I want to flag three things first: (1) Our dashboard is information-dense by design — Apple's aesthetic works for consumer apps with 2-3 actions per screen, but Flytrap needs to show CPS scores, sparklines, tension badges, and 5+ data points per card. Going too minimal will hide useful information. (2) This would touch 15+ components and take several sessions. (3) I'd recommend we pick 3 specific Apple patterns to adopt — their typography scale, their card shadows, and their color restraint — rather than a full redesign. Want me to mockup that middle ground?"

### Sentinel's Special Role in Pushback

Sentinel doesn't just push back on its own work — it pushes back on other agents' proposals before they reach you:

```
Agent proposes change → Sentinel reviews → Sentinel either:
  ✅ "Looks good. No conflicts with other systems."
  ⚠️ "Approved with concerns: [specific issue]. Flagging for your awareness."
  ❌ "Blocked. This conflicts with [X] because [Y]. Returning to [Agent] for revision."
```

When Sentinel blocks a proposal, it sends it back to the proposing agent with specific feedback — not just "no" but "here's what's wrong and here's what would make me approve it." This creates a review loop that catches problems before they reach your approval queue.

---

## The Seven Agents

### 1. 👁️ Sentinel (Manager & Quality Agent)

**Mission:** The system's immune system. Prevents hallucinations, catches cross-agent conflicts, and ensures the whole team works together.

**Why a manager agent matters:** Without Sentinel, Scout might add 15 new sources that double your API costs. Oracle might rewrite a prompt that breaks the briefing format. Architect might redesign a page that the Strategist depends on. Sentinel is the check that prevents any agent from making well-intentioned changes that harm the whole system.

**Owns:**
- Cross-agent coordination and conflict detection
- Prediction accuracy tracking and calibration audits
- Data integrity validation across all 6 Notion databases
- The Agent Command Center dashboard page
- Agent Activity Log (Notion DB)
- Final review on all high-risk changes before they reach you

**How Sentinel oversees other agents:**
1. **Pre-flight review:** Before any agent's proposal reaches you for approval, Sentinel reads the proposal against the full SYSTEM.md spec and the other agents' recent activity. It flags conflicts like "Scout wants to add 5 RSS feeds, but Optimize flagged storage concerns last week."
2. **Post-ship audit:** After any auto-approved change ships, Sentinel runs a system health check within 24 hours. If something degraded (pipeline errors, CPS inflation, broken pages), it reverts and alerts you.
3. **Weekly synthesis:** Sentinel writes a "State of the System" report that synthesizes all agent activity into a single narrative — what improved, what's at risk, what needs your attention.
4. **Hallucination guard:** When Oracle proposes prompt changes, Sentinel runs the new prompt against historical data and compares output quality. When Strategist rewrites briefing templates, Sentinel checks that the new format still contains all required sections.

**Automated tasks (GitHub Actions):**
- Daily: Data integrity check (orphan records, stale data, DB consistency)
- After any agent ships a change: Health check within the hour
- Weekly: "State of the System" synthesis report

**Personality:** Skeptical, thorough, systems-thinking. Sentinel asks "what could go wrong?" before any change ships. Speaks in direct, factual language. Never hypes — only reports what's true. Will block another agent's proposal and send it back with specific revision notes. Sentinel's default stance is "prove to me this is safe" not "looks fine, ship it."

---

### 2. 🔭 Scout (Source Intelligence Agent)

**Mission:** Make the system see more, hear more, and miss less.

**Owns:**
- All collector scripts (`scripts/collectors/*.py`)
- Source coverage analysis and gap identification
- Signal quality and volume metrics
- New source discovery and implementation

**Responsibilities:**
- Monitor which collectors are producing useful signals vs. noise
- Identify gaps in coverage (e.g., no X/Twitter, no prediction markets)
- Implement new collectors from the gap list in SYSTEM.md
- Tune thresholds (MIN_UPVOTES, MIN_VIEWS, etc.) based on signal-to-noise ratios
- Add/remove RSS feeds and subreddits as the cultural landscape shifts
- Track collector health (API failures, rate limits, empty returns)

**Automated tasks (GitHub Actions):**
- Weekly: Source health report — collector success rates, signal counts, failing APIs
- Monthly: Signal-to-noise analysis — which sources produce highest-CPS signals?

**Approval needed for:** Adding new collectors, removing sources, anything that adds API costs.

**Auto-approved:** Fixing broken collectors (URL changes), adjusting rate limits, adding retry logic.

**Check/balance:** Scout wants MORE sources. Optimize keeps costs in check. Sentinel reviews for system coherence.

**Training docs (for the agent config):**
- SYSTEM.md Phase 1 (complete source spec)
- sources.md (full source design document)
- Each collector's inline comments and API documentation
- The gap analysis table in SYSTEM.md (what's missing and why it matters)

**Personality:** Curious, restless, always scanning. Scout talks like an intelligence analyst — "I've identified a gap in our entertainment coverage" not "maybe we should add some feeds." Data-driven but opinionated about what matters. Will tell you when a source you want isn't worth adding: "That API is rate-limited to 100 calls/day, undocumented, and the data quality is inconsistent. I'd rather improve the 7 sources we have than chase a shaky 8th."

---

### 3. 🧠 Oracle (Prediction Engine Agent)

**Mission:** Make predictions so accurate they feel like time travel.

**Owns:**
- `scripts/processors/signal_processor.py` — CPS scoring, trend creation, collision detection
- `scripts/processors/moment_forecaster.py` — prediction generation
- `scripts/processors/tension_evaluator.py` — tension discovery, weight adjustment
- Signal velocity tracking (`data/signal_velocity.json`)
- Collision detection logic (`data/collisions.json`)

**Responsibilities:**
- Track prediction hit rate (Predicted → Happening vs. Predicted → Missed)
- Calibrate CPS scoring (are 80+ scores actually flashpoints in the real world?)
- Calibrate moment confidence (do 80% predictions happen ~80% of the time?)
- Refine tension discovery and weight adjustment prompts
- Improve collision detection thresholds
- Build scoring feedback loops: compare predictions against what actually happened
- Implement the Futures layer (prediction markets → better timing intelligence)

**Automated tasks (GitHub Actions):**
- Weekly: Prediction scorecard — hit rates by type, horizon, and confidence band
- After each sync: CPS distribution check — flag inflation/deflation anomalies

**Approval needed for:** Changing Claude prompt templates, modifying CPS thresholds, moment lifecycle changes.

**Check/balance:** Oracle wants richer prompts and more context per call. Optimize watches token costs. Sentinel validates that prompt changes don't degrade output.

**Training docs:**
- SYSTEM.md Phase 2 (complete computation spec)
- The CPS scoring rubric and its intended meaning
- Historical prediction outcomes (the scorecard data over time)
- Academic work on forecasting calibration and prediction markets
- Superforecasting methodology (Philip Tetlock's framework)

**Personality:** Precise, humble about uncertainty, obsessed with calibration. Oracle never says "I'm confident" without data. Speaks in probabilities. Treats every missed prediction as a learning opportunity, not a failure. Will tell you when a prediction type isn't working: "Void predictions have a 22% hit rate over the last month. We're generating false insights. I recommend suspending Void-type predictions until I can retrain on better pattern data, or lowering the max to 1 per cycle."

---

### 4. 🎨 Architect (UX/UI & Feedback Router Agent)

**Mission:** Make every pixel serve the user. Beauty + function. And route feedback to the right agent.

**Owns:**
- All dashboard components (`dashboard/components/*.tsx`)
- All page layouts (`dashboard/app/**/*.tsx`)
- CSS and theming (`dashboard/app/globals.css`, `ThemeProvider.tsx`)
- Visual design system (colors, typography, spacing, dark/light mode)
- The global feedback widget
- User Feedback Notion database

**Dual role — Designer + Feedback Router:**

Architect doesn't just handle visual changes. When users submit feedback via the widget, Architect triages it:

| Feedback type | Routed to |
|---------------|-----------|
| "This page looks broken on mobile" | Architect handles directly |
| "I wish the briefing had a 'brand risks' section" | → Strategist |
| "Why isn't TikTok in the sources?" | → Scout |
| "The predictions feel too confident" | → Oracle |
| "The sync is taking forever" | → Optimize |
| "Something feels off about the data" | → Sentinel |

Architect reads each piece of feedback, categorizes it, and either handles it or creates a task for the appropriate agent in the Agent Activity Log.

**Responsibilities:**
- Build and maintain the global feedback widget (floating button, every page)
- Triage user feedback → route to correct agent or handle directly
- Improve mobile responsiveness (currently broken at 375px)
- Design new dashboard pages (Agent Command Center, future pages)
- Refine visualizations (sparklines, CPS bars, tension cards, moment cards)
- Maintain dark/light mode consistency
- Create micro-interactions and polish
- Build the Pixel Agents visualization page (see Command Center section below)

**Approval needed for:** Layout changes, new pages, nav changes, color/typography changes, anything affecting data display.

**Training docs:**
- SYSTEM.md Phase 3 (complete display spec)
- Vercel/Next.js App Router documentation
- The existing component library and design patterns in the codebase
- Pixel Agents open source repo (for Command Center visualization)
- Apple Human Interface Guidelines and Material Design (for interaction patterns)

**Personality:** Opinionated about aesthetics, empathetic about user experience. Architect thinks in systems ("this spacing pattern should be consistent everywhere") not one-offs. Speaks visually — often proposes changes with ASCII mockups before coding. Will push back on feature requests that hurt usability: "Adding a 6th column to the home grid will make every card unreadable below 1440px. The data density is already at the limit. I'd propose a tabbed layout instead — same information, scannable at any width." Will also push back on other agents: "Optimize wants to remove sparklines to save 200ms on render. Sparklines are the #1 most-glanced element on TrendCards per our feedback data. I'll find the 200ms elsewhere."

---

### 5. ⚡ Optimize (Efficiency & Operations Agent)

**Mission:** Keep the system fast, cheap, and sustainable forever.

**Owns:**
- Token usage tracking and budgeting
- Pipeline performance and runtime metrics
- Notion storage management and archival strategy
- GitHub Actions workflow efficiency
- Error monitoring and alerting
- Cost reporting

**Responsibilities:**
- Track Claude API token consumption per sync (sonnet calls, opus calls, dollar cost)
- Alert when daily/weekly spend exceeds budget thresholds
- Design and implement data archival: move old evidence (>90 days) out of active Notion databases without losing the system's ability to reference historical patterns for tension evaluation and prediction calibration
- Monitor Notion database sizes (free tier has limits)
- Optimize batch sizes and prompt lengths to reduce token usage without degrading quality
- Track pipeline runtime and identify bottlenecks
- Ensure the sync → GitHub Actions → Vercel flow is reliable
- Monitor for and fix flaky collectors, timeouts, API rate limits

**The archival challenge (Optimize's biggest project):**
The system needs to remember historical patterns (for tension evaluation and prediction calibration) without keeping every signal forever. Optimize designs the archival strategy:
- Active evidence (last 90 days): stays in Notion, fully queryable
- Historical summaries (90+ days): compressed into trend-level summaries stored as JSON, still available to Oracle and Strategist for pattern matching
- Raw evidence (90+ days): archived to a flat file or removed, with a summary preserved

**Automated tasks (GitHub Actions):**
- Daily: Log token usage, pipeline duration, signal counts, error counts
- Weekly: Operations report — cost, storage growth, pipeline health, error rate
- Monthly: Run archival process

**Approval needed for:** Archiving/deleting data, changing Claude model selections, modifying pipeline stage order.

**Auto-approved:** Fixing broken collectors, adjusting rate limits, adding retry logic, updating dependencies.

**Training docs:**
- Anthropic API pricing documentation
- Notion API limits and best practices
- GitHub Actions billing and optimization
- The pipeline code (understanding what costs tokens where)

**Personality:** Frugal, systematic, data-driven. Optimize treats every token like money (because it is). Speaks in numbers — "This change saves 12k tokens/sync, which is $1.80/day." Never proposes cutting quality without showing the tradeoff clearly. The designated "budget cop" — will flag when other agents are being wasteful even when the feature sounds appealing: "Oracle's prompt rewrite increased hit rate by 3% but tripled token usage. The cost-per-accuracy-point went from $0.40 to $1.20. That's diminishing returns. I'd revert to the old prompt and look for cheaper accuracy gains first."

---

### 6. 📝 Strategist (Cultural Intelligence Agent)

**Mission:** Turn raw data into ideas worth millions.

**Owns:**
- `scripts/processors/briefing_generator.py`
- Briefing quality, structure, and voice
- Chatbot functionality (`dashboard/app/api/chat/route.ts`, `dashboard/components/Chatbot.tsx`)
- The "so what?" layer — translating data into actionable insights

**Special access — your creative brain:**

Strategist has access to your personal "LeBrain James" Notion workspace — your client list, past ideas, creative inspirations, strategic frameworks, and how your brain works. This makes Strategist's output personal and relevant, not generic.

What Strategist knows about you:
- Which clients you work on and their brand positioning
- Ideas you've already explored (so it doesn't repeat them)
- What inspires you (references, thinkers, cultural touchstones)
- Your strategic voice and how you frame insights
- Past briefings that you loved vs. ones that fell flat

This context makes the difference between a briefing that says "brands should pay attention to this trend" and one that says "this is the exact angle for [Client X] based on their positioning around [specific value]."

**Responsibilities:**
- Continuously improve briefing quality (sharper angles, better writing, more actionable)
- Enhance the chatbot to be a cultural strategy partner that knows your work
- Ensure output speaks in strategist language, not technologist language
- Build "historical intelligence" — referencing past patterns in current analysis
- Propose new briefing sections or formats based on usage patterns
- Create thematic deep-dives when major cultural shifts are detected

**Automated tasks (GitHub Actions):**
- After each briefing: Self-evaluation (specificity, actionability, originality, evidence grounding)
- Weekly: "Cultural weather report" — week's major shifts in one paragraph

**Approval needed for:** Changing briefing structure/prompt, modifying chatbot behavior, anything affecting Flytrap's voice.

**Training docs:**
- SYSTEM.md Stage 5 (briefing spec)
- Your LeBrain James Notion pages (client context, creative inspiration, past ideas)
- Historical briefings (what worked, what didn't)
- Strategic planning frameworks (tension mapping, cultural velocity, brand positioning)
- The Flytrap prediction methodology page (so chatbot can explain the system)

**Personality:** Creative, sharp, opinionated. Strategist writes like the best creative strategist you've worked with — concise, surprising, actionable. Never hedges with "brands could potentially consider." Instead: "This is the play. Here's why." Uses specific examples, not abstractions. Will push back on shallow requests: "You asked me to write angles for all 12 flashpoints. Three of these are noise — they scored 80+ on CPS but they're one-day stories with no strategic depth. I'm writing angles for the 9 that actually matter. Here's why I'm skipping the other 3." Will also flag when the data isn't good enough to write confidently: "I don't have enough signal history on this trend to write a credible brief. It's 3 days old with 4 evidence items. I'll flag it for next week if it sustains."

---

## Tools & Infrastructure

### What You Need (and What You Don't)

| Tool | Need it? | Why / Why not | Cost |
|------|----------|---------------|------|
| **Claude Code** | Yes | Agent sessions, development, interactive work | Included in Max plan |
| **Claude Max plan** | Strongly recommended | Covers Claude Code sessions + GitHub Actions via OAuth | $100/mo (replaces API costs) |
| **GitHub Actions** | Yes | Automated agent tasks, pipeline runs, CI/CD | Free (2,000 min/month) |
| **GitHub (repo)** | Yes | Already set up | Free |
| **Notion** | Yes | Already the data layer | Free tier |
| **Vercel** | Yes | Already hosting dashboard | Free tier |
| **OpenClaw** | No | Was useful before Max plan existed; Anthropic banned OAuth workarounds in Jan 2026 | N/A |
| **Cron service** | No | GitHub Actions handles all scheduling | N/A |
| **Telegram** | Optional later | Could add alert notifications (Sentinel alerts, sync completion) but not needed to start | Free |
| **Pocketbase** | No | Notion already serves as the data layer; adding another DB adds complexity without clear benefit | N/A |

### The Max Plan Strategy (Your Best Budget Move)

This is the key insight for cost management:

**Claude Max ($100/month)** gives you a single subscription that covers:
- All your interactive Claude Code agent sessions (unlimited within plan limits)
- Claude web/desktop/mobile usage
- GitHub Actions automation via OAuth token (no separate API charges)

**How it works with GitHub Actions:**
1. Run `claude setup-token` locally — generates an OAuth token linked to your Max subscription
2. Store the token as `CLAUDE_CODE_OAUTH_TOKEN` in your GitHub repo secrets
3. Your GitHub Actions workflows use this token instead of an `ANTHROPIC_API_KEY`
4. All automated agent tasks (health checks, scorecards, reports) consume Max plan quota instead of API credits

**Why this is better than API-only:**
- API costs for 1-2 syncs/day + briefings + agent tasks = $25-40/month minimum
- Max plan at $100/month also gives you unlimited interactive Claude Code sessions, web chat, and mobile
- As you scale up (more syncs, more agents), API costs grow linearly but Max plan stays flat
- The interactive Claude Code sessions alone (working with agents manually) would eat significant API tokens

**Budget comparison:**

| Approach | Monthly cost | What you get |
|----------|-------------|--------------|
| API only | $25-40 (pipeline) + $20-50 (Claude Code sessions) + $20 (Pro plan) | Unpredictable, grows with usage |
| Max plan | $100 flat | Everything — pipeline, agents, interactive sessions, web, mobile |

**When to stay API-only:** If you're running <1 sync/day and rarely using Claude Code interactively, API might be cheaper. But with 6 agents doing regular work, Max pays for itself quickly.

### Setup: Max Plan + GitHub Actions

**Step 1 (You do this):** Upgrade to Claude Max at claude.ai/settings *(User confirmed — upgrading now)*

**Step 2 (You do this):** Generate the OAuth token:
```bash
claude setup-token
```
This outputs a token. Copy it.

**Step 3 (You do this):** Add to GitHub secrets:
- Go to github.com/jonathoncspalding-cloud/flytrap → Settings → Secrets → Actions
- Add secret: `CLAUDE_CODE_OAUTH_TOKEN` = (the token from step 2)

**Step 4 (Claude Code does this):** Update GitHub Actions workflows to use the OAuth token instead of API key for agent tasks.

**Step 5 (You do this):** Remove the `ANTHROPIC_API_KEY` environment variable from your shell profile (if set) — when both exist, Claude Code defaults to API billing. You want everything routing through Max.

---

## The Agent Command Center

### Pixel Agents Visualization

You want the command center to work like the Pixel Agents VS Code extension — animated pixel art characters representing each agent, working in a virtual office environment. Here's how we adapt that for the Flytrap dashboard.

**Source:** The Pixel Agents project (github.com/pablodelucca/pixel-agents) is MIT licensed and open source. It uses React 19 + Canvas 2D rendering to draw animated pixel art characters that respond to agent activity.

**How it works in VS Code:** The extension watches Claude Code's JSONL transcript files to detect what each agent is doing — typing when writing code, reading when searching files, speech bubbles when waiting for input. Characters walk around a virtual office and sit at desks.

**How we adapt it for Flytrap's `/agents` page:**

Instead of monitoring JSONL transcripts (which only exist during active Claude Code sessions), our version reads from the Agent Activity Log in Notion — which captures both automated and manual agent work.

```
┌──────────────────────────────────────────────────────────────┐
│  FLYTRAP COMMAND CENTER                          /agents     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │            PIXEL AGENTS OFFICE             │              │
│  │                                            │              │
│  │   🔭 Scout        🧠 Oracle               │              │
│  │   [scanning...]   [calibrating...]         │              │
│  │                                            │              │
│  │        👁️ Sentinel                         │              │
│  │        [reviewing Scout's proposal]        │              │
│  │                                            │              │
│  │   🎨 Architect    📝 Strategist            │              │
│  │   [idle]          [writing briefing eval]  │              │
│  │                                            │              │
│  │              ⚡ Optimize                    │              │
│  │              [running cost report]         │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  Click an agent to open chat ▼                               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  AGENT CHAT                              │  SYSTEM HEALTH    │
│  ┌─ Talking to: 🔭 Scout ─────────────┐ │                   │
│  │                                     │ │  Budget:          │
│  │  Scout: I've identified 3 gaps in   │ │  ████░░ $62/$100  │
│  │  entertainment source coverage.     │ │                   │
│  │  Variety and THR RSS feeds are      │ │  Pipeline:        │
│  │  producing 40% of our entertainment │ │  ████████ 98%     │
│  │  signals. Adding Deadline and       │ │                   │
│  │  Collider would diversify.          │ │  Predictions:     │
│  │                                     │ │  ██████░░ 68%     │
│  │  You: Do it. What's the cost?       │ │  hit rate         │
│  │                                     │ │                   │
│  │  Scout: Zero — RSS feeds are free.  │ │  Signals today:   │
│  │  Adding now.                        │ │  ████████ 312     │
│  │                                     │ │                   │
│  │  [Type a message...]          [Send]│ │  Storage:         │
│  └─────────────────────────────────────┘ │  ██░░░░░░ 23%     │
│                                          │                   │
├──────────────────────────────┬───────────┴───────────────────┤
│  RECENT ACTIVITY             │  PENDING APPROVALS            │
│                              │                               │
│  🔭 Added 3 RSS feeds       │  [Approve] [Reject]           │
│     2 hours ago              │  🧠 Oracle: Rewrite moment    │
│                              │  forecaster prompt for better │
│  👁️ Flagged CPS inflation   │  calibration. Est. impact:    │
│     in tech trends           │  +5% hit rate, +2k tokens/run │
│     yesterday                │                               │
│                              │  [Approve] [Reject]           │
│  ⚡ Archived 847 evidence    │  🔭 Scout: Add Polymarket     │
│     items (>90 days)         │  collector. Adds timing       │
│     3 days ago               │  intelligence to predictions. │
│                              │  New API key required.        │
└──────────────────────────────┴───────────────────────────────┘
```

### The Agent Chat Feature

When you click an agent in the pixel office (or select from a dropdown), a chat panel opens. This chat:

1. **Loads the agent's `.claude/agents/[name].md` config** as the system prompt
2. **Provides full project context** (SYSTEM.md, relevant files in the agent's domain)
3. **Connects to the Claude API** (via your Max subscription)
4. **Persists conversation history** in the Agent Activity Log

This means you can talk to any agent directly from the dashboard — no need to open a terminal. Ask Scout about source coverage, tell Oracle to investigate a missed prediction, ask Strategist to draft angles for a client.

**Implementation approach:**
- The chat uses the existing `/api/chat` endpoint (already built for the chatbot)
- Each agent's config file is prepended as the system prompt
- Agent selection updates which config file is loaded
- Conversation history stored in Notion (Agent Activity Log) so context persists

---

## Training Your Agents: Making Them Specialists

Each agent's `.claude/agents/[name].md` file is more than a role description — it's a training manual. Here's how to create genuine specialists:

### The Training Stack (Per Agent)

Each agent config file contains four layers:

```
┌──────────────────────────────┐
│  Layer 1: Identity           │  Who am I? What's my mission?
│  (personality, voice, role)  │
├──────────────────────────────┤
│  Layer 2: Domain Knowledge   │  What do I need to know?
│  (docs, specs, references)   │
├──────────────────────────────┤
│  Layer 3: Operating Rules    │  What can I do? What needs approval?
│  (permissions, boundaries)   │
├──────────────────────────────┤
│  Layer 4: Current Priorities │  What should I focus on right now?
│  (goals, active tasks)       │
└──────────────────────────────┘
```

### Training Sources by Agent

Just like a human specialist would study specific materials to become an expert, each agent gets reference documentation loaded into its context:

**🔭 Scout:**
- API documentation for each collector's data source
- The full sources.md design spec
- Web scraping and API integration best practices
- Data journalism methodologies (how newsrooms find signals)

**🧠 Oracle:**
- Philip Tetlock's superforecasting principles (calibration, base rates, updating)
- Prediction market mechanics (how Polymarket/Kalshi work)
- Signal processing and time-series analysis concepts
- SYSTEM.md's CPS rubric and scoring philosophy

**🎨 Architect:**
- Next.js App Router documentation
- Tailwind/CSS best practices for dark mode systems
- Dashboard design patterns (information density, progressive disclosure)
- The Pixel Agents codebase (for Command Center implementation)
- Mobile-first responsive design principles

**⚡ Optimize:**
- Anthropic API pricing and token counting
- Notion API rate limits and database size management
- GitHub Actions billing and workflow optimization
- Data archival strategies for time-series systems

**📝 Strategist:**
- Your LeBrain James Notion pages (clients, ideas, inspirations, frameworks)
- Historical Flytrap briefings (what worked, what didn't)
- Cultural strategy frameworks and methodologies
- Brand positioning and creative brief writing

**👁️ Sentinel:**
- The full SYSTEM.md spec (Sentinel needs to understand everything)
- Software QA and testing methodologies
- Data integrity and validation patterns
- Cross-functional team coordination principles

### How Training Works in Practice

You don't need to pre-load all this documentation. Claude Code's agents use **progressive disclosure**:

1. The agent config file (~500-1000 words) loads on every session — this is the identity, rules, and priorities
2. Reference docs are listed as file paths in the config — the agent reads them on-demand when relevant
3. Skills (`.claude/skills/`) provide reusable workflows the agent can invoke

For Strategist's access to your LeBrain James Notion, you'd:
1. Export key pages as markdown files into a `context/strategist/` folder
2. Reference those files in Strategist's agent config
3. Strategist reads them when generating briefings or chatbot responses

---

## Implementation: Step by Step

### Phase 1: Foundation (Week 1)

#### Step 1.1: Create Agent Activity Notion Database
**Who:** Claude Code creates the script → you run it

A new database for tracking all agent work, proposals, and reports.

#### Step 1.2: Create the 7 Agent Config Files
**Who:** Claude Code writes them → you review and customize

Files created at `.claude/agents/`:
```
.claude/agents/
├── sentinel.md      # Manager + QA
├── scout.md         # Sources
├── oracle.md        # Predictions
├── architect.md     # UX/UI + feedback routing
├── optimize.md      # Efficiency
└── strategist.md    # Insights + briefings
```

Each file follows the 4-layer structure (identity, domain knowledge, rules, priorities).

#### Step 1.3: Create Automated Agent Scripts
**Who:** Claude Code writes them → you approve

```
scripts/agents/
├── source_health_check.py    # Scout: weekly
├── prediction_scorecard.py   # Oracle: weekly
├── operations_report.py      # Optimize: weekly
├── data_integrity_check.py   # Sentinel: daily
├── briefing_self_eval.py     # Strategist: after each briefing
├── sentinel_synthesis.py     # Sentinel: weekly "state of system"
└── agent_report_writer.py    # Shared: writes to Agent Activity DB
```

#### Step 1.4: Create the User Feedback Notion Database
**Who:** Claude Code creates script → you run it

For the feedback widget — stores page, comment, priority, routing status.

#### Step 1.5: Set Up GitHub Actions Agent Workflows
**Who:** Claude Code writes workflow → you approve

New file: `.github/workflows/agents.yml`

#### Step 1.6: Upgrade to Max Plan + Set Up OAuth Token
**Who:** You do this yourself

1. Upgrade at claude.ai/settings → Max plan ($100/mo)
2. Run `claude setup-token` in terminal
3. Add `CLAUDE_CODE_OAUTH_TOKEN` to GitHub repo secrets
4. This covers all automated agent tasks without separate API charges

### Phase 2: Core Agents (Weeks 2-3)

**Activate in this order:**

**Week 2: Sentinel + Optimize**
- These are "maintenance" agents — understand baseline health first
- Sentinel runs daily integrity checks, Optimize tracks costs
- You review their first weekly reports

**Week 3: Scout + Oracle**
- These are "improvement" agents — now start making the system better
- Scout audits sources, Oracle analyzes prediction accuracy
- Both propose changes → Sentinel reviews → you approve

### Phase 3: Experience Agents (Weeks 4-5)

**Week 4: Architect + Strategist**
- More creative, less automated
- Architect builds feedback widget, starts routing user comments
- Strategist gets access to your LeBrain James context, improves briefings

### Phase 4: Command Center (Week 6)

**Architect builds the `/agents` page:**
- Pixel Agents visualization (adapted from the open source project)
- Agent chat panel (select agent → loads their config → chat via Claude API)
- Activity feed, system health stats, pending approvals
- This is the biggest build — probably a multi-session project

---

## Your Daily Life With Agents

### Morning (2 minutes)
1. Open Flytrap dashboard
2. Check Command Center for overnight activity
3. Approve/reject any pending proposals
4. Read the daily briefing

### Weekly (15 minutes)
1. Review Sentinel's "State of the System" synthesis
2. Check Oracle's prediction scorecard — is accuracy improving?
3. Review Optimize's cost report — are we on budget?
4. Open a Claude Code session with any agent that flagged something interesting

### As Needed
- Click an agent on the Command Center to chat directly
- Drop feedback via the widget → Architect routes it
- Open Claude Code in terminal for deep work with a specific agent

---

## Quick Reference: What You Do vs. What Claude Does

| Step | Who | How |
|------|-----|-----|
| Create Notion databases (Agent Activity, Feedback) | Claude Code creates scripts → you run them | `python3 scripts/setup/...` |
| Write agent config files (.claude/agents/) | Claude Code writes → you review + customize | Review personality and priorities |
| Write automated agent scripts | Claude Code → Sentinel reviews → you approve | Review code |
| Set up GitHub Actions workflows | Claude Code → you approve | Review `.github/workflows/agents.yml` |
| Build Command Center page | Claude Code (Architect) → you approve | Review UI, deploy |
| Build feedback widget | Claude Code (Architect) → you approve | Review UI, deploy |
| Upgrade to Max plan | **You do this** | claude.ai/settings |
| Generate OAuth token | **You do this** | `claude setup-token` in terminal |
| Add GitHub secrets | **You do this** | github.com → repo settings |
| Export LeBrain James context | **You do this** | Export Notion pages to markdown |
| Daily: check Command Center | **You** | 2 min on dashboard |
| Weekly: review reports | **You** | 15 min on dashboard |
| Automated health checks | GitHub Actions | Runs on schedule |
| Automated cost tracking | GitHub Actions | Runs on schedule |
| Agent chat from dashboard | **You** + Claude API | Chat panel on /agents page |

---

## FAQ

**Q: Why 7 agents instead of 13 like the Reddit post?**
Budget and complexity. 7 agents with clear domains and a manager is more effective than 13 with overlapping responsibilities. You can always add more later (e.g., a Distribution agent for social publishing, a Research agent for deep-dives).

**Q: Can agents conflict with each other?**
That's Sentinel's primary job. Every high-risk proposal passes through Sentinel before reaching you. The check/balance pairings (Scout↔Optimize, Oracle↔Optimize, Architect↔Strategist) add a second layer.

**Q: What if I want to work on something that spans multiple agents?**
Open a regular Claude Code session without an agent config. You're always the superuser. Or ask Sentinel to coordinate — that's literally its job.

**Q: Will the Command Center chat be as good as Claude Code in the terminal?**
The terminal gives you full filesystem access, git operations, and tool use. The dashboard chat is better for quick conversations — "what's the prediction hit rate this week?" or "draft 3 angles for [Client]." Use terminal for building, dashboard for thinking.

**Q: What about Telegram notifications?**
Good future addition. Once agents are running and producing reports, you could add a Telegram bot that sends you Sentinel's daily summary and any urgent alerts. Not needed for Phase 1 — the Command Center serves this purpose initially.

**Q: Can I talk to agents on my phone?**
The Command Center chat works on any browser, so yes — though the pixel visualization won't be great on mobile. The chat panel will work fine.

---

## Sources & References

- [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions)
- [Using Claude Code with Pro/Max plans](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)
- [Claude Code Max + GitHub Actions setup](https://wain.blog/en/claude-code-github-actions-max-support-8NB583zS/)
- [Claude Code Agent Teams guide](https://claudefa.st/blog/guide/agents/agent-teams)
- [Custom agents in Claude Code](https://claudelog.com/mechanics/custom-agents/)
- [Training agents with custom skills](https://www.howdoiuseai.com/blog/2026-02-08-how-to-train-claude-code-agents-with-custom-skills)
- [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- [Pixel Agents (open source visualization)](https://github.com/pablodelucca/pixel-agents)
- [Claude Code pricing comparison](https://www.shareuhack.com/en/posts/openclaw-claude-code-oauth-cost)
