#!/usr/bin/env bash
# Every step of the Jumping Pool's assets, into dist/assets/dive-club/ (tools/venues/dive/README.md). Needs Blender 4.5, Node,
# python3 with Pillow and numpy and ImageMagick. The pictures made once on fal (README: the twelve materials, the emblem, the
# peacocks and ducks; with our characters: the Hall of Fame, the club's poster, Sir Reginald's portrait) are read from $DIVE_GEN
# (default $VENUE_WORK/gen).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/dive-work}"
GEN="${DIVE_GEN:-$WORK/gen}"
export DIVE_GEN="$GEN" VENUE_WORK="$WORK"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3.13 python3.12 python3 /usr/bin/python3 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image; import numpy" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/dive/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/dive_textures.py"
"$PY" "$HERE/painted.py" "$GEN" "$WORK"
"$PY" "$HERE/signs.py"
for s in shell props_towers props_garden props_stories; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
# (16-bit positions: the lawns run 120 m across, the basin 4.2 m deep)
VENUE_VP=16 "$COMMON/pack.sh" dive "$REPO/dist/assets/dive-club"
