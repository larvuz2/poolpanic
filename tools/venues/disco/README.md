# The Aqua Disco's assets (three.js)

The scripts that make the Aqua Disco's dressed look for the three.js game (`dist/scene/discoclub.mjs`, README "The Aqua Disco dressed
for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Everything that moves to the beat stays the game's
(`dist/scene/disco.mjs`); these make the room and the furniture round it.

    tools/venues/disco/build_all.sh        # every step below, into dist/assets/disco/

| Step | Script | Makes |
| --- | --- | --- |
| Textures | `disco_textures.py` (Blender's numpy) | the glass dance floor, buttoned velvet (neutral: tinted), acoustic slats, speaker cloth, mirror mosaic, black terrazzo; the deep-blue mosaic, the violet and gold band; the palm frond cut-out |
| Signs | `signs.py` (python3 with Pillow) | the AQUA DISCO crest, four posters of the club's nights, the Juice Bar sign and menu, the DJ BOOTH board, the disco rules, the stations' panels, the zones' numbers |
| The room | `shell.py` | the floor, the basin (a mirror starburst in it), coping, band, ladders; the walls (dado, velvet bays, mirror columns, cornice and neon, slats, fans, posters, sconces, neon words, palms and waves); the entrance's surround, the sign's marquee and the equaliser's bezel; the stage end (mirror arch, drapes, crest); `ceiling.glb` (the Coach Cam's: the vault, neon rings, the truss and its heads, the near wall's upper part); `floor.glb` (the zones' numbers) |
| The doors | `props_doors.py` | the entrance's padded leaves (`Door_A`, `Door_B`) |
| The stations | `props_stations.py` (Splash Park's, in chrome, violet and gold) | water care, eye care, the fin rack (`Fins_1..3`), the skimmer board, the bin, the fish net's board, the ring boards (`LifeRing`), the torch's post (`Flashlight`), the benches |
| The club | `props_club.py` | the stage, its truss towers and lights, the speaker stacks, the DJ's riser and booth, the juice bar and its back bar, the banquettes, palms in urns, floor lamps, the aqua-fit kit |
| Export | `../common/export_three.py -- tools/venues/disco` | one mesh per material class (the ceiling's apart, `C_<class>`: kit.COACH_PARTS), the atlases, the floor's paint and occlusion, `disco.json` |
| Pack | `../common/pack.sh disco` | `dist/assets/disco/`: the quantized GLB and WebP pictures |

Everything is modelled in game coordinates (`kit.py`: the plan, the palette, the tile sets). `discoclub-check.mjs` holds the result
to the classic Aqua Disco's hit boxes and labels and to its budget.
