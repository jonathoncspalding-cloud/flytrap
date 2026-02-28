import { NextResponse } from "next/server";
import { getLatestBriefings } from "@/lib/notion";

// GET — Check if today's briefing already exists
export async function GET() {
  try {
    const briefings = await getLatestBriefings(1);
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const exists = briefings.length > 0 && briefings[0].date === today;
    return NextResponse.json({ exists, latestDate: briefings[0]?.date ?? null });
  } catch (e: any) {
    return NextResponse.json({ exists: false, error: e.message }, { status: 500 });
  }
}
