# The Mountain Hot Springs' assets (three.js)

The scripts that make the Mountain Hot Springs' dressed look for the three.js game (`dist/scene/onsenclub.mjs`, README "The
Mountain Hot Springs dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from
the game's own plan: `plan.mjs` writes it (the springs' outlines, steps and seats, the boulders the walks go round, the furniture,
stations and fixtures, where the spout's water falls) from `dist/onsen-plan.mjs` and `dist/spatial.mjs` into the work folder, and
`kit.py` reads it. What moves stays the game's (`dist/scene/onsen.mjs`): the springs' water, the steam, the falling snow, the spout's
thread of water, the curtain in the bathhouse door, the lanterns' flames, the painted mountains; and its cast (the guests, the snow
monkeys).

    tools/venues/onsen/build_all.sh        # every step below, into dist/assets/onsen-club/

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `onsen_textures.py` (Blender's numpy) | from the classic venue's photographs (`dist/assets/onsen/`): the terrace's icy flagstones, the snow, the rock, the springs' pebbles; made here: pale hinoki and charred cedar boards, lime plaster, kawara roof tiles, cedar bark, the cedars' needles |
| Signs | `signs.py` (python3 with Pillow; the kanji in WenQuanYi Zen Hei) | the bathhouse's plaque (温泉), the hot spring rules (the monkeys are not guests), CAUTION: MONKEYS (they will take your seat), SLIPPERY! VERY., the springs' plaques with their temperatures, the stations' boards, the drinks machine's front, the signpost, the bath-salt sacks |
| The ground | `shell.py` | the terrace holed exactly at the springs, the rock basins and pebbled floors, the rim stones (two rings) and step stones, the boulders at their places with snow caps, rocks out in the snow, the snowfield and drifts; `floor.glb`: the snow on the terrace (thin along the trodden paths), the deck's paint |
| The bathhouse | `props_bathhouse.py` | its plinth, walls, posts and beams, latticed windows and doorway glowing, the snowy kawara roof with icicles, the canopy, the chōchin, the plaque; geta, umbrellas, the yellow bucket pyramid, the drinks machine, the woodpile, the shovel |
| The garden | `props_garden.py` | the stone lanterns (`Light_Lantern`), the bamboo spout, the snowy cedars and the far firs, the bench (tea, raided mikan), the towel shelf, the buckets and plaques at every spring, the boards and signposts, the snowman in a towel, the little shrine |
| The stations | `props_stations.py` | MINERALS, EYE CARE, the skimmer's board, the waste barrel, the ring boards (`LifeRing`), the fish net's board, the torch's post (`Flashlight`), the fuse box's backboard, the dog treats' stand |
| Export | `../common/export_three.py -- tools/venues/onsen` | one mesh per material class, the sign atlas, the floor's paint (its alpha honoured: the snow) and occlusion, `onsen.json` |
| Pack | `../common/pack.sh onsen dist/assets/onsen-club` | `dist/assets/onsen-club/` (the classic venue's photographs stay in `dist/assets/onsen/`) |

Everything is modelled in game coordinates. `onsenclub-check.mjs` holds the result to the classic springs' hit boxes and labels, to
a rock over every boulder and open water in every spring, and to its budget.
