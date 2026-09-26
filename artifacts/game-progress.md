# Pool Panic version two

User intent: preserve the version-one swim club and game loop; add WASD/arrow coach movement and Space jumping, physically collect and hand over equipment, use a front-facing Overcooked-like view, and suggest small high-impact additions after delivery.

Complete: direct movement and proximity interactions, normalized acceleration, collision proxies, jump-over-fin gameplay, front-wall service docking, finite physical gear, pickup/handoff audio and motion, perspective camera at x=0, fullscreen toggle, keyboard and touch input, updated in-game handbook.

Verification: coach-check.mjs passes movement, latency, diagonal normalization, braking, room/pool/furniture boundaries, jumps and landing, remote interaction rejection, one-item inventory, queue abandonment recovery, wall handoffs, aqua return, goggles return, jump-over-clutter, and key routing. simulation-check.mjs passes nine complete deterministic shifts and existing traffic/chemistry/scoring gates. Scene constructors and animation synchronization execute in Node with valid geometry; camera math places the coach within four viewport sizes. Local assets and module/control references pass checks. No browser screenshots or live browser input pass was performed in this environment; these are programmatic checks.

Independent review: read-only review identified fins disappearing on queue abandonment and aqua teleportation after treatment. Both corrected and regression checked.

Pending: publish this source to the existing owner-private Site and return its verified URL with ranked suggestions. No external asset jobs.


## Sprint three — dash and game HUD

- Implemented Shift dash (0.16 s burst, internal 0.82 s cooldown, no UI meter), normalized direction, collision substeps, carrying compatibility, jump compatibility, sound, and reusable speed streaks.
- Removed first-swimmer autoselection. Shared gold world/HUD pulse now guides swimmer selection and all three lane targets; a two-note selection sound bridges the action.
- Replaced white web-style cards with dark teal arcade scoreboards, swim passes, inventory slots, embossed lane plaques, and game menus. Kept emojis and optional help.
- Independent read-only review found two defects: chlorine overriding glowing assignment and short-landscape roster/control overlap. Both were fixed; assignment has regression coverage and the control regions were separated. Further projection checks identified the coach behind the bottom HUD on short screens; responsive world bounds were adjusted.
- All three deterministic suites, CPU scene construction/ray picking/projection checks, syntax, local asset imports, and DOM ID consistency checks passed.
- Browser preview is unavailable for this static architecture under the supported Sites workflow. No WebGL screenshot, live layout, or device performance claim is made.


## Sprint four — horizontal pool and ten-level season

- Rotated the camera to look from negative X, making the long pool axis horizontal. Tighter playable-room framing starts at a measured 32 world units at 1440×900; a small damped follow keeps the coach in context. Screen-relative keyboard/touch/dash directions were remapped.
- Moved the starting blocks, collision proxies, swimming entry, service stop, dropped gear, and return routes to the negative-Z locker-room end. Both locker queues enter every lane within six simulated seconds in the route check.
- Kept backstroke pennants and starting-block numbers facing the new viewing side. Added visible skill words beside all swimmer emojis, including Pro for the former Advanced label.
- Added a 3–2–1 countdown before every shift, retry, and next shift. Countdown pauses and resumes without using the shift timer or spawning customers early.
- Added a ten-level season menu, saved stars and sequential unlocks, migration of existing records, and playable configurations for all ten shifts.
- Verification: shift-check, sprint-check, coach-check, simulation-check, scene-check, syntax/import/DOM-ID checks passed. The scene check verifies a horizontal long axis and actual ray picking in the closer camera. No browser/GPU rendering was tested.


## Sprint five — warmer room and readable arrivals

- Lowered exposure and light intensity; replaced bright white/mint architecture with warm tiles and muted teal walls. Added continuous tiled surroundings behind the full-canvas scene and edge HUD.
- Tightened the default 1440×900 camera distance from 32 to 21.57 world units while preserving the horizontal pool axis. Camera containment keeps the coach and nearby equipment inside the play area at deck edges.
- Delayed the first arrival until 3.4 seconds after the countdown. A latch/creak and two-note chime accompany a real hinged locker door. A short anticipation hold precedes the swimmer's continuous walk through the opening; queue interaction and patience activate after arrival, within five seconds of Go.
- Returning swimmers open/hold the same door silently and disappear only once inside. Door reopening preserves the current hinge angle. Pause freezes all arrival and door timing.
- Independent review identified edge-camera clipping and exits through closed doors. Both fixed with explicit regression checks.
- Verification: arrival-check, scene-check (1,524 reachable-deck viewport/zoom cases), shift-check, simulation-check, coach-check, and sprint-check pass. No browser/GPU rendering or device performance claim is made; the supported preview workflow does not serve this plain static architecture.


## Sprint six — a lean opening shift

- Rebuilt level one as a 30-second, four-swimmer warm-up. Beginner/Intermediate only, eight-second workouts, no fin requests/sick arrivals, thresholds 150/300/400, and no closing score penalty. Two happy completions suffice for three stars.
- Level two ramps to 60 seconds/eight swimmers; level three to 90 seconds/14 swimmers. Adjusted their star thresholds; preserved later levels and device-local records.
- World tags are clickable native buttons using the same pick handler as swimmers and queue cards. Their upper edge stays below the measured scoreboard bottom; mode/arrival guards and accessible names/selected state are retained.
- Rotated chlorine and fin assets 90 degrees, including hit volumes and solid collision proxies.
- Shift tests cover three seeds with three-second reaction delays and both two/four completions, plus progression and later levels. CPU scene/collision/arrival/simulation checks pass. Live browser layout remains unverified.


