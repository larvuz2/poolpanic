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

The game is being made to be **sold on Steam**, with great graphics and lighting in the end. The creator wants it to earn money, so every decision is weighed against two questions: *does this make a player want one more shift?* and *would a stranger who paid for it be happy with it?* Single player comes first; since 22 October 2026 there is also **online co-op for up to three over Steam** (PLAY WITH FRIENDS, [below](#online-co-op-play-with-friends-22-october-2026)).

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

## The week: the main loop (11 October 2026, restructured 16 October 2026)

The game is played as a **run** of weeks (`dist/week.mjs` the rules, `dist/week-ui.mjs` the screens, `dist/marina.mjs` Marina's
scenes; `week-check.mjs`). The main screen has **one START** (CONTINUE when a week is under way) on a card that says it plainly:
*Ice cream on the pier with Marina · save $300 by Saturday*, the week's days, and two small links under it: **🏅 Coach's locker**
(what lasts across runs) and **🗺️ Free play**.

- **Six shifts, one a day, Monday to Saturday, then Sunday: the date.** Every shift pays into the **Date Fund**, the goal of the week,
  which is always in sight: in the top bar's pill (🍦 $120 / $300), on the menu card, before every shift and on every result. A shift
  only adds to it; the shop takes from it (one money, below). Full on Saturday night and Sunday is a date (a full-screen cinematic)
  and the next week starts, harder and better paid.
  **Short on Saturday night and it is game over**: a rain check from Marina, and the next START is a new run from week 1.
- **A shift that is not passed pays nothing, but the week goes on** (its day shows ✗). Its pass mark is half its first star (`passMark`),
  shown before the shift and in the HUD while the score is under it. Stars decide the pay: $15 for passing plus $15 a star, times the
  week's pay and the card's. A week's goal is 300 × its pay × its share (`GOAL_SHARE`; pay 1 in week 1, +0.3 a week): $240, $420,
  $520, $620, $690, $780, $840, $930, … (see "A run worth repeating" and "Depth and feel" for how they were tuned).
- **The first shift of a run is a gentle minute** (`FIRST_SHIFT`): level 1 stretched to 60 s, seven swimmers, no roaming incident, its
  stars doubled so a pass (150 points) is very easy.
- **Every later shift is a pool from the week's mix at a difficulty from the week's band** (difficulty by week, Phase 2, 19 October
  2026; until then it climbed a level every shift and hit a wall in week 4). Each week has a band of levels (`WEEK_BANDS`: week 1
  levels 2–5, week 2 4–8, week 3 6–11, week 4 9–14, then 11–16, 13–18, 15–20, 17–20), Monday at its foot and Saturday at its top, a
  level either way at random (`tierFor(chapter, day)`). That level gives the shift its length, crowd and how many incidents and
  twists it has; its star targets are the level's own, scaled for the pool (`scoreScale`) and **smoothed across the season**
  (`tierScale`, below). Past the last band (`heatOf`) the weeks stay at the hardest levels and grow: 10% more swimmers and higher
  star targets every week (at most half as much again), and more incidents.
- **The pools: a random six each week, from the pools opened on the ladder** (`LADDER`, `openPools`, `weekPools` in
  `dist/week.mjs`; the creator, 16 October 2026: "all of these pools… can appear in every week… random… you cannot repeat venue per
  week"; Phase 2: "the ladder"). A first run works at three pools (the Community Pool 🏫, Splash Park 🌴, the Kids Pool 🦆), and
  every date with Marina, in any run, opens the next one for good (`save.ladder`): the Sunset Lagoon 🌅, the **Aqua Disco** 🪩, the
  **Aquatic Centre** 🏅, the **Mountain Hot Springs** ♨️, the **Wave Pool** 🌊, **Senior Aqua Fit** 👵, the **Lazy River** 🛟, the
  **Cruise Ship** 🛳️, the **Rooftop Pool** 🌇, the **Jumping Pool** 🤸 (the order is the creator's to change, like `INCIDENT_ORDER`). A week draws from the
  pools open when it starts and keeps its draw in the save: a pool never played yet is always in it (so a new pool comes the very
  next week, with its card and an easier first visit), six different pools once six are open, and with fewer each pool as often as
  it can, never two days running (a first week: each of the three twice). The first Monday of a run is always the Community Pool
  (the gentle minute). The **Grand Gala Arena** 🏟️ is not on the ladder: it is the **season finale**, Saturday of week 4 (below),
  and joins the draw in the weeks after it. **Adding a venue** is an entry in `POOLS` (and its row in `SCORE_SCALE`) and a place on
  `LADDER`. The incidents are drawn afresh every shift, with no memory of the last one, so the same incident can
  come two shifts running (a cannonball, then another the next day) when the odds fall that way. The
  week's strip shows each
  day's pool. A pool gives the shift its venue, its look (the season level of that pool nearest the difficulty lends its lighting:
  Splash Park by day early on, at night later), its crowd mix and its own trouble (Splash Park's trampoline daredevils, as many as fit
  the crowd; the lagoon's storm; the Aquatic Centre's star VIP; the disco's class). **Star targets are fair in every pool**: where a level was not made
  for a pool's floor plan they are scaled (`scoreScale`), measured with the coach bot against the pools' own levels (five lanes serve
  the club's crowds about 1.3 times faster; the club's three lanes serve the five-lane crowds slower), so at a given difficulty every
  pool asks about the same of the player. **Recalibrated 19 October 2026** with an expert bot that rescues cramps (the old one
  switched cramps off, which flattered the pools with the most cramps), on 13 pools × 9 difficulties × 4 seeds against the median
  of all pools, then checked on fresh seeds: every pool now passes 92–100% of shifts for that bot (before, 60–100%) at 1.7 to 2.2
  stars. The table (`SCORE_SCALE` in `dist/week.mjs`, by difficulty): Community Pool 1 to 10, 0.75 after; Splash Park, the Lagoon
  and the Arena 1.2, then 1; Aquatic Centre 1.4, 1.25 to 13, 0.8 after; Aqua Disco 1.65, then 1.45; Kids Pool 1.4, then 1.1; Senior
  Aqua Fit 0.65; Lazy River 1, 0.65 to 13, 0.35 after (ten tubes cannot carry a top-difficulty crowd: a Phase 2 question); Wave Pool
  0.8, 0.6 to 15, 0.7 after; Rooftop 1.7, 1.3 to 15, 1.5 after; Cruise Ship 1, 0.8 to 13, 0.55 after; Hot Springs 1.7, 1.5 to 15,
  1.7 after. The measuring scripts are kept out of the repo (a harness around `check-bot.mjs`); the numbers above are what to beat.
- **The Aquatic Centre** (`AQUATIC` in `dist/spatial.mjs`, `dist/scene/aquatic.mjs`): an indoor competition pool, a little more
  serious. Splash Park's five-lane floor plan without the trampoline (a victory podium stands where the tower was, the snack kiosk is
  the officials' table), deep-blue tiles and black lane lines, red, white and blue racing ropes, an electronic timing board whose lane
  times run during the shift, two pace clocks, blue grandstands with a crowd, club flags, and in the Coach Cam glass walls and a white
  steel roof. Its crowd is competitive: few beginners, no aqua aerobics guest written in, mostly Intermediates and Pros, one more VIP
  than anywhere else, a smaller crowd (0.8) since a crowd of lane swimmers fills five lanes fast, swim teams more often, no aqua class
  and no storm. **Marco "the Missile"** (one of Anim Bench's five named characters, now in the game: `dist/assets/models/marco.glb`)
  always swims there (and often elsewhere: below): a VIP Pro of his own, 12% faster than any Pro, with his own model, tag ("🚀 VIP ·
  The Missile") and toast.
- **The Aqua Disco** 🪩 (16 October 2026; `DISCO` in `dist/spatial.mjs`, `dist/scene/disco.mjs`, `dist/dance.mjs`, `dist/music.mjs`):
  an aqua-aerobics party pool, a stage of its own and not a dressed copy of another. **No lanes: four zones** of one class, all facing
  **Valentina**, the instructor (one of Anim Bench's named characters, in the game since 16 October 2026: `models/valentina.glb`),
  who dances on a round stage past the pool's end. Everyone who comes is an aqua dancer, men and women (the simulation makes every
  guest `aqua` in a class venue, `venue.class`: VIPs and Marco too, who dances here instead of swimming, and is told as "joins the
  class! Find him a zone with room to dance"). The coach still sends each guest to a zone (the buttons read ZONE 01 to 04 with "N of 4
  dancers" and OPEN, ROOM, FULL or PACKED!), and the class spreads out: two to a row, the front row by the stage first, the rest
  behind, facing the stage. **Four to a zone** (`CLASS_ROOM`) is comfortable; a fifth and they bump elbows, everyone in that zone
  losing mood faster the more there are, and the player is told once in a while ("Zone 3 is packed! Spread the class out: four to a
  zone."). Every incident still comes (the dog, the fish kid, Carl's cannonball, chlorine, the power cut, cramps), and the words are
  zones there: "ZONE 2 CLOSED!", "Zone 2 is closed. Use another zone!" (`laneName` in the simulation, `zone` on the moment events).
  No starting blocks, no lane ropes or lines, no swim team and no aqua-class twist (the whole shift is one). **No locker rooms
  either** (the creator, 16 October 2026): one double door set flush in the back wall (screen left), in the middle, a leaf for each
  side of the line; guests, the dog and every visitor come out of the dark behind it and go back into it, and the toasts say "the
  door" (`doors.insideZ` in `dist/spatial.mjs`: a door crossed along z instead of a locker room's side door crossed along x;
  `venue.pastDoor`, `venue.doorWord`). **The dance** is one
  routine on the shift's clock (`danceAt` in `dist/dance.mjs`, 120 BPM, beat 0 at the go): the right arm two bars, the left arm two
  bars, both arms two bars, round and round for as long as the shift lasts; Valentina and every dancer in the water play the same
  clip at the same moment (`DanceRight`, `DanceLeft`, `DanceBoth`, below), so the class moves as one. **The song**
  (`dist/music.mjs`) is an original disco track made live in the game's audio on the same beat: four on the floor, claps on two and
  four, offbeat open hats, an octave bass, chord stabs, a hook, in A minor over Am F C G; four bars of intro, then round 24 bars
  (eight of groove, eight with the hook, four of breakdown with the kick out and the filter shut, four of build with a snare roll and
  a sweep). It waits through the countdown, keeps the shift's clock (it comes back to it after a pause or a slowed sting), plays an
  alarm over the top when the pool is in trouble, and **goes dead with the lights in a power cut** (a record winding down) and comes
  back with them. The usual music plays everywhere else. Star targets: `scoreScale` asks 1.65 times the level's up to difficulty 10
  and 1.45 after (recalibrated 19 October 2026, below) (a class of aqua dancers is the gentlest crowd, measured with the coach bot).
- **The Kids Pool** 🦆 (16 October 2026; `KIDS` in `dist/spatial.mjs`, `dist/scene/kids.mjs`, `paddle` and `roamKid` in
  `dist/sim.mjs`): an outdoor paddling pool in a park, where **only kids** come (the simulation makes every guest a `child` in a venue
  with `kids`, whatever the level's mix). Each kid is the fish kid's model in clothes of their own: `dressChild` in
  `dist/scene/swimmer-models.mjs` recolours his shorts, armbands, skin and hair in the shader (`CHILD_LOOKS`, a look per kid, the
  same in a replay) and hides his bucket; the creator will change the mesh later. **Kids do not wait in line: they run all over the
  deck** (`roamKid`: from place to place, at 2.1 to 3.1 m/s, stopping now and then, never through a bench or into the water), so
  picking one is the hard part: click a running kid (or their tag), or stand beside one and press E, and the deck's list only says
  how many are running loose. **There are no lanes**: one POOL button (or 1) sends the kid you caught to the emptiest part of the pool
  (`poolLane`, the middle first). **In the water they paddle anywhere** (`paddle`: a new direction every second or two, bouncing off
  the walls and each other, a chaos), and climb out after 20 to 28 s. More than ten at once (`KIDS_ROOM`) and the pool is packed:
  every kid in it gets cross, faster the more there are, and the player is told (while the birthday party, the big moment, is on,
  the pool has room for it too: `kidsRoom`). **A kid's points follow their mood** (20 October 2026, the creator: "fix the kids pool
  stars"; `KID_MOOD_PAY`): a happy kid pays in full, an unhappy one 0.6 of it, a cross one 0.3. Before, a packed pool of cross kids
  paid nearly as well as a happy one (165 points against 240), so stuffing it was the way to three stars (a play-through gave three
  stars to 13 served, 3 happy, 4 lost); now the decision is when to send the next kid in. Measured with the expert bot pacing the
  pool: the same share of the targets as before from level 5, about 1.4 times as much at levels 2 to 4, where the party had made
  every kid cross (the targets there were raised by as much, `SCORE_SCALE`); a coach who keeps stuffing it earns fewer stars (the
  good bot, which sometimes does, one star where it had three). Every incident still comes; a tummy ache is more
  likely (`sickRate` 0.32 against 0.2) and half of them are a wee (`peeShare`, below). There is no Marco (a VIP there is a kid too).
  The pool has a gate in a picket fence ("KIDS POOL", balloons; the dog's toasts say "the gate", `doorWord`) and no locker rooms, a
  slide, a lifeguard chair, a toy box, umbrellas, bunting and **toys floating in the water**: rubber ducks and swim rings (Tripo
  models made on fal from a line of text, `dist/assets/props/`) and beach balls, drifting and bobbing. **Its song** (`kidsScore` in
  `dist/music.mjs`) is a bouncy playground tune at 132 BPM in C major (C G Am F): a boom on one and three and a chick on two and four,
  an oom-pah bass, ukulele strums, a xylophone tune a child could sing, xylophone runs answering it, and now and then a boing or a
  slide whistle; it keeps the shift's clock and goes quiet in a power cut like the disco's. Star targets: `scoreScale` asks 1.4 times
  the level's up to difficulty 10 and 1.1 after (the bot catches a kid at once; a player has to chase one).
- **Senior Aqua Fit** 👵 (16 October 2026; `SENIOR` in `dist/spatial.mjs`, `dist/scene/senior.mjs`, `dist/scene/senior-view.mjs`,
  `pace`, `tickChair` and `reachChair` in `dist/sim.mjs`; the creator: "do not follow our venues' layout… no lockers… a stooped walk,
  or hunched-over walk… a wheelchair that has a senior swimmer sitting down, randomly… when we click and assign a lane it stands up
  and enters the pool… impress me"). A Victorian glass conservatory over a four-lane pool with **no starting blocks** and **no
  locker rooms**: the guests come and go through tall brass-and-glass doors in the back wall (crossed along z, like the Kids Pool's
  gate; the dog's toasts say "the glass doors"), wait in a **lounge** on two Persian rugs either side of an emerald runner (four to
  a row, 1.3 m apart, room for a wheelchair: `queue.perRow`), and find the kit on the far side (fins, water care, eye care, the fish
  net), the skimmer, bin and rest bench on the near side, a hydrotherapy spa, a pool hoist and the tea trolley (the loose dog's
  biscuits) at the near right, and a gramophone, a reading corner of cane armchairs and two loungers at the far end. **Only
  seniors** come (every guest is a `senior` in a venue with `seniors`; Marco "the Missile" still swims here, the one young
  swimmer), in four looks (`SENIOR_LOOKS`: a granny, a grandpa, a tall gran and a stout grandpa, Meshy models rigged on Coach
  Waters' skeleton, `dist/assets/seniors/`), and they are slow: they walk stooped (the **StoopedWalk** clip, 1.35 to 1.6 m/s
  against 3.3 to 5, `SENIOR`) and stand stooped (StoopedIdle), swim like beginners at a pace of their own, wait 30% longer, and
  some cramp more often (a senior with a low `shape` from level 2). **One in three comes in a wheelchair** (`wheelchair`, from
  numbers already drawn, so the shift's own stream does not move): they roll in pushing the wheels (WheelPush), wait sitting in
  it (Sit), and when given a lane they **stand up out of it** (`standUp`: 1.7 s on the spot, the StandUp clip at the
  simulation's time) and walk to the water; **the chair stays parked where they waited** (`chair`, its lounge spot kept for it)
  until they come back on the way out, wherever they leave from: they walk to it, **sit down** (StandUp played backwards,
  `sitDown`) and roll out through the doors. The chair is the scene's alone (`syncWheelchairs`: a Tripo model,
  `props/wheelchair.glb`, under the senior or parked and empty, gone with them). **Its song** (`seniorScore`) is a tea dance: a
  gentle swing at 104 BPM in F (Fmaj7 Dm7 Gm7 C7), a walking bass, brushes and a ride cymbal, piano on the Charleston beat, a
  vibraphone tune and eight bars of vibes, swung eighths (a note's `delay`) and a teacup's clink at the end of every eight, on the
  shift's clock like the others. Star targets: `scoreScale` asks 0.65 times the level's at every difficulty (recalibrated 19 October 2026, below) (slow
  walkers, a stand-up for every wheelchair and steady lengths serve fewer guests: the coach bot scored about half of what it does
  at Splash Park on the same targets).
- **The Lazy River** 🛟 (17 October 2026; `RIVER` in `dist/spatial.mjs`, `dist/river.mjs`, `dist/river-ride.mjs`,
  `dist/scene/river.mjs`, `dist/scene/river-view.mjs`; the creator: "the river must have curves, plants, and rocks, but it's not
  like a loop that I see… we only see a section… where the people get on and get off… you have to hand them a tube… the animation
  for laying down and getting on top of the tubes… a jungle kind of thing… a door to enter and exit… no swimmers… they go, they
  disappear… add some rocks in the middle so the coach can jump into, and cut corners… impress me with the mechanics"). **No pool
  and no lanes**: a river 6 m wide curves through the room in an S (a Catmull-Rom curve, `river.points`; a place in it is `s`, how
  far along, and `d`, how far across, `river.mjs`), out of a cave behind a waterfall in the far left corner and into a ruined jungle
  temple in the far right one. **Only that stretch is seen**: a rider who floats into the temple is `away` round the rest of the loop
  for `hidden` seconds (3) and floats back out of the cave. **Every guest is a tube rider** (`rider`) who wants a tube 🛟 before
  anything (the fins' plumbing: `finsFirst`, ten tubes on the **tube rack**, `venue.tubes`). Hand one over (F for the rack, then E by
  the guest), send them on the **LAZY LOOP** (1) or down the **RAPIDS** (2; the choice since Phase 3, in [Depth and feel](#depth-and-feel-phase-3-20-october-2026)) and they walk to the **ALL ABOARD** dock, sit into the tube (**TubeBoard**, 1.1
  s at the simulation's time) and float off on the current (1.35 m/s, `river.flow`), drifting across the river now and then,
  steering round the stepping stones, bumping tubes (a slowdown, a spin and a rubber bonk). On the second pass they get off at the
  **EXIT** dock (TubeBoard backwards), carry the tube to the **tube return** and drop it there (`tube-returned`): the coach carries
  used tubes back to the rack, or straight to the next guest who wants one. Lying back in the tube is **TubeFloat** (a slow loop:
  bottom down in the ring, legs over the front, arms over the sides, the head looking about, a hand trailing in the water).
  Ten tubes and a ride of about half a minute make the river's own pressure: a big crowd queues for tubes. **Across the river**:
  a rope bridge, or **two stepping stones** in the middle (`river.stones`) that the coach jumps to (Space, at a run: a full run-up
  carries him over the first stone to the second, a corner cut); a jump that falls short lands in the river (`coach-fell`: a splash,
  a sad trombone, `stats.fellIn`), where he swims with the current (55% of it) until he climbs out onto a bank or a stone. The
  river is a **visibility graph** of points along both banks and the bridge's ends (`route`, Dijkstra), so everyone walks round by
  the bridge and nobody wades. **The incidents all come**: a guest who flips off their tube (the cramp, `startCramp`: the pumps
  stop and the river holds; ring, dive from the bank, back on the river after a rest), a poo or a wee (everybody out onto the banks,
  skimmed and dosed from the bank), the fish kid at the bank, the cannonball man off the bank into the river and out onto his own
  bank, the dog (who may run off with a tube), Karen, the power cut; no twist that needs lanes (`twists: {closure: 0, team: 0, class:
  0}`). The river's guests draw their numbers from a stream of their own (`riverRandom`), and every river rule is a branch of its own
  (`venue.river`), so the other pools play exactly as before. **Its song** (`riverScore`) is a lazy calypso at 100 BPM in G (G Em C D):
  a log drum bass on the calypso beat, congas, a shaker, marimba chords, a steel drum tune, eight bars of marimba rolling, and a jungle
  bird now and then. Star targets: `scoreScale` asks the level's own up to difficulty 10, 0.65 to 13 and 0.35 after (recalibrated 19 October 2026, below) (a big crowd
  queues for ten tubes; calibrated with the coach bot).
- **The Wave Pool** 🌊 (17 October 2026; `WAVE` in `dist/spatial.mjs`, `dist/waves.mjs`, `dist/wave-pool.mjs`, `dist/scene/wave.mjs`,
  `dist/scene/wave-view.mjs`; the creator: "the wave can hit harder on someone, and we get a lot of dizziness here… we need to save a
  lot of people… we could stop the wave, but people start getting impatient and mad… if we don't shut down the wave and the wave hits
  a dizzy person, then it gets critical… if we hand out tubes, there is less probability that the people will get dizzy, but it's a
  challenge to hand out tubes to all… we don't click on the swimmers and assign them… we need to intercept the people and hand them
  the tubes… there are not a lot of tubes… the water needs to look amazing… nothing too heavy"). **A beach and no lanes**: a basin
  14.4 m across and 18.8 m along (`basin`), its near side a beach of sand that slopes down into the water (`floorAt`, `depthAt`: 0 at
  the shoreline, a metre deep at the shelf, 2.1 m against the wave house), the far side the **wave house** (solid, the whole far side
  of the room). **Nobody queues and nobody is sent**: a guest (a beginner, an intermediate or a pro; `batherType`) comes in through
  the surf gate, walks round the near end of the pool to the beach, drops a towel and wades in to a spot that suits them (the timid
  near the beach, the strong out in the deep, `BATHE.spots`). **The tubes** 🛟: five in the tube hut by the beach corner (the fins'
  plumbing, `venue.tubes`); the coach hands one to a guest on the way down (E by them, the real interaction), or to a bather from the
  water's edge; coming out, a bather leaves it on the sand to pick up again. A VIP who goes in without one grumbles and grows cross.
  **The waves** (`dist/waves.mjs`, the simulation's own): a program of sets (`program(level)`: a horn, a wave every few seconds for
  half a minute or so, a calm; longer sets, more big waves and, from level 5, a **monster** announced by a siren four seconds before
  it leaves the wave house). A crest runs faster in deep water (`speedAt`), grows as the water shallows (Green's law, `shoal`) and
  **breaks** where it is too tall for the depth: a small wave near the beach, a big one on the shelf, the monster out in the deep;
  broken it rolls in as white water and runs up the sand. **Every crest jolts every bather it passes** (once, `hitStrength`): a shove
  towards the beach and some **dizziness**, hardest in the impact zone just where it broke, a third as much in a tube, half again for
  a beginner, much less for a pro (Marco surfs). Dizziness wears off between crests and faster in the calm. **Woozy** (45) shows stars
  over the head; **dizzy** (70, `problem: "dizzy"`) staggers for the beach, slowly, mood draining: the coach **helps them out** from
  the water's edge (E: +50, a rest on a towel on the sand and back in), hands them a tube, or stops the waves. **A crest that hits a
  bather already dizzy knocks them under** (100): −150 and the cramp's rescue (ring, dive from the beach, tow, a rest on a towel), the
  machine stopped for it (`halted`) and started again with the horn when everyone is safe. **The WAVES button** (Z, or click it) stops
  the machine: no new wave leaves (the ones already out still roll in), a monster on its way is called off, the program waits; the
  bathers say "awww" at once (−4 mood each) and after a three-second grace their mood drains away the longer it stays off, and they
  chant for waves; pressed again, the horn sounds and the program goes on. A rescue, a closed pool, a panicking crowd or a blackout
  stops it too, at no one's patience. The bathers love the waves: each crest that does not leave them seeing stars cheers them up (a
  big one more, the monster most). Two jolted side by side **bump heads**; a monster or a big wave can **knock a bather off their
  tube**, and the lost tube rides the waves in and washes up on the sand (`lostTubes`, counted with every tube). **Coming out
  soaked**, a bather drips a wet spot on the deck past the sand more often than anywhere (`wetChance` 0.35), right where the guests
  walking in come past. **The incidents all come**: cramps (fewer: the waves bring rescues of their own), a poo or a wee (everybody
  up the beach, the machine stopped), the fish kid and his fish (everyone flees up the beach), the cannonball man off the beach,
  the dog, Karen, the power cut (no power for the machine); no twist that needs lanes. The machine's and the bathers' numbers come
  from a stream of their own (`waveRandom`), and every wave rule is a branch of its own (`venue.waves`), so the other pools play
  exactly as before. **Its song** (`waveScore`) is surf rock at 144 BPM in A minor (Am G F E): a surf beat with a galloping floor
  tom, a picked bass, chord chops on the off-beats, a twangy tremolo-picked lead through a spring-reverb echo, an octave up in the
  second half, a glissando into each half. Star targets: `scoreScale` asks 0.8 times the level's up to difficulty 10, 0.6 to 15
  and 0.7 after (recalibrated 19 October 2026, below) (guests walk straight in and the waves knock them dizzy: on the plain targets the coach bot only just made two
  stars, about 1.1 times the target, and fell short at difficulty 18; scaled, it makes them by about 1.3 to 1.4 times, 0.9 at 18).
- **The Rooftop Pool** 🌇 (17 October 2026; `ROOFTOP` in `dist/spatial.mjs`, `dist/roof-plan.mjs`, `dist/rooftop.mjs`,
  `dist/scene/rooftop.mjs`, `dist/scene/roof-view.mjs`, `dist/scene/city.mjs`; the creator: "it has to be epic… the Marina Bay
  Sands… infinity pool… umbrellas and chairs… guests… go into the pool, and they chill… they just talk to each other inside the
  pool… margaritas… a DJ set on the far right… the buildings down below… we don't get swimmers in this one… some go and lay down
  in the camastro… the water spilling on the floor"). **Nobody swims** (and since Phase 3 the coach seats every guest at the lift: the water, a sunbed or a cabana, in [Depth and feel](#depth-and-feel-phase-3-20-october-2026)): an infinity pool the length of the roof
  (`ROOF` in `roof-plan.mjs`: 6.8 by 20.4 m, 1.15 m deep), its far edge a knife edge into a catch gutter, a glass rail, and the city
  185 m below. A guest comes up in one of **two lifts at opposite ends** (`arrival.alongZ`: a lift's doors open along the deck, the
  door helper `arrival.at`/`sideOf`/`isInside` that every venue now uses) with a plan of their own (`p.plan`: the water, a sunbed,
  or one and then the other; a Sunbather, a Socialite or a Party animal, `guestType`) and keeps 10 s in hand to leave by closing
  time. **In the water** they stand chest-deep in little groups of up to four and chat (mood up; alone, a guest drifts to the edge
  to look at the city). **On a sunbed** (14 of them, `ROOF_BEDS`, two of them white cabanas the VIPs want) they lie back; getting
  off leaves the bed **messy**, nobody takes a messy bed, and the coach **tidies** it (E, +10); a guest who finds none free waits,
  minds, and gives up. **Margaritas** 🍹: now and then a guest orders one (`problem: "drink"`, the party animals most): one in the
  water wades to the near edge, one on a sunbed waits there; the coach takes a **tray of three** from the bar (E at the bar, the
  BAR button or B) and hands them out (E by the guest: +30, a VIP +60, mood up); one kept waiting grows cross. Two make a guest
  **tipsy** 🥴. **The selfie at the edge** 📸 (from level 2): a guest (a tipsy one above all) wades to the infinity edge, climbs
  up and leans out with a phone; the coach (who **can wade** in this shallow pool, at half speed, no dash, `wadeable` in
  `dist/coach.mjs`) has a few seconds to talk them down (E, +60, or +35 on the way there). Too late, and **over they go**: −150,
  waist-deep in the catch gutter, waving, and the coach must **haul them back** (E, +40) before, after 18 s, they storm out by the
  service stairs. **The DJ's drop**: every 14 to 20 bars (2 s a bar, the music's own) the set builds to a drop, announced four bars
  ahead; on it everyone in the water jumps and cheers (a hype that lifts the mood), the water slops over the near edge onto the
  deck (wet spots to mop, up to four), and anyone up on the edge for a selfie goes straight over. **The incidents all come**:
  cramps, a poo or a wee (everybody out over the near edge), the fish kid, the cannonball man, the dog, Karen, the power cut (the
  music and the LED wall go dark), drips by nearly one guest in three climbing out (`wetChance` 0.3); no twist that needs lanes, and
  **no Marco** (nobody swims). **Lots of VIPs**: two more than the run's count (`vipBonus`). The roof's numbers come from a stream
  of its own (`roofRandom`), and every rooftop rule is a branch of its own (`venue.roof`), so the other pools play exactly as
  before. **Its song** (`roofScore`) is deep house at 120 BPM in A minor (Am7 Dm7 Fmaj7 Em7), built round the drops the
  simulation has planned (`drops`, handed to the player in the clock's state): a four-on-the-floor kick, off-beat bass and hats,
  pads and a hook; four bars before a drop the bass leaves, a clap roll speeds up, a riser climbs, the filter opens and the last
  half bar is silence; then the drop, with stabs and the octave bass (`roofSection`, `barFilter`). The bot serves the drinks, talks
  the posers down, hauls, and tidies (`check-bot.mjs`), and wades only where its path has to (`check-helpers.mjs`: water costs 2.2
  times the deck). Star targets: `scoreScale` asks 1.7 times the level's up to difficulty 10, 1.3 to 15 and 1.5 after (recalibrated 19 October 2026, below) (the
  margaritas tip well and the VIPs are many: on the plain targets the coach bot made 4.6, 2.5, 2.2, 1.7, 2.0 and 1.15 times the
  two-star target at difficulties 3 to 18, against Splash Park's 2.2, 1.4, 1.3, 1.7, 1.2 and 1.0; calibrated 17 October 2026).
- **The Cruise Ship** 🛳️ (18 October 2026; `CRUISE` in `dist/spatial.mjs`, `dist/cruise-plan.mjs`, `dist/ship.mjs`,
  `dist/scene/cruise.mjs`; the creator: "this is a physics level because we can actually see the ship. The ship is moving left and
  right, not in a rhythmic way, but spontaneously. Sometimes it stays without movement, but then it swings to one side. All of the
  furniture on top, and even the people on deck running or waiting, start to go to the left if the ship leans to the left… a
  multi-use pool. It has two lanes on one half, and the other half is free. People go there and chat… the same mechanics of the
  infinity pool… the same incidents. But right here, the catch is the physics left and right"). **A pool deck at sea**: the camera
  looks forward along the ship from the stern, so her roll tips the deck left and right on screen. The pool lies across the deck
  (`CRUISE` in `cruise-plan.mjs`): its near half is **two lap lanes** (every venue's lane pool: the queue, fins, Marco, cramps), its
  far half **free water** past a rope of floats where guests stand and chat; three rows of eight **sun loungers** (24,
  `LOUNGERS`), the Lido Bar and a hot tub on the far deck, two stairway lobbies at the left end. **Half the guests chill**
  (`chill.share`; never Marco): they are the Rooftop Pool's guests, the same code (`dist/rooftop.mjs` now reads a venue's `chill`
  plan, `ROOF_CHILL` and `CRUISE_CHILL`, and `p.chill` marks a chilling guest), in the free water or on a lounger, ordering
  margaritas (a tray from the bar: the BAR button or B), half as quick to mind waiting as up on the roof (`patience`: the coach
  has the lanes to run too); no selfies, no DJ, no cabanas. **The roll** (`dist/ship.mjs`, a random stream of its own,
  `shipRandom`): calm spells of 9 to 15 s (5 to 9 late in a run) with a faint sway, then a swell leans her over to one side,
  holds her there for 1.4 to 4 s and lets her back, or, a big one now and then, throws her over to the other side first. Small
  swells (3.5 to 6.5°) just happen; **big ones** (7.5 to 9.5°, up to 14.5° late in a run; a third of the swells early, nearly three
  quarters late) are announced 2.6 s ahead: the ship's bell and the foghorn, a banner ("BIG SWELL IN 2!") and the SHIP gauge by
  the lane buttons, which shows the roll all the time. **What slides** (nothing below 3.5°, full from 13°): the **people on the
  deck** (walking, a queue a little less: they brace; back in line when she is level), **the coach** (his walk fights it: harder
  uphill, quicker down; not when he swims, wades or jumps), and **the loungers**, each along its row with friction: they stay put
  below 5.5°, then go, bump into each other and pile up at the row's low end. A lounger out of its place by 0.45 m is **adrift**:
  nobody takes it, a guest lying on one rides along and minds, and the coach **straightens the row** (E by it, 1.2 s, +6 a
  lounger, at most 30). **Into the pool** 🌊: someone on the coping at the end of the pool when a big lean (7.5° or more) slides
  them that way goes in (`fell-in`, at most two a swell, a VIP only from level 6: −40, mood down); the coach **helps them out** at
  the edge (E, +40) before, after 10 s, they climb out by themselves, furious and dripping. **The slosh**: the water rides up the
  low end of the pool (a spring that lags the roll) and, in a big lean, over it: a wet spot on the deck there to mop, once a swell.
  Lap swimmers go faster downhill and slower uphill (they bunch up), and the guests chilling in the water drift to the low end.
  **Every incident comes**; Marco swims here (he has the lanes); no lane-closing twist and no class. Every ship rule is a branch of
  its own (`venue.cruise`, `sim.ship`), so the other pools play exactly as before. **Its song** (`cruiseScore`) is Lido-deck yacht
  pop at 108 BPM in F (Fmaj7 Dm7 B♭maj7 C7): congas, shaker, ride and brush, a walking bass, electric-piano chords on the
  off-beats and the tune on a steel pan, then vibes rolling up the chords; the ship's bell in the first bars (not listened to:
  checked by CPU only). The bot helps guests out, straightens rows when she is level and puts the tray back when there are chores
  (`check-bot.mjs`). Star targets: `scoreScale` asks the level's own up to difficulty 10, 0.8 to 13 and 0.55 after (recalibrated 19 October 2026, below) (on the plain
  targets the coach bot made 1.6, 1.5, 1.8, 1.5, 0.9 and 0.8 times the two-star target at difficulties 3 to 18, against Splash
  Park's 2.0, 1.7, 1.3, 1.5, 1.1 and 1.2; calibrated 18 October 2026).
- **The Mountain Hot Springs** ♨️ (18 October 2026; `ONSEN` in `dist/spatial.mjs`, `dist/onsen-plan.mjs`, `dist/onsen.mjs`,
  `dist/scene/onsen.mjs`, `dist/scene/onsen-view.mjs`; the creator: "a snowy kind of natural hot springs in the mountains… several
  hot springs that the coach waters can assign guests to… the longer they wait outside of the natural hot springs, the colder they
  start to get… a self-hugging pose… the snow monkeys… Coach Waters has to stop them before entering… if they enter, people get
  nervous and they panic… minus points… it's icy on the deck, so the coach slides… the same incidents"). **A terrace in the snow**
  with **four natural springs** (`SPRINGS`: round, irregular basins of 5, 4, 5 and 3 seats, their steps on the walkable rim, flat
  rim stones, boulders round them that the walks go round, `onsenRoute`), the bathhouse at the left end (the guests come out of its
  door), a forest round the far side and the right end. **The springs are the lanes**: SPRING 1 to 4 (the keys, the buttons, a click
  on the water) sends the selected guest to that spring (`sendToSpring`): they walk there, step down into it by its steps, wade to
  a free seat and sit in it to the shoulders, facing the middle, soaking for 22 to 32 s (cut to fit late in a shift: nobody is in
  the water at closing), then out by the steps and home. A full spring refuses another guest; a settled guest stays put. **The
  cold**: waiting in the snow a guest grows colder by the second (`p.cold`, 0 to 1 in 24 s, `SOAK.coldFull`); past 0.3 it bites
  (`coldPenalty`: up to 1.5 mood a second more, a VIP 1.3 times) and they hug themselves, shivering (the ColdHug clip: the five
  swimmers and Marco); in the hot water they warm up again. **The snow monkeys** (`MONKEY`, their own random stream, `onsenRandom`):
  every 30 to 44 s early in a run (12 to 20 late; the first after 14 to 22 s; one at a time early, up to three late, never two for
  one spring) one comes out of the forest at a random place and makes for a spring (a busy one a little likelier), on all fours,
  stopping now and then to look about. The coach **runs into it** (or E beside it) before it gets there: it scampers back into the
  woods (+40, a save). One that gets there **hops in** (−50) and sits in the water up to its chin, and **everyone in that spring
  panics** (the Panic clip, standing up in the water; their mood falls 4.2 a second, a VIP 1.5 times, and nobody leaves) until he
  **shoos it out** from the rim (E, 0.6 s, +25) or wades up to it. **The ice**: on the terrace the coach's shoes barely grip
  (`venue.ice`: 11 m/s² to speed up or turn, 4.6 to slow down when he lets go, against 58 and 76 on a pool deck): he skates
  (IceSkate), turns wide and slides on (IceSlide; "Sliding on the ice!") about 7 m from full speed; in a spring he **wades** at half
  speed and the ice has no say. **Every incident comes**, in the springs: the fish kid tips his fish into a spring (the coach goes in
  with the net), the cannonball man bombs into one, the dog jumps in, a poo or a wee closes them all (everyone out, skimmed from the
  rim, the water care, reopened), Karen, the blackout; wet spots drip on the rim and freeze. Marco comes for a soak (no swim team,
  no class, no spring to close); a level's daredevils soak like anyone (no trampoline up here). **Its song** (`onsenScore`): a slow
  piece at 72 BPM on the Japanese in scale from D, a drone that changes each bar, a taiko, wind chimes and a temple bell, the tune on
  a plucked koto and then on a breathy shakuhachi (not listened to: checked by CPU only). The bot sends the coldest first to the
  spring with most room (none with a monkey in it), meets the monkeys and shoos them out (`check-bot.mjs`), and steers like a skater
  on the ice (`check-helpers.mjs` `steer`: a velocity it can brake from). Star targets: `scoreScale` asks 1.7 times the level's up
  to difficulty 10, 1.5 to 15 and 1.7 after (recalibrated 19 October 2026, below) (nobody swims laps, so a spring never jams: on Splash Park's targets the coach bot made
  3.1, 1.9, 1.7, 1.7, 1.9 and 1.3 times the two-star target at difficulties 3 to 18, against Splash Park's 2.2, 1.2, 1.1, 2.2, 1.3
  and 0.65; calibrated 18 October 2026).
- **The Jumping Pool** 🤸 (24 October 2026; `DIVE` in `dist/spatial.mjs`, `dist/dive-plan.mjs`, `dist/dive.mjs`,
  `dist/scene/dive.mjs`, `dist/scene/dive-view.mjs`; the creator: "an open-air country-club complex… one large, deep rectangular
  pool… no lanes… two diving stations on opposite sides… LOW: a flexible springboard… MEDIUM: a rigid platform… HIGH: a rigid
  platform reached by stairs… green, yellow and red… some guests look confident but are actually beginners… the existing
  cramp-rescue mechanic… No chlorine problem here!! no poo or vomit here!!… LETS ADD A HOTTUB… we do have poo and pee problem
  here… add leopard man and carl as jumping NPC. not incidents!!!… make sure that player can make a mistake an assign the beginner
  to the highest platform and that will increase the failed by a lot!!… an adnvaceed assign to a low end creates frusstration and
  little points… a nice gravity system here so the jumps are random and funny"). **A deep pool with a diving station at each end**
  (`BOARDS`, `boardAt`): at each end, side by side, the green **LOW** springboard (1 m, it bends and throws), the yellow **MID**
  platform (3 m) and the red **HIGH** platform (6 m), each with its own stairs from the deck and its own line at their foot (four
  places, `LINE_MAX`; past three it is crowded, `LINE_ROOM`). The guests come in through two garden gates at the near corners
  (`alongZ`, as the rooftop's lifts) and wait on the lawn. **The heights are the lanes**: LOW 1, MID 2, HIGH 3 send the selected
  guest to that height, to whichever of its two boards has the shorter line (`chooseBoard`, `sendDiver`); a guest walking to a line
  or standing in one can be sent elsewhere. **The boards open as the shift goes on** (the creator: "Opening: low only. Medium
  opens. High opens."): LOW from the start, MID at an eighth of the shift (8 to 25 s), HIGH at about a quarter (18 to 55 s), each
  announced (`DIVE_TUNING.opens`); until MID opens only beginners come, until HIGH no Pros. **A dive** (`tickDiver`): along the
  line, up the stairs, out along the board (slowly when frightened), a moment at the edge, then off: **gravity does the rest**
  (`planJump`, its own random stream `diveRandom`): every jump has its own launch (the springboard throws them 4.3 to 5.4 m/s up,
  a platform a hop of 1.8 to 3.1, a frightened diver barely 0.5), its own reach out over the water, its own drift, and falls under
  g = 9.8 into a landing spot of its own; its style is the diver's (a beginner's pencil jump or header, an intermediate's pike, flip
  or back flip, a Pro's double, triple or twisting flip off HIGH, Carl's cannonball), and **its outcome is drawn from the height
  against the skill** (`outcomeOdds`): at the right height mostly clean (66 to 68%), sometimes splashy, a belly flop now and then,
  a wipeout 7% off a platform; **one height too high: 40% wipe out**, 8% chicken out; **a beginner on HIGH: 70% wipe out**, 12%
  chicken out, 4% clean (a little more as the run goes on). The outcome sets the spin: the scene turns the diver through the turns
  the style means plus or minus how far from straight the entry ends (clean within 0.045 of a turn, splashy 0.07 to 0.14, a flop a
  quarter, flat on the water; a wipeout half a turn or more off, flailing), tucked and opening out, so no two dives look alike.
  **The points** (`scoreDive`): 120, 170 and 240 for LOW, MID and HIGH, +40 for a clean entry at the right height, ×0.75 splashy,
  ×0.45 a belly flop off the springboard (funny and harmless), ×0.4 a smack off a platform (it stings, −25 mood); **too low**: a
  bored pencil jump, ×0.35 one height under (×0.2 two) and 30 (50) mood gone, "Boring…" (a Pro on the springboard earns about a
  sixth of a clean HIGH dive and is cross); the usual bonuses for a happy, quick or VIP guest. **The failed jump** (`failed`): an
  uncontrolled tumble, a huge splash, −150 off MID, −220 off HIGH, and the diver winded in the water: **the cramp's rescue**, no new
  system (`sim.rescue.kind` `dive`; the ring, the swim, the ladder); anyone landed on needs a ring too. **When the time runs out** a jump
  already in flight lands before the shift ends (its points count: `DivingBoards.holdsClock`), and nobody new leaves a board. Out by a ladder, a rescued
  diver lies down on a free massage bed (`diverRescued`, `Massage.request`) or goes home. **A chicken** climbs back down (−60, the
  guest lost). **The landing**: a diver jumps only when the water below is clear (`landingClear`, `LANDING.reach` 1.5 m: a diver
  swimming out, a rescue, the coach); waiting at the edge they grow cross (the 🤸 "Clear the landing!" alert) and after 11 s jump
  anyway. **Waiting**: in a line a guest loses mood at about a third of the queue's pace, a bored Pro faster, everyone faster when
  the line is past three. **Show-offs** 😎 (from level 4, about one guest in six): they say they are Pros and the tag says
  "Show-off (Pro?)"; 60% are beginners, 15% intermediates, 25% really Pros. E beside one (0.6 s) checks them (`checkGuest`,
  `stats.checked`); believe one and send them HIGH, and it is a beginner on HIGH. **Line-cutters** 😤 (from level 5, every 26 to 44
  s when a line has two or more): the last in a line pushes to the front and argues there for 7 s, the line crosser by the second;
  E beside them sends them to the back (+40, a save: BACK OF THE LINE!), or they win and go first and the line is crosser still
  (`updateCut`, `sendBack`, the `line-cut` incident). **The hot tub** ♨️ (TUB, key 4, a long rectangle on the narrow near side by the coach, with the massage beds): a guest in five comes only for it (they say
  so; a diver sent there or a soaker sent to a board is refused), six seats, 20 to 30 s soaking; **only its guests have tummy
  trouble** (a third of them from level 3, a wee or a poo, `peeShare` 0.45), and a floater closes the tub, not the pool: the
  skimmer, the water care and the tub reopened as in the springs. **No chlorine, no poo and no vomit in the diving pool** (nobody
  who dives is sick, needs fins or cramps). **The massage corner**: two beds side by side (`MASSAGE_BEDS`, `fixtures.massage` and
  `fixtures.massageMore`; `dist/incidents/massage.mjs` keeps a session per bed, `tablesOf`): the massage incident can come here, and
  a rescued diver takes a free bed. **Carl and the leopard man dive** (not incidents: no Carl, fish kid or dog incident here,
  `venue.skips`): Carl or the leopard man (by the seed) comes as the guest at about 45% of the arrivals, the other at 78% from level
  9, an intermediate or a Pro (drawn), and does a **cannonball** (the leopard man often a flip into one, `flipball`): +60 at the
  right height, a splash that soaks the deck by the edge. Every other incident comes (Karen, the blackout, wet spots; the fish never),
  and Marco dives (an intermediate or a Pro; a triple). **The big moment** is **THE DIVE SHOW** (`showcase`): five big guests at once
  and 40 s to land them clean. **Its song** (`diveScore`): a 126 BPM swing in B♭ with a brass stab and a slide whistle (not listened
  to: checked by CPU only). The bot sends each guest to the height they can take and soaker to the tub, checks show-offs and sends
  cutters back when proactive, and rings wipeouts (`check-bot.mjs` `manageDive`). Star targets: `scoreScale` asks 2.2 times the level's up to difficulty 11, 1.5 to 13 and 1.7 after (calibrated 24 October 2026: on the plain targets the expert coach bot made 3.4, 2.9, 3.2, 1.9, 2.0 and 2.2 times the two-star target at difficulties 3 to 18; on these, 40 fresh shifts at difficulties 3 to 20 all passed, at 2.5 stars on average and 1.1 to 1.9 times the two-star target, about where Splash Park's and the Lagoon's bots sit).
- **VIPs in every shift** (the creator, 16 October 2026: "always"). `vipCount`: one even in the gentle first minute, two from the
  next shift, one more every three shifts, at most six; the Aquatic Centre one more. In free play every level that had none gets
  them too (one, and one more every six levels: `freePlayGuests`). A served VIP is worth +150 and a lost one costs 300: with more of
  them the coach bot scores a little more in every pool, and the pools stay level with each other.
- **Marco "the Missile" everywhere** (the creator, 16 October 2026: "more than half the time, in every location"). He always swims at
  the Aquatic Centre, and in 66% of the shifts of every other pool (the Cruise Ship's lanes included, and a soak at the Mountain Hot Springs) but the Kids Pool and the Rooftop Pool, where nobody swims
  (`STAR_CHANCE`, `MARCO` in `dist/sim.mjs`; raised from 60% when the Rooftop Pool joined the draw, so he still swims in more than
  half of all shifts), at a moment of his own. Free play has him in 66% of its shifts (not in level 1, whose four guests are written),
  drawn from the shift's seed; the shift's record keeps the guests it added (`guests`), so `tools/replay.mjs` builds the same
  shift, and a trial or a hunt (which replay old recordings) has none.
- **The shifts are built, not written** (the **incident director**, `directShift`): the level is the blueprint (its length, crowd, star
  targets and features), and the incidents come from a budget that follows it with a little give either way, at random times, with its
  twists from the ones the pool allows (the storm only at the Sunset Lagoon, the aqua class only at the club). From the first
  Tuesday, **every shift brings in the next incident in `INCIDENT_ORDER`** (dog, fish kid, cannonball man, power cut, Karen: change
  the list to change the order) as a **surprise** until the player has met all five, by Saturday of their first week; each is in the
  draw for good once met (`known`, kept across runs). **A fair mix** (the creator, 17 October 2026: "too many dogs… I never got
  Karen… I never got the cannonballs"): the five have the same weight, an incident that came in the last shift is less likely
  (×0.4) and one from the shift before a little less (×0.7), never ruled out (the same one can still come two shifts running), and
  one already drawn for a shift is much less likely to come twice in it (×0.2; `RECENT`). Over 300 simulated weeks the director drew
  761 to 796 of each. The same week
  always draws the same shifts (its seed), so a shift can be replayed from a report; a new week draws new ones.
- **The cards.** Before each shift the player picks a gig: a **Regular day**, from Wednesday a **booking** (tour group, stag
  party, kids' party, night swim: more trouble, better pay; only those whose trouble the player has met) and from Friday sometimes a
  **Mystery gig** (one more incident, ×1.3 pay, maybe the next surprise). A card's payout multiplies the pay, never the points, so
  a riskier gig is no easier to star (see Bookings).
- **Marina's wishes.** Every shift comes with two of her wishes (make N swimmers happy, nobody storms off, a happy streak, two stars, no
  collisions, a short wait, the mood, stop trouble early, clean water, the VIPs, trampoline flips: only those that fit the shift), shown
  before it and ticked on the results: each one met pays extra into the Date Fund (never in a shift that served nobody). Marina never walks onto the deck: she is in her texts,
  her wishes and the full-screen scenes.
- **The shop: one money** (Phase 2, 19 October 2026, the creator's choice; until then perks cost tips, a second money that never
  touched the fund). Between shifts the pool shop sells three perks for the rest of the week (running shoes, turbo whistle, shady
  benches, stretching poster, tummy alarm, megaphone, a No dogs or No bombs sign (offered only once that incident has been met), a
  tip jar (every VIP served tips $5 for the date), Marina's lucky charm, a local sponsor, a safety net that makes a failed shift pay
  half; 🎲 new stock for $10), **paid out of the Date Fund**: $20 to $40 in week 1, times the week's pay after (`perkPrice`), about
  half a shift's pay. Spend now to earn more (the sponsor, the tip jar and the charm pay back in a few shifts), or save for the date.
  The shop shows the fund, the pace and what each perk leaves in it; nothing is bought on credit. Marina's texts come once each, on
  the way up (`week.peak`). The perks the simulation reads are `perks` in
  `PoolSimulation` (1 for each, so without them the game is exactly as it was).
- **The dates.** Ice cream on the pier, movie night, dinner by the lagoon, the ocean trip, then new ones (picnic to sailing) for as long
  as the run lasts.
- **Marina's scenes** (`dist/marina.mjs`): the invite at the start of each week (the first with the prologue), the date when the fund is
  full, a rain check at game over. Each shows its still (`ART`) until a video is named for it in `VIDEOS`
  (`"date-icecream": "assets/video/marina/date-icecream.mp4"`, a file under `dist/`): then it plays full screen with its caption and
  moves on when it ends; a video that cannot play falls back to the still.
- **Free play, like a level select.** Every level a run passes opens on the level map (`unlocked` in the week save, copied into the
  map's records), for good, and the **🗺️ Free play** link shows the map with its own START and a **◀ The week** button back. Free
  play is the old campaign map (levels, drills and bookings, played on their own, outside the week). `?unlockall` opens every level
  for a test.
- **Saved** in `pool-panic.week.v1` (a save the desktop app keeps): the week of the run, the incidents met (those that really
  started in a shift, `summary().met`, not those only planned), the dates had, the runs
  played, the best week and fund, the levels opened, the week in progress. Leaving in the middle of a shift loses nothing: the week waits
  at that shift. A save from before the restructure (`v` under 2) keeps what was met and opened, and starts a new run.
- **Balance** (`week-check.mjs`, the coach bot through three weeks): it passes every shift of each and fills the fund each week.
  **Not verified:** how it feels to a person, which only playtests can say (the ramp, the goals and the prices are the first numbers to
  tune).

### Online co-op: PLAY WITH FRIENDS (22 October 2026)

The creator: "two secondary characters … a senior coach, and … a female, also a coach, same style … No mouths … everything that the
coach has, the struggles and everything … choose the characters like Overcooked … in the main menu screen, the multiplayer option …
it has to be very, very simple … in single-player, you're always Coach Waters, and for multiplayer, the host can pick whatever … if we
are two players, the scaling of the swimmers and incidents increases, and if we are three players, we increase again." Online, up to
three, over Steam.

- **The coaches** (`dist/crew.mjs` `COACHES`): **Coach Waters** (whom a single player always is), **Coach Brooks** (the senior coach:
  shorter and rounder, grey hair and moustache, navy cap and polo) and **Coach Rivers** (a young woman coach: yellow cap and polo with
  teal trim, a ponytail). Both new coaches were drawn with GPT Image 2.5 in Coach Waters' style, no mouths, made 3D with Meshy 7,
  rigged on Coach Waters' 24-bone skeleton (`rig_from_template.py`) and given **every one of his twelve clips** (`retarget_clips.py`:
  Run, Walk, the idles, Swim, SwimRing, Panic, IceSkate, IceSlide, Startle, FreakOut, Haul), Brooks with Carl's belly bones and his arms
  kept off his belly (`belly_bones.py`, `belly_jiggle.py`, `clear_limbs.py`), both grounded, and **his face**: `coach_face.py` now
  finds a face at another height (from the top of the model), takes `--no-stache` (Rivers: the moustache's three bones are kept and
  move nothing, so every coach has the same 18 face bones and nine expressions) and `--eye-grow` (Brooks' painted eyes bulge more:
  1.1). Files: `dist/assets/coach-brooks.glb`, `coach-rivers.glb`, and the portraits the character select shows
  (`coach-waters|brooks|rivers.webp`). `rig-check.mjs` holds both to the shared skeleton, every retargeted clip and the face; renders of
  every expression and clip were checked by eye here.
- **Two more coaches (23 October 2026)**, the creator: "one more coach, but without a mustache … a lot of tattoos, but it needs to
  have coaching cloth, same as others … like the tough coach. And … one more female, maybe with an afro, no cap." **Coach Storm** (the
  tough coach: a shaved head, heavy brows, no moustache, both arms in full tattoo sleeves and a tattoo on his neck, a charcoal polo with
  lime trim, black shorts with a lime stripe, the whistle) and **Coach Fontaine** (a big afro and no cap, gold hoops, a violet polo with
  mint trim, white shorts with a violet stripe). Made the same way (GPT Image 2.5, Meshy 7, Waters' skeleton, all twelve clips,
  `clear_limbs.py` for Storm's big arms, grounded, the face), at the end of `COACHES` so the crews' default picks are unchanged: five
  coaches to choose from, three at most in a crew. The face needed two new options in `coach_face.py`: `--brow-y LO,HI` (where the
  painted brows are looked for, in Waters' metres; Storm's sit higher) and `--brows-from-eyes` with `--brow-height` (Fontaine's painted
  brows are fine lines right under the afro's dark edge, which the brow finder took for a brow: her new brows are put where Waters' are
  over his eyes, finer, and nothing is painted out); a white texel next to a brow is painted out with it unless it is on an eye (the
  light edge Meshy baked round Storm's jutting brows). Files: `coach-storm.glb`, `coach-fontaine.glb`, `coach-storm|fontaine.webp`;
  both are on the Anim Bench, and `rig-check.mjs` holds them like the others (Storm's arms and legs, and Fontaine's knees by half a
  degree, as `clear_limbs.py` turned them: `adjusted` in the manifest). Every expression and the clips were rendered and checked by
  eye here; neither has been seen in a shift over Steam.
- **The grumpy coach (23 October 2026)**, the creator: "one more coach a grumpy overweight coach!! Make sure rigs and animation are
  similar to leopard man!! No mouth..use carl as reference." **Coach Marsh**: as round as Carl (whose T-pose picture was the second
  reference, with Coach Waters', for GPT Image 2.5), 1.66 m, bald with a grey-brown fringe, heavy scowling brows, no mouth and no
  moustache, a bottle-green polo with orange trim stretched over the belly, navy shorts with an orange stripe, the whistle on the
  belly. Rigged **like the leopard man and Carl**: Waters' skeleton plus the three belly bones (`belly_bones.py`), all twelve of Waters'
  clips, the belly's lag, bounce and breath baked into every clip (`belly_jiggle.py`, Startle played once), the arms swung out of the
  belly and the knees' bend cut where a shin would go into it (`clear_limbs.py --arm-max 62`; Swim more gently, `--arm-max 35
  --overlap 0.04`, or its stroke would no longer reach down past the body: a forearm brushes the belly under water), grounded; no
  Cannonball (he is a coach). His face has the 18 bones and nine expressions, and a **resting scowl**: `coach_face.py --temper` keeps
  a coach's own resting face in the `Face` bone's extras (his: the brows down at the middle, heavier lids) and
  `dist/scene/coach-face.mjs` lays it over every expression (`expressionFor(name, side, temper)`; the lids only where an expression
  leaves them open, so a fright still opens his eyes wide). Six coaches to choose from now, three at most in a crew. Files:
  `coach-marsh.glb`, `coach-marsh.webp`; on the Anim Bench; `rig-check.mjs` holds him to the skeleton, the clips, the belly bones and
  the face (his arms turned by up to 62 degrees, `adjusted`), `coach-face-check.mjs` the temper. Every expression and the clips were
  rendered and checked by eye here; he has not been seen in a shift over Steam.
- **The menu** (`dist/coop-ui.mjs`, the way Overcooked does it on Steam): PLAY WITH FRIENDS opens a window; **Host a shift** opens a
  friends-only Steam lobby of three; empty slots have **＋ Invite a friend** (the Steam overlay's invite). A friend joins from the
  invite, from **Join Game** on the host in Steam's friends list (the host's rich presence carries `+connect_lobby`), or by starting the
  game from the invite (`+connect_lobby` on the command line, `desktop/steam.cjs` `launchLobby`). Everyone has a slot with their coach,
  ◀ ▶ (or the arrow keys) to change it (**one each**: a coach someone has is skipped) and READY; the host picks the pool and difficulty
  (any pool the host has opened, as in FREE PLAY; every one in dev mode) and **Start the shift** once everyone is ready. After the
  shift everyone has the same results; **Back to the crew** returns to the lobby, **Leave the crew** to the menu.
- **The shift** is a free-play shift at the host's pool and difficulty, the same on every machine (built from the pool, difficulty,
  seed and the host's met incidents), with a coach per player. The simulation holds `sim.coaches` and an `actor` (whose coach `sim.coach`
  is); every input method is unchanged and `inputAs(i, name, …)` plays another player's; each incident's per-tick part runs as the
  coach carrying its item or the nearest (`focus`), the deck physics and the monkeys see every coach, the life rings remember who holds
  each. A single coach plays and replays exactly as before (replay-check's hashes unchanged).
- **More of everything for a crew** (`crewConfig`, `CREW`): two coaches get 1.15× the guests, 1.5× the coaching tips, 1.05× the fins
  asks, 1.6× the incidents and one more at once; three get 1.3×, 1.9×, 1.1×, 2.2× and one more at once. Not many more guests: the lanes
  hold a shift's guests and an overfull lane makes its swimmers walk out, whoever is on the deck (a crew of bots lost 20 guests a shift
  with 1.9× the guests); the extra work is in the asks and the incidents, which more hands can answer. The star targets are 1.15× for
  two and 1.2× for three, measured with crews of coach bots (`check-bot.mjs` `CrewBot`: each bot a coach, a job nobody else is on,
  every frame its turn) over ten levels and three seeds: average stars 1.37 alone, 1.43 for two, 1.33 for three.
- **The network** (`dist/net.mjs`): the shift is seeded and ticks in fixed steps, so the host plays it for real and shares only the
  inputs: every player's input is applied on the host and stamped with the tick it came before, sent to the guests three ticks at a time
  (20 a second) with a hash of the shift every two seconds; each guest plays the same shift and applies the same inputs before the same
  ticks, a few ticks behind the host, so every machine shows the same shift (about 2.5 KB a second for three players). A guest's own
  input waits for the host; its coach is drawn a little ahead meanwhile (`Predictor`, render only). Only input methods with plain
  arguments are accepted from a guest. A guest who drops leaves their coach standing; coming back (same name), they get the whole log and
  play it through in a second. Other builds are turned away at the door (`PROTOCOL`, the build's commit). A co-op shift never pauses
  (the menu opens over it) and has no slow motion. Guidance toasts are the player's who pressed the key (`event.by`).
- **Steam** (`desktop/steam.cjs` `createNet`, `desktop/preload.cjs` `desktop.steam.net`, `dist/steam-net.mjs`): lobbies through
  `steamworks.js` matchmaking (friends only, three), the overlay's invite, `GameLobbyJoinRequested` and `+connect_lobby`, messages over
  Steam's relayed P2P (reliable, JSON), sessions accepted only from the lobby's members and messages read only from them.
  `desktop/steam.config.json` is still Valve's test app 480, which is enough to try lobbies and P2P between two Steam accounts.
- **The scene**: every coach in his own model, clips and face, each with his own moments (a startle is his own); the others wear a ring
  in their coach's colour and their player's name.
- **Verified here:** `net-check.mjs` (a host and two guests over an in-memory network with up to 18 frames of latency and jitter, random
  inputs from all three through whole shifts, every guest's shift the host's at every hash and at the end; a rejoin; the lobby's rules;
  crews of bots through whole shifts), `desktop-check.mjs` (the Steam bridge against a fake `steamworks.js`), and in Chromium two windows
  of one browser over a BroadcastChannel (dev mode: host, join, pick, ready, start, both coaches moving, both windows the same shift).
  **Not verified:** two machines over Steam. That needs two Steam accounts on two machines (the creator's Mac and Windows PC), with
  tester builds: host on one, invite the other, play a shift (desktop/README.md, "Try co-op over Steam").

### The main menu: the Old Town Baths before the doors open (20 October 2026)

The creator: a new 3D level behind the menu, "right before the coach opens the doors to the venue", a brand-new venue, a static camera,
Coach Waters walking slowly right and left at the back, the pool "with a layer of black, a little bit, not too much", "pretty indie
AAA", the calm before the storm; everything the menu had kept but sorted differently; Settings and Credits; music and sounds.

- **The stage** (`dist/scene/menu-stage.mjs`, drawn by the game's own renderer while the menu is up, in place of the venue): the
  Old Town Baths at five to seven. The far wall is a painting (`assets/menu/hall-wall.webp`, GPT Image 2 with a style reference:
  arched windows on a sunrise, bunting, a clock at seven, OPEN 7:00, and the first guests' shadows waiting behind frosted doors),
  shaded in its shader so the room is dimmer up high and at the corners and warmer round the doors. In front of it everything is 3D:
  the tiled deck and side walls, the coping, three lane ropes riding a slow swell, light shafts from the windows, dust in them, and
  Coach Waters (his own model and clips: Walk at a stroll, IdleScan, IdleScratch) pacing the deck, stopping at the ends to look over
  the pool, sometimes at the doors. The water is a planar mirror (the hall drawn again from under it into a half-size target, only
  what is above the water) seen through a layer of black that lets the mirror show most at a glance: the windows, the doors and the
  coach are in it. One camera, never moving; on a wide screen the view slides right so the doors stand beside the menu's column, and
  a narrow screen gets a wider lens so the coach's walk still fits.
- **The guests behind the doors** (21 October 2026, the creator: "make this a reality"). The doorway is cut out of the painting and
  behind it is a real morning: paving, a bright sky over the town, the doorway's reveal, and seven guests waiting for seven o'clock
  (`GUESTS`): since the creator's second look (21 October 2026) the famous faces, the leopard man on the left and Cannonball Carl on
  the right, Marco "the Missile" in the middle with his watch, Valentina warming up, and three of the swimmers; the fish kid is gone
  (his bucket came through the closed door) and so is Karen. Each plays the clips they wait with in a shift's queue (IdleScan and
  IdleScratch, Marco's WaitWatch, Valentina's WaitWarmUp), impatient: one of their own clips now and then, a shuffle of a step or two
  and back, a look round (`updateGuest`). Everyone stands at least half a metre behind the doors, the two round men 0.7 m, and a
  shuffle never brings anyone nearer (`CLEAR`), so nothing of them comes through the glass. Their models are the game's (the swimmers
  load for the game anyway; the four figures, `GUEST_FIGURES`, are the files their shifts load, fetched with `loadFigure`); each
  comes in as it arrives.
  Through the doors they are only shadows: each frame the guests are drawn alone, black on white, from the camera into a half-size
  target (the mask, `renderMask`), and the doors' glass (the leaves' shader, `uLeaf`) reads it where it stands on the screen, blurred
  over a ring of taps, in the painting's colours: warm cream glass, deep brown shadows. So the shadows move as they do, and the water
  mirrors them too. The leaves have glass both sides and a brass push bar across each.
- **START** (once the shift is chosen, from the week or from FREE PLAY): the coach runs to the doors and turns to them, the view
  glides back to the middle, the doors swing open (1.3 s) and there the guests are, as they are, lit by a warm fill from the hall; they
  turn to the doors and step up, casting shadows into the hall now, while the coach steps aside to let them in; then the light fills the
  screen and the shift's countdown comes up behind it (about 3.5 s in all; a click goes straight to the doors; reduce motion, a restart
  and the crash hunt's trials start at once; should the stage stop drawing, a watch starts the shift anyway). If the stage cannot load
  (8 s at most) or stops drawing, the painted coach at his pool (`#menu-art`) is behind the menu as before; `?oldmenu` asks for that.
- **No first screen** (21 October 2026): CLICK TO ENTER is gone at the creator's word. The menu comes straight up and its music with it.
  The desktop app plays sound at once. A browser does not let any page play sound before the player's first click or key (Chrome
  lets a page that was clicked play at once after a reload); the game tries at load, takes every event a browser counts as a click
  (a touch's is its end), the fade-in waits with it, and while a browser holds the sound the menu's bottom corner says *Click anywhere
  for sound* (`watchSoundHold` in app.mjs; it never shows in the desktop app). The column comes in a line at a time.
- **The column** (`dist/title.mjs`): the logo at the top left and the choices at the bottom left (the creator, 21 October 2026),
  the logo whose one moving detail is a drop of pool water that gathers under it, falls and rings
  out every seven seconds, "By Phatty Acid Generative Studios", then START (always START, never CONTINUE: START shows the week, in the
  shift picker), FREE PLAY, COACH'S LOCKER, SETTINGS, CREDITS, and QUIT in the desktop app. The week's lines and days are not on the menu
  any more (21 October 2026; week-ui.mjs still fills them, hidden). A click on the dark round any window of the menu or of the ⚙ menu is
  its back button (`BACKS` in title.mjs: Settings, Credits, the locker, FREE PLAY, the shift picker, the bookings, Help, the pause menu). A hover or the keyboard's focus brightens a word, spreads its letters and draws a line under it, with a soft tick; a press
  clicks. Under it one tip a visit (a new player's first line says what the game is instead). The swimmers' models now load behind
  the menu: START reads LOADING 42% until they are in (12 s at most, then the classic swimmers stand in until they arrive); a trial or
  a hunt waits for them as before so every test plays the same characters.
- **Music** (`dist/audio.mjs` `startMenu`): two tracks made with ElevenLabs Music and looped seamlessly offline (an equal-power
  crossfade of the end into the start), with the empty hall's ambience under them (ElevenLabs Sound Effects): the theme when the game
  opens, and after a shift the second track, quieter (70%) and fading in over 6 s. The music fades out over 1.2 s as the doors open.
  The loop runs between the first and the last sound in the file, so an mp3's padding never makes a gap. The hover and click sounds
  are ElevenLabs Sound Effects too (`assets/audio/ui-hover.mp3`, `ui-click.mp3`).
- **Settings** (from the menu, and from ⚙ in a shift): master, music and effects volumes (music and effects are now two mixes under the
  master; the shifts' songs and the disco's are music, everything else effects; heard as a slider moves), brightness (the exposure of
  every venue and of the menu), film grain (a fine moving grain over everything, 20% to start), graphics quality and on-screen controls
  (moved here from Help), full screen, reduce motion (Settings' choice or the system's), and the Coach Cam's mouse sensitivity and
  Invert Y. They are kept with the other preferences (`pool-panic.settings.v1`, which the desktop app already saves).
- **Credits** roll by themselves (a wheel or a key takes over): a game by Gus Garza, Phatty Acid Generative Studios; made with Claude;
  built on three.js, Blender, Electron and Steamworks, Meshy and Tripo, fal's image models, ElevenLabs, the two typefaces, and the
  test and build tools; and the making of it in numbers, counted on 20 October 2026 from this machine's session logs and the
  repository, so they are "at least": about 4.6 billion tokens read and written (most of them the conversation read again from cache),
  11.6 million written by Claude, 12,186 tool calls, 10,796 replies, 128 messages from the creator, 181 commits, 43 pull requests,
  about 82,000 lines of code, 55 checks, 65 models. The game is not made with Unity, so Unity is not credited.
- **FREE PLAY** (21 October 2026, `dist/free-ui.mjs`, the creator: "a similar screen to the coach locker, where we see all of the
  venues that we can choose to play in"): a window of every pool as a card, a picture of each taken from the game itself
  (`assets/menu/pools/`), the ones the ladder has opened to play and the others locked; a difficulty (Easy, Normal, Hard, Expert: levels
  3, 8, 13 and 18, each open once a run has passed that level); PLAY. The shift is the week's own builder at that pool and difficulty
  (`freePlayShift` in week.mjs: a mid-run day, so the full crowd, VIPs, Marco and the big moment) without the week: no Date Fund, no
  wishes, no shop, no new pool. It ends on its own results (`finishFree`: stars, score, a new best for that pool and difficulty, kept
  in `pool-panic.free.v1`), and Play again plays it again. The cloud map of levels it replaces is still in the code, unused.
- **Dev mode** (21 October 2026, the creator: "I need a dev mode so I can test out all of the venues", `dist/dev.mjs`): while it is
  on, FREE PLAY opens every pool, the Grand Gala Arena too, at every difficulty (its window says *DEV MODE*, the menu's FREE PLAY
  says *13 pools · dev*); the run, the ladder and the coach's locker keep the player's real progress. A switch in Settings
  (Developer), saved with the settings; `?dev=1` or `?dev=0` in the address turns it on or off for one page. It is on by default for
  now (`DEV_DEFAULT`), while the creator tests the venues: the release checklist (`desktop/steam/checklist.md`) says to turn it off
  before the Steam build.
- **Checks** (`title-check.mjs`): the settings' defaults and limits, the tips and the loading label, the two mixes and Settings'
  volumes on a fake audio context, the menu music's loop points, fade in and out, and a stop cancelling a track still loading, the
  painting's size and where the doors and their glass are, the guests (each one's clips in its own file, all behind the doors and in
  their width), the doorway cut out and the mask drawn, no first screen, the windows' back buttons, FREE PLAY (the pools by the ladder,
  the difficulties by the run, a shift of every pool at every difficulty without the week, the bests kept, a picture for every card),
  the page's elements and the credits, and the app's wiring.
- **Verified in Chromium here** (software WebGL, so at about one frame a second): the menu at 1280×720, 1920×1080 and a 390×844 phone,
  hover, Settings, Credits, the locker, START from the week (the invite, the picker, the doors, the countdown), ⚙ → Settings in a shift,
  and the return to the menu with the second track and the doors shut again; on 21 October the guests' shadows on the closed doors, the
  doors open with the guests stepping up and the coach stepping aside, a click outside the locker closing it, FREE PLAY's window and a
  Kids Pool shift from it through the doors to its countdown.
  **Not verified:** the music and the sounds by ear (they were chosen by their numbers: loudness, the loop's seam), the frame rate on
  a real graphics card, and the look on the creator's Mac and PC.

### Depth and feel (Phase 3, 20 October 2026)

The diagnostic's third phase: *one big moment in each shift, at about two thirds of the way; in every pool a decision as good as
"which lane for which swimmer" (the river and the rooftop needed one); a highlight replay of the funniest moment; more life in the
streak; done when the coach bot is idle under 30% of a mid-difficulty lane-pool shift.* The creator: "Let's make this a very, very
fun game."

- **The big moment** ⭐ (`dist/big-moment.mjs`, the `BigMoment` system, first in `SYSTEMS`). Every shift of the week from the first
  Tuesday has one (`config.big = { at }`, drawn by `planBig` from the week's seed: 60 to 70% of the way through the shift, never in
  its first 28 s or its last 28 s, `bigTime`), and so does every free-play level from 2. Each kind of pool has its own (`bigKind`):
  - 🏁 **The race** (every lane pool): two racers walk out to the blocks of the race lane (the middle one, never the splash lane).
    Nobody new may go in it (the lane button says *RACE!*); the coach moves its swimmers to other lanes, walks to the blocks and
    blows the whistle (E). *On your marks…*, go, a length and back while the crowd roars, then *What a race!*
    (+300). Too slow (9 s on the blocks) and the starter goes without him (*They went without you*, +150); anyone still in the
    lane is swum into (−50 each, the streak broken, *Pile-up!*, −100).
  - 💃 **The encore** (Aqua Disco): five more dancers for Valentina's big number; when it ends, every zone with two to four dancers
    is in formation.
  - 🎂 **The birthday party** (Kids Pool): six party kids burst in; all of them in the pool before the cake.
  - 🎉 **The tube parade** (Lazy River): five guests at once, a tube each, all on the river before the drums stop.
  - 🌊 **The monster set** (Wave Pool): three monster waves in a row, five seconds apart: nobody knocked under (or stop the machine
    and play it safe, which only scores *good*).
  - 🎧 **The headline drop** (Rooftop Pool): the DJ's biggest drop of the night, with fireworks over the city: twice the hype, twice
    the slop. Nobody over the edge, and the deck mopped within 20 s.
  - 🔔 **The rogue wave** (Cruise Ship): the biggest roll of the voyage (`rogueSwell` in `dist/ship.mjs`): everyone who slides in
    helped out and every row of loungers straightened within 26 s.
  - 🐒 **The troop** (Mountain Hot Springs): four snow monkeys out of the forest at once; not one in a spring.

  Each goes waiting → announced (8 s: a sting of its own, a blue banner with what to do, a countdown) → live → done, graded
  **great** (+300, *SHOWSTOPPER!*), **good** (+150, *NICE ONE!*) or missed, with its words (*Best party ever!*, *Monkey business*).
  It waits out a rescue, a clean-up or a closed pool, and new incidents wait for it (`chaosBlocker`). Its random numbers come from a
  stream of its own (`bigSeed`), and the guests it brings come through the arrivals like a rush's, so a shift replays exactly.
- **A decision in every pool.**
  - The lane pools had one (which lane for which swimmer). Now **coaching tips** 📣 (`dist/tips.mjs`, the `CoachTips` system) give
    every quiet moment something worth doing: from level 2, now and then a lap swimmer asks for a tip (*How's my stroke?*, *Time my
    lap!*, a VIP's *Watch this, coach!*; 42% of them at level 2, 62% at level 20, a 10 s meter on the tag). The coach goes to the
    end of their lane and presses E as they come by: *High elbows!*, +40 (a VIP +80), happier, 12% faster for the rest of the
    workout, and one more for the streak. Unanswered, the ask lapses (−5 happiness). Not at the Kids Pool, the disco, the river,
    the Wave Pool, the rooftop, the Hot Springs or on the ship (busy enough already).
  - **The Lazy River's two ways round** (`ROUTES` in `dist/river-ride.mjs`): at the dock the coach sends each guest on the **LAZY
    LOOP** (1) or down the **RAPIDS** (2, out of sight past the cave). Every guest is a 🐢 chiller or a ⚡ thrill-seeker (45%; Marco
    always), on the card and the tag. The rapids are quicker (the guest comes back out of the cave at 1.8 times the current) and a
    thrill-seeker loves them (+14); a chiller comes back scared (−22) and may well flip off the tube (55%: the ring rescue). A
    thrill-seeker on the lazy loop gets bored; a chiller loves it. More than three riding the rapids at once and anyone may wipe out.
    The lane verdict says it at once (*Loves the rapids ⚡👍*, *Too wild for them 😬*, *They'll get bored 😬*, *Nice and lazy 🐢👍*).
  - **The Rooftop's seating** (`SEATS`, `seatVerdict`, `seatGuest` in `dist/rooftop.mjs`): a guest now waits by the lift for the
    coach to seat them: 1 the **WATER** (the chat groups), 2 a **SUNBED**, 3 a **CABANA** (there are two). Each guest wishes for one
    (💬, 🛏️ or 👑 on the tag and the card). Seated as they wished, they are happy (+10); somewhere else, less so (−12). A cabana
    delights anyone (+12), but a VIP's margaritas tip half as much again in one: given to someone else, the next VIP may find none.
    A sunbed sought with none tidy means a wait. Waiting by the lift wears their patience like any queue.
  - The other pools already had theirs (the disco's zones, the Wave Pool's machine, the ship's rows, the springs' sizes).
- **The streak, alive** (`STREAK_TIERS`, `bumpStreak`, `breakStreak`, `streakRisk` in `dist/sim.mjs`). Happy departures, **saves**
  (every incident put right, `save()`) and tips feed it; its tiers have names: ×1.2 *WARMING UP* at 3, ×1.5 *ON A ROLL* at 5, ×2 *ON
  FIRE* at 8, ×2.5 *UNSTOPPABLE* at 12. A tier reached flashes the badge, names it over where it happened and bursts there, and the
  music gets a hotter layer (`heat` in `dist/audio.mjs`). The badge says what the next tier needs, names the guest **putting it at
  risk** (the unhappiest one under 40 happiness: *⚠ Mo is tired of waiting: help them!*), and a broken streak (from 3) shatters it
  and says what broke it (*STREAK LOST · 7 · Broken by Ivy left cross*, *a pile-up in the race lane*). While an incident's or the big moment's banner is up, the badge waits just below it (they used to cover each other). Every incident's failure
  breaks it.
- **The highlight replay** 🎬 (`dist/highlight.mjs`). Every shift is recorded now (the playtest's recorder, `dist/replay.mjs`: the
  level, the seed, every input), and every funny or dramatic moment is noted with its tick and a weight (`clipOf`: a trampoline
  crash 10, a cannonball, a poo or a guest over the edge 9, a wee, the fish or the headline drop 8, a race 7, a cramp 5…). At the
  end, the results card offers *🎬 Watch the highlight · 💣 CANNONBALL!*, and a clip of weight 7 or more plays by itself (not with
  reduced motion or `?noreplay`). The shift is rebuilt from its record (`simFromRecord`, which `tools/replay.mjs` uses too), run fast
  to four seconds before the moment (*⏪ REWINDING…*, 1,500 ticks a frame) and played for ten seconds in letterbox, slowed to 0.4
  round the moment itself, the camera on it; any key or click skips it. It checks the record's checkpoints as it goes: a replay that
  stops matching is closed and logged, never shown wrong.
- **Star targets, again** (`SCORE_SCALE` in `dist/week.mjs`, `FREE_PLAY_SCALE` in `dist/sim.mjs`). The big moment, the tips and the
  streak's new tiers add points, so every pool was measured again with the expert bot (tiers 2 to 20 in all thirteen pools, before
  and after) and its targets raised by what it now scores: from about the same (the Sunset Lagoon, the arena, the resort late on)
  to about a third more (the river and the Wave Pool early in a run). Free play's targets were raised level by level the same way
  (they had also never been raised for its VIPs and Marco), so the coach bot managing lanes and incidents alone stays under three
  stars (`season-check.mjs`).

  **Measured** (20 October 2026, the harness's bots at tiers 8, 10 and 12, three shifts each, in the six lane pools). **Idle** (the
  share of the shift the bot had nothing to do): the expert 20 to 29% (the Aquatic Centre and Splash Park 20%, the Lagoon and the
  arena 24%, Senior Aqua Fit 28%, the Community Pool 29%), before 46 to 58%; the good coach 28 to 33%, before 46 to 57%. A tip is now
  a quarter to a third of the expert's time. **The goals** (`GOAL_SHARE`): with the targets raised by what the expert gains, the good coach (who
  gains less from tips and the big moment) made 3.5 dates a run instead of Phase 2's 4.3 (24 runs each, the same seeds; week 4 won
  13 of 21, week 5 4 of 13), its pay down 5 to 13% a week, so every week's goal came down by as much (0.85, 1.15, 1.15, 1.15, 1.1,
  1.1, 1.05 of six shifts' pay to 0.8, 1.08, 1.08, 1.08, 1.04, 1.04, 1). Measured again: 4.5 dates a run; weeks 1 to 5 won 23 of
  24, 23 of 23, 22 of 23, 17 of 22 and 13 of 17; on Saturday the fund held 1.36, 1.27, 1.20, 1.13 and 1.06 times the goal.

Checked by `phase3-check.mjs` (the streak's tiers and breaks, tips, the big moment's timing and every kind, the race start to finish,
the river's routes, the rooftop's seating, and a highlight played from a real record matching it tick for tick), and by
`week-check.mjs`, `river-check.mjs`, `rooftop-check.mjs`, `season-check.mjs`. In Chromium (software drawing, this machine) a level-10
shift was played with a script: the race's sting and banner, the race lane's *RACE!* button, the swim and a miss, the results card
offering the highlight, a highlight auto-playing, rewinding and replaying. **Not verified:** whether the big moment feels like a
climax to a player, whether tips feel like coaching or like chores, and the replay at full speed on a real graphics card (here it ran
at a few frames a second); only playtests can say.

### A run worth repeating (Phase 2, 19 October 2026)

The diagnostic found that nothing lasted between runs, that a good player filled the Date Fund by Thursday, and that the difficulty
hit a wall in week 4. Phase 2, on the creator's choices (the ladder, one money, an ending; the Sunday date kept as it is):

- **The pool ladder** (`LADDER`): a first run has three pools; every date opens the next one for good, in any run, with a panel in
  the date's scene and a banner on the results (*🔓 NEW POOL: SUNSET LAGOON*), and the new pool comes the very next week. A save
  from before keeps every pool it has played open (and one more for each week it ever reached).
- **The season finale and the story's ending**: Saturday of week 4 is at the Grand Gala Arena (`FINALE_WEEK`, `FINALE_POOL`), at the
  top of the week's band, its card shown and no gig to pick (*Start the finale 🏆*). Its date is the ocean trip: the first time, the
  date runs on into the ending (Marina sees the ocean and lets the postcard go), the credits roll the cast (`CAST` in
  `dist/marina.mjs`: a `credits` panel the cinematic player rolls up the stage), and *Thanks for playing*; later runs close with a
  shorter *The season is over* panel. The run goes on after it, endless: the arena joins the draw, the levels stay at the top and
  the crowds, targets and trouble grow every week.
- **Difficulty by week** (`WEEK_BANDS`, `tierFor`), with **every level's star targets smoothed** (`TIER_SCALE`): measured with the
  expert coach bot, 78 shifts a level in all thirteen pools and again in the weeks each level comes in, the season's levels were
  jagged (a dip at 8 and 10, a jump at 11 where the five-lane levels start, a wall at 17, 19 and 20); scaled, the expert makes a
  little less of each level's two-star target than of the one before, about 1.6 times it at level 2 and 1.15 at level 20.
- **One money**: the shop's perks come out of the Date Fund (above).
- **What lasts, in the coach's locker** (🏅 on the main screen): the pools (open, the next one, the best stars at each, `save.best`),
  the **gear** (`GEAR`: seven pieces opened by the stars of all runs, `save.stars`, from 5★ to 140★: a lucky cap, pool slides, a
  silver whistle, mirrored shades, a lifeguard vest, a golden clipboard, a Coach of the Year medal; each a smaller, lasting cousin of
  a shop perk; the coach wears one, picked in the locker; it is in the shift's perks, so a replay plays it the same; a new piece is
  announced on the results), and the **dates album** (`save.album`: every date ever had, with its still, to watch again, and the
  ending once seen). The four dates after the season (picnic, concert, karaoke, sailing) got their stills, made like the first four
  from the existing pictures (GPT Image 2, `fal-ai/gpt-image-2/edit`). A game over keeps all of it.
- **The goals, tuned** (`GOAL_SHARE`): with the coach bots playing whole runs through the harness (see below), week 1 is a learner's
  week ($260; $240 since Phase 3), and from week 2 a good coach ends Saturday a little over the goal, with something to spend in the shop.

  **Measured** (19 October 2026, the harness's skill bots playing whole runs up to week 10, buying in the shop like a careful player:
  one perk a visit, only while the fund stays on pace). The **good** coach (24 runs): week 1 won 24 of 24, week 2 23 of 24, week 3 21
  of 23, the finale week 16 of 21, week 5 9 of 16; on Saturday the fund held 1.42, 1.24, 1.20, 1.09 and 1.04 times the goal in weeks
  1 to 5 (1.9, 1.6, 1.4, 1.3, 1.2 earned, the rest spent); 4.3 dates a run. The **expert** (8 runs): 7.4 dates a run, 1.2 to 1.4
  times the goal. The **careful beginner** (24 runs): week 1 won 18 of 24, week 2 rarely. Most runs end on a week lost by a few
  dollars after shopping, or on a failed shift. Before (16 October's ramp, tips apart): the good coach's fund went 1.5, 1.3, 1.1,
  0.7 of the goal and its runs ended in weeks 4 to 6 on the difficulty's wall. The levels' targets measured the same way: the
  expert's share of the two-star target, level by level after the first round of smoothing, 1.7, 1.6, 1.5, 1.5, 1.7, 1.7, 1.7,
  1.7, 1.6, 1.6, 1.5, 1.2, 1.4, 1.4, 1.2, 1.1, 1.1, 1.2, 1.1 for levels 2 to 20 (before: 1.9 to 0.7, with steps); the second,
  smaller correction made from those numbers is in `TIER_SCALE` but was not measured level by level again (the whole runs above
  were played with it).

Checked by `progress-check.mjs` (and `week-check.mjs`, `onboarding-check.mjs`). **Not verified:** whether players start a second run
on their own, and whether a run ends on a shift they can name; only playtests can say.

### The first ten minutes (Phase 1, 19 October 2026)

The diagnostic of 19 October found that nothing taught the game and the first hour asked too little, then too much. Phase 1:

- **The main screen** (since 20 October 2026 the Old Town Baths behind it: "The main menu", above) says what the game is: the week card over a picture of the coach at his pool (`#menu-art`), one line on the
  job (*send swimmers to the right lanes, fetch the gear, fix the chaos*), START. The old level map shows only in free play.
- **The guided first shift** (`dist/tutorial.mjs`). The first shift of a player's first run (`!save.tutorial`, Monday of week 1) is
  the gentle minute stretched to 90 s (`TUTORIAL_SECONDS`) with `config.tutorial` on, and a yellow tip at the top of the column of messages on the left says the one
  thing to do next, step by step: select the waiting swimmer, send them to a lane (1), carry fins to the guest who asks for them, send
  that guest to a lane, mop the wet spot, then *That's the job, coach!* for six seconds. The fins have a marker with metres like the
  life ring's in a rescue (the loud alert, `collectAlerts` in coach.mjs): *🦶 Fin rack · 9 m* while the guest waits, then the guest's
  name and metres once the coach has a pair, shown from 1 m away (`near`; the other alerts from 4 m), and only in the tutorial. The simulation sets the stage only with the
  flag on: the second guest asks for fins first, everyone waits 2.5 times longer, and the first swimmer to climb out drips a wet spot.
  **Skip tips** stops them and marks the tutorial done; a finished tutorial is never shown again (`tutorial` in the week save). A
  replay rebuilds the shift from its config, so a tutorial shift replays exactly.
- **A gig picker with one card is no choice**: a plain *Start the shift ▶* button.
- **A pool's first visit** (`POOL_INTROS`, `FIRST_VISIT_EASE` in `dist/week.mjs`; `seen` in the week save, every pool played): the
  picker shows a card, *NEW POOL · its name · a little easier the first time*, with the pool's one rule and the one action to learn,
  and that shift is two levels easier (never below the week's band, Phase 2). The first Monday is not a first visit.
- **The lane choice judged at once** (`laneVerdict` in `dist/guidance.mjs`): a swimmer sent to a lane gets a floating word over them,
  green or orange: *Own lane 👍*, *Good match 👍*, *Sharing 👍*, *Stuck behind slower swimmers 😬*, *Too slow for this lane 😬*,
  *Aqua in the way 😬*, *OK 👌*. Nothing in a pool without lap lanes.
- **One meaning per key**: the numbers only send someone to a place; the wave machine is Z and the bar B (they were 1 and 3, which
  also meant lanes).
- **A calmer HUD**: eye relief, clean-up and the mop show only when something needs them (or the coach holds one); a happy swimmer
  with nothing to say wears a small faded tag; the deck heading and the status line sit on a cream pill, readable on any floor.

Checked by `onboarding-check.mjs`, which plays the tutorial through with a script. **Not verified:** whether a new player reads the
tips and learns the game from them; only a first-time player can say.

## Core loop

The loop is **the run** ([The week](#the-week-the-main-loop-11-october-2026-restructured-16-october-2026)); this is one shift of it.
(Until 19 October 2026 this section still described the old campaign map, which is now free play.)

1. On the main screen, **START** (or CONTINUE). Before a shift: the day's pool, the pass mark, Marina's two wishes and the gig
   cards (a booking pays more, with more trouble; it never scores more points).
2. A synchronized three-second countdown.
3. A door opens and a swimmer walks to the waiting area (their tag says who they are and what they need; since 20 October 2026 there is no list of the deck's guests on the left).
4. Select a swimmer by their world character, clickable name tag, or E beside them; a small chip on the left shows who is selected, with **Send home**.
5. Send them to one of the pool's places: a lane (three, five or two by pool), a zone at the disco, POOL at the Kids Pool, RIVER at
   the Lazy River, a spring at the Hot Springs; swimmers already in the water can be moved to another lane.
6. Move the coach to deliver equipment and treatments, recover dropped gear, mop wet spots, maintain the water and answer
   incidents, from cramps to a fish loose in the pool, with each pool's own trouble on top.
7. Swimmers finish, climb out and walk back out.
8. Points make stars, stars make pay into the Date Fund (nothing below the pass mark), wishes met pay extra; the shop between
   shifts sells perks out of the same fund.
   Saturday night decides: Sunday's date, or game over and a new run from week 1.

A lane assignment is a management action. Equipment pickup, handoff, cleanup, and rescue retain proximity and physical movement requirements.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move the coach relative to the screen; swim during a permitted rescue |
| Space | Jump; climb out near a pool edge during rescue |
| Shift | Short dash with an internal cooldown |
| E | Contextual nearby interaction: pickup, handoff, selection, disposal, return, or drop; a coaching tip to a swimmer asking 📣 as they pass the lane's end; the whistle at the blocks to start the race. **Hold** it next to Karen to calm her down |
| Click swimmer / swimmer tag | Select a swimmer |
| Click lane / lane button, or 1–5 | Assign the selected waiting swimmer, or move a selected swimmer who is already in the water. The numbers only ever send someone to a place (a lane, a zone, a spring, POOL, the river's LAZY LOOP 1 or RAPIDS 2, the rooftop's WATER 1, SUNBED 2 or CABANA 3) |
| Z | Stop or start the wave machine (Wave Pool) |
| B | Fetch a tray of margaritas from the bar (Rooftop Pool, Cruise Ship) |
| T / click the trampoline tower | Send the selected daredevil to the trampoline (Splash Park) |
| Click gear, a visitor or an injured swimmer | Act if the coach is in reach (grab the net, patch someone up); otherwise point the way |
| F / C / R | Guidance toward fins / chlorine / eye relief |
| P / Escape | Pause behavior through the game's input/UI routing |
| M | Toggle audio |
| V | Switch between the overview and the Coach Cam (first-person view) during a shift |
| Mouse / drag in the Coach Cam | Look around; with the mouse captured, click acts on what the crosshair is on. ← / → turn instead of strafing, and the wheel sets the field of view |
| Touch controls | Movement and actions using the same gameplay intents |
| ⚙ (top right) | The one menu: in a shift it pauses (back in, how to play, sound, full screen, the camera's zoom and reset, restart); elsewhere it is the settings. The other corner buttons (pause, help, sound, full screen, zoom) moved into it on 20 October 2026 |
| Any key or click during a highlight | Skip the replay back to the results |

Dash lasts 0.16 seconds with a 0.82-second cooldown. There is deliberately no dash cooldown meter. It supports carrying and jumping, uses collision substeps, and has streaks and a swoosh. Directional input is normalized so diagonal movement is not faster.

## Space, camera, and art direction

The pool's long axis reads horizontally on screen. The camera is a close, elevated, across-pool view with gentle following and extra edge panning to keep the coach and nearby equipment visible. Preserve this orientation when adjusting the scene.

The camera eases out on its own when a big moment has to share the screen with the coach: while a daredevil is on the trampoline tower, and while crash victims wait in the water. It corrects only the axis that left the safe area, so it never drifts sideways.

The coach starts midway along the near deck. The starting blocks, queue, and arrival routes are at the left/locker-room end. Both locker bays are integrated into the wall, not isolated islands in the middle of the room. The office sits in the upper-right corner. The clubhouse end was extended to make room for arrivals and traffic.

The club uses warm sand/terracotta tiles, muted teal walls, glowing high windows with light shafts, and a continuous tiled environment behind the HUD. Splash Park is open-air: sandstone pavers, a blue-and-white mosaic band around the basin, a plastered facade with terracotta roof tiles, cabanas, palms, loungers, a snack kiosk and the trampoline tower. Lighting presets (`indoor`, `day`, `golden`, `sunset`, `dusk`, `night` and the arena's `gala`) set the sky, sun, fill, fog, image-based environment and water tint; underwater lamps light the pool after dark. The open-air moods sit on one shared time-of-day scale (see [Environments](#environments-skies-weather-and-halls)). Textures are generated procedurally from seeded canvases, and the basin floor and walls carry animated caustics. The UI uses dark teal arcade scoreboard surfaces, yellow primary actions, swimmer passes, inventory slots, lane plaques, and emojis. Preserve the toy-like low-poly identity and readable game presentation.

Geometry, interaction hit volumes, collision proxies, camera framing, and routes must agree. The fin and chlorine fixtures were rotated 90 degrees for the horizontal presentation. Swimmers finishing at either end swim to the nearer end wall, climb out, and walk around the outside. Their water, climbing, and deck poses are distinct.

## Coach Cam — optional first-person view

A switch on the welcome panel turns shifts into a physical first-person view, and **V** flips between it and the overview mid-shift. It is off at every launch (since 15 October 2026, the creator's word: a choice saved before is not brought back) and lasts for the session. The overview stays the default and the reference framing for the game.

- **The camera is the coach's eyes.** It sits at eye height (1.52 m), just above the water while swimming, and travels through dives and climbs. The coach's own body is hidden. Two cartoon forearms (yellow track-jacket sleeves) and whatever the coach carries are drawn in a second pass with their own narrower field of view (56° vertical), so they read clearly and never clip into the world.
- **Field of view.** 92° horizontal at 16:9, adjustable from 80° to 105° with the mouse wheel, + and − or the ⚙ menu's camera row; its Reset restores 92°. The vertical angle is kept between 50° and 78°, so phones in portrait are capped instead of fish-eyed. Pitch is limited to ±80°.
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

## Coach Waters — the coach's model

The coach is Coach Waters, a Meshy-generated character (about 10k triangles, 24 bones, one 1024 px texture) with ten clips made in Blender (`tools/blender/README.md`): **Run**, **Walk**, **IdleScan** (head scanning left and right), **IdleScratch** (the same, then a head scratch), **Swim** (a freestyle crawl), **SwimRing** (his own: swimming with the life ring) and **Panic** (jumping without a pause with the hands up, which only the swimmers play). They can be previewed in the Anim Bench artifact (`tools/viewer/README.md`).

- **Run is every movement on foot** (walking, dashing), played faster or slower with his speed so the feet keep up with the floor. **Swim is the crawl**, played on his front in the water.
- **SwimRing is swimming with the life ring, and only that.** From the dive into the pool until the ring is handed to the swimmer he plays SwimRing, whether he is moving or floating: both arms are held out ahead of him round the ring, **still** (no windmill), the body does not roll and the face keeps to the front, and **only the legs kick**, a little faster as he swims faster (a gentle 0.85 times the clip's pace floating up to 1.3 times at his full swim speed of 4.2). It is the coach's alone (no other character has the clip, and a guest never holds a ring), and it is chosen by `ring` (he carries the life ring) and `prone` (he is swimming or diving) in `CoachRig.update`, ahead of every other rule: the ring on the deck is still Run and the idle scan, the fish net in the water is still the crawl, and once the ring is handed over the old rules are back. A file without the clip carries the ring with the crawl, as before. The clip is made in `tools/blender/character_clips.py --character coach` (the arms held by the same two-bone solver as the crawl's, straight and a little apart; the legs a six-beat flutter) and copied into the file by `transplant_clips.py`; `rig-check.mjs` holds it to what the brief says (the hands high and within 3 cm of the shoulder all through, the feet kicking in turn, no roll, the face ahead, the hips still, the feet on the floor) and `coach-model-check.mjs` to when it plays.
- **Walk is only the start of a shift.** While the 3-second countdown runs he walks in from a few steps away (3.6 units, at the walk clip's own speed) and is exactly on the spawn point when the countdown reaches zero. He comes from straight behind the spawn point when that ground is clear, else from the nearest clear diagonal or side (`planIntro`). Nothing in the simulation changes: only what is drawn.
- **Standing** plays IdleScan, with an IdleScratch after a few seconds of standing still (never while a job is in hand).
- **The classic coach stays, as a fallback only.** It is still built and posed, hidden behind the model. Since 15 October 2026 the game always plays Coach Waters (the creator: "make sure that we add always the new characters"): the *Switch to the classic coach* button is gone from How to play, no crash tier takes him away, a classic choice an older version saved is forgotten, and `?coach=classic` brings the classic coach back for that one page only (a test). (His file is still `coach-panic.glb` and his choice is still called `panic` in the code: only what the player sees was renamed.) If the model fails to load, or a clip throws, the classic coach plays.
- **Panic is in his file** (every rigged character has it, see The swimmers' models) but he never plays the swimmers' hop: he panics in his own way, below.
- **His face, and three clips of trouble (21 October 2026).** The creator: "more personality to the coach … face expressions and maybe like three more animations … chaos, struggle, panic. Like eyes wide open … we don't have mouth … so we have to be very expressive with the eyes and with the eyebrows when there's trouble." The Meshy model's face was paint, which cannot move, so `tools/blender/coach_face.py` gives him one that can: new smooth eye balls over the painted ones (a little bigger, hiding the painted dots), a black pupil with a white glint on each, an upper and a lower lid round each eye (skin shells with a dark line on the edge, tucked behind the face when open), two 3D brows where the painted ones were (painted out of the texture into forehead skin), and the moustache, his own, weighted to three bones. 18 bones under a `Face` bone under the head, whose frames at rest are the model's own (metres, x to his left, y up, z forward), and a second primitive with its own flat-coloured material; no clip keys them. `dist/scene/coach-face.mjs` poses them after the clips, every frame: nine **expressions** (`EXPRESSIONS`: neutral, focus, worried, alarm, panic, struggle, dizzy, dismay, relief) of eye size, lid heights, gaze, pupil size, brow ends, moustache curl, sag and bristle, eased from one to the next (a fright in a few frames), with blinks and glances when at ease, the pupils shaking and darting in a panic and circling when dizzy, the brows trembling in an effort and kept in front of a grown eye. **Which one** is `coachMood` (scene.mjs, render only: nothing in the simulation changes): just slipped on a wet spot, dizzy; a new incident (its sting), alarm for 1.3 s; a heavy job in hand (`HEAVY_JOBS`: hauling a guest back on the rooftop, helping one out of the cruise pool, straightening a lounger row, resetting the breaker) or towing a swimmer with the ring, struggle; a save, relief; a catastrophe or a broken streak, dismay; the loudest open problem at 80 or more, panic standing still and worried on the move; 55 or more, worried or focus; else focus on the move and neutral standing. The **clips** (`character_clips.py --character coach`, put in his file by `transplant_clips.py`, grounded): **Startle** (one shot, 1 s: a little hop back, the arms flung up by the head, frozen a moment, trembling), played from standing when an incident starts; **FreakOut** (a loop, 2 s: hands clamped to the sides of the head, twisting from side to side looking for help, stamping, the arms flying up once), when he has stood still for 0.8 s with something urgent unanswered; **Haul** (a loop, 1.33 s: feet braced, leaning back, heaving with both hands, trembling), through a heavy job; and since 23 October 2026 **Massage** (a loop, 2 s: bent over the massage table, the hands pressing a guest's back in turn; README "The massage"), while he massages. A run, a swim or the ice always comes first. Pictures: Anim Bench's Face panel (every expression, with the clip it goes with); checks: `coach-face-check.mjs` (the file's face bones, each expression on them, the mood, blinks and stillness), `coach-model-check.mjs` (when the new clips play), `rig-check.mjs` (the face's bones and mesh, kept apart from the skeleton the others share). Verified by CPU and in Chromium with software drawing (renders of every expression and clip, the startle and the haul fired in a shift); not yet seen on the creator's machines. In the overview the camera is above him and the cap's brim hides the brows: the eyes and the body do most of the work there.
- **Not animated by hand yet.** The arm poses the classic coach strikes (carrying, bandaging, the life ring) are not applied to the model: carried items sit in front of his chest and he keeps his run or idle arms. A swim is the Swim clip on his front (SwimRing with the ring).
- `dist/scene/coach-model.mjs` is pure view code and `coach-model-check.mjs` covers it. The GLB comes from `tools/blender` (`smooth_joints.py`, `game_export.py`, then `ground_clips.py`, which stands his clips on the floor); replacing `dist/assets/coach-panic.glb` replaces him in both the game and the viewer.

## The swimmers' models

The guests are five Meshy characters, not balls and boxes: a boy (1.58 m), a tall man (1.84), a woman (1.70), a heavy-set man (1.56) and a tall woman (1.86), each about 10k triangles with one 1024 px texture and the goggles on their eyes (`dist/assets/swimmer-*.glb`, about 0.8–0.9 MB each, loaded in parallel with Coach Waters at the start). They are rigged on Coach Waters' own skeleton, so they play his four clips. Which of the five a guest is comes from the guest's `skin` number, so it stays the same for the whole shift.

- **Clips.** Standing in the queue is IdleScan with an occasional IdleScratch, each swimmer a different moment into it so the queue does not move in step. Walking is Walk up to a brisk pace and Run beyond it (a little hysteresis, so a swimmer on the edge does not flicker), played at the speed that keeps the feet on the floor (each model has its own ground speeds). Swimming is **Swim**, a freestyle crawl made standing (like every clip; the world sync lays the swimmer on its front) and played at a stroke rate that follows how fast they swim, from a lazy two seconds a stroke for a beginner to under a second for a pro: each arm goes round the shoulder, pulling deep under the chest with the elbow high and coming back over the water with the elbow leading, the shoulders roll toward the pulling arm, the feet flutter in a six-beat kick, and the face is in the water and turns out to the side to breathe once a stroke. A swimmer at a problem strokes slowly, one fleeing or being evacuated flails. A model without the clip swims with Run.
- **Panic.** A swimmer who panics on the deck (the pool is closed for a fish, a dog or a cannonball, or there is a mess in the queue) plays **Panic**: a hop on the spot without a pause, both feet off the floor every half second, the hands and arms thrown up and flapping, the head tipped back and shaking, twisting one way and then the other on each hop. Each swimmer starts it at a different moment, so a crowd does not hop in step. It is the whole body, so the poses below are not laid over it, and the fins, which stay on the floor, are hidden while it plays. With reduced motion the swimmer stands with the hands up instead of hopping, and a model without the clip hops the way the classic swimmer does. A swimmer running away or in circles with the hands up is still Run with the arms posed.
- **Poses.** The world sync still poses the classic swimmer's arms and legs for what is going on, and the model copies them onto its own bones while they last (the "puppet" layer, `u.puppet` in `dist/scene/actors.mjs`): panic with the arms up, climbing out the ladder, treading water, sitting at rest, the trampoline and the leap away, the slip onto the back, and an injured swimmer lying on the deck. The copy is eased in and out, so a swimmer blends from a clip into a pose instead of snapping. The forearms, hands, knees and feet are straightened to the model's rest pose, since the classic swimmer has no elbows or knees. An aqua guest's warm-up arms (the aerobics) play only while they stand (in the queue, in the water): walking, every guest plays the plain Walk clip (17 October 2026: the warm-up laid over a walk made the "spaghetti" arms the creator saw at the Aqua Disco), and a disco dancer whose model has the routine's clip dances with its own arms. **Into the water** (18 October 2026, the creator: "they start perpendicular to the lane for half a second… the Aqua Aerobics swimmers… walk on top of the water"): a lap swimmer jumps in at the start of the near length, straight ahead of where they walked to and facing down the lane (circuit 0; it used to be 30, the turn across the near end, where every new swimmer lay side-on to the lane for most of a second), and an aqua guest jumps in at the edge and swims out to the spot face down (`aquaSwim` in `dist/sim.mjs`: the crawl, at the same 2.4 m/s they used to glide upright with the Walk clip playing), then stands up to work out; one with a problem swims back to the wall the same way (`shift-check.mjs` keeps both).
- **What rides on them.** The VIP crown and sash, the daredevil's star and cape, the sore eyes, bandage, fins and the queasy tint (green) are placed from each model's own numbers (the eye line, how far the chest reaches front and back) and scale with its height, so they sit on a 1.56 m guest and a 1.86 m one alike. The crown, star, sore eyes and bandage follow the head bone and the sash and cape the chest bone (a mount, a child of the bone that stands for the swimmer as it is at rest), so they go up with a hop and tip with the head. A model's suit and cap are its own, so a guest's type is shown by the colour of the disc on the floor under their feet (green beginner, blue intermediate, red pro, purple aqua, orange daredevil, gold VIP) as well as by the tag over their head. The dog stays as it was; Carl, the leopard man and the fish kid are models of their own (see The cannonball men and The fish kid).
- **The classic swimmers stay, as a fallback only.** They are still built and posed, hidden behind the models. Since 15 October 2026 the models are always played: the *Switch to the classic swimmers* button is gone, no crash tier takes them away (`dist/gfx.mjs`), a classic choice an older version saved is forgotten, and `?swimmers=classic` brings the classic swimmers back for that one page only (a test). If a model fails to load (the game waits at most six seconds for them), or a clip or pose throws, that swimmer is the classic one.
- **The dances** (16 October 2026, for the Aqua Disco). Three clips, made on the Coach's skeleton by `character_clips.py` (`dance_clip`: a bar of four beats at 120 BPM, 48 frames; the arms only, pumping up on the beat and down on the half beat, the other hand on the hip, with a bounce, a sway, a nod and heel taps), transplanted onto the five swimmers, Marco and Valentina and grounded: **DanceRight** (the right arm up to the beat), **DanceLeft** (the left) and **DanceBoth** (both). The rig plays them at the time the routine gives (`SwimmerRig.update`'s `dance`: the clip's time is set, not run), never at its own pace, so every dancer is on the same beat; a dancer in trouble (a cramp, a panic) leaves the dance for its own clip.
- **Not in the game yet.** Three of the five named premium characters (Dona Berta, Nico, Bruno) and their waiting clips are still only in Anim Bench. Marco is in the game since 16 October 2026, as the Aquatic Centre's star VIP ("the Missile"), and Valentina since the same day, as the Aqua Disco's instructor.
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

**The Community Pool as the Harbourside Community Swim Club** (28 October 2026, `dist/scene/harbourside.mjs`; the creator: "add
the assets that you made, the mosaic and all decor but for the original community pool running on ThreeJS, make sure assets are
optimized so game keeps running smoothly… improve the lighting, so it looks AAA indie… Performance is key… Only change that one
venue"). The building and the ~70 props made in Blender for the Godot test (`godot/docs/look.md`) dress the three.js Community Pool:
the 1960s seaside club with its glass-mosaic basin, sea-green tiled walls and navy band, the long wall of steel windows and the
radiators under them, the harbour mural washed by four picture lights, the café's viewing gallery, the changing rooms with their
lockers, banners, trophies, posters, plants, the painted footprints, compass rose and anchor on the deck. The layout is the game's
(the Godot venue was built round `dist/`'s numbers), so nothing in the play moves.
- **Made cheap** (`godot/tools/blender/three_club.py`, then `godot/tools/three-club-pack.sh`, into `dist/assets/club/`): the
  dense props simplified (510k triangles to 230k), everything static merged into one mesh per material class (matte, satin, gloss,
  metal, leaf, glow, glass, with and without shadows; one per tile set; one for the signs and posters, packed into one picture, and
  one for the cut-outs), the colours in the vertex colours; the deck's paint (footprints, the compass rose, the anchor, the words)
  baked into one picture the deck's shader lays on its tiles; ambient occlusion baked into the props' vertices and onto the floor
  (soft contact shadows, on the ambient light only). One quantized GLB (about 9 MB, read by three.js without a decoder: the
  desktop app's page allows no WebAssembly) and 0.7 MB of WebP pictures. About half the classic pool's draw calls (103 against
  184 to 200, measured in Chromium here), more triangles (278k drawn with the shadows, against 150 to 160k).
- **The game's own parts stay**: the water, the lane ropes and pennants (`buildPool`'s `basin`, `blocks` and `posts` off), the life
  rings (hung where the model's boards hold them: `world.ringAt`), the fins (the model's `Fins_1..3` are `finPairs`), the
  changing rooms' doors (the model's, swung by `sim.doors`), the skimmer, fish net, torch, fuse box and mop, every hit box and
  label (`props.mjs`'s builders with their stands off). `harbourside-check.mjs` builds both pools headless and holds them to the
  same hit boxes and labels.
- **The light** (`LIGHTING.harbour`): a low golden afternoon sun through the window wall and the skylight (the roof is drawn only
  into its shadow), its patches across the deck and the pool; a warm bounce in the ambient; soft shafts through every pane (a
  prism each, added, fading at the edges); dust sparkling only inside them; the lamps' glows as one cloud of points; caustics on
  everything under the water; the clocks' hands turning. No extra lights, no post-processing. The Coach Cam sees the near wall
  and the roof as a ceiling with its skylight.
- **Loading**: behind the menu with the swimmers (START waits for both, 12 s at most); the classic pool stands in until it is in,
  and with `?nomodels`. The world builds it when the club's look is `harbour` (`defaultLighting`), so a shift already running keeps
  its pool and the next has the new one.

- **Grand Gala Arena** (`dist/scene/arena.mjs`, `crowd.mjs`): a stage with an LED screen and a chasing-light marquee, a rotating trophy, three grandstands of instanced spectators who cheer on every save, scrolling LED ribbons, a hanging scoreboard cube that shows the live score, time and stars, two sweeping spotlight rigs with floor decals, balloons and confetti cannons.
- **Aquatic Centre** (`dist/scene/aquatic.mjs`, 16 October 2026): an indoor competition pool. The pool builder takes a dress (`buildPool`'s second options: tiles, lane lines, rope colours, block tops, pennants), here deep-blue tiles with black lines, red, white and blue racing ropes and navy blocks on a white deck; an electronic timing board on the back wall (five named lanes, their times running with the shift's clock, MARCO in orange) between two pace clocks, a row of club flags, blue grandstands with a crowd on two sides (a third for the Coach Cam), scrolling LED ribbons, a victory podium, the officials' table with timing screens, a team bench, and painted lane numbers. Its light is `LIGHTING.aquatic`, cool daylight with the underwater lamps on; its hall (glass walls, a white steel lattice roof, banners, bunting) is for the Coach Cam. `?pool=aquatic` (any pool id) plays every shift of the week there, for a look or a test.
- **Aqua Disco** (`dist/scene/disco.mjs`, 16 October 2026): a party pool built from scratch, every light on the routine's beat (`danceAt`, the shift's clock). A dark checkered deck, a glowing purple pool with no lines or ropes and a rim of LED tiles chasing round it in rainbow colours, a dark hall with AQUA DISCO banners, the back wall with its neon sign and equaliser over the entrance (a double door with a neon frame and porthole windows, whose leaves swing open as someone comes or goes), eight coloured spotlights sweeping the water left and right, sparkles, three laser emitters, a turning mirror ball, four speakers whose cones pump, a DJ booth with spinning records and a nodding DJ, a juice bar, and the stage: a round disc that pulses, a ring of bulbs chasing round an arch, and Valentina dancing (a classic figure with the same moves until her model is in). Its light is `LIGHTING.disco`, dark purple with the water glowing. A blackout dims all of it. With reduced motion every light holds still at one steady glow (no sweeping, no flashing).
- **Senior Aqua Fit** (`dist/scene/senior.mjs`, 16 October 2026): the first venue dressed with photographs and models rather than painted canvases (the creator: "improve lighting, textures and 3D models around the environment"). A Victorian glass conservatory: a travertine deck (`assets/senior/travertine.jpg`, GPT Image on fal) round a pool lined with an art-deco fan mosaic (`mosaic.jpg`, made seamless) under **clear water** (the water look's `clarity`: the basin shows through, and clouds over as the water gets dirty; the deck's foundation frames the basin instead of running under it, `buildDeck`'s `openBasin`, or the floor would be hidden), a marble coping, an emerald-and-gold frieze round it edged in brass, marble steps and brass handrails at the near end, brass ladders. White cast-iron glazing on the far side and the far end (a cream brick dwarf wall with a brass cap, fluted columns with ivy, glazing bars, a fanlight in every bay, hanging baskets of trailing flowers), with the garden beyond: box hedges, rose bushes in five colours and rows of lavender right outside the glass for the overview, and a garden panorama all round (`garden.jpg`) for the Coach Cam. The back wall is cream stucco with pilasters, an emerald tile dado, brass wall lamps and the sign (`sign.jpg`, "SENIOR AQUA FIT · SPA · SWIM · SINCE 1926") over the brass-and-glass doors, whose leaves swing open. Two Persian rugs (`rug.jpg`) and an emerald runner make the lounge; a teak bench with cast-iron scroll ends; a hydrotherapy spa (a marble tub that glows, with bubbles and steam); and Tripo models from fal for the wheelchairs, the pool hoist, two cane armchairs beside a brass standard lamp, the tea trolley, a gramophone on a mahogany table that floats a gold note now and then, two loungers and four monstera plants (`dist/assets/props/`, each with a stand-in until it loads). **The light** (`LIGHTING.senior`) is a low golden late-afternoon sun through the far end's glass: its mullions, and the roof's ribs (an unseen grid that only casts shadows, so the overview has them too), lay a window pattern on the deck, slanting shafts of light with dust turning in them hang in the air, and a cool fill comes from the garden side. The glass roof itself (two slopes on white ribs, cresting and brass finials, a fan of glazing bars in the far gable, brass pendant lamps) is for the Coach Cam only, like every indoor hall. A blackout dims every lamp, the spa's glow and the sun's shafts.
- **Lazy River** (`dist/scene/river.mjs`, `dist/scene/river-view.mjs`, 17 October 2026): an outdoor jungle water park in the late
  morning (`LIGHTING.river`, a soft green haze; the Coach Cam's sky has the `jungle` scenery: hills and palms, no sea). The deck is
  mossy sandstone pavers cut along the river's own curve (`sidePolygon`: each bank's line through the room, then round the walls).
  The river's bed is sand and pebbles under moving caustics, its banks stacked rock that darkens with depth under a mossy stone lip,
  boulders half in the water along them, and **the water flows**: its shader (`RIVER_FRAGMENT`) carries the ripples, long streaks and
  the foam at the banks and round the stepping stones downstream at the river's speed (`uPhase`), easing to a standstill when the
  pumps stop, darkening into the cave and the temple, clear enough to see the bed (`clarity`) until it gets dirty. Upstream, a rock
  arch with a dark mouth, vines and a **waterfall** the riders float out through, mist where it lands; downstream, **Temple Rapids**:
  carved stone pillars with tiki faces, a lintel, stepped blocks, a dark way in. A rope bridge of planks, two flat-topped stepping
  stones, two wooden docks with steps into the water and bamboo arches (ALL ABOARD, EXIT), the tube return, a bamboo tube rack of
  ten striped tubes, a bamboo palisade (low on the near side, so it never hides the deck) with the **jungle gate** (tiki posts, a
  thatched lintel, LAZY RIVER, two bamboo leaves that swing), tiki totems and torches with flickering flames, a thatched snack hut,
  boulders with ferns, and beyond it **the jungle**: swaying palms, banana plants, ferns, bushes with flowers, bamboo groves, and three
  parrots circling. A rider in a tube is placed by the river view (`riverPose`, `tubeState`): the tube on the water, the body seated in
  it by its own hip height, turning slowly with its spin and bobbing; out of the picture while away; a tube under the arm on foot.
- **Wave Pool** (`dist/scene/wave.mjs`, `dist/scene/wave-view.mjs`, 17 October 2026): a retro-tropical surf park at midday
  (`LIGHTING.wave`; the Coach Cam's sky has the `surf` scenery: the sea, sails, palms). Generated for it on fal: four pictures
  (`assets/wave/`: golden sand, an aqua mosaic floor, cream coral-stone pavers, all made seamless; and a retro surf-poster mural of a
  curling wave) and four Tripo models (`assets/props/`: the lifeguard tower, a surfboard, a beach umbrella, a deck chair), each with
  a stand-in until it loads. **The water** is a fine grid over the basin and up the sand whose vertex shader is moved by the crests
  the simulation has in the pool (`uWaves`, up to eight: where, how tall, broken, foam), with the very profile of `waveProfile` (drawn
  `WAVE.show`, 1.8, times taller than the simulation's heights, which the high camera would flatten), so what is drawn is what hits
  the bathers: swells that steepen, whitecaps on a wave about to break, a foaming face and white water rolling behind a broken one, a
  lacy line where it meets the sand, and run-up over the beach; its colour follows the real depth over the floor (clear turquoise
  over the sand, deep blue at the wave house), with sparkle, fresnel and caustics. The bed is one mesh: sand from the deck down under
  the water to a metre's depth, then the mosaic, blended along a wavy line, wet sand darker, caustics under the water. **The wave
  house**: a white stucco wall with five arched **wave chambers** at the waterline (dark mouths, grilles, the water in them surging
  as each wave is pushed out), a coral band with a terrace and railing, a striped awning, the **mural** on the upper storey, the
  WAVE POOL / SURF'S UP sign on the roof edged with chasing bulbs, flags, an **LED board** that says what the machine is doing
  (WAVES ON, NEXT SET 6, WAVES IN 3, MONSTER WAVE in flashing red, WAVES OFF), and two red-and-white **lighthouse towers** whose
  beacons turn (fast and red when a monster is coming, amber with the horn). Round it: the coral-stone deck, a teak boardwalk at the
  top of the beach, the lifeguard tower on the sand with a life ring, umbrellas, deck chairs, striped towels (the resting spots), a
  sand castle, beach balls, starfish and shells, pennants from the tower to the walls, the tube hut (a striped cabana; its stack of
  tubes is the hut's count), the Surf Shack (the dog treats) with surfboards against it, a surfboard rack by the gate, white stucco
  walls with coral caps (low on the near side), the surf gate whose slatted leaves swing open, and palms outside. **The bathers**
  (`wavePose`): standing in the shallows with their feet on the sloping floor, treading water with the head up out in the deep
  (sculling arms, kicking legs), or sitting in a tube (TubeFloat) that rides over each crest and tips with the slope; thrown back a
  little by a crest; stars circling over a woozy head and a sway; a dizzy one with an arm up; one knocked under down to the head and a
  waving hand in a stream of bubbles. Spray all along a crest the moment it breaks (`waveBreak`), a jolt of the camera for the
  monster, lost tubes bobbing in on the swell, and the coach riding the swell when he swims.
- **Cruise Ship** (`dist/scene/cruise.mjs`, 18 October 2026): the pool deck of a white cruise ship at sea in late-morning sun
  (`LIGHTING.cruise`, the time of day 0.4; the Coach Cam's sky has the `ocean` scenery, with gulls). **The roll** is the scene
  turning about the ship's centre line (`scene.rotation.x`, from `sim.ship.angle`), with the sea and the sky turned back so they
  stay level; the tags over the guests and every click on the deck follow it (`project`, `screenPoint` apply the scene's matrix),
  and the Coach Cam's horizon tips. **The sea** is a shader to the horizon 1.75 km out (swells, glints, a wake) and a panorama of
  sea and sky on a cylinder behind it. **The ship**: the hull's sides with two decks of balconies (a canvas texture) and orange
  lifeboats in their davits, the teak deck with non-skid walks, glass windscreens on white rails along both sides, and forward the
  superstructure: three white tiers with tall windows that hold the sky (a canvas facade), the name PANIC OF THE SEAS in navy
  letters, a giant outdoor screen playing a cartoon (generated), the bridge with its wings, a mast with radar and strings of signal
  flags, and the red funnel with a white band and a black top, smoking. **The pool**: a blue mosaic with caustics, the lane half
  deeper, a bench step along the free half's far wall, a red, white and blue lane rope and a blue and white float rope (instanced,
  riding the water), and **the water** a shader of its own that tips against the roll and stands up at the low end (the first mode
  of a sloshing tank, a lip of water over the coping, white froth there, the drained end darker; `uSlosh`, from the ship's slosh),
  with ripples round everyone in it. The loungers (each moved every frame to where the ship has slid it, a towel on each, furled
  navy umbrellas in deck sockets), the Lido Bar with its bartender and margaritas, the hot tub, the stairway lobbies with sliding
  glass doors, palms in planters, deck chairs and beach balls that slide about for show, and a guest who fell in treading water
  (`cruisePose`). Generated on fal for it: six pictures (`assets/cruise/`: teak, a pool mosaic, white ship's paint and non-skid
  deck, made seamless; a panorama of sea and sky; the cartoon on the screen) and eight Tripo models (`assets/props/`: the
  lounger, a steamer chair, a lifeboat, the pool bar, a towel cart, the ship's bell, a lifejacket box, the deck umbrella), each
  with a stand-in until it loads.
- **Mountain Hot Springs** (`dist/scene/onsen.mjs`, `dist/scene/onsen-view.mjs`, 18 October 2026): a terrace in the snow at the blue
  hour (`LIGHTING.onsen`, the time of day 0.74; the Coach Cam's sky has the `snow` scenery). **The terrace**: flagstones under a
  glaze of ice (the stone's picture, cooled, with a clear coat that catches the sky), and on it the snow, thick at the edges and
  round the boulders, rubbed away along the paths the guests tread from the bathhouse to every spring's steps (a painted mask);
  drifts banked against its sides, the snowfield all round. **The springs**: rock basins with a pale stone floor, flat rim stones
  (some capped with snow), wide stones for the steps, snow-capped boulders; the water one mesh with a shader of its own (milky
  turquoise, deeper toward the middle, slow swells, rings spreading from the bamboo spout, foam lapping at the rim, a glow from
  below) that the game's water uniforms drive like a pool's; **steam** rolling off every spring (puffs that rise, swell, drift and
  fade, moved on the GPU) and **snow falling** over everything. **Round it**: the timber bathhouse (a Tripo model) with its 湯
  curtain in the door and warm windows (they go out in a blackout), stone lanterns with flickering flames, a bamboo spout pouring
  a thread of hot water into the far spring, wooden buckets by the steps and the 湯 sign; snowy cedars round the far side and the
  right end and a ring of firs beyond, and the mountains painted all round (`mountains.jpg`, unfogged). The pictures and props are
  generated (`dist/assets/onsen/`, `dist/assets/props/`: stone-lantern, onsen-bucket, snowy-cedar, bamboo-spout, onsen-bench,
  bathhouse, yu-sign; the snow and the curtain made in code). **The cast** (`onsenPose`): a guest in a spring sits in it to the
  shoulders (settling down into it at the seat), wades waist-deep getting in and out, and stands up and panics when a monkey is in
  with them; a cold guest in the queue plays ColdHug (the classic figure crosses its arms) and shivers. **The snow monkeys**
  (`snow-monkey.glb`, Meshy, 11k triangles, on the Coach's skeleton, weighted by region so its face and back hold together when it
  walks on all fours (`monkey_skin.py`), with clips of its own: MonkeyWalk on all fours, MonkeyRun,
  MonkeyIdle, MonkeySoak, MonkeyHop; a monkey of balls stands in until it has loaded): walking, stopping to look about, hopping in,
  sitting in the water up to the chin, scampering off. **The coach** plays IceSkate on the ice and IceSlide when he slides.
- **The Jumping Pool** (`dist/scene/dive.mjs`, `dist/scene/dive-view.mjs`, 24 October 2026): a country club on a summer afternoon
  (`LIGHTING.dive`, the time of day 0.05; the Coach Cam's sky has the `garden` scenery). **The pool**: deep (4.2 m) and blue over a
  mosaic floor, a tile band, ladders on the long sides, pale pavers round it. **The stations**: at each end the green springboard on
  its fulcrum (it bends under a diver and rings on after the take-off, a damped spring), the yellow 3 m and red 6 m platforms on
  white towers with their height plates, steel stairs with rails, a painted mark for each line and a sign at each foot. **The near
  side is narrow** (the camera's side, where the coach starts; the creator, 24 October 2026: first "switch the hot tub and massage
  area… closer to camera where coach spawn", then "make the lower area of this pool thinner… a rectangular hot tub and rotate…
  the massage tables so they are parallel to pool… the ui blocks the tallest platform"): about 3.5 m from the pool's edge to the
  hedge, a walk along the pool and, along it, **the hot tub**, a long raised rectangle in a teak cabinet (two rows of three seats
  facing each other, steps at its end toward the beds; its own water, which clouds when soiled, steam, bubbles and a glow), with
  the skimmer on the hedge past its end and its water care before it, and **the massage beds**, end to end along the walk,
  lengthwise along the pool, on warm tiles open to the sky (a low shelf of towels and oils, a RELAX sign, a plant), the waste bin
  between them. The towels, the eye care, the rescue bench and the lifeguard's chair are on the far side. The camera stands back
  a little and leans toward the far side (`cameraScale` 1.5, `cameraFollow.biasX` 3.3, scene.mjs `followCoach`), so both
  HIGH platforms and a diver on them are clear of the score panel at the top while the tub and both beds stay clear of the
  buttons at the bottom. **Round it**: a striped lawn, clipped hedges and flower beds, round
  trees and cypresses, sunbeds and parasols, the white clubhouse with its green shutters and its sign, the garden gates. **The
  cast** (`divePose`): a diver in line, up the stairs, walking out (frightened: knees in, arms hugged; bored: hands on hips; a
  show-off strutting); at the edge a scared diver shakes and peeks over; in the air the body turns through its spin (tucked into a
  ball and opened out, piked, twisting, or flailing arms and legs on a wipeout; Carl and the leopard man in their Cannonball clip's
  ball), entering head or feet first, or flat; a landing ring on the water ahead of each diver at the edge, red while it is not
  clear; guests in the tub to the shoulders.
- **Rooftop Pool** (`dist/scene/rooftop.mjs`, `dist/scene/roof-view.mjs`, `dist/scene/city.mjs`, 17 October 2026): an infinity
  pool on a tower 185 m above a city, at golden hour going to dusk (`LIGHTING.roof`: a low warm sun, a pink haze, the time of day
  0.62; the Coach Cam's sky has the `skyline` scenery; the camera sees 3200 m here and 180 everywhere else). Generated for it on
  fal: eight pictures (`assets/rooftop/`: honey teak, a deep teal glass mosaic, travertine, marble, all made seamless; a dusk
  skyline panorama; three tower facades with lit windows) and fourteen Tripo models (`assets/props/`: the sunbed, the cabana, a
  furled parasol's canopy, the side table, the DJ booth, a speaker, the bar counter, a bar stool, the margarita, a palm in a
  planter, the lounge sofa, an ice bucket, a lantern, a potted plant), each with a stand-in until it loads; and two Meshy
  characters on Coach Waters' skeleton, **the DJ** (his clip DJ: hands on the decks, nodding to the beat; DanceBoth on the drop)
  and **the bartender** (Shake), who are not guests: they stand behind the booth and the bar (`FIGURES`, `buildRoofCast`). **The
  water** is a shader of its own: dark and mirror-like, the sky's zenith and horizon in it, ripples round everyone standing in it
  (up to sixteen), sparkle, and a slosh on the drop (`uSplash`); the basin has a mosaic with caustics, a bench step and a band of
  light; along the far side the **infinity edge**, a sheet of water flowing over the knife edge into the catch gutter (flow
  shaders), then a frameless glass rail and nothing but the city. **The city below** (`city.mjs`, cheap on purpose): streets lit
  with lamps and moving traffic (scrolling dashes on ribbons), three instanced meshes of towers with the facades laid on in world
  space (their windows coming on at dusk), a downtown of taller towers straight ahead of the edge, two supertall towers with
  blinking lights, a garden of glowing supertrees, an observation wheel turning slowly, a bay with the sun's glitter and a lit
  bridge, and the painted skyline round it all, fogged into the haze. **The roof**: the teak deck, travertine round the water, the
  cantilevered white slab with a bronze edge, two bronze lift cores whose doors slide open as a guest arrives or leaves, the
  sunbeds in pairs with side tables and furled parasols, two curtained cabanas with an ice bucket and lanterns, a lounge of sofas
  round a fire table, palms, potted birds of paradise, festoons of warm bulbs, the **SKY BAR** (a fluted teal counter with a
  marble top, stools, margaritas, a back bar of lit bottles, the name in neon) at the far left, and the **DJ's stage** at the far
  right: a riser with a lit edge, the booth, a speaker either side, beams that sweep, and an **LED wall** that plays bars of light
  to the music, counts down to the drop and goes wild on it. **The guests** (`roofPose`): chest-deep in the water (chatting, a
  bubble over a group), lying on a sunbed on a spread towel (TubeFloat), a hand up waiting for a drink, a glass in hand, the
  poser up on the edge leaning back with a phone, the one overboard waist-deep in the gutter waving (Panic), dancing on the drop;
  the towels on the beds rolled when free, spread when taken, crumpled with an empty glass when messy.
- **Kids Pool** (`dist/scene/kids.mjs`, 16 October 2026): an outdoor paddling pool in a park, by day. A yellow and sky-blue checkered deck, a pool with no lines, ropes or pennants inside a pink mosaic surround, grass and palms round it, a white picket fence with a "KIDS POOL" gate whose two leaves swing open (balloons on the posts), a slide, a lifeguard chair, a toy box, umbrellas and bunting, and toys floating in the water: three rubber ducks and two swim rings (Tripo models, `dist/assets/props/`; a Tripo whale was refused by its content filter, so two procedural beach balls instead), drifting and bobbing on the water. The mop bucket stands on its deck as on every other.
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
- Help retains detailed controls, while the opening menu avoids a written tutorial step list: the first shift of a first run
  teaches by doing instead (see [The first ten minutes](#the-first-ten-minutes-phase-1-19-october-2026)).

## Equipment and physical service

The coach has **one carrying slot**. Inventory and ownership must survive assignment, abandonment, incidents, rescue, and exits.

| Equipment | Purpose and rules |
| --- | --- |
| Fins | Exactly three physical pairs total across rack, coach, swimmers, and deck. Deliver to swimmers requesting them before or during workouts; recover dropped pairs. **Fins first** (from level 2, about one swimmer in forty: none to a few a shift): a swimmer who asks in the queue (🦶 on the tag, "wants fins first" on the card) cannot be given a lane until the coach hands over a pair; a lane click says so. They have asked, so they wait half as long again before losing patience. Free play and the week alike (`finsFirst` in `dist/sim.mjs`; `service-check.mjs`; the coach bot fetches and delivers them). |
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

Level 2 introduces an early cramp-prone swimmer. Later shifts vary susceptibility. Only one rescue can run at a time, and a rescue does not start during sanitation cleanup. **Cramps are spaced out** (19 October 2026, `CRAMP_GAP` and `crampCap` in `dist/rescue.mjs`): no new cramp starts within 30 s of the last one starting, and a shift has at most one for every 50 s of its length (one at least: 2 in a 90-second shift, 3 in 150 s, 4 in 180 s). A swimmer whose cramp is held back still has it coming after the breather. Back-to-back cramps used to freeze the water up to six times a shift at Senior Aqua Fit while the queue went home (an expert bot passed only 60% of its shifts there).

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

**A wee** (🚽, 16 October 2026, the creator: "the same as the poo, same mechanic, just a different thing happening"): a sick guest has a poo or a wee coming, decided from numbers already drawn (`sickKind` in `dist/sim.mjs`: 35% a wee, half at the Kids Pool, `peeShare`). A wee shows a 🚽 tag ("GOTTA GO!") and is prevented the same way, by sending them home in time. Missed ("WHO PEED?!"): a yellow cloud spreads in the water from where they were and the whole pool turns yellow (`waterYellow`, the water shader's `uYellow`), everybody is out and it costs as much as a poo (−500), but **there is nothing to scoop**: the cleanup starts at the chlorine (`cleanup.kind = "pee"`, stage `treat`), one dose or two clears the yellow, and the pool opens once the water settles. The clock holds as for a poo.

### Wet spots and the mop (every pool, 16 October 2026)

The creator: "a probability that each swimmer that goes out of the pool leaves a wet spot… one out of five… it's always there, I can go grab a mop… if kids slip or walk or run over the wet spots they get mad and we don't get as much points" (`dist/incidents/wet.mjs`, `dist/scene/wet-view.mjs`). **One swimmer in five climbing out drips a wet spot** where they got out (`WET_TUNING.chance`, from a random stream of its own so the rest of the shift is the same), a glossy blue puddle with a rim that pulses; spots close together merge, there are never more than ten, and **a spot never dries**. A guest (a kid above all) who walks or runs over one **slips**, falls on their back, is cross (−12 mood) and it costs 25 points ("Slipped on a wet spot!"). **The coach slips in one too** (the creator, 17 October 2026: "if the coach steps over them, the coach needs to slip… a second or a second and a half"): on his back for 1.3 s (`WET_TUNING.coachSlip`), unable to move, then up again, and he can step off the spot he fell in without falling again; it costs time, not points. **Jumping over a spot** (Space) is safe, or go round it. **The mop** stands in a yellow bucket on every deck (`fixtures.mop`, a solid obstacle; the mop and its bucket are Tripo models): grab it with E at the bucket or with **Q** (the 🧽 Mop button, which shows how many spots are out and walks you to the bucket), walk onto a spot and press E to mop it (0.8 s, +10, "SQUEAKY CLEAN!"), and put the mop back in the bucket. The first spot of a shift is announced ("WET SPOT!"); it is a chore, never counted as one of the incidents a shift may run at once. The coach bot mops when it is coaching well.

## Chaos incidents — level 4 onward

Each shift from level 4 schedules incidents from a seeded plan (`chaos` entries in `SHIFTS`: which kinds, and a time window). A separate random stream drives them, so swimmer generation is identical with or without chaos. `maxChaos` caps how many run at once (1, or 2 on the legend levels); an incident that cannot start yet is retried a moment later, and none start in the last 14 seconds. Every incident follows the same shape: a visible warning, a prevention window worth a bonus, a comic failure with a cost, and a full physical recovery.

| Incident | Warning and prevention | If missed | Recovery |
| --- | --- | --- | --- |
| 🐟 Fish Kid | A kid walks in carrying a bucket with a big fish and dodges once. Catch the kid on the deck and press E (+100). | The fish goes in (−200). Everyone races to the walls, leaps out and runs around in panicked circles. The pool closes and the shift clock holds while queue patience keeps draining. | Grab the fish net and walk to the edge to dive in. The fish flees, darts when cornered and tires; cut it off and net it (+75). Swimmers return to their lanes and unfinished workouts. Hand the fish back to the kid (+50) and hang up the net. |
| 🐕 Loose Dog | A dog trots in and starts sniffing around. | It steals fins and clutter (fins stay counted), bowls walkers over, jumps in and shakes out slippery puddles, and gets the zoomies. | Grab the treats; the dog follows while you keep them close. Lead it to a locker door (+150). |
| 😡 Karen | A woman in a pink tank top storms out of a locker door and marches **straight at the coach**, shouting. Everyone on deck within 3.3 m of her stops, covers their ears and loses points (−20 and 6 happiness each, once per person; the streak breaks). Run to her and hold E (+100, +50 if nobody was annoyed). | She never swims and never gives up: she follows the coach round the deck (to the pool edge when the coach is in the water) and keeps annoying everyone she passes. | Hold E beside her for eight seconds while the ring over her head fills (five with two coaches, three with three). Let go or step away and it drains. Calmed, she sighs and leaves through a locker door. See [Karen](#karen--level-4-onward). |
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

A VIP is an ordinary lap swimmer in a gold suit with a crown and a crimson sash (`vipAt` in `SHIFTS` lists where in the arrivals they come; a VIP never takes a daredevil's slot). They tip big: **+150** on top of a served swimmer's points, before the streak multiplier. But they wait less (75% of the normal patience) and in the water being blocked, crowded or in dirty water costs their happiness 1.4× faster. A VIP who storms out costs **−300** instead of −100. They never come with sickness, cramps or a fin request. The swimmer tag shows 👑 and "VIP · Pro" (`swimmerLook` in `dist/sim.mjs`), and the first one of a shift gets a toast. Golden hour introduces them; the results screen counts them (`stats.vips`).

### Storm — level 19 and the Storm drill

The storm twist (see below) is weather the whole scene shares: `stormLevel()` in `dist/chaos.mjs` ramps 0→1 over six seconds and the sky, light, fog, water and lamps follow it, with rain from about 30% and lightning from 50%, each strike followed by thunder (reduced motion keeps the storm but drops the flashes). From 70% on, a rain puddle forms on the deck every 2.6–4.4 seconds, half of them where people walk to the water, never within 2.2 m of the coach, at most six at once. They are ordinary puddles: anyone who walks across one slips (a swimmer loses a little happiness), and jumping over them works. Each dries in about 14 seconds.

### Karen — level 4 onward

Karen (`dist/incidents/karen.mjs`) is the first incident you **hold a key for** and the first with a **radius of influence**. She appears once on level 4 (`Fin club`, 74–94 seconds in), after the dog.

- **She goes for the coach.** Out of the locker room she walks at 3.1 m/s to wherever the coach is and re-plans as the coach moves. She stops 1.25 m away and rants. If the coach moves more than 2.2 m off she follows. A coach in the water (a rescue) cannot be reached, so she stands at the nearest edge.
- **Annoyance.** Everyone standing or walking on the deck within 3.3 m (swimmers in the queue, arriving or heading for the water, people leaving, the kid and Carl; not people in the water) is annoyed: they **stop where they are**, **cover both ears**, **hunch forward** and **shake their head** in disgust. Each person costs 20 points and 6 happiness once, and the streak breaks. Walkers resume where they stopped half a second after she moves on, and ease back into whatever they were doing (idle, walking). A red circle on the floor shows her range.
- **Calming her.** E next to her (within 2 m) starts the calm-down: **hold E until the ring fills** (8 seconds alone; since 23 October 2026, the creator's numbers, it was 3). The coach plants their feet, faces her and pats the air in front of them with both arms, up and down. Let go or move out of reach and the ring drains in about 1.6 seconds. Clicking or tapping her, or the touch/Interact buttons, starts a *latched* calm-down that carries on by itself until the coach moves. Calmed: +100 (+50 when nobody was annoyed), the "CALMED DOWN!" stamp, a sigh, and she leaves through the nearer locker door; her influence ends at once.
- **Her look.** Karen is a rigged 3D model (`dist/assets/models/karen.glb`, see [Karen's model](#karens-model)) with five clips: `Walk` (a furious march), `Complain` (left arm up and waving, then the right), `Point` (right arm out, jabbing), `Defeated` (once, a slump and a sigh) and `Idle`. While she rants the simulation cycles complain → point at the **pool** → complain → point at a **random spot** → complain → point at another random spot, turning her to face the target. Red, distorted words (`@#$%!`, `BLAH!`, `GRR!`…) spit out of her head. Until the model has loaded, or when it cannot (the headless checks), a stand-in built like the other characters plays the same states.
- **Many hands (23 October 2026, co-op).** The creator: "if two players hold E at same time on any incident it speeds things up … a
  progression wheel above incident … like Overcooked … a visual reference when a second player starts pressing E … (no numbers)."
  In a crew every coach who holds E beside her calms her too, each with their own hold (`coach.calming`, `coach.calmLatched`;
  she keeps the list of coaches on her, `helpers`, in the order they joined), and the ring fills faster with each one:
  her `calmTimes` [8, 5, 3] (the creator's): 8 seconds alone, 5 with two, 3 with three (`dist/teamwork.mjs` `teamTime`). Letting go takes that
  coach off and the ring slows down again; nobody holding, it drains. The ring is now an **Overcooked-style wheel with no
  numbers**: E before anyone holds, a hand while it fills. In a crew the wheel wears **the face of each coach on it**, in their
  colour, in a row over the wheel; from two coaches on it the wheel grows, a second ring goes round it in the new helper's colour
  (a third ring with three), the fill runs through their colours, the hand waves and the wheel pops as each one joins, with a
  rising "ba-dum!" (`team-up`). A single player's wheel has no faces and fills at the solo pace, unchanged. `karen-check.mjs` has a
  crew of three on her (the pace with one, two and three, the faces in order, one letting go); seen in Chromium in a co-op shift
  over the dev relay (the host's window, three coaches) and on a page of the wheel's states.
- **Audio.** Her voice is a procedural placeholder (a burst of nasal syllables every 1.3–2.4 seconds while she is loud). To use recordings, put them in `dist/assets/audio/` and list them in `dist/audio-files.mjs` (`AUDIO_FILES.karen`); each squawk then plays one at random.
- **Prevention is speed.** There is no warning window: the sooner she is calmed, the fewer people she annoys. The bot in `check-bot.mjs` runs to her and holds E; `karen-check.mjs` covers all of it.

### Karen's model

`tools/blender/karen_rig.py` turned the character art into the game asset. The steps, so it can be redone or reused for another character: the source image went to fal's **Meshy 7** (`meshy/v7/image-to-3d`, T-pose, 30,000 triangles, about $0.80; a first attempt with Hunyuan 3D looked wrong and was replaced); the GLB is scaled to 1.8 m with a 1,536 px JPEG texture, rigged with the 19-bone humanoid skeleton from `humanoid_rig.py` (bone positions measured from the mesh), and skinned in two ways: limbs by how far along the limb a vertex is (so thin arms and legs do not streak when they bend) and the rest by distance to the bones (Blender's bone-heat weights fail on a mesh with parts that do not touch). Weights are smoothed on welded points, because the importer leaves two vertices at every UV seam and smoothing them separately cracked the model along its seams. The clips are written by aiming each limb along a direction rather than setting bone angles. **Her arms hang about 50° out from her body** in Idle, Walk and the slump (`OUT` in the script): her bag is wider than her hip, and any closer her right arm goes through it. `tools/blender/karen_bagcheck.py` poses every frame of every clip and counts right-arm vertices inside the bag (Idle 3, Complain 11, Walk about 23 at the elbow crease, Point 0, against 100 to 170 with the arms at 20 to 30°). **Her soles lie flat on the floor** in every standing pose: the foot bones lie flat in the rest pose and the feet are aimed horizontally (an earlier version aimed horizontally at bones that sloped down, tipping the toes up about 25°). `tools/blender/karen_feetcheck.py` measures the planted foot's tilt in every frame of every clip (0.1° in Idle, Complain, Point and the slump; up to 6° in Walk at heel strike and toe-off) and how far the sole sits from the floor (within 1 cm), and renders a side view of the feet; run it after any change to her legs. Run `tools/blender/run.sh tools/blender/karen_rig.py -- raw.glb out.glb --debug DIR` to also render the fit and a few frames of every clip into `DIR`. Loading uses the vendored `GLTFLoader.js`, `SkeletonUtils.js` and `BufferGeometryUtils.js` in `dist/assets/` (three.js 0.170.0, MIT).

### The massage: the pools with a massage table

The creator, 23 October 2026: "lets create new incident for all the game!! its MASSAGE!! so we need a massage table on some levels …
a swimmer comes out and goes straight to massage table and lays down!! if no coach arrives, starts emptying the bar and gets
frustrated if goes to cero and we subtract points!!! so coach needs to go and presss and hold E for the massage session (same
duration as Karen) same progress bar!! 2 coaches, speed things up! … a standard massage animation for any coach … kind of overcooked
cutting salad animation!! … add this massage table in some venues !! not all!!" (`dist/incidents/massage.mjs`).

- **Where.** A massage table stands in four pools (`fixtures.massage` in `dist/spatial.mjs`: its middle, the way its head end
  points and its front side): the **Sunset Lagoon**, the **Aquatic Centre** and the **Grand Gala Arena** (behind the far end of the
  pool, lying across the deck, the same spot in all three: there the coach bots' routes do not pass, so no level's star targets
  move for it; a first spot by the relief station changed a route and dropped the Arena's bot below one star) and **Senior Aqua Fit** (the far deck between the glass doors and the
  fins rack). Only its legs are an obstacle (0.1 m either side of its middle line), so a coach can stand close enough to reach
  across the top. The table is drawn in `dist/scene/massage-view.mjs`: a padded top in teal leatherette, a towel with a mustard
  stripe, a rolled towel at the foot, a face cradle at the head end, turned wooden legs, on a rug, with a bottle of oil.
- **When.** The week's director draws it like any incident but only in a pool that has a table (`VENUE_INCIDENTS` in
  `dist/week.mjs`, beside the five every pool has: it is not in `INCIDENT_ORDER`, never a "surprise", and needs no meeting first):
  about one shift in three there, from the first one. The playtest panel's 💆 Massage starts it where there is a table.
- **The warning.** When it starts, the **next swimmer to climb out of the pool** (a grown-up: no child, nobody in a wheelchair, no
  racer) does not go home: they walk round the pool to the walk along its side and across to the table (`tableRoute`), climb on and
  lie **face down**, the head at the head end (the sting: MASSAGE TIME!, three soft spa bells). Their tag carries the hold-E wheel
  and a patience bar.
- **The prevention window.** 24 seconds of patience, running only while nobody is on it; under a third left, the bar turns red and
  they lift their head, pound the table and drum their feet.
- **The recovery.** A coach in reach of the table (within 0.95 m of its edge) holds E until the wheel fills: **8 seconds alone, 5
  with two coaches, 3 with three**, Karen's times and Karen's wheel (`dist/teamwork.mjs`: each coach on it fills it faster, their
  faces on it, a second ring and a pop as each joins, "ba-dum!"). Each coach steps to **a place of their own at the table** (`SPOTS`:
  the front side by the back, facing the camera; the far side; the front by the legs; the free one nearest them when they join),
  faces across it and works the back with both hands in turn: the **Massage** clip (below). Let go or step away and the wheel
  drains in 1.6 s; the patience then runs again. Relaxed: +120 (+80 more for a VIP), the BLISS! stamp, a sigh and a chime, sparkles,
  and they float off home.
- **The comic failure.** Patience gone: up off the table in a huff and off home, **−100** (−200 for a VIP), 60 happiness gone, the
  streak broken ("{name} gave up on a massage").
- **The Massage clip** (23 October 2026, `character_clips.py --character coach`, made on Coach Waters' body without his face, put in
  every coach's file with `transplant_clips.py`, grounded): a loop of 2 s, bent over the table, the hands flat (palms down) on the
  back, a hand coming down and pressing (3 frames), holding a moment and lifting while the other comes down, like a cook chopping a
  salad: a press every 6 frames, four a second; the shoulders rock toward the pressing hand, the back dips with every press, the
  head looks down at the hands, and the hands drift along the back and back again once a loop. **Every coach has it**: the coaches
  are of many heights and the table is one, so each coach's clip was made with its own `--massage-lift` (metres the hands go up or
  down on Coach Waters' body) so the pressed hands land at the height of a back on the table once moved onto that body (Waters and
  Fontaine as made; Rivers +0.06, Storm −0.12, Marsh −0.05, Brooks +0.06; the round ones' bellies jiggled and their arms kept off
  them, `belly_jiggle.py`, `clear_limbs.py`). **Coach Brooks**, the shortest, still falls 7 cm short: he works from a little wooden
  step (`massageStep` in `dist/crew.mjs`, drawn under him while he massages). The game plays the clip while the simulation says the
  coach is massaging (`coach.massaging`, `CoachRig`'s `massage`); a classic coach bends over the table with the arms going up and
  down in turn. `tools/blender/render_grid.py --box` renders it over a stand-in table.
- **Checks.** `massage-check.mjs`: the four tables where nothing else is, every coach's place and the guests' way on open deck, the
  walk there from both ends of the pool on the deck; the director (only there, about one shift in three, never a surprise); the whole
  of it with one coach (the sting, the loud alert, the patience a second a second and held while a coach is on it, the wheel's pace,
  the coach's place, the drain, the bliss and its points, home); the storm-off and a VIP's cost; two and three coaches (5 s, 3 s,
  each at a place of their own, their faces); no table no massage, no child; the same twice. The coach bot (`check-bot.mjs`) goes to
  the table and holds E. Seen in Chromium with software drawing (the table, a guest lying on it, a coach massaging: pictures sent to
  the creator); not yet on the creator's machines.

## Incident moments: stings, the loud alert, and payoffs

Chaos only feels funny when the player can read it, so every problem announces itself the same way, one thing at a time points to where to go next, and every save pays off.

- **The column of messages** (21 October 2026, the creator: the messages under the scoreboard blocked the view and each other, the tutorial's tip over an incident's banner; "never block the central view"). Every message of a shift stands in one column on the left, under the logo, where the guests' cards used to be (`#hud-rail` in index.html, `.hud-rail` at the end of style.css), one under the other in this order: the big moment's result, the incident's sting, its banner with the current step, the guided first shift's tip, the streak, the toasts, the selected guest. It sits inside the strip the follow camera keeps clear on the left (`cameraBounds`: up to 300 px, 22% of a narrower window; the column ends 10 px short of it), so the coach is never under it and the middle of the view is the pool's alone; the scoreboard keeps the top. On a phone held upright the column runs across the top instead, under the scoreboard. The highlight replay hides it with the rest of the HUD.
- **Stings.** When an incident starts or gets worse, a big sign slams in at the top of the column of messages and names it together with the action, e.g. "LOOSE DOG! Grab the treats · lead Biscuit out". The game slows down for a moment, the overview camera glides over to make room for the incident, and each incident has its own sound. The sign then shrinks away and the incident banner takes its place in the column, keeping the current step. Stings replace the warning toast they would duplicate.
  - The first time a player meets an incident, the sting runs longer, the game nearly stops, and a one-line lesson explains how it works (a "NEW" tag marks it). Seen incidents are remembered per device in `localStorage` under `pool-panic.seen.v1`, so later stings are short.
  - Incidents that sting: cramp, tummy trouble, the accident in the pool, fish kid, fish in the pool, loose dog, Cannonball Carl, Karen, a guest on the massage table, flickering lights, blackout, a daredevil waiting over a busy splash lane, the daredevil jumping anyway, and a crash. A clean jump into an empty lane is not an incident.
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

**A hold has a limit** (19 October 2026, `HOLD_LIMIT` in `dist/chaos.mjs`): whatever holds the clock (a mess, a fish loose, crash victims) holds it for 30 s at most; then the clock runs again, with a toast ("The clock is running again. Finish the clean-up!"), until the shift ends, the trouble still to fix. Before, trouble left alone held the clock for ever while the queue went home, and in a simulation 41% of the shifts nobody touched never ended (`pee-check.mjs`).

Changing tabs pauses active play/countdown. Pause must freeze doors and incident progression and clear held movement. Restart/menu transitions must clean up selection, effects, timers, and carrying state through a fresh simulation.

## Twenty-shift season and scoring

| Level | Shift | Venue · light | Seconds | Swimmers | Chaos | 1 / 2 / 3-star score |
| --- | --- | --- | ---: | ---: | --- | --- |
| 1 | Morning dip | Club | 30 | 4 | — | 150 / 300 / 400 |
| 2 | Lunch rush | Club | 60 | 8 | — | 600 / 1000 / 1400 |
| 3 | Peak panic | Club | 90 | 14 | — | 1100 / 1800 / 2500 |
| 4 | Fin club | Club | 120 | 20 | Dog | 1800 / 2900 / 3800 |
| 5 | Aqua hour | Club | 120 | 21 | Fish | 1800 / 2900 / 3900 |
| 6 | Fast company | Club | 120 | 22 | Carl | 2000 / 3100 / 4400 |
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

A served swimmer starts from 100 points, with happiness and service-quality bonuses for low wait, no collision, little slowdown, and compatible lane peers. Happy departures, saves and coaching tips build the happy streak's multipliers (Phase 3): 1.2× at three (*WARMING UP*), 1.5× at five (*ON A ROLL*), 2× at eight (*ON FIRE*) and 2.5× at twelve (*UNSTOPPABLE*). Angry or middling departures, a guest lost and every incident's failure break the streak, and the badge says what broke it. Prevention adds 100; wrongful ejection costs 50; lane collision costs 50; a sanitation catastrophe costs 500. Chaos incidents add their own bonuses and costs (see above); a clean trampoline flip scores 250 with the streak multiplier. Outside the warm-up, unresolved visits at closing normally cost 100 each. The simulation is authoritative for exact scoring order.

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

From level 11 the club offers **three bookings** before every Act 2 shift: Regular plus two others from a seeded shuffle (the same shift always offers the same). A booking is pure data folded into a copy of the shift (`applyBooking` in `dist/bookings.mjs`): a payout and the extra trouble it brings. A bigger payout always means more trouble. **The payout multiplies the pay, never the points** (19 October 2026): it used to multiply every served swimmer's points as well, against the same star targets, so the riskiest gig was also the easiest to star (in simulated runs, always taking it won more dates and more stars). Now `scoreMultiplier` in `dist/sim.mjs` is the streak and the shop's megaphone only, and the payout counts once, in `shiftPay`.

| Booking | Payout | Trouble |
| --- | --- | --- |
| 🏊 Regular | ×1 | None |
| 🚌 Tour group | ×1.25 | A rush a quarter of the way in |
| 🎉 Stag party | ×1.35 | Cannonball Carl, 18–40% into the shift |
| 🌙 Night swim | ×1.4 | Night lighting and a power outage, 30–50% in (not offered on a night shift, on a shift whose sun sets by itself, or in the arena) |
| 🎈 Kids' party | ×1.45 | A fish kid (12–30%) and a loose dog (55–75%) |

Replay keeps the booking; Next shift asks again. Booked runs count toward the level's best score and stars like any other.

## Audio, accessibility, and feedback

Music is intended from the menu onward, subject to browser audio permissions: the desktop app plays at once; in a browser the first click or key unlocks Web Audio (the menu says so while it waits). The shifts' music and the effects are procedural; the menu's music and its buttons' sounds are recorded (ElevenLabs, `dist/assets/audio/`). Music and effects are two mixes under the master, with Settings' sliders. Selection, countdown, doors, jumping, landing, dash, service, rescue, and sanitation provide synchronized cues. Panic changes the musical arrangement. Muting must work across those states.

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
| `dist/incidents/*.mjs` | One module per incident: `fish`, `dog`, `carl`, `outage`, `trampoline`, `karen`, `massage` (the massage table, in the pools that have one), `wet` (the wet spots and the mop); plus `twist` (the five mid-shift twists: rush, closure, swim team, aqua class, storm) |
| `dist/deck-physics.mjs` | Deck contacts, separation, passing and route cooperation |
| `dist/teamwork.mjs` | Co-op's many hands: a hold-E job fills faster with every coach on it (each job's times for one, two and three: `teamTime`), and the faces on its wheel (`teamTag`); Karen and the massage |
| `dist/crew.mjs` | Co-op: the six coaches (three at most in a crew), and the shift a crew of two or three plays (`crewConfig`, `CREW`) |
| `dist/net.mjs` | Co-op over the network: the lobby, the host and guests sharing stamped inputs, transports, `Predictor` |
| `dist/coop-ui.mjs` | PLAY WITH FRIENDS: host, invite, the three slots and their coaches, ready, the host's pool, start |
| `dist/steam-net.mjs` | Co-op's Steam transport: the lobby and relayed P2P through the desktop app (`desktop.steam.net`) |
| `dist/spatial.mjs` | The fourteen venues from one pool-geometry function by lane count (two: the Cruise Ship's lane half, its free half past the rope and routes round the loungers by `cruiseRoute`; three lanes: the club, the Aqua Disco and the Kids Pool with layouts of their own; four: Senior Aqua Fit; five: Splash Park, shared by the Lagoon, the Arena and the Aquatic Centre, which has no trampoline), the Wave Pool (a basin of its own size, `basin`, with a beach and the wave house) and the Lazy River (no pool: a river, `riverPlace`: its bridge, stones, docks, walkable test and routes) and the Rooftop Pool (a basin of its own with the infinity edge's gutter, two lifts at opposite ends, routes round the furniture by `roofRoute`); the door helper every venue uses (`arrival.at`, `sideOf`, `isInside`, `isDoorPoint`: a door on a side wall, or a lift along the deck, `alongZ`): stations, fixtures, rings, furniture, deck tests, routing, movement tuning |
| `dist/waves.mjs`, `dist/wave-pool.mjs` | The Wave Pool's waves (the basin's depth and floor, a crest's speed, shoaling and breaking, how hard it jolts, the surface's profile, the machine's program of sets and calms, the monster and its siren, stopping and starting, the LED board's words; pure) and its bathers (walking in to the beach, a spot to their liking, the jolts and the dizziness, the stars, staggering out, help out, knocked under, the tubes handed out, knocked off and washed ashore, the crowd's impatience while the waves are off, out by the beach dripping; the machine as a system: alerts, hints, the monster's banner, the diary) |
| `dist/dive-plan.mjs`, `dist/dive.mjs` | The Jumping Pool's plan (`DIVE`, `HEIGHTS`: LOW, MID, HIGH; `BOARDS`: six boards, their tips, stairs and lines; `STATIONS`; `LADDERS`; the hot tub, `TUB`, its seats and steps; `MASSAGE_BEDS`; the walks round it all, `makeDiveRoute`; `landingSpot`) and its life (`DIVE_TUNING`; the guests, `diveSpawn`: show-offs, soakers, Carl and the leopard man; sending them, `sendDiver`, `chooseBoard`; the dive itself, `tickDiver`, `planJump`, `outcomeOdds`, the points and the wipeout; the hot tub; the line-cutters; `DivingBoards`, the system the alerts, options and hints come from; its own random stream) |
| `dist/onsen-plan.mjs`, `dist/onsen.mjs` | The Mountain Hot Springs' plan (`SPRINGS`: four irregular basins, their steps and seats, `springLocal`, `springAt`; `BOULDERS`; the walks round them, `onsenRoute`; the springs as a place in the water for the incidents, `ONSEN_WATER`; the forest's edges) and the venue's life (`SOAK`: the cold in the queue, `tickCold`, sending a guest to a spring, getting in, soaking, getting out; `MONKEY`: the snow monkeys, `shooMonkey`, `SnowMonkeys`, the system the incidents' alerts, options, hints and banner come from; its own random stream) |
| `dist/cruise-plan.mjs`, `dist/ship.mjs` | The Cruise Ship's plan (`CRUISE`: the lane half and the free half, the deck, the bar, the hot tub, three rows of loungers, `LOUNGERS` and where each is now, `loungerSpot`; the blocks to walk round, `CRUISE_BLOCKS`, `cruiseRoute`; `CRUISE_CHILL`, the free half as a place to chill) and the ship (`SHIP`: the roll as a seeded state machine of calm, warning, lean, hold and back; what slides, `slide`, `driftDeck`, `coachDrift`, `swimLean`; the loungers sliding along their rows with friction, adrift, `straightenRow`; the slosh and the spills; into the pool and `helpOut`; `ShipDeck`, the ship as a system: alerts, the coach's options, hints, the swell banner, the diary; pure, its own random stream) |
| `dist/roof-plan.mjs`, `dist/rooftop.mjs` | The Rooftop Pool's plan (`ROOF`: the basin, the gutter and the rail, the lifts, the bar, the DJ; the fourteen beds, `ROOF_BEDS`; the furniture to walk round, `ROOF_BLOCKS`, and the shortest walk round it, `roofRoute`) and its guests (out of the lifts with a plan, the water in chat groups or a sunbed, the margaritas and the tray, tipsy, the messy beds and tidying them, the selfie at the edge, overboard into the gutter and hauled back, the DJ's drops on the music's bars, closing time, out by the lifts; the party as a system: alerts, hints, the panel, the diary; pure, its own random stream) |
| `dist/river.mjs`, `dist/river-ride.mjs` | The Lazy River's geometry (a curve sampled every 10 cm: a place as `s` along and `d` across, where the water is, the banks, clamping into the channel; pure) and its ride (a rider's spawn, the walk to the boarding dock, sitting in, floating with the current, the loop out of sight, bumping tubes, getting off at the exit dock, the tube return; the coach's service and water points at the river) |
| `dist/scene.mjs` | Three.js world: lighting presets, environment, batching, sync of characters, camera and picking |
| `dist/scene/*.mjs` | Scene kit, procedural textures, basin and water shader, props, characters, the club, resort, lagoon, arena, Aquatic Centre and Aqua Disco builders, incident visuals |
| `dist/scene/sky.mjs`, `daylight.mjs` | The Coach Cam's open-air world: sky dome, clouds, hills, sea, lighthouse, wildlife, rain and lightning, and the shared time-of-day scale that colours it all |
| `dist/scene/hall*.mjs`, `crowd.mjs`, `geom.mjs` | The indoor halls (roof profiles, trusses, windows, skylights, flags, bunting, pendants), instanced spectators, and shared geometry helpers (GPU-flutter flags and garlands) |
| `dist/scene/karen-view.mjs` | Karen on screen: the rigged GLB with its mixer (and a stand-in), the red scribbles, the annoyed pose everyone strikes near her and the coach's calming pose |
| `dist/scene/coach-cam.mjs` | Coach Cam: first-person camera, look and field-of-view limits, spring-driven hands, held items, crosshair picking |
| `dist/scene/coach-model.mjs` | Coach Waters: loads the Meshy character (`dist/assets/coach-panic.glb`), picks his clip from what the coach is doing (Run for every movement, IdleScan and an occasional IdleScratch standing, Walk for the walk in), plans the walk in, and swaps him in for the classic coach |
| `dist/scene/swimmer-models.mjs` | The five generic swimmers (`dist/assets/swimmer-*.glb`) Marco the Missile (`models/marco.glb`, the Aquatic Centre's star VIP) and Valentina (`models/valentina.glb`, the Aqua Disco's instructor), the two cannonball men (`carl.glb`, `leopard-man.glb`): which one a guest is, the clip they play (Walk and Run by foot speed, the swim, IdleScan and IdleScratch, Panic, the three dances, and the men's Cannonball), the classic poses copied onto the model's bones, what rides on the head and chest, and the swap for the classic swimmers |
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
| `dist/scene/kids.mjs`, `dist/scene/wet-view.mjs`, `dist/scene/prop-models.mjs` | The Kids Pool's builder (the park, the fence and gate, the slide, the floating toys); the wet spots and the mop bucket on screen; small props as models (the mop, its bucket, the duck, the swim ring, and Senior Aqua Fit's wheelchair, hoist, armchair, monstera, tea trolley, gramophone and lounger: Tripo meshes shrunk by `tools/glb_shrink.py`, with a stand-in until they load) |
| `dist/scene/wave.mjs`, `dist/scene/wave-view.mjs` | The Wave Pool's builder (the beach and the mosaic in one bed, the basin walls, the water moved by the simulation's crests, the wave house with its chambers, mural, sign, LED board and lighthouse beacons, the beach dressing, the tube hut, the Surf Shack and surf rack, the walls and the surf gate; the water as the lane for picking); the bathers on screen (`wavePose`: standing, treading, in a tube, woozy, under; `syncLostTubes`) |
| `dist/scene/dive.mjs`, `dist/scene/dive-view.mjs` | The Jumping Pool's builder (the lawn, the deep pool, the two stations: the springboards, platforms, stairs and plates; the hot tub and the spa corner; the hedges, trees, sunbeds, clubhouse and gates; a highlight and a click target for each height and the tub) and its cast (`divePose`: the line, the stairs, the edge, the flight with its spin, the entry, the tub; the landing rings, the springboard's bend, the steam) |
| `dist/scene/onsen.mjs`, `dist/scene/onsen-view.mjs` | The Mountain Hot Springs' builder (the snowfield and drifts, the icy terrace and its snow mask, the basins, the water shader, the rim stones and boulders, the bathhouse, the lanterns, the bamboo spout, the cedars and firs, the mountains, the steam and the snowfall, a highlight and a click target for each spring) and its cast (`onsenPose`: guests sitting to the shoulders, wading, panicking; the snow monkeys, `loadMonkey`, their clips and stand-in) |
| `dist/scene/cruise.mjs` | The Cruise Ship's builder (the sea shader and panorama, the hull with its balconies and lifeboats, the teak deck, the basin and its sloshing water, the ropes, the rails, the superstructure with the screen, the name, the bridge, the mast and flags and the funnel's smoke, the lobbies, the sliding loungers, the Lido Bar with its bartender, the hot tub, the loose chairs and balls); the roll each frame (`syncCruise`: the scene tipped, the sea and the sky turned back, the water's slosh, the ropes riding it); a guest in the pool treading water (`cruisePose`) |
| `dist/scene/rooftop.mjs`, `dist/scene/roof-view.mjs`, `dist/scene/city.mjs` | The Rooftop Pool's builder (the teak deck and travertine, the cantilevered slab, the basin and its water shader, the infinity edge and the gutter's flow, the glass rail, the lifts and their sliding doors, the sunbeds, parasols and cabanas, the lounge and fire table, the SKY BAR, the DJ's stage with its LED wall and beams, palms and festoons); the guests on screen (`roofPose`: chest-deep, lying on a sunbed, a glass in hand, the poser on the edge, overboard in the gutter, dancing on the drop; chat bubbles; the towels; the DJ and the bartender, `buildRoofCast`); the city 185 m below (streets and traffic, instanced towers with generated facades, landmarks, the bay and bridge, the skyline) |
| `dist/scene/river.mjs`, `dist/scene/river-view.mjs` | The Lazy River's builder (the deck cut along the river, the bed, banks and flowing water, the cave and its waterfall, the temple, the bridge, the stones, the docks, the tube rack and return, the palisade and gate, the jungle and the parrots; the river's "lane" for picking and guidance); the riders and their tubes on screen (`riverPose`, `tubeState`: TubeBoard, TubeFloat, the tube on the water, under the arm, on the rack, on the deck) |
| `dist/scene/harbourside.mjs`, `dist/assets/club/` | The Community Pool as the Harbourside Community Swim Club ("The Community Pool as the Harbourside", above): the model's loading, its materials (the venue's shader: caustics under the water, the deck's paint and contact shadows), the game's own parts round it, the shafts of sun, the dust and the lamps' glows; the classic pool (`scene/club.mjs`) stands in until it loads |
| `dist/scene/senior.mjs`, `dist/scene/senior-view.mjs` | Senior Aqua Fit's builder (the conservatory, the garden, the pool's mosaic and marble, the lounge, the spa, the props, the roof for the Coach Cam, the sun's shafts and its shadow grid; photographs from `dist/assets/senior/` drawn into painted stand-ins once they load); the seniors' wheelchairs on screen and what a senior in one plays (`seatState`: Sit, WheelPush, StandUp) |
| `dist/dance.mjs`, `dist/music.mjs` | The Aqua Disco's beat (the routine of three dance clips at 120 BPM, on the shift's clock) and the songs of their own: the disco's, the Kids Pool's, Senior Aqua Fit's tea dance, the Lazy River's calypso, the Wave Pool's surf rock and the Rooftop Pool's deep house, built round the drops the simulation plans (`roofScore`, `roofSection`; `SONGS`: the scores, pure, and the player that keeps the one the shift names on its clock through a PoolAudio) |
| `dist/tuning.mjs`, `dist/bisect.mjs` | The URL switches for isolating a crash, and the crash hunt's plan and state (pure); the scripted runs themselves are in `dist/app.mjs` |
| `dist/week.mjs`, `dist/week-ui.mjs`, `dist/marina.mjs` | The week (pure: chapters and their goals, the pool ladder and the week's draw, the bands of difficulty and the smoothed levels, the incident director, cards, wishes, pay, perks out of the Date Fund, the coach's gear, the save and what lasts across runs), its screens (the menu card, the shift picker, the shop, the week on the results, the coach's locker) and Marina's scenes (the invite, the date with a new pool, the story's ending and its credits, the rain check; stills, and the videos that replace them) |
| `dist/gfx.mjs` | How hard the game drives the graphics on a device (pure): the quality the player chose in Help (Auto, Low, Medium, Standard, High, Ultra) and a 60 fps cap on a touch device with WebKit. The pixel budget, the governor and the crash tiers are still in the module but off since 16 October 2026 (only the played hunt draws at tier 2) |
| `dist/hunt/lunch-rush.json` | The shift that crashed an iPad, as the recorder kept it: what `?bisect=shift` plays back in every test (`replay-check.mjs` plays it through) |
| `dist/platform.mjs`, `dist/achievements.mjs` | The game's side of Steam: a bridge to the desktop app that does nothing in a browser (achievements, rich presence, quit), and the fifteen achievements as pure rules (what earns each, kept on the device, told to Steam when it is there) |
| `desktop/` | The Steam build: an Electron window around `dist/`, the Steam calls, the progress file for Steam Cloud, packing and SteamPipe scripts, and the notes for Steamworks. Its own README says how to run and build it |
| `docs/incidents.md` | Every incident, how a shift picks them today, the level-by-level table and the proposed director |
| `dist/scene/menu-stage.mjs`, `dist/title.mjs` | The main menu's 3D stage (the Old Town Baths before the doors open: the painted wall, the deck, the mirrored pool, the coach pacing, the doors opening on START) and the title screen around it (the guests behind the doors, the buttons' sounds, Settings, Credits, the tips, START's LOADING %) |
| `dist/story.mjs`, `dist/cinematic.mjs` | The Ocean Fund's rules and the intro and ending scenes as data (pure), and the small full-screen cinematic player |
| `dist/crashlog.mjs`, `crashlog-hooks.mjs` | The crash log: breadcrumbs, errors, reports and GitHub issue links (pure), and its browser wiring (window errors, console, visibility, WebGL loss, Web Locks) |
| `dist/trace.mjs`, `dist/scene/footprint.mjs` | What the crash log is fed: the shift's diary (what changed in the simulation, in plain words, one line per change: the coach, the rescue, the rings, the swimmers in trouble, each running incident's stage through its own `describe`, the gear, the pool closing, a stage that has gone on too long, the shift's plan and a periodic pulse of where everything is) and the scene's footprint (nodes, meshes, lights, an estimate of the GPU memory for geometry, textures and shadow maps). Both pure |
| `dist/report-send.mjs`, `netlify/functions/report.mjs` | Sending a crash report to the developer: the device code, the player's say on sending by themselves, the POST (pure, with the fetch handed in); and the Netlify Function that keeps reports in Netlify Blobs and gives them back by device code |
| `dist/playtest.mjs`, `dist/replay.mjs`, `tools/replay.mjs` | Playtest mode (`?playtest`): the switch, the live copy's sender and the notes on what has been played and seen (pure); the recorder that makes a shift replayable (pure); and the command line that plays a recorded shift again, headless, and prints its diary |
| `tools/crash-triage.mjs`, `docs/crash-watch.md` | The crash watch: the reader that lists what the creator's devices have sent and sorts it (a crash, an error, a stuck incident, a flag, a hunt test), and the brief of the scheduled watch that was tried and stopped (kept for what it learned) |
| `tools/webkit-run.py` | Runs the game in a real WebKit (WebKitGTK, installed with apt) under a virtual display and prints the web process's memory and the game's state each second, and why the process ended if it did ("Running the game in a real WebKit", below). It has the same JavaScript engine as Safari, not the iPad's graphics or memory limits. |
| `dist/version.mjs`, `stamp-version.mjs` | The build's identity (`dev` locally, the commit on Netlify) and the script that stamps it |
| `dist/engine-pick.mjs`, `dist/godot-web.mjs`, `tools/fetch-godot-web.mjs` | The web site's first screen, the game or the Godot test ("The Godot test", below), the note of which Godot web build the site has (`null` in a checkout), and the Netlify build step that fetches it into `dist/godot/` |
| `dist/assets/` | Bundled Three.js, rounded-box helper, the glTF loader with its two helpers, license, `fonts/` (the five font files and their licence), `models/karen.glb` and `audio/`; `coach-panic.glb` for Coach Waters, the five `swimmer-*.glb`, the cannonball men's `carl.glb` and `leopard-man.glb`, the fish kid's `fish-kid.glb` and the fish, `fish.glb` |
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

Open `http://localhost:8000` (or run `npm start`). Do not open `index.html` through `file://`, which can block ES-module loading. No dependency installation or build is needed to play. Adding `?coach=classic` brings back the coach built from balls and boxes (see Coach Waters), and `?swimmers=classic` the swimmers (see The swimmers' models). Adding `?debug` to the URL exposes `window.__pool` for fast-forwarded repros and screenshots: `play(level)`, `step(seconds, drive)`, `end(score)` (finish the shift with a score), `coachCam(on)`, `unlockAll()`, `lockAll(on)` (see the star-gated map), `progress(n, stars)` (records as if levels 1..n were cleared), `menu()`, `select(level)`, `selectDrill(id)`, and read-only `sim`, `world`, `moments`, `records`, `selected`, `map`, `crashlog` and `playtest` (its parts: `on`, `coverage`, `live`, `recorder`, `open`, `close`, `flag`, `trigger`). Adding `?locked` previews the real star-gated map while `UNLOCK_ALL` is on.

### Crash log

The game keeps a black box of its own (`dist/crashlog.mjs`, wired to the browser in `dist/crashlog-hooks.mjs`), so that when it breaks on someone's device the report says what broke, where, on what, and what the game was doing, without anyone having to describe it. It exists because a shift once stopped when an incident kicked in and there was nothing to read afterwards.

- **What it records.** Uncaught errors and rejected promises; every error in a stage of the frame loop or in a single event; a lost WebGL context; three.js's own errors (a shader that did not compile) and every other console error or warning as a breadcrumb; a page that vanished in the middle of a shift (a tab crash, running out of memory, a freeze that ended in a forced close). The next launch can tell because that page's Web Lock is gone; a page in the background, one that closed, or one still running in another tab is not a crash. Also: how the frames are going and the GPU, scene and heap counts every 10 seconds and a few seconds after every save or incident (draw calls, triangles, geometries, textures and programs the GPU holds; the nodes, meshes, skinned meshes and bones, lights and shadow maps in the scene and an estimate of the megabytes their geometry, textures and shadow maps take; particles, people and page elements: a count that only climbs from shift to shift is a leak; the drawing surface's size, how many samples the browser really gave it and an estimate of the megabytes it holds (`surfaceMB`: 2322×1516 multisampled four times is about 148, without about 54) and the WebGL version are in the device line, and every resize of the page and of the visual viewport is a line of the trail with the surface's size then), the shift's state every 2 seconds (level, venue, lighting, view, clock, score, active incidents, the rescue's stage, where the coach is and what he carries, how many people are in each status, the shift's seed) and a trail of breadcrumbs (shift starts, every event the simulation reports with what it carries except the endless ones, pauses, view switches, world builds and how long they took, the player's clicks and presses of E, and any frame that took over 0.7 seconds).
- **The shift's diary.** `dist/trace.mjs` looks at the simulation after every frame and writes one plain line for each change that matters, so the last minute of a crashed shift reads like a story instead of a stack: `t7s swimming carrying lifering @-4.4,0`, `t7s life ring 0: coach → victim #1`, `t7s #1 Coco (intermediate) swim → exit (water)`, `t8s climb`, `t10s rescue over`, `t17s life ring 0: victim #1 → deck @-8.9,-0.2`. It follows the coach (what he carries and whether he is on the deck, in the air, diving, swimming or climbing), the rescue (stage, kind, who), each life ring, the incidents running, a cleanup in the water, and every swimmer in trouble or on an odd status; ordinary arrivals, swims and departures write nothing (a whole idle shift is a handful of lines). It only reads the simulation (a check proves the same rescue ends in exactly the same state with and without it), and if it ever throws it switches itself off with an error in the log instead of touching the game. `trace-check.mjs` drives it through a real rescue.
- **Where it lives.** Only on the device, in `localStorage`: `pool-panic.crashlog.v1` is the list of launches and `pool-panic.crashlog.v1.<id>` holds one launch each (so two tabs never overwrite each other). The last eight launches are kept (the ones that went wrong outlive the clean ones), each within 90 KB and 400 breadcrumbs (a playtest keeps a bigger budget: see Playtest mode). Saves, incidents, rescues and errors reach the disk at once (the page may be about to die); everything else within half a second.
- **Getting a report to the developer.** After a crash the next launch opens a dialog with the report: **Send report** (one tap: it goes to this site's own `/api/report`, see below), **Copy report** (paste it into the chat) or **Report on GitHub** (opens a prefilled issue in `larvuz2/poolpanic`, with the whole report on the clipboard because the link carries a shortened one). The Help dialog has "Open the game log" any time (it can send the log of a shift that did not crash, too), and `?log` opens it on load. An error that stops a shift opens the same dialog on the spot, with Restart and Back to the map. The box *Send crash reports by themselves from now on* is ticked the first time and is the player's say: tap Send with it ticked and every later report from this device goes by itself at the next launch (a toast says so; one that cannot be sent stays on the device and the dialog offers it as before), untick it and none does. Sending is only offered on a page served over http(s), never in the desktop app.
- **What is sent, and what is not.** The report as the dialog shows it (the build, the device's browser, screen and GPU, the error, the game's state and the diary) and the raw launch it was made from, nothing else: no name, no account, no address, no cookies; the server keeps the browser's user-agent line and never the IP address. The *device code* (eight characters, e.g. `K7Q2M5XA`, made on the device the first time it is needed and kept in `pool-panic.reports.v1`) is the only label: the reports a device sends are found by it. Anyone who knows the code can read that device's reports, so it is shown only in the dialog (with a **Copy code** button, to paste into the chat: reading letters out by voice goes wrong) and in the header of a report that is copied or sent.
- **Reading what a device sent (the developer's side).** `netlify/functions/report.mjs` is a Netlify Function at `/api/report` (the site's `[functions]` setting is in `netlify.toml`) that keeps each report in Netlify Blobs, at most 40 per device (the oldest go), and answers plain GET requests, so anyone who can open a URL can read them: `GET /api/report?device=K7Q2M5XA` lists them newest first, `&latest=1` is the newest as Markdown, `&id=<launch id>` one of them, and `&format=json` the raw record. Sending is limited (a size cap, 40 new reports an hour per device, 400 new reports and 2400 replacements of a report already held an hour for the whole site) and never takes the game down; a server that is not Netlify (`npm start`) answers the POST with an error and the dialog says the service is not there. Set `REPORT_ADMIN_KEY` in Netlify (Site configuration → Environment variables, with the **Functions** scope, then redeploy) to also list every device's newest reports at `?admin=<key>`; without it that path answers 404 as if it did not exist. There is no expiry and no delete endpoint: a device keeps its newest 40 reports, and test records can be removed in Netlify's Blobs page. `report-check.mjs` drives the function against an in-memory store and `report-send-check.mjs` the game's side.
- **Errors no longer stop the game by themselves.** Each stage of the frame loop is guarded (`stage()` in `dist/app.mjs`): drawing, tags, alerts and the HUD log their error and are skipped, and each event in a batch is handled on its own. Only the simulation throwing, or a stage that fails for 1.5 seconds straight, pauses the shift and shows the report.
- **Which build.** `dist/version.mjs` says `dev` from a checkout. Netlify runs `node stamp-version.mjs` before the checks (see `netlify.toml`), which writes the commit, deploy context and branch into it, so a report names the exact build.
- **Reading one.** A report is Markdown: the build, device (user agent, viewport, pixel ratio, GPU, the drawing surface, cores, memory), the game's state, each error with its stack and the game state at the time, and the timeline (the newest 400 breadcrumbs, each with the seconds since the page opened and, in the diary's lines, the shift's own clock). `?debug` exposes `window.__pool.crashlog` for QA; `crashlog-check.mjs` drives the whole thing with a fake browser.

**Isolating a crash on a device.** A report says where the game stopped; these URL switches say why, by taking one suspect out at a time (add them to the address, e.g. `?nosound&dpr=1`; `dist/tuning.mjs` lists them): `nosound` (the audio never starts), `dpr=N` (cap the pixel ratio at N instead of 1.7), `noshadow` (no shadow maps), `noparticles` (no splashes, sparkles, bursts or confetti), `nohands` (no first-person hands layer), `nohall` (the indoor hall and roof stay hidden), `nolights` (no point or spot lights), `nopoints` (no glow points), `noaa` (no antialiasing), `nomodels` (no character model is fetched or drawn: the classic coach, swimmers, kid, Carl, fish and Karen, for this page only, where `?coach=classic` and `?swimmers=classic` are remembered), `overview` (the overview camera whatever the setting), `norender` (the 3D scene is updated but never drawn) and `nosync` (it is neither updated nor drawn: the simulation and the page go on), the last two to tell a crash in the graphics from one in the script, `notags` (no tag, bubble or label over the pool) and `nolog` (the crash log saved every 5 s and not every half second, and a playtest's log sent only when the shift is over), the two that are not graphics, and `safe` (all of them but `dpr`, `overview`, `norender` and `nosync`). The crash hunt gives a test the same words, and a number as `dpr=1`. The switches show up in a report's `Page:` line.

Two scripted runs make a crash easy to hunt on the device itself. Both play level 10 in the Coach Cam with the player idle (Carl's cannonball, then the fish kid) and show a banner on top:

- `?trial` plays it once with whatever switches the address carries (`?trial&noshadow`) and says whether the page survived (`?trial=shift` plays the recorded shift of the 45-second crash below instead).
- `?bisect` runs the whole plan in `dist/bisect.mjs` (`?bisect=hands` runs the hands plan below), one switch per test (everything on, the character models off, then each other suspect off, then all off), reloading between tests. The state lives in storage, so a test whose page dies is counted as a crash by the next page; open the same address again after a crash and it carries on. At the end it lists the results with a verdict ("the crash went away with: …") and a **Copy results** button. `?bisect=reset` starts over (`?bisect=shift` runs the shift plan below).

**The hands crash (Safari).** The crash hunt found that the Coach Cam's first-person hands layer crashed an iPad's Safari about 45 seconds into every Coach Cam shift, whatever was happening (with the hands off, or in the overview, nothing crashed; the earlier suspects made no difference). It is a second render pass (`CoachCam.render`: clear the depth, draw the arms and the held item with their own camera and lights), and no GL object is created per frame in it, so the cause is on the device. Until it is understood, Safari's engine (every browser on an iPhone or iPad) plays the Coach Cam without the hands (`isWebKit` in `dist/tuning.mjs`, a toast says so); `?hands` turns them back on. `?bisect=hands` runs a second plan that looks inside the layer, one change per test: no depth clear (`handsnodepth`), no shared reflections (`handsnoenv`), no lights of its own (`handsnotorch`), unlit colours (`handsbasic`), and drawn in the room's own pass (`handsinline`: the hands become children of the room camera, scaled to give the same picture, with no second render at all).

**The 45-second crash in a played shift (October 4, 2026), not understood yet.** The playtest (below) was played on an iPad Pro in Safari 26.6 (a 1366×892 page at 1.7 pixels, a 2322×1516 drawing surface, the overview, the character models) and the tab was killed five times in eight minutes (Safari reloaded the game within a second each time). Four were in a shift, **46.4, 46.1, 44.0 and 43.4 seconds after the go**, on levels 4, 7, 2 and 2 (three with an incident forced from the panel, and one, a level 2, a plain natural shift), and the fifth as the page came back from the background during a level 2 countdown (a tab killed while hidden looks the same); the 30 s shift of level 1 went through. The shifts play again exactly in Node (`tools/replay.mjs`: every checkpoint matched), so the simulation is not what stopped. What the log of the last seconds shows: the frame rate fell from 79–84 with nobody on the deck to 37–46 with eight to twelve skinned characters; the scene's own counts were flat (geometries, textures, programs, the megabytes they hold); and the crash came shortly after the first customers lost patience, which is just the time at which that happens, so it says nothing more than the clock. The menu is no evidence of safety: under the map the 3D scene is not drawn at all (`covered` in `frame()`), so the minute the creator spent on the title with eight models there cost the GPU nothing. What was checked instead, in Chromium (software WebGL): across a shift the GPU is called about 330 times a frame (583 matrix uploads, 307 vertex-array binds, 7 bone-texture uploads) and creates nothing per frame; the JS heap and what the renderer holds stay flat. The music makes about 70 Web Audio nodes a second (a new buffer nine times a second among them); they now disconnect themselves when they end and share one noise buffer (`dist/audio.mjs`), which is a guess made because the crash comes at much the same time whatever the scene holds, not a finding. To find it on the device, `?bisect=shift` (add `&playtest` to read it from here as it runs) plays the shift that crashed the iPad again in every test, in the overview: the level 2 of 4 October as the playtest's recorder kept it (`dist/hunt/lunch-rush.json`: the level, the seed and every input with the tick it came before), fed to the simulation through the game's own frame loop, so every test plays the very same shift (in Chromium it matches the recording at every checkpoint) and the tests differ in one switch only; the recording is of a shift that was played, with swimmers in the water, and it lasts 46 s, so the shift goes on idle after it until 56 s from the go, a long way past 43 to 46 (`?bot` plays a level 3 instead, with a bot that every 0.7 s sends the swimmer who has waited longest to the emptiest lane that will have them, from a seed that stays playable for 75 s, for when a recording is not wanted; a page that cannot fetch the recording does that too). The tests are: everything on, then the pixel ratio at 1, the 3D scene updated but never drawn (`norender`), the 3D scene not even updated (`nosync`; between them they tell the graphics from the script: a crash that survives `nosync` is in the simulation, the page or the log), the character models off, shadows off, antialiasing off, the hall off, particles off, extra lights off, all of them off, and the first test again. What a replay cannot give is the player's own touches on the page (the cards and lanes): if the replayed shift does not crash and a played one does, that is where to look next. The page holds the screen awake (the Screen Wake Lock), counts only the time it is in front of someone, presses play again if the page was hidden, and leaves a test it could not play through as `unclear` rather than `ok`. Safari reloads the page by itself after a crash and the plan carries on; at the end it lists the results with a verdict. `?trial=shift` plays one such shift with whatever switches the address carries.

**Running the game in a real WebKit (5 October 2026).** The sandbox has Chromium, but a real WebKit can be had too: `apt-get install` of `libwebkit2gtk-4.1-0`, `gir1.2-webkit2-4.1`, `python3-gi`, `xvfb` and a few more (the list is at the top of `tools/webkit-run.py`) gives WebKitGTK 2.52, the same engine family as Safari, which `tools/webkit-run.py` runs the game in under a virtual display (software GL, so a few frames a second; a PulseAudio null sink lets the page's Web Audio really run, `--audio`). It prints the web process's memory every second and says why the process ended. What was run, with `?trial=shift` (the shift that crashed the iPad, played by the recorder's inputs): the whole 56 s shift drawn (a 640×400 window, Web Audio running, 270 s of wall time) and the whole shift undrawn (`norender`, real time, Web Audio running with about 70 nodes a second that all end and are let go of); in none did the web process die, and its memory stayed flat after the first half minute (about 1.1 GB drawn, 0.9 GB undrawn: most of it the software renderer and the JIT). So the game's script, its DOM, the diary and the log, and Web Audio do not kill a WebKit 45 s into this shift. What this cannot say: it has none of the iPad's graphics (Metal, the GPU process) and none of iOS's memory limits, and a hunt nobody touches probably never starts the iPad's audio (Safari wants a tap first; not checked on the device), so the audio that ran here may not run there. The cause, if it is the iPad's, is in what only the iPad has. One lead, **not established**: Apple's developer forums and the three.js and Home Assistant trackers have reports of the iPad's GPU process (`com.apple.WebKit.GPU`) being killed for memory (`highwater`, 316 to 522 MB on a 4 GB iPad; `MREExceptionAdvisoryLimitActive` on an iPad Pro in iPadOS 26), and the game's drawing surface is large (2322×1516: four-times multisampling alone is an estimated 107 MB, about 148 MB with the buffers that are presented, before a texture is counted; estimated, not measured); the hunt's pixel-ratio-1, no-antialiasing and everything-off tests are the way to find out, and the iPad's own record (Settings, Privacy & Security, Analytics & Improvements, Analytics Data: a `JetsamEvent` or `com.apple.WebKit…` entry from the minute of a crash) would name the process and the reason. **Parked on 5 October 2026, at the creator's word: the game is for Steam, which runs the desktop app and not a web page, so it is tested there, on their Mac and their Windows PC (`desktop/README.md`, "Test it on your Mac or Windows PC"), and the iPad hunt stops here.** Nothing found says the desktop app has the crash: its own Chromium (Electron 44, Chromium 152) played the hunt's shift through 57 s in this sandbox (software drawing, the scene updated but not drawn) with the renderer's memory flat at about 440 MB. What would bring it back: a web demo that has to run on phones and iPads, or a Mac or Windows report of a page dying about 45 s into a shift. The hunt (`?bisect=shift`), the switches, the beat and the surface lines in the log are all still in the game.

**Unparked on 12 October 2026: the game has to work in the browser too.** The iPad died three more times in four minutes on 12 October, 41.7, 46.3 and 43.6 s after the go (levels 2, 2 and 6, the last in the Coach Cam), each launch drawing lighter after the one before had died (`dist/gfx.mjs`): a 1749×1142 surface with antialiasing and shadows, then 1464×956 without antialiasing (about 21 MB), then 1237×808 without antialiasing or shadows (about 12 MB). The frames came at 45 to 61 a second. So neither the number of pixels, nor antialiasing, nor shadows is the cause, and the GPU-memory lead above is answered: it is not the drawing surface. What is left is in a played shift and not in a menu: the clock is the time the 3D scene has been drawn (the music, which also plays on the menu, has run 26 to 152 s when the page dies; the shift, 36 to 46 s), and one page that played a whole level 1 first died 36.6 s into the level 2 after it, sooner than the rest. The suspects left: the character models (skinned, their bones uploaded every frame; the lightest tier, which the iPad reached after the third crash, takes them out), the splashes, the tags over the swimmers (page elements whose text, classes and place are written every frame), the sound (Web Audio, which Safari only starts after a tap, so the hunt left alone above never had it), and the playtest's log (saved to the device's storage up to twice a second, up to 240 kB a time, and sent every few seconds). `?bisect=play` (with `&playtest`, to read it from here as it goes) hunts them with a person playing: each launch takes one out (`PLAY_PLAN` in `dist/bisect.mjs`: everything else on, then sound off, classic characters, no tags (`notags`), the log saved every 5 s and sent only after the shift (`nolog`), no splashes, then all of them), all at the graphics of the lightest crash so far (tier 2), and a note in a corner counts the seconds. A test passes when a shift has been played 62 s with the page in front; a page that dies in it is a crash, and the reopened page goes on to the next test; a shift that ends sooner, or a page sent to the background, counts nothing and the test is played again. The iPad's own record of a kill (Settings, Privacy & Security, Analytics & Improvements, Analytics Data: a `JetsamEvent` from the minute of a crash) would name the process that died and why, if the creator can find one. **Parked again on 13 October 2026**, at the creator's word: the game is for Steam, so it is tested as the desktop app, and an iPad plays that app streamed from the Mac with Steam Link (`desktop/README.md`, "On an iPad"; Help's **On-screen controls: On** shows the walk pad and the action buttons for the mouse clicks Steam Link sends). `?bisect=play` stays ready.

**Graphics that stay within the device (11 October 2026).** The creator kept playing on the iPad's Safari, and the game kept dying "after the cramp": 11 of the 13 launches the iPad sent from 5 to 7 October stopped in the middle of a shift, 23 to 64 s after the go (a live copy that stopped and was never sent again: `tools/crash-triage.mjs` read those as clean until now, and now calls a copy that stopped mid-shift more than ten minutes ago a crash), always with the frame rate down at 32 to 46 and never with an error. The cramp is there because it comes at about that time in levels 2 to 5, and from the moment it starts the frame rate drops by a third. Measured here in Chromium over the whole recorded shift: the script's heap stays at 9 to 11 MB and the page's DOM flat, so the script is not what grows. What the device itself has shown: a second drawing pass and nothing else (the hands layer) killed it about 45 s into a shift. So the cause taken to be most likely, **not proven on the device**, is the graphics working flat out at the iPad's 2322×1516 surface, four times multisampled. What the game does about it now (`dist/gfx.mjs`, `gfx-check.mjs`): on a touch device with WebKit it draws at most about 2 million pixels (1750×1143 on that iPad, 1.28 pixels a point instead of 1.7, about 57% of the pixels) and at most 60 frames a second (its menu ran at 108 to 111 on a 120 Hz screen). A governor watches the frames of a shift and, every two seconds under 45 fps, takes 15% off the resolution, down to 70% at most, and never back up in that page. On any device, a shift being drawn leaves a mark on the device (`pool-panic.gfx.v1`, not a save key: it stays on the device), taken away when the shift ends or the page is hidden or closed. A launch that finds the mark still there knows the last page died in a shift, goes down a tier and says so in a toast. The tiers are: no antialiasing and fewer pixels, then no shadows, then no splashes (since 15 October 2026 never the classic characters: the iPad had reached that tier and the creator saw the old swimmers in the week). A crash hunt or a trial is never counted and plays at tier 0, and `?gfx=reset` goes back to full graphics. The log says the tier and every step of the governor (`gfx` lines), so the next report says whether the crash went with them. Checked here: the plan, the tiers, the mark and the governor in `gfx-check.mjs`; in Chromium posing as the iPad (its user agent, five touch points), the boot line, a page killed mid-shift followed by a launch at tier 1 with the toast and without antialiasing, and `?gfx=reset`; on a desktop, the same pixel ratio as before. **Not verified:** that the iPad no longer dies, and the governor on a real device (the sandbox draws too slowly: every frame looks like a stall, which it ignores on purpose). Only the iPad's next playtests can say.

**The browser's pixels back (16 October 2026).** The creator asked for the pixel cut on the browser to go: "we have to make it work for browser, find a way". The iPad had died at every surface size it was given (12 October, down to 12 MB, without antialiasing or shadows), so the pixels were never shown to be the cause. Now every device draws at its quality's own pixel ratio (Standard: 1.7 a point, the iPad's whole 2322×1516 surface), the governor is off (`govern: false`), and a page that died in a shift no longer makes the next launch lighter (the mark is still kept, and the next launch's `gfx` line says the last page died). Kept: the 60 fps cap on a touch WebKit device. Two changes aimed at what is left on the leads list, neither proven to be the cause: the tags over the swimmers now write to the page only when their text, place or look changes, and measure their size only when their text changes (they had set every tag's style and read its size every frame, which makes the browser lay the page out again each frame); and the crash log saves at most every 2 s instead of every half second (5 s with `?nolog`). **Not verified:** that the iPad no longer dies. If it does, `?bisect=play&playtest` is the hunt for it.

**Graphics quality (11 October 2026).** Help opens with a **Graphics** row: **Auto** (the default: Standard, with the care for phones and tablets above), **Low** (no antialiasing, no shadows, one pixel a point), **Medium** (no antialiasing, 1.25 pixels a point, a 1024 shadow map), **Standard** (the game as it was: antialiasing, at most 1.7 pixels a point, a 2048 shadow map), and two above it: **High** (the screen's full sharpness up to 2 pixels a point, a 4096 shadow map, textures 8× sharper at an angle) and **Ultra** (supersampled: 1.5 times the screen's pixels, up to a 4K frame, a 4096 shadow map, 16× texture filtering, for strong graphics cards). The choice is kept in the settings (`pool-panic.settings.v1`, so the desktop app keeps it too) and takes a fresh start, at once on the menu or as soon as the shift is over (antialiasing is fixed when the drawing surface is made). A page that died in a shift still caps whatever is chosen (the tiers above), and the row says so with a **Back to full graphics** button. Checked: `gfx-check.mjs` (each level at least as sharp as the one before, Auto equal to Standard, a crash capping Ultra, the choice read safely), and in Chromium each choice picked from Help and read back from the renderer (Ultra drew a 960×600 page at 1440×900; High a 4096 shadow map and 8× filtering; Low no antialiasing or shadows). **Not verified:** how High and Ultra look and run on the creator's own graphics cards.

**On-screen controls (13 October 2026).** Below the Graphics row, Help has **On-screen controls**: **Auto** (the default: the walk pad and the Dash, Jump and Interact buttons show during a shift on a touch screen, `pointer: coarse`), **On** (they show whatever the pointer, and the panels make room as on a touch screen: for an iPad playing the desktop app through Steam Link, which sends its touches as mouse clicks) and **Off** (never). The choice is kept in the settings (`settings.touchpad`, `pool-panic.settings.v1`, which the desktop app saves), and is a class on the page (`touchpad-on`, `touchpad-off`; `dist/style.css`). Checked in Chromium with a mouse: with On the pad shows in a shift and holding ▶ walks the coach; with Auto it does not show.

**A second iPad report (October 3, 2026), not understood yet.** The game "broke" when opened in Safari on an iPad, with no report to read, and it has not been reproduced: there is no WebKit where the game is developed, only Chromium. What was checked instead: the merged build (Karen, the character models, the fish) plays 26 incident cases in Chromium without a page error, in the overview and the Coach Cam, in all four venues; the graphics and script memory it uses (the models add about 35 MB of textures and geometry) is far below what an iPad allows; and the source uses nothing newer than iPadOS 15.4 supports. Two changes were made on suspicion and cost nothing: the fonts are bundled (the Google Fonts `@import` could hold up the first paint when the network was slow or out), and `nomodels` was added to the hunt so it can rule the character models in or out. To find the cause the game needs a report from the device: **Copy report** in the crash dialog if it appears, else the **Copy results** of `?bisect` (open the game's address with `?bisect` on the end and let it run; it reloads itself between tests and carries on after a crash), and the iPad's iPadOS version.

**A third iPad report (October 4, 2026), not understood yet: the page dies after an incident.** The creator was playing (they did not note the level) and, after a cramp, took the life ring, jumped in, gave it to the swimmer and, when the swimmer got out of the pool, the app crashed; they said it crashes a lot after incidents. It has not been reproduced. What was checked instead, in Chromium (software WebGL): the whole rescue (the cramp, the ring from the wall, the dive, the swim, the handoff, the swimmer climbing out, walking to the bench and resting, the ring back on the deck, the swimmer going back in) played by a script through the game's own frame loop, in the overview and in the Coach Cam, without a page error, an error in the log, a stall or a frozen page; with the GPU really drawing every sixth frame, what the renderer holds stayed flat from the shift's first seconds to the end (27 programs, 239 geometries, 48 textures, the scene's nodes back to where they began once the particles had gone), so a rescue leaks nothing; and every event, particle and effect it sets off shares its geometry and materials. One real bug did turn up in that flow and is fixed: the coach climbs out of the water on the very side the swimmer walks to the bench by, and when he stood in the way a collision pushed the swimmer into the margin of the pool's keep-out box, where the guard against stepping into the water threw them 4.5 m back to the end of the pool, again and again, so they never reached the bench (`moveAlong` in `dist/sim.mjs`; `rescue-check.mjs` holds the coach in the way for the whole walk on levels 3 and 12). The fix is only for that swimmer on purpose: every other walker who is pushed into the same margin is still sent to the end of the pool as before, because changing that moves the whole game's balance (level 10's bot scores shift by thousands of points) and belongs to a tuning pass of its own. It is not a crash, though. So the cause is likelier on the device (memory or the GPU) than in the logic, and what was built is what finds it next time: the shift's diary and the scene's counts in the crash log, and **Send report** (see Crash log). After the next crash, open the game once more and tap Send (the dialog opens by itself at launch), then read out the device code the dialog shows.

### Playtest mode

`?playtest` on the address turns it on for that device (the device remembers: `pool-panic.playtest.v1`; `?playtest=off`, or **Turn playtest off** in its panel, ends it). It exists so that someone can play all twenty levels on a device with no console, on an iPad in Safari, and the developer can still see what every incident did, where a shift got stuck and what came just before a crash. Nothing in it exists for an ordinary player; it is `dist/playtest.mjs`, `dist/replay.mjs` and a section of `dist/app.mjs`.

- **A bug button.** 🐞 sits with the other buttons at the top right (on the map too). It pauses the shift and opens the panel: where the game is (level, clock, the incidents running), a row of kinds (stuck or frozen, looks wrong, unfair, confusing, slow or about to crash, other), a note (the keyboard's dictation works) and **Flag it and keep playing**. A flag keeps what the player said, its kind, the game's state at that moment and the last 14 lines of the diary, whole (the diary is a ring and moves on); it is sent at once, it is in the report under *Flagged by the player*, and it makes a launch worth sending even when nothing crashed. The panel also shows the device code (with **Copy code**), **Send the log now**, **Copy the report** and **Start the playtest notes over**.
- **The log is sent while the game runs.** A page that crashes cannot say anything, so a playtest sends the log again and again (`LiveSender`): every 20 seconds while something changed outside a shift, every 3 all through a shift being played (the countdown too: a *beat*, whether or not anything changed, so the last copy on the server says to within about three seconds when a page stopped; 1200 an hour of play against the 2400 replacements an hour the service takes for the whole site, `liveWant`), within 2 for a flag, a new error, a save or any incident moment and at a shift's start and end, doubling after each failure (up to two minutes), after the pause the service asks for, and once more when the page goes into the background; it never has two sends in flight and stops for good on a server with no report service (`npm start`). The service keeps one copy per launch and replaces it, so the stored data does not grow, and the copy on the server is seconds old when a page dies, and can be read while the shift is played. A playtest sends by itself without the box ticked (whoever turned it on is the one who reads it); the account, name and address rules of **Getting a report to the developer** are unchanged. A launch after a crash sends the crashed launch's final copy at once.
- **A longer, fuller diary.** The crash log's budget is 1000 breadcrumbs and 240 KB per launch (four launches kept) instead of 400 and 90 KB. Every incident module says where it stands through `describe(sim)` (a state that changes only when its stage does: the fish's `stage loose · kid crying · net wall · pool closed`, Karen's `stage ranting · ranting`, the outage's `stage dark · flashlight rack`, the dog's `stage loose · dog steal · carrying fins`, Carl's stage, step and cannonballs) and its numbers through `detail(sim)`; the diary writes a line each time the state changes (in a playtest every step, in an ordinary report only the stage). A new incident must have both, or its stages are not in the diary. The diary also says when the pool closes and reopens, when a lane is taken out of service or the storm begins, and where the fish net, the flashlight and the medical kit are whenever they move. **A state that has lasted 25 seconds of the shift's own clock** (a pause does not count) is written as `waiting …` with what the coach was doing, and again at 50, 100 and 200 seconds, so a stuck incident says what it is stuck in. Every 8 seconds, and every 2.5 while an incident or rescue runs, a `pulse` line gives the score, the coach, the crowd and each incident's `detail` (where the kid, the fish, the dog, Karen and Carl are, the fish's stamina, Karen's calm). Every shift starts with a `plan:` line (what the level has in store and when: `plan: fish@32s, outage@63s, twist@60s`), in every report, playtest or not.
- **A shift can be played again.** The recorder (`Recorder` in `dist/replay.mjs`) wraps the simulation's input methods (move, jump, dash, E, lanes, fetching, and an incident or cramp started from the panel) and keeps, for each shift, the level, the seed, the booking or drill, every input stamped with the tick it came before (movement as a number into a table of the nine or so vectors the controls make, so a 100-second shift is about 6 KB) and a hash of the simulation every five seconds. The newest shift's record is in the report under *Replay*, as one line of JSON. `node tools/replay.mjs <report.md> --diary` makes the same simulation, gives it the same inputs, checks every hash and prints the diary with every step (`--pulse` for the positions, `--until 74` to stop at a second, `--nth` to take an earlier shift). A shift played in Chromium with real keys and a trigger from the panel replays in Node with every checkpoint matching (`replay-check.mjs` does the same with a bot that gives every input). **Caveat:** two JavaScript engines may disagree about the last digit of a sine or a hypotenuse, so a shift recorded in Safari (JavaScriptCore) may drift from the replay in Node (V8) after a while; the replay says at which tick it did, and everything before is faithful.
- **What has been covered.** The notes (`Coverage`, kept on the device in `pool-panic.playtest.seen.v1` so they add up across reloads and crashes) count, for each level and drill, the runs and how many were finished, the best score, the incidents that began and the ones that were saved, every other event that is not routine (a dumped fish, a blackout, a crash) and the flags. They are in every report under *Playtest so far*, ending with the incidents never seen, and in the panel ("Seen so far / Not yet").
- **Make an incident happen now.** Cramp rescue, fish kid, loose dog, cannonball man, Karen and the power cut, in any level: each button says why it is not available (a rescue, a cleanup or another incident is going on, the pool is closed, nobody is swimming, the level is 1). It starts the incident the way the level's own plan would (`triggerChaos`, `startCramp`), writes `playtest trigger fish ok` in the log and is part of the recording. It changes the level being tested, which the log shows. A shift that does not plan the fish or Carl has not fetched their models as it began, so the panel fetches them first (the kid and the fish, the level's cannonball man; a few seconds at most) and the tester sees the models a player would, not the classic stand-ins. **Back to the map** (while a shift waits behind the panel) leaves the shift where it is for the map.
- **Reading it (the developer's side).** As for any report: `GET /api/report?device=<code>&latest=1` is the newest launch as Markdown (in a playtest that is the one being played, replaced every few seconds), the plain list of the device shows each launch's headline (`Playtest L7 · 2 flagged: fish kid froze · no errors`), and `tools/replay.mjs` reads the *Replay* out of the saved Markdown. The creator opens the game with `?playtest` once, reads out or copies the device code from the toast or the panel, plays, and taps 🐞 when something is wrong; a crash needs nothing more than opening the game again.
- **Checks.** `playtest-check.mjs` (the switch, the sender's timing, back-off and stopping, the notes), `replay-check.mjs` (recorded shifts of every kind replayed to the same state, a tampered record drifting, the command line), and the playtest parts of `crashlog-check.mjs`, `trace-check.mjs`, `report-send-check.mjs` and `report-check.mjs`. In Chromium (software WebGL, a fake report service): the panel at iPad size, flagging with a note, triggering an incident, the live copy's cadence (14, 9, 9, 9 seconds while an incident ran) and content, and every incident case of `all-incidents.mjs` run with `&playtest` without a page error. **Not verified:** iPad Safari (the panel's layout with the on-screen keyboard, the page going into the background, the log's writes on WebKit), the live copy against the real Netlify Function (it was driven against the check's in-memory store and a fake route), and replays recorded on WebKit.

### Crash watch (tried, then stopped)

On 4 October 2026 a scheduled Claude session was set up to read the creator's devices' crash reports and write them up (`docs/crash-watch.md` keeps the whole brief). It was **stopped on 5 October at the creator's request**: they would rather say when they are playing and sync the bugs live than pay for checks nobody needs (a run is paid for again in the whole conversation, which grows at every wake: about 10 to 40 cents a run, and rising). What stays, and is the way to work now: the game sends its crash log by itself in a playtest, the creator says when they are playing, and `tools/crash-triage.mjs` (`node tools/crash-triage.mjs CODE`: each launch of a device is a crash, an error, a stuck incident, a flag, a test of the crash hunt, or clean; what has been dealt with is named by a token such as `muu6aara97:c`, which `--issue 22` reads from the `handled:` lines, by the repo's owner, of the public log issue "Crash triage log") sorts what has come in. A tab killed 38 to 55 s after the go with no error is the known 45-second crash above and is only counted; a hunt run (`?bisect=shift`) is read together, with each test's outcome. The device code is per address (the preview, the public site and a desktop build each show their own). Checked on 4 October 2026: the session read the log and the real service, wrote a comment, pushed a branch and asked for a phone ping; the routine woke it by itself, in recreated containers too once the command made its own clone. Never checked: a real crash going through it (none arrived), and whether the phone buzzes. `crash-triage-check.mjs` reads reports made by the real crash log through a fake service.

**The logo (15 October 2026).** The creator's Pool Panic logo (yellow letters, navy outline, splashes), with its background taken out (fal's Bria background removal, run by the creator), cropped and kept as `dist/assets/brand/logo.webp` (640×371, 55 kB). It is the top bar's brand, top left on the map and in every shift (70 px high on a desktop, 44 on a phone), and in the top-left corner of every story scene. The week card on the map starts below it.

### The story and the Ocean Fund

Coach Waters wants to take Marina to the ocean and has to earn the trip. The very first launch opens with a short, skippable cinematic (four scenes, about 15 seconds, click / Enter / Space for the next scene, **Skip** or Esc to leave) before anything can be played. It is not shown again, but the 🌊 pill in the top bar (menu), Help → "Watch the story again", or `?story` replay it.

- **The fund.** Every finished shift (and drill) pays: $10 for finishing plus $30 per star, times the booking's payout (bookings are the "gigs": a riskier one pays more). Only pay beyond a shift's best counts, so replays cannot farm it and the fund never goes down. The trip costs $1,500; a full season at three stars covers it. The results show what the shift paid and the fund's bar, plus a text from Marina at 25, 50, 75 and 100%.
- **The ending.** Filling the fund earns a short beach cinematic; "Watch what happens" then appears on every results screen.
- **Stills (15 October 2026).** Every scene of the story and of Marina's week (the invite, the date, the rain check) shows a still from `dist/assets/story/` (`ART` in `dist/story.mjs`): eleven 16:9 pictures, about 680 kB together as WebP, made with GPT Image 2 (`fal-ai/gpt-image-2/edit`) from the creator's own pictures of Coach Waters, Marina, the swimmers and the swim club, so the characters are theirs. They are Coach Waters at his pool (whistle up, the swimmers in the lanes), Marina dreaming of the ocean over a postcard, his daydream of the two of them on a beach, the Date Fund jar, Marina's text on his phone (two swimmers peeking), Marina ready on Saturday night, the four dates (ice cream on the pier, movie night, dinner by the lagoon, the ocean trip) and the rain check (alone under an umbrella). The first week's invite opens with a prologue (Marina has never seen the ocean; his daydream) for context. A still drifts in slowly (not with reduced motion), the speech bubbles are drawn over it, the emoji layers stay in the data as the fallback (the four later dates, picnic to sailing, have no still yet and show them), and a video named in `VIDEOS` (`dist/marina.mjs`) still plays on top. The logo is in a corner of every scene. `dist/story.mjs` holds the rules and every scene as plain data, and `dist/cinematic.mjs` plays them. What was seen and earned is kept in `localStorage` (`pool-panic.story.v1`). `?debug` sessions skip the intro.
- **Checked by** `story-check.mjs`: pay, sanitised saves, the no-farming rule, Marina's texts once each, well-formed scenes, every still a file in `dist/` and every chapter's date with one, the prologue the first week's alone, and the player's next, skip, keys and auto-advance.

### The desktop app and Steam

`desktop/` is the Steam build: the same `dist/` in an Electron window (Chromium inside, so no browser quirks), served from the player's disk with no network. `desktop/README.md` says how to run it (`cd desktop && npm install && npm start`), pack it (`npm run pack:win`, `pack:mac`, `pack:linux`, each on its own system, as a folder Steam can patch file by file) and upload it with SteamCMD; `desktop/steam/checklist.md` is the whole road to a release, including what only the creator can do on Valve's side; `desktop/steam/achievements.md` is what to type into Steamworks for the achievements.

- **Not a fork.** Nothing in the simulation or the scenes knows about it. The game talks to the desktop app through `dist/platform.mjs` (`window.desktop`, which only exists there; every call is a no-op in a browser), and the Steam calls sit behind `desktop/steam.cjs`, a wrapper that cannot throw: no Steam client, no native module or an unknown achievement all end in "no", and the game plays the same without Steam.
- **Saves.** The game keeps progress in the browser's storage, which no cloud can sync. In the desktop app the preload script copies the player's keys (records, story, settings, achievements; never the crash log) to `saves/progress.json` when they change (written atomically, the previous file kept as `progress.previous.json`) and puts them back before the game starts. The file wins, so a newer one from Steam Cloud is used. The Auto-Cloud settings are in `desktop/README.md`.
- **Achievements.** `dist/achievements.mjs` holds fifteen, earned from the saves the simulation already reports (rescues, the fish, the dog, Carl, Karen, the breaker, first aid) and from stars and the Ocean Fund. They are kept on the device and shown as a toast in any browser; in the desktop app each is also unlocked in Steam. Steamworks needs each name entered by hand (`desktop/steam/achievements.md`).
- **The window.** Esc is the game's pause, which has a **Quit to desktop** button in the desktop app; F11 or Alt+Enter toggles full screen. The page has no Node (`sandbox`, `contextIsolation`), can reach only `app://game/`, links leave only to GitHub and Steam, and its Content-Security-Policy allows nothing from the network. If the window's process dies it is reloaded (so the game's own crash dialog can say what happened), at most three times a minute, then left alone with a message.
- **Test builds (5 October 2026).** The desktop app is what the creator tests on their own Mac and Windows PC, because Steam players run it and not a browser. `npm run pack:tester:win|mac|linux` make a **tester build**: the same packed folder with a `tester.json` beside the game, which turns playtest mode on and lets the app post the game's log to the report service (the sandboxed page cannot talk to anything but its own files, so the preload gives it `window.desktop.sendReport` and the main process posts the text, to a fixed https address, only for the game's own window, at most the service's own size limit; `dist/report-send.mjs` `canSend` and `bridgeFetch`, `desktop/lib.cjs` `readTester`). The Steam build (`pack:win|mac|linux`) has no such file and posts nothing: a flag or an environment variable can only make a tester build from the source folder, never from a packed app. `.github/workflows/desktop-test-build.yml` makes the three tester builds (Windows; macOS for Apple chips and Intel, signed ad hoc; Linux) on every push to `main` or a working branch that changes `dist/` or `desktop/`, and replaces one rolling pre-release, `desktop-latest`, with their zips; the creator downloads one there (`desktop/README.md`, "Test it on your Mac or Windows PC"). Run here, as far as this sandbox goes (a virtual screen, software drawing): from the source with `--tester` the game started in playtest mode and its log reached a fake report service on this machine every three to four seconds while a shift was played, while the page itself could not post (its Content-Security-Policy); a packed Linux tester build started as a tester build in playtest mode (with its network cut, so it posted nothing). The Windows and macOS builds, and what CI makes of them, are unverified until the first run.
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
| `node hunt-check.mjs` | The crash hunt: the URL switches (`nomodels` included), the plan, surviving the crashes it hunts (a test left running counts as a crash), verdicts, damaged saves; the shift plan (the numbers a test hands the switches, its unclear tests and its repeat); the played plan (one suspect out per test, a shift that ends too soon counting nothing) |
| `node achievements-check.mjs` | The fifteen achievements: what earns each, the saves that map to them, kept once and remembered, unknown names from a newer save ignored, every one named in `desktop/steam/achievements.md`, and the game's bridge doing nothing in a browser and passing calls on in the desktop app (a call that throws included) |
| `node desktop-check.mjs` | The desktop app without Electron (tester builds: the only build that posts, to a fixed address, never a packed Steam build; the CI that makes the test downloads, tester builds only and one job that writes): which file an `app://game/` address means (climbs, encoded slashes, backslashes, NUL bytes, other hosts and schemes refused), file types, what the save file may hold (the crash log never), which links may leave, where a window may reappear, the Steam wrapper against a fake `steamworks.js` (no module, no Steam, unknown names, a throwing call), and the settings that keep the window locked down and an upload from going live by itself |
| `node story-check.mjs` | The story: pay and payouts, sanitised saves, a fund that cannot be farmed, Marina's texts, well-formed scenes, the cinematic player against a fake dialog |
| `node trace-check.mjs` | The shift's diary: a whole cramp rescue read as a story (cramp, ring, dive, swim, handoff, climb, bench) from the real simulation, an ordinary shift quiet, looking changing nothing, events saying what they carry, every incident's stages in order (the short and the verbose diary, a `describe` that throws costing one line), a stage that goes on being said to be waiting at 25 and 50 seconds (a pause is not waiting), the pool, lane, storm and gear, the plan and the pulse, and the scene's footprint counting shared geometry once |
| `node playtest-check.mjs` | Playtest mode: the switch from the address and from the device, the live sender (gaps by reason, never two at once, back-off after failures, quiet when the service asks, stopped where there is no service, flush when the page goes) and the notes on levels played and incidents seen |
| `node week-check.mjs` | The run: six shifts Monday to Saturday and a Sunday date, six different pools a week drawn at random from all of them (any pool in any week and on any day, never one twice in a week, the first Monday at the Community Pool), the same incident able to come two shifts running, the Aquatic Centre's competitive crowd and Marco in every shift there, star targets scaled per pool, a difficulty that rises every shift (a gentle first minute, random levels from a rising band, the shifts past level 20 growing), more VIPs as the run goes on; the director gentle at first, bringing in only met incidents and the next in the order, never two surprises in a row, no two weeks alike, signs keeping their incident away, twists only where the pool allows; cards; a Date Fund that only goes up and that tips never touch; the pass mark, a failed shift paying nothing while the week goes on, the safety net, Saturday's game over, levels opening for free play; wishes that fit; the save (an old one starting a new run); perks in the simulation (and none changing nothing); the coach bot through three weeks; replays of a week's shift; Marina's scenes with and without video; the wiring |
| `node gfx-check.mjs` | The graphics plan: touch devices with WebKit told from the rest, the iPad at its full pixel ratio with a 60 fps cap and no governor, a desktop as it was, `?dpr` winning, the tiers (kept, unused but for the played hunt), the mark a page that died in a shift leaves (a hunt not counted, `?gfx=reset`, broken storage harmless), the governor going down only on slow frames and never on a hitch, and the game wired to it |
| `node crash-triage-check.mjs` | The crash watch's reader: reports made by the real crash log read as facts (the level, how long the shift had been played when the last word came with the time hidden left out, the final seconds), a live copy that stopped mid-shift read as a crash, the known 45-second crash told from another, errors, flags and stuck incidents with tokens, tokens handed back so nothing is looked at twice, a hunt read as one run, a failing service said and never read as nothing new, the digest naming a device by two characters |
| `node replay-check.mjs` | Recording a shift: levels of every kind, a booking, a drill, incidents and a cramp started by hand, played by a bot that gives every input and replayed to the very same state at every checkpoint; only outermost inputs recorded; a tampered record saying where it drifts; the record in the crash log and read back from a report; the command line |
| `node music-check.mjs` | The disco song: on the dance's beat (a bar per clip), its parts in order (intro, groove, hook, breakdown, build) for a two-minute shift, four on the floor (none in the breakdown), claps on two and four, the build's roll speeding up, the bass on the bar's root, the hook in its bars, every note in A minor, the alarm when the pool is in trouble; the Kids Pool's song (132 BPM, C major, a boom on one and three and a chick on two and four, the oom-pah bass on the root and fifth, the tune and the runs, every voice heard, the player switching songs from the top); the player silent in the countdown, the first kick on the go and every kick on a beat, nothing twice after a pause and back on the clock, quiet in a power cut and back with the lights, and the usual music before and after |
| `node harbourside-check.mjs` | The Harbourside: its files there and within budget (the model under 10 MB and 260k triangles, the pictures under 2 MB, every picture used, the textured meshes keeping their UVs), the classic pool until it is in, then the same hit boxes and labels as the classic pool, the fins going as they are rented, the doors swinging, the near wall for the Coach Cam only, fewer draw calls than the classic pool |
| `node senior-check.mjs` | Senior Aqua Fit: its floor plan (four lanes, no blocks, glass doors in the back wall, no lockers, a roomy lounge all on the deck, every station reachable), its models, pictures and tea dance shipped (swung eighths, a walking bass); only seniors (and Marco) in four looks, a third in wheelchairs, the same for the same shift and the shift's own numbers unmoved; a slow walk in and a crowd through the doorway; up out of the wheelchair when given a lane (a moment on the spot), the chair parked and its lounge spot kept, back to it on the way out, down into it where it was left and out through the doors; lower star targets and the bot through a shift; every clip on each senior; and on screen (headless) the roof in the Coach Cam only, the glass doors swinging, a chair under each senior, parked and empty, gone with them |
| `node wave-check.mjs` | The Wave Pool: a beach sloping into a pool a metre deep at the shelf and deep at the wave house, the gate to the beach without wading, every station reached; waves sent by a program (the horn, a set, a calm), faster in the deep, growing in the shallows and breaking further out the bigger they are, gone up the sand, the same for a seed; guests who walk in through the gate and straight into the waves to a depth that suits them, nobody sent anywhere; tubes handed over on the way in, a VIP who grumbles without one, tubes left on the sand and every one accounted for; dizziness from the waves (the timid most, a tube least), a dizzy bather helped out to a towel and back in; a knockout rescued with the machine stopped; the WAVES button (awww, the grace, the chant, the horn, the monster called off); tubes knocked off by a monster and washed ashore; drips on the deck past the sand; a poo, the fish and a blackout; whole shifts played by the bot; in every week's draw with its song, stings and props; and on screen (headless) the water moved by the crests, bathers riding them, stars and a floating tube |
| `node dive-check.mjs` | The Jumping Pool: its plan (three heights in green, yellow and red, six boards over the water with their stairs and lines on open deck, four ladders, the hot tub's six seats, two massage beds a coach can work at and a guest can reach from every ladder); the odds (the right height rarely wipes out, one too high 40%, a beginner on HIGH most of the time, more so later; only the frightened chicken out; a higher board pays more, a Pro on LOW a fraction and cross); a dive through its stages, its flight under gravity, every jump drawn anew; a beginner on HIGH frozen at the edge, a wipeout as the cramp's rescue, the next diver waiting for the water, the coach's ring; a Pro bored on the springboard and a Pro's clean HIGH dive; a closed height refused, two boards a height, full lines; a show-off checked; a cutter sent back; the hot tub (its guests only, its own poo); no sick, finned or cramping divers; Carl and the leopard man diving; in the week (the ladder's last, its card, song, big moment, skips); whole shifts by the bot, the same seed twice |
| `node onsen-check.mjs` | The Mountain Hot Springs: four springs (5, 4, 5 and 3 seats) with steps on the rim, seats in the water, walks round the boulders; the cold in the queue and how it bites, warming up in the water; SPRING 1–4 (walk, step down, wade, sit, soak, out by the steps), a full spring refusing, a settled guest staying put, a late soak cut to fit; snow monkeys out of the forest, shooed on the deck (+40), in the water (−50) panicking the guests until shooed out from the rim (+25) or by wading, more of them later, never two for a spring, seeded; the coach skating and sliding on the ice against the club's grip, wading in a spring; every incident met in a spring (the fish caught in one, a floater skimmed from the rim and the springs reopened); whole shifts from the week played by the bot; in the week with its stars, song, stings, saves, props and pictures; and on screen (headless) the springs' highlights and clicks, the water's uniforms, a guest to the shoulders, the cold hug, a monkey to its chin |
| `node cruise-check.mjs` | The Cruise Ship: the pool across the deck (two lanes, free water past the rope), 24 loungers whose guests step up from the deck, walks round everything, the lobbies at the left end; half the guests chill, half swim, Marco swims; the roll seeded and never a rhythm (calm spells, swells to both sides at uneven times, the big ones announced, rougher later in a run); the coach and the loungers sliding downhill (still in a gentle lean, stopped at the row's end, never overlapping), adrift, straightened for points; a guest at the pool's end sliding in, helped out for points or climbing out furious and dripping; the slosh spilling onto the deck; swimmers quicker downhill; whole shifts from the week played by the bot; the same seed the same shift; in the week's draw with its stars, song, sting, save, props and pictures; and on screen (headless) the deck tipping while the sea stays level, the water standing up at the low end, the tags tipping with the deck |
| `node rooftop-check.mjs` | The Rooftop Pool: the lifts facing each other from the two ends, the infinity edge with its gutter and rail and no deck past it, fourteen beds and two cabanas reachable from the deck, walks round the furniture, every station within reach, the coach wading in (never into the gutter); guests from both lifts to what their plan says, nobody queued or sent, chat groups, a VIP in a cabana; margaritas ordered, a tray of three, served for a tip, two making a guest tipsy, the empty tray gone; messy sunbeds nobody takes, a guest waiting for one, tidied; the selfie at the edge talked down, or over into the gutter and hauled back, or left to storm off; the DJ's drops on the music's bars, announced, dancing, the water slopped onto the deck, a poser thrown over; closing time; a poo, the fish and Carl on the roof, the same shift for a seed; whole shifts played by the bot; in every week's draw with more VIPs, no Marco, its stars, its house set, stings, saves, props and pictures; and on screen (headless) the roof and the city 185 m down, guests chest-deep and lying down, the towels, the coach wading |
| `node river-check.mjs` | The Lazy River: a curving river with its mouths in the walls (only a stretch seen), places read back from where they are, the bridge and two stepping stones walkable and the rest water; both banks joined by the bridge and every station reached without wading; a guest who wants a tube, sits into it at the dock, floats with the current, goes round the loop out of sight, gets off at the exit dock and leaves the tube at the return, every tube accounted for; the coach landing on a stone at a run, falling short into the river, carried by the current and climbing out; a wipeout rescued with the pumps stopped; a poo and a wee cleaned from the banks; out of the water by the temple; a shift played by the bot; in every week's draw with its own stars; its calypso; the tube clips on every rider; and on screen (headless) the flowing water, the river as the lane, the rack's tubes, a rider boarding, floating and gone round the loop |
| `node kids-check.mjs` | The Kids Pool: its floor plan (three open zones, a gate, no lockers, its toys and song, every station reachable), only kids each in a look of their own, kids running all over the deck (never into the water or a bench) on a stream of their own, one POOL button to the emptiest part, chaotic paddling inside the walls and out when their time is up, a packed pool past ten (room for the party while it is on), a kid's points by their mood and the bot waiting for room, no Marco, more wees, its star targets, and the bot through a shift |
| `node progress-check.mjs` | A run worth repeating (Phase 2): the pool ladder (three to start, one more with every date, the arena the finale), the week's draw from the pools open (a new pool at once, never two days running, kept in the save), difficulty by week and the smoothed levels, the first visit at the band's foot, the season finale, one money (perks out of the Date Fund, the tip jar and sponsors into it, Marina's texts once), the coach's gear by stars, what a run leaves and what a game over keeps, an older save carried over, the album's stills and scenes, the ending and its credits, and the screens wired |
| `node phase3-check.mjs` | Depth and feel (Phase 3): the happy streak's tiers (to ×2.5), saves and tips feeding it, its breaks with who broke it and the guest putting it at risk; coaching tips (asked once a workout from their own stream, the coach's E at the lane's end, faster and happier, lapsing); the big moment (scheduled at about two thirds of a shift, never too near either end, one kind for each pool, announced, graded and stamped, waiting for a rescue); the race played start to finish (the lane kept clear, the whistle, the starter going alone, the pile-up); the Lazy River's two ways round (the rapids quicker, loved by thrill-seekers, a chiller's wipeout, too many at once); the rooftop's seating (wishes, verdicts, the cabanas, a VIP's tip in one); and a highlight played from a shift's real record, matching it tick for tick |
| `node onboarding-check.mjs` | The first ten minutes: a card and an easier first visit for every new pool (never the first Monday), the pools seen and the tutorial kept in the save; the guided first shift played through by a script (select, lane, fins with their marker and metres on the rack then the guest, lane, mop, well done, then quiet; no fins marker outside the tutorial) and only with `config.tutorial` on; skipping; the lane verdicts; one meaning per key; the main screen without the old map and the one-card start; the calmer HUD |
| `node wet-check.mjs` | Wet spots and the mop: a bucket in every pool, one in five swimmers climbing out dripping a spot (its own random stream), a spot that never dries, a slip and lost points for a guest, the coach down for 1.3 s when he steps in one (not again on his way off it; a jump clears it), the mop grabbed, used and put back (E or Q), spots that merge, and the bot mopping in every pool |
| `node pee-check.mjs` | The wee: a third of sick guests (half at the Kids Pool), the 🚽 warning and its prevention, a missed one turning the water yellow, emptying the pool and costing as much as a poo, cleared with chlorine alone; a poo still a poo |
| `node disco-check.mjs` | The Aqua Disco: its floor plan (four zones, no blocks, a stage past the pool, no locker rooms but one door in the back wall that guests and a dog come in and leave by, every station, fixture and queue spot reachable), a class of aqua dancers whatever the level wrote (Marco and the VIPs too, Marco's toast a dancer's), rows down a zone facing the stage with the front row by it, four to a zone comfortable and six packed (moods fall, one toast, in zones), zones not lanes in toasts and stings, the dance routine |
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

## The Godot test (27 October 2026)

`godot/` is a separate experiment, not the game: a Godot 4.7 project that rebuilds **one venue** (the Community Pool) with **Coach
Waters** and **one shift, no menu**, so the creator can judge how Pool Panic feels and looks in Godot against this three.js game. It
reads its layout, tuning and guest list from JSON exported from `dist/` by `godot/tools/export-data.mjs` (so both games use the same
numbers), copies its models from `dist/assets/`, and is checked and exported for Windows, macOS and Linux by
`.github/workflows/godot-test-build.yml` onto its own rolling release, `godot-latest`. Nothing in `dist/`, `desktop/` or the checks
depends on it. `godot/README.md` is its brief and plan; `godot/docs/` hold the coach, the gameplay and the venue as this game has them.
Its venue is dressed as the Harbourside Community Swim Club, every asset made in Blender by `godot/tools/blender/` and lit in Godot
(`godot/docs/look.md`).

**On the web site, a choice first (27 October 2026).** The creator asked to test the Godot venue on Netlify without taking the game
down: "a previous screen, choosing which one do we want to load". The same workflow also exports a **web build** (WebGL 2, Godot's
Compatibility renderer, lighter textures: `godot/README.md`, "The web build") onto `godot-latest`. The Netlify build, after the checks,
fetches it into `dist/godot/` (`tools/fetch-godot-web.mjs`: it waits a few minutes for the build of this commit's `godot/` tree, then
takes what is there, and never fails the deploy) and writes `dist/godot-web.mjs`. When that says a build is there, the game's page
first shows two cards (`dist/engine-pick.mjs`, imported first by `app.mjs`, which waits for it): **Pool Panic** (the game, which then
starts in place) and **Harbourside Community Pool** (opens `/godot/`, whose corner link comes back). It is never shown in the desktop
app (a checkout's `godot-web.mjs` is `null`), with anything after the `?` in the address (`?playtest`, `?dev=1`, `?bisect`… go straight
into the game) or on a reload after choosing the game; the boot watchdog waits while it is open (`engine-pick-check.mjs`).

## Scope and future work

The implemented prototype is single-player, with twenty finite shifts across four venues (drawn on a two-act campaign map), five swimmer types plus VIP guests, three or five lanes, local progression, equipment errands, chemistry, deck/lane collisions, cramps, lost goggles, stomach emergencies, four chaos incidents, five mid-shift twists (one of them a storm) and the resort trampoline.

Levels beyond twenty, further venues, families, local (couch) multiplayer, accounts and network leaderboards are **outside the current prototype**, not promised features; the map has no slot for a third act. The release target is **Steam, single player first, as a paid game** (see [The goal](#the-goal-a-paid-game-on-steam)); the price, the launch date, a demo and any platform beyond Steam and the browser have not been decided, and those are the creator's to set.

Future design should deepen readable interactions and the one-more-shift feeling. Add an incident only when its warning, response, recovery, timing, and interaction with existing incidents are understandable. The incident-frequency question has an agreed direction (spontaneous draws, in `docs/incidents.md`) but no formula yet: it follows the creator's ranking, so do not invent one or expand scope based on guesses about past conversations.

## Working agreement for future agents

1. Read this brief, the actual affected modules, and relevant checks. Distinguish implemented behavior, historical requests, and your own proposals.
2. Confirm you have the full Site source. Verify that the checkout includes `dist/` and the supporting checks. Preserve the existing Site identity when editing or publishing.
3. Preserve established layout, controls, inventory conservation, local records, and incident timing unless the requested change explicitly alters them.
4. Update coordinates, meshes, hit targets, routes, and collision proxies together when moving equipment or architecture.
5. Preserve continuous physical movement and swimmer identity, lane, equipment ownership, and unfinished workout through recovery.
6. Keep simulation state authoritative. Bobbing and other cosmetic motion must not move frozen gameplay positions.
7. Use the smallest coherent change; do not add a framework, backend, another multiplayer system (co-op is `dist/net.mjs` over Steam), or unrelated redesign as routine cleanup.
8. Verify the concrete risk with relevant existing checks; for visual changes, distinguish CPU evidence from an actual browser pass.
9. Update this README when behavior or vision changes. Record what changed and any material verification limits.
10. Be explicit about where changes were saved: Site source and GitHub are separate unless a synchronization workflow is deliberately established.
11. Know the stage (see [The goal](#the-goal-a-paid-game-on-steam)): systems and the loop come first, the look comes last. Keep `dist/` free of anything that needs Steam or Electron; the desktop app and the Steam calls live in `desktop/` and behind `dist/platform.mjs`.
12. Read `CLAUDE.md` for how the creator works with agents, and keep it true when the way of working changes.

### Prior implementation references

Earlier work consulted Game Director, Gameplay Systems, Game UI Designer, and Graphics Builder guidance from https://github.com/majidmanzarpour/threejs-game-skills at revision `e5f301d548bb18c530afbece78cd25082f4cda9c`. This records provenance, not an installed dependency or a requirement to import a new framework. The current repository and creator's direction remain authoritative.
