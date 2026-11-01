# The Wave Pool's assets (three.js)

The scripts that make the Wave Pool's dressed look for the three.js game (`dist/scene/waveclub.mjs`, README "The Wave Pool dressed
for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from the game's own plan:
`plan.mjs` writes it (the basin and the floor's profile, the five chambers, the deck and room, the gate and the waiting rows inside
it, the towels the bathers rest on, the evacuation spots, the furniture, stations and fixtures) from `dist/waves.mjs`,
`dist/scene/wave.mjs` and `dist/spatial.mjs` into the work folder, and `kit.py` reads it. What moves stays the game's
(`dist/scene/wave.mjs`), placed at the model's anchors: any object named `Anchor_<Name>` is left out and its centre recorded
(`info.anchors.<Name>`): `Surge` (the water in each chamber), `LED` (the board's face), `Beacon`, `BulbLow`/`BulbHigh` (the roof
sign's bulbs' rectangle), `Flag` (each pole's flag), `Tubes` (the foot of the tube stack); the life rings and the torch as before.

    tools/venues/wave/build_all.sh        # every step below, into dist/assets/wave-club/

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `wave_textures.py` (Blender's numpy) | from the classic venue's photographs (`dist/assets/wave/`): the coquina pavers, the rippled sand; made here: glazed Malibu tile, the pool's glass mosaic and waterline band, the breeze blocks' cut-out; from the earlier venues' scripts: stucco, teak, boardwalk, thatch, palm fronds, beach grass, hibiscus, bougainvillea |
| Signs | `signs.py` (python3 with Pillow) | the roof sign, the gate's arch, the chambers' numbers and warnings, the LED's brass plate, the siren's warning, the lifeguard tower's boards, the tube hut's and the Surf Shack's (a menu in cents), the stations' boards, the rules, the surf report, the shark that measures you, SPF 9000, the Hall of Wipeouts, the lost & found, the wave machine's door, the tickets, a gauge, the judges' score cards, the floor's sun medallions, the depth plaques, six surfboards' decks |
| The painted pieces | `painted.sh` | the mural (cropped of its painted border) and the octopus (keyed into a cut-out), from the pictures made once on fal (below) |
| The ground | `shell.py` | the deck of pavers with its Malibu borders and the two medallions, the boardwalk, the beach and the pool's floor on the game's profile, the octopus on the deep floor, the pool's ends, the coping with its plaques and drains, the near wall, the breeze-block screens, the service yard's walls, the surf gate (`Door_A`/`Door_B`), the sand outside; `floor.glb`: the deck's paint (the wet sand, the wrack line, blown sand, damp patches, grime) |
| The wave house | `props_house.py` | the front wall and its five chambers (arches, keystones, grilles, tunnels, lamps, signs; `Anchor_Surge`, `Anchor_LED`), the terrace and everything on it, the upper storey with the mural, the turrets (`Anchor_Beacon`), the roof sign (`Anchor_BulbLow`/`High`), the flags (`Anchor_Flag`), the machine's end and its pipes |
| The stations | `props_stations.py` | the tube hut (`Anchor_Tubes`), the Surf Shack, the lifeguard tower, WATER CARE, EYE CARE, the ring boards (`LifeRing`), the fish net's and skimmer's boards, the fish-shaped waste bin, the torch's bollard (`Flashlight`), the fuse box's conduits, the service yard |
| The beach and the walls | `props_beach.py` | the towels and their stories, the sandcastle, balls, shells, the message in a bottle, the umbrellas and deck chairs, the right wall's showers and boards, the left wall's rules, fountain, bench, surf rack and clock, pots on the near wall |
| The garden | `garden.py` | the plan's palms in raised beds, palm groves, bushes and grass outside, the gate's torches, kiosk, bikes, camper van and sandwich board, the hammock and the volleyball court |
| Export | `../common/export_three.py -- tools/venues/wave` | one mesh per material class, the sign and cut-out atlases, the floor's paint and occlusion, `wave.json` (with the anchors) |
| Pack | `../common/pack.sh wave dist/assets/wave-club` | `dist/assets/wave-club/` (the classic venue's photographs stay in `dist/assets/wave/`) |
| Horizon | `horizon.sh` | `dist/assets/wave-club/horizon.webp`, from the picture made once on fal (its prompt in the script) |

The pictures made once on fal (`fal-ai/nano-banana-2.1`), kept as `mural.png` and `octopus.png` in `$WAVE_GEN` (default the work
folder's `gen/`; their links expire, so the results live in the model's atlases):

- **The mural** (21:9, 2K): "A huge flat painted wall mural for a 1960s retro tropical surf park, painted directly onto a white
  stucco wall, in the style of a mid-century screen-printed surf poster: bold flat shapes, clean outlines, limited palette of coral
  red (#e2574a), turquoise teal (#1f9aa0), seafoam (#8fd8c8), sunshine yellow (#ffc93c), cream (#fff1d8) and deep navy (#174958).
  Composition: one gigantic curling turquoise wave fills the right two thirds, its curl forming a hollow tube with stylised white
  foam fingers; a tiny surfer in red trunks rides the face of the wave; just behind the surfer, a cheerful pink cartoon octopus in
  sunglasses rides its own little surfboard, waving three arms; a big smiling retro sun with ray stripes on the left over a striped
  sea; three coconut palm silhouettes on a little island at the far left; a whale's tail and a few seagulls; stylised spray dots.
  Slight paint texture, a little sun-faded, charming and goofy, family friendly. No text, no letters, no logo, no frame, no border,
  the art fills the whole image edge to edge."
- **The octopus** (1:1, 2K): "Top-down view of one giant friendly cartoon octopus made as a pool floor tile mosaic, centred, on a
  completely flat plain pure white (#FFFFFF) background. The octopus is coral pink (#ef6f6c) with darker rose spots and paler pink
  suckers, big round happy eyes with white highlights, a goofy grin, wearing round yellow sunglasses pushed up on its head, its eight
  long arms curling outwards in big playful spirals filling the square, one arm holding a little yellow rubber duck. Made entirely
  of small square glazed ceramic tiles (about 60 tiles across the octopus's head), each tile slightly uneven in colour, thin cream
  grout lines between tiles, flat graphic shapes, bold readable silhouette. Only the octopus and the duck are tiled; everything
  around them is pure flat white with no tiles, no shadow, no water, no border, no text."

Everything is modelled in game coordinates. `waveclub-check.mjs` holds the result to the classic Wave Pool's hit boxes and labels,
to its placements (nothing in the way where the guests wait and walk and the bathers rest, open water over the pool, every chamber
open, the anchors where the game needs them) and to its budget.
