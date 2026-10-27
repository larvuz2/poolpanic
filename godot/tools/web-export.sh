#!/usr/bin/env bash
# Exports the web build (godot/build/web/: index.html, .wasm, .pck) for a browser and for the Netlify site's engine choice.
# A browser downloads the whole game before it starts, so the export is made from a copy of the project whose textures are
# lighter (tools/web-textures.py: one desktop format, S3TC, and the big tiling sets at 512 px), and the venue then draws with
# the Compatibility renderer (WebGL 2), which club_scene.gd dresses with its own light (see "The web build", godot/README.md).
# The desktop builds are untouched. Needs godot/tools/install-godot.sh --templates.
#   godot/tools/web-export.sh                  # build/web
#   WEB_WORK=/some/dir godot/tools/web-export.sh  # keep the copy (and its import cache) there between runs
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-${GODOT_HOME:-$HOME/.cache/poolpanic-godot}/godot}"
WORK="${WEB_WORK:-${TMPDIR:-/tmp}/poolpanic-godot-web}"
mkdir -p "$WORK"
# The copy: everything but the import cache and the builds (its own import cache stays, so a second run imports only changes).
find "$WORK" -mindepth 1 -maxdepth 1 ! -name .godot -exec rm -rf {} +
for item in "$HERE"/* "$HERE"/.gitignore; do
  case "$(basename "$item")" in build) continue ;; esac
  cp -a "$item" "$WORK/"
done
python3 "$HERE/tools/web-textures.py" "$WORK"
"$GODOT" --headless --path "$WORK" --import 2>&1 | grep -E "ERROR|SCRIPT ERROR" && { echo "web import failed"; exit 1; } || true
rm -rf "$HERE/build/web"
mkdir -p "$HERE/build/web"
touch "$HERE/build/.gdignore" # (so the editor never imports the builds as part of the project)
"$GODOT" --headless --path "$WORK" --export-release Web "$HERE/build/web/index.html" 2>&1 | tee "$WORK/export.log" | grep -E "ERROR" && {
  echo "web export failed"
  exit 1
} || true
test -s "$HERE/build/web/index.pck" || { echo "web export wrote no .pck"; exit 1; }
ls -la "$HERE/build/web"
