# Pool Panic

> A playful 3D swimming-pool management game: three lanes, endless little disasters, one more shift.

This README is the project brief and agent onboarding guide. It combines the creator's direction with the implemented prototype as inspected on September 26, 2026. Read it before changing the game. Descriptions marked as current refer to the code; proposed possibilities are not commitments or implemented features.

## Vision and player fantasy

You are the coach running a busy public lap pool. Welcome swimmers, place them in suitable lanes, fetch equipment, keep the water usable, and rescue the day when small problems collide. The fun comes from reading the room, choosing priorities, and physically getting to the right place in time.

The intended experience is accessible arcade management with the spatial readability and busy, toy-like energy of an Overcooked-style game. It is a stylized, low-poly 3D browser game, not a realistic swimming simulator. Swimmers should feel like little characters with needs, personalities expressed through movement, and obvious emotional reactions. Mistakes create visible comedy and recoverable chaos.

The core promise is: **easy to understand, satisfying to move through, increasingly difficult to keep under control.** A short successful first shift should make the player want another. Later shifts combine familiar systems rather than burying the player in explanation.

### Design pillars

- **Physical work:** the coach walks, jumps, dashes, carries one item, delivers help, swims during rescue, and returns equipment. A button should not silently complete a distant errand.
- **Readable cause and effect:** a problem must have a visible location, a clear cue, an understandable response, and a visible recovery.
- **Competing priorities:** lane compatibility, queue patience, limited fins, chemistry, equipment requests, and emergencies create decisions.
- **Playful feedback:** slips, angry emojis, bobbing swimmers, hinged doors, sounds, glows, and panic music explain state through the world.
- **Gentle onboarding:** the first swimmer and lane targets teach selection through shared visual cues. The opening shift is short and forgiving.
- **Continuity:** swimmers move through doors, around the deck, into water, out to benches, and back. Avoid teleportation and walking across the pool surface.

## Project locations and repository relationship

- Hosted game: https://pool-panic.larvuz.chatgpt.site
- GitHub repository: https://github.com/larvuz2/poolpanic
- The existing game source belongs to the ChatGPT Site's separate source repository. Its manifest is `.openai/hosting.json`.
- On September 26, 2026, the complete Site source and this README were copied into GitHub. Both now contain the game; future changes do **not** automatically synchronize between them.
- In the full Site checkout, `dist/` contains the editable runtime source, not merely disposable generated output. There is no build step. If this README is present but `dist/` is absent, you have the documentation-only checkout and must open the existing Site source before editing gameplay.

## Core loop

1. Choose an unlocked shift from the ten-level menu.
2. Begin with a synchronized three-second countdown.
3. Watch a locker door open and a swimmer walk to the waiting area.
4. Select the swimmer by their world character, clickable name/emoji tag, queue card, or nearby interaction.
5. Assign one of three lanes, considering speed, occupancy, and stationary aqua aerobics.
6. Move the coach to provide equipment and treatments, recover dropped gear, maintain water, and respond to incidents.
7. Swimmers finish, swim to an end, climb out, walk around the pool, and return to their locker room.
8. Earn score and stars; unlock the next shift and improve device-local best scores.

A lane assignment is a management action. Equipment pickup, handoff, cleanup, and rescue retain proximity and physical movement requirements.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move the coach relative to the screen; swim during a permitted rescue |
| Space | Jump; climb out near a pool edge during rescue |
| Shift | Short dash with an internal cooldown |
| E | Contextual nearby interaction: pickup, handoff, selection, disposal, return, or drop |
| Click swimmer / swimmer tag / queue card | Select a swimmer |
| Click lane / lane button, or 1 / 2 / 3 | Assign the selected waiting swimmer |
| F / C / R | Guidance toward fins / chlorine / eye relief |
| P / Escape | Pause behavior through the game's input/UI routing |
| M | Toggle audio |
| Touch controls | Movement and actions using the same gameplay intents |
| Fullscreen button | Fullscreen where supported by the browser |

