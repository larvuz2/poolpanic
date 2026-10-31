#!/usr/bin/env bash
# Packs Splash Park for the three.js game (dist/assets/splash/), after export_three.py:
# - the mesh: quantized by gltfpack (-kv: the UVs and colours stay, -vtf: the UVs as floats, since the game draws its own
#   materials and a quantized UV needs the file's texture transform to be read; KHR_mesh_quantization, which three.js's GLTFLoader reads by
#   itself; no meshopt compression, whose decoder needs WebAssembly, which the desktop app's page does not allow);
# - the pictures as WebP: the tile sets (albedo, normal), the two atlases, the deck's paint and its baked shadows.
#   tools/venues/splash/pack.sh [out_dir]
# Needs: npx (Node), ImageMagick with WebP (convert).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${SPLASH_WORK:-/tmp/splash-work}"
OUT="${1:-$REPO/dist/assets/splash}"
TEX="$WORK/textures"
mkdir -p "$OUT"
rm -f "$OUT"/*.webp

npx --yes gltfpack@1.3.0 -i "$WORK/out/splash.raw.glb" -o "$OUT/splash.glb" -kn -km -kv -vtf
cp "$WORK/out/splash.json" "$OUT/splash.json"

webp() { # webp <in> <max size> <quality> <out> [extra convert options]
  local in="$1" size="$2" q="$3" out="$4"
  shift 4
  convert "$in" -resize "${size}>" "$@" -quality "$q" -define webp:method=6 "$out"
}
# the tile sets the model uses (splash.json `tiles`): the deck and the basin sharper (they fill the screen), the rest lighter
for t in $(node -e "console.log(Object.keys(require('$WORK/out/splash.json').tiles).join(' '))"); do
  case "$t" in
    travertine | glass_mosaic) a=1024 n=512 ;;
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
