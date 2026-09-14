#!/usr/bin/env python3
"""Explicit, read-only production refresh. Persists aggregate counts only."""
import json
import subprocess
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[3]
DESTINATION = ROOT / "output/marketing/gtm-desk/app-metrics.json"


def query_all(function):
    records, cursor, pages = [], None, 0
    while True:
        result = subprocess.run(
            ["pnpm", "exec", "convex", "run", "--prod", function,
             json.dumps({"paginationOpts": {"numItems": 100, "cursor": cursor}})],
            cwd=ROOT, capture_output=True, text=True, check=True, timeout=60,
        )
        page = json.loads(result.stdout)
        records.extend(page["page"])
        pages += 1
        if page["isDone"]:
            return records, pages
        following = page.get("continueCursor")
        if not following or following == cursor or pages >= 100:
            raise ValueError("Incomplete pagination")
        cursor = following


def main():
    events, event_pages = query_all("marketing:events")
    leads, lead_pages = query_all("marketing:list")
    campaign, source, both, content = [defaultdict(Counter) for _ in range(4)]
    total, excluded = Counter(), Counter()
    for row in events:
        attribution = row.get("source", {})
        event = row["event"]
        if attribution.get("utm_source") == "launch-check":
            excluded[event] += 1
            continue
        channel = attribution.get("utm_source") or "direct_or_unattributed"
        name = attribution.get("utm_campaign") or "unattributed"
        story = attribution.get("utm_content") or "unattributed"
        total[event] += 1
        campaign[name][event] += 1
        source[channel][event] += 1
        both[name + " / " + channel][event] += 1
        content[story][event] += 1
    actual_leads = [lead for lead in leads if lead.get("source", {}).get("utm_source") != "launch-check"]
    result = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "target": "Production for autonomous-buyer; selected explicitly with convex run --prod",
        "method": "Read-only marketing:events and marketing:list; all pages; only aggregate data saved",
        "complete": True,
        "pages": {"events": event_pages, "leads": lead_pages},
        "events": total,
        "eventsByCampaign": campaign,
        "eventsBySource": source,
        "eventsByCampaignAndSource": both,
        "eventsByContent": content,
        "nonTestLeads": len(actual_leads),
        "leadStages": Counter(lead["stage"] for lead in actual_leads),
        "excludedLaunchCheckEvents": excluded,
        "excludedLaunchCheckLeads": len(leads) - len(actual_leads),
        "rawVisitorRecordsRetained": False,
        "limitations": [
            "Browser storage IDs are not verified people; own or automated visits may be included.",
            "Demo-use tracking has a known gap; measured demo use is not a complete measure.",
            "Inquiries and confirmed bookings are separate branches, not a required linear sequence.",
            "Private social messages and offline conversations were not reviewed.",
        ],
    }
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = DESTINATION.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n")
    temporary.replace(DESTINATION)
    print(json.dumps({"checkedAt": result["checkedAt"], "eventsByCampaign": campaign, "nonTestLeads": len(actual_leads)}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError, KeyError, OSError):
        raise SystemExit("The complete production read failed. The previous metrics were kept. Check Convex CLI access and retry.")
