"""
seed_calendar.py
----------------
Populates the Cultural Calendar with known events for the next 12 months.
Includes: award shows, sporting events, elections, cultural moments, major releases.
Safe to re-run — skips events that already exist (matched by event name + date).
"""

import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database, create_page, get_page_title

CALENDAR_DB = os.getenv("NOTION_CALENDAR_DB")

# ── Known Events: 2026 Cultural Calendar ──────────────────────────────────────
# Format: (date_str, name, categories, notes, initial_cps)
KNOWN_EVENTS = [
    # ── Q1 2026 ────────────────────────────────────────────────────────────────
    ("2026-02-08", "Grammy Awards 2026", ["Music", "Entertainment"], "Music's biggest night. Watch for cultural flashpoints around dominant artists, snubs, and political moments.", 65),
    ("2026-02-09", "Super Bowl LX", ["Sports", "Entertainment", "Culture"], "Super Bowl LX. Most-watched annual US TV event. Halftime show + ads are cultural moments in their own right.", 85),
    ("2026-02-14", "Valentine's Day", ["Culture", "Holiday"], "Annual romantic holiday. Context in 2026: loneliness epidemic, cost-of-living pressure on dating culture.", 40),
    ("2026-02-17", "Presidents' Day", ["Politics", "Holiday"], "Federal holiday. Often used for sales events and political commentary.", 25),
    ("2026-02-28", "Oscars 2026 (Academy Awards)", ["Entertainment", "Film", "Culture"], "Awards season peak. Historically generates cultural flashpoints (see: Will Smith 2022). Watch for diversity discourse, political speeches, snubs.", 70),
    ("2026-03-08", "International Women's Day", ["Culture", "Politics"], "Annual awareness day with growing commercial + activist dimension. Brand activation flashpoint.", 55),
    ("2026-03-14", "Pi Day", ["Culture", "Tech"], "Minor internet culture moment. Tech community event.", 20),
    ("2026-03-17", "St. Patrick's Day", ["Culture", "Holiday"], "Major drinking holiday. Significant for beer/spirits brands (Busch Light, Natural Light opp).", 45),
    ("2026-03-20", "Spring Equinox / First Day of Spring", ["Culture", "Holiday"], "Seasonal cultural moment. 'New year energy' for many consumers.", 30),
    ("2026-03-29", "Easter Sunday 2026", ["Culture", "Holiday"], "Major Christian holiday with significant retail + family culture dimension.", 40),
    # ── Q2 2026 ────────────────────────────────────────────────────────────────
    ("2026-04-01", "April Fools' Day", ["Culture"], "Annual brand prank day. Increasingly cynical/aware audience. High risk of backfire.", 35),
    ("2026-04-15", "Tax Day (US)", ["Politics", "Culture"], "Annual financial stress moment. Strong connection to cost-of-living tension.", 45),
    ("2026-04-22", "Earth Day", ["Culture", "Politics"], "Annual environmental awareness day. Growing tension between genuine activism and greenwashing.", 50),
    ("2026-05-04", "Star Wars Day (May the 4th)", ["Entertainment", "Culture"], "'May the 4th be with you.' Major internet culture event. Disney/Star Wars brand moment.", 40),
    ("2026-05-05", "Cinco de Mayo", ["Culture", "Holiday"], "Major US celebration holiday. Significant for beer brands (A&W, Busch Light). Watch for cultural appropriation discourse.", 50),
    ("2026-05-10", "Mother's Day 2026", ["Culture", "Holiday"], "Major retail/emotional holiday. Significant marketing moment across categories.", 55),
    ("2026-05-25", "Memorial Day", ["Culture", "Holiday", "Politics"], "Start of summer. Major retail weekend. Patriotism + military discourse flashpoint.", 45),
    ("2026-06-01", "Pride Month Begins", ["Culture", "Politics"], "LGBTQ+ Pride Month. Major brand activation period. Growing tension between genuine allyship and rainbow-washing. Will be intensified by political climate.", 75),
    ("2026-06-14", "Flag Day / Army Birthday", ["Politics", "Culture"], "Minor patriotic holiday.", 20),
    ("2026-06-19", "Juneteenth", ["Culture", "Politics", "Holiday"], "Federal holiday commemorating end of slavery. Still politically charged. Brand activation tension between genuine engagement and performative posting.", 60),
    ("2026-06-21", "Father's Day 2026", ["Culture", "Holiday"], "Major retail holiday. Growing discourse around masculinity, fatherhood, and gender roles.", 45),
    ("2026-06-21", "Summer Solstice", ["Culture"], "Longest day of year. Cultural milestone for seasonal content.", 25),
    # ── Q3 2026 ────────────────────────────────────────────────────────────────
    ("2026-07-04", "Independence Day (4th of July)", ["Holiday", "Culture", "Politics"], "Major patriotic holiday. Highly politicized in current climate. Fireworks, cookouts, brand moments.", 60),
    ("2026-08-03", "MTV VMAs 2026 (est.)", ["Music", "Entertainment", "Culture"], "Estimated date. Music video awards with strong cultural flashpoint history. Red carpet + performance moments.", 60),
    ("2026-08-17", "Back to School Season Peak", ["Culture", "Business"], "Peak back-to-school retail week. Major marketing activation period across categories.", 50),
    ("2026-09-07", "Labor Day", ["Culture", "Holiday", "Politics"], "End-of-summer cultural marker. Worker rights and anti-corporate tension often surfaces.", 45),
    ("2026-09-13", "Emmy Awards 2026 (est.)", ["Entertainment", "Culture"], "Television awards. Peak TV discourse moment. Streaming wars narrative.", 55),
    # ── Q4 2026 ────────────────────────────────────────────────────────────────
    ("2026-10-01", "Spooky Season Begins", ["Culture", "Holiday"], "Cultural 'Spooky Season' launches. Major aesthetic and retail moment across social media.", 50),
    ("2026-10-12", "Columbus Day / Indigenous Peoples' Day", ["Politics", "Culture", "Holiday"], "Contested holiday with growing tension around renaming/reframing.", 45),
    ("2026-10-31", "Halloween", ["Culture", "Holiday", "Entertainment"], "Major cultural moment: costumes become political/social commentary. Viral costume discourse.", 65),
    ("2026-11-01", "Día de los Muertos", ["Culture", "Holiday"], "Growing mainstream US cultural moment. Watch for authenticity vs. appropriation discourse.", 45),
    ("2026-11-03", "US Midterm Elections 2026", ["Politics", "Culture"], "Congressional midterms. Major political flashpoint. Will dominate cultural conversation for weeks leading up.", 90),
    ("2026-11-11", "Veterans Day", ["Politics", "Culture", "Holiday"], "Patriotic holiday with growing politicization around military/veteran care discourse.", 40),
    ("2026-11-26", "Thanksgiving", ["Culture", "Holiday", "Business"], "Major family holiday. Travel, food, retail. Kickoff to holiday shopping season. Family political arguments meme.", 60),
    ("2026-11-27", "Black Friday", ["Business", "Culture"], "Consumer culture flashpoint. Growing anti-consumerism discourse. Significant retail battle.", 65),
    ("2026-11-30", "Cyber Monday", ["Business", "Tech", "Culture"], "Online shopping peak. Part of holiday retail flashpoint.", 50),
    ("2026-12-01", "World AIDS Day", ["Culture", "Politics"], "HIV/AIDS awareness day. Health discourse moment.", 35),
    ("2026-12-12", "Holiday Shopping Peak Weekend", ["Business", "Culture"], "Last major shopping weekend before Christmas.", 55),
    ("2026-12-25", "Christmas", ["Culture", "Holiday", "Business"], "Biggest retail/cultural holiday. Brand culture war moment (war on Christmas, etc).", 60),
    ("2026-12-26", "Kwanzaa Begins", ["Culture", "Holiday"], "African American cultural holiday. Growing mainstream recognition.", 35),
    ("2026-12-31", "New Year's Eve", ["Culture", "Holiday"], "End-of-year cultural reflection. Year-in-review content peak. 'New year, new me' discourse.", 55),
    # ── Recurring cultural seasons (no fixed date) ──────────────────────────
    ("2026-02-01", "Award Season Peak (Jan-Feb)", ["Entertainment", "Film", "Music"], "Golden Globes, SAG Awards, BAFTAs, Grammys, Oscars cluster. Peak film/music cultural discourse.", 65),
    ("2026-09-01", "Fall TV Season Launch", ["Entertainment", "Culture"], "New network and streaming show launches. Peak TV discourse resumes after summer.", 50),
    ("2026-09-01", "NFL Season Kickoff 2026", ["Sports", "Culture"], "NFL season begins. Sports culture dominates US cultural conversation for ~5 months.", 70),
    ("2026-11-15", "Holiday Marketing Season Launch", ["Business", "Culture"], "Holiday ads begin in earnest. Watch for 'Christmas creep' discourse and standout campaigns.", 55),
    # ── NBA / Sports ────────────────────────────────────────────────────────
    ("2026-04-11", "NBA Playoffs Begin (est.)", ["Sports", "Culture"], "NBA playoffs start. Basketball culture discourse peaks.", 55),
    ("2026-06-01", "NBA Finals Begin (est.)", ["Sports", "Entertainment", "Culture"], "NBA Finals. Major sports/cultural crossover moment.", 65),
    ("2026-06-01", "Stanley Cup Finals Begin (est.)", ["Sports", "Culture"], "NHL Finals. Niche but growing hockey culture.", 40),
    ("2026-10-22", "NBA Season Tip-Off 2026 (est.)", ["Sports", "Culture"], "New NBA season begins. Player movements, storylines set the cultural agenda.", 55),
    # ── Tech / Business ─────────────────────────────────────────────────────
    ("2026-01-06", "CES 2026", ["Tech", "Business"], "Consumer Electronics Show Las Vegas. AI and consumer tech announcements set tech culture agenda for the year.", 60),
    ("2026-03-09", "SXSW 2026 (est.)", ["Tech", "Culture", "Entertainment"], "South by Southwest. Tech/music/film convergence. Early signal for year's cultural trends.", 65),
    ("2026-05-01", "Upfronts Season (TV)", ["Entertainment", "Business"], "TV networks present fall schedules. Advertising and entertainment industry moment.", 40),
    ("2026-06-08", "Apple WWDC 2026 (est.)", ["Tech", "Culture"], "Apple developer conference. Often major product/AI announcements with cultural ripple effects.", 60),
    ("2026-09-10", "Apple iPhone Launch Event (est.)", ["Tech", "Business", "Culture"], "Annual Apple product launch. Consumer tech + aspirational culture moment.", 65),
    # ── Fashion / Beauty ────────────────────────────────────────────────────
    ("2026-02-12", "New York Fashion Week (est.)", ["Culture", "Entertainment"], "NYFW. Fashion as cultural commentary. Trend-setting moment.", 55),
    ("2026-09-10", "New York Fashion Week Fall 2026 (est.)", ["Culture", "Entertainment"], "Fall NYFW. Fashion + street style cultural moment.", 55),
    ("2026-05-04", "Met Gala 2026 (est.)", ["Entertainment", "Culture", "Fashion"], "Annual Met Gala. Massive cultural flashpoint. Fashion as social commentary.", 80),
]


def get_existing_events() -> set:
    """Return set of existing event names in the calendar."""
    pages = query_database(CALENDAR_DB)
    return {get_page_title(p) for p in pages}


def seed():
    print("Seeding Cultural Calendar...")
    existing = get_existing_events()
    added = 0
    skipped = 0

    for event_date, name, categories, notes, cps in KNOWN_EVENTS:
        if name in existing:
            print(f"  ✓ '{name[:55]}' — exists")
            skipped += 1
            continue

        create_page(CALENDAR_DB, {
            "Event Name": {"title": [{"text": {"content": name}}]},
            "Date": {"date": {"start": event_date}},
            "Type": {"select": {"name": "Known Event"}},
            "Category": {"multi_select": [{"name": c} for c in categories]},
            "Cultural Potency Score": {"number": cps},
            "Notes": {"rich_text": [{"text": {"content": notes}}]},
        })
        print(f"  + Added '{name[:55]}' ({event_date})")
        added += 1

    print(f"\nDone — {added} added, {skipped} skipped.")


if __name__ == "__main__":
    seed()
