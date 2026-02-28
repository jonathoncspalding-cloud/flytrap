"""
seed_macro_trends.py
--------------------
Seeds the Notion Trends database with well-established macro and historical trends.
These provide the strategic bedrock the Cultural Forecaster needs for Build and
Context columns on the dashboard.

Run once (or re-run — it skips any trend that already exists by name):
    python scripts/setup/seed_macro_trends.py
"""

import os
import sys
import time
import logging
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database, create_page, get_page_title, rich_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

TRENDS_DB = os.getenv("NOTION_TRENDS_DB")
TODAY = date.today().isoformat()

# ── Active Macro Trends (Build column) ────────────────────────────────────────
# These are ongoing structural cultural forces operating on a 3–24 month timescale.

MACRO_TRENDS = [
    {
        "name": "Institutional Trust Collapse",
        "type": "Macro Trend",
        "status": "Exploding",
        "cps": 82,
        "momentum": 8,
        "summary": "Faith in government, media, science, corporations, and traditional authority structures is at historic lows. This isn't cynicism — it's a structural reorganization of where people place credibility.",
        "forecast": "Brands that embed themselves into sub-cultural trust networks (niche community, peer-to-peer, creator-built) will outperform those relying on institutional authority signals. The 'official' stamp is now a liability in many segments.",
    },
    {
        "name": "Loneliness Epidemic",
        "type": "Macro Trend",
        "status": "Rising",
        "cps": 78,
        "momentum": 7,
        "summary": "The U.S. Surgeon General declared loneliness a public health crisis. Despite unprecedented digital connectivity, social isolation rates climb across all age groups. Gen Z — the first truly digital-native generation — reports the highest rates.",
        "forecast": "Brands that create genuine community, shared ritual, or belonging — not just 'community-as-content' — will build lasting loyalty. Third-place spaces, shared physical experiences, and anti-algorithm connection are genuine white space.",
    },
    {
        "name": "AI Anxiety Normalization",
        "type": "Macro Trend",
        "status": "Exploding",
        "cps": 80,
        "momentum": 9,
        "summary": "Fear, excitement, and grief about artificial intelligence are merging into ambient background noise. The 'will AI replace me' panic is peaking and transitioning into lived negotiation with the technology.",
        "forecast": "Next phase: humans asserting humanity as a premium value signal. 'Made by humans' becomes a quality marker. Brands that visibly invest in human craft, creativity, and judgment will earn a trust premium that AI-forward brands cannot.",
    },
    {
        "name": "Wellness Industrialization",
        "type": "Macro Trend",
        "status": "Peaked",
        "cps": 72,
        "momentum": 4,
        "summary": "Self-care has been fully commodified — meditation apps, IV drips, supplement stacks, biohacking. The wellness industry is so saturated that consumers are developing wellness fatigue and skepticism of optimization culture.",
        "forecast": "Counter-movement rising: 'rough wellness' and anti-optimization culture. The over-quantified, over-supplemented lifestyle is becoming a punchline. Brands need a clear POV on wellness authenticity vs. performance.",
    },
    {
        "name": "Creator Economy Maturation",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 71,
        "momentum": 5,
        "summary": "The creator economy has moved from gold rush to professionalized industry with burnout, consolidation, and union organizing. The romanticism is gone. It's real work with real precarity and real leverage for some.",
        "forecast": "Brands that treat creators as strategic partners — not just distribution channels — and respect voice authenticity will win. The era of mass creator briefs with no creative input is ending fast.",
    },
    {
        "name": "Masculinity Redefinition",
        "type": "Macro Trend",
        "status": "Exploding",
        "cps": 79,
        "momentum": 8,
        "summary": "What it means to be a man is being contested from multiple directions simultaneously: trad-masc online movements, emotional intelligence culture, active-dad normalization, and fierce backlash against all of them. The fight is loud and unresolved.",
        "forecast": "Brands targeting men are navigating a real minefield. The sophisticated play is not picking a side but reflecting genuine complexity. Avoid both alpha-posturing and condescending 'new man' lectures. Find the human truth underneath.",
    },
    {
        "name": "Financial Precarity Performance",
        "type": "Macro Trend",
        "status": "Rising",
        "cps": 74,
        "momentum": 7,
        "summary": "Economic anxiety has become a cultural identity layer. 'Broke but make it cute' energy is everywhere. People perform financial struggle as relatability while aspirational spending persists beneath. The contradiction is the point.",
        "forecast": "Stop pretending your audience has money they don't. Value-for-money messaging is back — but needs to be framed with dignity. 'Smart' not 'cheap.' The moment it feels patronizing, it backfires.",
    },
    {
        "name": "Gen Z Workforce Insurgency",
        "type": "Macro Trend",
        "status": "Rising",
        "cps": 70,
        "momentum": 6,
        "summary": "Gen Z workers are refusing the traditional workplace social contract — longer hours for loyalty, hierarchy for stability. Quiet quitting gave way to loud quitting, boundary-setting, and a wholesale rejection of hustle culture.",
        "forecast": "This isn't a phase. Companies forcing RTO and 60-hour weeks are losing the talent war. Brands speaking to Gen Z's work philosophy — impact, autonomy, humanity — earn genuine loyalty in employment and purchasing alike.",
    },
    {
        "name": "Algorithm-Mediated Reality",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 75,
        "momentum": 5,
        "summary": "Most people's understanding of culture, news, and social norms is shaped primarily by algorithmic feeds. This creates genuine fragmentation — people living in different realities — while also creating rare viral consensus moments when the algorithm aligns.",
        "forecast": "Brands can no longer assume shared cultural context. A campaign that lands perfectly in one feed-universe is invisible in another. Multi-verse cultural fluency is now a core creative competency, not a nice-to-have.",
    },
    {
        "name": "Post-Scarcity Aesthetics Divide",
        "type": "Macro Trend",
        "status": "Rising",
        "cps": 67,
        "momentum": 6,
        "summary": "Two competing aesthetics are battling for cultural dominance: quiet luxury (understated abundance, no logos) vs. intentional austerity (thrift, repair, visible wear). Both are reactions against conspicuous consumption excess.",
        "forecast": "The middle-luxury zone is collapsing. Pick a lane: genuine premium with real substance behind it, or genuinely democratic with authentic access. Everything in between looks indecisive and gets ignored.",
    },
    {
        "name": "Nostalgia as Emotional Infrastructure",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 68,
        "momentum": 4,
        "summary": "Nostalgia has moved from trend to structural coping mechanism. In a period of rapid change and uncertainty, people reach for familiar cultural touchstones across every category — food, fashion, music, entertainment.",
        "forecast": "The risk is lazy nostalgia (just use old thing again). The opportunity is purposeful nostalgia — connecting a specific past feeling to a present tension. The best executions acknowledge that things were also bad then.",
    },
    {
        "name": "Authenticity Inflation",
        "type": "Macro Trend",
        "status": "Rising",
        "cps": 73,
        "momentum": 6,
        "summary": "Audiences have become expert at detecting performed authenticity. 'Raw,' 'real,' and 'unfiltered' are now as recognizable as traditional advertising. The bar for what actually reads as genuine keeps rising.",
        "forecast": "Authentic is no longer a creative strategy — it's the expected baseline. Brands need to be genuinely willing to show uncertainty, failure, and contradiction. The only path through authenticity inflation is actual honesty.",
    },
]

