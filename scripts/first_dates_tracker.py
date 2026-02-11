#!/usr/bin/env python3
"""
Track latest First Dates episode page on Mediaset Infinity,
excluding cards marked as Infinity+.

This script does NOT download media. It only records metadata + URL.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import requests
from bs4 import BeautifulSoup

LISTING_URL = "https://www.mediasetinfinity.es/programas-tv/first-dates/"
OUTPUT_DIR = Path("/Users/Alyx/Documents/FirstDatesTracker")
STATE_FILE = OUTPUT_DIR / "state.json"
LATEST_JSON = OUTPUT_DIR / "latest_episode.json"
LATEST_URL_TXT = OUTPUT_DIR / "latest_episode.url.txt"
HISTORY_JSONL = OUTPUT_DIR / "history.jsonl"


@dataclass
class EpisodeCandidate:
    url: str
    title: str
    summary: str
    has_infinity_plus_marker: bool


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def fetch_listing_html(url: str) -> str:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text


def extract_candidates(html: str) -> List[EpisodeCandidate]:
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    out: List[EpisodeCandidate] = []

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "/episodios/" not in href or "/player/" not in href:
            continue

        full_url = href if href.startswith("http") else f"https://www.mediasetinfinity.es{href}"
        if full_url in seen:
            continue
        seen.add(full_url)

        title = clean_text(a.get_text(" ", strip=True))

        # Try to capture surrounding card text
        card = a
        for _ in range(7):
            if card is None:
                break
            if getattr(card, "name", None) in {"article", "li", "section", "div"}:
                text = clean_text(card.get_text(" ", strip=True))
                if len(text) > len(title):
                    break
            card = card.parent
        else:
            text = title

        text = clean_text(text if "text" in locals() else title)
        lower = text.lower()
        has_plus = "infinity+" in lower or " infinity +" in lower or "infinity plus" in lower

        # summary heuristic: long text without the tiny generic label
        summary = text
        if title and summary.startswith(title):
            summary = clean_text(summary[len(title):])

        out.append(
            EpisodeCandidate(
                url=full_url,
                title=title or "(sin título en listing)",
                summary=summary,
                has_infinity_plus_marker=has_plus,
            )
        )

    return out


def pick_latest_free(candidates: List[EpisodeCandidate]) -> EpisodeCandidate | None:
    # listing order is newest first on current site
    for c in candidates:
        if not c.has_infinity_plus_marker:
            return c
    return None


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_state(data: dict) -> None:
    STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    html = fetch_listing_html(LISTING_URL)
    candidates = extract_candidates(html)
    latest = pick_latest_free(candidates)

    payload = {
        "checked_at": now_iso(),
        "source": LISTING_URL,
        "candidates_found": len(candidates),
        "latest_non_infinity_plus": asdict(latest) if latest else None,
    }

    LATEST_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if latest:
        LATEST_URL_TXT.write_text(latest.url + "\n", encoding="utf-8")

    state = load_state()
    prev_url = state.get("last_seen_url")
    new_url = latest.url if latest else None
    changed = bool(new_url and new_url != prev_url)

    state.update(
        {
            "last_check": payload["checked_at"],
            "last_seen_url": new_url,
            "changed": changed,
        }
    )
    save_state(state)

    with HISTORY_JSONL.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")

    print(f"Checked: {payload['checked_at']}")
    print(f"Candidates: {len(candidates)}")
    if latest:
        print(f"Latest non-Infinity+: {latest.url}")
        print(f"Changed since last run: {'YES' if changed else 'NO'}")
    else:
        print("No non-Infinity+ candidate found")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
