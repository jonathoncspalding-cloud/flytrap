"""
seed_tensions.py
----------------
Seeds the Cultural Tensions database with the starter list from the spec.
Safe to re-run — skips tensions that already exist (matched by name).
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from notion_helper import query_database, create_page, get_page_title

TENSIONS_DB_ID = os.getenv("NOTION_TENSIONS_DB")

STARTER_TENSIONS = [
    {
        "name": "Wealth inequality vs. conspicuous consumption",
        "weight": 9,
        "status": "Active",
        "description": (
            "The widening gap between the ultra-wealthy and everyone else, "
            "made visible through displays of luxury spending. Powering rage "
            "around billionaire culture, yacht discourse, and 'eat the rich' moments."
        ),
    },
    {
        "name": "AI replacing jobs vs. AI as creative empowerment",
        "weight": 9,
        "status": "Active",
        "description": (
            "The split between workers fearing AI-driven displacement and creatives "
            "embracing AI as a productivity multiplier. Creating intra-industry conflict "
            "especially in advertising, film, music, and journalism."
        ),
    },
    {
        "name": "Authenticity vs. performance (social media culture)",
        "weight": 8,
        "status": "Active",
        "description": (
            "The tension between curated, aspirational social media personas and the "
            "growing demand for 'realness'. Fueling de-influencing, anti-filters, "
            "and the rise of lo-fi content."
        ),
    },
    {
        "name": "Corporate enshittification vs. 'made by humans' / indie movement",
        "weight": 8,
        "status": "Active",
        "description": (
            "Declining product/service quality from major corporations as they optimize "
            "for profit over users (Cory Doctorow's 'enshittification'). Counter-reaction: "
            "indie brands, local businesses, and 'human-made' premium positioning."
        ),
    },
    {
        "name": "Cost of living crisis vs. 'treat yourself' / little luxuries",
        "weight": 10,
        "status": "Active",
        "description": (
            "Wages failing to keep up with housing, food, and basic costs — yet "
            "consumer culture still pushes indulgence. Powers 'loud budgeting', "
            "dupes culture, and also 'f*** it, I deserve this' splurges."
        ),
    },
    {
        "name": "Trust in institutions declining",
        "weight": 9,
        "status": "Active",
        "description": (
            "Accelerating erosion of public trust in government, legacy media, "
            "healthcare systems, and corporations. Fuels conspiracy thinking, "
            "populism, and the rise of alternative information ecosystems."
        ),
    },
    {
        "name": "Loneliness epidemic vs. hyper-connectivity",
        "weight": 8,
        "status": "Active",
        "description": (
            "Record levels of reported loneliness and social isolation, paradoxically "
            "occurring during peak digital connectivity. Powering third-place nostalgia, "
            "men's spaces discourse, parasocial celebrity culture."
        ),
    },
    {
        "name": "Climate anxiety vs. consumption culture",
        "weight": 7,
        "status": "Active",
        "description": (
            "Awareness of climate catastrophe alongside continued or growing consumption. "
            "Creates eco-guilt, greenwashing fatigue, and the rise of 'doomer' aesthetics "
            "alongside genuine sustainability movements."
        ),
    },
    {
        "name": "Privacy erosion vs. convenience",
        "weight": 6,
        "status": "Active",
        "description": (
            "Surveillance capitalism's expansion into every aspect of life, accepted "
            "because the convenience trade-off feels unavoidable. Periodically erupts "
            "when a new data breach or tracking revelation hits."
        ),
    },
    {
        "name": "Political polarization and culture war fatigue",
        "weight": 8,
        "status": "Active",
        "description": (
            "Intensifying partisan division alongside exhaustion with constant culture "
            "war battles. Creates demand for escape content, 'both-sides' fatigue, "
            "and brands that stay aggressively apolitical or lean in."
        ),
    },
    {
        "name": "Health/wellness industrial complex vs. anti-wellness backlash",
        "weight": 7,
        "status": "Active",
        "description": (
            "The $5T+ wellness industry's optimization of every human behavior, "
            "meeting pushback from people tired of being told they're broken. "
            "Fuels both biohacking extremism and 'let people enjoy things' normie content."
        ),
    },
    {
        "name": "Creator economy promise vs. creator burnout reality",
        "weight": 7,
        "status": "Active",
        "description": (
            "The dream of making a living as a creator colliding with the algorithmic "
            "treadmill, parasocial labor, and income instability of platform economics. "
            "Surfaces in 'I'm quitting YouTube' moments and creator union discourse."
        ),
    },
    {
        "name": "Nostalgia as comfort vs. nostalgia as avoidance",
        "weight": 7,
        "status": "Active",
        "description": (
            "Cultural obsession with reboots, revivals, and retro aesthetics — is it "
            "genuine appreciation or anxiety-driven flight from the present? "
            "Fuels Y2K aesthetics, 90s revival, and 'the past was better' discourse."
        ),
    },
    {
        "name": "Remote work freedom vs. return-to-office mandates",
        "weight": 7,
        "status": "Active",
        "description": (
            "Workers who restructured their lives around remote work facing employer "
            "demands to return. Creates ongoing workplace identity conflict and "
            "geographic/economic ripple effects in cities and suburbs."
        ),
    },
]


def get_existing_tensions():
    """Return set of tension names already in the database."""
    pages = query_database(TENSIONS_DB_ID)
    return {get_page_title(p) for p in pages}


def seed():
    print("Seeding Cultural Tensions database...")
    existing = get_existing_tensions()
    added = 0
    skipped = 0

    for t in STARTER_TENSIONS:
        if t["name"] in existing:
            print(f"  ✓ '{t['name'][:55]}' — exists")
            skipped += 1
            continue

        create_page(TENSIONS_DB_ID, {
            "Name": {"title": [{"text": {"content": t["name"]}}]},
            "Weight": {"number": t["weight"]},
            "Status": {"select": {"name": t["status"]}},
            "Description": {
                "rich_text": [{"text": {"content": t["description"]}}]
            },
        })
        print(f"  + Added '{t['name'][:55]}'")
        added += 1

    print(f"\nDone — {added} added, {skipped} skipped.")


if __name__ == "__main__":
    seed()
