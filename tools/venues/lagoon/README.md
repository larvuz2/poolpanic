# The Sunset Lagoon's assets (three.js)

The scripts that make the Sunset Lagoon's dressed look for the three.js game (`dist/scene/lagoonclub.mjs`, README "The Sunset Lagoon
dressed for real"), with the shared venue kit in `tools/venues/common/` (kitbase, textures, trees, the exporter, the pack, the
horizon). Three.js only.

    tools/venues/lagoon/build_all.sh        # every step below, into dist/assets/lagoon/

| Step | Script | Makes |
| --- | --- | --- |
| Textures | `lagoon_textures.py` (Blender's numpy) | the boardwalk's hardwood planks, thatch, woven bamboo, beach sand, teak; the turquoise mosaic, the teal and coral band, hedge, broadleaf crowns; cut-outs (palm frond, beach grass, hibiscus, bougainvillea) |
| Signs | `signs.py` (python3 with Pillow) | the SUNSET LAGOON board, the tiki bar's board and chalk menu, the surf school's board, the signpost's arrows, the stations' panels, the lagoon rules, the lifeguard's board, the splash zone |
| The ground and buildings | `shell.py` | the raised boardwalk on its piles, the basin (a sea turtle in its floor), coping, gutter, band, ladders, blocks, bamboo pennant posts; the beach house (woven walls, thatched roof and gable, carved entrance, tiki posts, windows with blinds, paper lanterns, masks, surfboards); the rope railings and tiki torches; the steps to the beach; the sand and its dunes; `floor.glb`: the lane numbers, the splash zone, NO RUNNING |
| The garden | `garden.py` | palms and sea-almond trees on the dunes (the far ones lighter), the three deck palms through the boardwalk, sea-grape bushes, hibiscus, beach grass |
| The doors | `props_doors.py` | the changing rooms' doors in the beach house's wall (`Door_A`, `Door_B`), the medical cabinet |
| The stations | `props_stations.py` (Splash Park's, in timber, bamboo and thatch) | the trampoline tower, the lifeguard chair, water care and eye care under thatched roofs, the fin rack (`Fins_1..3`), the skimmer board, the waste basket, the fish net's board, the ring boards (`LifeRing`), the torch's post (`Flashlight`), the benches |
| The lounge and bar | `props_lounge.py` (Splash Park's, the lagoon's way) | the loungers and the palapa, the open end's loungers, towel cart and rings (the massage table's spot kept clear), the tiki bar (its counter carries the game's treats) |
| The beach | `props_beach.py` | the signpost, torches along the path, a sandcastle, the bonfire and its log seats, the volleyball court, the rowboat and the outrigger, the surf school's shack and boards, kayaks, umbrellas |
| Horizon | `horizon.sh` | the painted tropical coast round the land sides (generated once on fal; its prompt is in the script) |
| Export | `../common/export_three.py -- tools/venues/lagoon` | one mesh per material class, the atlases, the deck's paint and occlusion, `lagoon.json` |
| Pack | `../common/pack.sh lagoon` | `dist/assets/lagoon/`: the quantized GLB and WebP pictures |

Everything is modelled in game coordinates (`kit.py`: the plan, Splash Park's `RESORT_SPEC` with the doors in the wall, the
palette, the tile sets, the dunes). The deck stands 1.95 m over the sand; the sea is the game's own (`scene/sky.mjs`), so nothing
is modelled past x -34.6 on that side. `lagoon-check.mjs` holds the result to the classic Sunset Lagoon's hit boxes and labels and
to its budget.
