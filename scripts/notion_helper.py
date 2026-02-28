"""
notion_helper.py
----------------
Shared helpers for interacting with the Notion REST API.
Uses requests directly because notion-client v3 moved properties management
to a new 'data_sources' abstraction that differs from the classic v2 API.
All calls go through the stable REST API (2022-06-28 version).
"""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv(override=True)

_API_KEY = os.getenv("NOTION_API_KEY")
_VERSION = "2022-06-28"
_BASE = "https://api.notion.com/v1"

_HEADERS = {
    "Authorization": f"Bearer {_API_KEY}",
    "Notion-Version": _VERSION,
    "Content-Type": "application/json",
}


def _get(path: str) -> dict:
    resp = requests.get(f"{_BASE}/{path}", headers=_HEADERS)
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict) -> dict:
    resp = requests.post(f"{_BASE}/{path}", headers=_HEADERS, json=body)
    if not resp.ok:
        raise RuntimeError(f"POST /{path} failed {resp.status_code}: {resp.text[:400]}")
    return resp.json()


def _patch(path: str, body: dict) -> dict:
    resp = requests.patch(f"{_BASE}/{path}", headers=_HEADERS, json=body)
    if not resp.ok:
        raise RuntimeError(f"PATCH /{path} failed {resp.status_code}: {resp.text[:400]}")
    return resp.json()


# ── Database operations ────────────────────────────────────────────────────────

def create_database(parent_page_id: str, title: str, properties: dict) -> str:
    """Create a Notion database. Returns its ID."""
    body = {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": title}}],
        "properties": properties,
    }
    data = _post("databases", body)
    return data["id"]


def update_database_properties(database_id: str, properties: dict) -> dict:
    """Add or update properties on an existing database."""
    return _patch(f"databases/{database_id}", {"properties": properties})


def get_database_schema(database_id: str) -> dict:
    """Return dict of {property_name: property_type} for a database."""
    data = _get(f"databases/{database_id}")
    return {name: prop["type"] for name, prop in data.get("properties", {}).items()}


def query_database(database_id: str, filter_obj: dict = None, page_size: int = 100) -> list:
    """Query all pages from a Notion database, handling pagination."""
    results = []
    has_more = True
    cursor = None

    while has_more:
        body = {"page_size": page_size}
        if filter_obj:
            body["filter"] = filter_obj
        if cursor:
            body["start_cursor"] = cursor

        data = _post(f"databases/{database_id}/query", body)
        results.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        cursor = data.get("next_cursor")
        if has_more:
            time.sleep(0.35)  # Notion rate limit: 3 req/s

    return results


# ── Page operations ────────────────────────────────────────────────────────────

def create_page(database_id: str, properties: dict) -> dict:
    """Create a new page in a Notion database."""
    body = {
        "parent": {"database_id": database_id},
        "properties": properties,
    }
    return _post("pages", body)


def update_page(page_id: str, properties: dict) -> dict:
    """Update properties of an existing Notion page."""
    return _patch(f"pages/{page_id}", {"properties": properties})


def archive_page(page_id: str) -> dict:
    """Archive (soft-delete) a Notion page."""
    return _patch(f"pages/{page_id}", {"archived": True})


def get_page(page_id: str) -> dict:
    """Fetch a Notion page by ID."""
    return _get(f"pages/{page_id}")


# ── Utility ────────────────────────────────────────────────────────────────────

def get_page_title(page: dict) -> str:
    """Extract the plain text title from a Notion page object."""
    for prop_val in page.get("properties", {}).values():
        if prop_val.get("type") == "title":
            titles = prop_val.get("title", [])
            if titles:
                return titles[0].get("plain_text", "")
    return ""


def rich_text(content: str) -> list:
    """Helper: wrap a string as a Notion rich_text value."""
    return [{"text": {"content": content[:2000]}}]  # Notion 2000-char limit
