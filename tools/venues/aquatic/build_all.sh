#!/usr/bin/env bash
# Every step of the Aquatic Centre's assets, into dist/assets/aquatic/ (tools/venues/aquatic/README.md). Needs Blender 4.5, python3 with
# Pillow, npx and ImageMagick.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMMON="$HERE/../common"
PY=python3
for p in python3 python3.13 python3.12 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image" 2>/dev/null; then PY="$p"; break; fi
done
blender -b -P "$HERE/aquatic_textures.py"
"$PY" "$HERE/signs.py"
for s in shell props_doors props_stations props_meet; do blender -b -P "$HERE/$s.py"; done
blender -b -P "$COMMON/export_three.py" -- "$HERE"
"$COMMON/pack.sh" aquatic
