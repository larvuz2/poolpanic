#!/usr/bin/env bash
# Senior Aqua Fit's pieces painted once on fal (fal-ai/nano-banana-2.1; the prompts are in tools/venues/senior/README.md), made ready
# for the model: the six club photographs (one sheet of 3 x 2 on a white ground) cut apart by their dark runs into signs/photo_1..6;
# the founder's portrait (3:4) resized into signs/founder.png; the swan for the pool's floor (1:1, on white) keyed into a cut-out from
# its four corners and its edges' middles. The horizon is made by common/horizon.sh (build_all.sh).
#   tools/venues/senior/painted.sh <folder with photos.png, founder.png and swan.png> <work folder>
set -euo pipefail
GEN="$1"
WORK="$2"
mkdir -p "$WORK/signs" "$WORK/textures"
PY=python3
for p in python3.13 python3.12 python3 python3.11; do
  if command -v "$p" >/dev/null && "$p" -c "from PIL import Image; import numpy" 2>/dev/null; then PY="$p"; break; fi
done
"$PY" - "$GEN" "$WORK" <<'PYEOF'
import sys
import numpy as np
from PIL import Image
gen, work = sys.argv[1], sys.argv[2]
im = Image.open(gen + "/photos.png").convert("RGB")
a = np.asarray(im).astype(int)
dark = a.min(axis=2) < 225
cols, rows = dark.mean(axis=0) > 0.15, dark.mean(axis=1) > 0.15


def runs(m):
    out, start = [], None
    for i, v in enumerate(m):
        if v and start is None:
            start = i
        if not v and start is not None:
            if i - start > 100:
                out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(m)))
    return out


k = 0
for y0, y1 in runs(rows):
    for x0, x1 in runs(cols):
        k += 1
        im.crop((x0, y0, x1, y1)).resize((512, 512)).save(f"{work}/signs/photo_{k}.png")
assert k == 6, f"{k} photographs found, not 6"
Image.open(gen + "/founder.png").convert("RGB").resize((768, 1024)).save(work + "/signs/founder.png")
PYEOF
S=$(identify -format %w "$GEN/swan.png")
E=$((S - 3))
M=$((S / 2))
convert "$GEN/swan.png" -alpha set -fuzz 3% -fill none \
  -draw "matte 2,2 floodfill" -draw "matte $E,2 floodfill" -draw "matte 2,$E floodfill" -draw "matte $E,$E floodfill" \
  -draw "matte $M,2 floodfill" -draw "matte $M,$E floodfill" -draw "matte 2,$M floodfill" -draw "matte $E,$M floodfill" \
  -channel A -morphology Erode Disk:1 +channel -trim +repage -resize 1024x1024 "$WORK/textures/swan_alpha.png"
