"""The Jumping Pool's painted pieces made once on fal (README: the prompts), made ready for the model (python3 with Pillow and
numpy), with the Cruise Ship's keying and cutting (tools/venues/cruise/painted.py: its helpers, read from there):
- the club's emblem for the pool's floor (1:1, on white: a walrus in a striped 1920s bathing suit mid swan dive, in a laurel
  wreath, in tiles) keyed into a cut-out from its edges and trimmed;
- the garden's creatures (3:2, a sheet of six on white: two peacocks, a mallard in swim goggles, a mallard, three ducklings (the biggest one kept: it is
  copied in a row), a rubber chicken) cut into their pieces by their blobs, each keyed and trimmed, named in reading order;
- the pictures with our characters in them (GPT Image 2.5, the coaches as the references): the Hall of Fame of belly flops, the
  club's poster (DIVE INTO SUMMER), Sir Reginald Splashworth's portrait, resized into the signs.

    python3 tools/venues/dive/painted.py <folder with the fal pictures> <work folder>
"""

import sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "..", "cruise", "painted.py")).read().split("# ---- the kraken")[0]
exec(compile(_src, "cruise/painted.py", "exec"))  # (flood, key_white, label, trim, fit, sheet; GEN and WORK from argv)

emblem, _ = key_white(Image.open(GEN + "/emblem.png"), tol=22)
fit(trim(emblem), 1024).save(WORK + "/textures/emblem_alpha.png")
sheet("critters.png", ["peacock_fan", "peacock_walk", "duck_goggles", "duck", "duckling", "rubber_chicken"], tol=12)
fit(Image.open(GEN + "/halloffame.png").convert("RGB"), 1024).save(WORK + "/signs/halloffame.png")
fit(Image.open(GEN + "/poster.png").convert("RGB"), 768).save(WORK + "/signs/poster.png")
fit(Image.open(GEN + "/founder.png").convert("RGB"), 768).save(WORK + "/signs/founder.png")
print("PAINTED", WORK)
