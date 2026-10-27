#!/usr/bin/env bash
# Rebuild every Blender asset of the Community Pool, in order: the textures, the building, the mural, the garden, the props.
# Each step is also runnable alone (blender -b -P godot/tools/blender/<script>.py). Needs Blender 4.5 (`blender` on PATH).
set -euo pipefail
cd "$(dirname "$0")"
for s in textures build_shell mural exterior props_pool props_floor props_stations props_lockers props_dressing; do
  echo "== $s"
  blender -b -P "$s.py" 2>&1 | grep -E "EXPORTED|TEXTURE|MURAL|Error|Traceback" || true
done
