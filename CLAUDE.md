# Pool Panic: notes for the agent

A 3D pool-management game (three.js, ES modules, no build step, `dist/` is the game). `README.md` is the full brief and the module map; read the
parts that touch what you change. This file is what a new session needs before it starts: the goal, the order of work, how the creator works,
and how to check and ship.

## The goal

**Publish Pool Panic on Steam and make money with it.** Single player first. Great graphics and lighting are wanted, but at the end. Everything is
weighed against: *does it make a player want one more shift?* The game has to be **addictive** and **spontaneous** (the same level never plays
the same twice: see `docs/incidents.md`).

## The order of work

1. **The game (now).** Systems, mechanics, characters, incidents, the loop. It has to work *perfectly*. This is where effort goes.
2. **Steam readiness.** The desktop app and Steam calls exist (`desktop/`, `dist/platform.mjs`, `dist/achievements.mjs`). Still to do: controller
   and Steam Deck support, a settings screen (volumes, graphics, key rebinding, full screen), more achievements, localisation.
3. **The look.** Lighting, textures, the art pass. **Last, on purpose.** Do not polish it unless asked: it must not change how the game plays.
4. **Launch.** Store page, trailer, wishlists, a demo, review, release.

What only the creator can do (do not pretend to do it, and remind them when it blocks something): the Steamworks account and the $100 app fee,
the app and depot ids, the store page, the price, written proof that the AI tools used allow commercial use, the Steam AI disclosure.
`desktop/steam/checklist.md` is the whole road.

## How we test: web first, desktop at milestones

- **Web first, every change.** Each push to a pull request branch gets a Netlify deploy preview at a stable address
  (`https://deploy-preview-<PR number>--poolpanic.netlify.app/`; `/version.mjs` on it names the commit it is serving), and the creator plays
  it on the iPad's Safari, the strictest browser the game has to run in. The desktop app shows the same `dist/`, so the game itself is tested
  on the web. A deploy that fails keeps the last good preview up. After a merge to `main` the public site updates.
- **Desktop at milestones, not every change.** `desktop/` only wraps `dist/` (a window, a saves file, the Steam calls). It gets a real test on
  a machine with Steam when something only it does has changed: the first Steam build, controller and Steam Deck support, the settings screen,
  saves and cloud, new achievements, and before trailer and screenshot capture and each release candidate. Until then `desktop-check.mjs` and
  `achievements-check.mjs` keep the bridge from rotting.
- **A play-through of the levels is a playtest.** For the creator to play many levels and for you to read what the incidents did (and what came before a crash), they open the preview (or the site) with `?playtest` once, on the iPad. The 🐞 button flags a problem with a note, the log is sent to you while they play (no need to tap Send), and the panel shows the **device code**: ask for it once. Then read `https://<the host they play on>/api/report?device=<code>&latest=1` (the newest launch, replaced every few seconds while it runs) while they play, or after: *Flagged by the player* first, then *Playtest so far*, errors, the diary and the last shift's recording. `node tools/replay.mjs <saved report> --diary` plays that shift again exactly (level, seed and inputs decide everything). README "Playtest mode" has the rest. A new incident needs `describe` and `detail` (see `docs/incidents.md` §5).
- **A crash only the iPad shows is hunted by the iPad.** `?bisect=shift&playtest` plays the shift that crashed the iPad back twelve times by itself (a recording in `dist/hunt/`, one part of the game off per test, the iPad left awake and untouched, about 15 minutes; Safari reloads the page after each crash and the plan goes on), and its device code is read like any playtest's: the `hunt` lines of each launch say which test it was, and a launch that ends without closing is a test that crashed. Say plainly that a hunt is the device's answer and nothing else is; the README's "The 45-second crash" keeps what is known.
- **Crashes are synced live, while the creator plays.** There is no scheduled watch: a "Crash watch" session woken by a routine was tried on 4 October 2026 and stopped on 5 October at the creator's request (every wake pays for the whole conversation again, and they would rather say when they are playing). When they say they are playing, read their device's reports as they come (the playtest bullets above; the device code is per address, so a new address shows a new code), and `node tools/crash-triage.mjs CODE` sorts what has come in (a crash, an error, a stuck incident, a flag, a hunt test; `--issue 22` also reads the `handled:` tokens of the public log issue). Fix a crash only with evidence (a replay, a reproduction). `docs/crash-watch.md` keeps what was learned and how to start the watch again. When the 45-second crash is found and fixed, change `KNOWN` in `tools/crash-triage.mjs` in the same commit, or a new crash in that window will be taken for it. The repo is public: no device code and no whole report in an issue.
- **The suite is the gate on Netlify** (`npm test` runs in the deploy build, so one failing check fails the preview). A check must not depend on
  anything git does not track: a build machine adds files of its own (one broke `desktop-check` this way, from a `.toml` in `dist/`), and a
  clean clone will not show it. Read the Netlify log (the PR comment links it) before guessing.

