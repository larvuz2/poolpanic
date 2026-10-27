# Pool Panic in Godot: the Community Pool

**What this is.** The creator wanted to see how Pool Panic *feels and looks* if it were made in **Godot** instead of three.js
(27 October 2026). This folder is that test: **one venue, the Community Pool; Coach Waters; one shift; no menu.** It opens
straight into the pool.

**The look (27 October 2026).** The creator asked for this venue to be built here as a real step up in design: "AAA indie details,
very crafty and well thought out… no empty spaces or empty walls… use Blender for all the asset making… don't just copy what we
had in three.js". So it became the **Harbourside Community Swim Club**: a 1960s seaside pool, restored, in late-afternoon sun.
`docs/look.md` is its art direction.

The real game is still the three.js one in `dist/`. This test lives **only in `godot/`** and changes nothing outside it.

## Play it

| Where | How |
| --- | --- |
| Download | Every push that changes `godot/` checks the test and exports it (`.github/workflows/godot-test-build.yml`) onto one page that is replaced each time: **https://github.com/larvuz2/poolpanic/releases/tag/godot-latest**. Windows, one Mac app for Apple chips and Intel, Linux; unsigned (the Mac app ad hoc), so each system asks once. |
| A browser | The Netlify site (https://poolpanic.netlify.app, or a pull request's preview) opens on a choice: **Harbourside Community Pool** is this test, built for the web (below). A desktop browser with a keyboard; the first load is a big download. |
| In Godot | Install Godot 4.7.2, open `godot/project.godot`, press **F5**. |

**Keys:**

| Key | What it does |
| --- | --- |
| WASD or arrows | Walk |
| Space | Jump |
| Shift | Dash |
| K | Test the slip |
| F2 | Cycle the graphics quality: High (everything), Medium (no SDFGI or SSIL), Low (also no volumetric fog, SSR or SSAO), for a weaker machine |

## What is in the venue

**The building** (`tools/blender/build_shell.py` → `assets/venue/club_shell.glb`):

- **Deck:** non-slip sand tiles, a band of sea-green glazed tiles round the coping, stainless drain grates.
- **Pool:**
  - a basin of glass mosaic whose floor slopes from 1.85 m deep at the starting blocks to 1.1 m;
  - navy lane lines and wall targets, a dark waterline band, cream stone coping;
  - four underwater lights.
- **Walls:** glazed tiles to a navy band and a timber dado rail, warm plaster above.
- **Window wall:** six tall steel-framed windows, cream cast-iron radiators under them.
- **Roof:** a skylight and glulam beams, drawn only in shadow (the camera looks down into the hall, while the sun still falls
  through them).
- **Viewing gallery:** a long window in the far wall onto the café upstairs: lamp-lit tables, a counter, people watching the
  pool.
- **Near wall:** close-up views see a near wall that the game's camera never draws (a coach at the near edge must not hide
  behind it).

**The light** (`scripts/club/club_scene.gd`):

- A low golden sun through the windows and the skylight.
- SDFGI bouncing it off the tiles, SSAO and SSIL.
- Volumetric fog, denser along the window wall so the shafts show, and a low steam layer over the warm water.
- A box-projected reflection probe, SSR, glow, ACES tone mapping.
- Dust and droplets drifting in the air, lit only where the sun's shafts cross them.

**The water** (`assets/shaders/water.gdshader`):

- Refraction of the floor, coloured by its depth.
- Two drifting ripple layers and a slow swell.
- Foam where swimmers and walls break the surface.
- `clouding` for the chlorine mechanic.

The floor and walls under the water carry moving caustics (`assets/shaders/tiles.gdshader`).

**The pool's furniture** (`props_pool.py`):

- three numbered starting blocks, two ladders;
- lane ropes of bobbing floats (blue, white, coral at the ends);
- backstroke-flag lines of fluttering pennants.

**The floor** (`props_floor.py`):

- painted footprints at every queue spot;
- a mosaic compass rose;
- depth marks, NO DIVING, the lane numbers, NO RUNNING;
- rubber mats.

**The mural** (`mural.py`): a painted harbour (lighthouse, town, boats, swimmers) under the club's name, on the end wall behind
the blocks.

**The gameplay furniture**, each filling its gameplay footprint exactly (`props_stations.py`):

- benches, one dressed with a towel, flip-flops and a swim bag;
- the fins rack with three pairs (`Fins_1..3`);
- the chlorine store, the first-aid and eye-wash counter, the lifeguard chair;
- life-ring stands, the pool office counter;
- the drinking fountain, a big monstera, the WOOF! treat table, the recycling bins;
- the skimmer rack, net, fuse box, mop and bucket.

**The changing rooms** (`props_lockers.py`): open alcoves you look down into.

- Terrazzo floors, tiled walls, 33 lockers each, one door ajar.
- Robes, mirrors, a hair dryer, scales.
- Socks and flip-flops left behind, an "Out of order!" note.
- A door that swings open now and then.

**The edges** (`props_dressing.py`):

- the vending machine (lit), trophy cabinet, honours board;
- the lap-times whiteboard, notice board, posters, rules board;
- towel cubbies, laundry hamper, kickboards, noodles, pull-buoys, the lane-rope reel, lost property;
- clocks, including a working pace clock;
- plants on the floor and the window sills, towels drying on the radiators;
- the café doors and menu, spectator chairs.

