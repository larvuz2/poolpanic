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
- **The suite is the gate on Netlify** (`npm test` runs in the deploy build, so one failing check fails the preview). A check must not depend on
  anything git does not track: a build machine adds files of its own (one broke `desktop-check` this way, from a `.toml` in `dist/`), and a
  clean clone will not show it. Read the Netlify log (the PR comment links it) before guessing.

## How the creator works with you

- Messages are often **voice dictated** from a phone or iPad: read for intent (a "Netflix" for "Steam", a sentence that restarts). Do the thing,
  and say plainly what you understood when it matters.
- They think in the game's terms (levels, incidents, characters, the map) and want to *see* and *rank* things: a contact sheet, a poster, an
  interactive page to rank or choose (Artifacts work well). Deliver files to them directly (a file card), not as a path.
- They test on an **iPad in Safari**. Safari has crashed the game before (see the README's crash hunt). There is no WebKit where you work, only
  Chromium, so say what you could not verify on the device and ask for a report (**Copy report** in the crash dialog, or `?bisect`).
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
| A crash on a device | the README's "Crash log", `dist/crashlog.mjs`, `?bisect` |

## Keeping this file true

When the goal, the order of work or the way of working changes, change this file in the same commit. When behaviour changes, change the README
too (its working agreement says so).
