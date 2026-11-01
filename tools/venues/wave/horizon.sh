#!/usr/bin/env bash
# The Wave Pool's horizon (1 November 2026): a sunny surf coast painted once on fal (fal-ai/nano-banana-2.1, 4:1, 4K) from the prompt
# below, keyed and cropped by tools/venues/common/horizon.sh into dist/assets/wave-club/horizon.webp. The game hangs it on an arc
# round three sides (the near side is the game's own sea, lighthouse and boats: scene/sky.mjs `surf`) and tints it with the look.
#
#   tools/venues/wave/horizon.sh <the generated PNG>
#
# The prompt: "A seamless wide panoramic landscape backdrop for a stylized 3D video game, painted in a soft painterly toon style with
# clean shapes and gentle gradients (like a Pixar matte painting). A sunny tropical surf coast seen from inside a retro surf park: in
# the foreground band, sand dunes with beach grass, sea-grape bushes, bright hibiscus shrubs and dense groves of tall leaning coconut
# palms; in the middle distance a cheerful little surf town of pastel bungalows, a white chapel, a striped water tower, a retro motel
# sign shape without letters, more palms, and green hills; behind, dramatic green volcanic mountains with steep ridges, a waterfall
# and a soft cloud cap on one peak, fading into warm atmospheric haze. The landscape fills only the bottom half of the image, its
# skyline gently rising and falling across the whole width. The sky above the landscape is a completely flat, plain, pure white
# (#FFFFFF), with no clouds, no sun, no birds, no gradient. Warm late-afternoon light from the left, no people, no text, no frame.
# The left and right edges match in height so it can wrap around."
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/../common/horizon.sh" "$1" "$HERE/../../../dist/assets/wave-club/horizon.webp"
