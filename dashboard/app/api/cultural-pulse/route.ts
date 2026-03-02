import { NextResponse } from "next/server";
import { getLatestNewsSignals } from "@/lib/notion";

export const revalidate = 900; // 15 minutes

export interface PulseItem {
  id: string;
  title: string;
  source: "reddit" | "wikipedia" | "news";
  subreddit?: string;
  score?: number;
  url?: string;
}

// Culture-relevant subreddits — high-signal, community-curated trending
const CULTURE_SUBREDDITS = [
  "entertainment",
  "Music",
  "television",
  "movies",
  "sports",
  "popculture",
  "hiphopheads",
  "TrueOffMyChest", // raw cultural sentiment
];

async function fetchRedditSubreddit(sub: string): Promise<PulseItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=5`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "CulturalForecaster/1.0" },
      }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();

    return (data?.data?.children ?? [])
      .filter((c: { data: { stickied: boolean; score: number; title: string } }) =>
        !c.data.stickied && c.data.score > 100 && c.data.title.length > 10
      )
      .slice(0, 3)
      .map((c: { data: { id: string; title: string; score: number; permalink: string } }) => ({
        id: `reddit-${c.data.id}`,
        title: c.data.title,
        source: "reddit" as const,
        subreddit: sub,
        score: c.data.score,
        url: `https://reddit.com${c.data.permalink}`,
      }));
  } catch {
    return [];
  }
}

async function fetchWikipediaTrending(): Promise<PulseItem[]> {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${year}/${month}/${day}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();

    const SKIP = new Set([
      "Main_Page", "Special:Search", "Wikipedia:Featured_pictures",
      "Wikipedia", "Special:Statistics",
    ]);

    return (data.items?.[0]?.articles ?? [])
      .filter(
        (a: { article: string }) =>
          !SKIP.has(a.article) && !a.article.startsWith("Special:")
      )
      .slice(0, 15)
      .map((a: { article: string }, i: number) => ({
        id: `wiki-${i}`,
        title: a.article.replace(/_/g, " "),
        source: "wikipedia" as const,
        url: `https://en.wikipedia.org/wiki/${a.article}`,
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  // Fetch Reddit subs in parallel (primary real-time signal)
  const [redditResults, wiki, notionSignals] = await Promise.all([
    Promise.all(CULTURE_SUBREDDITS.map(fetchRedditSubreddit)),
    fetchWikipediaTrending(),
    getLatestNewsSignals(15).catch(() => [] as { id: string; title: string; url: string | null }[]),
  ]);

  const redditItems = redditResults.flat();

  // Notion news signals as reliable fallback
  const notionItems: PulseItem[] = notionSignals.map((s) => ({
    id: `notion-${s.id}`,
    title: s.title,
    source: "news" as const,
    url: s.url ?? undefined,
  }));

  // Build the final list: Reddit first (most trending), then Wikipedia (cultural attention), then news
  const combined: PulseItem[] = [];

  // Interleave Reddit + Wikipedia for variety
  const maxRW = Math.max(redditItems.length, wiki.length);
  for (let i = 0; i < maxRW; i++) {
    if (redditItems[i]) combined.push(redditItems[i]);
    if (wiki[i]) combined.push(wiki[i]);
  }

  // If we got nothing from live sources, fall back to Notion news
  if (combined.length === 0) {
    combined.push(...notionItems);
  }

  return NextResponse.json(combined.slice(0, 50));
}
