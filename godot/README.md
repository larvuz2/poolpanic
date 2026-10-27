# Pool Panic in Godot: a feel and look test

**What this is.** The creator wants to see how Pool Panic *feels and looks* if it were made in **Godot** instead of three.js
(27 October 2026: "a test to see how the game feels and looks using Godot instead of threeJS… use same coach, test out only one
venue… no menu even… just need to test out gameplay"). This folder is that test: **one venue, the Community Pool; Coach Waters; one
shift; no menu.** It opens straight into the pool.

The real game is still the three.js one in `dist/`. This test lives **only in `godot/`** and changes nothing outside it, so it can
be merged at any time without touching the real game or its builds.

## If you are the agent picking this up

Read this file, then `CLAUDE.md` at the repo root (how the creator works; their rules hold here too), then the three notes in
`godot/docs/`:

| Note | What it holds |
| --- | --- |
| [`docs/coach.md`](docs/coach.md) | The coach: the model, which clip plays when, the jump, dash and slip, the face, the movement numbers, the keys |
| [`docs/gameplay.md`](docs/gameplay.md) | The Community Pool's rules: guests, patience, lanes, fins, points, the streak, the chores and the first incidents |
| [`docs/venue.md`](docs/venue.md) | The layout, the colours and light, the camera, the HUD |

Every number in them is cited to the three.js source (`dist/…:line`): when in doubt, read the source, which is the truth.

**The rules of this test:**

- **Work only in `godot/`** (and `.github/workflows/godot-test-build.yml`). Never change `dist/`, `desktop/` or the checks: they are
  the real game.
- **One venue, the Community Pool. No menu, no week, no co-op, no other pools.** Ask the creator before widening it.
- **Take the numbers from the real game, never retype them.**
  - `node godot/tools/export-data.mjs` (from the repo root) writes `godot/data/*.json` from `dist/`:
    - the venue's layout, with a grid of where the coach may stand;
    - the tuning;
    - one real 24-guest shift's schedule.
  - Re-run it when the real game changes. Add to it when you need more.
- **Same models.** The coach is `assets/characters/coach-waters.glb`, a copy of `dist/assets/coach-panic.glb` (his old file
  name). Add other models from `dist/assets/` by copying them in. Generated art is committed, never linked.
- **The coach swimming with the life ring plays SwimRing, never Swim or Run** (the creator's standing rule, `CLAUDE.md`).
- **Prove it before you push.** Run `godot/tools/check.sh`. Render a picture (below) and look at it. Say plainly what you saw and
  what you could not try: there is no graphics card or keyboard here, so "how it feels" is the creator's to judge, on their Mac and
  Windows PC.
- **Ship it as the creator likes.**
  - Push to your branch. A push that changes `godot/` builds the downloads (below).
  - Then open a pull request and merge it (`CLAUDE.md`, "Always merge when the work is finished").
  - Send pictures as files (a side-by-side with `reference/` is the best report).

## Set up (a cloud session, once)

```sh
godot/tools/install-godot.sh              # Godot 4.7.2 (checked against its SHA-512) at ~/.cache/poolpanic-godot/godot
godot/tools/check.sh                      # import + a 3 s run where the coach walks by himself: must print "godot check: OK"
```

**To see it** (no screen here, so a virtual one; Vulkan in software, so it is slow but it is Godot's real Forward+ renderer):

```sh
apt-get update && apt-get install -y mesa-vulkan-drivers   # once
cd godot && VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a -s "-screen 0 1280x720x24" \
  ~/.cache/poolpanic-godot/godot --path . --resolution 1280x720 -- --shot=/tmp/shot.png
```

`--shot=<png>` saves the view after 90 frames and quits. Do not judge the look with `--rendering-method gl_compatibility`: that
renderer washes the colours out here. The creator's machines run Forward+.

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
| `scripts/main.gd` | Builds the scene; the keys; the camera; a small HUD |
| `scripts/coach.gd` | Coach Waters, with the real game's movement and clip rules (see below) |
| `scripts/venue_builder.gd` | The Community Pool blocked out in boxes from the exported layout, in its real colours. A starting point, not the look. |
| `scripts/game_data.gd` | Reads `data/*.json`; `is_deck(x, z)` is the real game's walkable deck |
| `data/` | Exported from the real game; do not edit by hand |
| `assets/characters/` | The coach, the five generic swimmers, Marco |
| `assets/fonts/` | Barlow Condensed and DM Sans, the HUD's fonts |
| `reference/` | The three.js game at this pool: `three-shift-hud.png` (a shift with its HUD), `three-coach-close.png`, `three-menu.png` |
| `docs/` | The three notes above |
| `tools/` | `install-godot.sh`, `check.sh`, `export-data.mjs` |

**What `coach.gd` already does:**

- **Movement:** speed 7.6, acceleration 58, braking 76; the slide along walls in 12 cm slices.
- **Jump:** with its 0.12 s buffer, squash and stretch.
- **Dash:** with its lean.
- **The slip:** K, for testing.
- **Clips:** Run with its rate following his speed; IdleScan, then IdleScratch after 7–13 s; the crossfades.
- **The camera:** the same as the real game (42°, about 22 m back along (−0.65, 0.76, 0), easing after him).

The guests stand in the queue on their waiting clips, to show their models work. **Nothing else plays yet**: no arrivals, lanes,
score or incidents.

**The axes are the same as the real game's** (metres, y up, lanes along z), so every position in the JSON and the notes is used as
is. Angles: 0 faces +Z and `rotation.y = angle`, unchanged.

## A plan, in the order that tests the feel soonest

1. **The coach, polished.**
   - His face: the blink and the glances first (`docs/coach.md` §4).
   - The dash's speed streaks.
   - Footstep and splash sounds.
   - A quick side-by-side with `reference/three-coach-close.png`.
2. **The shift's loop** (`docs/gameplay.md` §1–3):
   - The countdown.
   - Guests from `data/club-shift.json` through the two locker doors to the queue, with their patience.
   - Choose one (click or E), send them to lane 1–3; they jump in, swim their laps (one, two side by side, three circling) and leave.
   - The verdict word over them ("Own lane", "Too slow for this lane").
   - The points with the streak, the stars at 2250/3550/4800, the 135 s clock, −100 for each guest still there at the end.
   - The HUD as in `reference/three-shift-hud.png`: the score panel, the lane buttons, the left column of messages, a tag and mood
     bar over each guest.
3. **The chores:**
   - Fins: the rack of 3; guests who ask before or during their swim.
   - Wet spots and the mop (Q, E): the coach slips in one unless he jumps it.
   - Chlorine: C, E at the edge, and the water clouding as the dirt rises.
4. **The cramp rescue**, the game's signature moment: the ring, the dive, SwimRing, the hand-over, the climb out, the bench.
5. **The look:**
   - The water (a shader with caustics and the shallow-to-deep blend, `docs/venue.md` §2), the tiled deck, the room, the light.
   - Then compare with `reference/` and let the creator judge.

Keep `tools/check.sh` passing at every step, and grow its smoke run as the loop grows (a guest given a lane and served).
