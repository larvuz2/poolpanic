# Pool Panic

> A playful 3D swimming-pool management game: three lanes, then five, endless little disasters, one more shift.

This README is the project brief and agent onboarding guide. It combines the creator's direction with the implemented prototype as inspected on September 26, 2026, updated on September 27, 2026 for the chaos incidents, the Splash Park (then called the Riviera Splash Resort) and levels 11–15, and on September 29, 2026 for the campaign map, chunks and acts, mid-shift twists, drills and bookings, and again for levels 16–20, the Sunset Lagoon and Grand Gala Arena, VIP guests, the storm twist and the Coach Cam environments. Read it before changing the game. Descriptions marked as current refer to the code; proposed possibilities are not commitments or implemented features.

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
- Netlify: `netlify.toml` configures continuous deployment straight from the GitHub repository (see [Deploy on Netlify](#deploy-on-netlify)).
- The existing game source belongs to the ChatGPT Site's separate source repository. Its manifest is `.openai/hosting.json`.
- On September 26, 2026, the complete Site source and this README were copied into GitHub. Both now contain the game; future changes do **not** automatically synchronize between them.
- In the full Site checkout, `dist/` contains the editable runtime source, not merely disposable generated output. There is no build step. If this README is present but `dist/` is absent, you have the documentation-only checkout and must open the existing Site source before editing gameplay.

## Core loop

1. Choose an unlocked shift on the campaign map: two acts of ten levels, each act three chunks of three levels plus a finale (levels 1–10 at the Community Swim Club; Act 2 opens at Splash Park with levels 11–16, moves to the Sunset Lagoon for 17–19 and ends with the level 20 finale in the Grand Gala Arena). From level 11 the club offers a booking first.
2. Begin with a synchronized three-second countdown.
3. Watch a locker door open and a swimmer walk to the waiting area.
4. Select the swimmer by their world character, clickable name/emoji tag, queue card, or nearby interaction.
5. Assign one of three lanes (five in Act 2), considering speed, occupancy, and stationary aqua aerobics. Swimmers already in the water can be moved to another lane mid-workout.
6. Move the coach to provide equipment and treatments, recover dropped gear, maintain water, and respond to incidents, from cramps to a fish loose in the pool.
7. Swimmers finish, swim to an end, climb out, walk around the pool, and return to their locker room.
8. Earn score and stars; unlock the next shift and improve device-local best scores. Clear all three levels of a chunk and the next area opens on the map.

A lane assignment is a management action. Equipment pickup, handoff, cleanup, and rescue retain proximity and physical movement requirements.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move the coach relative to the screen; swim during a permitted rescue |
| Space | Jump; climb out near a pool edge during rescue |
| Shift | Short dash with an internal cooldown |
| E | Contextual nearby interaction: pickup, handoff, selection, disposal, return, or drop |
| Click swimmer / swimmer tag / queue card | Select a swimmer |
| Click lane / lane button, or 1–5 | Assign the selected waiting swimmer, or move a selected swimmer who is already in the water |
| T / click the trampoline tower | Send the selected daredevil to the trampoline (Splash Park) |
| Click gear, a visitor or an injured swimmer | Act if the coach is in reach (grab the net, patch someone up); otherwise point the way |
| F / C / R | Guidance toward fins / chlorine / eye relief |
| P / Escape | Pause behavior through the game's input/UI routing |
| M | Toggle audio |
| V | Switch between the overview and the Coach Cam (first-person view) during a shift |
| Mouse / drag in the Coach Cam | Look around; with the mouse captured, click acts on what the crosshair is on. ← / → turn instead of strafing, and the wheel sets the field of view |
| Touch controls | Movement and actions using the same gameplay intents |
| Fullscreen button | Fullscreen where supported by the browser |

Dash lasts 0.16 seconds with a 0.82-second cooldown. There is deliberately no dash cooldown meter. It supports carrying and jumping, uses collision substeps, and has streaks and a swoosh. Directional input is normalized so diagonal movement is not faster.

## Space, camera, and art direction

The pool's long axis reads horizontally on screen. The camera is a close, elevated, across-pool view with gentle following and extra edge panning to keep the coach and nearby equipment visible. Preserve this orientation when adjusting the scene.

The camera eases out on its own when a big moment has to share the screen with the coach: while a daredevil is on the trampoline tower, and while crash victims wait in the water. It corrects only the axis that left the safe area, so it never drifts sideways.

The coach starts midway along the near deck. The starting blocks, queue, and arrival routes are at the left/locker-room end. Both locker bays are integrated into the wall, not isolated islands in the middle of the room. The office sits in the upper-right corner. The clubhouse end was extended to make room for arrivals and traffic.

The club uses warm sand/terracotta tiles, muted teal walls, glowing high windows with light shafts, and a continuous tiled environment behind the HUD. Splash Park is open-air: sandstone pavers, a blue-and-white mosaic band around the basin, a plastered facade with terracotta roof tiles, cabanas, palms, loungers, a snack kiosk and the trampoline tower. Lighting presets (`indoor`, `day`, `golden`, `sunset`, `dusk`, `night` and the arena's `gala`) set the sky, sun, fill, fog, image-based environment and water tint; underwater lamps light the pool after dark. The open-air moods sit on one shared time-of-day scale (see [Environments](#environments-skies-weather-and-halls)). Textures are generated procedurally from seeded canvases, and the basin floor and walls carry animated caustics. The UI uses dark teal arcade scoreboard surfaces, yellow primary actions, swimmer passes, inventory slots, lane plaques, and emojis. Preserve the toy-like low-poly identity and readable game presentation.

Geometry, interaction hit volumes, collision proxies, camera framing, and routes must agree. The fin and chlorine fixtures were rotated 90 degrees for the horizontal presentation. Swimmers finishing at either end swim to the nearer end wall, climb out, and walk around the outside. Their water, climbing, and deck poses are distinct.

## Coach Cam — optional first-person view

A switch on the welcome panel turns shifts into a physical first-person view, and **V** flips between it and the overview mid-shift. It is off by default and remembered per device in `localStorage` under `pool-panic.settings.v1`. The overview stays the default and the reference framing for the game.

- **The camera is the coach's eyes.** It sits at eye height (1.52 m), just above the water while swimming, and travels through dives and climbs. The coach's own body is hidden. Two cartoon forearms (yellow track-jacket sleeves) and whatever the coach carries are drawn in a second pass with their own narrower field of view (56° vertical), so they read clearly and never clip into the world.
- **Field of view.** 92° horizontal at 16:9, adjustable from 80° to 105° with the mouse wheel or the zoom buttons; the recentre button restores 92°. The vertical angle is kept between 50° and 78°, so phones in portrait are capped instead of fish-eyed. Pitch is limited to ±80°.
- **Two motion systems.** The camera follows the coach directly and stays steady when the coach bumps into things. It only bobs 1–2 cm walking and about 3 cm dashing, dips about 3 cm on landing, kneels while bandaging, and tips back on a slip. The hands hang off springs that settle in roughly 100–200 ms:
  - they keep part of their place in the world on a fast turn and swing after the view;
  - walking, they swing and bounce 2–4× more than the camera;
  - they drop on a jump and squash on landing;
  - they reach toward whatever is grabbed or handed over, and hold up the red card;
  - they fly up on a slip.

  Reduced motion removes the head bob and hand sway.
- **Items live in the hands, not on the camera.** Fins, the chlorine bucket (heavy, so on slower springs), eye relief, goggles, dog treats and the medkit sit in the hands. The flashlight lights the hands during a blackout, the life ring is held in both hands, and the skimmer and fish net are held on poles. Dangling things swing like pendulums. With a fish in the net, the hoop comes right up to the coach's face and the fish fills the screen.
- **Looking and acting.** W / S walk along the view, A / D step sideways, ← / → turn. Clicking the pool captures the mouse for looking around, and Esc frees it. With the mouse captured, a click acts on whatever the crosshair is on, and the crosshair names it: select a swimmer, then look at a lane and click to send them there. Without capture, drag to look; on touch screens, drag to look and tap to act. E still uses the nearest interaction, but prefers anything within 45° of the view over what is behind.
- **HUD.** The E prompt sits just above the hands. It only shows when something is in reach, or when the coach is busy, swimming or slipping. Swimmer tags further than 16 m away are hidden.
- **Simulation contract.** The app mirrors the view's heading into `sim.coach.lookAngle`. While it is set, the coach faces where the player looks (walking and swimming) and `nearestInteraction` ranks options off to the side lower. With the Coach Cam off it is `null` and the simulation behaves exactly as before. `dist/scene/coach-cam.mjs` is pure view code: it reads the simulation and never changes it.

## Environments: skies, weather and halls

The overview shows the pool and its deck; the Coach Cam shows the world around them. Every venue is either open-air or a hall (`scenery` / `indoor` on the venue in `spatial.mjs`), and both are built to be looked at from eye height. All of it is presentation: the simulation never reads it, and every builder is headless-safe (the CPU checks build the world with a stub canvas).

**Open air: Splash Park and the Sunset Lagoon** (`dist/scene/sky.mjs`, colours from `dist/scene/daylight.mjs`). A sky dome, clouds, hills, the sea and a horizon surround the deck. They are drawn only in the Coach Cam, so the overview stays the clean tabletop it always was.

- **One time-of-day scale.** 0 noon, 0.3 afternoon, 0.52 golden hour, 0.68 sunset, 0.83 dusk, 1 night. The classic `day`, `sunset` and `night` moods sit on it, and a shift can slide along it (`daylight: [from, to]` in `SHIFTS`), so the sun sets *during* the three Lagoon shifts: the dome, sun disc, clouds, fog, light, water and lamps all follow one clock.
- **What is up there.** A three-band gradient dome with a sun disc and halo, and a moon and stars after dark; flat-shaded cartoon clouds that drift and take the colour of the hour; three rings of hills; a sea with a glitter road and foam; a lighthouse whose beam sweeps at night; sailboats, gulls with flapping wings and hot-air balloons; paper lanterns and fireflies once the light goes.
- **Storm.** The storm twist darkens the dome, brings in heavy clouds and GPU-drawn rain; lightning flashes light the whole scene and are followed by thunder.
- **Sunset Lagoon** (`dist/scene/lagoon.mjs`): a plank boardwalk around the pool with a beach house (thatch canopy, neon sign, portholes, surfboards, paper lanterns), a tiki bar with an animated bartender, palapa umbrellas, swaying palms (wind runs on the GPU), torches, a bonfire with embers, a flag mast with bunting, a volleyball net, a rowboat, a sandcastle, a surf shack and crabs.

**Halls: the Community Swim Club and the Grand Gala Arena** (`dist/scene/hall.mjs`, `hall-dressing.mjs`, `hall-kit.mjs`, `hall-art.mjs`). The whole building, built from one small spec each (`CLUB_HALL`, `ARENA_HALL`): a roof profile (the club's timber gable rises to 16.8 m, the arena's steel barrel to 28 m), trusses (timber or lattice), arched clerestory windows, skylights with light shafts, ridge flags (a 12-design flag atlas), bunting, banners, pendant lamps with pools of light, ceiling fans, ducts, signs and a gallery. In the overview the upper shell is cut away like a dollhouse so it never hides the pool; in the Coach Cam it is all there, up to the flags at the very top.

- **Grand Gala Arena** (`dist/scene/arena.mjs`, `crowd.mjs`): a stage with an LED screen and a chasing-light marquee, a rotating trophy, three grandstands of instanced spectators who cheer on every save, scrolling LED ribbons, a hanging scoreboard cube that shows the live score, time and stars, two sweeping spotlight rigs with floor decals, balloons and confetti cannons.
- **Lights.** A blackout dims everything that glows (`world.dimmers`), from pendant lamps to the marquee and spotlights, and lightning flashes reach into the halls too.
- **Reduced motion.** The scenery's clock stops (`updateEnvironment` in `dist/scene.mjs`): flags, palms, fans, waves, clouds, spotlights and the marquee hold one pose, the gulls stay away, lightning flashes are dropped and the crowd stays seated. What follows the game still updates: the scoreboard, the hour and the weather.

## Swimmers, lanes, and happiness

| Internal type | Player label | Cue | Behavior |
| --- | --- | --- | --- |
| `beginner` | Beginner | 🐢 / green | Slow; sensitive to crowding and sharing with Pros |
| `intermediate` | Intermediate | 🏊 / blue | Medium lap speed |
| `advanced` | Pro | ⚡ / coral | Fast; loses satisfaction when blocked by slower traffic |
| `aqua` | Aqua aerobics | 💦 / purple | Exercises in place and obstructs lap traffic |
| `daredevil` | Daredevil | 🤸 / orange | Act 2 only. Refuses lanes; only uses the trampoline |
| any lap type, `vip` | VIP · Pro / Intermediate / Beginner | 👑 / gold | Levels 17–20. Tips big, waits little (see below) |

The internal `advanced` identifier still maps to the visible label **Pro**. Keep the skill words beside the emojis so icons are not the only explanation.

With fewer than three occupants, lanes use split movement; at three or more, circle-swimming restrictions propagate the actual speed of swimmers ahead. Mixing speeds can produce queues, frustration, collisions, and lost goggles. Stationary aqua participants slow passing lap swimmers and dislike sharing with them. Fins increase lap speed by 30%, which also affects lane compatibility.

Happiness responds to waiting, blocked speed, crowding, water contamination, unresolved needs, collisions, and fin trips. Queue patience begins after arrival. Swimmers can abandon the visit when happiness runs out. Assigning lanes sensibly and responding promptly improves outcomes.

## Arrival, selection, and onboarding

- Every start, retry, and next shift begins with 3–2–1 and matching beeps. Gameplay movement, shift time, and arrivals wait for Go.
- The first door begins opening 3.4 seconds after Go. The swimmer walks through and becomes selectable at the queue within roughly five seconds of Go.
- Later arrivals alternate locker rooms. Doors open for departing swimmers too, without the arrival chime.
- The first swimmer is **not automatically selected**. A shared yellow pulse links the waiting swimmer and their badge.
- Selecting a waiting swimmer produces a two-note sound and highlights the lane targets in both the world and HUD.
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
| Fish net | Hangs on its wall hook. Grab it when a fish is loose, dive in, net the fish, hand it back to the kid, hang it up. |
| Dog treats | A jar on a table (club) or at the kiosk (Splash Park). Lures a loose dog; the treat is spent when the dog leaves. |
| Flashlight | Needed to find the right breakers in a blackout. Return it to its holder afterwards. |
| Medical kit | Splash Park cabinet. Carry it to each crash victim lying on the deck, kneel (E or click) to bandage them, then put it back. |

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

During rescue, water swimmers' workout, sickness, and frustration progression pause; the shift clock and arrivals continue. Ordinary lane assignment is blocked during the rescue. Water entry is a mission-specific capability (a life ring during a rescue, or the net while a fish is loose), not general free swimming. Rescue must not count as a completed customer or create duplicate score.

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

## Chaos incidents — level 4 onward

Each shift from level 4 schedules incidents from a seeded plan (`chaos` entries in `SHIFTS`: which kinds, and a time window). A separate random stream drives them, so swimmer generation is identical with or without chaos. `maxChaos` caps how many run at once (1, or 2 on the legend levels); an incident that cannot start yet is retried a moment later, and none start in the last 14 seconds. Every incident follows the same shape: a visible warning, a prevention window worth a bonus, a comic failure with a cost, and a full physical recovery.

| Incident | Warning and prevention | If missed | Recovery |
| --- | --- | --- | --- |
| 🐟 Fish Kid | A kid walks in carrying a bucket with a big fish and dodges once. Catch the kid on the deck and press E (+100). | The fish goes in (−200). Everyone races to the walls, leaps out and runs around in panicked circles. The pool closes and the shift clock holds while queue patience keeps draining. | Grab the fish net and walk to the edge to dive in. The fish flees, darts when cornered and tires; cut it off and net it (+75). Swimmers return to their lanes and unfinished workouts. Hand the fish back to the kid (+50) and hang up the net. |
| 🐕 Loose Dog | A dog trots in and starts sniffing around. | It steals fins and clutter (fins stay counted), bowls walkers over, jumps in and shakes out slippery puddles, and gets the zoomies. | Grab the treats; the dog follows while you keep them close. Lead it to a locker door (+150). |
| 💣 Cannonball Carl | Carl barrels toward the edge yelling. Red-card him first (E, +100) and he joins the queue as an ordinary customer. | Each cannonball costs 60 and breaks the streak, stalls nearby swimmers, knocks goggles onto the deck and floods the edge with puddles. He climbs out and runs to a new spot. | Red-card him on dry land (+150) and he leaves. |
| ⚡ Power Outage | Lights flicker and the fuse box sparks for 7 seconds. A quick reset (0.8 s at the box) prevents the blackout (+100). | Blackout (−100): emergency lighting and lightning, swimmers bump into each other in the dark, lose goggles and grow grumpy. | Fetch the flashlight, flip the breakers (1.4 s, +100), return the flashlight. |

Puddles are deck hazards like dropped fins: anyone running across one slips, the coach included, until it dries. Visitors walk through the locker doors like everyone else. The music switches to the panic arrangement while an incident is at its worst.

## Act 2: Splash Park, the Sunset Lagoon and the Grand Gala Arena (levels 11 to 20)

Act 2 opens at Splash Park, a second venue (`resort` in the code; called the Riviera Splash Resort until September 29, 2026) with a five-lane pool and a trampoline tower on the far deck whose landing zone is in lane 5. `spatial.mjs` defines both venues from one pool-geometry function, so routes, collision boxes, service points and the camera adapt to the wider basin.

- **Daredevils** queue like everyone else but only want the tower. Select one and press **T** (or click the tower or the TRAMP button). They walk to the stairs and wait.
- **The splash lane.** While a daredevil waits, lane 5 is closed to new swimmers and glows orange. The moment it is empty, the daredevil climbs, bounces three times and lands a one-and-a-half front flip (+250, a served, happy customer).
- **Moving swimmers.** Select a swimmer who is already swimming and pick another lane: they duck under the ropes and keep their workout progress. This is how you empty lane 5 in time.
- **Crash.** A daredevil's patience runs out after 11–16 seconds (per shift). If anyone is still in lane 5 when they land, up to two swimmers are hit, along with the daredevil (−300). Every swimmer freezes and the shift clock holds.
- **A ring for every victim.** Carry a life ring to the edge, dive, and swim it to one victim; they swim out on their own. Climb out and fetch another ring for the next. The pool reopens when every victim is out of the water.
- **First aid.** Victims limp clear of the edge, lie down and slowly lose happiness. Fetch the medical kit, kneel beside each one (E or click them) to bandage them (+50 each). Healed lap swimmers return to their lane; the daredevil goes home happy anyway. Put the kit back.

### Sunset Lagoon and Grand Gala Arena

Both reuse Splash Park's floor plan exactly (`RESORT_SPEC` in `spatial.mjs`): the same five lanes, tower, stations, routes and collision, so every system works unchanged, dressed differently (see [Environments](#environments-skies-weather-and-halls)).

- **Sunset Lagoon** (`lagoon`, levels 17–19): an open-air boardwalk resort by the sea. The three shifts are one long evening: *Golden hour* (`daylight` 0.40–0.56), *Sunset splash* (0.56–0.74) and *Storm front* (0.74–0.90) slide the sun down the shared time-of-day scale, each ending where the next begins. Because the sky moves on its own, the night booking is not offered.
- **Grand Gala Arena** (`arena`, level 20, the Act 2 finale): an indoor showpiece with warm spotlights over a dark hall, a stage, grandstands and a scoreboard. 40 swimmers in 180 seconds, four incident windows (two at once) and three twists: a swim team at 22%, a lane closure at 48% and a rush of six at 72%.

### VIP guests — levels 17 to 20

A VIP is an ordinary lap swimmer in a gold suit with a crown and a crimson sash (`vipAt` in `SHIFTS` lists where in the arrivals they come; a VIP never takes a daredevil's slot). They tip big: **+150** on top of a served swimmer's points, before the streak multiplier. But they wait less (75% of the normal patience) and in the water being blocked, crowded or in dirty water costs their happiness 1.4× faster. A VIP who storms out costs **−300** instead of −100. They never come with sickness, cramps or a fin request. The queue card and swimmer tag show 👑 and "VIP · Pro" (`swimmerLook` in `dist/sim.mjs`), and the first one of a shift gets a toast. Golden hour introduces them; the results screen counts them (`stats.vips`).

### Storm — level 19 and the Storm drill

The storm twist (see below) is weather the whole scene shares: `stormLevel()` in `dist/chaos.mjs` ramps 0→1 over six seconds and the sky, light, fog, water and lamps follow it, with rain from about 30% and lightning from 50%, each strike followed by thunder (reduced motion keeps the storm but drops the flashes). From 70% on, a rain puddle forms on the deck every 2.6–4.4 seconds, half of them where people walk to the water, never within 2.2 m of the coach, at most six at once. They are ordinary puddles: anyone who walks across one slips (a swimmer loses a little happiness), and jumping over them works. Each dries in about 14 seconds.

## Incident moments: stings, the loud alert, and payoffs

Chaos only feels funny when the player can read it, so every problem announces itself the same way, one thing at a time points to where to go next, and every save pays off.

- **Stings.** When an incident starts or gets worse, a big sign slams in and names it together with the action, e.g. "LOOSE DOG! Grab the treats · lead Biscuit out". The game slows down for a moment, the overview camera glides over to make room for the incident, and each incident has its own sound. The sign then flies up into the incident banner, which keeps the current step. Stings replace the warning toast they would duplicate.
  - The first time a player meets an incident, the sting runs longer, the game nearly stops, and a one-line lesson explains how it works (a "NEW" tag marks it). Seen incidents are remembered per device in `localStorage` under `pool-panic.seen.v1`, so later stings are short.
  - Incidents that sting: cramp, tummy trouble, the accident in the pool, fish kid, fish in the pool, loose dog, Cannonball Carl, flickering lights, blackout, a daredevil waiting over a busy splash lane, the daredevil jumping anyway, and a crash. A clean jump into an empty lane is not an incident.
  - Two incidents at once queue rather than stack. Reduced motion keeps the camera still and drops the bounce, but keeps the slow-down and the sign.
- **The loud alert.** Of everything going on, only the most urgent problem is loud (nearest first on a tie). A marker sits over its *next* target, not just the problem: the life ring before the victim, the treats before the dog, the flashlight before the fuse box in a blackout. When that target is off screen or under the HUD, an arrow at the edge of the safe area points to it, with the distance. In the Coach Cam, a target behind the player puts the arrow on the side to turn toward, sliding down to "behind you". Urgency, highest first:
  1. someone in the water waiting for a ring;
  2. flickering lights;
  3. the fish kid;
  4. Carl before his first cannonball;
  5. tummy trouble;
  6. a busy splash lane;
  7. Carl after a cannonball;
  8. the blackout;
  9. fish in the pool and first aid;
  10. the dog and the accident cleanup;
  11. returning the fish.
- **Fuses.** Timed threats drain a fuse on the incident banner: the flicker's seconds, the fish kid's and Carl's run to the edge, and a daredevil's patience. The fuse blinks red when it is nearly out.
- **Payoffs.** Every save freezes the game for a beat (0.07–0.15 s). Confetti bursts from the spot, the crowd cheers, and a rubber stamp slams down with the points, replacing the usual "+points" pop. The stamps are: RESCUED!, GOOD CATCH!, ALL CLEAN!, SAVE!, GOT IT!, HAPPY KID!, GOOD DOG!, RED CARD!, LIGHTS ON!, STUCK IT! and PATCHED UP!.

How it is built:
- **The simulation reports facts.** `incident(kind, where)` and `save(kind, where, points)` emit events. Each layer and each incident's `alert()` hook feeds `loudestAlert()`.
- **`dist/moments.mjs` decides how they land, with no DOM:**
  - the sting and stamp text;
  - first sightings;
  - queueing;
  - the time scale (slow motion and hit-stop);
  - the edge-arrow geometry.
- **The rest renders it.** The app draws everything. The world adds `focusMoment`, `screenPoint` and `burst`, and the audio engine adds `sting` and `cheer`.

Slow motion and hit-stops slow the whole simulation, the shift clock included, so a sting never costs the player time. Menus always run at full speed.

## Timing and pause rules

| State | Shift clock | Arrivals / queue | Pool activity |
| --- | --- | --- | --- |
| Countdown | Held | No active arrival progression | Held |
| Normal play | Advances | Advances | Advances |
| Cramp rescue | Advances | Advances | Water workouts and normal lane activity held |
| Sanitation cleanup | Held | Advances | Evacuation / manual cleanup / eventual reentry |
| Fish loose in the pool | Held | Advances | Everyone out, panicking on deck |
| Trampoline crash rescue | Held | Advances | Every swimmer frozen until all victims are out |
| Dog, Carl, flicker, blackout | Advances | Advances | Advances (with the incident's disruption) |
| Explicit pause or help pause | Held | Held | Held |

Changing tabs pauses active play/countdown. Pause must freeze doors and incident progression and clear held movement. Restart/menu transitions must clean up selection, effects, timers, and carrying state through a fresh simulation.

## Twenty-shift season and scoring

| Level | Shift | Venue · light | Seconds | Swimmers | Chaos | 1 / 2 / 3-star score |
| --- | --- | --- | ---: | ---: | --- | --- |
| 1 | Morning dip | Club | 30 | 4 | — | 150 / 300 / 400 |
| 2 | Lunch rush | Club | 60 | 8 | — | 600 / 1000 / 1400 |
| 3 | Peak panic | Club | 90 | 14 | — | 1100 / 1800 / 2500 |
| 4 | Fin club | Club | 120 | 20 | Dog | 1800 / 2900 / 3800 |
| 5 | Aqua hour | Club | 120 | 21 | Fish | 1800 / 2900 / 3900 |
| 6 | Fast company | Club | 120 | 22 | Carl | 2000 / 3100 / 4200 |
| 7 | Mixed company | Club | 135 | 23 | Outage | 2100 / 3300 / 4500 |
| 8 | The relay | Club | 135 | 24 | Dog or fish, then Carl or outage | 2200 / 3500 / 4700 |
| 9 | Championship day | Club | 150 | 26 | Three incidents | 2300 / 3700 / 5000 |
| 10 | Pool legend | Club | 150 | 27 | Three, two at once | 2400 / 3900 / 5300 |
| 11 | Splash landing | Park · day | 120 | 18 (3 daredevils) | Trampoline only | 2200 / 3400 / 4600 |
| 12 | Flip Friday | Park · day | 135 | 22 (4) | Fish | 2600 / 4000 / 5400 |
| 13 | Beach party | Park · sunset | 135 | 24 (3) | Carl, then dog | 3000 / 4600 / 6300 |
| 14 | Moonlight swim | Park · night | 150 | 26 (4) | Outage, then fish or Carl | 3300 / 5000 / 6800 |
| 15 | Lantern night | Park · night | 165 | 30 (5) | Three, two at once | 3500 / 5300 / 7200 |
| 16 | Midnight rush | Park · night | 165 | 34 (5) | Three, two at once | 3800 / 5700 / 7700 |
| 17 | Golden hour | Lagoon · golden hour | 135 | 26 (4) · 2 VIPs | Fish or dog, then Carl | 4600 / 6900 / 9200 |
| 18 | Sunset splash | Lagoon · sunset | 150 | 30 (4) · 3 VIPs | Carl or fish, then dog or outage | 3800 / 5700 / 7700 |
| 19 | Storm front | Lagoon · dusk, then storm | 165 | 34 (5) · 4 VIPs | Three, two at once | 5300 / 8000 / 10800 |
| 20 | Grand gala | Arena · gala | 180 | 40 (5) · 5 VIPs | Four, two at once | 5000 / 7500 / 10000 |

Star targets for levels 4–20 are checked against `season-check.mjs`: a bot that manages lanes instantly and handles every incident, but never delivers fins, eye relief or goggles, averages at least one star and fewer than three on every level. Three stars need service play on top. Splash Park targets were raised after these playthroughs showed that five lanes plus flips made the original numbers too generous; the Lagoon and Arena levels were tuned the same way, with the VIPs' tips counted in.

Level 1 is a warm-up: only Beginners and Intermediates, eight-second workouts, no equipment requests or sickness, and no closing score penalty for unfinished visits. Two happy completions can earn three stars. Preserve its easy, quick success rather than balancing it like later shifts.

Later levels vary the mix, count, duration, and fin demand. Core difficulty scaling is capped at level 3, preventing endless inflation of patience and frustration pressure.

A served swimmer starts from 100 points, with happiness and service-quality bonuses for low wait, no collision, little slowdown, and compatible lane peers. Happy departures build multipliers: 1.2× at three, 1.5× at five, and 2× at eight consecutive happy departures. Angry or middling departures break the streak. Prevention adds 100; wrongful ejection costs 50; lane collision costs 50; a sanitation catastrophe costs 500. Chaos incidents add their own bonuses and costs (see above); a clean trampoline flip scores 250 with the streak multiplier. Outside the warm-up, unresolved visits at closing normally cost 100 each. The simulation is authoritative for exact scoring order.

One star clears a level and unlocks the next. **Playtesting (until further notice):** `UNLOCK_ALL` in `dist/progression.mjs` is `true`, so every built level is open to everyone and the map carries a small "ALL LEVELS OPEN FOR TESTING" note. Saved progress keeps recording real unlocks and stars, so setting it back to `false` restores star-gated progression without anyone losing progress; adding `?locked` to the URL previews that on any device. Best scores, unlocks and drill bests are device-local in `localStorage` under `pool-panic.records.v1` (older records migrate without reset, including ten-level saves and saves from before drills); reveals still waiting for the map are under `pool-panic.map.v1`. The HUD names the chunk ("WARM-UP · 2 OF 3", "ACT 1 · FINALE", "DRILL"). Results prioritize and focus **Next shift** when advancement is available (**Next area ↗** when a chunk was just cleared), with **Replay level X** secondary. There are no accounts or cloud leaderboards.

## The campaign map: acts, chunks, twists, drills and bookings

The menu is a map, not a list. Levels come in **chunks of three**; three chunks and a **finale** make an **act** of ten levels. The whole campaign is on the map at once, so the player always knows the next new place is at most three shifts away. The references were Overcooked's world map and Dear Passengers' routes.

| Act | Chunks (levels) | Finale |
| --- | --- | --- |
| 1 · Community Pools | Warm-up (1–3), Mischief (4–6), Showtime (7–9) | Pool legend (10) |
| 2 · Splash Park | Trampoline (11–13), Moonlight (14–16), Sunset (17–19) | Grand gala (20) |

All twenty levels are built. A slot the season has not built yet (`buildCampaign(n)` takes the number that exist) would still be drawn as a dashed "soon" ghost under clouds, so the shape of the campaign stays visible while it grows. Act 2 travels: Splash Park (11–16), the Sunset Lagoon (17–19) and the Grand Gala Arena (20).

- **Level numbers never move.** Saved records are keyed by level number. Acts and chunks are only a view over `SHIFTS` (`dist/campaign.mjs`), so a new shift fills the next ghost, and the layout, art and checks cover twenty levels.
- **The picture.** One floating isometric island per zone, in the game's own colours (sand, terracotta, teal, cream clouds). `dist/map-art.mjs` draws it as pure SVG strings and `dist/map.mjs` lays the buttons, tags and coach over it. Sky and vignette are CSS; three edge-cloud layers drift on the compositor, so the map costs no repainting.
- **The levels.** Each is a round button: cream when open, yellow with its stars when cleared, a pulsing ring where the coach stands (the first level you have not cleared), a lock or a dashed ghost otherwise. The route turns yellow behind cleared levels. Under each island a small tag names the chunk with three dots ("WARM-UP ●●○"); the selection panel and the results screen show the same dots ("WARM-UP · 2 OF 3").
- **Clearing a chunk.** One star or more on all three levels clears it, and the results button becomes **Next area ↗**. Back on the map the clouds lift off the next island, its pieces pop in and the coach walks on to it. The reveal is remembered until the map has been seen. Clearing a finale opens the next act and the map switches to it.
- **Layouts.** A wide staircase of islands on desktop and a tall zigzag that scrolls on phones, upright tablets and short windows. Two act tabs at the top switch acts and carry a thin progress bar. Tap a level to select it, tap it again (or START, or Enter) to play; arrow keys walk the route.
- **The 3D pool.** The map covers it, so after three warm-up frames the menu neither updates nor draws the scene until a shift starts.

### Mid-shift twists

Some way into a shift (from 22% to 74% of it) the room changes the rules, the way an Overcooked kitchen changes its layout. A twist is not an incident: there is nothing to fix or save, only a new condition for the rest of the shift, announced with a sting. `twist` entries in `SHIFTS` ride in the same plan as chaos (a check that empties `chaosPlan` empties them too), wait out a rescue, a cleanup or a closed pool, ignore `maxChaos`, and are skipped in the last 14 seconds (`dist/incidents/twist.mjs`). A shift may have up to three: Storm front (a rush, the storm, a swim team) and the Grand gala do.

| Twist | Effect | Levels |
| --- | --- | --- |
| 🚌 Rush | A crowd arrives together, woven into the arrivals still to come | 2, 12, 16, 18, 19, 20 (and the Tour group booking) |
| 🚧 Lane closure | Lane 2 goes out of service for the rest of the shift: nobody can be sent or moved into it, swimmers already in it finish. Never the splash lane | 8, 10, 14, 15, 20 |
| 🏅 Swim team | Most later arrivals are Pros | 10, 15, 16, 18, 19, 20 |
| 💦 Aqua class | Most later arrivals are aqua aerobics | 5 |
| ⛈️ Storm | The sky darkens and the rain arrives; rain puddles keep forming on the deck (see above) | 19 (and the Storm drill) |

### Drills

Every chunk has a **drill**: a short (75–80 second) bonus shift that repeats the chunk's trickiest idea with nothing else going on, with its own stars and best score. The dashed badge beside the chunk opens once the chunk is cleared with 5 stars in total (or while everything is open for testing). Drill scores live in `records.drills` and never affect level progress (`dist/drills.mjs`).

| Chunk | Drill |
| --- | --- |
| Warm-up | 🥪 Lunch line |
| Mischief | 🐟 Fish frenzy |
| Showtime | ⚡ Blackout drill |
| Trampoline | 🤸 Daredevil hour |
| Moonlight | 💣 Cannonball club |
| Sunset | ⛈️ Storm drill (the lagoon at dusk: a storm at 12%, two VIPs) |

### Bookings

From level 11 the club offers **three bookings** before every Act 2 shift: Regular plus two others from a seeded shuffle (the same shift always offers the same). A booking is pure data folded into a copy of the shift (`applyBooking` in `dist/bookings.mjs`): a payout multiplier on what served swimmers and clean landings earn (the streak multiplier is separate) and the extra trouble it brings. A bigger payout always means more trouble.

| Booking | Payout | Trouble |
| --- | --- | --- |
| 🏊 Regular | ×1 | None |
| 🚌 Tour group | ×1.25 | A rush a quarter of the way in |
| 🎉 Stag party | ×1.35 | Cannonball Carl, 18–40% into the shift |
| 🌙 Night swim | ×1.4 | Night lighting and a power outage, 30–50% in (not offered on a night shift, on a shift whose sun sets by itself, or in the arena) |
| 🎈 Kids' party | ×1.45 | A fish kid (12–30%) and a loose dog (55–75%) |

Replay keeps the booking; Next shift asks again. Booked runs count toward the level's best score and stars like any other.

## Audio, accessibility, and feedback

Music is intended from the menu onward, subject to browser audio permissions; the first user gesture unlocks Web Audio. Music and effects are procedural. Selection, countdown, doors, jumping, landing, dash, service, rescue, and sanitation provide synchronized cues. Panic changes the musical arrangement. Muting must work across those states.

Support keyboard and touch, native clickable swimmer tags, readable skill labels, help, pause, and responsive HUD/control placement. Keep tags below the measured scoreboard edge. Do not let menus or controls obscure the coach on short or portrait displays.

Respect reduced motion: use steady selection cues, remove dash streaks/lean and repeated rescue bobbing, suppress panic jumping, and use a static back-on-deck slip pose. Preserve gameplay meaning and collision separation even when decorative animation is reduced.

## Technical architecture

Self-contained static browser game using ES modules, locally included **Three.js 0.170.0**, and procedural Web Audio. There is no build pipeline or backend requirement. `package.json` only holds development scripts (`npm start`, `npm test`, `npm run format`) and two dev dependencies: Prettier and `@napi-rs/canvas` for the CPU scene check. Google Fonts are optional with local fallbacks. Three.js and RoundedBoxGeometry license information is in `dist/assets/THREE-LICENSE.txt`.

| File | Responsibility |
| --- | --- |
| `dist/index.html` | Game shell, HUD, menus, controls, dialogs (the crash dialog included), and a small script that reports a game that never started |
| `dist/style.css` | Arcade interface and responsive styling |
| `dist/app.mjs` | Runtime orchestration, UI, the map's selection panel and booking picker, results, pause, input routing, persistence, fixed-step loop, `?debug` QA hook |
| `dist/sim.mjs` | Seeded simulation, swimmer types, the twenty shifts (with their twists and VIP guests), lane traffic and lane moves, happiness, scoring, bookings and drills as options |
| `dist/coach.mjs` | Arcade coach movement, timed busy actions, ranked physical interactions |
| `dist/sanitation.mjs` | Stomach warning, evacuation, skimmer workflow, chemistry recovery |
| `dist/rescue.mjs` | Cramp and crash rescues, rings, water missions, recovery bench and return |
| `dist/chaos.mjs` | Incident scheduling, visitors, puddles, the storm's weather and rain puddles, fleeing swimmers, shared hooks, pointer shortcuts |
| `dist/incidents/*.mjs` | One module per incident: `fish`, `dog`, `carl`, `outage`, `trampoline`; plus `twist` (the five mid-shift twists: rush, closure, swim team, aqua class, storm) |
| `dist/deck-physics.mjs` | Deck contacts, separation, passing and route cooperation |
| `dist/spatial.mjs` | The four venues from two pool-geometry functions (the club's, and Splash Park's shared by the Lagoon and the Arena): stations, fixtures, rings, furniture, deck tests, routing, movement tuning |
| `dist/scene.mjs` | Three.js world: lighting presets, environment, batching, sync of characters, camera and picking |
| `dist/scene/*.mjs` | Scene kit, procedural textures, basin and water shader, props, characters, the club, resort, lagoon and arena builders, incident visuals |
| `dist/scene/sky.mjs`, `daylight.mjs` | The Coach Cam's open-air world: sky dome, clouds, hills, sea, lighthouse, wildlife, rain and lightning, and the shared time-of-day scale that colours it all |
| `dist/scene/hall*.mjs`, `crowd.mjs`, `geom.mjs` | The indoor halls (roof profiles, trusses, windows, skylights, flags, bunting, pendants), instanced spectators, and shared geometry helpers (GPU-flutter flags and garlands) |
| `dist/scene/coach-cam.mjs` | Coach Cam: first-person camera, look and field-of-view limits, spring-driven hands, held items, crosshair picking |
| `dist/input.mjs` | Keyboard/touch intents and held input |
| `dist/guidance.mjs` | Shared world/HUD guidance state and pulse |
| `dist/moments.mjs` | Incident moments: sting and stamp text, first sightings, queueing, slow motion and hit-stop timing, edge-arrow geometry |
| `dist/progression.mjs` | Record normalization (levels and drills), stars, unlocks and the `UNLOCK_ALL` playtest switch |
| `dist/campaign.mjs` | Acts, chunks and the finale as a view over `SHIFTS`: zone progress, "you are here", level and drill states, panel icons. No DOM |
| `dist/drills.mjs` | The six chunk drills (pure data) |
| `dist/bookings.mjs` | Act 2 bookings and `applyBooking` (pure data) |
| `dist/map-art.mjs` | The map's layout and isometric SVG art, as strings. No DOM |
| `dist/map.mjs` | The map's DOM layer: buttons, tags, coach, clouds and reveal, driven by the campaign state |
| `dist/audio.mjs` | Procedural music and effects |
| `dist/story.mjs`, `dist/cinematic.mjs` | The Ocean Fund's rules and the intro and ending scenes as data (pure), and the small full-screen cinematic player |
| `dist/crashlog.mjs`, `crashlog-hooks.mjs` | The crash log: breadcrumbs, errors, reports and GitHub issue links (pure), and its browser wiring (window errors, console, visibility, WebGL loss, Web Locks) |
| `dist/version.mjs`, `stamp-version.mjs` | The build's identity (`dev` locally, the commit on Netlify) and the script that stamps it |
| `dist/assets/` | Bundled Three.js, rounded-box helper and license |
| `*-check.mjs`, `check-bot.mjs`, `check-helpers.mjs` | Deterministic regression and CPU scene checks; the coach bot and helpers they share |
| `artifacts/game-progress.md` | Historical sprint notes; some pending statements are historical, not current status |
| `artifacts/final-evidence.md` | Latest gameplay sprint verification record |
| `.openai/hosting.json` | Existing Site identity and static publishing directory |

Controller inheritance is `CoachController → SanitationController → RescueController → ChaosController → PoolSimulation`. Each incident module implements the same small hook interface (`init`, `isActive`, `start`, `update`, `interactions`, `returnItem`, `waterMission`, `onSwimStep`, `hint`, `panel`, `tag`, `alert`, and so on), so systems never reach into each other. Interactions are ranked options (`kind`, `label`, position, `rank`, `run`); E runs the lowest rank, and incident tiers outrank routine service. The simulation emits events consumed by the presentation layer. Keep render animation from accidentally advancing gameplay state. The app uses a 60 Hz fixed simulation update; movement uses acceleration/braking, gravity, and simple collision proxies rather than a general rigid-body engine. The seeded simulation enables reproducible checks.

World X/Z directions differ from screen directions: screen right maps to +Z and screen up to +X. Reuse `screenMovement` and shared spatial definitions instead of applying ad hoc coordinate fixes.

### Run locally

From the full source checkout, serve the static directory over HTTP:

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000` (or run `npm start`). Do not open `index.html` through `file://`, which can block ES-module loading. No dependency installation or build is needed to play. Adding `?debug` to the URL exposes `window.__pool` for fast-forwarded repros and screenshots: `play(level)`, `step(seconds, drive)`, `end(score)` (finish the shift with a score), `coachCam(on)`, `unlockAll()`, `lockAll(on)` (see the star-gated map), `progress(n, stars)` (records as if levels 1..n were cleared), `menu()`, `select(level)`, `selectDrill(id)`, and read-only `sim`, `world`, `moments`, `records`, `selected` and `map`. Adding `?locked` previews the real star-gated map while `UNLOCK_ALL` is on.

### Crash log

The game keeps a black box of its own (`dist/crashlog.mjs`, wired to the browser in `dist/crashlog-hooks.mjs`), so that when it breaks on someone's device the report says what broke, where, on what, and what the game was doing, without anyone having to describe it. It exists because a shift once stopped when an incident kicked in and there was nothing to read afterwards.

- **What it records.** Uncaught errors and rejected promises; every error in a stage of the frame loop or in a single event; a lost WebGL context; three.js's own errors (a shader that did not compile) and every other console error or warning as a breadcrumb; a page that vanished in the middle of a shift (a tab crash, running out of memory, a freeze that ended in a forced close). The next launch can tell because that page's Web Lock is gone; a page in the background, one that closed, or one still running in another tab is not a crash. Also: how the frames are going and the GPU and heap counts every 10 seconds, the shift's state every 2 seconds (level, venue, lighting, view, clock, score, active incidents, the shift's seed) and a trail of breadcrumbs (shift starts, incidents, saves, pauses, view switches, world builds and how long they took, the player's clicks and presses of E, and any frame that took over 0.7 seconds).
- **Where it lives.** Only on the device, in `localStorage`: `pool-panic.crashlog.v1` is the list of launches and `pool-panic.crashlog.v1.<id>` holds one launch each (so two tabs never overwrite each other). The last eight launches are kept (the ones that went wrong outlive the clean ones), each within 40 KB and 100 breadcrumbs. Nothing is sent anywhere by the game.
- **Getting a report to us.** After a crash the next launch opens a dialog with the report: **Copy report** (paste it into the chat) or **Report on GitHub** (opens a prefilled issue in `larvuz2/poolpanic`, with the whole report on the clipboard because the link carries a shortened one). The Help dialog has "Open the game log" any time, and `?log` opens it on load. An error that stops a shift opens the same dialog on the spot, with Restart and Back to the map.
- **Errors no longer stop the game by themselves.** Each stage of the frame loop is guarded (`stage()` in `dist/app.mjs`): drawing, tags, alerts and the HUD log their error and are skipped, and each event in a batch is handled on its own. Only the simulation throwing, or a stage that fails for 1.5 seconds straight, pauses the shift and shows the report.
- **Which build.** `dist/version.mjs` says `dev` from a checkout. Netlify runs `node stamp-version.mjs` before the checks (see `netlify.toml`), which writes the commit, deploy context and branch into it, so a report names the exact build.
- **Reading one.** A report is Markdown: the build, device (user agent, viewport, pixel ratio, GPU, cores, memory), the game's state, each error with its stack and the game state at the time, and the newest breadcrumbs. `?debug` exposes `window.__pool.crashlog` for QA; `crashlog-check.mjs` drives the whole thing with a fake browser.

### The story and the Ocean Fund

Coach Panic wants to take Marina to the ocean and has to earn the trip. The very first launch opens with a short, skippable cinematic (four scenes, about 15 seconds, click / Enter / Space for the next scene, **Skip** or Esc to leave) before anything can be played. It is not shown again, but the 🌊 pill in the top bar (menu), Help → "Watch the story again", or `?story` replay it.

- **The fund.** Every finished shift (and drill) pays: $10 for finishing plus $30 per star, times the booking's payout (bookings are the "gigs": a riskier one pays more). Only pay beyond a shift's best counts, so replays cannot farm it and the fund never goes down. The trip costs $1,500; a full season at three stars covers it. The results show what the shift paid and the fund's bar, plus a text from Marina at 25, 50, 75 and 100%.
- **The ending.** Filling the fund earns a short beach cinematic; "Watch what happens" then appears on every results screen.
- **Placeholders.** `dist/story.mjs` holds the rules and every scene as plain data (a backdrop plus emoji layers and speech bubbles), and `dist/cinematic.mjs` plays them, so real art and character models can replace them later without touching the rules. What was seen and earned is kept in `localStorage` (`pool-panic.story.v1`). `?debug` sessions skip the intro.
- **Checked by** `story-check.mjs`: pay, sanitised saves, the no-farming rule, Marina's texts once each, well-formed scenes, and the player's next, skip, keys and auto-advance.

### Deploy on Netlify

`netlify.toml` holds every setting, so connecting the repository once is all it takes:

1. In Netlify choose **Add new site → Import an existing project → GitHub** and pick `larvuz2/poolpanic`.
2. Keep `main` as the production branch. Netlify reads the build command (`npm test`), the publish directory (`dist`) and the Node version (22) from `netlify.toml`, so leave the build fields in the UI as they are.
3. Deploy. From then on every push to `main` redeploys automatically, and every pull request gets its own deploy preview link.

There is nothing to bundle: the build step only runs the regression checks (about 30 seconds). If a check fails, that deploy fails and the previous version stays live. To publish without the checks, set `command = ""` in `netlify.toml`. The config also serves `.mjs` files with a JavaScript MIME type (the game loads as native ES modules) and adds `nosniff` and referrer-policy headers.

### Media generation (fal)

`.mcp.json` connects Claude Code to [fal's MCP server](https://fal.ai/docs), which runs 1,000+ image, video, audio and 3D models (key art, trailers, sound, textures) for this game and other projects. The key is never stored in the repo: the config reads it from the `FAL_KEY` environment variable.

- **Claude Code on the web:** add `FAL_KEY` as an environment variable in the cloud environment's settings (environment menu in the session title bar → Edit). New sessions pick it up.
- **Local Claude Code:** `export FAL_KEY=...` in your shell profile, then run `/mcp` to check that `fal-ai` is connected.

Generated media costs fal credits per run. Commit finished assets under `dist/assets/` rather than linking fal CDN URLs, which expire.

### Verify changes

`npm install` once, then `npm test` (or `node run-checks.mjs [filter]`) runs every `*-check.mjs` and prints a PASS/FAIL line for each. Choose checks relevant to the change, with broader regression only for affected shared behavior:

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
| `node scene-check.mjs` | CPU scene construction, poses, picking and camera math; every venue building headless with its sky or hall only in the Coach Cam, rebuilding for another venue without leftovers, blackout dimming, the Lagoon's sliding sun, storms and reduced motion |
| `node fish-check.mjs` | Fish Kid prevention, dump and panic, net/dive/chase/reopen/return, catchability over 40 seeds |
| `node chaos-check.mjs` | Loose Dog, Cannonball Carl and Power Outage prevention and recovery |
| `node trampoline-check.mjs` | Splash Park lanes, flips, splash-lane lock, lane moves, crash rings and first aid |
| `node season-check.mjs` | Coach bot plays levels 4–20 (twists, VIP guests and the storm included), every chunk drill and every booking (levels 11–20) end to end; star-target sanity, prevention beating a reactive coach, and crash recovery (`--table` for scores) |
| `node campaign-check.mjs` | Acts, chunks and the finale (every level in one zone, numbers stable, "soon" slots for a partly built season), star-gated progress and chunk completion, the Splash Park name, Act 2's three venues, drills that open at five stars, bookings that trade payout for trouble, the rush, closure, swim-team, aqua-class and storm twists through the real simulation, VIP scoring and the shared floor plan |
| `node map-check.mjs` | The map's layout and art: ten levels on four islands per act, no two buttons overlapping at any scale in the wide or the tall drawing, well-formed SVG with per-act ids, night moon, and each shift's preview icons |
| `node interplay-check.mjs` | Incidents colliding: goggles vs the fish net, early fish return, kid during a rescue, cramps mid-flip, second crash ring, healed victims rejoining, breaker race |
| `node moments-check.mjs` | Incident moments: every incident and save reported through real game flows, loud-alert targets and ranking, first sightings, sting queueing, slow motion and hit-stop timing, banner fuses, edge arrows (and behind-you), the camera nudge |
| `node story-check.mjs` | The story: pay and payouts, sanitised saves, a fund that cannot be farmed, Marina's texts, well-formed scenes, the cinematic player against a fake dialog |
| `node crashlog-check.mjs` | The crash log: breadcrumbs and errors kept and capped, repeats counted, one storage key per launch, a page that vanished mid-shift told from the background, a closed page and another tab, reports and issue links that fit, a full or broken storage, and the browser wiring against a fake browser |
| `node coachcam-check.mjs` | Coach Cam: facing follows the look, E prefers what is in view, view-relative movement, eye and water-level height with the body hidden, hand lag and settle, head bob (off with reduced motion), landing dip, items in hand, field of view, crosshair target |

Read the selected test's imports before running it in a new environment. CPU scene checks use the runtime's canvas dependency and are not GPU rendering tests. Historical checks passed during implementation, but that is not a claim that this documentation update reran every suite.

The latest gameplay sprint verified backward slip poses, angry cues, differentiated cramp animation, preserved simulation positions, and service/rescue behavior through CPU/deterministic checks. **Live browser/GPU rendering, real device performance, and actual audio playback remain unverified in the recorded evidence.** Do not describe programmatic checks as a visual or listening pass.

The September 27 update (chaos incidents, Splash Park, lighting) was additionally inspected in headless Chromium with software WebGL (SwiftShader) screenshots of every venue and lighting preset, the trampoline flip, a crash, first aid and a night blackout. That is a rendering pass, not a GPU performance test, and audio was not listened to.

The Coach Cam was checked the same way in headless Chromium:
- the menu switch at desktop, short-laptop and phone sizes;
- drag-to-look, walking along the view, arrow-key turning, V switching and the saved setting;
- the crosshair label;
- with the captured state faked, aiming at a queued swimmer 11 m away and clicking to select them, then clicking a lane to send them in;
- screenshots of the hands and the held items.

The browser's real pointer lock cannot engage headlessly, and there has been no GPU or real-device pass.

Incident moments were checked the same way, at 1280×800 and 390×844, in the club and in the night Splash Park:
- first and repeat stings, in both warning and danger colours;
- the banner fuse;
- the loud marker, and edge arrows including behind-you in the Coach Cam;
- save stamps, which replace the points pop;
- two chaos shifts fast-forwarded to the results screen with no page errors.

The new stings and cheers are procedural like the rest of the audio and were not listened to.

The September 29 update (the campaign map, twists, drills and bookings) is covered by `campaign-check.mjs`, `map-check.mjs` and the extended `season-check.mjs`. It was also driven through headless Chromium with software WebGL, in ad-hoc Playwright scripts that are not part of the repository:
- the map at 1920×1080, 1280×800, 1366×600, 1024×768, 900×800, 768×1024, 844×390, 390×844, 375×667 and 320×568, both acts, with every level open and with the real star-gated state (locks, clouds, coach, stars, yellow route);
- selecting by tap and by keyboard (arrow keys, Enter), the act tabs, and `?locked`;
- the booking picker (cards, Back, Replay keeping the booking), a drill from selection to results and back, and the chunk-clear flow through to the reveal, including Act 1's finale opening Act 2, with no page errors.

With software rendering the menu holds 60 frames a second. Real GPU and device performance, the reveal's timing on real hardware, and the new sounds have not been checked.

The levels 16–20 update (the Lagoon, the Arena, VIPs, the storm and the Coach Cam environments) is covered by the extended `campaign-check.mjs`, `season-check.mjs`, `shift-check.mjs` and `scene-check.mjs`. It was also driven through headless Chromium with software WebGL, again in ad-hoc scripts that are not in the repository:
- Coach Cam and overview screenshots of every venue: the Lagoon from noon to night and in a full storm, the club and the arena from the floor and looking straight up at the flags, an arena blackout;
- levels 16–20 played from the map through the booking picker (three cards, never a night booking) to the results screen, with the Coach Cam on and off, checking that only the outdoor venues get a sky and only the halls get a roof after every venue change, with no page errors;
- the map with all twenty levels at desktop size, and the level panel with the nine icons of the finale.

A frame issues roughly 320–520 draw calls in every venue and view (the Lagoon is the busiest), and 300,000–665,000 triangles with the shadow pass counted; the arena's Coach Cam is the heaviest (its crowd is about 300 triangles a person, its trusses plain boxes). Real GPU and device performance, how long a venue takes to build on a phone (about five seconds in software rendering, the same as before), and the new sounds (the storm sting, the VIP arrival) have not been checked.

## Direction already established by the creator

These decisions reflect iterative feedback and should survive future work:

- Keep the pool horizontal, the camera close, and the experience game-like rather than a website surrounding a small game.
- Integrate locker rooms into the room boundaries; keep clear, audible door arrivals and practical routes.
- Start the coach at the middle of the near deck; keep waiting swimmers at the left starting-block end.
- Teach selection with swimmer/emoji glow, then lane glow. Make world tags clickable.
- Use emoji plus Beginner / Intermediate / Pro words for clarity.
- Keep a visible countdown, a brief breathing space before the first swimmer, and an easy 30-second first level.
- Preserve the level map (acts of ten levels, chunks of three, the coach on the level you are up to), the obvious level indicator, stars, and Next shift as the primary successful-result action.
- Keep the map minimal and aesthetic: an isometric island per chunk in the game's own style, soft clouds at the edges, very few letters. The resort is called Splash Park.
- Keep physical errands and a single carrying slot; equipment must not disappear during transitions.
- Make normal contacts gentle, fin slips backward and expressive, and rescue distress unmistakable.
- Let swimmers finish by swimming/climbing before walking around the deck.
- Let stomach failure visibly transform the pool and require a skimmer cleanup, disposal, return, and treatment.
- Keep music available from the menu and make emergencies audibly different.
- Offer the first-person Coach Cam as an opt-in switch in the menu, off by default; it never replaces the overview.

Earlier notes sometimes describe superseded behavior: three levels instead of the current twenty, a single life ring instead of three, narrower handoff reach, automatic cleanup, starting-end-only exits, or an at-wall cramp assist. The current systems above take precedence. Historical intent is useful context, not a reason to restore old implementations.

## Scope and future work

The implemented prototype is single-player, with twenty finite shifts across four venues (drawn on a two-act campaign map), five swimmer types plus VIP guests, three or five lanes, local progression, equipment errands, chemistry, deck/lane collisions, cramps, lost goggles, stomach emergencies, four chaos incidents, five mid-shift twists (one of them a storm) and the resort trampoline.

Levels beyond twenty, further venues, families, multiplayer, accounts, network leaderboards and other expansions are **outside the current prototype**, not promised features; the map has no slot for a third act. No monetization model, release platform beyond the browser, or expanded production roadmap has been established in this brief.

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
