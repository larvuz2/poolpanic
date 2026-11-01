"""The Rooftop Pool's painted pieces made once on fal (README: the prompts), made ready for the model (python3 with Pillow and
numpy), with the Cruise Ship's keying and cutting (tools/venues/cruise/painted.py: its helpers, read from there):
- the hotel's emblem for the pool's floor (1:1, on white: a pigeon in gold aviators on a flamingo float, in glass tiles) keyed into
  a cut-out from its edges and trimmed;
- the pigeons and the things dropped off the roof (3:2 sheets of six, on white) cut into their pieces by their blobs, each keyed
  and trimmed, named in reading order;
- the pictures with our characters in them (GPT Image 2.5, Coach Waters, Coach Brooks, Coach Rivers and Coach Storm as the
  references): HOTEL VERTIGO's poster, DJ SPLASH's gig poster, the Employee of the Month, the Wall of Shame, resized into the signs.

    python3 tools/venues/roof/painted.py <folder with the fal pictures> <work folder>
"""

import sys, os
from PIL import ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "..", "cruise", "painted.py")).read().split("# ---- the kraken")[0]
exec(compile(_src, "cruise/painted.py", "exec"))  # (flood, key_white, label, trim, fit, sheet; GEN and WORK from argv)

# ---- the emblem on the pool's floor ------------------------------------------------------------------------------------------
emblem, _ = key_white(Image.open(GEN + "/emblem.png"), tol=22)
fit(trim(emblem), 1024).save(WORK + "/textures/emblem_alpha.png")
# ---- the pigeons and what fell off the roof ----------------------------------------------------------------------------------
sheet("pigeons.png", ["pigeon_bling", "pigeon_cherry", "pigeon_asleep", "pigeon_vip", "pigeon_dance", "pigeon_brolly"], tol=10)
sheet("dropped.png", ["drop_phone", "drop_flipflop", "drop_hat", "drop_toupee", "drop_duck", "drop_stick"], tol=10)
# ---- the posters, the employee of the month, the wall of shame ----------------------------------------------------------------
fit(Image.open(GEN + "/poster.png").convert("RGB"), 768).save(WORK + "/signs/poster.png")
fit(Image.open(GEN + "/gig.png").convert("RGB"), 768).save(WORK + "/signs/gig.png")
fit(Image.open(GEN + "/employee.png").convert("RGB"), 640).save(WORK + "/signs/employee.png")
fit(Image.open(GEN + "/shame.png").convert("RGB"), 1024).save(WORK + "/signs/shame.png")
print("PAINTED", WORK)
# ---- the phone net's mesh (drawn here: a diamond mesh of tarred rope, its holes clear; 1.3 m by 6.5 m, one picture) ---------------
NW, NH, STEP = 256, 1280, 24
net = Image.new("RGBA", (NW, NH), (0, 0, 0, 0))
dn = ImageDraw.Draw(net)
for k in range(-NH // STEP - 2, NW // STEP + NH // STEP + 2):
    x0 = k * STEP
    dn.line([(x0, 0), (x0 + NH, NH)], fill=(52, 50, 45, 255), width=4)
    dn.line([(x0, NH), (x0 + NH, 0)], fill=(52, 50, 45, 255), width=4)
dn.rectangle((0, 0, NW - 1, NH - 1), outline=(40, 38, 34, 255), width=8)
net.save(WORK + "/textures/net_alpha.png")
print("NET", WORK)
