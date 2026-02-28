/**
 * notion.ts — Notion API data layer for the Cultural Forecaster dashboard.
 * Uses native fetch() against the Notion REST API directly.
 * The @notionhq/client v3 moved database query to a different endpoint,
 * so we bypass the client library for all database operations.
 */

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";

function notionHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

const TRENDS_DB = process.env.NOTION_TRENDS_DB!;
const TENSIONS_DB = process.env.NOTION_TENSIONS_DB!;
const EVIDENCE_DB = process.env.NOTION_EVIDENCE_DB!;
const CALENDAR_DB = process.env.NOTION_CALENDAR_DB!;
const BRIEFING_DB = process.env.NOTION_BRIEFING_DB!;
const MOMENTS_DB = process.env.NOTION_MOMENTS_DB!;

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrendStatus =
  | "Exploding"
  | "Rising"
  | "Peaked"
  | "Stable"
  | "Emerging"
  | "Archived";

export type TrendType =
  | "Macro Trend"
  | "Micro Trend"
  | "Emerging Signal"
  | "Scheduled Event"
  | "Predicted Moment";

export interface Trend {
  id: string;
  name: string;
  type: TrendType | "";
  status: TrendStatus | "";
  cps: number;
  momentum: number;
  pinned: boolean;
  summary: string;
  forecast: string;
  firstDetected: string | null;
  lastUpdated: string | null;
  linkedTensions: string[];
  /** CPS history — last 14 daily readings, oldest first. Empty if no history yet. */
  sparkline: number[];
  /** Total number of evidence items linked to this trend (may be undefined if not loaded). */
  evidenceCount?: number;
  /** Number of distinct source platforms (may be undefined if not loaded). */
  platformCount?: number;
}

export interface Tension {
  id: string;
  name: string;
  weight: number;
  status: string;
  description: string;
  linkedTrendIds?: string[];
}

export interface CalendarEvent {
  id: string;
  name: string;
  date: string;
  type: string;
  categories: string[];
  cps: number;
  notes: string;
}

export interface Evidence {
  id: string;
  title: string;
  url: string | null;
  platform: string;
  dateCaptured: string | null;
  summary: string;
  sentiment: string;
  source?: string; // e.g. "NYT Arts", "Variety" — populated for news ticker items
}

export interface Briefing {
  id: string;
  date: string;
  content: string;
  flashpointCount: number;
  highlights: string;
}

export type MomentType = "Catalyst" | "Collision" | "Pressure" | "Pattern" | "Void";
export type MomentHorizon = "This Week" | "2-4 Weeks" | "1-3 Months";
export type MomentStatus = "Predicted" | "Forming" | "Happening" | "Passed" | "Missed";

export interface CulturalMoment {
  id: string;
  name: string;
  narrative: string;
  type: MomentType;
  horizon: MomentHorizon;
  status: MomentStatus;
  confidence: number;
  magnitude: number;
  watchFor: string;
  reasoning: string;
  windowStart: string | null;
  windowEnd: string | null;
  createdDate: string | null;
  lastUpdated: string | null;
  linkedTrendIds: string[];
  linkedTensionIds: string[];
  linkedEventIds: string[];
  outcomeNotes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function richText(prop: any): string {
  return prop?.rich_text?.[0]?.plain_text ?? "";
}

function selectName(prop: any): string {
  return prop?.select?.name ?? "";
}

function multiSelect(prop: any): string[] {
  return prop?.multi_select?.map((o: any) => o.name) ?? [];
}

function dateStart(prop: any): string | null {
  return prop?.date?.start ?? null;
}

function numberProp(prop: any): number {
  return prop?.number ?? 0;
}

function titleText(props: any): string {
  // Find the title property (type === "title")
  for (const key of Object.keys(props)) {
    if (props[key]?.type === "title") {
      return props[key]?.title?.[0]?.plain_text ?? "";
    }
  }
  return "";
}

async function queryAll(
  databaseId: string,
  filter?: any,
  cacheOptions?: { revalidate?: number; noStore?: boolean }
): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const body: Record<string, any> = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    // Build fetch cache strategy
    const fetchInit: RequestInit & { next?: any } = {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify(body),
    };
    if (cacheOptions?.noStore) {
      fetchInit.cache = "no-store";
    } else {
      // Default: revalidate every 5 min
      fetchInit.next = { revalidate: cacheOptions?.revalidate ?? 300 };
    }

