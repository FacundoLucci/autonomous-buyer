#!/usr/bin/env python3
"""Generate the explicitly listed footage pilot, with durable request receipts.

Plan: python3 video/scripts/fal-pilot.py plan
Submit once: python3 video/scripts/fal-pilot.py submit JOB_ID
Fetch without resubmitting: python3 video/scripts/fal-pilot.py collect JOB_ID
The key is read privately; it never goes into the manifest, receipts or stdout.
"""

import argparse
import base64
import datetime as dt
from decimal import Decimal
import hashlib
import json
import mimetypes
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PILOT = ROOT / "assets/storyboard/you-handle-today-footage/pilot"
MANIFEST = PILOT / "manifest.json"
KEY_FILE = Path.home() / ".config/buy-hard-video/fal.env"
BASE_RATES = {
    "minimax/h3-max-turbo/image-to-video": Decimal("0.00625"),
    "minimax/h3-max/image-to-video": Decimal("0.0125"),
}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(obj, indent=2) + "\n")
    temporary.replace(path)


def key_value():
    for line in KEY_FILE.read_text().splitlines():
        if line.startswith("FAL_KEY="):
            value = line.split("=", 1)[1].strip().strip("\"'")
            if value:
                return value
    raise RuntimeError("The credential file does not contain FAL_KEY.")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Refusing to redirect an authenticated request.")


def api(url, method="GET", payload=None):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in {"api.fal.ai", "queue.fal.run"}:
        raise RuntimeError("Unexpected API host.")
    key = key_value()
    headers = {"Authorization": "Key " + key, "Content-Type": "application/json"}
    if method == "POST":
        headers["X-Fal-No-Retry"] = "1"
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, headers=headers, data=data, method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Provider errors can echo the full image input. Keep only short diagnostics.
        raw = error.read().decode("utf-8", "replace").replace(key, "[redacted]")
        try:
            obj = json.loads(raw)
            detail = obj.get("detail", obj.get("error", "Request failed"))
            if isinstance(detail, dict):
                detail = detail.get("message", detail.get("type", "Request failed"))
            if isinstance(detail, list):
                detail = [{k: v for k, v in item.items() if k in {"loc", "msg", "type"}}
                          for item in detail if isinstance(item, dict)]
            message = str(detail)[:400]
        except (ValueError, AttributeError):
            message = "Request failed"
        raise RuntimeError(f"fal HTTP {error.code}: {message}") from None


def read_manifest():
    return json.loads(MANIFEST.read_text())


def estimate(job):
    return Decimal(str(job["input"]["duration"])) * Decimal(job["usd_per_second"])


def receipt_path(job):
    return PILOT / "receipts" / (job["id"] + ".json")


def data_uri(name):
    path = (PILOT / name).resolve()
    if not path.is_relative_to(PILOT.resolve()) or not path.is_file():
        raise RuntimeError("Starting or ending frame is missing from the pilot folder.")
    mime = mimetypes.guess_type(path.name)[0]
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        raise RuntimeError("Unsupported keyframe format.")
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def submit(manifest, job):
    path = receipt_path(job)
    if path.exists():
        raise RuntimeError("A receipt already exists. Use collect; do not submit this job again.")
    if dt.datetime.now(dt.timezone.utc).date() > dt.date.fromisoformat(manifest["rate_valid_through"]):
        raise RuntimeError("Refresh promotional pricing before submitting another job.")
    reserved = sum((Decimal(json.loads(p.read_text())["estimated_usd"])
                    for p in (PILOT / "receipts").glob("*.json")), Decimal("0"))
    if reserved + estimate(job) > Decimal(manifest["pilot_limit_usd"]):
        raise RuntimeError("This job exceeds the pilot's estimated spending limit.")
    endpoint = job["endpoint"]
    if endpoint not in BASE_RATES or job["input"]["resolution"] != "1080P":
        raise RuntimeError("Model or resolution needs a fresh price check.")
    expected_1080_rate = BASE_RATES[endpoint] * Decimal("3.2")
    if Decimal(job["usd_per_second"]) != expected_1080_rate:
        raise RuntimeError("The configured 1080P rate differs from the verified price.")
    prices = api("https://api.fal.ai/v1/models/pricing?" + urllib.parse.urlencode({"endpoint_id": endpoint}))
    price = next((p for p in prices.get("prices", []) if p["endpoint_id"] == endpoint), None)
    if not price or price["currency"] != "USD" or price["unit"] != "seconds" or Decimal(str(price["unit_price"])) != BASE_RATES[endpoint]:
        raise RuntimeError("The provider's base price changed. Recheck the resolution rate.")
    payload = dict(job["input"])
    payload["image_url"] = data_uri(job["first_frame"])
    if job.get("last_frame"):
        payload["end_image_url"] = data_uri(job["last_frame"])
    receipt = {
        "job_id": job["id"], "endpoint": endpoint, "submitted_at": now(),
        "estimated_usd": str(estimate(job)), "actual_billed_usd": None,
        "price_lookup": prices, "status": "SUBMITTING", "job": job,
        "input_sha256": hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(),
    }
    save(path, receipt)
    try:
        response = api("https://queue.fal.run/" + endpoint, "POST", payload)
    except Exception as error:
        receipt.update(status="SUBMISSION_UNCERTAIN", error=str(error))
        save(path, receipt)
        raise
    receipt.update(status="SUBMITTED", queue=response)
    save(path, receipt)
    print(json.dumps({"job":job["id"], "status":"SUBMITTED", "request_id":response.get("request_id"), "estimated_usd":receipt["estimated_usd"]}))


