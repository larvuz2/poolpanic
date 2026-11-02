# The Jumping Pool's assets (three.js)

The scripts that make the Jumping Pool's dressed look for the three.js game (`dist/scene/diveclub.mjs`, README "The Jumping Pool
dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from the game's own plan:
`plan.mjs` writes it (the deep pool and its ladders, the six boards with their stairs and lines, the stations' blocks, the hot tub
and its steps, the massage beds, the gates, the walkers' blocks, the queue, the evacuation spots, the furniture, stations and
fixtures, the rings' mounts) from `dist/spatial.mjs` and `dist/dive-plan.mjs` into the work folder, and `kit.py` reads it.

**The Splashworth Country Club** (est. 1927) on a bright summer's day. What moves stays the game's: the pool's water, the
springboards' planks (they bend), the hot tub's water, glow and steam, the gates' picket leaves (they swing), the club's flag, the
boards' and the tub's pick volumes, highlights and rims, the landing rings, the divers, the massage beds; the life rings and the
torch at their anchors as before.

    tools/venues/dive/build_all.sh        # every step below, into dist/assets/dive-club/

**Its materials are photographic.** Seven were painted once on fal for this pool (the prompts below) and five are the Rooftop
Pool's (`tools/venues/roof/README.md`: the travertine, the marble, the concrete, the teak, the linen); `dive_textures.py` makes
them seamless the Rooftop Pool's way: a thin blending band at the edges; the lawn's only top to bottom so its mowing stripes stay
whole, its shading taken out row by row; the majolica's one tile cut whole from the picture's row of four (a tile a repeat, its
band on the pool's walls aligned to the tiles' grid); the teak's boards staggered. Each gets a normal map from its own relief.

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `dive_textures.py` (Blender's numpy) | travertine, cobalt mosaic, majolica, marble, concrete, teak, lawn, box hedge, render, roof tiles, striped awning, linen (each with its normal map); palm fronds |
| The painted pieces | `painted.py` (python3 with Pillow and numpy; the Cruise Ship's keying and cutting) | the walrus emblem keyed into a cut-out; the peacocks, the ducks and the rubber chicken cut apart; the pictures with our characters into the signs |
| Signs | `signs.py` (python3 with Pillow) | racing green enamel with brass rims: SPLASHWORTH COUNTRY CLUB, the diving rules, the CHICKEN-OUT ZONE, the SPLASH-O-METER's dial, JUDGES and the scorecards, SPLASH ZONE, RELAX · MASSAGE, HOT TUB · MAX 6, the founder's plaque, HALL OF FAME, LIFEGUARD, TOWELS & FINS, BEWARE OF THE PEACOCKS, the heights' signs and the platforms' fronts, the stations' boards, the depth plates, the floor's stencils |
| The shell | `shell.py` | the lawns, the travertine deck, the pool (mosaic, the majolica band, marble coping, lamps, the boards' target rings, the walrus, ladders, depth plates), the massage corner's tiles; `floor.glb`: the deck's paint |
| The stations | `props_towers.py` | the springboards' stands, the platforms and the HIGH tower, their stairs and signs, the hot tub's cabinet, the massage shelf, the stations and fixtures (`LifeRing`, `Flashlight`), the bench, the towel cart, the lifeguard's chair, the planters, the loungers and parasols |
| The garden | `props_garden.py` | the hedges, the gates' posts and rose arches, flower beds, trees, the clubhouse (its roof, colonnade, windows, awnings, clock, flagpole, the founder's portrait, the posters), the terrace, the croquet lawn |
| The stories | `props_stories.py` | the CHICKEN-OUT ZONE, the judges' table, the SPLASH-O-METER, the HALL OF FAME, the poncho stand, the posters and rules by the gates, the peacocks and the ducks |
| Export | `../common/export_three.py -- tools/venues/dive` | one mesh per material class, the sign and cut-out atlases, the floor's paint and occlusion, `dive.json` |
| Pack | `../common/pack.sh dive dist/assets/dive-club` | `dist/assets/dive-club/` |

The pictures made once on fal, kept in `$DIVE_GEN` (default the work folder's `gen/`; their links expire, so the results live in
the model's pictures). The materials and the art with `fal-ai/nano-banana-2.1` (2K):

- **The mosaic**: "Seamless tileable texture, straight front-on orthographic view, flat even lighting: the lining of a classic
  diving pool in small square glass mosaic tiles, about 24 tiles across, a rich mix of cobalt blue, azure, cerulean and a few pale
  sky-blue and white tiles at random, each tile with a glassy sheen and uneven glaze, thin pale grey grout lines. Photographic PBR
  material texture for a video game, fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The majolica** (4:1): "Seamless horizontally tileable strip texture, straight front-on orthographic view, flat even lighting:
  a single row of hand-painted Mediterranean majolica ceramic border tiles for a swimming pool's waterline, exactly four square
  tiles side by side filling the frame, each with the same bold pattern of a terracotta and saffron yellow diamond with a teal
  flower in its centre and cobalt blue corners on a cream glaze, slightly uneven glossy glaze, thin cream grout lines between the
  tiles. …"
- **The lawn**: "… straight top-down orthographic view, flat even overcast lighting, no shadows, no perspective: a perfectly
  manicured country club lawn, short dense bright green grass, two broad mowing stripes of lighter and darker green running
  vertically, a few tiny clover leaves and daisies. …"
- **The hedge**: "… the side of a dense neatly clipped boxwood hedge, thousands of small glossy dark and bright green leaves, a few
  tiny twigs and darker hollows, crisp and lush. …"
- **The render**: "… the smooth lime-washed render of an elegant Georgian country club building, warm cream white with soft
  chalky mottling, faint trowel marks, very clean, no cracks, no joints. …"
- **The roof tiles**: "… a roof of curved terracotta clay roof tiles in neat overlapping rows, exactly six tiles across and six
  rows down, warm orange-red with sun-faded patches and a little lichen, crisp shadows between the rows. …"
- **The awning**: "… heavy woven cotton awning canvas with bold vertical stripes of deep racing green and creamy white, exactly four
  pairs of stripes across, visible canvas weave, slightly sun-faded and softly creased. …" (each: "Photographic PBR material
  texture for a video game, fills the frame edge to edge, edges continue seamlessly. No text, no border.")
- **The emblem**: "Top-down view of one big funny cartoon emblem made as a classic country club swimming pool floor mosaic,
  centred, on a completely flat plain pure white (#FFFFFF) background: a plump cheerful walrus in a vintage red-and-white striped
  1920s bathing suit and swim cap, mid swan dive with its flippers spread wide, a little splash under it, inside a laurel wreath
  with a gold ribbon. Made entirely of small square glazed ceramic tiles (about 60 tiles across the walrus), in cream, navy, red,
  gold, sea green and tan, each tile slightly uneven, thin grout lines, flat graphic shapes, bold readable silhouette. Only the
  emblem is tiled; everything around it is pure flat white, no tiles, no shadow, no water, no border, no text."
- **The garden's creatures** (3:2): "A game-asset sheet of six comic country club garden creatures and things, each one separate
  and not overlapping, evenly spaced in two rows of three on a completely flat plain pure white (#FFFFFF) background, flat even
  lighting, no shadows, painterly stylized 3D game look, side views: a proud peacock with its tail fanned out wide, a peacock
  strutting with its tail down, a mallard duck wearing tiny swim goggles, a plump mallard duck waddling, three fluffy yellow
  ducklings in a row, a yellow rubber chicken squawking. Bright saturated colours with dark outlines so they stand out from the
  background. No text."

**The people in its pictures are our characters**: painted with `openai/gpt-image-2.5/flare/edit` (quality high), the coaches'
pictures as the references (`dist/assets/coach-waters.webp`, `coach-brooks.webp`, `coach-rivers.webp`, `coach-storm.webp`,
flattened on white):

- **The Hall of Fame** (2048 × 1536; Coach Waters, Coach Brooks, Coach Rivers, Coach Storm): "A grand country club noticeboard in
  a dark green frame with gilt lettering painted across the top reading HALL OF FAME · GREATEST BELLY FLOPS, front-on, filling the
  whole frame, cream paper inside with six vintage sepia-and-colour photographs in little gold frames, two rows of three, each with a
  small brass plate under it. Every photograph shows a character from our game's own cartoon universe, exactly like the characters
  in the four images (chunky stylised cartoon proportions, warm tan clay-like skin, round heads, huge round googly white eyes, big
  bulbous noses, moustaches on some, NO mouths, chunky rounded hands), in a vintage striped bathing suit, captured mid-air in a
  spectacular belly flop off a diving board with a huge splash, faces in comic dread, one with arms windmilling, one holding a
  rubber chicken, one with a swim cap flying off. The brass plates read: 9.9 · THE WALLOP, 9.7 · THE PANCAKE, 10 · CARL, 9.5 ·
  THE SLAPPER, 9.8 · THE TSUNAMI, 0.5 · CHICKENED OUT. Gently funny, warm sunny summer photos."
- **DIVE INTO SUMMER** (1536 × 2048; Coach Rivers and Coach Waters): "A vintage 1930s art-deco country club travel poster, flat
  screen-print style with bold geometric shapes and a limited palette (sky blue, cream, racing green, coral red, gold): a tall white
  diving tower with red, yellow and green platforms beside a sparkling blue pool, clipped hedges, a white clubhouse with a
  terracotta roof and a flag, and in mid-air a perfect elegant swan dive by a character from our game's own cartoon universe
  exactly like the characters in the two images (…), here in a vintage red-and-white striped bathing suit and a white swim cap,
  arms spread like wings; a peacock watching from the lawn. Bold art-deco lettering at the top reading SPLASHWORTH COUNTRY CLUB and
  at the bottom reading DIVE INTO SUMMER. …"
- **Sir Reginald Splashworth** (1536 × 2048; Coach Brooks): "A grand formal oil painting portrait in a gilded country club style,
  rich warm varnished oil paint, visible brushstrokes, golden light: the club's pompous founder, a character from our game's own
  cartoon universe exactly like the character in the image (…), here as Sir Reginald Splashworth in 1927: a monocle in one eye, a
  vintage navy-and-white striped one-piece bathing suit with a sash covered in medals, a silver diving trophy shaped like a swan in
  one hand, the other hand resting on a stuffed peacock, a tall diving tower and a stormy summer sky behind him through a window.
  Gently humorous, dignified. No text, no signature, no frame."
