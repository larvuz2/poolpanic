#!/usr/bin/env bash
# The Kids Pool's horizon (31 October 2026): a cheerful seaside town painted once on fal (google/nano-banana-2.1, 4:1, 4K) from the
# prompt below, keyed and cropped by tools/venues/common/horizon.sh into dist/assets/kids/horizon.webp.
#
#   tools/venues/kids/horizon.sh <the generated PNG>
#
# The prompt: "A seamless wide panoramic landscape backdrop for a stylized 3D video game, painted in a soft painterly toon style
# with clean shapes and gentle gradients (like a Pixar matte painting). A cheerful seaside town seen from a children's pool on a
# sunny morning: in the foreground band, rolling green hills with leafy round trees, hedges and a few palm trees; in the middle
# distance a colourful harbour town of pastel houses (pink, yellow, mint, sky blue) with red and white roofs stepping down to a
# blue bay with small sailing boats, a red-and-white striped lighthouse on a headland, and a pier with a big Ferris wheel and a
# helter-skelter; behind, soft blue-green hills fading into atmospheric haze. The landscape fills only the bottom half of the
# image, its skyline gently rising and falling across the whole width. The sky above the landscape is a completely flat, plain,
# pure white (#FFFFFF), with no clouds, no sun, no birds, no gradient. Even soft daylight, no strong cast shadows, no people, no
# text, no frame. The left and right edges match in height so it can wrap around."
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/../common/horizon.sh" "$1" "$HERE/../../../dist/assets/kids/horizon.webp"