def collect(job):
    path = receipt_path(job)
    receipt = json.loads(path.read_text())
    if receipt.get("status") == "DOWNLOADED":
        downloaded = ROOT / receipt["local_video"]
        expected = receipt.get("result", {}).get("video", {}).get("file_size")
        if downloaded.is_file() and (not expected or downloaded.stat().st_size == expected):
            print(json.dumps({"job":job["id"], "status":"DOWNLOADED", "file":receipt["local_video"]}))
            return
        receipt.update(status="DOWNLOAD_INCOMPLETE", video_bytes=downloaded.stat().st_size if downloaded.is_file() else 0)
        save(path, receipt)
    queue = receipt.get("queue")
    if not queue:
        raise RuntimeError("No request ID was recorded. Check the provider before any resubmission.")
    status = api(queue["status_url"])
    receipt.update(status=status["status"], last_checked_at=now(), provider_status=status)
    save(path, receipt)
    if status["status"] != "COMPLETED":
        print(json.dumps({"job":job["id"], "status":status["status"], "queue_position":status.get("queue_position")}))
        return
    if status.get("error"):
        raise RuntimeError("Generation failed: " + str(status["error"])[:300])
    result = api(queue["response_url"])
    receipt["result"] = result
    save(path, receipt)
    url = result["video"]["url"]
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".fal.media"):
        raise RuntimeError("Review the returned media host before downloading.")
    destination = PILOT / "clips" / (job["id"] + ".mp4")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".part")
    # Media requests intentionally carry no API credential.
    with urllib.request.urlopen(url, timeout=45) as response, temporary.open("wb") as output:
        content_length = response.headers.get("Content-Length")
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    expected_bytes = result["video"].get("file_size") or (int(content_length) if content_length else None)
    if expected_bytes and temporary.stat().st_size != expected_bytes:
        receipt.update(status="DOWNLOAD_INCOMPLETE", video_bytes=temporary.stat().st_size)
        save(path, receipt)
        raise RuntimeError("The video download was incomplete. Collect again; do not resubmit generation.")
    temporary.replace(destination)
    receipt.update(status="DOWNLOADED", downloaded_at=now(), local_video=str(destination.relative_to(ROOT)), video_bytes=destination.stat().st_size)
    save(path, receipt)
    print(json.dumps({"job":job["id"], "status":"DOWNLOADED", "file":str(destination.relative_to(ROOT)), "estimated_usd":receipt["estimated_usd"]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "submit", "collect"])
    parser.add_argument("job", nargs="?")
    args = parser.parse_args()
    manifest = read_manifest()
    if args.command == "plan":
        print(json.dumps({"jobs":[{"id":j["id"], "estimated_usd":str(estimate(j)), "frames_ready":all((PILOT / j[k]).is_file() for k in ["first_frame", "last_frame"] if j.get(k))} for j in manifest["jobs"]], "estimated_total_usd":str(sum((estimate(j) for j in manifest["jobs"]), Decimal("0"))), "pilot_limit_usd":manifest["pilot_limit_usd"]}, indent=2))
        return
    job = next((j for j in manifest["jobs"] if j["id"] == args.job), None)
    if not job:
        raise RuntimeError("Choose one of the jobs in the manifest.")
    if args.command == "submit":
        submit(manifest, job)
    else:
        collect(job)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
