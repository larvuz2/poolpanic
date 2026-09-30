#!/usr/bin/env bash
# Installs headless Blender (Linux x64) into /opt/blender and the few system libraries it needs to render without a
# display. Safe to run again: it does nothing when `blender --version` already works. The sandbox is wiped between
# sessions, so a new session runs this once (about a minute) before using tools/blender/run.sh.
set -euo pipefail
VERSION="${BLENDER_VERSION:-4.5.14}"
SERIES="${VERSION%.*}"
if command -v blender >/dev/null 2>&1 && blender --background --version >/dev/null 2>&1; then
  echo "Blender already installed: $(blender --background --version | head -1)"
  exit 0
fi
if ! ldconfig -p | grep -q "libEGL.so.1"; then
  apt-get update -qq
  apt-get install -y --no-install-recommends libegl1 libgl1 libxkbcommon0 libxi6 libxrender1 libsm6 \
    libxxf86vm1 libxfixes3 libgomp1 libegl-mesa0 libgl1-mesa-dri libgbm1 >/dev/null
fi
mkdir -p /opt/blender
cd /opt/blender
TARBALL="blender-${VERSION}-linux-x64.tar.xz"
curl -fsS -O "https://download.blender.org/release/Blender${SERIES}/${TARBALL}"
tar xf "$TARBALL" && rm "$TARBALL"
ln -sfn "/opt/blender/blender-${VERSION}-linux-x64/blender" /usr/local/bin/blender
blender --background --version | head -1
