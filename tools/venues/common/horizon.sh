#!/usr/bin/env bash
# A dressed venue's horizon: a painted panorama generated once on fal (4:1, 4K, its sky a plain white: the venue's horizon.sh
# keeps the prompt), its sky keyed out (flood-filled from the corner, the edge eaten 2 px against a halo), cropped to the band
# the landscape fills and saved 4096 wide as the venue's dist/assets/<venue>/horizon.webp, which the game wraps round the venue
# (scene/dressed.mjs `horizonRing`). The source picture's link expires: the WebP is the asset.
#
#   tools/venues/common/horizon.sh <the generated PNG> <out.webp>
set -euo pipefail
SRC="$1"
OUT="$2"
TMP="$(mktemp -d)"
convert "$SRC" -alpha set -fuzz 6% -fill none -draw "matte 4,4 floodfill" -channel A -morphology Erode Disk:2 -blur 0x1 +channel "$TMP/keyed.png"
# the landscape's band: from its highest point to the bottom (the alpha's bounding box)
W=$(identify -format "%w" "$TMP/keyed.png")
TOP=$(convert "$TMP/keyed.png" -alpha extract -threshold 50% -format "%@" info: | sed -E 's/^[0-9]+x[0-9]+\+[0-9]+\+([0-9]+)$/\1/')
H=$(($(identify -format "%h" "$TMP/keyed.png") - TOP))
convert "$TMP/keyed.png" -crop "${W}x${H}+0+${TOP}" +repage -resize 4096x -background none "$TMP/horizon.png"
convert "$TMP/horizon.png" -quality 86 -define webp:alpha-quality=90 -define webp:method=6 "$OUT"
identify -format "%f %wx%h\n" "$TMP/horizon.png"
rm -rf "$TMP"
ls -la "$OUT"
