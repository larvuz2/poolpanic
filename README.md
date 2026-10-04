# Pool Panic

> A playful 3D swimming-pool management game: three lanes, then five, endless little disasters, one more shift.

This README is the project brief and agent onboarding guide. It combines the creator's direction with the implemented prototype as inspected on September 26, 2026, updated on September 27, 2026 for the chaos incidents, the Splash Park (then called the Riviera Splash Resort) and levels 11–15, and on September 29, 2026 for the campaign map, chunks and acts, mid-shift twists, drills and bookings, and again for levels 16–20, the Sunset Lagoon and Grand Gala Arena, VIP guests, the storm twist and the Coach Cam environments, on October 3, 2026 for Karen, and again that day for the goal of a Steam release, the desktop app, the achievements and the incident catalogue. Read it before changing the game. Descriptions marked as current refer to the code; proposed possibilities are not commitments or implemented features.

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

## The goal: a paid game on Steam

The game is being made to be **sold on Steam**, with great graphics and lighting in the end. The creator wants it to earn money, so every decision is weighed against two questions: *does this make a player want one more shift?* and *would a stranger who paid for it be happy with it?* The first release is **single player**; multiplayer and anything online are not part of it.

The work goes in four stages, in this order, and the order is deliberate:

| Stage | What it is | State |
| --- | --- | --- |
| **1. The game** | Systems, mechanics, characters, incidents, and the loop that makes people play "one more shift". It has to work **perfectly** before anything is polished | **Now.** This is where the time goes |
| **2. Steam readiness** | The desktop app, Steam calls, achievements, cloud saves, controller support, a settings screen, a build pipeline | Started: see [The desktop app and Steam](#the-desktop-app-and-steam) |
| **3. The look** | Lighting, textures, the art pass ("pimping out") | **Last, on purpose.** It must not change how the game plays, so nothing here is worth doing while the game is still changing |
| **4. Launch** | Store page, trailer, wishlists, demo, review, release | The store page can start long before stage 3 ends |

What follows from that for anyone working on the game:

- **Spend effort on stage 1 first.** Do not polish lighting, textures or models unless asked; do make systems, incidents and the loop right, and make sure nothing crashes.
- **The game must be spontaneous.** The same level played twice should not play the same: a level 1 may bring one small incident or none, and which one changes every time. Levels and maps still decide what *can* happen. How a shift picks incidents today, the full list, and the plan for a director that draws them are in [`docs/incidents.md`](docs/incidents.md); the creator ranks the incidents before that is built.
- **Stay a browser game too.** The same `dist/` runs in a browser (the free demo, the itch.io page, a friend's iPad) and in the desktop app. Nothing in the simulation or the scenes may depend on Steam; the Steam calls live behind `dist/platform.mjs` and do nothing without it.
- **Know what only the creator can do.** The Steamworks account, the app fee, the app and depot ids, the store page and prices, and rights to the generated art are all theirs (`desktop/steam/checklist.md` has the whole road).

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
| E | Contextual nearby interaction: pickup, handoff, selection, disposal, return, or drop. **Hold** it next to Karen to calm her down |
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

## Coach Panic — the coach's model

The coach is Coach Panic, a Meshy-generated character (about 10k triangles, 24 bones, one 1024 px texture) with seven clips made in Blender (`tools/blender/README.md`): **Run**, **Walk**, **IdleScan** (head scanning left and right), **IdleScratch** (the same, then a head scratch), **Swim** (a freestyle crawl), **SwimRing** (his own: swimming with the life ring) and **Panic** (jumping without a pause with the hands up, which only the swimmers play). They can be previewed in the Anim Bench artifact (`tools/viewer/README.md`).

- **Run is every movement on foot** (walking, dashing), played faster or slower with his speed so the feet keep up with the floor. **Swim is the crawl**, played on his front in the water.
- **SwimRing is swimming with the life ring, and only that.** From the dive into the pool until the ring is handed to the swimmer he plays SwimRing, whether he is moving or floating: both arms are held out ahead of him round the ring, **still** (no windmill), the body does not roll and the face keeps to the front, and **only the legs kick**, a little faster as he swims faster (a gentle 0.85 times the clip's pace floating up to 1.3 times at his full swim speed of 4.2). It is the coach's alone (no other character has the clip, and a guest never holds a ring), and it is chosen by `ring` (he carries the life ring) and `prone` (he is swimming or diving) in `CoachRig.update`, ahead of every other rule: the ring on the deck is still Run and the idle scan, the fish net in the water is still the crawl, and once the ring is handed over the old rules are back. A file without the clip carries the ring with the crawl, as before. The clip is made in `tools/blender/character_clips.py --character coach` (the arms held by the same two-bone solver as the crawl's, straight and a little apart; the legs a six-beat flutter) and copied into the file by `transplant_clips.py`; `rig-check.mjs` holds it to what the brief says (the hands high and within 3 cm of the shoulder all through, the feet kicking in turn, no roll, the face ahead, the hips still, the feet on the floor) and `coach-model-check.mjs` to when it plays.
- **Walk is only the start of a shift.** While the 3-second countdown runs he walks in from a few steps away (3.6 units, at the walk clip's own speed) and is exactly on the spawn point when the countdown reaches zero. He comes from straight behind the spawn point when that ground is clear, else from the nearest clear diagonal or side (`planIntro`). Nothing in the simulation changes: only what is drawn.
- **Standing** plays IdleScan, with an IdleScratch after a few seconds of standing still (never while a job is in hand).
- **The classic coach stays.** It is still built and posed, hidden behind the model, and `?coach=classic` (remembered on the device) or *Switch to the classic coach* in How to play brings it back; `?coach=panic` or the same button goes back to Coach Panic. If the model fails to load, or a clip throws, the classic coach plays.
- **Panic is in his file** (every rigged character has it, see The swimmers' models) but he never plays it: the coach does not panic.
- **Not animated by hand yet.** The arm poses the classic coach strikes (carrying, bandaging, the life ring) are not applied to the model: carried items sit in front of his chest and he keeps his run or idle arms. A swim is the Swim clip on his front (SwimRing with the ring).
- `dist/scene/coach-model.mjs` is pure view code and `coach-model-check.mjs` covers it. The GLB comes from `tools/blender` (`smooth_joints.py`, `game_export.py`, then `ground_clips.py`, which stands his clips on the floor); replacing `dist/assets/coach-panic.glb` replaces him in both the game and the viewer.

## The swimmers' models

The guests are five Meshy characters, not balls and boxes: a boy (1.58 m), a tall man (1.84), a woman (1.70), a heavy-set man (1.56) and a tall woman (1.86), each about 10k triangles with one 1024 px texture and the goggles on their eyes (`dist/assets/swimmer-*.glb`, about 0.8–0.9 MB each, loaded in parallel with Coach Panic at the start). They are rigged on Coach Panic's own skeleton, so they play his four clips. Which of the five a guest is comes from the guest's `skin` number, so it stays the same for the whole shift.

- **Clips.** Standing in the queue is IdleScan with an occasional IdleScratch, each swimmer a different moment into it so the queue does not move in step. Walking is Walk up to a brisk pace and Run beyond it (a little hysteresis, so a swimmer on the edge does not flicker), played at the speed that keeps the feet on the floor (each model has its own ground speeds). Swimming is **Swim**, a freestyle crawl made standing (like every clip; the world sync lays the swimmer on its front) and played at a stroke rate that follows how fast they swim, from a lazy two seconds a stroke for a beginner to under a second for a pro: each arm goes round the shoulder, pulling deep under the chest with the elbow high and coming back over the water with the elbow leading, the shoulders roll toward the pulling arm, the feet flutter in a six-beat kick, and the face is in the water and turns out to the side to breathe once a stroke. A swimmer at a problem strokes slowly, one fleeing or being evacuated flails. A model without the clip swims with Run.
- **Panic.** A swimmer who panics on the deck (the pool is closed for a fish, a dog or a cannonball, or there is a mess in the queue) plays **Panic**: a hop on the spot without a pause, both feet off the floor every half second, the hands and arms thrown up and flapping, the head tipped back and shaking, twisting one way and then the other on each hop. Each swimmer starts it at a different moment, so a crowd does not hop in step. It is the whole body, so the poses below are not laid over it, and the fins, which stay on the floor, are hidden while it plays. With reduced motion the swimmer stands with the hands up instead of hopping, and a model without the clip hops the way the classic swimmer does. A swimmer running away or in circles with the hands up is still Run with the arms posed.
- **Poses.** The world sync still poses the classic swimmer's arms and legs for what is going on, and the model copies them onto its own bones while they last (the "puppet" layer, `u.puppet` in `dist/scene/actors.mjs`): panic with the arms up, climbing out the ladder, treading water, sitting at rest, the trampoline and the leap away, the slip onto the back, and an injured swimmer lying on the deck. The copy is eased in and out, so a swimmer blends from a clip into a pose instead of snapping. The forearms, hands, knees and feet are straightened to the model's rest pose, since the classic swimmer has no elbows or knees.
- **What rides on them.** The VIP crown and sash, the daredevil's star and cape, the sore eyes, bandage, fins and the queasy tint (green) are placed from each model's own numbers (the eye line, how far the chest reaches front and back) and scale with its height, so they sit on a 1.56 m guest and a 1.86 m one alike. The crown, star, sore eyes and bandage follow the head bone and the sash and cape the chest bone (a mount, a child of the bone that stands for the swimmer as it is at rest), so they go up with a hop and tip with the head. A model's suit and cap are its own, so a guest's type is shown by the colour of the disc on the floor under their feet (green beginner, blue intermediate, red pro, purple aqua, orange daredevil, gold VIP) as well as by the tag over their head. The dog stays as it was; Carl, the leopard man and the fish kid are models of their own (see The cannonball men and The fish kid).
- **The classic swimmers stay.** They are still built and posed, hidden behind the models. `?swimmers=classic` (remembered on the device) or *Switch to the classic swimmers* in How to play brings them back, `?swimmers=models` or the same button goes back to the models. If a model fails to load (the game waits at most six seconds for them), or a clip or pose throws, that swimmer is the classic one.
- **Not in the game yet.** The five named premium characters (Marco, Dona Berta, Nico, Valentina, Bruno) and their waiting clips are still only in Anim Bench.
- `dist/scene/swimmer-models.mjs` is pure view code and `swimmer-model-check.mjs` covers it (with stand-in skeletons, so it needs no GLB). The GLBs come from `tools/blender` the same way as the Coach's (`game_export.py --height`, `rig_from_template.py`, `retarget_clips.py`, `ground_clips.py`, and `transplant_clips.py` for Panic); replacing a `dist/assets/swimmer-*.glb` replaces that swimmer in both the game and the viewer, and the table at the top of the module holds the numbers measured from it.

## The cannonball men

The Cannonball incident (💣, from level 6) is done by one of two very round models with belly bones, **Carl** and the **leopard man** (a placeholder name): `dist/assets/carl.glb` and `dist/assets/leopard-man.glb`, about 1 MB each, with the six clips every character has and a heavy one-shot **Cannonball** jump into the water that only they have (`tools/blender/README.md`, "A character with a belly"; both can be previewed in Anim Bench).

- **One of them per level.** The levels take turns: Carl on the even levels (so level 6, where he is introduced, is his, then 8, 10, 14, 16, 18 and 20) and the leopard man on the odd ones (9, 13, 15, 17 and 19), in the same way for a drill or a booking. A shift's own `cannonball: "carl" | "leopard"` in its config wins over that (`cannonballMan` in `dist/incidents/carl.mjs`). All the cannonballs of a level are the same man, and what the player reads names him: the sting, the alert, the tag over his head, the toasts, the map's icon for the level, the stag party's card and the results tip, and the customer he turns into when he is red-carded before the edge (who is him in the queue and in the lane too). `?cannonball=carl` or `?cannonball=leopard` in the address puts that man in every Cannonball incident, whatever the level (to look at him). Only the one the level needs is fetched, when the level starts, long before the incident; without him (a model that did not load, or `?swimmers=classic`) the classic Carl plays.
- **Through the incident.** He comes in on Run (Walk when slow), by how fast the floor goes under him. At the edge he **crouches** with the arms swung back (the Cannonball clip, slowly, while the simulation winds him up and charges: he stays at the edge instead of backing away and running up again), pushes off, and **jumps**: the clip is made in place and is played frame by frame from where the simulation has him, so the take-off is the clip's take-off and the **splash is the clip's splash frame** (frame 37, when the water is reached) at the moment the simulation says it is. From the splash until he is out on the deck he plays **Swim**: he settles onto his front just after the splash, swims to the wall on the crawl (turning round to it, not at once), stands up as he climbs the wall, and runs on to the next spot (Run). `dist/scene/figure-pose.mjs` is the pure map from the visitor's state (status and timer) to the clip, its time, and how far he lies on the water.
- **The crowd panics while he is in the water**, from the splash until he is out on the deck, and only then. **The swimmers in the pool stop where they are**: the lanes stand still (as in a rescue, so nobody loses happiness or workout time to it) and each swimmer, standing up in the water to the waist (over a third of a second, and down again when it is over), hops with the hands up (the Panic clip). **Everyone idle outside the pool**, the swimmers waiting in the queue, hops with the hands up too, as in a cleanup. Swimmers walking on the deck (to the pool, or out of it), the coach and the fish kid are not part of it. Once he is out they go back to what they were doing. The stall and the goggles his splash costs the swimmers near it are still there. The simulation's part is `crowdPanic()` (an incident system can ask for it) and `heldInWater` in `dist/rescue.mjs`; the scene's is the Panic clip for those it holds and for the queue, and with reduced motion (or the classic swimmers) the same hands-up pose the classic swimmers strike.
- `dist/scene/swimmer-models.mjs` loads and rigs them like the five swimmers (`FIGURES`, `loadFigure`, the `figure` on the visitor), the incident view poses him (`poseFigure` in `dist/scene/incident-view.mjs`), and `swimmer-model-check.mjs` and `chaos-check.mjs` cover them with stand-in skeletons, no GLB needed.

## The fish kid

The kid of the 🐟 Fish Kid incident is a model too, with his bucket in his file: `dist/assets/fish-kid.glb` (a boy of 1.2 m, about 1.5 MB: Nico's mesh and skeleton, with his six clips, the four below and a Meshy 7 bucket, 6k triangles, made from a picture generated with Nano Banana Pro; its source is `tools/blender/assets/bucket.glb`). It is fetched when a shift that can have the fish incident begins (`loadFishKid` in `dist/app.mjs`; `?swimmers=classic` or a model that does not load leaves the classic kid with the classic bucket).

- **Four clips, made by `tools/blender/carry_clips.py`** from his own Walk, Run and IdleScan with the arms replaced by one hold in every frame, the bucket at his chest and a hand on each side, so it sways with his body: **CarryIdle** (standing, looking about, no head scratch with both hands full), **CarryWalk**, **CarryRun**, and the one-shot **BucketDump** (30 frames: a breath in, the bucket heaved up and out and tipped mouth-down past the horizontal while he leans over the edge, a shake, and lowered). The legs stay planted in the dump and the arms are two-bone IK to the bucket's sides.
- **The bucket goes where the hands go, in the file.** His skeleton has a node of its own, `BucketMount`, a child of the chest bone (not a joint) that the four clips key (position and rotation); under it `BucketFrame` undoes the bone's rest pose and the armature's scale, so what is inside is in metres in his own frame, and `Bucket` is the mesh, standing at the chest where the hands hold it at rest (extras: its height). So Anim Bench shows the bucket in his hands through every clip, and the game needs nothing but the file (`attachBucket` in `dist/scene/swimmer-models.mjs` hides the classic bucket, and the classic fish that rides in it: there is no fish in his bucket, it is not seen until it is out, in the pool).
- **In the incident** (`poseKidFigure` in `dist/scene/incident-view.mjs`): while he has the fish he is on a carrying clip, a **run** at his own pace (`toRun`: a child's stride is short, so the 2.3 m/s the incident walks him at is a run for this model); in `dumping` BucketDump is played over the second the incident takes (`dumpEnd`, frame 19: the bucket is fully tipped when the simulation lets the fish go, and only then does the fish show, in the pool: see The fish); then he cries with the classic hands-over-the-face arms (the puppet) and the empty bucket is taken out of the mount and lies on the deck beside him. Nothing in the simulation changed.
- `swimmer-model-check.mjs` covers the file (the mount, its frame and the bucket in it, each clip keying the mount), the rules (carry idle, walk, run, no scratching, dump scrubbed), the scene (the bucket in the mount with no fish in it, the bucket on the deck, a broken model giving the classic kid and his own bucket back) and the manifest. Anim Bench lists him as **Fish kid** (the same boy as Nico “Splash”, who has no bucket).

## The fish

The fish the kid lets go is a model too: `dist/assets/fish.glb`, a chubby olive-green cartoon fish with big white eyes, brown lips, buck teeth and a spotted flank (7.2k triangles, 360 KB: Meshy 7 from a picture supplied for it, one mesh and one 1024 px JPEG, no skeleton). It replaces the koi that `fishObject` (`dist/scene/props.mjs`) builds from balls.

- **Everywhere a fish is drawn.** The one loose in the pool, the one in the net on the rack and in the coach's hands, and the Coach Cam's net. `fishObject` still builds the koi and calls `dressFish` (`dist/scene/fish-model.mjs`): the model goes in beside the koi's parts, which stay under it, hidden. A fish made before the model came is dressed when it does (a few wait for it), so the koi plays when the file never does: a model that does not load, or `?swimmers=classic`, which never asks for it. The model is fetched with the fish kid, when a shift that can have the fish incident begins (`loadFishKid` in `dist/app.mjs`).
- **Seen only after the dump.** He carries the Meshy bucket with nothing seen in it, BucketDump tips it out, and the fish shows when the simulation lets it go (stage `loose`), in the pool, where the incident puts it. Nothing in the simulation changed: it still wanders inside the pool at 1.3 m/s, flees from the swimming coach at 3.9 and darts at 7 (the net still catches it), and it is gone from the pool when it is netted. (With the classic kid, `?swimmers=classic`, the classic koi still rides in the classic bucket.)
- **How it swims.** It is one rigid mesh, so it swims in the vertex shader: from the nose back the body bends sideways in a wave that runs to the tail and grows towards it. `swimModel` sets the wave's phase, which beats as fast as the koi's tail did, and its size, 9 % of the fish's length plus 1.5 % for each m/s it goes at, so a dart swings the tail further than a cruise (none with reduced motion). Every fish has its own copy of the material for its own wave; they share one program, one mesh and one texture.
- **The file's convention** is the nose to +z and the back to +y; its size and origin do not matter. The module stands the model in a group `FISH_LENGTH` (1.2 m) long with its middle at the origin, so a group's scale is the size of the fish (1.45 in the pool, 0.62 in the rack's net, 0.95 in the Coach Cam's; the koi is 1.4 m with its tail, but much slimmer), and makes it a little brighter: Meshy's colours come out darker than the picture they are made from, and the pool's water dims a fish in it. The wave works on the mesh's own coordinates, so the file's node carries no transform.
- **Making another.** A picture to `meshy/v7/image-to-3d` on fal (standard, about 7k triangles, textured, no PBR), then `tools/blender/run.sh tools/blender/game_export.py -- raw.glb dist/assets/fish.glb --height 0.65 --roughness 0.7` (matte material, JPEG texture, transforms baked; Meshy makes a fish face the front, which is +z). Replacing `dist/assets/fish.glb` replaces the fish.
- `fish-model-check.mjs` covers the file (one mesh, matte, no skeleton, no node transform; the nose to +z and the back to +y read from its vertices), the dressing (before the model and after it, once, the same size), the waves (a material and a wave each, one program), a model that does not load, and the fish seen only once the kid has let it go.

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
| 😡 Karen | A woman in a pink tank top storms out of a locker door and marches **straight at the coach**, shouting. Everyone on deck within 3.3 m of her stops, covers their ears and loses points (−20 and 6 happiness each, once per person; the streak breaks). Run to her and hold E (+100, +50 if nobody was annoyed). | She never swims and never gives up: she follows the coach round the deck (to the pool edge when the coach is in the water) and keeps annoying everyone she passes. | Hold E beside her for three seconds while the ring over her head fills. Let go or step away and it drains. Calmed, she sighs and leaves through a locker door. See [Karen](#karen--level-4-onward). |
| 💣 Cannonball Carl | Carl (or the leopard man, on every other level) barrels toward the edge yelling. Red-card him first (E, +100) and he joins the queue as an ordinary customer. | Each cannonball costs 60 and breaks the streak, stalls nearby swimmers, knocks goggles onto the deck and floods the edge with puddles. While he is in the water the swimmers in the pool stand still and everyone idle on the deck panics. He climbs out and runs to a new spot. | Red-card him on dry land (+150) and he leaves. |
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

### Karen — level 4 onward

Karen (`dist/incidents/karen.mjs`) is the first incident you **hold a key for** and the first with a **radius of influence**. She appears once on level 4 (`Fin club`, 74–94 seconds in), after the dog.

- **She goes for the coach.** Out of the locker room she walks at 3.1 m/s to wherever the coach is and re-plans as the coach moves. She stops 1.25 m away and rants. If the coach moves more than 2.2 m off she follows. A coach in the water (a rescue) cannot be reached, so she stands at the nearest edge.
- **Annoyance.** Everyone standing or walking on the deck within 3.3 m (swimmers in the queue, arriving or heading for the water, people leaving, the kid and Carl; not people in the water) is annoyed: they **stop where they are**, **cover both ears**, **hunch forward** and **shake their head** in disgust. Each person costs 20 points and 6 happiness once, and the streak breaks. Walkers resume where they stopped half a second after she moves on, and ease back into whatever they were doing (idle, walking). A red circle on the floor shows her range.
- **Calming her.** E next to her (within 2 m) starts the calm-down: **hold E until the ring fills** (3 seconds). The coach plants their feet, faces her and pats the air in front of them with both arms, up and down. Let go or move out of reach and the ring drains in about 1.6 seconds. Clicking or tapping her, or the touch/Interact buttons, starts a *latched* calm-down that carries on by itself until the coach moves. Calmed: +100 (+50 when nobody was annoyed), the "CALMED DOWN!" stamp, a sigh, and she leaves through the nearer locker door; her influence ends at once.
- **Her look.** Karen is a rigged 3D model (`dist/assets/models/karen.glb`, see [Karen's model](#karens-model)) with five clips: `Walk` (a furious march), `Complain` (left arm up and waving, then the right), `Point` (right arm out, jabbing), `Defeated` (once, a slump and a sigh) and `Idle`. While she rants the simulation cycles complain → point at the **pool** → complain → point at a **random spot** → complain → point at another random spot, turning her to face the target. Red, distorted words (`@#$%!`, `BLAH!`, `GRR!`…) spit out of her head. Until the model has loaded, or when it cannot (the headless checks), a stand-in built like the other characters plays the same states.
- **Audio.** Her voice is a procedural placeholder (a burst of nasal syllables every 1.3–2.4 seconds while she is loud). To use recordings, put them in `dist/assets/audio/` and list them in `dist/audio-files.mjs` (`AUDIO_FILES.karen`); each squawk then plays one at random.
- **Prevention is speed.** There is no warning window: the sooner she is calmed, the fewer people she annoys. The bot in `check-bot.mjs` runs to her and holds E; `karen-check.mjs` covers all of it.

### Karen's model

`tools/blender/karen_rig.py` turned the character art into the game asset. The steps, so it can be redone or reused for another character: the source image went to fal's **Meshy 7** (`meshy/v7/image-to-3d`, T-pose, 30,000 triangles, about $0.80; a first attempt with Hunyuan 3D looked wrong and was replaced); the GLB is scaled to 1.8 m with a 1,536 px JPEG texture, rigged with the 19-bone humanoid skeleton from `humanoid_rig.py` (bone positions measured from the mesh), and skinned in two ways: limbs by how far along the limb a vertex is (so thin arms and legs do not streak when they bend) and the rest by distance to the bones (Blender's bone-heat weights fail on a mesh with parts that do not touch). Weights are smoothed on welded points, because the importer leaves two vertices at every UV seam and smoothing them separately cracked the model along its seams. The clips are written by aiming each limb along a direction rather than setting bone angles. **Her arms hang about 50° out from her body** in Idle, Walk and the slump (`OUT` in the script): her bag is wider than her hip, and any closer her right arm goes through it. `tools/blender/karen_bagcheck.py` poses every frame of every clip and counts right-arm vertices inside the bag (Idle 3, Complain 11, Walk about 23 at the elbow crease, Point 0, against 100 to 170 with the arms at 20 to 30°). **Her soles lie flat on the floor** in every standing pose: the foot bones lie flat in the rest pose and the feet are aimed horizontally (an earlier version aimed horizontally at bones that sloped down, tipping the toes up about 25°). `tools/blender/karen_feetcheck.py` measures the planted foot's tilt in every frame of every clip (0.1° in Idle, Complain, Point and the slump; up to 6° in Walk at heel strike and toe-off) and how far the sole sits from the floor (within 1 cm), and renders a side view of the feet; run it after any change to her legs. Run `tools/blender/run.sh tools/blender/karen_rig.py -- raw.glb out.glb --debug DIR` to also render the fit and a few frames of every clip into `DIR`. Loading uses the vendored `GLTFLoader.js`, `SkeletonUtils.js` and `BufferGeometryUtils.js` in `dist/assets/` (three.js 0.170.0, MIT).

## Incident moments: stings, the loud alert, and payoffs

Chaos only feels funny when the player can read it, so every problem announces itself the same way, one thing at a time points to where to go next, and every save pays off.

- **Stings.** When an incident starts or gets worse, a big sign slams in and names it together with the action, e.g. "LOOSE DOG! Grab the treats · lead Biscuit out". The game slows down for a moment, the overview camera glides over to make room for the incident, and each incident has its own sound. The sign then flies up into the incident banner, which keeps the current step. Stings replace the warning toast they would duplicate.
  - The first time a player meets an incident, the sting runs longer, the game nearly stops, and a one-line lesson explains how it works (a "NEW" tag marks it). Seen incidents are remembered per device in `localStorage` under `pool-panic.seen.v1`, so later stings are short.
  - Incidents that sting: cramp, tummy trouble, the accident in the pool, fish kid, fish in the pool, loose dog, Cannonball Carl, Karen, flickering lights, blackout, a daredevil waiting over a busy splash lane, the daredevil jumping anyway, and a crash. A clean jump into an empty lane is not an incident.
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

The Carl incidents are Carl's on the even levels and the leopard man's on the odd ones (see The cannonball men).

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

Self-contained static browser game using ES modules, locally included **Three.js 0.170.0**, and procedural Web Audio. There is no build pipeline or backend requirement for the game itself. `package.json` only holds development scripts (`npm start`, `npm test`, `npm run format`) and two dev dependencies: Prettier and `@napi-rs/canvas` for the CPU scene check. The desktop app for Steam is a separate package in `desktop/` with its own `package.json` (Electron, electron-builder, steamworks.js); nothing in `dist/` imports it. The fonts (Barlow Condensed and DM Sans, SIL Open Font License) are bundled in `dist/assets/fonts/` and declared in `dist/style.css`, so the game asks the network for nothing once its own files have arrived (it used to `@import` Google Fonts, which blocks the first paint when the connection is poor). Three.js and RoundedBoxGeometry license information is in `dist/assets/THREE-LICENSE.txt`.

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
| `dist/incidents/*.mjs` | One module per incident: `fish`, `dog`, `carl`, `outage`, `trampoline`, `karen`; plus `twist` (the five mid-shift twists: rush, closure, swim team, aqua class, storm) |
| `dist/deck-physics.mjs` | Deck contacts, separation, passing and route cooperation |
| `dist/spatial.mjs` | The four venues from two pool-geometry functions (the club's, and Splash Park's shared by the Lagoon and the Arena): stations, fixtures, rings, furniture, deck tests, routing, movement tuning |
| `dist/scene.mjs` | Three.js world: lighting presets, environment, batching, sync of characters, camera and picking |
| `dist/scene/*.mjs` | Scene kit, procedural textures, basin and water shader, props, characters, the club, resort, lagoon and arena builders, incident visuals |
| `dist/scene/sky.mjs`, `daylight.mjs` | The Coach Cam's open-air world: sky dome, clouds, hills, sea, lighthouse, wildlife, rain and lightning, and the shared time-of-day scale that colours it all |
| `dist/scene/hall*.mjs`, `crowd.mjs`, `geom.mjs` | The indoor halls (roof profiles, trusses, windows, skylights, flags, bunting, pendants), instanced spectators, and shared geometry helpers (GPU-flutter flags and garlands) |
| `dist/scene/karen-view.mjs` | Karen on screen: the rigged GLB with its mixer (and a stand-in), the red scribbles, the annoyed pose everyone strikes near her and the coach's calming pose |
| `dist/scene/coach-cam.mjs` | Coach Cam: first-person camera, look and field-of-view limits, spring-driven hands, held items, crosshair picking |
| `dist/scene/coach-model.mjs` | Coach Panic: loads the Meshy character (`dist/assets/coach-panic.glb`), picks his clip from what the coach is doing (Run for every movement, IdleScan and an occasional IdleScratch standing, Walk for the walk in), plans the walk in, and swaps him in for the classic coach |
| `dist/scene/swimmer-models.mjs` | The five generic swimmers (`dist/assets/swimmer-*.glb`) and the two cannonball men (`carl.glb`, `leopard-man.glb`): which one a guest is, the clip they play (Walk and Run by foot speed, the swim, IdleScan and IdleScratch, Panic, and the men's Cannonball), the classic poses copied onto the model's bones, what rides on the head and chest, and the swap for the classic swimmers |
| `dist/scene/figure-pose.mjs` | The cannonball man's clip from the incident: the Cannonball clip's time through the wind-up, charge and flight, the swim from the splash until he is out, and how far he lies on the water (pure) |
| `dist/scene/fish-model.mjs` | The fish (`dist/assets/fish.glb`): loads it, stands it in a group of the fish's size, dresses the classic koi `fishObject` builds with it (now or when it arrives), and gives each fish its own swim wave in the vertex shader |
| `dist/input.mjs` | Keyboard/touch intents and held input |
| `dist/guidance.mjs` | Shared world/HUD guidance state and pulse |
| `dist/moments.mjs` | Incident moments: sting and stamp text, first sightings, queueing, slow motion and hit-stop timing, edge-arrow geometry |
| `dist/progression.mjs` | Record normalization (levels and drills), stars, unlocks and the `UNLOCK_ALL` playtest switch |
| `dist/campaign.mjs` | Acts, chunks and the finale as a view over `SHIFTS`: zone progress, "you are here", level and drill states, panel icons. No DOM |
| `dist/drills.mjs` | The six chunk drills (pure data) |
| `dist/bookings.mjs` | Act 2 bookings and `applyBooking` (pure data) |
| `dist/map-art.mjs` | The map's layout and isometric SVG art, as strings. No DOM |
| `dist/map.mjs` | The map's DOM layer: buttons, tags, coach, clouds and reveal, driven by the campaign state |
| `dist/audio.mjs`, `dist/audio-files.mjs` | Procedural music and effects; the list of recorded sounds that replace placeholders (Karen's voice) |
| `dist/tuning.mjs`, `dist/bisect.mjs` | The URL switches for isolating a crash, and the crash hunt's plan and state (pure); the scripted runs themselves are in `dist/app.mjs` |
| `dist/hunt/lunch-rush.json` | The shift that crashed an iPad, as the recorder kept it: what `?bisect=shift` plays back in every test (`replay-check.mjs` plays it through) |
| `dist/platform.mjs`, `dist/achievements.mjs` | The game's side of Steam: a bridge to the desktop app that does nothing in a browser (achievements, rich presence, quit), and the fifteen achievements as pure rules (what earns each, kept on the device, told to Steam when it is there) |
| `desktop/` | The Steam build: an Electron window around `dist/`, the Steam calls, the progress file for Steam Cloud, packing and SteamPipe scripts, and the notes for Steamworks. Its own README says how to run and build it |
| `docs/incidents.md` | Every incident, how a shift picks them today, the level-by-level table and the proposed director |
| `dist/story.mjs`, `dist/cinematic.mjs` | The Ocean Fund's rules and the intro and ending scenes as data (pure), and the small full-screen cinematic player |
| `dist/crashlog.mjs`, `crashlog-hooks.mjs` | The crash log: breadcrumbs, errors, reports and GitHub issue links (pure), and its browser wiring (window errors, console, visibility, WebGL loss, Web Locks) |
| `dist/trace.mjs`, `dist/scene/footprint.mjs` | What the crash log is fed: the shift's diary (what changed in the simulation, in plain words, one line per change: the coach, the rescue, the rings, the swimmers in trouble, each running incident's stage through its own `describe`, the gear, the pool closing, a stage that has gone on too long, the shift's plan and a periodic pulse of where everything is) and the scene's footprint (nodes, meshes, lights, an estimate of the GPU memory for geometry, textures and shadow maps). Both pure |
| `dist/report-send.mjs`, `netlify/functions/report.mjs` | Sending a crash report to the developer: the device code, the player's say on sending by themselves, the POST (pure, with the fetch handed in); and the Netlify Function that keeps reports in Netlify Blobs and gives them back by device code |
| `dist/playtest.mjs`, `dist/replay.mjs`, `tools/replay.mjs` | Playtest mode (`?playtest`): the switch, the live copy's sender and the notes on what has been played and seen (pure); the recorder that makes a shift replayable (pure); and the command line that plays a recorded shift again, headless, and prints its diary |
| `tools/crash-triage.mjs`, `docs/crash-watch.md` | The crash watch: the reader that lists what the creator's devices have sent and sorts it (a crash, an error, a stuck incident, a flag, a hunt test), and the standing brief of the hourly session that looks into what is new |
| `dist/version.mjs`, `stamp-version.mjs` | The build's identity (`dev` locally, the commit on Netlify) and the script that stamps it |
| `dist/assets/` | Bundled Three.js, rounded-box helper, the glTF loader with its two helpers, license, `fonts/` (the five font files and their licence), `models/karen.glb` and `audio/`; `coach-panic.glb` for Coach Panic, the five `swimmer-*.glb`, the cannonball men's `carl.glb` and `leopard-man.glb`, the fish kid's `fish-kid.glb` and the fish, `fish.glb` |
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

Open `http://localhost:8000` (or run `npm start`). Do not open `index.html` through `file://`, which can block ES-module loading. No dependency installation or build is needed to play. Adding `?coach=classic` brings back the coach built from balls and boxes (see Coach Panic), and `?swimmers=classic` the swimmers (see The swimmers' models). Adding `?debug` to the URL exposes `window.__pool` for fast-forwarded repros and screenshots: `play(level)`, `step(seconds, drive)`, `end(score)` (finish the shift with a score), `coachCam(on)`, `unlockAll()`, `lockAll(on)` (see the star-gated map), `progress(n, stars)` (records as if levels 1..n were cleared), `menu()`, `select(level)`, `selectDrill(id)`, and read-only `sim`, `world`, `moments`, `records`, `selected`, `map`, `crashlog` and `playtest` (its parts: `on`, `coverage`, `live`, `recorder`, `open`, `close`, `flag`, `trigger`). Adding `?locked` previews the real star-gated map while `UNLOCK_ALL` is on.

### Crash log

The game keeps a black box of its own (`dist/crashlog.mjs`, wired to the browser in `dist/crashlog-hooks.mjs`), so that when it breaks on someone's device the report says what broke, where, on what, and what the game was doing, without anyone having to describe it. It exists because a shift once stopped when an incident kicked in and there was nothing to read afterwards.

- **What it records.** Uncaught errors and rejected promises; every error in a stage of the frame loop or in a single event; a lost WebGL context; three.js's own errors (a shader that did not compile) and every other console error or warning as a breadcrumb; a page that vanished in the middle of a shift (a tab crash, running out of memory, a freeze that ended in a forced close). The next launch can tell because that page's Web Lock is gone; a page in the background, one that closed, or one still running in another tab is not a crash. Also: how the frames are going and the GPU, scene and heap counts every 10 seconds and a few seconds after every save or incident (draw calls, triangles, geometries, textures and programs the GPU holds; the nodes, meshes, skinned meshes and bones, lights and shadow maps in the scene and an estimate of the megabytes their geometry, textures and shadow maps take; particles, people and page elements: a count that only climbs from shift to shift is a leak; the drawing surface's size and WebGL version are in the device line), the shift's state every 2 seconds (level, venue, lighting, view, clock, score, active incidents, the rescue's stage, where the coach is and what he carries, how many people are in each status, the shift's seed) and a trail of breadcrumbs (shift starts, every event the simulation reports with what it carries except the endless ones, pauses, view switches, world builds and how long they took, the player's clicks and presses of E, and any frame that took over 0.7 seconds).
- **The shift's diary.** `dist/trace.mjs` looks at the simulation after every frame and writes one plain line for each change that matters, so the last minute of a crashed shift reads like a story instead of a stack: `t7s swimming carrying lifering @-4.4,0`, `t7s life ring 0: coach → victim #1`, `t7s #1 Coco (intermediate) swim → exit (water)`, `t8s climb`, `t10s rescue over`, `t17s life ring 0: victim #1 → deck @-8.9,-0.2`. It follows the coach (what he carries and whether he is on the deck, in the air, diving, swimming or climbing), the rescue (stage, kind, who), each life ring, the incidents running, a cleanup in the water, and every swimmer in trouble or on an odd status; ordinary arrivals, swims and departures write nothing (a whole idle shift is a handful of lines). It only reads the simulation (a check proves the same rescue ends in exactly the same state with and without it), and if it ever throws it switches itself off with an error in the log instead of touching the game. `trace-check.mjs` drives it through a real rescue.
- **Where it lives.** Only on the device, in `localStorage`: `pool-panic.crashlog.v1` is the list of launches and `pool-panic.crashlog.v1.<id>` holds one launch each (so two tabs never overwrite each other). The last eight launches are kept (the ones that went wrong outlive the clean ones), each within 90 KB and 400 breadcrumbs (a playtest keeps a bigger budget: see Playtest mode). Saves, incidents, rescues and errors reach the disk at once (the page may be about to die); everything else within half a second.
- **Getting a report to the developer.** After a crash the next launch opens a dialog with the report: **Send report** (one tap: it goes to this site's own `/api/report`, see below), **Copy report** (paste it into the chat) or **Report on GitHub** (opens a prefilled issue in `larvuz2/poolpanic`, with the whole report on the clipboard because the link carries a shortened one). The Help dialog has "Open the game log" any time (it can send the log of a shift that did not crash, too), and `?log` opens it on load. An error that stops a shift opens the same dialog on the spot, with Restart and Back to the map. The box *Send crash reports by themselves from now on* is ticked the first time and is the player's say: tap Send with it ticked and every later report from this device goes by itself at the next launch (a toast says so; one that cannot be sent stays on the device and the dialog offers it as before), untick it and none does. Sending is only offered on a page served over http(s), never in the desktop app.
- **What is sent, and what is not.** The report as the dialog shows it (the build, the device's browser, screen and GPU, the error, the game's state and the diary) and the raw launch it was made from, nothing else: no name, no account, no address, no cookies; the server keeps the browser's user-agent line and never the IP address. The *device code* (eight characters, e.g. `K7Q2M5XA`, made on the device the first time it is needed and kept in `pool-panic.reports.v1`) is the only label: the reports a device sends are found by it. Anyone who knows the code can read that device's reports, so it is shown only in the dialog (with a **Copy code** button, to paste into the chat: reading letters out by voice goes wrong) and in the header of a report that is copied or sent.
- **Reading what a device sent (the developer's side).** `netlify/functions/report.mjs` is a Netlify Function at `/api/report` (the site's `[functions]` setting is in `netlify.toml`) that keeps each report in Netlify Blobs, at most 40 per device (the oldest go), and answers plain GET requests, so anyone who can open a URL can read them: `GET /api/report?device=K7Q2M5XA` lists them newest first, `&latest=1` is the newest as Markdown, `&id=<launch id>` one of them, and `&format=json` the raw record. Sending is limited (a size cap, 40 new reports an hour per device, 400 new reports and 2400 replacements of a report already held an hour for the whole site) and never takes the game down; a server that is not Netlify (`npm start`) answers the POST with an error and the dialog says the service is not there. Set `REPORT_ADMIN_KEY` in Netlify (Site configuration → Environment variables, with the **Functions** scope, then redeploy) to also list every device's newest reports at `?admin=<key>`; without it that path answers 404 as if it did not exist. There is no expiry and no delete endpoint: a device keeps its newest 40 reports, and test records can be removed in Netlify's Blobs page. `report-check.mjs` drives the function against an in-memory store and `report-send-check.mjs` the game's side.
- **Errors no longer stop the game by themselves.** Each stage of the frame loop is guarded (`stage()` in `dist/app.mjs`): drawing, tags, alerts and the HUD log their error and are skipped, and each event in a batch is handled on its own. Only the simulation throwing, or a stage that fails for 1.5 seconds straight, pauses the shift and shows the report.
- **Which build.** `dist/version.mjs` says `dev` from a checkout. Netlify runs `node stamp-version.mjs` before the checks (see `netlify.toml`), which writes the commit, deploy context and branch into it, so a report names the exact build.
- **Reading one.** A report is Markdown: the build, device (user agent, viewport, pixel ratio, GPU, the drawing surface, cores, memory), the game's state, each error with its stack and the game state at the time, and the timeline (the newest 400 breadcrumbs, each with the seconds since the page opened and, in the diary's lines, the shift's own clock). `?debug` exposes `window.__pool.crashlog` for QA; `crashlog-check.mjs` drives the whole thing with a fake browser.

**Isolating a crash on a device.** A report says where the game stopped; these URL switches say why, by taking one suspect out at a time (add them to the address, e.g. `?nosound&dpr=1`; `dist/tuning.mjs` lists them): `nosound` (the audio never starts), `dpr=N` (cap the pixel ratio at N instead of 1.7), `noshadow` (no shadow maps), `noparticles` (no splashes, sparkles, bursts or confetti), `nohands` (no first-person hands layer), `nohall` (the indoor hall and roof stay hidden), `nolights` (no point or spot lights), `nopoints` (no glow points), `noaa` (no antialiasing), `nomodels` (no character model is fetched or drawn: the classic coach, swimmers, kid, Carl, fish and Karen, for this page only, where `?coach=classic` and `?swimmers=classic` are remembered), `overview` (the overview camera whatever the setting), `norender` (the 3D scene is updated but never drawn) and `nosync` (it is neither updated nor drawn: the simulation and the page go on), the last two to tell a crash in the graphics from one in the script, and `safe` (all of them but `dpr`, `overview`, `norender` and `nosync`). The crash hunt gives a test the same words, and a number as `dpr=1`. The switches show up in a report's `Page:` line.

Two scripted runs make a crash easy to hunt on the device itself. Both play level 10 in the Coach Cam with the player idle (Carl's cannonball, then the fish kid) and show a banner on top:

- `?trial` plays it once with whatever switches the address carries (`?trial&noshadow`) and says whether the page survived (`?trial=shift` plays the recorded shift of the 45-second crash below instead).
- `?bisect` runs the whole plan in `dist/bisect.mjs` (`?bisect=hands` runs the hands plan below), one switch per test (everything on, the character models off, then each other suspect off, then all off), reloading between tests. The state lives in storage, so a test whose page dies is counted as a crash by the next page; open the same address again after a crash and it carries on. At the end it lists the results with a verdict ("the crash went away with: …") and a **Copy results** button. `?bisect=reset` starts over (`?bisect=shift` runs the shift plan below).

**The hands crash (Safari).** The crash hunt found that the Coach Cam's first-person hands layer crashed an iPad's Safari about 45 seconds into every Coach Cam shift, whatever was happening (with the hands off, or in the overview, nothing crashed; the earlier suspects made no difference). It is a second render pass (`CoachCam.render`: clear the depth, draw the arms and the held item with their own camera and lights), and no GL object is created per frame in it, so the cause is on the device. Until it is understood, Safari's engine (every browser on an iPhone or iPad) plays the Coach Cam without the hands (`isWebKit` in `dist/tuning.mjs`, a toast says so); `?hands` turns them back on. `?bisect=hands` runs a second plan that looks inside the layer, one change per test: no depth clear (`handsnodepth`), no shared reflections (`handsnoenv`), no lights of its own (`handsnotorch`), unlit colours (`handsbasic`), and drawn in the room's own pass (`handsinline`: the hands become children of the room camera, scaled to give the same picture, with no second render at all).

**The 45-second crash in a played shift (October 4, 2026), not understood yet.** The playtest (below) was played on an iPad Pro in Safari 26.6 (a 1366×892 page at 1.7 pixels, a 2322×1516 drawing surface, the overview, the character models) and the tab was killed five times in eight minutes (Safari reloaded the game within a second each time). Four were in a shift, **46.4, 46.1, 44.0 and 43.4 seconds after the go**, on levels 4, 7, 2 and 2 (three with an incident forced from the panel, and one, a level 2, a plain natural shift), and the fifth as the page came back from the background during a level 2 countdown (a tab killed while hidden looks the same); the 30 s shift of level 1 went through. The shifts play again exactly in Node (`tools/replay.mjs`: every checkpoint matched), so the simulation is not what stopped. What the log of the last seconds shows: the frame rate fell from 79–84 with nobody on the deck to 37–46 with eight to twelve skinned characters; the scene's own counts were flat (geometries, textures, programs, the megabytes they hold); and the crash came shortly after the first customers lost patience, which is just the time at which that happens, so it says nothing more than the clock. The menu is no evidence of safety: under the map the 3D scene is not drawn at all (`covered` in `frame()`), so the minute the creator spent on the title with eight models there cost the GPU nothing. What was checked instead, in Chromium (software WebGL): across a shift the GPU is called about 330 times a frame (583 matrix uploads, 307 vertex-array binds, 7 bone-texture uploads) and creates nothing per frame; the JS heap and what the renderer holds stay flat. The music makes about 70 Web Audio nodes a second (a new buffer nine times a second among them); they now disconnect themselves when they end and share one noise buffer (`dist/audio.mjs`), which is a guess made because the crash comes at much the same time whatever the scene holds, not a finding. To find it on the device, `?bisect=shift` (add `&playtest` to read it from here as it runs) plays the shift that crashed the iPad again in every test, in the overview: the level 2 of 4 October as the playtest's recorder kept it (`dist/hunt/lunch-rush.json`: the level, the seed and every input with the tick it came before), fed to the simulation through the game's own frame loop, so every test plays the very same shift (in Chromium it matches the recording at every checkpoint) and the tests differ in one switch only; the recording is of a shift that was played, with swimmers in the water, and it lasts 46 s, so the shift goes on idle after it until 56 s from the go, a long way past 43 to 46 (`?bot` plays a level 3 instead, with a bot that every 0.7 s sends the swimmer who has waited longest to the emptiest lane that will have them, from a seed that stays playable for 75 s, for when a recording is not wanted; a page that cannot fetch the recording does that too). The tests are: everything on, then the pixel ratio at 1, the 3D scene updated but never drawn (`norender`), the 3D scene not even updated (`nosync`; between them they tell the graphics from the script: a crash that survives `nosync` is in the simulation, the page or the log), the character models off, shadows off, antialiasing off, the hall off, particles off, extra lights off, all of them off, and the first test again. What a replay cannot give is the player's own touches on the page (the cards and lanes): if the replayed shift does not crash and a played one does, that is where to look next. The page holds the screen awake (the Screen Wake Lock), counts only the time it is in front of someone, presses play again if the page was hidden, and leaves a test it could not play through as `unclear` rather than `ok`. Safari reloads the page by itself after a crash and the plan carries on; at the end it lists the results with a verdict. `?trial=shift` plays one such shift with whatever switches the address carries.

**A second iPad report (October 3, 2026), not understood yet.** The game "broke" when opened in Safari on an iPad, with no report to read, and it has not been reproduced: there is no WebKit where the game is developed, only Chromium. What was checked instead: the merged build (Karen, the character models, the fish) plays 26 incident cases in Chromium without a page error, in the overview and the Coach Cam, in all four venues; the graphics and script memory it uses (the models add about 35 MB of textures and geometry) is far below what an iPad allows; and the source uses nothing newer than iPadOS 15.4 supports. Two changes were made on suspicion and cost nothing: the fonts are bundled (the Google Fonts `@import` could hold up the first paint when the network was slow or out), and `nomodels` was added to the hunt so it can rule the character models in or out. To find the cause the game needs a report from the device: **Copy report** in the crash dialog if it appears, else the **Copy results** of `?bisect` (open the game's address with `?bisect` on the end and let it run; it reloads itself between tests and carries on after a crash), and the iPad's iPadOS version.

**A third iPad report (October 4, 2026), not understood yet: the page dies after an incident.** The creator was playing (they did not note the level) and, after a cramp, took the life ring, jumped in, gave it to the swimmer and, when the swimmer got out of the pool, the app crashed; they said it crashes a lot after incidents. It has not been reproduced. What was checked instead, in Chromium (software WebGL): the whole rescue (the cramp, the ring from the wall, the dive, the swim, the handoff, the swimmer climbing out, walking to the bench and resting, the ring back on the deck, the swimmer going back in) played by a script through the game's own frame loop, in the overview and in the Coach Cam, without a page error, an error in the log, a stall or a frozen page; with the GPU really drawing every sixth frame, what the renderer holds stayed flat from the shift's first seconds to the end (27 programs, 239 geometries, 48 textures, the scene's nodes back to where they began once the particles had gone), so a rescue leaks nothing; and every event, particle and effect it sets off shares its geometry and materials. One real bug did turn up in that flow and is fixed: the coach climbs out of the water on the very side the swimmer walks to the bench by, and when he stood in the way a collision pushed the swimmer into the margin of the pool's keep-out box, where the guard against stepping into the water threw them 4.5 m back to the end of the pool, again and again, so they never reached the bench (`moveAlong` in `dist/sim.mjs`; `rescue-check.mjs` holds the coach in the way for the whole walk on levels 3 and 12). The fix is only for that swimmer on purpose: every other walker who is pushed into the same margin is still sent to the end of the pool as before, because changing that moves the whole game's balance (level 10's bot scores shift by thousands of points) and belongs to a tuning pass of its own. It is not a crash, though. So the cause is likelier on the device (memory or the GPU) than in the logic, and what was built is what finds it next time: the shift's diary and the scene's counts in the crash log, and **Send report** (see Crash log). After the next crash, open the game once more and tap Send (the dialog opens by itself at launch), then read out the device code the dialog shows.

### Playtest mode

`?playtest` on the address turns it on for that device (the device remembers: `pool-panic.playtest.v1`; `?playtest=off`, or **Turn playtest off** in its panel, ends it). It exists so that someone can play all twenty levels on a device with no console, on an iPad in Safari, and the developer can still see what every incident did, where a shift got stuck and what came just before a crash. Nothing in it exists for an ordinary player; it is `dist/playtest.mjs`, `dist/replay.mjs` and a section of `dist/app.mjs`.

- **A bug button.** 🐞 sits with the other buttons at the top right (on the map too). It pauses the shift and opens the panel: where the game is (level, clock, the incidents running), a row of kinds (stuck or frozen, looks wrong, unfair, confusing, slow or about to crash, other), a note (the keyboard's dictation works) and **Flag it and keep playing**. A flag keeps what the player said, its kind, the game's state at that moment and the last 14 lines of the diary, whole (the diary is a ring and moves on); it is sent at once, it is in the report under *Flagged by the player*, and it makes a launch worth sending even when nothing crashed. The panel also shows the device code (with **Copy code**), **Send the log now**, **Copy the report** and **Start the playtest notes over**.
- **The log is sent while the game runs.** A page that crashes cannot say anything, so a playtest sends the log again and again (`LiveSender`): every 20 seconds while something changed, every 8 while an incident or a rescue runs, within 2 for a flag, a new error, a save or any incident moment and at a shift's start and end, doubling after each failure (up to two minutes), after the pause the service asks for, and once more when the page goes into the background; it never has two sends in flight and stops for good on a server with no report service (`npm start`). The service keeps one copy per launch and replaces it, so the stored data does not grow, and the copy on the server is seconds old when a page dies, and can be read while the shift is played. A playtest sends by itself without the box ticked (whoever turned it on is the one who reads it); the account, name and address rules of **Getting a report to the developer** are unchanged. A launch after a crash sends the crashed launch's final copy at once.
- **A longer, fuller diary.** The crash log's budget is 1000 breadcrumbs and 240 KB per launch (four launches kept) instead of 400 and 90 KB. Every incident module says where it stands through `describe(sim)` (a state that changes only when its stage does: the fish's `stage loose · kid crying · net wall · pool closed`, Karen's `stage ranting · ranting`, the outage's `stage dark · flashlight rack`, the dog's `stage loose · dog steal · carrying fins`, Carl's stage, step and cannonballs) and its numbers through `detail(sim)`; the diary writes a line each time the state changes (in a playtest every step, in an ordinary report only the stage). A new incident must have both, or its stages are not in the diary. The diary also says when the pool closes and reopens, when a lane is taken out of service or the storm begins, and where the fish net, the flashlight and the medical kit are whenever they move. **A state that has lasted 25 seconds of the shift's own clock** (a pause does not count) is written as `waiting …` with what the coach was doing, and again at 50, 100 and 200 seconds, so a stuck incident says what it is stuck in. Every 8 seconds, and every 2.5 while an incident or rescue runs, a `pulse` line gives the score, the coach, the crowd and each incident's `detail` (where the kid, the fish, the dog, Karen and Carl are, the fish's stamina, Karen's calm). Every shift starts with a `plan:` line (what the level has in store and when: `plan: fish@32s, outage@63s, twist@60s`), in every report, playtest or not.
- **A shift can be played again.** The recorder (`Recorder` in `dist/replay.mjs`) wraps the simulation's input methods (move, jump, dash, E, lanes, fetching, and an incident or cramp started from the panel) and keeps, for each shift, the level, the seed, the booking or drill, every input stamped with the tick it came before (movement as a number into a table of the nine or so vectors the controls make, so a 100-second shift is about 6 KB) and a hash of the simulation every five seconds. The newest shift's record is in the report under *Replay*, as one line of JSON. `node tools/replay.mjs <report.md> --diary` makes the same simulation, gives it the same inputs, checks every hash and prints the diary with every step (`--pulse` for the positions, `--until 74` to stop at a second, `--nth` to take an earlier shift). A shift played in Chromium with real keys and a trigger from the panel replays in Node with every checkpoint matching (`replay-check.mjs` does the same with a bot that gives every input). **Caveat:** two JavaScript engines may disagree about the last digit of a sine or a hypotenuse, so a shift recorded in Safari (JavaScriptCore) may drift from the replay in Node (V8) after a while; the replay says at which tick it did, and everything before is faithful.
- **What has been covered.** The notes (`Coverage`, kept on the device in `pool-panic.playtest.seen.v1` so they add up across reloads and crashes) count, for each level and drill, the runs and how many were finished, the best score, the incidents that began and the ones that were saved, every other event that is not routine (a dumped fish, a blackout, a crash) and the flags. They are in every report under *Playtest so far*, ending with the incidents never seen, and in the panel ("Seen so far / Not yet").
- **Make an incident happen now.** Cramp rescue, fish kid, loose dog, cannonball man, Karen and the power cut, in any level: each button says why it is not available (a rescue, a cleanup or another incident is going on, the pool is closed, nobody is swimming, the level is 1). It starts the incident the way the level's own plan would (`triggerChaos`, `startCramp`), writes `playtest trigger fish ok` in the log and is part of the recording. It changes the level being tested, which the log shows. A shift that does not plan the fish or Carl has not fetched their models as it began, so the panel fetches them first (the kid and the fish, the level's cannonball man; a few seconds at most) and the tester sees the models a player would, not the classic stand-ins. **Back to the map** (while a shift waits behind the panel) leaves the shift where it is for the map.
- **Reading it (the developer's side).** As for any report: `GET /api/report?device=<code>&latest=1` is the newest launch as Markdown (in a playtest that is the one being played, replaced every few seconds), the plain list of the device shows each launch's headline (`Playtest L7 · 2 flagged: fish kid froze · no errors`), and `tools/replay.mjs` reads the *Replay* out of the saved Markdown. The creator opens the game with `?playtest` once, reads out or copies the device code from the toast or the panel, plays, and taps 🐞 when something is wrong; a crash needs nothing more than opening the game again.
- **Checks.** `playtest-check.mjs` (the switch, the sender's timing, back-off and stopping, the notes), `replay-check.mjs` (recorded shifts of every kind replayed to the same state, a tampered record drifting, the command line), and the playtest parts of `crashlog-check.mjs`, `trace-check.mjs`, `report-send-check.mjs` and `report-check.mjs`. In Chromium (software WebGL, a fake report service): the panel at iPad size, flagging with a note, triggering an incident, the live copy's cadence (14, 9, 9, 9 seconds while an incident ran) and content, and every incident case of `all-incidents.mjs` run with `&playtest` without a page error. **Not verified:** iPad Safari (the panel's layout with the on-screen keyboard, the page going into the background, the log's writes on WebKit), the live copy against the real Netlify Function (it was driven against the check's in-memory store and a fake route), and replays recorded on WebKit.

### Crash watch

A crash on the creator's iPad is looked at without anyone asking (`docs/crash-watch.md` is the brief). The game already sends its crash log by itself in a playtest, so the first half needs nothing; the second half is a Claude session on the creator's account, "Crash watch", woken **every twelve hours** by a routine of the same name (hourly was the first choice; a run is paid for again in the whole conversation, which grows with every wake, so the creator chose twelve: `docs/crash-watch.md` has the numbers) (one long-lived session with the repo attached: a routine's own fresh session has no repository and no GitHub access, so it could read the reports and write them nowhere). It reads what the creator's devices have sent with `tools/crash-triage.mjs` (`node tools/crash-triage.mjs CODE --issue 22`: each launch of a device is a crash, an error, a stuck incident, a flag, a test of the crash hunt, or clean; what has been dealt with is named by a token such as `muu6aara97:c` on a `handled:` line of the log issue, which the reader reads itself, so nothing is looked at twice; a stranger's comment on the public issue counts for nothing), looks into each new one (the replay of its shift, the diary of its last seconds), and writes it up in **one comment on one GitHub issue, "Crash triage log"** (the issue is public with the repo: no device code and no whole report goes into it). A crash that is the known one (a tab killed 38 to 55 s after the go with no error: the 45-second crash above) is only counted. A hunt run (`?bisect=shift`) is read together, with each test's outcome, and the verdict said. A **small, understood fix** (about 40 lines, a check that fails before and passes after, the whole suite green, nothing that changes the look or the balance) goes on its own branch, `claude/crash-watch` (one commit per fix). It **never merges, never opens a pull request, never pushes anywhere else**, and the creator's phone is pinged (by the session's own `PushNotification`) only for a new kind of crash, a hunt's result or a pushed fix. A run that finds nothing new stops at once. Checked on 4 October 2026: the session, started with the repo, read the log issue, ran the reader against the real service, wrote a comment, pushed its branch and asked for a phone ping (the tool answered "Mobile push requested"); the routine woke it by itself, and a run with nothing new took about ten seconds and 9 to 40 cents of usage (more in a recreated container, with a longer conversation; the first run of a cold session cost about 27 cents). Not verified: a real crash going through it end to end (none has arrived since it was set up, so the first one is the test), that the phone buzzes, and a fix is never said to work on the iPad, where nothing here runs. To stop it, say "stop the crash watch" (the routine is deleted and the session archived; the issue and the branch stay). `crash-triage-check.mjs` reads reports made by the real crash log through a fake service.

### The story and the Ocean Fund

Coach Panic wants to take Marina to the ocean and has to earn the trip. The very first launch opens with a short, skippable cinematic (four scenes, about 15 seconds, click / Enter / Space for the next scene, **Skip** or Esc to leave) before anything can be played. It is not shown again, but the 🌊 pill in the top bar (menu), Help → "Watch the story again", or `?story` replay it.

- **The fund.** Every finished shift (and drill) pays: $10 for finishing plus $30 per star, times the booking's payout (bookings are the "gigs": a riskier one pays more). Only pay beyond a shift's best counts, so replays cannot farm it and the fund never goes down. The trip costs $1,500; a full season at three stars covers it. The results show what the shift paid and the fund's bar, plus a text from Marina at 25, 50, 75 and 100%.
- **The ending.** Filling the fund earns a short beach cinematic; "Watch what happens" then appears on every results screen.
- **Placeholders.** `dist/story.mjs` holds the rules and every scene as plain data (a backdrop plus emoji layers and speech bubbles), and `dist/cinematic.mjs` plays them, so real art and character models can replace them later without touching the rules. What was seen and earned is kept in `localStorage` (`pool-panic.story.v1`). `?debug` sessions skip the intro.
- **Checked by** `story-check.mjs`: pay, sanitised saves, the no-farming rule, Marina's texts once each, well-formed scenes, and the player's next, skip, keys and auto-advance.

### The desktop app and Steam

`desktop/` is the Steam build: the same `dist/` in an Electron window (Chromium inside, so no browser quirks), served from the player's disk with no network. `desktop/README.md` says how to run it (`cd desktop && npm install && npm start`), pack it (`npm run pack:win`, `pack:mac`, `pack:linux`, each on its own system, as a folder Steam can patch file by file) and upload it with SteamCMD; `desktop/steam/checklist.md` is the whole road to a release, including what only the creator can do on Valve's side; `desktop/steam/achievements.md` is what to type into Steamworks for the achievements.

- **Not a fork.** Nothing in the simulation or the scenes knows about it. The game talks to the desktop app through `dist/platform.mjs` (`window.desktop`, which only exists there; every call is a no-op in a browser), and the Steam calls sit behind `desktop/steam.cjs`, a wrapper that cannot throw: no Steam client, no native module or an unknown achievement all end in "no", and the game plays the same without Steam.
- **Saves.** The game keeps progress in the browser's storage, which no cloud can sync. In the desktop app the preload script copies the player's keys (records, story, settings, achievements; never the crash log) to `saves/progress.json` when they change (written atomically, the previous file kept as `progress.previous.json`) and puts them back before the game starts. The file wins, so a newer one from Steam Cloud is used. The Auto-Cloud settings are in `desktop/README.md`.
- **Achievements.** `dist/achievements.mjs` holds fifteen, earned from the saves the simulation already reports (rescues, the fish, the dog, Carl, Karen, the breaker, first aid) and from stars and the Ocean Fund. They are kept on the device and shown as a toast in any browser; in the desktop app each is also unlocked in Steam. Steamworks needs each name entered by hand (`desktop/steam/achievements.md`).
- **The window.** Esc is the game's pause, which has a **Quit to desktop** button in the desktop app; F11 or Alt+Enter toggles full screen. The page has no Node (`sandbox`, `contextIsolation`), can reach only `app://game/`, links leave only to GitHub and Steam, and its Content-Security-Policy allows nothing from the network. If the window's process dies it is reloaded (so the game's own crash dialog can say what happened), at most three times a minute, then left alone with a message.
- **Verified here:** the packaged Linux app starts, plays a shift, writes the progress file and, with the browser's storage deleted, restores from it; the real `steamworks.js` loads and falls back with no Steam client; the wrapper against a fake `steamworks.js`; `desktop-check.mjs` and `achievements-check.mjs` (no Electron needed). **Not verified** (it needs a machine with Steam): the overlay, a real unlock, Cloud, the Steam Deck, the Windows and macOS builds. `desktop/steam.config.json` uses Valve's test app 480 (Spacewar) until the game has an app id of its own.

### Deploy on Netlify

`netlify.toml` holds every setting, so connecting the repository once is all it takes:

1. In Netlify choose **Add new site → Import an existing project → GitHub** and pick `larvuz2/poolpanic`.
2. Keep `main` as the production branch. Netlify reads the build command (`npm test`), the publish directory (`dist`) and the Node version (22) from `netlify.toml`, so leave the build fields in the UI as they are.
3. Deploy. From then on every push to `main` redeploys automatically, and every pull request gets its own deploy preview link.

There is nothing to bundle: the build step only runs the regression checks (about two minutes). If a check fails, that deploy fails and the previous version stays live. To publish without the checks, set `command = ""` in `netlify.toml`. The config also serves `.mjs` files with a JavaScript MIME type (the game loads as native ES modules) and adds `nosniff` and referrer-policy headers.

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
| `node chaos-check.mjs` | Loose Dog, Cannonball Carl and Power Outage prevention and recovery; Carl or the leopard man by level, and the crowd held and panicking while he is in the pool |
| `node trampoline-check.mjs` | Splash Park lanes, flips, splash-lane lock, lane moves, crash rings and first aid |
| `node season-check.mjs` | Coach bot plays levels 4–20 (twists, VIP guests and the storm included), every chunk drill and every booking (levels 11–20) end to end; star-target sanity, prevention beating a reactive coach, and crash recovery (`--table` for scores) |
| `node campaign-check.mjs` | Acts, chunks and the finale (every level in one zone, numbers stable, "soon" slots for a partly built season), star-gated progress and chunk completion, the Splash Park name, Act 2's three venues, drills that open at five stars, bookings that trade payout for trouble, the rush, closure, swim-team, aqua-class and storm twists through the real simulation, VIP scoring and the shared floor plan |
| `node map-check.mjs` | The map's layout and art: ten levels on four islands per act, no two buttons overlapping at any scale in the wide or the tall drawing, well-formed SVG with per-act ids, night moon, and each shift's preview icons |
| `node interplay-check.mjs` | Incidents colliding: goggles vs the fish net, early fish return, kid during a rescue, cramps mid-flip, second crash ring, healed victims rejoining, breaker race |
| `node moments-check.mjs` | Incident moments: every incident and save reported through real game flows, loud-alert targets and ranking, first sightings, sting queueing, slow motion and hit-stop timing, banner fuses, edge arrows (and behind-you), the camera nudge |
| `node hunt-check.mjs` | The crash hunt: the URL switches (`nomodels` included), the plan, surviving the crashes it hunts (a test left running counts as a crash), verdicts, damaged saves; the shift plan (the numbers a test hands the switches, its unclear tests and its repeat) |
| `node achievements-check.mjs` | The fifteen achievements: what earns each, the saves that map to them, kept once and remembered, unknown names from a newer save ignored, every one named in `desktop/steam/achievements.md`, and the game's bridge doing nothing in a browser and passing calls on in the desktop app (a call that throws included) |
| `node desktop-check.mjs` | The desktop app without Electron: which file an `app://game/` address means (climbs, encoded slashes, backslashes, NUL bytes, other hosts and schemes refused), file types, what the save file may hold (the crash log never), which links may leave, where a window may reappear, the Steam wrapper against a fake `steamworks.js` (no module, no Steam, unknown names, a throwing call), and the settings that keep the window locked down and an upload from going live by itself |
| `node story-check.mjs` | The story: pay and payouts, sanitised saves, a fund that cannot be farmed, Marina's texts, well-formed scenes, the cinematic player against a fake dialog |
| `node trace-check.mjs` | The shift's diary: a whole cramp rescue read as a story (cramp, ring, dive, swim, handoff, climb, bench) from the real simulation, an ordinary shift quiet, looking changing nothing, events saying what they carry, every incident's stages in order (the short and the verbose diary, a `describe` that throws costing one line), a stage that goes on being said to be waiting at 25 and 50 seconds (a pause is not waiting), the pool, lane, storm and gear, the plan and the pulse, and the scene's footprint counting shared geometry once |
| `node playtest-check.mjs` | Playtest mode: the switch from the address and from the device, the live sender (gaps by reason, never two at once, back-off after failures, quiet when the service asks, stopped where there is no service, flush when the page goes) and the notes on levels played and incidents seen |
| `node crash-triage-check.mjs` | The crash watch's reader: reports made by the real crash log read as facts (the level, how long the shift had been played when the last word came with the time hidden left out, the final seconds), the known 45-second crash told from another, errors, flags and stuck incidents with tokens, tokens handed back so nothing is looked at twice, a hunt read as one run, a failing service said and never read as nothing new, the digest naming a device by two characters |
| `node replay-check.mjs` | Recording a shift: levels of every kind, a booking, a drill, incidents and a cramp started by hand, played by a bot that gives every input and replayed to the very same state at every checkpoint; only outermost inputs recorded; a tampered record saying where it drifts; the record in the crash log and read back from a report; the command line |
| `node audio-check.mjs` | The sound's chains of nodes: each one let go of when its source ends (a node that refuses breaks nothing), one shared noise buffer from a random place fading through the gain, the cheer and the music ending the same way |
| `node report-check.mjs` | The report service (`netlify/functions/report.mjs`) against an in-memory store that scrambles the order of a listing as the real one may: a good POST and every way to read it back, a report sent again replacing its earlier copy, the cap of 40 per device, every refusal (bad JSON, fields, device code, id, version, a body over the limit sent without a length, methods), the per-device and site-wide rate limits (and the separate budget for a report sent again), the admin list on and off and with a wrong key, no address or other header stored, a failing store answered with a JSON 500, and that `netlify.toml`, `package.json` and the lock still carry the function, its package and the format glob |
| `node report-send-check.mjs` | Sending a crash report: the device code, the player's say on automatic sending, where sending is offered (never in the desktop app), what is posted (the slim copy a playtest sends again and again, and a report too big for the service shrunk to fit with its newest lines kept), and every way a send can fail told plainly |
| `node crashlog-check.mjs` | The crash log: breadcrumbs and errors kept and capped, repeats counted, one storage key per launch, a page that vanished mid-shift told from the background, a closed page and another tab, reports and issue links that fit, a playtest's budget, flagged problems and recorded shifts, a full or broken storage, and the browser wiring against a fake browser |
| `node karen-check.mjs` | Karen: on level 4's plan, through a locker door to the coach, follows and stays off the water, annoys each person once (they stop, resume after), hold-E ring fills and drains, planted coach, latched click-to-calm, +100/+50, leaves and the influence ends, swimmers generated identically, and on screen: scribbles, her circle, hands over ears, the coach's pat |
| `node coachcam-check.mjs` | Coach Cam: facing follows the look, E prefers what is in view, view-relative movement, eye and water-level height with the body hidden, hand lag and settle, head bob (off with reduced motion), landing dip, items in hand, field of view, crosshair target |
| `node fish-model-check.mjs` | The fish model: the file's shape (one mesh, matte, no skeleton, nose to +z and back to +y from its vertices), fish dressed when the model comes or when they are made, each with a wave of its own and one program, a model that does not load leaving the koi, and the fish of the incident seen in the pool only once the kid has tipped it out |
| `node swimmer-model-check.mjs` | The swimmer models (stand-in skeletons): the choice and its switch, who gets which look, the clip rules (walk and run by foot speed with hysteresis, swim, scratch, panic) and each model's own ground speeds, the poses laid over the clips (arm and leg directions, easing), the swap in the scene and back, the Panic clip and its fallbacks, VIP crown and sash and daredevil star and cape riding on the head and chest bones, the type disc, queasy tint and a model that breaks being dropped; the cannonball men: the Cannonball clip followed through the incident, the swim in the water, and the crowd's panic (swimmers held upright in the water, the queue hopping) with the models and with the classic swimmers |

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

The Karen update (October 3, 2026: the incident, her rigged model, the annoyed and calming animations) is covered by `karen-check.mjs` and the extended `season-check.mjs` and `scene-check.mjs`. It was also driven through headless Chromium with software WebGL (ad-hoc Playwright scripts, not in the repository): Karen walking, ranting, pointing, being calmed and leaving in the overview, the progress ring filling, a queued swimmer with hands over their ears seen close up from the Coach Cam, the coach's patting hands in the Coach Cam, and no page errors. Her model loads from `dist/assets/models/karen.glb`; real GPU performance with it (30,000 triangles, a 19-bone skin), real devices and the placeholder voice (never listened to) are unchecked.

The Steam and desktop update (October 3, 2026) is covered by `achievements-check.mjs`, `desktop-check.mjs` and the extended `hunt-check.mjs`, `coach-model-check.mjs` and `swimmer-model-check.mjs` (the `nomodels` switch). The desktop app was also run, not only checked: in a Linux machine with no graphics card (software drawing, a virtual screen) both from the source folder and as the packed folder, it started, showed the game with its own fonts, played a shift, wrote `saves/progress.json`, and, after the browser's storage was deleted, restored from the file; with no Steam client it fell back to "playing without it". The Steam overlay, a real achievement unlock, Cloud, the Steam Deck and the Windows and macOS builds need a machine with Steam and are unverified. The iPad crash is unverified too (see the second iPad report above).

## Direction already established by the creator

These decisions reflect iterative feedback and should survive future work:

- The game is for a paid release on Steam, single player first, with the look (lighting, textures) done last. Until then the work is the game's systems, mechanics, characters and a loop that makes people want one more shift (see [The goal: a paid game on Steam](#the-goal-a-paid-game-on-steam)).
- Incidents should be spontaneous: different on every play of a level, some limited to some venues. The creator ranks the catalogue in `docs/incidents.md` before the draw is rebuilt.
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

Levels beyond twenty, further venues, families, multiplayer, accounts and network leaderboards are **outside the current prototype**, not promised features; the map has no slot for a third act. The release target is **Steam, single player first, as a paid game** (see [The goal](#the-goal-a-paid-game-on-steam)); the price, the launch date, a demo and any platform beyond Steam and the browser have not been decided, and those are the creator's to set.

Future design should deepen readable interactions and the one-more-shift feeling. Add an incident only when its warning, response, recovery, timing, and interaction with existing incidents are understandable. The incident-frequency question has an agreed direction (spontaneous draws, in `docs/incidents.md`) but no formula yet: it follows the creator's ranking, so do not invent one or expand scope based on guesses about past conversations.

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
11. Know the stage (see [The goal](#the-goal-a-paid-game-on-steam)): systems and the loop come first, the look comes last. Keep `dist/` free of anything that needs Steam or Electron; the desktop app and the Steam calls live in `desktop/` and behind `dist/platform.mjs`.
12. Read `CLAUDE.md` for how the creator works with agents, and keep it true when the way of working changes.

### Prior implementation references

Earlier work consulted Game Director, Gameplay Systems, Game UI Designer, and Graphics Builder guidance from https://github.com/majidmanzarpour/threejs-game-skills at revision `e5f301d548bb18c530afbece78cd25082f4cda9c`. This records provenance, not an installed dependency or a requirement to import a new framework. The current repository and creator's direction remain authoritative.