## Sprint seven — stomach panic from level three

- Added random in-workout stomach warnings with 💩 tags, ten-second meters, sound cues, and Send to locker rescue. Levels one and two are gated out.
- Replaced automatic cleanup with explicit evacuation, continuous floating waste and brown water, raised-hand panic jumping, and a faster alarm music arrangement. Existing swimmers keep their equipment/workout and resume their original lanes.
- Added a wall-mounted skimmer, waste bin, finite carrying-state workflow, E/click scoop casts with range and timing checks, disposal, and mandatory return to hooks.
- Added incident-specific chlorine dosing and a settling/reentry phase. Excess chlorine allows reentry but produces red eyes and eye-drop errands. The shift clock holds while arrivals and queue patience continue.
- Added regression scenarios for both successful prevention and the complete cleanup, including missed casts, pauses, inventory, reachable stations, correct treatment, overdose and eye delivery, and animated scene state. Updated obsolete automatic-closure tests. No live browser/GPU validation was performed.


## Sprint eight — starting-deck queues and next-level priority

- Coach starts midway along the near deck at (-6.6, 0).
- Extended the left clubhouse end by 3.2 units; moved locker exits, rear wall/office, collision proxies, and rear plants together. Relocated the lifeguard chair away from arrival/evacuation traffic.
- New marked queue rows behind the starting blocks have unique, reusable slots and direct lane approaches. First arrival still reaches the queue within five seconds after Go.
- Camera framing includes more of the new left end. Right side of scoreboard shows LEVEL X / 10. Next shift is the primary first/focused result action; replay explicitly identifies the current level and is secondary when advancement is available.
- Arrival, progression, movement, sanitation, full-shift and CPU scene checks pass; added queue-clearance and occupancy checks. No live browser/GPU test was performed.


## Sprint nine — gentle deck contacts

- Added small circular body contacts, brief opposite recoil, and a damped 0.48-second lean for walking/waiting swimmers and grounded coach interactions. Existing water traffic and fin-slip systems remain separate.
- Added temporary passing sidesteps, yielding waiting swimmers that recover their place, and intermediate waypoint approach zones. All 27 simultaneously assigned swimmers reach their lanes in the crowd regression.
- Removed only the waiting-area floor circles; selection and guidance glows remain. Reduced motion suppresses the lean.
- New deck checks and existing arrival, shift, coach, sanitation, simulation, sprint, and CPU scene checks pass. No browser/GPU validation was performed.


## Sprint ten — exits at either end

- Replaced walking directly from the lane with swimming to the nearer end, a 0.65-second climb, and an outside-corner route along the deck to the correct locker.
- Exiting swimmers keep fins until reaching the deck and drop them there. A one-second slip grace period lets the owner step clear. Water/climb phases are excluded from deck bump physics.
- Added 24 route checks and scene pose assertions. Existing warm-up/progression, simulation, sanitation, and deck-contact checks pass. No live browser/GPU validation was performed.


## Sprint eleven — physical cramp rescue

- Replaced the at-wall assist with a middle-of-pool life-ring rescue from level two. Swimmers freeze in place and signal with raised hands; their workout and incident timers pause.
- Made the rear-wall ring a single physical item that can be carried, automatically delivered during controlled swimming, left beside the recovery bench, collected, and hung back up.
- Space at an edge with the ring permits the rescue dive; water movement uses WASD/arrows, with both arms forward and the ring floating ahead. The coach can climb back onto the deck at either end or side. Swimming is otherwise unavailable.
- Pool activity resumes as soon as the victim climbs out. They sit for four seconds and resume their own lane/workout with equipment preserved. Added contextual cues, alarm music, rescue sounds, and reduced-motion-compatible poses.
- Dedicated rescue and CPU scene checks supplement existing assignment, progression, movement, sanitation, and exit regressions. Baseline assignment bots explicitly exclude cramps; a natural level-two rescue is completed using actual controls in rescue-check. No live browser/GPU test was performed.


## Sprint twelve — room layout, rescue access, generous handoffs

- Embedded both locker bays in the left wall and moved the office to the upper-right corner; updated doors, routes, collision proxies, and decorations together.
- Added three individually tracked life rings with rescue-only pulsating ground halos and warm local lights. All rings support pickup, carry, automatic edge entry, swimming delivery, recovery-bench drop, and return to their own hooks.
- Doubled equipment handoff reach to 3.6; either-end service for every lane and side service for lanes one/three. E delivers when possible and otherwise drops fins, even beside the rack; the explicit return button remains.
- Fin trips briefly display an angry tag and deduct six happiness points with a stumble cooldown. Arrivals retain the penalty when entering their queue.
- Menu music starts when audio is permitted and unlocks at the first gesture.
- Targeted service, rescue, arrival, sanitation, CPU scene, coach, contact, exit, shift, and simulation checks passed during implementation. No live browser/GPU QA claimed.


## Sprint thirteen — clearer incident animation

Fin slips now animate backward onto the character’s back, hold briefly, then recover upright within the existing short stun. Both the coach and swimmers show a brief angry emoji. Swimmers retain the existing six-point trip penalty. The cramping swimmer bobs more strongly, sways, and paddles their raised arms; a large life-ring marker identifies the rescue target. Other swimmers gently bob without changing their frozen simulation positions. Reduced motion suppresses rescue bobbing and uses a static back-on-deck slip pose.

Focused scene, service, and rescue checks verify the pose directions, recovery, distinct rescue movement, unchanged positions, equipment behavior, and complete rescue loop. No live browser/GPU or audio playback verification was performed.