# ── Historical / Context Trends (Context column) ──────────────────────────────
# These are cultural forces that have peaked or stabilized — they form the
# backdrop that explains everything currently in motion.

HISTORICAL_TRENDS = [
    {
        "name": "Great Resignation Legacy",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 58,
        "momentum": 2,
        "summary": "The mass labor reshuffling of 2021-22 permanently reset expectations around work-life balance, remote flexibility, and worker leverage. The 'snap back to normal' never happened and won't.",
        "forecast": "The behavioral changes are structural. Workers who moved, changed industries, or negotiated better terms built new lives around those gains. Employers trying to claw back pre-pandemic conditions are losing.",
    },
    {
        "name": "Pandemic Behavioral Permanence",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 60,
        "momentum": 2,
        "summary": "COVID created lasting behavioral shifts: home-centrism, comfort-over-style dressing, digital-first default for everything, convenience as non-negotiable, and hygiene anxiety now normalized in the mainstream.",
        "forecast": "These aren't temporary. The brands that redesigned around pandemic behaviors gained durable market share. Those waiting for 'normal' to return are still waiting.",
    },
    {
        "name": "Streaming Wars Consolidation",
        "type": "Macro Trend",
        "status": "Peaked",
        "cps": 62,
        "momentum": 3,
        "summary": "The streaming boom peaked with subscriber wars, then collapsed into price increases, subscription fatigue, ad-supported tiers, and password-sharing crackdowns. The market is consolidating fast.",
        "forecast": "Bundling and consolidation define the next chapter. Live sports and appointment TV are the last things keeping any platform relevant. Streaming brands need genuine hit franchises or they'll be absorbed.",
    },
    {
        "name": "DEI Institutionalization Backlash",
        "type": "Macro Trend",
        "status": "Peaked",
        "cps": 65,
        "momentum": 4,
        "summary": "Corporate DEI programs that proliferated post-2020 are now under active political and consumer backlash. Several major brands have publicly walked back commitments. The performative vs. structural distinction is existential.",
        "forecast": "Brands that embedded inclusion into actual products, hiring, and supply chains are weathering this. Those who put it in mission statements and marketing are not. The performance era is over; only structural work survives.",
    },
    {
        "name": "Cancel Culture Fatigue",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 55,
        "momentum": 2,
        "summary": "The cultural force of public accountability campaigns has weakened as outrage fatigue sets in. Several high-profile figures have successfully 'come back' from cancellations that would have ended careers in 2020-21.",
        "forecast": "New equilibrium: serious misconduct still ends careers. Opinion-based cancellations rarely stick. Brands should stop over-engineering cultural risk exposure and focus on actual ethics over optics.",
    },
    {
        "name": "DTC Brand Wave Collapse",
        "type": "Macro Trend",
        "status": "Peaked",
        "cps": 50,
        "momentum": 1,
        "summary": "The DTC boom of 2016-2021 — building brands on Instagram and Shopify — has largely busted. Customer acquisition costs skyrocketed, retail partnerships became necessary, and category saturation killed margins.",
        "forecast": "The DTC playbook is dead as a standalone strategy. Omnichannel is the only viable model. The brands that survived have genuine product differentiation and community, not just aesthetic.",
    },
    {
        "name": "Experience Economy Entrenchment",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 68,
        "momentum": 4,
        "summary": "'Experiences over things' became the defining consumer philosophy of the 2010s and solidified post-pandemic. Live events, travel, and physical shared moments command strong premium pricing and emotional investment.",
        "forecast": "The challenge now: experience inflation has made experiential access class-stratified. Brands creating genuinely democratic experiential moments — not $500-ticket festivals — will cut through.",
    },
    {
        "name": "Gig Economy Normalization",
        "type": "Macro Trend",
        "status": "Stable",
        "cps": 57,
        "momentum": 2,
        "summary": "Contract, freelance, and platform-mediated work is now the default for a significant share of the workforce. The promises of flexibility have collided with the realities of benefit-lessness and income volatility.",
        "forecast": "A backlash is building. Calls for portable benefits, gig worker protections, and platform accountability are gaining political traction. Brands that position workers — including gig workers — as human will increasingly stand out.",
    },
]


