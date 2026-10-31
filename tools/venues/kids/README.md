# The Kids Pool's assets (three.js)

The scripts that make the Kids Pool's dressed look for the three.js game (`dist/scene/kidspool.mjs`, README "The Kids Pool dressed
for real"), with the shared venue kit in `tools/venues/common/` (kitbase, textures, trees, the exporter, the pack, the horizon).
Three.js only.

    tools/venues/kids/build_all.sh        # every step below, into dist/assets/kids/

| Step | Script | Makes |
| --- | --- | --- |
| Textures | `kids_textures.py` (Blender's numpy) | poured rubber and painted boards (neutral: tinted per colour), broadleaf crowns, the aqua mosaic, the pink band, hedge, ground cover, cypress; cut-outs (palm frond, hydrangea, hibiscus) |
| Signs | `signs.py` (python3 with Pillow) | the KIDS POOL arch, the huts' numbers, the ice-cream menu, the stations' panels, the splash rules |
| The ground and buildings | `shell.py` | the rubber deck and its inlays, the pink band, the coping, the mosaic basin with its sea creatures and ladders, the picket fence, the hedge, the gate (`Door_A`, `Door_B`), the beach huts, the boardwalk, the ground; `floor.glb`: the hopscotch's numbers, WALK! |
| The garden | `garden.py` | broadleaf trees, palms and cypresses round the pool, shrubs |
| The stations | `props_stations.py` | the fin rack (`Fins_1..3`), water care, eye care, the skimmer board, the frog bin, the fish-net board, the ring boards (`LifeRing`), the torch's post (`Flashlight`), the benches, the fuse box's post, the rules board |
| The play pieces | `props_play.py` | the slide turret, the lifeguard chair, the toy chest, the ice-cream cart (its ledge carries the game's treats), shade sails, bunting, planters, towels on the fence |
| Horizon | `horizon.sh` | the painted seaside town round the pool (generated once on fal; its prompt is in the script) |
| Export | `../common/export_three.py -- tools/venues/kids` | one mesh per material class, the atlases, the deck's paint and occlusion, `kids.json` |
| Pack | `../common/pack.sh kids` | `dist/assets/kids/`: the quantized GLB and WebP pictures |

Everything is modelled in game coordinates (`kit.py`: the plan, the palette, the tile sets). The kids run all over the deck, so
nothing new stands in the open deck: only on the game's furniture spots, against the fence, or outside it.
`kids-check.mjs` holds the result to the classic Kids Pool's hit boxes and labels and to its budget.