    const res = await fetch(
      `${NOTION_BASE}/databases/${databaseId}/query`,
      fetchInit
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion query failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    results.push(...data.results);
    hasMore = data.has_more ?? false;
    cursor = data.next_cursor ?? undefined;
  }

  return results;
}

async function getPage(pageId: string): Promise<any> {
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    headers: notionHeaders(),
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Sparkline helper ──────────────────────────────────────────────────────────

/**
 * Parse a comma-separated CPS history string ("65,72,78,80") into an array of numbers.
 * Returns [] if the string is empty or unparseable.
 */
function parseSparkline(raw: string): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((n) => !isNaN(n));
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

export async function getTrends(excludeArchived = true): Promise<Trend[]> {
  const filter = excludeArchived
    ? { property: "Status", select: { does_not_equal: "Archived" } }
    : undefined;

  const pages = await queryAll(TRENDS_DB, filter);

  return pages
    .map((p: any) => {
      const props = p.properties;
      return {
        id: p.id,
        name: titleText(props),
        type: selectName(props.Type) as TrendType,
        status: selectName(props.Status) as TrendStatus,
        cps: numberProp(props["Cultural Potency Score"]),
        momentum: numberProp(props["Momentum Score"]),
        pinned: props.Pinned?.checkbox ?? false,
        summary: richText(props.Summary),
        forecast: richText(props.Forecast),
        firstDetected: dateStart(props["First Detected"]),
        lastUpdated: dateStart(props["Last Updated"]),
        linkedTensions:
          props["Linked Tensions"]?.relation?.map((r: any) => r.id) ?? [],
        sparkline: parseSparkline(richText(props["CPS Sparkline"])),
      } as Trend;
    })
    .sort((a, b) => b.cps - a.cps);
}

export async function getTrend(id: string): Promise<Trend | null> {
  try {
    const p: any = await getPage(id);
    if (!p) return null;
    const props = p.properties;
    return {
      id: p.id,
      name: titleText(props),
      type: selectName(props.Type) as TrendType,
      status: selectName(props.Status) as TrendStatus,
      cps: numberProp(props["Cultural Potency Score"]),
      momentum: numberProp(props["Momentum Score"]),
      pinned: props.Pinned?.checkbox ?? false,
      summary: richText(props.Summary),
      forecast: richText(props.Forecast),
      firstDetected: dateStart(props["First Detected"]),
      lastUpdated: dateStart(props["Last Updated"]),
      linkedTensions:
        props["Linked Tensions"]?.relation?.map((r: any) => r.id) ?? [],
      sparkline: parseSparkline(richText(props["CPS Sparkline"])),
    };
  } catch {
    return null;
  }
}

export async function getTensions(): Promise<Tension[]> {
  const pages = await queryAll(TENSIONS_DB);
  return pages
    .map((p: any) => {
      const props = p.properties;
      return {
        id: p.id,
        name: titleText(props),
        weight: numberProp(props.Weight),
        status: selectName(props.Status),
        description: richText(props.Description),
        linkedTrendIds: props["Linked Trends"]?.relation?.map((r: any) => r.id) ?? [],
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

export async function getTension(id: string): Promise<Tension | null> {
  try {
    const p: any = await getPage(id);
    if (!p) return null;
    const props = p.properties;
    return {
      id: p.id,
      name: titleText(props),
      weight: numberProp(props.Weight),
      status: selectName(props.Status),
      description: richText(props.Description),
      linkedTrendIds: props["Linked Trends"]?.relation?.map((r: any) => r.id) ?? [],
    };
  } catch {
    return null;
  }
}

export async function getTrendsForTension(tensionId: string): Promise<Trend[]> {
  const pages = await queryAll(TRENDS_DB, {
    property: "Linked Tensions",
    relation: { contains: tensionId },
  });
  return pages
    .map((p: any) => {
      const props = p.properties;
      return {
        id: p.id,
        name: titleText(props),
        type: selectName(props.Type) as TrendType,
        status: selectName(props.Status) as TrendStatus,
        cps: numberProp(props["Cultural Potency Score"]),
        momentum: numberProp(props["Momentum Score"]),
        pinned: props.Pinned?.checkbox ?? false,
        summary: richText(props.Summary),
        forecast: richText(props.Forecast),
        firstDetected: dateStart(props["First Detected"]),
        lastUpdated: dateStart(props["Last Updated"]),
        linkedTensions: props["Linked Tensions"]?.relation?.map((r: any) => r.id) ?? [],
      } as Trend;
    })
    .sort((a, b) => b.cps - a.cps);
}

export async function getEvidenceForTension(tensionId: string): Promise<Evidence[]> {
  // Get all trends linked to this tension, then collect their evidence
  const trends = await getTrendsForTension(tensionId);
  const evidenceLists = await Promise.all(
    trends.slice(0, 5).map((t) => getEvidenceForTrend(t.id)) // cap at 5 trends to avoid rate limits
  );
  // Flatten + deduplicate by id, sort by date
  const seen = new Set<string>();
  return evidenceLists
    .flat()
    .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
    .sort((a, b) => (b.dateCaptured ?? "").localeCompare(a.dateCaptured ?? ""))
    .slice(0, 30);
}

export async function getUpcomingEvents(days = 90): Promise<CalendarEvent[]> {
  const today = new Date().toISOString().split("T")[0];
  const end = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

  const pages = await queryAll(CALENDAR_DB, {
    and: [
      { property: "Date", date: { on_or_after: today } },
      { property: "Date", date: { on_or_before: end } },
    ],
  });

  return pages
    .map((p: any) => {
      const props = p.properties;
      return {
        id: p.id,
        name: titleText(props),
        date: dateStart(props.Date) ?? "",
        type: selectName(props.Type),
        categories: multiSelect(props.Category),
        cps: numberProp(props["Cultural Potency Score"]),
        notes: richText(props.Notes),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Shared parser for an Evidence Log Notion page → Evidence object */
function parseEvidencePage(p: any): Evidence {
  const props = p.properties;
  return {
    id: p.id,
    title: titleText(props),
    url: props["Source URL"]?.url ?? null,
    platform: selectName(props["Source Platform"]),
    dateCaptured: dateStart(props["Date Captured"]),
    summary: richText(props.Summary),
    sentiment: selectName(props.Sentiment),
  };
}

export async function getEvidenceForTrend(trendId: string): Promise<Evidence[]> {
  const pages = await queryAll(EVIDENCE_DB, {
    property: "Linked Trends",
    relation: { contains: trendId },
  });

  return pages
    .map((p: any) => {
      const props = p.properties;
      return {
        id: p.id,
        title: titleText(props),
        url: props["Source URL"]?.url ?? null,
        platform: selectName(props["Source Platform"]),
        dateCaptured: dateStart(props["Date Captured"]),
        summary: richText(props.Summary),
        sentiment: selectName(props.Sentiment),
      };
    })
    .sort((a, b) => (b.dateCaptured ?? "").localeCompare(a.dateCaptured ?? ""));
}

export async function getLatestBriefings(limit = 5): Promise<Briefing[]> {
  // Briefings are written once daily — bypass cache so new ones appear immediately
  const pages = await queryAll(BRIEFING_DB, undefined, { noStore: true });

  return pages
    .map((p: any) => {
      const props = p.properties;
      // Briefing content is chunked across multiple rich_text blocks (Notion 2000-byte limit).
      // Join all blocks to reconstruct the full text.
      const contentBlocks: string[] =
        props["Briefing Content"]?.rich_text?.map((b: any) => b.plain_text ?? "") ?? [];
      return {
        id: p.id,
        date: titleText(props),
        content: contentBlocks.join(""),
        flashpointCount: numberProp(props["Flashpoint Count"]),
        highlights: richText(props["Key Highlights"]),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * Latest hard-news signals — used for the dashboard news ticker.
 * Filters to news-oriented RSS sources only (excludes opinion, substacks,
 * analysis, features). Titles are cleaned (source prefix stripped).
 */

// Sources that publish hard news / breaking stories (not opinion or features)
const NEWS_SOURCES = new Set([
  "Axios", "NYT Arts", "NYT Style", "NYT Tech",
  "The Verge", "TechCrunch", "Variety", "Hollywood Reporter",
  "People", "BBC Arts", "BBC Culture", "Guardian US", "Guardian Culture",
  "Daily Beast Culture", "Vanity Fair", "Fast Company",
  "Ad Age", "Adweek", "Marketing Week", "The Drum",
  "Eater", "SI Culture", "BuzzFeed News",
  "Vulture", "Pitchfork", "Rolling Stone",
  "Hypebeast", "Complex", "Morning Brew", "Marketing Brew",
  "Business of Fashion", "Intelligencer", "New York Mag",
  "Consequence of Sound", "Polygon", "Kotaku",
]);

export async function getLatestNewsSignals(limit = 20): Promise<Evidence[]> {
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const pages = await queryAll(
    EVIDENCE_DB,
    {
      and: [
        { property: "Date Captured", date: { on_or_after: cutoff } },
        { property: "Source Platform", select: { equals: "RSS" } },
      ],
    },
    { revalidate: 1800 } // 30-min cache
  );

  return pages
    .map(parseEvidencePage)
    .filter((e) => {
      if (!e.url || !e.title || e.title.length < 10) return false;
      // Check if title starts with a known news source prefix
      const colonIdx = e.title.indexOf(": ");
      if (colonIdx < 0) return false;
      const source = e.title.slice(0, colonIdx);
      return NEWS_SOURCES.has(source);
    })
    .map((e) => {
      const colonIdx = e.title.indexOf(": ");
      return {
        ...e,
        source: colonIdx > 0 ? e.title.slice(0, colonIdx) : undefined,
        title: colonIdx > 0 ? e.title.slice(colonIdx + 2) : e.title,
      };
    })
    .sort((a, b) => (b.dateCaptured ?? "").localeCompare(a.dateCaptured ?? ""))
    .slice(0, limit);
}

/**
 * Research & insights signals — studies, surveys, data reports.
 * Populated when Source Platform = "Research" (set by research-specific RSS feeds).
 */
/**
 * Returns a map of trendId → { count, platformCount } by querying all evidence
 * items in a single bulk call. Used to show signal confidence on TrendCards.
 * Cached for 10 minutes — it's a full-DB scan.
 */
export async function getEvidenceCounts(): Promise<
  Map<string, { count: number; platformCount: number }>
> {
  // Query all evidence items (paginated internally by queryAll)
  const pages = await queryAll(EVIDENCE_DB, undefined, { revalidate: 600 });

  // Accumulate per-trend
  const raw = new Map<string, { count: number; platforms: Set<string> }>();
  for (const p of pages) {
    const platform = selectName(p.properties["Source Platform"]);
    const linked: string[] =
      p.properties["Linked Trends"]?.relation?.map((r: any) => r.id) ?? [];
    for (const trendId of linked) {
      if (!raw.has(trendId)) raw.set(trendId, { count: 0, platforms: new Set() });
      const entry = raw.get(trendId)!;
      entry.count++;
      if (platform) entry.platforms.add(platform);
    }
  }

  const result = new Map<string, { count: number; platformCount: number }>();
  for (const [id, data] of raw) {
    result.set(id, { count: data.count, platformCount: data.platforms.size });
  }
  return result;
}

// ── Moments ──────────────────────────────────────────────────────────────────

function parseMomentPage(p: any): CulturalMoment {
  const props = p.properties;
  return {
    id: p.id,
    name: titleText(props),
    narrative: richText(props.Narrative),
    type: (selectName(props.Type) || "Catalyst") as MomentType,
    horizon: (selectName(props.Horizon) || "2-4 Weeks") as MomentHorizon,
    status: (selectName(props.Status) || "Predicted") as MomentStatus,
    confidence: numberProp(props.Confidence),
    magnitude: numberProp(props.Magnitude),
    watchFor: richText(props["Watch For"]),
    reasoning: richText(props.Reasoning),
    windowStart: dateStart(props["Predicted Window Start"]),
    windowEnd: dateStart(props["Predicted Window End"]),
    createdDate: dateStart(props["Created Date"]),
    lastUpdated: dateStart(props["Last Updated"]),
    linkedTrendIds:
      props["Linked Trends"]?.relation?.map((r: any) => r.id) ?? [],
    linkedTensionIds:
      props["Linked Tensions"]?.relation?.map((r: any) => r.id) ?? [],
    linkedEventIds:
      props["Linked Calendar Events"]?.relation?.map((r: any) => r.id) ?? [],
    outcomeNotes: richText(props["Outcome Notes"]),
  };
}

/**
 * Get active cultural moment predictions (not Passed or Missed).
 * Sorted by confidence desc, then magnitude desc.
 */
export async function getActiveMoments(): Promise<CulturalMoment[]> {
  if (!MOMENTS_DB) return [];

  const pages = await queryAll(
    MOMENTS_DB,
    {
      and: [
        { property: "Status", select: { does_not_equal: "Passed" } },
        { property: "Status", select: { does_not_equal: "Missed" } },
      ],
    },
    { noStore: true }
  );

  return pages
    .map(parseMomentPage)
    .sort((a, b) => b.confidence - a.confidence || b.magnitude - a.magnitude);
}

/**
 * Get a single cultural moment by ID.
 */
export async function getMoment(id: string): Promise<CulturalMoment | null> {
  try {
    const p = await getPage(id);
    if (!p) return null;
    return parseMomentPage(p);
  } catch {
    return null;
  }
}

/**
 * Get all moments (including past/missed) for history tracking.
 */
export async function getAllMoments(): Promise<CulturalMoment[]> {
  if (!MOMENTS_DB) return [];

  const pages = await queryAll(MOMENTS_DB, undefined, { revalidate: 300 });

  return pages
    .map(parseMomentPage)
    .sort((a, b) => {
      // Active moments first, then by confidence
      const statusOrder: Record<string, number> = {
        Happening: 0,
        Forming: 1,
        Predicted: 2,
        Passed: 3,
        Missed: 4,
      };
      const sa = statusOrder[a.status] ?? 5;
      const sb = statusOrder[b.status] ?? 5;
      if (sa !== sb) return sa - sb;
      return b.confidence - a.confidence;
    });
}

// ── Agent Activity ────────────────────────────────────────────────────────

const AGENT_ACTIVITY_DB = process.env.NOTION_AGENT_ACTIVITY_DB;

export type AgentName = "sentinel" | "scout" | "oracle" | "architect" | "optimize" | "strategist" | "isabel";
export type AgentReportType = "health_check" | "scorecard" | "operations" | "integrity" | "self_eval" | "synthesis" | "proposal" | "task";

export interface AgentActivity {
  id: string;
  title: string;
  agent: AgentName;
  type: AgentReportType;
  status: string;
  priority: string;
  summary: string;
  details: string;
  date: string | null;
}

function parseAgentActivity(p: any): AgentActivity {
  const props = p.properties;
  return {
    id: p.id,
    title: titleText(props),
    agent: (selectName(props.Agent) || "sentinel") as AgentName,
    type: (selectName(props.Type) || "task") as AgentReportType,
    status: selectName(props.Status),
    priority: selectName(props.Priority),
    summary: richText(props.Summary),
    details: richText(props.Details),
    date: dateStart(props.Date),
  };
}

export async function getAgentActivity(limit = 30): Promise<AgentActivity[]> {
  if (!AGENT_ACTIVITY_DB) return [];

  const pages = await queryAll(AGENT_ACTIVITY_DB, undefined, { noStore: true });

  return pages
    .map(parseAgentActivity)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, limit);
}

export async function getLatestAgentReport(agent: AgentName): Promise<AgentActivity | null> {
  if (!AGENT_ACTIVITY_DB) return null;

  const pages = await queryAll(
    AGENT_ACTIVITY_DB,
    { property: "Agent", select: { equals: agent } },
    { noStore: true }
  );

  const sorted = pages
    .map(parseAgentActivity)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return sorted[0] ?? null;
}

export async function getResearchInsights(limit = 6): Promise<Evidence[]> {
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]; // last 3 weeks

  const pages = await queryAll(
    EVIDENCE_DB,
    {
      and: [
        { property: "Date Captured", date: { on_or_after: cutoff } },
        { property: "Source Platform", select: { equals: "Research" } },
      ],
    },
    { revalidate: 3600 }
  );

  return pages
    .map(parseEvidencePage)
    .filter((e) => e.summary && e.summary.length > 20)
    .sort((a, b) => (b.dateCaptured ?? "").localeCompare(a.dateCaptured ?? ""))
    .slice(0, limit);
}
