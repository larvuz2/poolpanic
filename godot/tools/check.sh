#!/usr/bin/env bash
# The Godot test's headless check: imports the project (the models, the fonts) and plays the scene for a few seconds with the coach
# walking by himself (`--smoke` in scripts/main.gd), failing on a script error or if he does not move. Needs Godot
# (godot/tools/install-godot.sh). Run from anywhere: godot/tools/check.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-${GODOT_HOME:-$HOME/.cache/poolpanic-godot}/godot}"
[ -x "$GODOT" ] || GODOT="$(command -v godot || true)"
[ -n "$GODOT" ] || { echo "No Godot: run godot/tools/install-godot.sh"; exit 1; }
LOG="$(mktemp)"
"$GODOT" --headless --path "$HERE" --import >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
# (--quit-after: a script that fails to load leaves Godot running an empty scene for ever)
"$GODOT" --headless --path "$HERE" --quit-after 1200 -- --smoke 2>&1 | tee -a "$LOG"
# Godot prints script errors without failing the run: fail on them here.
if grep -E "SCRIPT ERROR|Parse Error|ERROR:" "$LOG" | grep -v "^WARNING"; then
  echo "godot check: errors above"
  exit 1
fi
grep -q "SMOKE .* OK" "$LOG" || { echo "godot check: the smoke run did not pass"; exit 1; }
echo "godot check: OK"
