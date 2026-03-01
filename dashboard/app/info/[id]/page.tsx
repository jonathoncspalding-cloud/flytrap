import Link from "next/link";
import { notFound } from "next/navigation";

// ── Content definitions ───────────────────────────────────────────────────────

const INFO_PAGES: Record<string, {
  title: string;
  subtitle: string;
  accentColor: string;
  sections: { heading: string; content: React.ReactNode }[];
}> = {

  // ─── Daily Briefing ─────────────────────────────────────────────────────────
  briefing: {
    title: "Daily Briefing",
    subtitle: "What it is, how it's made, and how to use it.",
    accentColor: "#2a8c4a",
    sections: [
      {
        heading: "What is the Daily Briefing?",
        content: (
          <p>
            The Daily Briefing is an AI-generated summary of cultural momentum produced each morning.
            It synthesizes the previous 24–48 hours of signal collection across Reddit, Google Trends,
            news RSS feeds, YouTube, Bluesky, and Hacker News into a single, prioritized cultural intelligence report.
            Think of it as a cultural morning memo: what shifted overnight, what's accelerating, and what it means.
          </p>
        ),
      },
      {
        heading: "How it's generated",
        content: (
          <>
            <p>The briefing pipeline runs automatically each morning and follows these steps:</p>
            <ol>
              <li><strong>Signal collection</strong> — Collectors pull new signals from Reddit, Bluesky, Hacker News, YouTube, Wikipedia, Google Trends, and 50+ curated RSS feeds.</li>
              <li><strong>AI signal scoring</strong> — Claude (Sonnet) reads each batch of signals alongside your active tensions. It assigns a Cultural Pulse Score (0–100) to each signal based on how many tensions it intersects and their weight. These scores then update linked trends.</li>
              <li><strong>Briefing generation</strong> — Claude Opus reads the top trends, all tensions, new signals, collision data, and the cultural calendar, then writes a structured narrative briefing. Claude Sonnet is used as a fallback if Opus is unavailable.</li>
              <li><strong>Flashpoint identification</strong> — Any trend with a CPS of 80+ is flagged as a Flashpoint and surfaced in the briefing header.</li>
            </ol>
          </>
        ),
      },
      {
        heading: "What is the CPS (Cultural Pulse Score)?",
        content: (
          <>
            <p>
              The CPS is a 0–100 score measuring a trend's current cultural energy — how loudly it's
              showing up across the internet right now. It is <em>not</em> a measure of importance or longevity;
              it's a measure of intensity at this moment. CPS is assigned by Claude AI when processing each
              signal batch: Claude reads each signal against all active tensions and their weights, then assigns
              a score based on how many tensions the signal intersects and how intensely. A trend's CPS reflects
              the scores of its most recently linked signals.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {[
                { range: "80–100", label: "Flashpoint", color: "#2a8c4a", desc: "Dominating cultural conversation. Act now." },
                { range: "60–79", label: "Rising", color: "#3da65a", desc: "Strong momentum, accelerating discourse." },
                { range: "40–59", label: "Simmering", color: "#FF8200", desc: "Active and building. Worth watching." },
                { range: "20–39", label: "Low Signal", color: "#E8127A", desc: "Early movement, not yet mainstream." },
                { range: "0–19", label: "Noise", color: "rgba(255,255,255,0.3)", desc: "Minimal signal. Background level." },
              ].map((tier) => (
                <div key={tier.range} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tier.color }}>{tier.range}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: tier.color }}>{tier.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{tier.desc}</p>
                </div>
              ))}
            </div>
          </>
        ),
      },
      {
        heading: "Flashpoints",
        content: (
          <p>
            Flashpoints are trends with a CPS of 80 or above. The count shown in the briefing header
            tells you how many trends are currently at peak cultural energy. These represent your highest-priority
            opportunities — windows that are open right now but may close within days.
          </p>
        ),
      },
      {
        heading: "How to use it",
        content: (
          <p>
            Read the briefing each morning before client calls, creative briefs, or strategy sessions.
            Use it to answer: <em>What is culture talking about today, and how does that create opportunity for our brands?</em>
            For deeper context, click "Full briefing" to see the complete report with all supporting signals.
          </p>
        ),
      },
    ],
  },

  // ─── Cultural Strategist Chat ────────────────────────────────────────────────
  chatbot: {
    title: "Cultural Strategist AI",
    subtitle: "How the AI works and what it knows.",
    accentColor: "#2a8c4a",
    sections: [
      {
        heading: "What is this?",
        content: (
          <p>
            The Cultural Strategist is an AI assistant trained on and connected to your live cultural intelligence data.
            Unlike a generic AI, it has direct access to your current trends, CPS scores, active tensions, cultural calendar,
            and recent briefings. It can reason across all of that data to give you answers grounded in what's actually
            happening in culture right now — not its training data from months ago.
          </p>
        ),
      },
      {
        heading: "What data does it have access to?",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {[
              { label: "Top 20 active trends", desc: "Names, CPS scores, types (Micro Trend, Macro Trend, Emerging Signal, Scheduled Event, Predicted Moment), and current status." },
              { label: "All cultural tensions", desc: "Every tension in the database with its weight (1–10) and description — the underlying forces driving consumer behavior." },
              { label: "Latest daily briefing", desc: "The most recent briefing, up to 800 characters — the current cultural moment summary." },
              { label: "Client context", desc: "The AI knows which brands you serve and can tailor its thinking to specific clients." },
            ].map((d) => (
              <div key={d.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{d.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{d.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "Good questions to ask",
        content: (
          <ul>
            <li>"What's the biggest cultural opportunity this week for [brand]?"</li>
            <li>"Which trend is closest to peaking and should we move on now?"</li>
            <li>"What tension is driving [trend name] and what does that mean creatively?"</li>
            <li>"What two trends are colliding right now that we should be paying attention to?"</li>
            <li>"Give me a creative brief angle for [client] based on today's flashpoints."</li>
          </ul>
        ),
      },
      {
        heading: "Limitations",
        content: (
          <p>
            The AI knows what's in your database. If a trend isn't tracked here, it won't know about it.
            It also won't have information about events that happened after its last data sync.
            For breaking news, use the Culture Pulse ticker at the bottom of the screen.
            Treat the AI's output as a starting point for creative thinking, not a final authority.
          </p>
        ),
      },
    ],
  },

  // ─── Active Tensions ─────────────────────────────────────────────────────────
  tensions: {
    title: "Active Tensions",
    subtitle: "What they are, how they're found, how they're scored, and how to use them.",
    accentColor: "#FF8200",
    sections: [
      {
        heading: "What is a cultural tension?",
        content: (
          <>
            <p>
              A cultural tension is a sustained, unresolved conflict between two opposing values, desires,
              or forces that a significant portion of the population holds simultaneously. Unlike a trend
              (which rises and falls), tensions are structural — they last months to years and form the
              psychological backdrop that <em>causes</em> trends to exist. They are the reason people
              respond to certain ideas and reject others.
            </p>
            <p style={{ marginTop: 10 }}>
              A tension is not a problem with a solution. It is a permanent friction between two things
              people genuinely want at the same time. The most powerful brand work lives in that friction —
              it takes a clear, authentic position rather than trying to satisfy both sides.
            </p>
          </>
        ),
      },
      {
        heading: "How tensions are sourced and identified",
        content: (
          <>
            <p>
              Tensions are both seeded and continuously discovered by the automated pipeline.
              The system started with a foundational set and now evolves on its own as new cultural conflicts emerge from signal data.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {[
                {
                  step: "1. Foundational tensions (system setup)",
                  desc: "When this tool was first built, 14 foundational cultural tensions were identified and seeded into the system. Each was given a name, a description explaining both sides of the conflict, and an initial weight score. These established the starting framework based on the most active structural conflicts in culture at launch.",
                },
                {
                  step: "2. Daily signal scoring",
                  desc: "Every time the daily signal collector runs, Claude reads new signals from Reddit, Bluesky, Hacker News, YouTube, Google Trends, RSS feeds, and Wikipedia alongside all active tensions. For each signal, Claude determines which tensions it intersects and how strongly — that intersection produces the CPS score. A signal that touches multiple high-weight tensions scores higher.",
                },
                {
                  step: "3. Automated tension discovery (weekly)",
                  desc: "Once a week, the pipeline runs an automated tension evaluation. Claude analyzes the last 7 days of trends, signals, and platform data to identify genuinely new structural conflicts that aren't captured by any existing tension. New tensions must show evidence across multiple platforms and represent a sustained unresolved conflict — not just a trending topic. Validated new tensions are automatically added to the system.",
                },
                {
                  step: "4. Weight recalibration (weekly)",
                  desc: "During the same weekly evaluation, Claude recalibrates the weight of every existing tension based on recent signal volume, platform spread, and cultural intensity. Weights shift gradually (max +/-2 per cycle) to reflect whether a tension is heating up or cooling down. Tensions that show very low signal activity are automatically flagged as Dormant.",
                },
                {
                  step: "5. Manual override",
                  desc: "New tensions can also be added manually to the Notion database at any time, and the pipeline will incorporate them into the next run. Weights can be adjusted manually if the automated evaluation hasn't caught a shift yet. The system is designed to self-evolve, but human judgment can always intervene.",
                },
              ].map((s) => (
                <div key={s.step} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid #FF8200", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#FF8200", marginBottom: 5 }}>{s.step}</div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </>
        ),
      },
      {
        heading: "Data sources used to identify tensions",
        content: (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {[
              { label: "Reddit discourse", desc: "Subreddit conversations reveal what people are negotiating in public — especially comment threads where both sides of a debate are active." },
              { label: "Google Trends", desc: "Search intent data shows what people are reaching for. When opposing searches both spike (e.g. 'how to disconnect' and 'best productivity apps'), a tension is often visible." },
              { label: "YouTube trending", desc: "High-engagement video content on both sides of a cultural theme signals an active debate. Creators making videos from opposite perspectives on the same topic are often mapping a real tension." },
              { label: "News RSS + editorial", desc: "Think pieces, op-eds, and cultural criticism often name tensions directly. When editors at major publications are writing about the same conflict from opposite angles, it validates a tension." },
              { label: "Consumer research", desc: "RSS feeds from Pew Research, YouGov, Morning Consult, Nielsen, and similar sources provide quantitative backing. A tension should be visible in survey data, not just online discourse." },
              { label: "Bluesky + Hacker News", desc: "Tech and creator-class discourse often surfaces emerging tensions before they reach mass culture. These platforms are early-warning indicators." },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "Weight scoring — the 1–10 scale",
        content: (
          <>
            <p>
              Every tension has a <strong>Weight</strong> score from 1–10 that measures how intensely
              the tension is being felt in culture right now. It is <em>not</em> a measure of how important
              the tension is philosophically — it's a measure of how loudly it's showing up in current data.
              Weights are automatically recalibrated weekly by the pipeline based on signal volume and platform spread,
              and can also be adjusted manually at any time.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {[
                { range: "9–10", color: "#E8127A", border: "rgba(232,18,122,0.3)", bg: "rgba(232,18,122,0.06)", label: "Critical", desc: "Dominating cultural conversation across multiple platforms. Brands cannot be neutral on this tension without that neutrality itself becoming a position. Active flashpoint." },
                { range: "7–8", color: "#FF8200", border: "rgba(255,130,0,0.3)", bg: "rgba(255,130,0,0.06)", label: "High", desc: "Strongly present in consumer behavior and discourse. Campaigns built against this tension will land. High creative leverage." },
                { range: "5–6", color: "#FF8200", border: "rgba(255,130,0,0.2)", bg: "rgba(255,130,0,0.05)", label: "Active", desc: "Consistently present and useful for strategy. Not dominating the conversation, but clearly felt by your audience. Safe to build against." },
                { range: "1–4", color: "var(--text-secondary)", border: "var(--border)", bg: "var(--surface)", label: "Background", desc: "A real tension, but not generating strong current signal. More of a backdrop context than an active creative opportunity." },
              ].map((t) => (
                <div key={t.range} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 12 }}>
                  <div style={{ width: 32, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: t.color }}>{t.range}</div>
                    <div style={{ fontSize: 10, color: t.color, opacity: 0.8, marginTop: 1 }}>{t.label}</div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </>
        ),
      },
      {
        heading: "Color coding",
        content: (
          <>
            <p>The badge color on the dashboard directly maps to the weight score — it's a visual urgency signal.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {[
                { color: "#E8127A", bg: "rgba(232,18,122,0.08)", border: "rgba(232,18,122,0.3)", label: "Red", score: "9–10", when: "Critical weight. This tension is at peak cultural intensity. Highest priority for brand strategy." },
                { color: "#FF8200", bg: "rgba(255,130,0,0.08)", border: "rgba(255,130,0,0.3)", label: "Orange", score: "7–8", when: "High weight. Strong current signal. Excellent creative leverage opportunity." },
                { color: "#FF8200", bg: "rgba(255,130,0,0.06)", border: "rgba(255,130,0,0.2)", label: "Yellow", score: "5–6", when: "Active weight. Steadily present. Good for thematic campaign alignment." },
                { color: "var(--text-secondary)", bg: "var(--surface)", border: "var(--border)", label: "Gray", score: "1–4", when: "Background weight. Real but quiet. Context, not action." },
              ].map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: "3px 10px", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label}</span>
                    <span style={{ fontSize: 10, color: c.color, opacity: 0.7, marginLeft: 5 }}>{c.score}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.55 }}>{c.when}</p>
                </div>
              ))}
            </div>
          </>
        ),
      },
      {
        heading: "What are Flashpoints?",
        content: (
          <>
            <p>
              A <strong style={{ color: "#2a8c4a" }}>Flashpoint</strong> is a trend with a Cultural Pulse Score (CPS)
              of 80 or above — meaning it is at peak cultural energy right now. Flashpoints are not a type
              of tension; they are a status applied to individual <em>trends</em>. However, the two are deeply
              connected: Flashpoints almost always exist because one or more tensions are fueling them.
            </p>
            <div style={{ background: "rgba(0,79,34,0.06)", border: "1px solid rgba(0,79,34,0.2)", borderRadius: 8, padding: "12px 14px", marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#2a8c4a", display: "inline-block" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#2a8c4a" }}>What Flashpoint status means</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  "CPS is 80–100: the trend is generating maximum observable signal volume across platforms",
                  "The window is typically days to 2 weeks — Flashpoints don't stay at peak for long",
                  "This is your highest-urgency creative and strategy opportunity",
                  "Flashpoints that align with a high-weight tension (red/orange) represent the rarest and most powerful brand moments",
                  "After a Flashpoint, trends typically move to Peaked status — the window has closed",
                ].map((point, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#2a8c4a", fontSize: 10, flexShrink: 0, marginTop: 2 }}>▶</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ),
      },
      {
        heading: "How to use tensions in strategy and creative work",
        content: (
          <>
            <p>
              Tensions are most useful when you can answer: <em>"Which side of this tension does our brand
              authentically represent, and is that where our audience is right now?"</em>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {[
                { label: "Campaign positioning", desc: "The best campaigns don't try to resolve the tension — they take a clear position within it. Showing you understand the conflict earns more trust than pretending it doesn't exist." },
                { label: "Content strategy", desc: "Identify which side of the tension your core audience lives on, then make content that validates their experience. The content will feel more true than content that just chases the trend." },
                { label: "Timing", desc: "Tensions with rising weight scores (check trend over time on the detail page) are about to become louder. Tensions with declining weight are settling — still valid, but the emotional intensity is fading." },
                { label: "Click any badge →", desc: "Each tension has a detail page showing which trends are associated with it, supporting evidence, and the full description of both sides of the conflict." },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{s.label}</div>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.55 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </>
        ),
      },
    ],
  },

  // ─── Trends ──────────────────────────────────────────────────────────────────
  trends: {
    title: "Trends",
    subtitle: "What the three time horizons mean and how trends are scored.",
    accentColor: "#2a8c4a",
    sections: [
      {
        heading: "Three time horizons",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {[
              {
                label: "Micro Trends",
                color: "#2a8c4a",
                time: "Days to weeks",
                desc: "Fast-moving signals that are peaking now. These are the trends to act on this week. High urgency, short window. They include Emerging Signals (pre-mainstream breakouts) and Predicted Moments (forecast intersections).",
              },
              {
                label: "Macro Trends",
                color: "#FF8200",
                time: "3–12 months",
                desc: "Sustained cultural forces with enough momentum to shape strategy over a quarter or more. These inform campaign themes, seasonal planning, and brand positioning. Act within the month, not the day.",
              },
              {
                label: "Historical Trends",
                color: "#E8127A",
                time: "12+ months / settled",
                desc: "Trends that have peaked or stabilized and are now part of the cultural backdrop. They explain why micro and macro trends behave the way they do. Use them as context, not creative inspiration.",
              },
            ].map((t) => (
              <div key={t.label} style={{ background: "var(--surface)", border: `1px solid ${t.color}22`, borderLeft: `3px solid ${t.color}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.time}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "Trend types",
        content: (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {[
              { label: "Micro Trend", desc: "Fast-moving, peaking within weeks." },
              { label: "Macro Trend", desc: "Sustained cultural force, 3–12 month window." },
              { label: "Emerging Signal", desc: "Pre-mainstream breakout. Watch closely." },
              { label: "Predicted Moment", desc: "Forecast intersection of trends + calendar." },
            ].map((t) => (
              <div key={t.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "CPS — Cultural Pulse Score",
        content: (
          <p>
            Each trend has a CPS (0–100) measuring its current signal intensity. Scores above 80 are Flashpoints —
            at peak cultural energy. CPS is assigned by Claude AI when processing signals: Claude reads each new signal
            against all active tensions and their weights, then scores how strongly the signal intersects with those tensions.
            That score is attached to the signal, and a trend's overall CPS reflects the scores of its most recent linked
            signals. A trend can spike briefly (viral moment) or sustain a high score over weeks (macro force). CPS
            measures <em>right now intensity</em>, not long-term importance.
          </p>
        ),
      },
      {
        heading: "Status labels",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {[
              { label: "Active", color: "#2a8c4a", desc: "Currently generating signals and moving." },
              { label: "Rising", color: "#3da65a", desc: "Accelerating — signal velocity is increasing." },
              { label: "Peaked", color: "#FF8200", desc: "Signal volume is declining from its high." },
              { label: "Stable", color: "#E8127A", desc: "Consistent low-level presence. Part of the backdrop." },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color, width: 60, flexShrink: 0 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{s.desc}</span>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "Data sources",
        content: (
          <p>
            Trend signals are collected daily from Reddit (40+ subreddits), Google Trends, YouTube (6 cultural
            categories), Bluesky, Hacker News, Wikipedia trending, and 50+ curated RSS feeds spanning culture,
            entertainment, fashion, music, food, tech, advertising, and consumer research. New trends must be
            recommended by at least 2 independent signals before the system creates them. Trends are seeded
            manually by strategists and tracked automatically after creation.
          </p>
        ),
      },
    ],
  },

  // ─── Research & Insights ──────────────────────────────────────────────────────
  insights: {
    title: "Research & Insights",
    subtitle: "Where the data comes from and how to read it.",
    accentColor: "#38bdf8",
    sections: [
      {
        heading: "What is this widget?",
        content: (
          <p>
            The Research & Insights widget surfaces studies, surveys, academic papers, industry reports,
            and stat-driven findings that have direct relevance to cultural strategy. These are not trend
            signals — they're the evidence layer: the numbers and research that explain <em>why</em> trends
            behave the way they do and give you credible ammunition for client presentations.
          </p>
        ),
      },
      {
        heading: "Types of content",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {[
              { label: "Consumer surveys & polling", desc: "Research from Pew Research, YouGov, Morning Consult, and Nielsen on attitudes, behaviors, and cultural sentiment." },
              { label: "Business & strategy research", desc: "Publications from Think With Google, Harvard Business Review, Kantar, and MIT Sloan Review on marketing and consumer trends." },
              { label: "Cultural criticism & analysis", desc: "Editorial coverage from Culture Study (Anne Helen Petersen), Garbage Day, Blackbird Spyplane, and similar voices that name cultural dynamics before they reach mainstream press." },
              { label: "Industry publications", desc: "Ad Age, Adweek, The Drum, and Marketing Week — covering how brands and agencies are responding to cultural shifts." },
            ].map((t) => (
              <div key={t.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "Sentiment indicators",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {[
              { symbol: "↑", color: "#2a8c4a", label: "Positive", desc: "Finding supports or accelerates an active trend." },
              { symbol: "↓", color: "#E8127A", label: "Negative", desc: "Finding represents headwind or complicates a trend." },
              { symbol: "~", color: "#FF8200", label: "Mixed", desc: "Finding has conflicting or nuanced implications." },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: s.color, width: 20, flexShrink: 0 }}>{s.symbol}</span>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "How content is added",
        content: (
          <p>
            Insights are added manually by strategists or auto-captured from RSS feeds tagged as Research
            sources in the pipeline. Each item is linked to its original source — click "Read study" to
            access the full document.
          </p>
        ),
      },
    ],
  },

  // ─── Cultural Calendar ────────────────────────────────────────────────────────
  calendar: {
    title: "Cultural Calendar",
    subtitle: "How events are scored and why timing matters.",
    accentColor: "#a78bfa",
    sections: [
      {
        heading: "What is the Cultural Calendar?",
        content: (
          <p>
            The Cultural Calendar tracks upcoming events — award shows, cultural moments, holidays,
            sporting events, seasonal milestones, platform-specific moments — and scores each one
            for its cultural relevance right now. It's not a general events calendar; it's a
            prioritized view of which upcoming dates have the most potential to intersect with
            current cultural energy.
          </p>
        ),
      },
      {
        heading: "How events get a CPS score",
        content: (
          <>
            <p>
              Calendar events are assigned a Cultural Potency Score (20–80) by Claude Haiku when the event
              is first extracted from RSS feeds. Claude estimates the event's likely mainstream cultural impact:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {[
                { range: "66–80", label: "Major flashpoint", desc: "Blockbuster premiere, championship, national election — broad mainstream cultural impact." },
                { range: "51–65", label: "Significant moment", desc: "Major album release, playoff game, large industry conference." },
                { range: "36–50", label: "Moderate interest", desc: "Mid-tier film, regional or industry event." },
                { range: "20–35", label: "Niche interest", desc: "Small conference, indie release, specialist event." },
              ].map((t) => (
                <div key={t.range} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", width: 54, flexShrink: 0 }}>{t.range}</span>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{t.label}</span>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>{t.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12 }}>
              The score is set when the event is added to the calendar. It is not automatically updated as
              the event approaches, though strategists can adjust it manually if needed.
            </p>
          </>
        ),
      },
      {
        heading: "Event types",
        content: (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {[
              { label: "Awards", desc: "Oscars, Grammys, Emmys — major cultural accountability moments for the entertainment industry." },
              { label: "Sports", desc: "Games and tournaments that transcend sport and become cultural flashpoints." },
              { label: "Seasonal", desc: "Recurring cultural anchors: Valentine's Day, Black Friday, back-to-school, etc." },
              { label: "Cultural moments", desc: "Album drops, film releases, major product launches with cultural weight." },
              { label: "Digital releases", desc: "Streaming premieres, album drops, and major content launches with measurable cultural anticipation." },
              { label: "Social / Political", desc: "Elections, awareness days, and occasions with brand risk or brand opportunity." },
            ].map((t) => (
              <div key={t.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t.desc}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        heading: "How events are added",
        content: (
          <p>
            A calendar collector runs automatically, pulling from entertainment, music, sports, tech, and
            politics RSS feeds (Deadline, Variety, Pitchfork, ESPN, TechCrunch, NPR, NYT, and others).
            Claude Haiku reads the feed content and extracts any article that mentions a specific upcoming
            date — movie releases, award show dates, album drops, sporting events, elections, conferences.
            Events within the next 90 days are scored and added. Deduplication prevents the same event from
            being added twice. Strategists can also add events manually.
          </p>
        ),
      },
      {
        heading: "How to use it",
        content: (
          <p>
            Use the calendar to plan ahead: which events in the next 30 days are worth building content
            or activations around? A high-scoring event that intersects with your brand's relevant flashpoints
            is your highest-priority cultural moment. View the full calendar for a 90-day look ahead.
          </p>
        ),
      },
    ],
  },

  // ─── Culture Pulse Ticker ────────────────────────────────────────────────────
  ticker: {
    title: "Culture Pulse Ticker",
    subtitle: "What's being talked about right now — Reddit community signal + Wikipedia trending.",
    accentColor: "rgba(232,18,122,0.7)",
    sections: [
      {
        heading: "What is the ticker?",
        content: (
          <p>
            The Culture Pulse Ticker is a fixed scrolling strip at the bottom of every page showing
            two real-time cultural signals: what communities are actively discussing and upvoting on Reddit
            right now, and what people are reading about on Wikipedia. Together they work like Twitter/X
            trending — surfacing what's actually popping in the moment, curated by collective human attention
            rather than editorial selection.
          </p>
        ),
      },
      {
        heading: "Data sources",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div style={{ background: "var(--surface)", border: "1px solid rgba(255,130,0,0.2)", borderLeft: "3px solid #FF8200", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#FF8200", marginBottom: 4 }}>REDDIT — Community trending</div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55, marginBottom: 8 }}>
                Hot posts from culture-relevant subreddits, ranked by community votes and recency. This works similarly to
                Twitter trending — high-scoring posts are things that large groups of people are actively reacting to
                right now. Each item shows the source subreddit (e.g. r/Music, r/television).
              </p>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Subreddits monitored: r/entertainment, r/Music, r/television, r/movies, r/sports, r/popculture, r/hiphopheads
              </div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid rgba(232,18,122,0.2)", borderLeft: "3px solid rgba(232,18,122,0.7)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,18,122,0.7)", marginBottom: 4 }}>READING — Wikipedia Trending</div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>
                The most-viewed Wikipedia articles in the past 24 hours. When something enters mainstream conversation,
                people look it up — Wikipedia trending is a reliable indicator that a topic is crossing from niche into
                broad cultural awareness. Items link directly to the Wikipedia article.
              </p>
            </div>
          </div>
        ),
      },
      {
        heading: "Why not Twitter/X trending?",
        content: (
          <>
            <p>
              Twitter/X was the ideal source for this — real-time trending hashtags are exactly the signal
              we want. Unfortunately, access to Twitter trending data now requires a paid API subscription.
              The free tier of the Twitter/X API (v2) does not include trending topics.
              Paid tiers start at <strong>$100/month</strong> (Basic) and trending endpoints require
              the <strong>Pro tier at $5,000/month</strong>.
            </p>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Why Reddit is a good substitute</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  "Reddit's hot algorithm is vote + recency-weighted — things blowing up right now rise to the top, just like Twitter trending",
                  "Reddit has 100M+ daily active users; cultural events, music drops, sports moments, and controversies surface within hours",
                  "Unlike Twitter trending (which can be gamed or manipulated by bot networks), Reddit upvotes from real accounts are harder to fake at scale",
                  "The public JSON API is free, reliable, and doesn't require authentication",
                ].map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#FF8200", fontSize: 10, flexShrink: 0, marginTop: 2 }}>▶</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ),
      },
      {
        heading: "Why not Google Trends?",
        content: (
          <p>
            Google Trends has a public RSS feed for daily trending searches, but it is geo-restricted and
            frequently blocked by cloud hosting providers (including Vercel, which hosts this tool) due to
            rate limiting and bot-detection. Google does not offer a public API for real-time trending data —
            it requires scraping, which violates their terms of service and is unreliable. We attempted to
            use the RSS feed but removed it due to consistent failures on the server side.
            Reddit provides a more reliable signal for roughly the same intent: <em>what people are reacting to right now.</em>
          </p>
        ),
      },
      {
        heading: "How to read it",
        content: (
          <p>
            Hover over the ticker to pause it. <strong style={{ color: "#FF8200" }}>REDDIT</strong> items show
            the community and are linked to the post — click to see the full conversation.{" "}
            <strong style={{ color: "rgba(232,18,122,0.7)" }}>READING</strong> items are Wikipedia trending and link to the article.
            When the same topic appears in both sources, it is crossing from active conversation into
            the explanatory phase — people are not just reacting, they are trying to understand it.
            That transition is often a leading indicator for your tracked trends.
          </p>
        ),
      },
    ],
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(INFO_PAGES).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = INFO_PAGES[id];
  if (!page) return { title: "Not Found" };
  return { title: `${page.title} — Flytrap` };
}

export default async function InfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = INFO_PAGES[id];
  if (!page) notFound();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 80 }}>
      {/* Back link */}
      <Link
        href="/"
        style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none", display: "inline-block", marginBottom: 24 }}
        className="link-hover"
      >
        ← Back to dashboard
      </Link>

      {/* Title block */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 4, height: 24, borderRadius: 2, background: page.accentColor, flexShrink: 0 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
            {page.title}
          </h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 0 14px", maxWidth: 600 }}>
          {page.subtitle}
        </p>
      </div>

      {/* Sections */}
      {page.sections.map((section) => (
        <Section key={section.heading} title={section.heading}>
          {section.content}
        </Section>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h3 style={{
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-tertiary)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        margin: "0 0 12px",
        paddingBottom: 8,
        borderBottom: "1px solid var(--border)",
      }}>
        {title}
      </h3>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
        {children}
      </div>
    </section>
  );
}