Dash lasts 0.16 seconds with a 0.82-second cooldown. There is deliberately no dash cooldown meter. It supports carrying and jumping, uses collision substeps, and has streaks and a swoosh. Directional input is normalized so diagonal movement is not faster.

## Space, camera, and art direction

The pool's long axis reads horizontally on screen. The camera is a close, elevated, across-pool view with gentle following and extra edge panning to keep the coach and nearby equipment visible. Preserve this orientation when adjusting the scene.

The coach starts midway along the near deck. The starting blocks, queue, and arrival routes are at the left/locker-room end. Both locker bays are integrated into the wall, not isolated islands in the middle of the room. The office sits in the upper-right corner. The clubhouse end was extended to make room for arrivals and traffic.

The room uses warm sand/terracotta tiles, muted teal walls, soft lighting, and a continuous tiled environment behind the HUD. The UI uses dark teal arcade scoreboard surfaces, yellow primary actions, swimmer passes, inventory slots, lane plaques, and emojis. Preserve the toy-like low-poly identity and readable game presentation.

Geometry, interaction hit volumes, collision proxies, camera framing, and routes must agree. The fin and chlorine fixtures were rotated 90 degrees for the horizontal presentation. Swimmers finishing at either end swim to the nearer end wall, climb out, and walk around the outside. Their water, climbing, and deck poses are distinct.

## Swimmers, lanes, and happiness

| Internal type | Player label | Cue | Behavior |
| --- | --- | --- | --- |
| `beginner` | Beginner | 🐢 / green | Slow; sensitive to crowding and sharing with Pros |
| `intermediate` | Intermediate | 🏊 / blue | Medium lap speed |
| `advanced` | Pro | ⚡ / coral | Fast; loses satisfaction when blocked by slower traffic |
| `aqua` | Aqua aerobics | 💦 / purple | Exercises in place and obstructs lap traffic |

The internal `advanced` identifier still maps to the visible label **Pro**. Keep the skill words beside the emojis so icons are not the only explanation.

With fewer than three occupants, lanes use split movement; at three or more, circle-swimming restrictions propagate the actual speed of swimmers ahead. Mixing speeds can produce queues, frustration, collisions, and lost goggles. Stationary aqua participants slow passing lap swimmers and dislike sharing with them. Fins increase lap speed by 30%, which also affects lane compatibility.

Happiness responds to waiting, blocked speed, crowding, water contamination, unresolved needs, collisions, and fin trips. Queue patience begins after arrival. Swimmers can abandon the visit when happiness runs out. Assigning lanes sensibly and responding promptly improves outcomes.

## Arrival, selection, and onboarding

- Every start, retry, and next shift begins with 3–2–1 and matching beeps. Gameplay movement, shift time, and arrivals wait for Go.
- The first door begins opening 3.4 seconds after Go. The swimmer walks through and becomes selectable at the queue within roughly five seconds of Go.
- Later arrivals alternate locker rooms. Doors open for departing swimmers too, without the arrival chime.
- The first swimmer is **not automatically selected**. A shared yellow pulse links the waiting swimmer and their badge.
- Selecting a waiting swimmer produces a two-note sound and highlights the three lane targets in both the world and HUD.
- Guidance advances as swimmers are assigned, lost, or sent home. Selected-swimmer assignment takes priority over a carried chlorine bucket.
- Queue slots are unique and reusable. The old waiting-position floor circles are hidden; useful selection glows remain.
- Help retains detailed controls, while the opening menu avoids a written tutorial step list.

## Equipment and physical service

The coach has **one carrying slot**. Inventory and ownership must survive assignment, abandonment, incidents, rescue, and exits.

| Equipment | Purpose and rules |
| --- | --- |
| Fins | Exactly three physical pairs total across rack, coach, swimmers, and deck. Deliver to swimmers requesting them before or during workouts; recover dropped pairs. |
| Chlorine | Carry from the station to the water. Balances contamination against eye irritation. |
| Eye relief | Carry to an affected swimmer and deliver within reach. |
| Goggles | Recover dropped goggles and return them to the correct owner. |
| Pool skimmer | Pick up, scoop waste, empty at the bin, and return to wall hooks before chemical recovery. |
| Life rings | Three individually tracked rings. Carry one through rescue, recover it from the bench, and return it to its own hook. |

