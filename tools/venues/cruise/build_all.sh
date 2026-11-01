#!/usr/bin/env bash
# Every step of the Cruise Ship's assets, into dist/assets/cruise-club/ (tools/venues/cruise/README.md). Needs Blender 4.5, Node,
# python3 with Pillow and numpy and ImageMagick. The pictures made once on fal (README: the eight materials, the horizon, the kraken,
# the travel poster, the photo board, Captain Barnacle, the deck plan, the towel animals, the seagulls) are read from $CRUISE_GEN
# (default $VENUE_WORK/gen).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${VENUE_WORK:-/tmp/cruise-work}"
GEN="${CRUISE_GEN:-$WORK/gen}"
export CRUISE_GEN="$GEN" VENUE_WORK="$WORK"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3.13 python3.12 python3 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image; import numpy" 2>/dev/null; then PY="$p"; break; fi
done
# the game's own plan first: every place below is taken from it
(cd "$REPO" && node tools/venues/cruise/plan.mjs > "$WORK/plan.json")
blender -b -P "$HERE/cruise_textures.py"
"$PY" "$HERE/painted.py" "$GEN" "$WORK"
"$PY" "$HERE/signs.py"
"$COMMON/horizon.sh" "$GEN/horizon.png" "$REPO/dist/assets/cruise-club/horizon.webp"
for s in shell props_ship props_deck; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
# (16-bit positions: the ship runs 60 m from the stern to the funnel and 26 m down to the sea)
VENUE_VP=16 "$COMMON/pack.sh" cruise "$REPO/dist/assets/cruise-club"
