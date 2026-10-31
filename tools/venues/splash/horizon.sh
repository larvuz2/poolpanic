#!/usr/bin/env bash
# Splash Park's horizon (31 October 2026, the creator: "behind the trees, there's nothing… add some landscape… mountains in the
# back and some clouds"): a painted Mediterranean panorama, generated once on fal (google/nano-banana-2.1, 4:1, 4K) from the
# prompt below, its plain white sky keyed out, cropped to the landscape and saved as dist/assets/splash/horizon.webp, which the
# game wraps round the park (scene/splashpark.mjs `horizon`). The source picture's link expires: the WebP is the asset.
#
#   tools/venues/splash/horizon.sh <the generated PNG>
#
# The prompt: "A seamless wide panoramic landscape backdrop for a stylized 3D video game, painted in a soft painterly toon style
# with clean shapes and gentle gradients (like a Pixar matte painting). Mediterranean countryside seen from a hotel pool at
# midday: in the foreground band, rolling green hills with rows of silvery olive trees, dark cypress trees and umbrella pines; in
# the middle distance a whitewashed hilltop village with terracotta roofs and a small bell tower, a few red-roofed villas
# scattered on the slopes; behind, layered blue-violet mountain ridges fading into atmospheric haze. The landscape fills only the
# bottom half of the image, its skyline gently rising and falling across the whole width. The sky above the landscape is a
# completely flat, plain, pure white (#FFFFFF), with no clouds, no sun, no birds, no gradient. Even soft daylight, no strong
# cast shadows, no people, no text, no frame. The left and right edges match in height so it can wrap around."
set -euo pipefail
SRC="$1"
OUT="$(cd "$(dirname "$0")/../../.." && pwd)/dist/assets/splash/horizon.webp"
TMP="$(mktemp -d)"
# the sky, flood-filled from its corner (the village's white walls are not touching it), its edge eaten in 2 px against a halo
convert "$SRC" -alpha set -fuzz 6% -fill none -draw "matte 4,4 floodfill" -channel A -morphology Erode Disk:2 -blur 0x1 +channel "$TMP/keyed.png"
# the landscape's band (an 8256 x 2048 picture: its skyline never rises above row 808), 4096 wide
convert "$TMP/keyed.png" -crop 8256x1240+0+808 +repage -resize 4096x -background none "$TMP/horizon.png"
convert "$TMP/horizon.png" -quality 86 -define webp:alpha-quality=90 -define webp:method=6 "$OUT"
rm -rf "$TMP"
ls -la "$OUT"