Equipment handoff reach is 3.6 world units; ordinary station interaction is generally 1.8. Service supports either end of each lane and side access for the outer lanes. E delivers fins when possible and otherwise drops them, including near the rack; the explicit return action handles rack return. Clicking distant equipment provides guidance, not remote fulfillment.

## Incidents and recovery

### Dropped fins and slips

Dropped fin pairs are physical deck hazards for swimmers and the coach. Jumping can avoid them. A trip makes the character fall **backward onto their back**, briefly hold, then get up and continue. Do not revert to a sideways fall. Both coach and swimmers show a brief angry emoji. Swimmers lose six happiness points; cooldowns prevent repeated immediate trips. The fin owner has a short grace period when dropping fins after climbing out.

Ordinary deck contacts are different: characters gently separate, recoil, and lean briefly, without falling or scoring penalties. Passing sidesteps and corner approach zones prevent jams. Waiting swimmers ease back to their own queue slots.

### Lane collisions and goggles

Prolonged blockage in circle swimming can trigger a collision, temporarily stopping the involved swimmers and reducing score and happiness. Later-level collisions can create lost-goggle requests. Recover the correct goggles and deliver them physically. Preserve the difference between these incidents and harmless deck bumps.

### Water chemistry and eye irritation

Swimmers add contamination and chlorine decays over time. Dirty water reduces satisfaction; excessive chlorine produces visible sore/red eyes and an eye-relief errand. These numeric values are arcade variables, not real pool-maintenance measurements. Chemistry should create readable decisions and consequences.

### Cramp rescue — level 2 onward

Level 2 introduces an early cramp-prone swimmer. Later shifts vary susceptibility. Only one rescue can run at a time, and a rescue does not start during sanitation cleanup.

1. A swimmer cramps in the pool. Water activity stops, swimmers raise their hands, and a large life-ring cue identifies the victim.
2. The victim bobs more strongly, sways, and paddles their arms to look visibly distressed. Other swimmers gently bob while their simulation positions stay fixed.
3. Available wall rings gain rescue-only highlights and local lighting. Pick up a ring and approach the pool edge to enter automatically.
4. Swim with normal movement controls, holding the floating ring ahead. It transfers automatically within reach of the victim.
5. The coach swims back to an edge and climbs out. The victim floats to an end, climbs out, and walks to the recovery bench.
6. The pool resumes when the victim climbs out. The victim rests for four seconds, then returns to their original lane and unfinished workout with equipment preserved.
7. Retrieve the ring beside the bench and return it to its original hook.

During rescue, water swimmers' workout, sickness, and frustration progression pause; the shift clock and arrivals continue. Ordinary lane assignment is blocked during the rescue. Water entry is a rescue-specific capability, not general free swimming. Rescue must not count as a completed customer or create duplicate score.

### Stomach trouble, evacuation, and cleanup — level 3 onward

Earlier brainstorming placed this at level 2; **the implemented rule is level 3 and later**. Levels 1 and 2 must not spawn it unless the creator deliberately changes that progression.

A swimmer develops a 💩 warning and a ten-second draining meter. Select the swimmer and use **Send to locker** to prevent contamination, with a physical exit route and a prevention bonus. Sending a healthy swimmer home is penalized.

If the warning expires:

1. A floating 3D mess appears; water progressively browns, score drops, and the happy streak breaks.
2. Swimmers evacuate to the deck and panic with raised hands/jumping. The affected swimmer returns to the locker. Others retain their workout, equipment, and original lane.
3. Music changes to a faster, dissonant alarm arrangement.
4. Fetch the wall skimmer, approach the water within reach of the drifting floater, and press E or SCOOP. A cast takes 0.42 seconds and can miss if the target or coach leaves the valid range.
5. Carry the loaded skimmer to the waste bin, empty it, then return it to its hooks.
6. Fetch chlorine and treat the water only after the skimmer workflow is complete. Incident doses add 22 chlorine and remove 60 contamination. The displayed chlorine target is 40–65.
7. Once contamination is at most 25, chlorine is at least 40, and evacuation is complete, allow a three-second settling period before reentry.
8. Swimmers return to their original lanes and resume unfinished workouts. Excess chlorine does not block reopening; it can create subsequent eye-treatment work.