## How the creator works with you

- Messages are often **voice dictated** from a phone or iPad: read for intent (a "Netflix" for "Steam", a sentence that restarts). Do the thing,
  and say plainly what you understood when it matters.
- They think in the game's terms (levels, incidents, characters, the map) and want to *see* and *rank* things: a contact sheet, a poster, an
  interactive page to rank or choose (Artifacts work well). Deliver files to them directly (a file card), not as a path.
- They test on an **iPad in Safari**. Safari has crashed the game before (see the README's crash hunt). There is no WebKit where you work, only
  Chromium, so say what you could not verify on the device and ask for a report. The crash dialog's **Send report** puts it where you can read it:
  ask for the **device code** shown in that dialog (eight characters, once: it names every report that device sends, and the creator can read it
  out or type it) and fetch `https://poolpanic.netlify.app/api/report?device=<code>&latest=1` (add `&id=<launch id>` for another, or leave
  `latest` out for the list; a deploy preview has the same address under its own host). **Copy report** and `?bisect` still work without it.
- Be honest about verification: say what was run and what was only checked by CPU, and never present a programmatic check as a visual or listening
  pass. The README's verification paragraphs are the model.
- Do not open a pull request unless asked; push only to the branch you were given.
- They have asked for, and not yet decided on: the fish kid's walk versus run (CarryWalk normal, CarryRun harder), and whether the kids' random
  names (Timmy, Rosie, Benji, Lola, Arlo, Mina) should match the boy model. The incident ranking is theirs to make before the incident director
  is built.

## Rules of the code

- No framework and no build step for the game. `dist/` runs from a plain static server and, unchanged, inside the desktop app. Nothing in
  `dist/` may require Steam or Electron: Steam lives behind `dist/platform.mjs` and must do nothing in a browser.
- The simulation is authoritative and seeded; render animation must not move gameplay state. Every incident follows the same shape: a visible
  warning, a prevention window, a comic failure with a cost, a physical recovery. Add one only when all four are understandable.
- Characters have a classic (balls and boxes) fallback that plays when a model has not loaded; keep it working. `?nomodels` turns every model off
  for a page (crash hunting).
- **The coach swimming with the life ring plays SwimRing, never Swim or Run**: both arms held out still ahead of him round the ring, only the legs
  kick. It is the coach's alone and only while he holds the ring in the water (the dive included); the creator asked for this and wants it
  remembered (`CoachRig.update`, `coach-model-check.mjs`, `rig-check.mjs`).
- Save keys live in `localStorage` under `pool-panic.*`; the desktop app mirrors them to a file. A new key that should survive must be added to
  `SAVE_KEYS` in `desktop/lib.cjs`; the crash log's keys must never be.
- Fonts are bundled (`dist/assets/fonts/`). The game must not need the network once its files have loaded.
- Generated art (Meshy, fal, image models) is committed under `dist/assets/`, never linked: the CDN links expire.

## Commands

- `npm start` serves `dist/` at http://localhost:8000 (add `?debug` for `window.__pool`).
- `npm test` runs every `*-check.mjs` (about a minute and a half). Run the ones that cover what you changed, and the whole suite before a push.
- `npm run format` (Prettier, 110 columns) before committing; the checks and the desktop `.cjs` files are covered.
- `cd desktop && npm install && npm start` runs the Steam build in a window; `POOLPANIC_STEAM=0` leaves Steam out. See `desktop/README.md`.

## Where to look

| For | Look at |
| --- | --- |
| The brief, every system, the module map and the checks | `README.md` |
| Every incident, how a shift picks them, the level table, the director proposal | `docs/incidents.md` |
| The road to a Steam release, the build and upload, the achievements list | `desktop/README.md`, `desktop/steam/` |
| The character pipeline (Blender rigs, clips, grounding) | `tools/blender/README.md`, `tools/viewer/` (Anim Bench) |
| A crash on a device | the README's "Crash log", `dist/crashlog.mjs`, `dist/trace.mjs` (the shift's diary), `?bisect`, `docs/crash-watch.md` |

## Keeping this file true

When the goal, the order of work or the way of working changes, change this file in the same commit. When behaviour changes, change the README
too (its working agreement says so).
