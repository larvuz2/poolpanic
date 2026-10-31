# The Aquatic Centre's assets (three.js)

The scripts that make the Aquatic Centre's dressed look for the three.js game (`dist/scene/aquaticclub.mjs`, README "The Aquatic
Centre dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. The timing board, its pace clocks, the
flags, the crowd in the stands and its ribbons stay the game's (`dist/scene/aquatic.mjs`); these make the hall and everything round
the pool. The crowd's people and the two officials are Meshy characters, not made here (`tools/blender/crowd_bake.py`,
`dist/scene/crowd-models.mjs`, `dist/scene/officials.mjs`).

    tools/venues/aquatic/build_all.sh        # every step below, into dist/assets/aquatic/

| Step | Script | Makes |
| --- | --- | --- |
| Textures | `aquatic_textures.py` (Blender's numpy) | the walls' glazed tiles, the deck's white anti-slip tiles with a pale blue row, blue-grey sports flooring, perforated acoustic panels, moulded seat plastic (neutral: tinted per section), board-marked concrete, teak; the pool's blue glass mosaic and its navy band; the palm frond cut-out |
| Signs | `signs.py` (python3 with Pillow) | the pool records board (Carl's slowest lap), DAYS WITHOUT A CANNONBALL, cardboard Marco, the POOL PANIC TV logo, the three swim clubs' banners (Otters, Seals, Soggy Biscuits), Splashy's poster, the WET FLOOR boards, the ISO-SPLASH machine, the Hall of Fame's plaques, QUIET PLEASE, the stations' panels, the windows' two town views and sky, the SWIM FAST. DON'T PANIC. mural |
| The hall | `shell.py` | the deck and its navy fascia, the basin, touch pads, starting blocks, backstroke posts; the timing wall (its slab, the board's frame, the clock housings); the hall's floor and walls with their tall windows and club banners; the walls (aqua panels over a glazed tile dado, navy pilasters, tall windows with the town and the sky outside, blinds at odd heights, vents, a mosaic frieze), the timing wall's tiles, mural and high windows; the grandstands (seats where the game's crowd sits), the press box; `ceiling.glb` (the Coach Cam's: the vault, trusses, lamps, skylights, hanging banners, the near stand); `floor.glb` (the lane numbers, AQUATIC CENTRE) |
| The doors | `props_doors.py` | the changing rooms' doors in the timing wall (`Door_A`, `Door_B`), their lit CHANGING boxes, mats and shoe-cover dispensers; the first-aid cabinet |
| The stations | `props_stations.py` (Splash Park's, in navy, white and red) | water care, eye care, the fin rack (`Fins_1..3`), the skimmer board, the bin, the fish net's board, the ring boards (`LifeRing`), the torch's post (`Flashlight`), the lifeguard's chair, the benches |
| The meet | `props_meet.py` | the victory podium (trophy, bouquets, medals), the officials' table (monitors, horn, megaphone, stopwatches, the 6.0 / 5.9 / 3.2 scorecards), the team bench (towels, kit bags, swim caps, a rubber chicken nobody claims), the palm, Splashy the giant rubber duck in his cap and goggles, his poster on an easel, the Hall of Fame (ish) with a golden flipper, a golden duck, golden goggles and a fish-skeleton cup, the records board, the ISO-SPLASH machine, the drinking fountain, DAYS WITHOUT A CANNONBALL, the lane-rope reel, the leaning tower of kickboards, the POOL PANIC TV camera, cardboard Marco, WET FLOOR boards |
| Export | `../common/export_three.py -- tools/venues/aquatic` | one mesh per material class (the ceiling's apart, `C_<class>`: kit.COACH_PARTS), the atlases, the floor's paint and occlusion, `aquatic.json` |
| Pack | `../common/pack.sh aquatic` | `dist/assets/aquatic/`: the quantized GLB and WebP pictures |

Everything is modelled in game coordinates (`kit.py`: the plan, the palette, the tile sets). `aquaticclub-check.mjs` holds the result
to the classic Aquatic Centre's hit boxes and labels and to its budget.
