#!/usr/bin/env bash
# Every step of the Wave Pool's assets, into dist/assets/wave-club/ (tools/venues/wave/README.md). Needs Blender 4.5, Node, python3
# with Pillow, npx and ImageMagick. The painted pieces made once on fal (README: the mural, the pool floor's octopus, the horizon) are
# read from $WAVE_GEN (default $VENUE_WORK/gen): mural.png and octopus.png; the horizon is made by horizon.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/wave-work}"
GEN="${WAVE_GEN:-$WORK/gen}"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3 python3.13 python3.12 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/wave/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/wave_textures.py"
"$PY" "$HERE/signs.py"
"$HERE/painted.sh" "$GEN" "$WORK"
for s in shell props_house props_stations props_beach garden; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
"$COMMON/pack.sh" wave "$REPO/dist/assets/wave-club"
