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
const FEEDBACK_DB = process.env.NOTION_FEEDBACK_DB;

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
  linkedTrendIds?: string[];  // from Linked Trends relation
  rawContent?: string;        // Raw Content rich_text field
  /** Relevance score computed by Social Radar ranking. Not stored in Notion. */
  _score?: number;
  /** Parsed engagement label for display (e.g. "1.3B views"). Not stored in Notion. */
  _engagementLabel?: string;
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

/** Concatenate ALL rich_text blocks (for long fields like Raw Content). */
function richTextFull(prop: any): string {
  return (
    prop?.rich_text?.map((rt: any) => rt.plain_text).join("") ?? ""
  );
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
    linkedTrendIds:
      props["Linked Trends"]?.relation?.map((r: any) => r.id) ?? [],
    rawContent: richTextFull(props["Raw Content"]),
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
  // Briefings are written once daily — short cache is fine
  const pages = await queryAll(BRIEFING_DB, undefined, { revalidate: 300 });

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
        createdTime: p.created_time ?? "",
      };
    })
    // Sort by date desc, then by created_time desc (latest wins on same date)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdTime.localeCompare(a.createdTime);
    })
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
    { revalidate: 300 }
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

  const pages = await queryAll(AGENT_ACTIVITY_DB, undefined, { revalidate: 300 });

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
    { revalidate: 300 }
  );

  const sorted = pages
    .map(parseAgentActivity)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return sorted[0] ?? null;
}

// ── Sync Recap ────────────────────────────────────────────────────────────

export interface SyncRecap {
  /** Signals collected today, grouped by platform */
  signalsByPlatform: Record<string, number>;
  /** Total new signals today */
  totalSignals: number;
  /** Trends updated today with their CPS */
  updatedTrends: { name: string; cps: number; status: string }[];
  /** Active moments (Predicted/Forming/Happening) created or updated today */
  recentMoments: { name: string; type: string; status: string; confidence: number }[];
  /** Top CPS trend overall */
  topTrend: { name: string; cps: number } | null;
  /** When the data was fetched */
  timestamp: string;
}

/**
 * Get a recap of changes since the last sync.
 * Queries Evidence (today), Trends (updated today), Moments (updated today).
 */