# ── Main ──────────────────────────────────────────────────────────────────────

def get_existing_names() -> set:
    pages = query_database(TRENDS_DB)
    return {get_page_title(p).lower().strip() for p in pages if get_page_title(p)}


def create_trend(t: dict, existing: set) -> bool:
    name = t["name"]
    if name.lower().strip() in existing:
        logger.info(f"  SKIP (exists): {name}")
        return False

    props = {
        "Name":                     {"title":  [{"text": {"content": name}}]},
        "Type":                     {"select": {"name": t["type"]}},
        "Status":                   {"select": {"name": t["status"]}},
        "Cultural Potency Score":   {"number": t["cps"]},
        "Momentum Score":           {"number": t["momentum"]},
        "Summary":                  {"rich_text": rich_text(t["summary"])},
        "Forecast":                 {"rich_text": rich_text(t["forecast"])},
        "First Detected":           {"date": {"start": TODAY}},
        "Last Updated":             {"date": {"start": TODAY}},
        "Pinned":                   {"checkbox": False},
    }
    create_page(TRENDS_DB, props)
    logger.info(f"  CREATED: {name} [{t['type']}] CPS:{t['cps']} ({t['status']})")
    return True


def main():
    logger.info("Loading existing trends to avoid duplicates...")
    existing = get_existing_names()
    logger.info(f"Found {len(existing)} existing trends in Notion\n")

    all_trends = MACRO_TRENDS + HISTORICAL_TRENDS
    created = skipped = 0

    logger.info(f"Seeding {len(MACRO_TRENDS)} macro trends + {len(HISTORICAL_TRENDS)} historical trends")
    logger.info("=" * 56)

    for t in all_trends:
        ok = create_trend(t, existing)
        if ok:
            created += 1
            existing.add(t["name"].lower().strip())
        else:
            skipped += 1
        time.sleep(0.35)  # Notion rate-limit safety

    logger.info("=" * 56)
    logger.info(f"Done → Created: {created}  Skipped (already exist): {skipped}")
    logger.info(f"Run the dashboard to see the Build and Context columns populated.")


if __name__ == "__main__":
    main()
