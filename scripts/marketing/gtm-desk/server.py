#!/usr/bin/env python3
"""Local GTM desk. Reads campaign evidence; saves only personal follow-ups."""
import argparse
import json
import mimetypes
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
from datetime import datetime, timezone
import threading
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RECORDS = ROOT / "output/marketing"
STATE = Path(os.environ.get("BUYHARD_GTM_STATE_DIR", str(Path.home() / ".local/share/buyhard-gtm-desk")))
LOCK = threading.Lock()
CAMPAIGNS = {"buyhard_allgas_202609": "product", "facundo_builder_202609": "founder"}
STAGES = {"To contact", "Replied", "Meeting booked", "Conversation held", "Pilot interest", "Pilot started", "Interview", "Offer", "Closed"}


def read_json(path):
    return json.loads(path.read_text())


def stamp(record, path):
    value = record.get("checkedAt") or record.get("recordedAt")
    if value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return path.stat().st_mtime


def source_path(path):
    return str(path.resolve().relative_to(ROOT))


def load_state():
    path = STATE / "state.json"
    return read_json(path) if path.exists() else {"revision": 0, "actions": {}, "conversations": []}


def save_state(state):
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = STATE / "state.json"
    temp = STATE / (str(uuid.uuid4()) + ".tmp")
    try:
        with temp.open("x") as stream:
            os.chmod(temp, 0o600)
            json.dump(state, stream, indent=2)
            stream.write("\n")
        temp.replace(target)
    finally:
        temp.unlink(missing_ok=True)


