#!/usr/bin/env bash
# Every step of Splash Park's assets, into dist/assets/splash/ (tools/venues/splash/README.md). Needs Blender 4.5, python3 with
# Pillow, npx and ImageMagick. About five minutes on four cores.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PY=python3
for p in python3 python3.13 python3.12 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image" 2>/dev/null; then PY="$p"; break; fi
done
blender -b -P "$HERE/splash_textures.py"
"$PY" "$HERE/signs.py"
for s in shell garden props_doors props_stations props_lounge; do blender -b -P "$HERE/$s.py"; done
SPLASH_DECIMATE='{"lounge":0.55,"stations":0.55}' blender -b -P "$HERE/export_three.py"
"$HERE/pack.sh"
