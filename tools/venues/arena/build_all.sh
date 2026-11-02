#!/usr/bin/env bash
# Every step of the Grand Gala Arena's assets, into dist/assets/arena-club/ (tools/venues/arena/README.md). Needs Blender 4.5, Node,
# python3 with Pillow and numpy and ImageMagick. The pictures made once on fal (README: the ten materials, the emblem, the press
# pen's ducks; with our characters: the GRAND GALA poster, the nominees, the red carpet; the flamingo's portrait) are read from
# $ARENA_GEN (default $VENUE_WORK/gen), with the Rooftop Pool's marble, concrete and linen copied in beside them.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/arena-work}"
GEN="${ARENA_GEN:-$WORK/gen}"
export ARENA_GEN="$GEN" VENUE_WORK="$WORK"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3.13 python3.12 python3 /usr/bin/python3 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image; import numpy" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/arena/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/arena_textures.py"
"$PY" "$HERE/painted.py" "$GEN" "$WORK"
"$PY" "$HERE/signs.py"
for s in shell props_stations props_doors props_gala; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
"$COMMON/pack.sh" arena "$REPO/dist/assets/arena-club"