There is no automatic timed cleanup. The player must perform the complete recovery. During cleanup the shift clock holds, while arrivals and queue patience continue. Preserve that deliberate pressure difference from cramp rescue.

## Timing and pause rules

| State | Shift clock | Arrivals / queue | Pool activity |
| --- | --- | --- | --- |
| Countdown | Held | No active arrival progression | Held |
| Normal play | Advances | Advances | Advances |
| Cramp rescue | Advances | Advances | Water workouts and normal lane activity held |
| Sanitation cleanup | Held | Advances | Evacuation / manual cleanup / eventual reentry |
| Explicit pause or help pause | Held | Held | Held |

Changing tabs pauses active play/countdown. Pause must freeze doors and incident progression and clear held movement. Restart/menu transitions must clean up selection, effects, timers, and carrying state through a fresh simulation.

## Ten-shift season and scoring

| Level | Shift | Seconds | Scheduled swimmers | 1 / 2 / 3-star score |
| --- | --- | ---: | ---: | --- |
| 1 | Morning dip | 30 | 4 | 150 / 300 / 400 |
| 2 | Lunch rush | 60 | 8 | 600 / 1000 / 1400 |
| 3 | Peak panic | 90 | 14 | 1100 / 1800 / 2500 |
| 4 | Fin club | 120 | 20 | 1800 / 2900 / 3800 |
| 5 | Aqua hour | 120 | 21 | 1800 / 2900 / 3900 |
| 6 | Fast company | 120 | 22 | 2000 / 3100 / 4200 |
| 7 | Mixed company | 135 | 23 | 2100 / 3300 / 4500 |
| 8 | The relay | 135 | 24 | 2200 / 3500 / 4700 |
| 9 | Championship day | 150 | 26 | 2300 / 3700 / 5000 |
| 10 | Pool legend | 150 | 27 | 2400 / 3900 / 5300 |

Level 1 is a warm-up: only Beginners and Intermediates, eight-second workouts, no equipment requests or sickness, and no closing score penalty for unfinished visits. Two happy completions can earn three stars. Preserve its easy, quick success rather than balancing it like later shifts.

Later levels vary the mix, count, duration, and fin demand. Core difficulty scaling is capped at level 3, preventing endless inflation of patience and frustration pressure.

A served swimmer starts from 100 points, with happiness and service-quality bonuses for low wait, no collision, little slowdown, and compatible lane peers. Happy departures build multipliers: 1.2× at three, 1.5× at five, and 2× at eight consecutive happy departures. Angry or middling departures break the streak. Prevention adds 100; wrongful ejection costs 50; lane collision costs 50; a sanitation catastrophe costs 500. Outside the warm-up, unresolved visits at closing normally cost 100 each. The simulation is authoritative for exact scoring order.

One star unlocks the next level. Best scores and unlocks are device-local in `localStorage` under `pool-panic.records.v1`; existing older records migrate without reset. The HUD shows LEVEL X / 10. Results prioritize and focus **Next shift** when advancement is available, with **Replay level X** secondary. There are no accounts or cloud leaderboards.

## Audio, accessibility, and feedback

Music is intended from the menu onward, subject to browser audio permissions; the first user gesture unlocks Web Audio. Music and effects are procedural. Selection, countdown, doors, jumping, landing, dash, service, rescue, and sanitation provide synchronized cues. Panic changes the musical arrangement. Muting must work across those states.

Support keyboard and touch, native clickable swimmer tags, readable skill labels, help, pause, and responsive HUD/control placement. Keep tags below the measured scoreboard edge. Do not let menus or controls obscure the coach on short or portrait displays.

