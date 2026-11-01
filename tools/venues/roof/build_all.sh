#!/usr/bin/env bash
# Every step of the Rooftop Pool's assets, into dist/assets/roof-club/ (tools/venues/roof/README.md). Needs Blender 4.5, Node,
# python3 with Pillow and numpy and ImageMagick. The pictures made once on fal (README: the ten materials, the emblem, the pigeons,
# what fell off the roof; with our characters: the hotel's poster, the gig poster, the Employee of the Month, the Wall of Shame)
# are read from $ROOF_GEN (default $VENUE_WORK/gen).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/roof-work}"
GEN="${ROOF_GEN:-$WORK/gen}"
export ROOF_GEN="$GEN" VENUE_WORK="$WORK"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3.13 python3.12 python3 /usr/bin/python3 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image; import numpy" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/roof/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/roof_textures.py"
"$PY" "$HERE/painted.py" "$GEN" "$WORK"
"$PY" "$HERE/signs.py"
for s in shell props_furniture props_stories; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
# (16-bit positions: the roof runs 34 m end to end and the cradle's jib reaches 8 m up)
VENUE_VP=16 "$COMMON/pack.sh" roof "$REPO/dist/assets/roof-club"
