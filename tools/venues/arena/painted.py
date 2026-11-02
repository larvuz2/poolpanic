"""The Grand Gala Arena's painted pieces made once on fal (README: the prompts), made ready for the model (python3 with Pillow and
numpy), with the Cruise Ship's keying and cutting (tools/venues/cruise/painted.py: its helpers, read from there):
- the gala's emblem for the pool's floor (1:1, on white: a rubber duck in a bow tie and a crown holding up a trophy before a gold
  sunburst, in a laurel wreath, in glass mosaic) keyed into a cut-out from its edges and trimmed;
- the press pen and the bouquets (3:2, a sheet of six on white: a paparazzo duck with his camera, a reporter duck with her
  microphone, a duck in a bow tie clapping, a seal in a bow tie with a gold ball, a bouquet of red roses, a gold star balloon) cut
  into their pieces by their blobs, each keyed and trimmed, named in reading order;
- the pictures (GPT Image 2.5 with the coaches as the references: THE GRAND GALA poster, COACH OF THE YEAR · THE NOMINEES, the red
  carpet's photograph; and the flamingo's memorial portrait) resized into the signs, the flamingo cut to its frame.

    python3 tools/venues/arena/painted.py <folder with the fal pictures> <work folder>
"""

import sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "..", "cruise", "painted.py")).read().split("# ---- the kraken")[0]
exec(compile(_src, "cruise/painted.py", "exec"))  # (flood, key_white, label, trim, fit, sheet; GEN and WORK from argv)

emblem, _ = key_white(Image.open(GEN + "/emblem.png"), tol=22)
fit(trim(emblem), 1024).save(WORK + "/textures/emblem_alpha.png")
sheet("critters.png", ["duck_paparazzo", "duck_reporter", "duck_clap", "seal", "roses", "star_balloon"], tol=12)
fit(Image.open(GEN + "/poster.png").convert("RGB"), 768).save(WORK + "/signs/poster.png")
fit(Image.open(GEN + "/nominees.png").convert("RGB"), 1024).save(WORK + "/signs/nominees.png")
fit(Image.open(GEN + "/redcarpet.png").convert("RGB"), 1024).save(WORK + "/signs/redcarpet.png")
fl = Image.open(GEN + "/flamingo.png").convert("RGB")
w, h = fl.size
fit(fl.crop((int(0.03 * w), int(0.12 * h), int(0.97 * w), int(0.97 * h))), 640).save(WORK + "/signs/flamingo.png")
print("PAINTED", WORK)
