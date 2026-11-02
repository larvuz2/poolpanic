#!/usr/bin/env bash
# Every step of the Lazy River's assets, into dist/assets/river-club/ (tools/venues/river/README.md). Needs Blender 4.5, Node, python3
# with Pillow and numpy, npx and ImageMagick. The pictures made once on fal (README: the seven materials, the Lazy Idol, the foliage
# sheet, the explorer's map, the travel poster, the horizon) are read from $RIVER_GEN (default $VENUE_WORK/gen).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/river-work}"
GEN="${RIVER_GEN:-$WORK/gen}"
export RIVER_GEN="$GEN"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3.13 python3.12 python3 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image; import numpy" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/river/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/river_textures.py"
"$PY" "$HERE/painted.py" "$GEN" "$WORK"
"$PY" "$HERE/signs.py"
"$COMMON/horizon.sh" "$GEN/horizon.png" "$REPO/dist/assets/river-club/horizon.webp"
# (shell.py first: it writes the ruin's bays, which props_deck.py reads)
for s in shell props_river props_deck garden; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
"$COMMON/pack.sh" river "$REPO/dist/assets/river-club"
