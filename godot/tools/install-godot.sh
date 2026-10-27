#!/usr/bin/env bash
# Downloads the Godot editor this test is pinned to (Linux, x86-64), checks it against the official SHA-512 list, and puts it at
# $GODOT_HOME/godot (default ~/.cache/poolpanic-godot/godot). With --templates it also installs the export templates (about 1 GB),
# (the desktop ones only), which only exporting a build needs. Safe to run twice: it skips what is already there.
#   godot/tools/install-godot.sh              # the editor only
#   godot/tools/install-godot.sh --templates  # and the export templates
set -euo pipefail
VERSION="${GODOT_VERSION:-4.7.2}"
TAG="$VERSION-stable"
HOME_DIR="${GODOT_HOME:-$HOME/.cache/poolpanic-godot}"
BASE="https://github.com/godotengine/godot/releases/download/$TAG"
mkdir -p "$HOME_DIR"
cd "$HOME_DIR"
curl -fsSL -o SHA512-SUMS.txt "$BASE/SHA512-SUMS.txt"

fetch() { # fetch <file>: download it once and check its SHA-512
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Downloading $file"
    curl -fsSL --show-error --retry 4 -o "$file.part" "$BASE/$file"
    mv "$file.part" "$file"
  fi
  grep " $file\$" SHA512-SUMS.txt | sha512sum -c - >/dev/null || { echo "Checksum mismatch: $file"; rm -f "$file"; exit 1; }
}

ZIP="Godot_v${TAG}_linux.x86_64.zip"
fetch "$ZIP"
if [ ! -x godot ]; then
  unzip -oq "$ZIP"
  mv "Godot_v${TAG}_linux.x86_64" godot
fi
echo "Godot: $HOME_DIR/godot ($("$HOME_DIR/godot" --headless --version 2>/dev/null | tail -1))"

if [ "${1:-}" = "--templates" ]; then
  TPZ="Godot_v${TAG}_export_templates.tpz"
  fetch "$TPZ"
  DEST="$HOME/.local/share/godot/export_templates/$VERSION.stable"
  if [ ! -f "$DEST/version.txt" ]; then
    mkdir -p "$DEST"
    # (only the desktop templates this test exports: Windows, macOS and Linux, 64-bit; not the web, Android or iOS ones)
    unzip -oq "$TPZ" -d "$HOME_DIR/tpl" "templates/version.txt" "templates/linux_*.x86_64" \
      "templates/windows_*_x86_64.exe" "templates/macos.zip"
    mv "$HOME_DIR"/tpl/templates/* "$DEST"/
    rm -rf "$HOME_DIR/tpl"
  fi
  echo "Export templates: $DEST"
fi
