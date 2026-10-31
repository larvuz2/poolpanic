#!/usr/bin/env bash
# Packs a dressed venue for the three.js game (dist/assets/<venue>/), after common/export_three.py:
# - the mesh: quantized by gltfpack (-kv: the UVs and colours stay, -vtf: the UVs as floats, since the game draws its own
#   materials and a quantized UV needs the file's texture transform to be read; KHR_mesh_quantization, which three.js's GLTFLoader reads by
#   itself; no meshopt compression, whose decoder needs WebAssembly, which the desktop app's page does not allow);
# - the pictures as WebP: the tile sets (albedo, normal), the two atlases, the deck's paint and its baked shadows.
#   tools/venues/common/pack.sh <venue> [out_dir]      (venue: splash, kids, ...; its work in $VENUE_WORK or /tmp/<venue>-work)
# Needs: npx (Node), ImageMagick with WebP (convert).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
NAME="${1:?which venue? pack.sh <venue> [out_dir]}"
WORK="${VENUE_WORK:-/tmp/$NAME-work}"
OUT="${2:-$REPO/dist/assets/$NAME}"
TEX="$WORK/textures"
mkdir -p "$OUT"
# (every picture but the horizon, which is made once by the venue's horizon.sh)
find "$OUT" -name "*.webp" ! -name "horizon.webp" -delete

npx --yes gltfpack@1.3.0 -i "$WORK/out/$NAME.raw.glb" -o "$OUT/$NAME.glb" -kn -km -kv -vtf
cp "$WORK/out/$NAME.json" "$OUT/$NAME.json"

webp() { # webp <in> <max size> <quality> <out> [extra convert options]
  local in="$1" size="$2" q="$3" out="$4"
  shift 4
  convert "$in" -resize "${size}>" "$@" -quality "$q" -define webp:method=6 "$out"
}
# the tile sets the model uses (<venue>.json `tiles`): the ones it calls sharp (the deck, the basin: they fill the screen) at
# 1024, the rest lighter
SHARP=" $(node -e "console.log((require('$WORK/out/$NAME.json').sharp || []).join(' '))") "
for t in $(node -e "console.log(Object.keys(require('$WORK/out/$NAME.json').tiles).join(' '))"); do
  case "$SHARP" in
    *" $t "*) a=1024 n=512 ;;
    *) a=512 n=256 ;;
  esac
  webp "$TEX/${t}_albedo.png" ${a}x${a} 84 "$OUT/${t}.webp"
  webp "$TEX/${t}_normal.png" ${n}x${n} 90 "$OUT/${t}_n.webp"
done
[ -f "$WORK/out/atlas_signs.png" ] && webp "$WORK/out/atlas_signs.png" 2048x2048 86 "$OUT/atlas_signs.webp"
[ -f "$WORK/out/atlas_cut.png" ] && webp "$WORK/out/atlas_cut.png" 1024x1024 90 "$OUT/atlas_cut.webp" -define webp:alpha-quality=95
webp "$WORK/out/floor_paint.png" 2048x2048 88 "$OUT/floor_paint.webp" -define webp:alpha-quality=95
# (a touch of blur hides the bake's noise)
webp "$WORK/out/floor_ao.png" 1024x1024 86 "$OUT/floor_ao.webp" -colorspace Gray -blur 0x1.2
du -ch "$OUT"/* | sort -h | tail -30