**The banners** (`banners.py`): four club banners (the crest, the gala champions, "swim · splash · smile", the county league)
on brass rods above the changing rooms and the gallery.

**The garden** (`exterior.py`): palms and shrubs outside the windows, hardly seen, whose swaying fronds throw moving shadows
through the windows across the deck.

**The guests:** they wait in the queue on their clips, and three swim lengths in the lanes.

## The web build

The same workflow exports it (`tools/web-export.sh`) next to the desktop builds, and the Netlify build puts it on the site at
`/godot/` (`tools/fetch-godot-web.mjs` in the repository's root, README "The Godot test"). A browser runs Godot's **Compatibility
renderer** (WebGL 2), which has no SDFGI, SSAO, SSIL, SSR or volumetric fog, so the web build is a lighter look of the same venue:

- **The light** (`club_scene.gd`, `_web_light`): more light in the ambient for what the tiles would bounce, a softer sun so its
  patches keep their tiles, a warm haze lit toward the sun, and the shafts through the windows drawn as soft beams
  (`assets/shaders/sunbeam.gdshader`, one per pane column, swept from the glass along the sunlight). F2 does nothing there.
- **The water** (`water.gdshader`, its `RENDERER_COMPATIBILITY` branch): WebGL has no copy of the screen or its depth to look
  through, so it is tinted glass, coloured by the floor's known depth and the slant of the view, with the same ripples, lace foam
  and clouding.
- **Lighter textures:** `web-export.sh` exports from a copy whose textures are one desktop format (S3TC, which a browser without it
  gets decompressed) and whose big tiling sets are 512 px (`tools/web-textures.py`); the Blender-only images stay out. About 76 MB
  on disk, about 45 MB to download (Netlify compresses the engine to 9 MB, not the 36 MB of venue data). The desktop builds are untouched.
- **No MSAA** (its resolve fails on WebGL): FXAA instead (`msaa_3d.web=0` in `project.godot`).
- A link in the top right corner goes back to the site's choice (`html/head_include` in `export_presets.cfg`), and the loading
  screen is the Pool Panic logo (`assets/splash.png`, also the desktop builds' splash).

`tools/render.sh --web` draws with the same renderer here (OpenGL in software), which is how the web look was tuned. The web build
itself was also played in Chromium here (WebGL 2 in software): it loads from the site's choice, draws the venue, the swimmers and the
light, with no script errors. A real browser on a graphics card, its frame rate and Safari have not been seen from here.

## Rebuild or change it

- **Blender 4.5 LTS:** `godot/tools/blender/build_all.sh` rebuilds every asset; each script also runs alone with
  `blender -b -P <script>.py`. `lib.py` holds the palette and the modelling and export helpers.
  - Exports merge each prop into one mesh per material, so a prop costs a few draw calls.
  - Parts the game moves, lights or hides keep their own nodes: `Door`, `Hand*`, `Light_*`, `Glass_*`, `Fins_*`.
- **Placement:** in `data/placements/*.json` (`{"asset", "pos", "rot", "scale"}`), read by `club_scene.gd`.
- **Quick look in Blender:** `blender -b -P godot/tools/blender/assemble.py -- out.png game` renders the building with every
  placed prop.
- **Gameplay numbers** come from the real game: `node godot/tools/export-data.mjs` writes `data/club-venue.json`,
  `tuning.json` and `club-shift.json`. Never retype them; the positions and sizes are gameplay, and the art is built round them
  (`docs/look.md`).

## Check and see it here (a cloud session)

```sh
godot/tools/install-godot.sh            # Godot 4.7.2 (SHA-512 checked) at ~/.cache/poolpanic-godot/godot
godot/tools/check.sh                    # import + a 3 s run where the coach walks by himself: "godot check: OK"
apt-get install -y mesa-vulkan-drivers  # once, for the pictures
godot/tools/render.sh out.png --quality=2 --size=960x540                     # the game's view
godot/tools/render.sh x.png --shots=list.txt --wait=10                       # several views in one run
godot/tools/render.sh w.png --web                                            # with the web build's renderer
godot/tools/web-export.sh                                                    # the web build, at godot/build/web
```

**Rendering here:**

- `render.sh` uses Godot's real Forward+ renderer on a software Vulkan.
- It is slow:
  - several minutes to start (compiling shaders on the CPU);
  - most of a minute per frame at High;
  - so render several views per run with `--shots` (a file of lines `<out.png> game` or
    `<out.png> x,y,z,tx,ty,tz`).
- A real graphics card may look a little different (SDFGI, the fog). Say so when showing pictures.

## The notes

| Note | What it holds |
| --- | --- |
| [`docs/look.md`](docs/look.md) | The art direction, the pipeline, the room and its footprints |
| [`docs/coach.md`](docs/coach.md) | The coach: model, clips, face, movement, keys |
| [`docs/gameplay.md`](docs/gameplay.md) | The Community Pool's rules, as the three.js game plays them |
| [`docs/venue.md`](docs/venue.md) | The layout, the camera's framing, what the HUD must show |

**What is still to do** for a full test:

- The shift's loop: guests arriving through the doors, lanes, points, the HUD.
- The chores and incidents.

These are in `docs/gameplay.md`; the venue is built for them (the fins rack's pairs, the doors, the stations).
