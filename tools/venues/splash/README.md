# Splash Park's assets (three.js)

The scripts that make Splash Park's dressed look for the three.js game (`dist/scene/splashpark.mjs`, README "Splash Park dressed
for real"). Three.js only: nothing here touches the Godot test; the Harbourside's Blender kit (`godot/tools/blender/lib.py`,
`props_kit.py`) is imported, never changed.

    tools/venues/splash/build_all.sh        # every step below, into dist/assets/splash/

| Step | Script | Makes |
| --- | --- | --- |
| Textures | `splash_textures.py` (Blender's numpy) | tile sets (travertine, glass mosaic, the blue band, stucco, teak, hedge, cobble, pine, conifer, ground cover) and cut-outs (palm frond, bougainvillea, hibiscus) |
| Signs | `signs.py` (python3 with Pillow) | the SPLASH PARK tile sign, the snack menu and banner, the stations' panels, the rules, the lifeguard board, the splash zone's board |
| The building | `shell.py` | deck and plinth, the basin (mosaic, band, lanes, gutter, coping, blocks, ladders, pennant posts), the hotel, the walls with glass and piers, the hedge; `floor.glb`: the paint on the deck |
| The garden | `garden.py` | the ground round the plinth, the trees round the park, the shrubs, the palms on the deck |
| The doors | `props_doors.py` | the changing rooms' doors in the hotel's wall (`Door_A`, `Door_B`), the medical cabinet |
| The stations | `props_stations.py` | the trampoline and lifeguard towers, water care, eye care, the fin rack (`Fins_1..3`), the skimmer board and bin, the fish-net board, the ring boards (`LifeRing`), the torch's post (`Flashlight`), the benches |
| The lounge | `props_lounge.py` | loungers, the umbrella, the daybed, the towel cart, inflatables, the snack shack |
| Horizon | `horizon.sh` | the painted panorama round the park, keyed from a picture generated once on fal (its prompt is in the script) |
| Export | `export_three.py` | one mesh per material class, the atlases, the deck's paint and occlusion, `splash.json` |
| Pack | `pack.sh` | `dist/assets/splash/`: the quantized GLB (UVs as floats: `-vtf`) and WebP pictures |

Everything is modelled in game coordinates (`kit.py`: the plan, the palette, the tile sets, the naming the exporter reads).
Each modelling script takes `-- --look` for quick Cycles previews in `$SPLASH_WORK/previews` (default `/tmp/splash-work`).
`splash-check.mjs` holds the result to the classic park's hit boxes and labels and to its budget.