Respect reduced motion: use steady selection cues, remove dash streaks/lean and repeated rescue bobbing, suppress panic jumping, and use a static back-on-deck slip pose. Preserve gameplay meaning and collision separation even when decorative animation is reduced.

## Technical architecture

Self-contained static browser game using ES modules, locally included **Three.js 0.170.0**, and procedural Web Audio. There is no package/build pipeline or backend requirement. Google Fonts are optional with local fallbacks. Three.js and RoundedBoxGeometry license information is in `dist/assets/THREE-LICENSE.txt`.

| File | Responsibility |
| --- | --- |
| `dist/index.html` | Game shell, HUD, menus, controls, dialogs |
| `dist/style.css` | Arcade interface and responsive styling |
| `dist/app.mjs` | Runtime orchestration, UI, selection, pause, input routing, persistence, fixed-step loop |
| `dist/sim.mjs` | Seeded simulation, swimmer types, shifts, lane traffic, happiness, incidents, scoring |
| `dist/coach.mjs` | Arcade coach movement and physical interactions |
| `dist/sanitation.mjs` | Stomach warning, evacuation, skimmer workflow, chemistry recovery |
| `dist/rescue.mjs` | Cramp, rings, water movement, recovery bench and return |
| `dist/deck-physics.mjs` | Deck contacts, separation, passing and route cooperation |
| `dist/spatial.mjs` | Shared coordinates, stations, rings, collision boxes, movement tuning, arrival geometry |
| `dist/scene.mjs` | Procedural Three.js world, characters, camera, picking, animations and visual feedback |
| `dist/input.mjs` | Keyboard/touch intents and held input |
| `dist/guidance.mjs` | Shared world/HUD guidance state and pulse |
| `dist/progression.mjs` | Record normalization, stars and unlocks |
| `dist/audio.mjs` | Procedural music and effects |
| `dist/assets/` | Bundled Three.js, rounded-box helper and license |
| `*-check.mjs` | Deterministic regression and CPU scene checks |
| `artifacts/game-progress.md` | Historical sprint notes; some pending statements are historical, not current status |
| `artifacts/final-evidence.md` | Latest gameplay sprint verification record |
| `.openai/hosting.json` | Existing Site identity and static publishing directory |

Controller inheritance is `CoachController → SanitationController → RescueController → PoolSimulation`. The simulation emits events consumed by the presentation layer. Keep render animation from accidentally advancing gameplay state. The app uses a 60 Hz fixed simulation update; movement uses acceleration/braking, gravity, and simple collision proxies rather than a general rigid-body engine. The seeded simulation enables reproducible checks.

World X/Z directions differ from screen directions: screen right maps to +Z and screen up to +X. Reuse `screenMovement` and shared spatial definitions instead of applying ad hoc coordinate fixes.

### Run locally

From the full source checkout, serve the static directory over HTTP:

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. Do not open `index.html` through `file://`, which can block ES-module loading. No dependency installation or build is needed to play.

### Verify changes

Choose checks relevant to the change, with broader regression only for affected shared behavior:

| Check | Coverage |
| --- | --- |
| `node arrival-check.mjs` | Doors, arrivals, queues, return routes, pause |
| `node shift-check.mjs` | Warm-up, shift progression, countdown and stars |
| `node sprint-check.mjs` | Dash and guidance |
| `node coach-check.mjs` | Movement, interactions and carrying |
| `node simulation-check.mjs` | Lane traffic, resources, chemistry, scoring and deterministic shifts |
| `node sanitation-check.mjs` | Sickness prevention and complete manual recovery |
| `node rescue-check.mjs` | Cramp onset and physical pickup/swim/rescue/rest/return loop |
| `node deck-collision-check.mjs` | Deck contacts, crowded routes and destinations |
| `node exit-check.mjs` | Both-end exits, climbing, locker routes and fins |
| `node service-check.mjs` | Handoff rules and equipment behavior |
| `node scene-check.mjs` | CPU scene construction, poses, picking and camera math |

