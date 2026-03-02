#!/usr/bin/env python3
"""
Isabel Proposal Implementer — deterministic script (no AI needed).

Reads the proposal JSON, decodes the selected option's base64 preview
into production PNG(s), updates sprites.ts + office-layout.json, and
deletes the proposal file.

Usage:
    python3 scripts/agents/isabel_implement.py --selection 0
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys

# ── Paths (relative to repo root) ──────────────────────────────────────────
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROPOSAL_PATH = os.path.join(REPO_ROOT, "dashboard", "public", "proposals", "isabel.json")
SPRITES_DIR = os.path.join(REPO_ROOT, "dashboard", "public", "sprites", "furniture")
SPRITES_TS = os.path.join(REPO_ROOT, "dashboard", "components", "pixel-office", "sprites.ts")
LAYOUT_JSON = os.path.join(REPO_ROOT, "dashboard", "components", "pixel-office", "office-layout.json")


def load_proposal():
    if not os.path.exists(PROPOSAL_PATH):
        print("ERROR: No proposal found at", PROPOSAL_PATH)
        sys.exit(1)
    with open(PROPOSAL_PATH, "r") as f:
        return json.load(f)


def decode_preview(data_uri: str) -> bytes:
    """Strip data:image/png;base64, prefix and decode."""
    if "," in data_uri:
        data_uri = data_uri.split(",", 1)[1]
    return base64.b64decode(data_uri)


CATEGORY_PREFIX = {
    "Paintings": "CUSTOM_PAINTING_",
    "Plants": "CUSTOM_PLANT_",
    "Rug": "CUSTOM_RUG_",
    "Bookcases": "CUSTOM_BOOKCASE_",
    "Loveseats": "CUSTOM_LOVESEAT_",
    "Coffee Table": "CUSTOM_COFFEE_TABLE_",
}


def make_asset_id(label: str, category: str) -> str:
    """Convert option label like 'Midnight Garden' + category to 'CUSTOM_PAINTING_MIDNIGHT_GARDEN'."""
    prefix = CATEGORY_PREFIX.get(category, "CUSTOM_")
    clean = re.sub(r"[^a-zA-Z0-9\s]", "", label)
    return prefix + clean.strip().upper().replace(" ", "_")


def save_png(asset_id: str, png_bytes: bytes) -> str:
    """Save PNG to sprites/furniture/ and return the filename."""
    filename = asset_id + ".png"
    filepath = os.path.join(SPRITES_DIR, filename)
    os.makedirs(SPRITES_DIR, exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(png_bytes)
    print(f"  Saved: {filepath} ({len(png_bytes)} bytes)")
    return filename


def update_sprites_ts(asset_id: str, filename: str, proposal: dict):
    """Add the new asset to FURNITURE_ASSETS in sprites.ts."""
    with open(SPRITES_TS, "r") as f:
        content = f.read()

    # Check if already exists
    if asset_id in content:
        print(f"  {asset_id} already in sprites.ts, skipping")
        return

    w = proposal["footprint"]["w"]
    h = proposal["footprint"]["h"]
    wall = proposal.get("wallMounted", False)

    # Build the entry line
    wall_str = ", wallMounted: true" if wall else ""
    entry = f'  {asset_id}: {{ file: "{filename}", widthPx: {w}, heightPx: {h}, footprintW: {w // 16}, footprintH: {h // 16}, solid: false{wall_str} }},'

    # Insert after the last CUSTOM_ entry, or after the Custom furniture comment
    # Find the best insertion point
    lines = content.split("\n")
    insert_idx = None
    for i, line in enumerate(lines):
        if "CUSTOM_" in line and "file:" in line:
            insert_idx = i + 1  # After last CUSTOM_ line
        elif "Custom furniture" in line:
            insert_idx = i + 1  # After comment if no CUSTOM_ entries yet

    if insert_idx is None:
        # Fallback: insert before the closing brace of FURNITURE_ASSETS
        for i, line in enumerate(lines):
            if line.strip() == "};" and i > 190:  # After FURNITURE_ASSETS start
                insert_idx = i
                break

    if insert_idx is not None:
        lines.insert(insert_idx, entry)
        with open(SPRITES_TS, "w") as f:
            f.write("\n".join(lines))
        print(f"  Added {asset_id} to sprites.ts at line {insert_idx + 1}")
    else:
        print("  ERROR: Could not find insertion point in sprites.ts")
        sys.exit(1)


def update_layout_json(asset_id: str, targets: list):
    """Replace target furniture items with the new asset in office-layout.json."""
    with open(LAYOUT_JSON, "r") as f:
        layout = json.load(f)

    furniture = layout.get("furniture", [])
    replaced = 0

    for target in targets:
        uid = target["uid"]
        for item in furniture:
            if item.get("uid") == uid:
                old_type = item["type"]
                item["type"] = asset_id
                print(f"  Replaced {old_type} (uid={uid}) at ({item['col']},{item['row']}) -> {asset_id}")
                replaced += 1
                break

    if replaced == 0:
        print("  WARNING: No furniture items were replaced")
    else:
        with open(LAYOUT_JSON, "w") as f:
            json.dump(layout, f, indent=2)
            f.write("\n")
        print(f"  Updated {replaced} item(s) in office-layout.json")


def delete_proposal():
    """Remove the proposal JSON after implementation."""
    if os.path.exists(PROPOSAL_PATH):
        os.remove(PROPOSAL_PATH)
        print(f"  Deleted {PROPOSAL_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Implement Isabel's selected proposal")
    parser.add_argument("--selection", type=int, required=True, help="Option index (0-3)")
    args = parser.parse_args()

    proposal = load_proposal()
    options = proposal["options"]

    if args.selection < 0 or args.selection >= len(options):
        print(f"ERROR: Selection {args.selection} out of range (0-{len(options)-1})")
        sys.exit(1)

    selected = options[args.selection]
    targets = proposal.get("targets", [])

    print(f"\n=== Isabel Proposal Implementation ===")
    print(f"Category: {proposal['category']}")
    print(f"Selected: {selected['label']} — {selected['description']}")
    print(f"Targets:  {len(targets)} item(s) to replace")
    print()

    # 1. Decode and save the PNG
    asset_id = make_asset_id(selected["label"], proposal["category"])
    png_bytes = decode_preview(selected["preview"])
    filename = save_png(asset_id, png_bytes)

    # 2. Add to sprites.ts
    print("\nUpdating sprites.ts...")
    update_sprites_ts(asset_id, filename, proposal)

    # 3. Update office-layout.json
    print("\nUpdating office-layout.json...")
    update_layout_json(asset_id, targets)

    # 4. Delete proposal
    print("\nCleaning up...")
    delete_proposal()

    print(f"\n✓ Done! {selected['label']} is now in the office.")
    print(f"  Asset ID: {asset_id}")
    print(f"  File: {filename}")
    print(f"  Replaced {len(targets)} item(s)")


if __name__ == "__main__":
    main()
