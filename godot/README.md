# Pool Panic in Godot: a feel and look test

**What this is.** The creator wants to see how Pool Panic *feels and looks* if it were made in **Godot** instead of three.js
(27 October 2026: "a test to see how the game feels and looks using Godot instead of threeJS… use same coach, test out only one
venue… no menu even… just need to test out gameplay"). This folder is that test: **one venue, the Community Pool; Coach Waters; one
shift; no menu.** It opens straight into the pool.

**The look is yours to push to the limit** (the creator, 27 October 2026: "I want the new agent to push it to the limit in terms of
design and quality and lighting"). There are no pictures of the three.js game here, on purpose: do not copy it, outdo it (below,
"The look").

The real game is still the three.js one in `dist/`. This test lives **only in `godot/`** and changes nothing outside it, so it can
be merged at any time without touching the real game or its builds.

## If you are the agent picking this up

Read this file, then `CLAUDE.md` at the repo root (how the creator works; their rules hold here too), then the three notes in
`godot/docs/`:

| Note | What it holds |
| --- | --- |
| [`docs/coach.md`](docs/coach.md) | The coach: the model, which clip plays when, the jump, dash and slip, the face, the movement numbers, the keys |
| [`docs/gameplay.md`](docs/gameplay.md) | The Community Pool's rules: guests, patience, lanes, fins, points, the streak, the chores and the first incidents |
| [`docs/venue.md`](docs/venue.md) | The layout (every position and size), the camera's framing, what the HUD must show |

The notes are about how the game *plays*: every number is cited to the three.js source (`dist/…:line`), which is the truth when in
doubt. How it *looks* is not in them, on purpose.

**The rules of this test:**

- **Work only in `godot/`** (and `.github/workflows/godot-test-build.yml`). Never change `dist/`, `desktop/` or the checks: they are
  the real game.
- **One venue, the Community Pool. No menu, no week, no co-op, no other pools.** Ask the creator before widening it.
- **Gameplay numbers come from the real game, never retyped.**
  - `node godot/tools/export-data.mjs` (from the repo root) writes `godot/data/*.json` from `dist/`:
    - the venue's layout, with a grid of where the coach may stand;
    - the tuning;
    - one real 24-guest shift's schedule.
  - Re-run it when the real game changes. Add to it when you need more.
  - The positions and sizes are gameplay. Build the venue round them.
- **The characters are the game's own models** (below, "Assets"). Their shading, lighting and effects are yours to raise.
- **The coach swimming with the life ring plays SwimRing, never Swim or Run** (the creator's standing rule, `CLAUDE.md`).
- **Prove it before you push.** Run `godot/tools/check.sh`. Render pictures (below) and look at them. Say plainly what you saw and
  what you could not try: there is no graphics card or keyboard here (only software rendering), so how it feels and how fast it runs
  are the creator's to judge, on their Mac and Windows PC.
- **Ship it as the creator likes.**
  - Push to your branch. A push that changes `godot/` builds the downloads (below).
  - Then open a pull request and merge it (`CLAUDE.md`, "Always merge when the work is finished").
  - Send pictures of the Godot game as files, at each step.

## Assets for the Community Pool

Everything the venue needs, where it goes, and whether it is already here. Keep this table true as you add things.

### Where things go

| Folder | What goes there |
| --- | --- |
| `assets/characters/` | The rigged characters (GLB) |
| `assets/props/` | Things the coach carries or uses: the mop, fins, the chlorine bucket, the life ring… (GLB) |
| `assets/venue/` | The hall's pieces: walls, windows, roof, locker fronts and doors, pool parts, stations, furniture (GLB, or `.tscn` built in Godot) |
| `assets/textures/<name>/` | One folder per PBR set (albedo, normal, roughness, AO…), such as `assets/textures/deck-tile/` |
| `assets/materials/` | Godot materials (`.tres`) |
| `assets/shaders/` | `.gdshader` files: the water, caustics, wet spots |
| `assets/fx/` | Particle and effect scenes: splashes, ripples, drips, the dash's streaks, the score pop-ups |
| `assets/audio/sfx/`, `assets/audio/music/` | Sound effects and music (`.ogg` loops, `.wav` or `.ogg` one-shots) |
| `assets/fonts/` | The HUD's fonts |
| `scenes/` | Scenes; the venue can become `scenes/venue/club.tscn` and replace `scripts/venue_builder.gd` |

### What the venue needs

**In the repo** means already in `godot/assets/`. **Copy from `dist/`** means it is in the real game: copy the file in, never link
it. **Make** means it does not exist yet.

| Asset | Status | Notes |
| --- | --- | --- |
| **Coach Waters** | In the repo: `assets/characters/coach-waters.glb` | 13 clips, a face rig, 1.75 m, faces +Z (`docs/coach.md`) |
| **The guests** | In the repo: `assets/characters/swimmer-{boy,woman,tall-man,tall-woman,heavy-man}.glb`, `marco.glb` | Walk, Run, Swim, IdleScan, Panic… Marco also has WaitWatch |
| **Mop and mop bucket** | In the repo: `assets/props/mop.glb`, `mop-bucket.glb` | The wet-spot chore |
| **Fonts** | In the repo: `assets/fonts/` (Barlow Condensed, DM Sans) | Or better ones (open licences only) |
| **Fins** (a pair, carried; three on a rack) | Make | The rack shows how many pairs are left (3) |
| **Chlorine bucket** (carried) and the chlorine station | Make | Station at (10.8, 7.8) |
| **Eye-relief station** (first aid) | Make | At (10.8, 3.9) |
| **Life ring** and its 3 wall boards | Make | Ring about 1 m across; boards at the 3 `ringMounts`. The ring is carried, swum with (SwimRing) and handed over. |
| **The pool** | Make | 10 × 16.6 m, 1.4 m deep, three lanes. Tiled basin, gutters and coping, a water line. Lane ropes with floats, 3 numbered starting blocks at the locker end (z −9.15), 2 ladders, backstroke flags. |
| **The water** | Make: a shader | Refraction, caustics, ripples that react to swimmers and splashes, and a visible "clouding" as the chlorine runs low (`docs/gameplay.md` §4) |
| **The deck** | Make | Wet tile, slip-resistant, worn. The wet spots must read clearly on it (a decal or shader). |
| **The hall** | Make | An indoor community club: walls, windows or skylights, the ceiling or roof (the camera looks down at about 50°, so it must not hide the floor: a cut-away, a high glass roof, or whatever works), a clock, notice boards |
| **The two locker rooms** | Make | Guests come out of doors at x ±8.05, z −14.4. The doors open and close as they pass (2.2 s). |
| **The furniture** | Make | Three benches (one the rescue bench at (−10.2, −0.25)), a lifeguard chair (12.2, −7.3), plants, a fountain, the office desk (13, 9.5): every position and size is in `club-venue.json` `furniture` |
| **Sanitation corner** (later incidents) | Make | Skimmer rack (−13.5, −1.9), waste bin (−12.5, 1.5) |
| **Effects** | Make | Splashes (jumping in, the coach's dive), swim wakes, drips, the wet spot, a dash streak, footstep puffs, score pop-ups, the streak's tier banner |
| **Sound** | Make | The three.js game synthesises its sounds, so nothing can be copied. Needed: footsteps on wet tile, jump and land, dash, splashes, strokes, a whistle, the slip, the mop, the chlorine pour, the doors, the hall's echo and crowd, UI clicks, points and streak chimes, a music loop. |

**Ways to make them** (all used on this project before):

- 3D models: Meshy or Tripo through fal. Blender runs headless here.
- Images and textures: image models on fal, or CC0 sets (Poly Haven, ambientCG; CC0 allows commercial use).
- Sound and music: ElevenLabs on fal.

Commit every generated file under `godot/assets/`, never a link (the CDN links expire). The creator still owes written proof that the
AI tools allow commercial use: that is theirs to do, so just note in the PR which tool made what.

## The look: push it to the limit

The creator wants to see what Godot can do. Make it look like a game people buy on Steam for its looks: rich, warm, readable,
alive. Some directions, all optional:

- **Lighting:**
  - Global illumination for an indoor hall: LightmapGI baked, or SDFGI or VoxelGI.
  - Volumetric fog with light shafts through the windows.
  - SSAO and SSIL; reflection probes.
  - A tonemapper and colour grade chosen with care (AgX or ACES, a LUT); glow on the water's glints.
- **Water:** the hero of the scene.
  - Screen-space refraction and reflection.
  - Caustics on the pool's floor and walls, and their dancing light thrown on the ceiling.
  - Foam and splashes, wakes behind swimmers.
  - The clouding as the chlorine runs low.
- **Materials:** PBR everywhere: tiles with grout and normal maps, wet patches with reflections, metal, plastic, painted wood.
- **Life:**
  - Steam or humidity, drips, ripples, flags moving in the air from the vents.
  - The characters' shading at its best (subsurface on skin, a rim light) without changing their models.
- **The HUD:** designed to match, readable at a glance (`docs/venue.md` §4 lists what it must show).

**What stays fixed, because it is gameplay:**

- The positions and sizes (`club-venue.json`).
- The camera's framing: across the pool, screen up +X, about 50° down, the whole pool in view (`docs/venue.md` §3).
- **Readability** from that camera, at a glance:
  - who is waiting, of which type and how cross;
  - which lane is which;
  - where the coach is;
  - every warning (an incident, a wet spot).
- **The frame rate:**
  - aim for 60 fps on the creator's Mac and Windows PC;
  - offer a quality setting (a key, since there is no menu) so a weaker machine can play it;
  - say what each effect costs.

## Set up (a cloud session, once)

```sh
godot/tools/install-godot.sh              # Godot 4.7.2 (checked against its SHA-512) at ~/.cache/poolpanic-godot/godot
godot/tools/check.sh                      # import + a 3 s run where the coach walks by himself: must print "godot check: OK"
```

**To see it** (no screen here, so a virtual one; Vulkan in software, so it is slow, but it is Godot's real Forward+ renderer):

```sh
apt-get update && apt-get install -y mesa-vulkan-drivers   # once
cd godot && VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a -s "-screen 0 1280x720x24" \
  ~/.cache/poolpanic-godot/godot --path . --resolution 1280x720 -- --shot=/tmp/shot.png
```

- `--shot=<png>` saves the view after 90 frames and quits.
- Do not judge the look with `--rendering-method gl_compatibility`: that renderer washes the colours out here. The creator's machines
  run Forward+.
- Software rendering is slow and some effects (SDFGI, volumetric fog) may look different from a real graphics card: say so when you
  show pictures.

**To export the builds yourself:**

```sh
godot/tools/install-godot.sh --templates
cd godot && mkdir -p build/{windows,macos,linux}
~/.cache/poolpanic-godot/godot --headless --path . --export-release Windows   # or macOS, Linux
```

## How the creator plays it

- **Download:** every push that changes `godot/` checks the test and exports it (`.github/workflows/godot-test-build.yml`), on one
  page that is replaced each time: **https://github.com/larvuz2/poolpanic/releases/tag/godot-latest**. It has Windows, one Mac app
  for Apple chips and Intel, and Linux. They are unsigned (the Mac app ad hoc), so each system asks once, as with the real game's
  test builds.
- **Or in Godot itself:** install Godot 4.7.2 from https://godotengine.org/download, open `godot/project.godot`, press **F5**.

## What is here (the starting point, 27 October 2026)

| Path | What |
| --- | --- |
| `project.godot`, `scenes/main.tscn` | The project, one scene, Forward+, 1280×720 |
| `scripts/main.gd` | Builds the scene; the keys; the camera; a plain first light; a small HUD |
| `scripts/coach.gd` | Coach Waters, with the real game's movement and clip rules (see below) |
| `scripts/venue_builder.gd` | The Community Pool blocked out in grey boxes at the real positions: placeholders for the real venue |
| `scripts/game_data.gd` | Reads `data/*.json`; `is_deck(x, z)` is the real game's walkable deck |
| `data/` | Exported from the real game; do not edit by hand |
| `assets/` | The characters, the mop and bucket, the fonts (above, "Assets") |
| `docs/` | The three notes above |
| `tools/` | `install-godot.sh`, `check.sh`, `export-data.mjs` |
| `START-PROMPT.md` | The message the creator pastes to start the session |

**What `coach.gd` already does:**

- **Movement:** speed 7.6, acceleration 58, braking 76; the slide along walls in 12 cm slices.
- **Jump:** with its 0.12 s buffer, squash and stretch.
- **Dash:** with its lean.
- **The slip:** K, for testing.
- **Clips:** Run with its rate following his speed; IdleScan, then IdleScratch after 7–13 s; the crossfades.
- **The camera:** the same framing as the real game (42°, about 22 m back along (−0.65, 0.76, 0), easing after him).

The guests stand in the queue on their waiting clips, to show their models work. **Nothing else plays yet**: no arrivals, lanes,
score or incidents. The light and the boxes are only there so something can be seen.

**The axes are the same as the real game's** (metres, y up, lanes along z), so every position in the JSON and the notes is used as
is. Angles: 0 faces +Z and `rotation.y = angle`, unchanged.

## A plan, in the order that tests the feel soonest

1. **The coach, polished.**
   - His face: the blink and the glances first (`docs/coach.md` §4).
   - The dash's speed streaks.
   - Footstep and splash sounds.
2. **The shift's loop** (`docs/gameplay.md` §1–3):
   - The countdown.
   - Guests from `data/club-shift.json` through the two locker doors to the queue, with their patience.
   - Choose one (click or E), send them to lane 1–3; they jump in, swim their laps (one, two side by side, three circling) and leave.
   - The verdict word over them ("Own lane", "Too slow for this lane").
   - The points with the streak, the stars at 2250/3550/4800, the 135 s clock, −100 for each guest still there at the end.
   - The HUD (`docs/venue.md` §4).
3. **The chores:**
   - Fins: the rack of 3; guests who ask before or during their swim.
   - Wet spots and the mop (Q, E): the coach slips in one unless he jumps it.
   - Chlorine: C, E at the edge, and the water clouding as the dirt rises.
4. **The cramp rescue**, the game's signature moment: the ring, the dive, SwimRing, the hand-over, the climb out, the bench.
5. **The look, pushed to the limit** (above): the venue's assets, the water, the light.
   - It can start earlier, in parallel, but never at the cost of the loop working.
   - Show the creator pictures at each stage.

Keep `tools/check.sh` passing at every step, and grow its smoke run as the loop grows (a guest given a lane and served).
