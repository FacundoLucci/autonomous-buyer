# Local GTM desk

Personal dashboard for BUY HARD and Facundo's founder content. No package installation is needed.

```sh
cd /Users/facundo/repos/github/buyer
python3 scripts/marketing/gtm-desk/server.py --port 8796
```

Open [the dashboard](http://127.0.0.1:8796) in the Codex in-app browser. Stop the server with Ctrl+C. It binds only to `127.0.0.1`.

## What it does

- Reads existing campaign post metadata, schedule/publication receipts, dated Zernio observations and complete app aggregate snapshots.
- Merges post states by campaign post key and observation timestamp. A past scheduled date remains unverified until publication evidence is present.
- Shows separate product and founder goals, shared publishing slots, actions, sources and outcome limits.
- The Recordings page reads the existing review’s `recordingPlan` source: read-aloud scripts, raw-file delivery targets, replacement cutoffs and edit status. Publishing rows show matching clip deadlines. No file is uploaded and no post is changed by this page.
- Saves action checkmarks and follow-up records atomically to `~/.local/share/buyhard-gtm-desk/state.json`, outside this public app repository. Reloading or restarting the server preserves these records. Concurrent stale saves are rejected instead of overwriting newer changes.

There is no direct publishing, messaging, calendar write or production write. The server has no API credentials. Refreshing the page or choosing **Reload records** rereads local files, not the live services.

## Sources and refreshing

`output/marketing/gtm-desk/review.json` holds the dated assessment, titles, actions, source map and work notes. `queue-observation.json` holds the latest queue read made for this review. `app-metrics.json` holds only production aggregates.

The dashboard also discovers these one-directory-deep patterns under `output/marketing/`:

- `*/posts.json`
- `*/zernio-schedule-receipt.json`
- `*/publication-receipt.json`
- `*/social-metrics*.json`
- `*/app-metrics*.json` with `complete: true` and `eventsByCampaign`

Existing twice-daily marketing reviews already write compatible evidence. Supported new receipts take precedence by `checkedAt` or `recordedAt`. Work summaries remain a dated assessment and should be revised as their tasks change.

Refresh production aggregates explicitly using the read-only helper:

```sh
python3 scripts/marketing/gtm-desk/refresh_metrics.py
```

This uses the repo's authenticated Convex CLI, explicitly selects production, paginates both read-only queries, excludes `launch-check`, and stores aggregate counts only. It performs no deployments. The server itself never runs this command.

For a fresh queue snapshot, inspect the actual Zernio table in the in-app browser, retain existing post keys, save the observations with a new `checkedAt` timestamp, and reload records. Do not turn a scheduled timestamp into an inferred publication.

The source viewer serves only explicitly listed campaign sources and recognized receipt files, not arbitrary repository files. Follow-up state is never served as a source file. For an isolated QA session, set `BUYHARD_GTM_STATE_DIR` to a temporary directory and choose another local port.
