#!/usr/bin/env python3
"""Join the approved footage in story order, preserving all originals."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
footage = root / "assets/storyboard/you-handle-today-footage"
clips = footage / "pilot/clips"
takes = [
    ("01-unloading-turbo", 5), ("02-impact-turbo-v4-edited", 4),
    ("03-phone-turbo-v2", 5), ("04-leaving-turbo", 5),
    ("05-emergency-cups-turbo", 5), ("06-emergency-bread-turbo", 5),
    ("07-loading-car-turbo", 5), ("08-returning-cleanup-turbo", 5),
    ("09-review-turbo", 5), ("10-serving-turbo", 5),
    ("11-back-to-business-turbo", 5),
]
command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
filters = []
for i, (name, duration) in enumerate(takes):
    command += ["-i", str(clips / (name + ".mp4"))]
    filters += [
        f"[{i}:v]trim=duration={duration},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v{i}]",
        f"[{i}:a]atrim=duration={duration},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a{i}]",
    ]
filters += ["".join(f"[v{i}][a{i}]" for i in range(len(takes))) + f"concat=n={len(takes)}:v=1:a=1[v][a]"]
output = footage / "assembly/footage-sequence-v1.mp4"
output.parent.mkdir(parents=True, exist_ok=True)
command += ["-filter_complex", ";".join(filters), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]
subprocess.run(command, check=True)
record = {"file": str(output.relative_to(root)), "selected_takes": takes, "duration_seconds": sum(t[1] for t in takes), "description": "Footage only; source shots at normal speed except the approved tightened piano impact."}
(output.parent / "footage-sequence-v1-edit.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