export async function getSyncRecap(): Promise<SyncRecap> {
  const today = new Date().toISOString().split("T")[0];

  // Evidence collected today — 5 min cache is plenty for a daily pulse
  const evidencePages = await queryAll(
    EVIDENCE_DB,
    { property: "Date Captured", date: { equals: today } },
    { revalidate: 300 }
  );

  const signalsByPlatform: Record<string, number> = {};
  for (const p of evidencePages) {
    const platform = selectName(p.properties["Source Platform"]) || "Unknown";
    signalsByPlatform[platform] = (signalsByPlatform[platform] || 0) + 1;
  }

  // Trends updated today
  const trendPages = await queryAll(
    TRENDS_DB,
    {
      and: [
        { property: "Last Updated", date: { on_or_after: today } },
        { property: "Status", select: { does_not_equal: "Archived" } },
      ],
    },
    { revalidate: 300 }
  );

  const updatedTrends = trendPages
    .map((p: any) => ({
      name: titleText(p.properties),
      cps: numberProp(p.properties["Cultural Potency Score"]),
      status: selectName(p.properties.Status),
    }))
    .sort((a, b) => b.cps - a.cps)
    .slice(0, 8);

  // Moments updated today
  let recentMoments: SyncRecap["recentMoments"] = [];
  if (MOMENTS_DB) {
    const momentPages = await queryAll(
      MOMENTS_DB,
      {
        and: [
          { property: "Last Updated", date: { on_or_after: today } },
          { property: "Status", select: { does_not_equal: "Passed" } },
          { property: "Status", select: { does_not_equal: "Missed" } },
        ],
      },
      { revalidate: 300 }
    );

    recentMoments = momentPages
      .map((p: any) => ({
        name: titleText(p.properties),
        type: selectName(p.properties.Type) || "Catalyst",
        status: selectName(p.properties.Status) || "Predicted",
        confidence: numberProp(p.properties.Confidence),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  // Top trend overall
  const allTrends = trendPages
    .map((p: any) => ({
      name: titleText(p.properties),
      cps: numberProp(p.properties["Cultural Potency Score"]),
    }))
    .sort((a, b) => b.cps - a.cps);

  return {
    signalsByPlatform,
    totalSignals: evidencePages.length,
    updatedTrends,
    recentMoments,
    topTrend: allTrends[0] ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ── User Feedback ─────────────────────────────────────────────────────────

export type FeedbackStatus = "new" | "triaged" | "in_progress" | "resolved" | "wont_fix";
export type FeedbackCategory = "bug" | "feature" | "data_quality" | "design" | "prediction" | "source" | "performance" | "other";

export interface UserFeedback {
  id: string;
  message: string;
  page: string;
  category: FeedbackCategory;
  priority: string;
  status: FeedbackStatus;
  routedTo: AgentName | "";
  response: string;
  submitted: string | null;
}

function parseFeedbackPage(p: any): UserFeedback {
  const props = p.properties;
  return {
    id: p.id,
    message: titleText(props),
    page: selectName(props.Page),
    category: (selectName(props.Category) || "other") as FeedbackCategory,
    priority: selectName(props.Priority) || "medium",
    status: (selectName(props.Status) || "new") as FeedbackStatus,
    routedTo: (selectName(props["Routed To"]) || "") as AgentName | "",
    response: richText(props.Response),
    submitted: dateStart(props.Submitted),
  };
}

/**
 * Get user feedback items. By default returns only active items (new/triaged/in_progress).
 * Pass includeResolved=true to get all feedback.
 */
export async function getUserFeedback(includeResolved = false): Promise<UserFeedback[]> {
  if (!FEEDBACK_DB) return [];

  const filter = includeResolved
    ? undefined
    : {
        or: [
          { property: "Status", select: { equals: "new" } },
          { property: "Status", select: { equals: "triaged" } },
          { property: "Status", select: { equals: "in_progress" } },
        ],
      };

  const pages = await queryAll(FEEDBACK_DB, filter, { noStore: true });

  return pages
    .map(parseFeedbackPage)
    .sort((a, b) => (b.submitted ?? "").localeCompare(a.submitted ?? ""));
}

/**
 * Parse a human-readable number like "1.3B", "450M", "12K", "1,234" → raw number.
 */
function parseHumanNumber(s: string): number {
  const cleaned = s.replace(/,/g, "").trim();
  const m = cleaned.match(/^([\d.]+)\s*([BMK])?$/i);
  if (!m) return 0;
  const base = parseFloat(m[1]);
  const suffix = (m[2] ?? "").toUpperCase();
  if (suffix === "B") return base * 1_000_000_000;
  if (suffix === "M") return base * 1_000_000;
  if (suffix === "K") return base * 1_000;
  return base;
}

/**
 * Format a large number as a compact label (e.g. 1300000000 → "1.3B").
 */
function formatCompactNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

/** Brand/category keywords that boost relevance for QSR/brand monitoring. */
const BRAND_KEYWORDS = /\b(mcdonald|burger|restaurant|fast food|qsr|brand|ceo|chipotle|starbucks|wendy|taco bell|chick-fil-a|subway|pizza hut|domino|kfc|popeyes)\b/i;

/**
 * Compute a relevance score for a social signal.
 * Higher = more important. Used to rank Social Radar signals.
 */
function scoreSocialSignal(e: Evidence): { score: number; engagementLabel: string } {
  let score = 0;
  let engagementLabel = "";
  const raw = e.rawContent ?? "";
  const platform = e.platform;

  // ── A. Engagement metrics (parsed from rawContent) ──

  if (platform === "TikTok") {
    // Views: "1.3B views", "450M views", etc.
    const viewsMatch = raw.match(/([\d,.]+[BMK]?)\s*views/i);
    if (viewsMatch) {
      const views = parseHumanNumber(viewsMatch[1]);
      if (views >= 1_000_000_000) { score += 40; engagementLabel = formatCompactNumber(views) + " views"; }
      else if (views >= 100_000_000) { score += 30; engagementLabel = formatCompactNumber(views) + " views"; }
      else if (views >= 10_000_000) { score += 20; engagementLabel = formatCompactNumber(views) + " views"; }
      else if (views >= 1_000_000) { score += 10; engagementLabel = formatCompactNumber(views) + " views"; }
    }
    // Rank: "rank #3", "#1", "Rank: 1"
    const rankMatch = raw.match(/rank\s*#?(\d+)|#(\d+)/i);
    if (rankMatch) {
      const rank = parseInt(rankMatch[1] ?? rankMatch[2], 10);
      if (rank <= 3) score += 15;
      else if (rank <= 10) score += 10;
      else if (rank <= 20) score += 5;
    }
    // NEW indicator
    if (/\(NEW\)/i.test(raw)) score += 10;
    // Category: Food & Beverage
    if (/food\s*&?\s*beverage/i.test(raw)) score += 20;
  }

  // ── B. Enrichment quality ──

  // Has "Context:" (enriched Trends24 / X signal)
  if (/Context:/i.test(raw)) score += 15;
  // Non-empty summary (Claude has processed it)
  if (e.summary && e.summary.length > 10) score += 20;

  // ── C. Linked to trends ──

  if (e.linkedTrendIds && e.linkedTrendIds.length > 0) score += 15;

  // ── D. Brand/category relevance ──

  const searchText = (e.title + " " + raw).toLowerCase();
  if (BRAND_KEYWORDS.test(searchText)) score += 10;

  // ── E. Recency ──

  if (e.dateCaptured) {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (e.dateCaptured === today) score += 10;
    else if (e.dateCaptured === yesterday) score += 5;
  }

  return { score, engagementLabel };
}

/**
 * Latest social signals — trending topics, viral moments, fast-moving conversations.
 * Filters to social platforms (Social, TikTok, Reddit, Bluesky).
 * 48-hour window, 5-minute cache for freshness.
 * Ranked by relevance score, not chronological order.
 */
export async function getLatestSocialSignals(limit = 15): Promise<Evidence[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const pages = await queryAll(
    EVIDENCE_DB,
    {
      and: [
        { property: "Date Captured", date: { on_or_after: cutoff } },
        {
          or: [
            { property: "Source Platform", select: { equals: "Social" } },
            { property: "Source Platform", select: { equals: "TikTok" } },
            { property: "Source Platform", select: { equals: "Reddit" } },
          ],
        },
      ],
    },
    { revalidate: 300 } // 5-min cache — social signals need freshness
  );

  return pages
    .map(parseEvidencePage)
    .filter((e) => e.title && e.title.length > 3)
    .map((e) => {
      const { score, engagementLabel } = scoreSocialSignal(e);
      return { ...e, _score: score, _engagementLabel: engagementLabel || undefined };
    })
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    .slice(0, limit);
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