def view():
    review = read_json(RECORDS / "gtm-desk/review.json")
    sources = {item["path"] for item in review["sources"]}
    warnings = []
    metadata = {}
    for path in sorted(RECORDS.glob("*/posts.json")):
        try:
            data = read_json(path)
            posts = data.get("posts", []) if isinstance(data, dict) else data
            for post in posts:
                if not isinstance(post, dict) or not post.get("key"):
                    continue
                metadata[post["key"]] = {**post, "captionSource": source_path(path)}
                sources.add(source_path(path))
        except (ValueError, OSError, TypeError):
            warnings.append("Could not read " + source_path(path))

    observations = []
    patterns = ("*/zernio-schedule-receipt.json", "*/publication-receipt.json", "*/social-metrics*.json", "gtm-desk/queue-observation.json")
    for pattern in patterns:
        for path in RECORDS.glob(pattern):
            try:
                data = read_json(path)
                if isinstance(data, dict) and isinstance(data.get("posts"), list):
                    observations.append((stamp(data, path), data, path))
            except (ValueError, OSError):
                warnings.append("Could not read " + source_path(path))
    posts = {}
    queue_stamp = None
    for _, data, path in sorted(observations, key=lambda row: row[0]):
        if data.get("completeQueue") is True:
            current_keys = {item["key"] for item in data["posts"] if item.get("key")}
            posts = {key: row for key, row in posts.items() if key in current_keys}
        for item in data["posts"]:
            if not item.get("key") or item.get("status") not in {"scheduled", "published", "draft", "failed"}:
                continue
            key = item["key"]
            meta = metadata.get(key, {})
            previous = posts.get(key, {})
            row = {**previous, **item}
            row["campaign"] = CAMPAIGNS.get(item.get("campaign", meta.get("campaign")), previous.get("campaign", "founder" if key in review["founderKeys"] else "product"))
            row["title"] = review["titles"].get(key, meta.get("title", key.replace("_", " ")))
            row["scheduledAt"] = item.get("scheduledAt") or item.get("displayedTime") or previous.get("scheduledAt") or meta.get("scheduledAt")
            row["checkedAt"] = data.get("checkedAt") or data.get("recordedAt")
            row["source"] = source_path(path)
            row["captionSource"] = meta.get("captionSource")
            row["copy"] = meta.get("linkedinTagged") or meta.get("linkedin") or ""
            row["evidence"] = review["postEvidence"].get(key, "Sample workflow")
            provider_id = item.get("zernioPostId") or meta.get("zernioPostId") or previous.get("zernioPostId")
            row["providerUrl"] = "https://zernio.com/dashboard/posts-all" + ("?post=" + provider_id if provider_id else "?view=table")
            row["metrics"] = item.get("metrics", item.get("zernio", previous.get("metrics", {})))
            if isinstance(row.get("links"), dict):
                row["links"] = list(row["links"].values())
            posts[key] = row
            sources.add(source_path(path))
            queue_stamp = row["checkedAt"] or queue_stamp

    metrics = []
    for path in RECORDS.glob("*/app-metrics*.json"):
        try:
            data = read_json(path)
            if data.get("complete") is True and isinstance(data.get("eventsByCampaign"), dict):
                metrics.append((stamp(data, path), data, path))
        except (ValueError, OSError):
            warnings.append("Could not read " + source_path(path))
    if not metrics:
        raise ValueError("No complete app metrics snapshot found")
    _, metric, metric_path = max(metrics, key=lambda row: row[0])
    sources.add(source_path(metric_path))
    review["posts"] = sorted(posts.values(), key=lambda row: row.get("scheduledAt") or "9999")
    review["metrics"] = metric
    review["metricsSource"] = source_path(metric_path)
    review["queueCheckedAt"] = queue_stamp
    review["loadedAt"] = datetime.now(timezone.utc).isoformat()
    review["state"] = load_state()
    review["warnings"] = warnings
    review["allowedSources"] = sorted(sources)
    for item in review["sources"]:
        path = ROOT / item["path"]
        item["modifiedAt"] = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat() if path.exists() else None
    return review


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, status, value, content_type="application/json; charset=utf-8"):
        body = json.dumps(value).encode() if not isinstance(value, bytes) else value
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        return self.headers.get("Host") in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}

    def do_GET(self):
        if not self.valid_host():
            return self.reply(403, {"error": "Local access only"})
        path = unquote(urlparse(self.path).path)
        try:
            if path == "/api/overview":
                with LOCK:
                    return self.reply(200, view())
            if path.startswith("/source/"):
                relative = path.removeprefix("/source/")
                if relative not in view()["allowedSources"]:
                    return self.reply(404, {"error": "Source not listed"})
                return self.reply(200, (ROOT / relative).read_bytes(), "text/plain; charset=utf-8")
            files = {"/": "index.html", "/app.js": "app.js", "/style.css": "style.css"}
            if path in files:
                file = HERE / files[path]
                return self.reply(200, file.read_bytes(), mimetypes.guess_type(file.name)[0] + "; charset=utf-8")
            return self.reply(404, {"error": "Not found"})
        except (ValueError, OSError, TypeError):
            return self.reply(503, {"error": "A local record could not be read. Check the source files and reload."})

    def do_POST(self):
        origin = self.headers.get("Origin")
        if not self.valid_host() or origin != "http://" + self.headers.get("Host", ""):
            return self.reply(403, {"error": "Save from the local dashboard"})
        if self.headers.get("Content-Type") != "application/json":
            return self.reply(415, {"error": "JSON required"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length < 40000:
                return self.reply(400, {"error": "Invalid save size"})
            data = json.loads(self.rfile.read(length))
            with LOCK:
                state = load_state()
                if data.get("revision") != state["revision"]:
                    return self.reply(409, {"error": "Another tab saved a change. Reload records before saving again."})
                if self.path == "/api/action":
                    valid_ids = {a["id"] for a in read_json(RECORDS / "gtm-desk/review.json")["actions"]}
                    if data.get("id") not in valid_ids or type(data.get("done")) is not bool:
                        raise ValueError()
                    state["actions"][data["id"]] = {"done": data["done"], "updatedAt": datetime.now(timezone.utc).isoformat()}
                elif self.path == "/api/conversation":
                    fields = {key: str(data.get(key, "")).strip() for key in ("id", "name", "campaign", "stage", "next", "due", "url")}
                    if not fields["name"] or len(fields["name"]) > 160 or fields["campaign"] not in {"product", "founder"} or fields["stage"] not in STAGES or len(fields["next"]) > 2000:
                        raise ValueError()
                    if fields["due"]:
                        datetime.strptime(fields["due"], "%Y-%m-%d")
                    if fields["url"] and (urlparse(fields["url"]).scheme not in {"http", "https"} or not urlparse(fields["url"]).netloc or len(fields["url"]) > 2000):
                        raise ValueError()
                    found = next((row for row in state["conversations"] if row["id"] == fields["id"]), None)
                    if fields["id"] and not found:
                        raise ValueError()
                    fields["id"] = fields["id"] or str(uuid.uuid4())
                    fields["updatedAt"] = datetime.now(timezone.utc).isoformat()
                    if found:
                        found.update(fields)
                    else:
                        state["conversations"].append(fields)
                else:
                    return self.reply(404, {"error": "Not found"})
                state["revision"] += 1
                save_state(state)
                return self.reply(200, state)
        except (ValueError, TypeError, KeyError):
            return self.reply(400, {"error": "Check the name, campaign, stage, date and link."})
        except OSError:
            return self.reply(500, {"error": "Could not save your changes. Please try again."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8796)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"GTM desk: http://127.0.0.1:{args.port}\nPersonal notes: {STATE}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
