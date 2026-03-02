"""
isabel_proposal.py
-------------------
Generates Isabel's weekly furniture proposal: picks one category,
creates 4 pixel art options with Pillow, saves as base64 JSON.

Output: dashboard/public/proposals/isabel.json
"""
from __future__ import annotations

import base64
import io
import json
import os
import random
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from PIL import Image
except ImportError:
    print("Installing Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    from PIL import Image

# ── Categories Isabel can propose ─────────────────────────────────────────

CATEGORIES = [
    {
        "name": "Paintings",
        "count": 2,
        "footprint": (32, 32),
        "wall_mounted": True,
        "must_match": False,
        "targets_query": ["ASSET_101", "ASSET_102"],
    },
    {
        "name": "Plants",
        "count": 10,
        "footprint": (16, 32),
        "wall_mounted": False,
        "must_match": False,
        "targets_query": ["ASSET_132", "ASSET_140", "ASSET_141", "ASSET_142", "ASSET_143"],
    },
    {
        "name": "Rug",
        "count": 1,
        "footprint": (32, 16),
        "wall_mounted": False,
        "must_match": False,
        "targets_query": ["ASSET_148"],
    },
    {
        "name": "Bookcases",
        "count": 6,
        "footprint": (32, 32),
        "wall_mounted": False,
        "must_match": False,
        "targets_query": ["ASSET_17", "ASSET_18"],
    },
    {
        "name": "Loveseats",
        "count": 2,
        "footprint": (16, 32),
        "wall_mounted": False,
        "must_match": False,
        "targets_query": ["ASSET_NEW_110", "ASSET_NEW_111"],
    },
    {
        "name": "Coffee Table",
        "count": 1,
        "footprint": (32, 32),
        "wall_mounted": False,
        "must_match": False,
        "targets_query": ["ASSET_NEW_112"],
    },
]

# ── Pixel Art Color Palettes ──────────────────────────────────────────────

PALETTES = {
    "Paintings": [
        {"name": "Midnight Garden", "desc": "Lush botanicals in deep navy & emerald", "colors": [(15, 25, 50), (20, 60, 45), (35, 95, 55), (80, 140, 80), (200, 180, 120)]},
        {"name": "Sunset Coast", "desc": "Warm amber horizon over violet sea", "colors": [(60, 30, 70), (140, 50, 80), (220, 120, 60), (240, 180, 80), (250, 220, 160)]},
        {"name": "Abstract Noir", "desc": "Bold geometric shapes in crimson & gold", "colors": [(20, 20, 25), (120, 25, 30), (180, 40, 45), (200, 170, 60), (240, 230, 200)]},
        {"name": "Botanical Dream", "desc": "Trailing vines in sage & terracotta", "colors": [(50, 35, 25), (160, 80, 50), (100, 130, 80), (140, 170, 110), (210, 200, 170)]},
    ],
    "Plants": [
        {"name": "Tropical Fern", "desc": "Lush cascading fronds", "colors": [(20, 50, 15), (40, 100, 30), (60, 140, 45), (80, 170, 60), (120, 70, 40)]},
        {"name": "Desert Succulent", "desc": "Chunky jade rosette in terracotta pot", "colors": [(60, 110, 70), (80, 140, 85), (100, 160, 100), (160, 80, 50), (130, 60, 35)]},
        {"name": "Lavender Bloom", "desc": "Purple flowering plant in white pot", "colors": [(100, 60, 130), (140, 90, 160), (170, 120, 180), (220, 220, 230), (200, 200, 210)]},
        {"name": "Monstera Leaf", "desc": "Big split leaves in deep green", "colors": [(15, 40, 20), (25, 70, 35), (40, 100, 50), (55, 130, 65), (90, 60, 30)]},
    ],
    "Rug": [
        {"name": "Persian Ruby", "desc": "Rich red with gold geometric border", "colors": [(120, 20, 25), (160, 35, 40), (200, 160, 60), (80, 15, 20), (180, 50, 55)]},
        {"name": "Moroccan Azure", "desc": "Deep blue tiles with white accents", "colors": [(25, 50, 110), (40, 75, 150), (60, 100, 180), (200, 210, 220), (15, 35, 80)]},
        {"name": "Bohemian Sunset", "desc": "Warm terracotta and mustard stripes", "colors": [(160, 75, 45), (200, 130, 60), (220, 180, 70), (130, 55, 35), (180, 100, 50)]},
        {"name": "Emerald Lattice", "desc": "Forest green with ivory diamond pattern", "colors": [(20, 60, 35), (35, 90, 50), (50, 120, 65), (210, 200, 175), (15, 45, 25)]},
    ],
    "Bookcases": [
        {"name": "Mahogany Library", "desc": "Rich dark wood with colorful spines", "colors": [(60, 25, 15), (90, 40, 25), (120, 55, 35), (50, 80, 120), (180, 50, 40)]},
        {"name": "White Modern", "desc": "Clean white shelves with curated objects", "colors": [(200, 205, 210), (220, 225, 230), (180, 185, 190), (80, 140, 100), (200, 160, 60)]},
        {"name": "Industrial Steel", "desc": "Dark metal frame with warm wood shelves", "colors": [(50, 55, 60), (70, 75, 80), (90, 95, 100), (140, 100, 60), (120, 80, 45)]},
        {"name": "Vintage Oak", "desc": "Warm honey oak crammed with books", "colors": [(140, 100, 50), (170, 125, 65), (200, 155, 85), (60, 40, 100), (150, 40, 35)]},
    ],
    "Loveseats": [
        {"name": "Velvet Emerald", "desc": "Deep green velvet with gold legs", "colors": [(20, 60, 35), (30, 85, 50), (45, 110, 65), (180, 155, 60), (15, 45, 25)]},
        {"name": "Blush Pink", "desc": "Soft dusty rose with brass accents", "colors": [(180, 120, 130), (200, 145, 155), (220, 170, 175), (170, 140, 60), (160, 100, 110)]},
        {"name": "Navy Chesterfield", "desc": "Tufted deep navy with rolled arms", "colors": [(20, 30, 60), (30, 45, 85), (45, 65, 110), (60, 80, 130), (15, 22, 45)]},
        {"name": "Burnt Sienna", "desc": "Warm leather-look with wooden frame", "colors": [(130, 60, 30), (160, 80, 40), (190, 105, 55), (100, 65, 35), (110, 50, 25)]},
    ],
    "Coffee Table": [
        {"name": "Marble & Brass", "desc": "White marble top on brass hairpin legs", "colors": [(200, 200, 205), (220, 220, 225), (180, 180, 185), (170, 145, 55), (190, 165, 70)]},
        {"name": "Walnut Mid-Century", "desc": "Warm walnut oval with tapered legs", "colors": [(80, 50, 30), (110, 70, 40), (140, 90, 55), (170, 115, 70), (60, 35, 20)]},
        {"name": "Glass & Iron", "desc": "Clear glass top on industrial iron base", "colors": [(140, 170, 190), (160, 190, 210), (50, 55, 60), (70, 75, 80), (120, 150, 170)]},
        {"name": "Reclaimed Wood", "desc": "Rustic plank top with chunky legs", "colors": [(100, 70, 40), (130, 95, 55), (160, 120, 75), (80, 55, 30), (60, 40, 20)]},
    ],
}

# ── Isabel's pitch lines ──────────────────────────────────────────────────

PITCHES = {
    "Paintings": "Mon dieu! Those walls deserve FRESH art, darling. I've painted four masterpieces -- each one more dramatic than the last!",
    "Plants": "Ooh la la! The greenery situation needs a REFRESH. I've curated four botanical specimens that would make a Parisian conservatory weep with envy.",
    "Rug": "That rug has been there since the DAWN OF TIME, darling. Here are four replacements, each one more bellissimo than the last!",
    "Bookcases": "Those bookcases are practically BEGGING for a makeover. I've designed four options that would make a librarian swoon!",
    "Loveseats": "The loveseats need SOUL, darling. Something with texture, with DRAMA. Here -- choose your favorite and thank me later.",
    "Coffee Table": "A coffee table is the HEART of a lounge, darling. These four options each tell a completely different story. Choose wisely!",
}


def draw_painting(w: int, h: int, colors: list[tuple[int, int, int]]) -> Image.Image:
    """Draw a small landscape/abstract painting with frame."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # Frame (dark border)
    frame_color = (40, 30, 20, 255)
    for x in range(w):
        img.putpixel((x, 0), frame_color)
        img.putpixel((x, h - 1), frame_color)
    for y in range(h):
        img.putpixel((0, y), frame_color)
        img.putpixel((w - 1, y), frame_color)
    # Inner painting area
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            # Create a gradient/pattern using the palette
            ratio_x = x / w
            ratio_y = y / h
            idx = int((ratio_x * 0.6 + ratio_y * 0.4) * (len(colors) - 1))
            idx = min(idx, len(colors) - 1)
            c = colors[idx]
            # Add some pixel noise for texture
            noise = random.randint(-10, 10)
            r = max(0, min(255, c[0] + noise))
            g = max(0, min(255, c[1] + noise))
            b = max(0, min(255, c[2] + noise))
            img.putpixel((x, y), (r, g, b, 255))
    return img


def draw_plant(w: int, h: int, colors: list[tuple[int, int, int]]) -> Image.Image:
    """Draw a potted plant sprite."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pot_color = colors[4] if len(colors) > 4 else (120, 70, 40)
    pot_dark = tuple(max(0, c - 30) for c in pot_color)
    # Pot (bottom third)
    pot_top = h * 2 // 3
    for y in range(pot_top, h):
        indent = max(0, (y - pot_top) // 3)
        for x in range(2 + indent, w - 2 - indent):
            c = pot_color if x < w // 2 else pot_dark
            img.putpixel((x, y), c + (255,))
    # Pot rim
    for x in range(1, w - 1):
        img.putpixel((x, pot_top), pot_color + (255,))
        img.putpixel((x, pot_top - 1), pot_dark + (255,))
    # Foliage (top two-thirds)
    leaf_colors = colors[:3]
    for y in range(2, pot_top - 1):
        for x in range(1, w - 1):
            # Organic shape - wider in middle
            center_x = w // 2
            dist = abs(x - center_x)
            max_dist = (pot_top - y) * w // (2 * pot_top) + 2
            if dist <= max_dist and random.random() > 0.25:
                c = random.choice(leaf_colors)
                noise = random.randint(-8, 8)
                r = max(0, min(255, c[0] + noise))
                g = max(0, min(255, c[1] + noise))
                b = max(0, min(255, c[2] + noise))
                img.putpixel((x, y), (r, g, b, 255))
    # Dark outline pixels for definition
    outline = (15, 15, 10, 255)
    for y in range(h):
        for x in range(w):
            if img.getpixel((x, y))[3] > 0:
                # Check if any neighbor is transparent
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        if img.getpixel((nx, ny))[3] == 0:
                            break
                else:
                    continue
                # This pixel has a transparent neighbor — it's an edge
                # Only outline if it's not already very dark
                cur = img.getpixel((x, y))
                if cur[0] + cur[1] + cur[2] > 100:
                    continue
    return img


def draw_rug(w: int, h: int, colors: list[tuple[int, int, int]]) -> Image.Image:
    """Draw a decorative rug sprite."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # Fill base
    base = colors[0]
    for y in range(h):
        for x in range(w):
            img.putpixel((x, y), base + (255,))
    # Border
    border = colors[3] if len(colors) > 3 else colors[0]
    for x in range(w):
        img.putpixel((x, 0), border + (255,))
        img.putpixel((x, h - 1), border + (255,))
    for y in range(h):
        img.putpixel((0, y), border + (255,))
        img.putpixel((w - 1, y), border + (255,))
    # Inner pattern (alternating stripes or diamonds)
    accent1 = colors[1]
    accent2 = colors[2]
    for y in range(2, h - 2):
        for x in range(2, w - 2):
            if (x + y) % 4 == 0:
                img.putpixel((x, y), accent1 + (255,))
            elif (x + y) % 4 == 2:
                img.putpixel((x, y), accent2 + (255,))
    # Fringe detail
    fringe = colors[4] if len(colors) > 4 else colors[1]
    for x in range(1, w - 1, 2):
        img.putpixel((x, 0), fringe + (255,))
        img.putpixel((x, h - 1), fringe + (255,))
    return img


def draw_bookcase(w: int, h: int, colors: list[tuple[int, int, int]]) -> Image.Image:
    """Draw a bookcase sprite."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    wood = colors[0]
    wood_light = colors[1]
    wood_dark = tuple(max(0, c - 20) for c in colors[0])
    # Frame
    for y in range(h):
        img.putpixel((0, y), wood_dark + (255,))
        img.putpixel((1, y), wood + (255,))
        img.putpixel((w - 2, y), wood + (255,))
        img.putpixel((w - 1, y), wood_dark + (255,))
    for x in range(w):
        img.putpixel((x, 0), wood_dark + (255,))
        img.putpixel((x, h - 1), wood_dark + (255,))
    # Shelves (horizontal dividers)
    shelf_ys = [h // 4, h // 2, 3 * h // 4]
    for sy in shelf_ys:
        for x in range(1, w - 1):
            img.putpixel((x, sy), wood_light + (255,))
            img.putpixel((x, sy + 1), wood_dark + (255,))
    # Books on shelves
    book_colors = colors[3:] if len(colors) > 3 else [(80, 80, 120), (150, 50, 50)]
    sections = [(1, shelf_ys[0] + 2, shelf_ys[0]), (1, shelf_ys[1] + 2, shelf_ys[1] - shelf_ys[0] - 2),
                (1, shelf_ys[2] + 2, shelf_ys[2] - shelf_ys[1] - 2)]
    for start_x_off, start_y, section_h in sections:
        x = 2
        while x < w - 3:
            book_w = random.randint(2, 4)
            book_h = max(2, section_h - random.randint(0, 3))
            bc = random.choice(book_colors)
            for by in range(start_y, start_y + book_h):
                for bx in range(x, min(x + book_w, w - 2)):
                    if by < h - 1:
                        img.putpixel((bx, by), bc + (255,))
            x += book_w + 1
    return img


def draw_loveseat(w: int, h: int, colors: list[tuple[int, int, int]]) -> Image.Image:
    """Draw a loveseat/couch sprite."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    main = colors[1]
    dark = colors[0]
    light = colors[2]
    accent = colors[3] if len(colors) > 3 else colors[2]
    # Seat back (upper portion)
    back_h = h // 2
    for y in range(2, back_h):
        for x in range(2, w - 2):
            c = main if y > 3 else dark
            img.putpixel((x, y), c + (255,))
    # Arms
    for y in range(3, h - 6):
        img.putpixel((1, y), dark + (255,))
        img.putpixel((w - 2, y), dark + (255,))
    # Seat cushion
    for y in range(back_h, back_h + 5):
        for x in range(2, w - 2):
            c = light if y == back_h else main
            img.putpixel((x, y), c + (255,))
    # Legs
    leg_color = accent
    for y in range(h - 3, h):
        img.putpixel((2, y), leg_color + (255,))
        img.putpixel((w - 3, y), leg_color + (255,))
    # Outline
    outline = (15, 15, 10, 255)
    for y in range(2, back_h):
        img.putpixel((1, y), outline)
        img.putpixel((w - 2, y), outline)
    for x in range(1, w - 1):
        img.putpixel((x, 2), outline)
    return img


def draw_coffee_table(w: int, h: int, colors: list[tuple[int, int, int]]) -> Image.Image:
    """Draw a coffee table sprite."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    top = colors[0]
    top_light = colors[1]
    leg = colors[3] if len(colors) > 3 else colors[2]
    # Table top (upper half)
    top_h = h // 2 + 2
    for y in range(4, top_h):
        for x in range(2, w - 2):
            c = top_light if y == 4 else top
            img.putpixel((x, y), c + (255,))
    # Highlight line
    for x in range(3, w - 3):
        img.putpixel((x, 5), top_light + (255,))
    # Shadow under top
    shadow = tuple(max(0, c - 40) for c in top)
    for x in range(2, w - 2):
        img.putpixel((x, top_h), shadow + (255,))
    # Legs
    for y in range(top_h + 1, h - 1):
        img.putpixel((4, y), leg + (255,))
        img.putpixel((w - 5, y), leg + (255,))
        # Cross support
        if y == top_h + 3:
            for x in range(5, w - 5):
                img.putpixel((x, y), leg + (255,))
    return img


DRAW_FUNCTIONS = {
    "Paintings": draw_painting,
    "Plants": draw_plant,
    "Rug": draw_rug,
    "Bookcases": draw_bookcase,
    "Loveseats": draw_loveseat,
    "Coffee Table": draw_coffee_table,
}


def img_to_base64(img: Image.Image) -> str:
    """Convert PIL Image to base64 data URI."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def get_targets(layout_path: str, target_types: list[str]) -> list[dict]:
    """Find furniture items in layout JSON matching target types."""
    try:
        with open(layout_path) as f:
            data = json.load(f)
        targets = []
        for item in data.get("furniture", []):
            if item["type"] in target_types:
                targets.append({
                    "uid": item["uid"],
                    "type": item["type"],
                    "col": item["col"],
                    "row": item["row"],
                })
        return targets
    except Exception as e:
        print(f"  [WARN] Could not read layout: {e}")
        return []


def generate_proposal(category_name: str | None = None) -> dict:
    """Generate a proposal with 4 options for a given (or random) category."""
    if category_name:
        cat = next((c for c in CATEGORIES if c["name"] == category_name), None)
        if not cat:
            raise ValueError(f"Unknown category: {category_name}")
    else:
        cat = random.choice(CATEGORIES)

    name = cat["name"]
    w, h = cat["footprint"]
    palettes = PALETTES[name]
    draw_fn = DRAW_FUNCTIONS[name]

    options = []
    for pal in palettes:
        img = draw_fn(w, h, pal["colors"])
        preview = img_to_base64(img)
        options.append({
            "label": pal["name"],
            "description": pal["desc"],
            "preview": preview,
            "colors": [list(c) for c in pal["colors"]],
        })

    # Find targets in the current layout
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    layout_path = os.path.join(project_root, "dashboard", "components", "pixel-office", "office-layout.json")
    targets = get_targets(layout_path, cat["targets_query"])

    proposal = {
        "id": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "category": name,
        "description": PITCHES.get(name, "Darling, it's time for a change!"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "footprint": {"w": w, "h": h},
        "wallMounted": cat.get("wall_mounted", False),
        "mustMatch": cat.get("must_match", False),
        "options": options,
        "targets": targets,
    }
    return proposal


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate Isabel's weekly furniture proposal")
    parser.add_argument("--category", help="Force a specific category (default: random)")
    parser.add_argument("--output", help="Output JSON path", default=None)
    args = parser.parse_args()

    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    output_path = args.output or os.path.join(project_root, "dashboard", "public", "proposals", "isabel.json")

    print(f"Generating Isabel's weekly proposal...")
    proposal = generate_proposal(args.category)
    print(f"  Category: {proposal['category']}")
    print(f"  Options: {', '.join(o['label'] for o in proposal['options'])}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(proposal, f, indent=2)
    print(f"  Saved to: {output_path}")

    # Write Notion report (if env vars are set)
    try:
        from agent_report_writer import write_report
        write_report(
            agent="isabel",
            report_type="proposal",
            title=f"Weekly Proposal: {proposal['category']}",
            summary=proposal["description"],
            details=f"Category: {proposal['category']}\nOptions: {', '.join(o['label'] for o in proposal['options'])}\nTargets: {len(proposal['targets'])} items",
            priority="medium",
            status="needs_review",
        )
    except Exception as e:
        print(f"  [WARN] Could not write Notion report: {e}")

    print("Done!")
    return proposal


if __name__ == "__main__":
    main()
