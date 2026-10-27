#!/usr/bin/env bash
# Renders pictures of the Godot test with its real renderer (Forward+, Vulkan in software under a virtual screen), for looking at
# the venue where there is no graphics card: slow, and a real card may differ a little (say so when showing them).
#   godot/tools/render.sh <out.png> [--wait=<frames>] [--cam=x,y,z,tx,ty,tz] [--size=1280x720]
# Needs: godot/tools/install-godot.sh, and once: apt-get install -y mesa-vulkan-drivers xvfb
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-${GODOT_HOME:-$HOME/.cache/poolpanic-godot}/godot}"
OUT="$1"; shift
SIZE="1280x720"
ARGS=()
for a in "$@"; do
  case "$a" in
    --size=*) SIZE="${a#--size=}" ;;
    *) ARGS+=("$a") ;;
  esac
done
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a -s "-screen 0 ${SIZE}x24" \
  "$GODOT" --path "$HERE" --resolution "$SIZE" -- --shot="$OUT" "${ARGS[@]}" 2>&1 | grep -vE "^ALSA|audio|^\s+at:|^$|Condition \"status < 0\"" || true
