#!/usr/bin/env bash
# Packs the Harbourside for the three.js game (dist/assets/club/), after godot/tools/blender/three_club.py:
# - the mesh: quantized by gltfpack (-kv: the UVs and colours stay, though no texture in the file uses them; -vtf: the UVs
#   as floats, the tiles' world scale kept (quantized, they would need a texture transform the game never reads); KHR_mesh_quantization, which three.js's GLTFLoader reads by itself; no meshopt compression,
#   whose decoder needs WebAssembly, which the desktop app's page does not allow);
# - the pictures as WebP: the tile sets (albedo, normal), the sign atlases, the floor's paint, the mural and the baked shadows.
#   godot/tools/three-club-pack.sh [out_dir]
# Needs: npx (Node), ImageMagick with WebP (convert).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)" # godot/
REPO="$(cd "$HERE/.." && pwd)"
WORK="${THREE_CLUB_WORK:-/tmp/three-club}"
OUT="${1:-$REPO/dist/assets/club}"
TEX="$HERE/assets/textures"
mkdir -p "$OUT"

npx --yes gltfpack@1.3.0 -i "$WORK/harbourside.raw.glb" -o "$OUT/harbourside.glb" -kn -km -kv -vtf
cp "$WORK/harbourside.json" "$OUT/harbourside.json"

webp() { # webp <in> <max size> <quality> <out> [extra convert options]
  local in="$1" size="$2" q="$3" out="$4"
  shift 4
  convert "$in" -resize "${size}>" "$@" -quality "$q" -define webp:method=6 "$out"
}
# the tile sets: the deck and the pool's mosaic sharper (they fill the screen), the walls lighter
for t in deck_tile pool_mosaic; do
  webp "$TEX/${t}_albedo.png" 1024x1024 84 "$OUT/${t}.webp"
  webp "$TEX/${t}_normal.png" 512x512 90 "$OUT/${t}_n.webp"
done
for t in wall_sea wall_navy wall_cream plaster timber; do
  webp "$TEX/${t}_albedo.png" 512x512 84 "$OUT/${t}.webp"
  webp "$TEX/${t}_normal.png" 256x256 90 "$OUT/${t}_n.webp"
done
webp "$WORK/atlas_signs.png" 2048x2048 86 "$OUT/atlas_signs.webp"
webp "$WORK/atlas_cut.png" 1024x1024 90 "$OUT/atlas_cut.webp" -define webp:alpha-quality=95
webp "$WORK/floor_paint.png" 2048x2048 88 "$OUT/floor_paint.webp" -define webp:alpha-quality=95
webp "$WORK/mural.png" 2048x2048 86 "$OUT/mural.webp"
# (a touch of blur hides the bake's noise)
webp "$WORK/floor_ao.png" 1024x1024 86 "$OUT/floor_ao.webp" -colorspace Gray -blur 0x1.2
du -ch "$OUT"/* | sort -h | tail -30
