#!/usr/bin/env bash
# Every step of Senior Aqua Fit's assets, into dist/assets/senior-club/ (tools/venues/senior/README.md). Needs Blender 4.5, Node,
# python3 with Pillow and numpy, npx and ImageMagick. The painted pieces made once on fal (README: the club photographs, the founder's
# portrait, the swan, the horizon) are read from $SENIOR_GEN (default $VENUE_WORK/gen): photos.png, founder.png, swan.png, horizon.png.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/senior-work}"
GEN="${SENIOR_GEN:-$WORK/gen}"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3 python3.13 python3.12 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/senior/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/senior_textures.py"
"$PY" "$HERE/signs.py"
"$HERE/painted.sh" "$GEN" "$WORK"
"$COMMON/horizon.sh" "$GEN/horizon.png" "$REPO/dist/assets/senior-club/horizon.webp"
for s in shell props_stations props_decor garden; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
"$COMMON/pack.sh" senior "$REPO/dist/assets/senior-club"
