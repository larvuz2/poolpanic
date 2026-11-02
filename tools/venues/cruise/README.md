# The Cruise Ship's assets (three.js)

The scripts that make the Cruise Ship's dressed look for the three.js game (`dist/scene/cruiseclub.mjs`, README "The Cruise Ship
dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from the game's own plan:
`plan.mjs` writes it (the pool and its two halves, the lanes, the rows of sun loungers and their homes, the Lido Bar, the hot tub,
the stairway lobbies and their doors, the walkers' blocks, the deck and the room, the ship's lines from the classic
`dist/scene/cruise.mjs`, the queue, the evacuation spots, the furniture, stations and fixtures, the rings' mounts) from
`dist/spatial.mjs` and `dist/cruise-plan.mjs` into the work folder, and `kit.py` reads it.

**The whole ship rolls in the game**, so everything here is built in the ship's own frame, level; the sea and the sky are the
game's (the golden hour's panorama, `sky.jpg`, is packed beside the model and wrapped round by `scene/cruise.mjs`'s `ocean`). What
moves stays the game's: the pool's water and its slosh, the rope floats, the movie on the screen, the radar and the signal flags
(they hang from the model's halyards), the funnel's smoke, the lobbies' sliding doors, the loungers (they slide), the hot tub's
water, the ship's bell, the steamer chairs and balls; the life rings and the torch at their anchors as before; the fins are the
model's (`Fins_1..3`).

    tools/venues/cruise/build_all.sh        # every step below, into dist/assets/cruise-club/

**Its materials are photographic.** Eight were painted once on fal as flat, even-lit photographs (the prompts below) and are
made seamless here (`cruise_textures.py`, the Lazy River's method): most came out of fal nearly seamless already, so they are
blended with themselves shifted by half only in a thin band at the edges (a wide band would ghost a regular pattern); the
facade's window bays and the canvas's stripes are cropped first to a whole number of repeats (their periods measured), the
non-skid's yellow line is cropped off; the teak's planks are each turned round by their own amount along their length, so the
picture's wrap becomes a staggered butt joint closed with caulking, and the whole is turned to run fore and aft. Each gets a
normal map from its own relief.

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `cruise_textures.py` (Blender's numpy) | from the fal photographs: teak, white riveted steel, non-skid, glass mosaic, the hull's balconies, the window bands, striped canvas, mahogany (each with its normal map); palm fronds |
| The painted pieces | `painted.py` (python3 with Pillow and numpy) | the kraken keyed into a cut-out; CAPTAIN FOR A DAY keyed (its margin and its two face holes); the towel animals and the seagulls cut apart; the poster, Captain Barnacle and the deck plan into the signs |
| Signs | `signs.py` (python3 with Pillow) | enamel signs with brass rims: PANIC OF THE SEAS, The Lido Bar and its cocktails, TODAY ON BOARD, the pool's rules, MUSTER STATION B, STAIRS, HOT TUB, LOST & FOUND, SEAGULL CROSSING, WET DECK, the shuffleboard's CAPTAIN'S CUP, the belly flop banner and the judges' scorecards, the lifeboats' and life jackets' stencils, the depth plates and lane numbers, the bell's and the captain's plates, the line's crest, SAIL-AWAY CINEMA, the engine telegraph's dial, the stations' boards |
| The shell | `shell.py` | the teak deck cut round the pool, the non-skid walks, the pool (mosaic, the bench step, lane lines, targets, the kraken, the deco band, lamps, coping, depth plates, blocks, ladders), the windscreens on their bulwarks, the hull's sides to the sea, the lower deck aft, the lobbies' glass deckhouses; `floor.glb`: the deck's paint (LIDO DECK 14, NO DIVING, the shuffleboard court, the wet ring and the slosh's spill, scuffs, cocktail rings, the yellow lines, the sun's silvering) |
| The ship | `props_ship.py` | the superstructure's tiers, the café's front (doors, sconces: `Light_Sconce`, the awning, SUNSET BUFFET), the fuse locker, the screen's frame and speakers, SAIL-AWAY CINEMA and the belly flop banner, the ship's name, the bridge and its navigation lights, the mast, radome and halyards, the funnel and its crest, the lifeboats on their davits, the festoons (`Light_Festoon`) |
| The deck | `props_deck.py` | the Lido Bar (`Light_Kiosk`), the hot tub, WATER CARE, EYE CARE, the fin rack (`Fins_1..3`), the rescue bench, the first aid locker, the skimmer's board and the waste bin, the rings' boards (`LifeRing`), the net's board, the binnacle (`Flashlight`), the treats' table, the life jacket chests, the towel cart, the planters and palms, the furled umbrellas, and the stories at the edge of play |
| Export | `../common/export_three.py -- tools/venues/cruise` | one mesh per material class, the sign and cut-out atlases, the floor's paint and occlusion, `cruise.json` |
| Pack | `../common/pack.sh cruise dist/assets/cruise-club` | `dist/assets/cruise-club/`; `sky.jpg` is the horizon's picture resized (`convert horizon.png -resize 4096x1016 -quality 88`) |

The pictures made once on fal, kept in `$CRUISE_GEN` (default the work folder's `gen/`; their links expire, so the results live
in the model's pictures). The materials, the horizon and most of the art with `fal-ai/nano-banana-2.1`:

- **The teak** (1:1, 2K): "Seamless tileable texture, straight top-down orthographic view, flat even overcast lighting, no
  shadows, no perspective: a cruise ship's sun deck of oiled honey-golden teak planks running vertically, each plank its own warm
  tone from pale honey to amber, fine straight wood grain, narrow black rubber caulking lines between every plank, staggered butt
  joints with tiny bronze screw plugs, a few silvered salt-weathered patches and faint water rings from cocktail glasses.
  Photographic PBR material texture for a video game, fills the whole frame edge to edge, edges continue seamlessly. No text, no
  border."
- **The paint** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting, no perspective:
  glossy white marine paint on the steel plating of a cruise ship, large rectangular steel plates with faint horizontal and
  vertical weld seams, rows of small domed rivets along the seams, subtle orange-peel paint texture, a few faint rust tear streaks
  and salt spray spots, very clean overall, bright white with the slightest warm tint. Photographic PBR material texture for a
  video game, fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The non-skid** (1:1, 2K): "Seamless tileable texture, straight top-down orthographic view, flat even lighting: a ship's
  walkway deck coated in pale blue-grey non-skid paint with a fine gritty sand texture, faint scuffs from deck shoes, a few
  painted weld seams showing through, a faded yellow safety line along one edge. Photographic PBR material texture for a video
  game, fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The mosaic** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting: a luxury swimming
  pool lined with small square iridescent glass mosaic tiles, about 25 tiles across, a rich mix of turquoise, aqua, cerulean
  blue, a few pearly white and deep cobalt tiles scattered at random, each tile with a slight glassy sheen and uneven glaze, thin
  pale grey grout lines. Photographic PBR material texture for a video game, fills the frame edge to edge, edges continue
  seamlessly. No text, no border."
- **The hull's side** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic elevation, flat even lighting: the
  white side of a modern cruise ship's hull, exactly two decks of private balconies in two horizontal rows, each balcony a dark
  tinted sliding glass door with a white frame, a glass balustrade with a slim steel handrail, white dividers between balconies, a
  towel or a tiny deck chair on a few of them, one with a pink flamingo float. Photographic PBR texture for a video game, fills the
  frame edge to edge, the left/right and top/bottom edges continue seamlessly. No text, no border."
- **The facade** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic elevation, flat even lighting: the facade
  of a cruise ship's superstructure, white painted steel with one wide band of tall floor-to-ceiling windows, slightly tinted
  blue-green glass reflecting a golden sunset sky and soft clouds, slim white mullions every metre, a white sill below and a white
  fascia above. Photographic PBR texture for a video game, fills the frame edge to edge, edges continue seamlessly. No text, no
  border."
- **The canvas** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting: heavy woven cotton
  canvas awning fabric with bold vertical stripes of deep navy blue and creamy white, each stripe about one eighth of the width,
  visible canvas weave, slightly sun-faded and softly creased. Photographic PBR material texture for a video game, fills the frame
  edge to edge, edges continue seamlessly. No text, no border."
- **The mahogany** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting: varnished
  mahogany wood panelling of an art-deco ocean liner bar, deep red-brown book-matched veneer with rich flame figure, thin polished
  brass inlay strips forming tall rectangular panels, a glossy lacquer sheen. Photographic PBR material texture for a video game,
  fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The horizon** (4:1, 4K): "A seamless wide panoramic seascape backdrop for a stylized 3D video game, painted in a soft painterly
  toon style with clean shapes and gentle gradients (like a Pixar matte painting), seen from the top deck of a cruise ship at
  golden hour. The flat calm horizon line runs perfectly straight and level across the whole width at exactly 55% of the image
  height. Below it, the open ocean: deep sapphire blue in the foreground fading to soft turquoise and silver haze at the horizon,
  gentle long swells, a glittering golden path of sun reflections in one place, little whitecaps. On the horizon, small and far
  away: a chain of green tropical islands with palm trees and a tall striped lighthouse, a distant white sailing yacht, a rival
  cruise ship far off, a whale's spout, a pod of dolphins leaping. Above, a glorious golden-hour sky: the low warm sun just above
  the horizon above the glitter path, a gradient from peach and gold near the horizon to soft lilac and deep sky blue at the top,
  big fluffy pink-and-gold sunset clouds, a few seagulls. No text, no people, no frame. The left and right edges match so it can
  wrap around." (Its horizon came out at 49.6% down and its sun 62% across: `scene/cruiseclub.mjs` lays it so.)
- **The kraken** (1:1, 2K): "Top-down view of one giant friendly cartoon kraken made as an art-deco swimming pool floor mosaic,
  centred, on a completely flat plain pure white (#FFFFFF) background. A big cheerful coral-pink octopus with huge happy eyes
  wearing a tiny white captain's hat, its eight curly tentacles spread out in a star, one tentacle hugging a golden ship's anchor,
  one holding a rubber duck, one waving, one holding a tiny cocktail with an umbrella. Made entirely of small square glazed
  ceramic tiles (about 60 tiles across the body), each tile slightly uneven in colour, thin cream grout lines, flat graphic shapes,
  bold readable silhouette. Only the kraken and its anchor are tiled; everything around them is pure flat white, no tiles, no
  shadow, no water, no border, no text."
- **The travel poster** (3:4, 2K): "A vintage 1930s art-deco ocean liner travel poster in the style of Cassandre, flat screen-print
  style with bold geometric shapes and a limited palette (navy blue, signal red, cream, gold, sea teal): a gigantic towering white
  cruise liner bow seen from below at a dramatic angle, three raked red funnels with black tops puffing smoke, a tiny swimmer doing
  a cannonball off the top deck with a huge splash, seagulls, sun rays. Bold lettering at the top reading PANIC OF THE SEAS and at
  the bottom reading SAIL THE SEVEN SPLASHES. Fills the frame edge to edge, slightly faded and sun-bleached paper texture."
- **The deck plan** (4:3, 2K): "A charming illustrated cutaway side view deck plan of a cartoon cruise ship, retro 1950s travel
  brochure style, on aged cream paper, filling the whole frame: the white ship with a red funnel cut open to show tiny cabins, a
  theatre, a dining room, an engine room with a hamster wheel, a buffet with a giant shrimp tower, a pool on the top deck with a
  tiny red arrow and a star, a lifeboat, a seagull nest on the mast, a submarine and a kraken peeking from the sea below. Neat hand
  lettering labels reading LIDO DECK, YOU ARE HERE, BUFFET, BRIDGE, ENGINE ROOM. Flat pastel colours, thin ink lines, a compass
  rose in one corner."
- **The towel animals** (3:2, 2K): "A game-asset sheet of six cruise ship towel animals folded from fluffy white bath towels, each
  one separate and not overlapping, evenly spaced in two rows of three on a completely flat plain pure white (#FFFFFF) background,
  soft even studio lighting, no shadows: a towel elephant with googly eyes, a towel swan, a towel monkey hanging by one arm
  wearing sunglasses, a towel crab with little claws, a towel turtle, and a towel octopus wearing a tiny captain's hat. Realistic
  soft terry cloth texture, slightly blue-tinted white so they stand out from the background, cute and funny. No text."
- **The seagulls** (3:2, 2K): "A game-asset sheet of six comic cartoon seagulls, each one separate and not overlapping, evenly
  spaced in two rows of three on a completely flat plain pure white (#FFFFFF) background, flat even lighting, no shadows,
  painterly stylized 3D game look: a seagull proudly stealing a single french fry, a seagull squawking with its beak wide open, a
  fat seagull asleep sitting down, a seagull wearing tiny sunglasses, a seagull standing on one leg looking smug, a seagull with a
  tiny paper cocktail umbrella in its beak. Grey wings, white bodies with soft grey shading so they stand out from the background,
  yellow beaks, orange feet, side views. No text."

**The people in the pictures are our characters** (the creator: "the human needs to be more like our characters… regenerate that
with 2.5 GPT and add any character as a reference"). Captain Barnacle and CAPTAIN FOR A DAY were first painted on
nano-banana-2.1 with realistic people, then repainted with `openai/gpt-image-2.5/flare/edit`, the first painting as the style's
reference and Coach Brooks and Coach Waters (`dist/assets/coach-brooks.webp`, `coach-waters.webp`, on white) as the characters':

- **Captain Barnacle** (1536 × 2048, high): "Repaint the oil portrait in the first image, keeping its exact painting style (rich
  warm varnished oil paint, visible brushstrokes, golden light), its composition and everything around the captain: the ship's
  wheel he holds, the cheeky seagull sitting on top of his white captain's hat, the tiny yellow rubber duck in his other hand, the
  brass telescope, the wood-panelled bridge, the stormy sea and the lighthouse through the window. But the captain himself must be
  a character from our game's own cartoon universe, exactly like the characters in the second and third images: the same chunky
  stylised cartoon proportions, warm tan clay-like skin, a big round head, two huge round googly white eyes with small dark
  pupils, a big bulbous rounded nose, a thick bushy cartoon moustache (white, like the older coach in the second image) and a big
  fluffy white cartoon beard, rosy cheeks, NO mouth visible under the moustache, simple rounded hands with chunky fingers. He is
  Captain Barnacle, the ship's old sea captain: stern but twinkly, proud, wearing a navy double-breasted captain's uniform with far
  too many gold medals, gold buttons and gold braid on the shoulders, and the white captain's hat with a gold anchor badge and black
  peak. Painted as a grand formal 1920s ocean-liner portrait of that cartoon character, gently humorous. No text, no signature, no
  frame." (The first painting's prompt: "A formal oil painting portrait in the style of a grand 1920s ocean liner's portrait of its
  captain… Captain Barnacle, a magnificent old sea captain with an enormous fluffy white beard… his white captain's hat with a
  cheeky seagull sitting on top of it, holding a ship's wheel in one hand and a tiny rubber duck in the other…")
- **CAPTAIN FOR A DAY** (2048 × 1536, high): "Repaint the hand-painted seaside carnival photo cut-out board in the first image,
  keeping its exact painting style (bright cheerful cartoon paint, thick outlines, painted plywood with slightly chipped edges),
  its layout, the lettering CAPTAIN FOR A DAY across the top, the painted cruise ship, waves, sunny sky and seagulls behind. Keep
  the two empty round face holes exactly where they are, cut through the board, showing pure flat white (#FFFFFF), no face
  painted in them. But the two painted bodies must be characters from our game's own cartoon universe, exactly like the characters
  in the second and third images: the same chunky stylised cartoon proportions and warm tan clay-like skin with simple rounded
  hands and chunky fingers. On the left a strong, round-bellied sailor in a blue-and-white striped shirt and a tiny white
  captain's hat, flexing both arms proudly, an anchor tattoo on each arm; on the right a glamorous mermaid with the same chunky tan
  cartoon arms, a sparkly green tail and a seashell top, lounging on a red-and-white life ring, waving. Gently funny. Fills the
  whole frame, the board's edges and a little white margin around it." (The first board's prompt: "A hand-painted seaside
  carnival photo cut-out board… a muscular sailor… a glamorous mermaid… two empty round holes… CAPTAIN FOR A DAY.")
