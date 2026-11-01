#!/usr/bin/env bash
# Every step of the Mountain Hot Springs' assets, into dist/assets/onsen-club/ (tools/venues/onsen/README.md). Needs Blender 4.5,
# Node, python3 with Pillow, npx and ImageMagick.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/onsen-work}"
mkdir -p "$WORK"
PY=python3
for p in python3 python3.13 python3.12 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/onsen/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/onsen_textures.py"
"$PY" "$HERE/signs.py"
for s in shell props_bathhouse props_garden props_stations; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
"$COMMON/pack.sh" onsen "$REPO/dist/assets/onsen-club"