Read the selected test's imports before running it in a new environment. CPU scene checks use the runtime's canvas dependency and are not GPU rendering tests. Historical checks passed during implementation, but that is not a claim that this documentation update reran every suite.

The latest gameplay sprint verified backward slip poses, angry cues, differentiated cramp animation, preserved simulation positions, and service/rescue behavior through CPU/deterministic checks. **Live browser/GPU rendering, real device performance, and actual audio playback remain unverified in the recorded evidence.** Do not describe programmatic checks as a visual or listening pass.

## Direction already established by the creator

These decisions reflect iterative feedback and should survive future work:

- Keep the pool horizontal, the camera close, and the experience game-like rather than a website surrounding a small game.
- Integrate locker rooms into the room boundaries; keep clear, audible door arrivals and practical routes.
- Start the coach at the middle of the near deck; keep waiting swimmers at the left starting-block end.
- Teach selection with swimmer/emoji glow, then lane glow. Make world tags clickable.
- Use emoji plus Beginner / Intermediate / Pro words for clarity.
- Keep a visible countdown, a brief breathing space before the first swimmer, and an easy 30-second first level.
- Preserve the ten-level menu, obvious level indicator, stars, and Next shift as the primary successful-result action.
- Keep physical errands and a single carrying slot; equipment must not disappear during transitions.
- Make normal contacts gentle, fin slips backward and expressive, and rescue distress unmistakable.
- Let swimmers finish by swimming/climbing before walking around the deck.
- Let stomach failure visibly transform the pool and require a skimmer cleanup, disposal, return, and treatment.
- Keep music available from the menu and make emergencies audibly different.

Earlier notes sometimes describe superseded behavior: three levels instead of ten, a single life ring instead of three, narrower handoff reach, automatic cleanup, starting-end-only exits, or an at-wall cramp assist. The current systems above take precedence. Historical intent is useful context, not a reason to restore old implementations.

## Scope and future work

The implemented prototype is single-player, with ten finite shifts, four swimmer types, three lanes, local progression, equipment errands, chemistry, deck/lane collisions, cramps, lost goggles, and stomach emergencies.

Children, families, divers, multiplayer, accounts, network leaderboards, additional maps, and other expansions are **outside the current prototype**, not promised features. No monetization model, release platform beyond the browser, or expanded production roadmap has been established in this brief.

Future design should deepen readable interactions and the one-more-shift feeling. Add an incident only when its warning, response, recovery, timing, and interaction with existing incidents are understandable. Do not introduce an incident-frequency formula or expand scope based on guesses about past conversations.

## Working agreement for future agents

1. Read this brief, the actual affected modules, and relevant checks. Distinguish implemented behavior, historical requests, and your own proposals.
2. Confirm you have the full Site source. Verify that the checkout includes `dist/` and the supporting checks. Preserve the existing Site identity when editing or publishing.
3. Preserve established layout, controls, inventory conservation, local records, and incident timing unless the requested change explicitly alters them.
4. Update coordinates, meshes, hit targets, routes, and collision proxies together when moving equipment or architecture.
5. Preserve continuous physical movement and swimmer identity, lane, equipment ownership, and unfinished workout through recovery.
6. Keep simulation state authoritative. Bobbing and other cosmetic motion must not move frozen gameplay positions.
7. Use the smallest coherent change; do not add a framework, backend, multiplayer system, or unrelated redesign as routine cleanup.
8. Verify the concrete risk with relevant existing checks; for visual changes, distinguish CPU evidence from an actual browser pass.
9. Update this README when behavior or vision changes. Record what changed and any material verification limits.
10. Be explicit about where changes were saved: Site source and GitHub are separate unless a synchronization workflow is deliberately established.

### Prior implementation references

Earlier work consulted Game Director, Gameplay Systems, Game UI Designer, and Graphics Builder guidance from https://github.com/majidmanzarpour/threejs-game-skills at revision `e5f301d548bb18c530afbece78cd25082f4cda9c`. This records provenance, not an installed dependency or a requirement to import a new framework. The current repository and creator's direction remain authoritative.
