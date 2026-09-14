#!/usr/bin/env python3
"""Assemble selected footage and recorded editorial timing without a paid call."""
import argparse
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
pilot = root / "assets/storyboard/you-handle-today-footage/pilot"
parser = argparse.ArgumentParser()
manifest = json.loads((pilot / "manifest.json").read_text())
impact_choices = [job["id"].removeprefix("02-impact-") for job in manifest["jobs"] if job["id"].startswith("02-impact-")]
phone_choices = [job["id"].removeprefix("03-phone-") for job in manifest["jobs"] if job["id"].startswith("03-phone-")]
parser.add_argument("--impact", choices=impact_choices, default="turbo")
parser.add_argument("--phone", choices=phone_choices, default="turbo")
parser.add_argument("--output", default="pilot-cut.mp4")
args = parser.parse_args()
if Path(args.output).name != args.output or Path(args.output).suffix != ".mp4":
    parser.error("Output must be an MP4 filename inside the pilot folder.")
ids = ["01-unloading-turbo", "02-impact-" + args.impact, "03-phone-" + args.phone]
command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
filters = []
selected_files = []
duration = 0
for index, ident in enumerate(ids):
    job = next(job for job in manifest["jobs"] if job["id"] == ident)
    edit = job.get("selected_edit", {})
    source = (pilot / edit.get("file", "clips/" + ident + ".mp4")).resolve()
    if not source.is_relative_to(pilot.resolve()):
        parser.error("Selected footage must be inside the pilot folder.")
    seconds = edit.get("duration_seconds", 5)
    duration += seconds
    selected_files.append(str(source.relative_to(root)))
    command += ["-i", str(source)]
    filters += [
        f"[{index}:v]trim=duration={seconds},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v{index}]",
        f"[{index}:a]atrim=duration={seconds},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a{index}]",
    ]
filters += ["[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]"]
output = pilot / args.output
command += ["-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]
subprocess.run(command, check=True)
probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height,r_frame_rate:format=duration,size", "-of", "json", str(output)], text=True))
record = {"selected_takes": ids, "selected_files": selected_files, "file": str(output.relative_to(root)), "duration_seconds": duration, "description": "Footage only; no app screen or founder recording is included.", "media_probe": probe}
metadata = "edit.json" if args.output == "pilot-cut.mp4" else output.stem + "-edit.json"
(pilot / metadata).write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
