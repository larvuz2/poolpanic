#!/usr/bin/env bash
# The Wave Pool's two pieces painted once on fal (fal-ai/nano-banana-2.1; the prompts are in tools/venues/wave/README.md), made
# ready for the model: the mural (21:9) cropped of its painted border into the signs; the octopus (1:1, on white) keyed into a cut-out
# from its four corners and its edges' middles, its one enclosed white patch cleared (the white grout inside the octopus stays).
#   tools/venues/wave/painted.sh <folder with mural.png and octopus.png> <work folder>
set -euo pipefail
GEN="$1"
WORK="$2"
W=$(identify -format %w "$GEN/mural.png")
H=$(identify -format %h "$GEN/mural.png")
convert "$GEN/mural.png" -gravity center -crop $((W * 97 / 100))x$((H * 94 / 100))+0+0 +repage -resize 2048x "$WORK/signs/mural.png"
S=$(identify -format %w "$GEN/octopus.png")
E=$((S - 3))
M=$((S / 2))
convert "$GEN/octopus.png" -alpha set -fuzz 7% -fill none \
  -draw "matte 2,2 floodfill" -draw "matte $E,2 floodfill" -draw "matte 2,$E floodfill" -draw "matte $E,$E floodfill" \
  -draw "matte $M,2 floodfill" -draw "matte $M,$E floodfill" -draw "matte 2,$M floodfill" -draw "matte $E,$M floodfill" \
  -channel A -morphology Erode Disk:1.5 +channel -trim +repage -resize 1024x1024 "$WORK/textures/octopus_alpha.png"
# (an arm curls round a patch of white the corners cannot reach: any large near-white island left goes too)
PY=python3
for p in python3 python3.13 python3.12 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image" 2>/dev/null; then PY="$p"; break; fi
done
"$PY" - "$WORK/textures/octopus_alpha.png" <<'PYEOF'
import sys, collections
from PIL import Image
path = sys.argv[1]
im = Image.open(path).convert("RGBA")
W, H = im.size
px = im.load()
seen = set()
for y in range(0, H, 3):
    for x in range(0, W, 3):
        r, g, b, a = px[x, y]
        if a > 200 and min(r, g, b) > 232 and (x, y) not in seen:
            q, reg = collections.deque([(x, y)]), []
            seen.add((x, y))
            while q:
                cx, cy = q.popleft()
                reg.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen:
                        r2, g2, b2, a2 = px[nx, ny]
                        if a2 > 200 and min(r2, g2, b2) > 225:
                            seen.add((nx, ny))
                            q.append((nx, ny))
            if len(reg) > 1500:
                for p in reg:
                    px[p] = (0, 0, 0, 0)
im.save(path)
PYEOF
