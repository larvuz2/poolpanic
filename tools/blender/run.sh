#!/usr/bin/env bash
# Runs a Python script inside headless Blender: tools/blender/run.sh SCRIPT.py [-- script args...]
# Example: tools/blender/run.sh tools/blender/inspect_model.py -- model.glb
set -euo pipefail
script="$1"; shift
[ "${1:-}" = "--" ] && shift
exec blender --background --factory-startup --python "$script" -- "$@" 2> >(grep -v "EGL Error (0x3009)" >&2)
