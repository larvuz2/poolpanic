#!/usr/bin/env bash
# Everything a round character (Carl, the leopard man) gets after retarget_clips.py, in the order that works:
#   tools/blender/round_character.sh retargeted.glb out.glb
# belly bones and the thighs off his back (Blender), the belly's motion in the six clips, arms and knees out of the body, the
# one-shot Cannonball (its tuck depth measured on the body), its arms out of the belly and its belly's motion, and the six
# other clips stood on the floor (not the Cannonball: it would be lifted by the depth he sinks). Details: "A character with a
# belly" in tools/blender/README.md.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 2 ] || { sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
in=$1
out=$2
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
CLIPS=IdleScan,IdleScratch,Panic,Run,Swim,Walk

tools/blender/run.sh tools/blender/belly_bones.py -- "$in" "$tmp/belly.glb" | grep -E "^(LEGS|BONE|WEIGHTS|BELLY)"
python3 tools/blender/belly_jiggle.py "$tmp/belly.glb" "$tmp/jiggle.glb"
python3 tools/blender/clear_limbs.py "$tmp/jiggle.glb" "$tmp/cleared.glb" --arm-max 62
python3 tools/blender/cannonball_clip.py "$tmp/cleared.glb" "$tmp/jump.glb"
python3 tools/blender/clear_limbs.py "$tmp/jump.glb" "$tmp/jump2.glb" --only Cannonball --oneshot Cannonball --arms-only Cannonball --arm-max 70
python3 tools/blender/belly_jiggle.py "$tmp/jump2.glb" "$tmp/jump3.glb" --only Cannonball --oneshot Cannonball
tools/blender/run.sh tools/blender/ground_clips.py -- "$tmp/jump3.glb" "$out" --only "$CLIPS" | grep -E "^(FLOOR|LIFT|GROUNDED)"
