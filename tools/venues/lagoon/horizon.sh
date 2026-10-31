#!/usr/bin/env bash
# The Sunset Lagoon's horizon (31 October 2026): a tropical island coast painted once on fal (fal-ai/nano-banana-2.1, 4:1, 4K) from
# the prompt below, keyed and cropped by tools/venues/common/horizon.sh into dist/assets/lagoon/horizon.webp. The game hangs it on an
# arc round the land sides only (the sea side is the game's own sea, lighthouse and boats: scene/sky.mjs) and tints it with the hour.
#
#   tools/venues/lagoon/horizon.sh <the generated PNG>
#
# The prompt: "A seamless wide panoramic landscape backdrop for a stylized 3D video game, painted in a soft painterly toon style
# with clean shapes and gentle gradients (like a Pixar matte painting). A tropical island coast seen from a beach club on a lagoon:
# in the foreground band, low sand dunes with beach grass, dense groves of tall coconut palms and lush tropical bushes; in the
# middle distance green jungle-covered hills with a few thatched-roof bungalows on stilts and a small wooden village tucked among
# the palms; behind, dramatic volcanic peaks with steep green ridges and a waterfall, fading into atmospheric haze. The landscape
# fills only the bottom half of the image, its skyline gently rising and falling across the whole width. The sky above the
# landscape is a completely flat, plain, pure white (#FFFFFF), with no clouds, no sun, no birds, no gradient. Even soft neutral
# daylight, no strong cast shadows, no sunset colours, no people, no text, no frame. The left and right edges match in height so
# it can wrap around."
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/../common/horizon.sh" "$1" "$HERE/../../../dist/assets/lagoon/horizon.webp"
