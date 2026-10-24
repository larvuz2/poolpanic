# Incidents: what exists, how a shift picks them, and the plan to make every shift different

Written October 3, 2026, from the code (`dist/sim.mjs`, `dist/chaos.mjs`, `dist/incidents/`, `dist/bookings.mjs`). Parts 1 to 3 are how the game
works today. Part 4 is a **proposal, not built**: it waits for the creator's ranking of the list below (the ranking page, "Pool Panic
Incidents", is an Artifact; its saved ranking is what Claude reads next).

The goal behind it: the game has to be **spontaneous**. The same level played twice should not play the same, and a level 1 may bring one
small incident or none. Levels and maps still decide what *can* happen (some incidents belong to some venues), but the player should never be
able to memorise a level. That is most of what makes "one more shift" work, and "one more shift" is what sells the game (see `CLAUDE.md`).

## 1. How a shift picks its incidents today

Nothing in a shift is random except what is rolled from the **shift's seed**: `runSeed = Date.now()` in `dist/app.mjs` when a shift starts, handed to
`PoolSimulation`. A second random stream, `chaosRandom()`, keeps the incident plan from changing who arrives (so a shift's swimmers are the same
with or without incidents). What that seed decides, and what it does not:

| Part of a shift | Random each play? | How it works |
| --- | --- | --- |
| **Roaming incidents** (fish kid, dog, Carl, outage, Karen) | **Partly** | `SHIFTS[level].chaos` is a list of *slots*, each `{ kinds, window }`. Each slot gets **one** kind, picked from `kinds` at random, at a random second inside `window` (`planChaos()` in `dist/chaos.mjs`). A slot with one kind is fixed. |
| **How many** roaming incidents | **No** | The number of slots is written in the level. L1 to L3 have none, L4 has two, L10 has three, L20 has four. `maxChaos` (1, or 2 on the legend levels) caps how many run together; none start in the last 14 seconds. |
| **Mid-shift twists** (rush, lane closed, swim team, aqua class, storm) | **No** | Written per level: `twist: [{ kind, at }]`, `at` is a fraction of the shift. |
| **Cramps, tummy trouble, lost goggles, dropped fins** | **Yes, per swimmer** | Rolled for each arriving swimmer: about 1 in 4 is cramp-prone from level 2, a swimmer in five can be sick from level 3, a collision drops goggles about 1 time in 4, fins by `finChance`. These already differ every play. |
| **Daredevils** (the trampoline) | **No** | `daredevilAt` lists which arrivals are daredevils, per level (3 to 5 from level 11). |
| **VIP guests** | **No** | `vipAt` lists which arrivals, levels 17 to 20. |
| **Bookings** (levels 11 to 20) | **Chosen by the player** | Three offers before each shift: Regular plus two from a seeded shuffle (the same shift always offers the same three). A booking adds fixed trouble for a bigger payout. |
| **First sightings** | **No** | A level's `intro` names the incident it teaches (L4 dog, L5 fish, L6 Carl, L7 outage, L11 trampoline, L17 VIP); the first time it ever appears the sting is longer. |

So today the *kind* varies only in the "choice" slots (levels 8 to 10, 12 to 20), the *timing* varies inside each window, and everything else about
the shift's incident plan is the same every time. The levels where one thing is certain: L4 dog and Karen, L5 fish kid, L6 Carl, L7 outage, L12
fish kid, L13 Carl and dog, L14 outage, L17 Carl, L19 outage.

## 2. The catalogue

Nineteen entries in four groups (thirteen incidents proper and six whole-shift changes). Where there is a warning window the coach can use it to
prevent the incident; otherwise the recovery is the coach's job. The points are from the code.

### In the pool: trouble for the swimmers in the water, or for the water itself

| Incident | Levels | What happens |
| --- | --- | --- |
| 🆘 **Cramp** | 2 and up, about 1 swimmer in 4 (more at Senior Aqua Fit) | The lanes freeze, a ring icon marks the victim. Take a wall ring, dive in, swim it to them, climb out, hang the ring back. Slow: the lanes stay frozen while the queue loses patience. Spaced out since 19 October 2026: none within 30 s of the last, at most one per 50 s of shift (`rescue.mjs`). |
| 💩 **Tummy trouble** | 3 and up, a few a shift (more at the Kids Pool: `sickRate`) | A 10-second meter over a swimmer. Send them to the locker in time (a bonus; sending a healthy one home costs points). Missed: a mess floats in the water, everyone evacuates and panics, the streak breaks and the clock holds until skimmer, bin and chlorine are done. |
| 🚽 **A wee** (16 October 2026) | 3 and up, a third of the tummy troubles (half at the Kids Pool) | The same mechanic as the poo with a 🚽 tag: send them home in time. Missed: a yellow cloud spreads and the whole pool turns yellow, everyone out, −500, and the clock holds; nothing to scoop, chlorine alone clears it (one dose or two), then the water settles and the pool opens. |
| 💢 **Collisions and lost goggles** | any level; goggles from 2 | A fast swimmer stuck behind a slow one collides (−50, happiness drops). About 1 in 4 loses goggles; carry them back to their owner. Prevented by lane choice and lane moves. |
| 👁️ **Sore eyes** | every level | Too much chlorine (the target band is 40 to 65) gives red eyes and costs happiness; fetch eye relief. Dirty water costs happiness too. |

**At the Lazy River** (17 October 2026) the same incidents come, in the river's own terms: the cramp is a guest who **flips off their
tube** (the pumps stop and the whole river holds until they are ringed and out; they get back on after a rest), a poo or a wee empties the
river onto both banks (skimmed and dosed from a bank), sore eyes hold a rider at the near bank until the coach brings relief, and two tubes
that bump only slow and spin (no collision penalty). The coach can also **fall in** himself, jumping short of a stepping stone: a splash, a
swim with the current, a climb out onto a bank or a stone.

**At the Wave Pool** (17 October 2026) the venue brings trouble of its own, on top of every incident: **dizziness** (every crest jolts
every bather it passes, hardest where the waves break; a dizzy bather 💫 staggers for the beach: help them out from the water's
edge, hand them a tube, or stop the waves), and **the knockout**, its failure: a crest that hits a bather already dizzy knocks them
under (−150 and the cramp's rescue, the machine stopped). **The monster wave** (from level 5) is announced by a siren four seconds
before it leaves the wave house: stopping the machine in time calls it off. Stopping the waves costs the crowd's patience instead
(an "awww", then their mood drains and they chant for waves). Cramps are fewer (the waves bring rescues of their own), a poo, a wee
or the fish empties the pool up the beach, sore eyes bring a bather into the shallows to wait for the coach, two bathers jolted
side by side bump heads (a little dizzier and crosser, no penalty), and more bathers coming out drip a wet spot on the deck past
the sand.

**At the Rooftop Pool** (17 October 2026) nobody swims, so the trouble is the party's (`dist/rooftop.mjs`): **the selfie at the
edge** 📸 (from level 2; a tipsy guest most of all wades to the infinity edge, climbs up and leans out with a phone: the warning is
the climb, the prevention window the seconds of posing, in which the coach wades over and talks them down; the failure is **over
the edge**, −150, SPLOOSH into the catch gutter; the recovery is hauling them back over, E, before they storm off by the service
stairs after 18 s). **Margaritas** 🍹 kept waiting make a guest cross, two make one tipsy 🥴; **messy sunbeds** 🛏️ keep the next
guest waiting for a bed. **The DJ's drop**, announced four bars ahead, splashes the water over the near edge (wet spots to mop) and
throws anyone up on the edge straight over. Every incident still comes: cramps, a poo or a wee (everybody out over the near edge),
the fish kid, the cannonball man, the dog, Karen and the power cut; no twist that needs lanes, and no Marco (nobody swims). Nearly
one guest in three climbing out drips a wet spot (`wetChance` 0.3).

**On the Cruise Ship** (18 October 2026) the trouble is the sea's (`dist/ship.mjs`): the ship rolls, never in a rhythm, and a big
swell is announced 2.6 s ahead (the ship's bell, the foghorn, a banner, the SHIP gauge). **Into the pool** 🌊: someone on the coping
at the end of the pool when a big lean slides them that way goes in (the warning is the bell and the gauge, the prevention window
the seconds before the lean, in which the coach keeps people off the ends; the failure is the splash, −40; the recovery is helping
them out at the edge, E, +40, before they climb out by themselves after 10 s, furious and dripping). **Loungers adrift** 🛏️: in a
lean past 5.5° the loungers slide along their rows and pile up at the low end; nobody takes one out of its place and a guest lying
on one minds; the coach straightens the row (E). **The slosh**: in a big lean the pool slops over its low end, a wet spot to mop.
Every incident still comes, Marco too (he has the lanes); half the guests chill in the free half or on a lounger and order
margaritas, as on the roof.

**At the Mountain Hot Springs** (18 October 2026) the trouble is the cold and the snow monkeys (`dist/onsen.mjs`). **The cold** 🥶:
a guest waiting in the snow grows colder by the second and, past a third of the way, hugs themselves and grumbles fast (the warning
is the hug and the ❄️ on their card, the prevention window the seconds before it bites, the failure their mood running out, the
recovery a spring: SPRING 1–4, where they warm up). **A snow monkey** 🐒: one comes out of the forest and makes for a spring on all
fours (the warning is the monkey itself, its alert and a sting; the prevention window its walk there, in which the coach runs into
it, +40; the failure is the hop in, −50, and everyone in that spring panicking, their mood falling fast; the recovery is shooing it
out from the rim, E, or wading up to it, +25). The coach slides on the ice. Every incident still comes, in the springs (the fish kid
tips his fish into one, the cannonball man bombs into one, a floater closes them all), Marco too (for a soak).

**At the Jumping Pool** (24 October 2026) the trouble is the height (`dist/dive.mjs`). **A wipeout** 💥: a diver sent higher than
their skill freezes at the edge (the warning: the 😰 at the send, the shaking at the edge, the tag's skill against the board's
colour; the prevention window is the send itself, and a guest walking to a line or standing in one can still be sent lower); one
height too high wipes out 40% of the time and a beginner on HIGH 70%; the failure is a tumble and a huge splash, −150 off MID, −220
off HIGH; the recovery is the cramp's: a ring to the diver in the water, the ladder, then a massage bed or home. A frightened diver
may **chicken out** instead (−60, they climb down and go home). **Too low** is no incident but costs: a bored pencil jump, a fraction
of the points and a cross guest. **A show-off** 😎 (from level 4) says Pro and is mostly a beginner: E beside them checks. **A
line-cutter** 😤 (from level 5, the `line-cut` incident): the last in a line pushes to its front and argues (the warning: the
alert and the sting; the window: 7 s of arguing; the failure: they go first and the line is crosser; the recovery: E beside them,
back of the line, +40). **A blocked landing**: a diver waits at the edge until the water below is clear (the 🤸 alert), crosser by
the second, and jumps anyway after 11 s. **No chlorine, poo or vomit in the diving pool**: tummy trouble comes only to the hot tub's
own guests and closes the tub, as in the springs. Carl and the leopard man come as divers, not incidents (no Carl, fish kid or dog
incident here); Karen, the blackout, wet spots and the massage (two beds) still come, Marco too (he dives).

### Starts on the deck, ends in the pool

| Incident | Levels | What happens |
| --- | --- | --- |
| 🐟 **Fish kid** | 5, 8 to 10, 12, 14 to 20 (Kids' party booking) | A kid with a bucket and a huge fish dodges once. Catch him on the deck and press E (+100). Missed: the fish goes in (−200), everyone leaps out and panics, the pool closes. Net it (+75), hand it back (+50). |
| 💣 **Cannonball man** (Carl, or the leopard man on alternate levels) | 6, 8 to 10, 13 to 20 (Stag party booking) | Red-card him on dry land (+100). Missed: each cannonball costs 60, stalls swimmers, throws goggles and floods the edge; the crowd panics while he swims. Red-card him once he is out (+150). |
| 🤸 **Daredevil** | 11 to 20, the three Splash Park venues | He waits at the tower; lane 5 closes and glows. Empty it before he jumps (+250 for a clean flip). Missed: a crash, up to two swimmers hit (−300), the pool freezes. A life ring per victim, then the medical kit (+50 each). |

### On the deck and in the building: trouble that stays out of the water

| Incident | Levels | What happens |
| --- | --- | --- |
| 🐶 **Loose dog** | 4, 8 to 10, 13, 15 to 20 (Kids' party booking) | Steals fins, bowls people over, shakes out puddles. Fetch the treats and lead it to a locker door (+150). |
| 😡 **Karen** | 4 only, 74 to 94 s in | Storms out of a locker door at the coach. Everyone within 3.3 m stops, covers their ears and loses 20 points (once each). Hold E beside her for 8 seconds (5 with two coaches, 3 with three) (+100, +50 if nobody was annoyed). |
| 💆 **Massage** (23 October 2026) | only the pools with a massage table: the Sunset Lagoon, the Aquatic Centre, Senior Aqua Fit and the Grand Gala Arena; the director draws it there in about one shift in three, from the first shift (`VENUE_INCIDENTS` in `dist/week.mjs`) | The next swimmer to climb out walks to the table and lies down on it, face down, and their patience starts to run out: 24 seconds, a bar on their tag, red near the end, when they lift their head and drum their feet. Hold E at the table until the wheel fills (8 seconds alone, 5 with two coaches, 3 with three, as with Karen; each coach steps to a place of their own at the table and works the back, the Massage clip): +120, +80 more for a VIP, and they float off home. Let go and the wheel drains; the patience runs only while nobody is on it. Run out: they storm off (−100, −200 for a VIP, the streak breaks). `dist/incidents/massage.mjs`, the table and the pose `dist/scene/massage-view.mjs`. |
| ⚡ **Power outage** | 7 to 10, 14 to 16, 18 to 20 (Night swim booking) | 7 seconds of flicker; reset the fuse box in time (+100). Missed: a blackout (−100), swimmers bump into each other. Flashlight, then breakers (+100). |
| 💧 **Wet spots** (16 October 2026) | every level, every pool | One swimmer in five climbing out drips a wet spot by the ladder, and it never dries. Whoever walks or runs over it slips, is cross (−12 mood) and costs 25. Grab the mop from its bucket (Q or E), mop the spot (E, +10), put the mop back. A chore, not counted among a shift's incidents; at the Kids Pool, where kids run everywhere, it bites hardest. |
| 🦶 **Slips: fins and puddles** | every level; puddles from the dog, Carl and the storm | Anyone who steps on a dropped fin or a puddle falls on their back and gets up; a swimmer loses 6 happiness. Jump them or pick up the fins. Puddles dry in about 14 seconds. |

### Changes to the whole shift: not one event, a new condition

| Change | Levels | What it does |
| --- | --- | --- |
| 🚌 **Rush hour** | 2, 12, 16, 18 to 20 (Tour group booking) | A crowd arrives at once, woven into the arrivals still to come. |
| 🚧 **Lane closed** | 8, 10, 14, 15, 20 | Lane 2 is out of service for the rest of the shift. |
| 💦 **Aqua class** | 5 | Later arrivals become slow in-place aqua swimmers who clog lanes. |
| 🏅 **Swim team** | 10, 15, 16, 18 to 20 | Most later arrivals are fast Pros who need room. |
| ⛈️ **Storm** | 19 and the Storm drill | Rain, thunder and lightning; from 70% of the storm, rain puddles form on the deck. |
| 👑 **VIP guest** | 17 to 20 | A gold-suited lap swimmer: +150 when served, −300 if they storm out. |

The same list, simply: **inside the pool** are cramp, tummy trouble, collisions and lost goggles, sore eyes, and the *aftermath* of the fish kid,
the cannonball man and the daredevil. **Outside the pool** are the dog, Karen, the outage, slips, and the *start* of those three.

## 3. Level by level (what a level has today)

Roaming slots show `kinds @ window in seconds`; a slash means the game picks one. `dd` is the number of daredevils.

| Level | Venue | Roaming slots | Twists | dd |
| --- | --- | --- | --- | --- |
| 1 Morning dip | club | none | none | 0 |
| 2 Lunch rush | club | none | rush 50% | 0 |
| 3 Peak panic | club | none | none | 0 |
| 4 Fin club | club | dog 34–52, Karen 74–94 | none | 0 |
| 5 Aqua hour | club | fish 35–60 | aqua class 50% | 0 |
| 6 Fast company | club | Carl 35–60 | none | 0 |
| 7 Mixed company | club | outage 45–75 | none | 0 |
| 8 The relay | club | dog/fish 28–50, Carl/outage 72–96 | lane closed 50% | 0 |
| 9 Championship day | club | fish/dog 24–42, Carl/outage 58–80, dog/fish/Carl 96–118 | none | 0 |
| 10 Pool legend | club | fish/Carl 20–36, outage/dog 44–66, any of four 84–110 | team 40%, closed 68% | 0 |
| 11 Splash landing | Splash Park, day | none | none | 3 |
| 12 Flip Friday | Splash Park, day | fish 40–62 | rush 50% | 4 |
| 13 Beach party | Splash Park, sunset | Carl 28–46, dog 76–98 | none | 3 |
| 14 Moonlight swim | Splash Park, night | outage 36–56, fish/Carl 88–110 | closed 50% | 4 |
| 15 Lantern night | Splash Park, night | fish/dog 24–42, outage/Carl 58–82, any of four 100–128 | team 40%, closed 70% | 5 |
| 16 Midnight rush | Splash Park, night | fish/Carl 22–40, outage/dog 60–84, any of four 104–130 | rush 30%, team 60% | 5 |
| 17 Golden hour | Lagoon, golden | fish/dog 30–52, Carl 84–104 | none (VIPs) | 4 |
| 18 Sunset splash | Lagoon, golden | Carl/fish 30–50, dog/outage 86–112 | team 30%, rush 66% | 4 |
| 19 Storm front | Lagoon, dusk | Carl/fish 24–42, outage 78–100, dog/Carl 112–136 | rush 30%, storm 45%, team 74% | 5 |
| 20 Grand gala | Arena, gala | fish/dog 20–38, Carl/outage 56–80, any of four 92–116, fish/Carl/outage 128–150 | team 22%, closed 48%, rush 72% | 5 |

Karen is only on level 4 today; it is the one incident with a level of its own.

## 4. Proposal: an incident director (built for the week, 11 October 2026)

**Built** in `dist/week.mjs` (`directShift`) for the week, the game's main loop (README, "The week"): a registry (`INCIDENTS`, cost and
weight), an order the creator can change (`INCIDENT_ORDER`: since 17 October 2026 the next one in it surprises the player in every shift
from the first Tuesday, so all five are met in the first week; after that the five have the same weight and one that came in the
last shift or two is less likely, a fair mix, `RECENT`), counts that follow each blueprint level with a little give, random windows, twists by pool, bookings and a
mystery card adding trouble, signs from the shop lowering a weight. Since 16 October 2026 the week also mixes the pools (`POOLS`, `weekPools`): a shift's difficulty level sets how many incidents and twists it has, and the day's pool decides which twists may come (the aqua class only at the Community Pool, the storm only at the Sunset Lagoon, swim teams more often at the Aquatic Centre, neither swim teams nor an aqua class at the Aqua Disco, where the whole shift is a class; every incident can come in every pool, the disco included, where its lanes are called zones). Free play (the level map) still plays the slots below. What follows
is the proposal as it was written; the ranking still decides the weights and costs.

What is wrong with the slots: the number and rhythm of incidents are fixed per level, the pool of kinds is small and hand-picked, and a player
who has played a level twice knows its beats. What we want instead is a **director** that builds a shift's incidents when the shift starts, from
rules about what is allowed and how hard the shift may get. Nothing here changes how any incident plays; it only decides which ones come, and when.

1. **A registry, one row per incident.** Each incident declares where and when it may appear and what it costs in difficulty, for example
   `{ id: "dog", venues: ["club", "resort", "lagoon"], from: 4, weight: 3, cost: 2, cooldown: 40 }`. The level data stops listing kinds and starts
   listing *rules*: a **budget** (how much difficulty the shift may hold), a **count range** (level 1: 0 or 1; level 10: 3 to 4), and a **tone**.
   Map rules live in the registry: the trampoline only in the Splash Park venues, the storm only outdoors at dusk, Karen anywhere from level 4.
2. **Draw, don't assign.** At shift start, seeded by `runSeed`: draw a count, draw kinds by weight until the budget is spent, then place each
   one on a time line with a minimum gap and the existing `maxChaos` and "not in the last 14 seconds" rules. The seed is saved in the crash log
   (it already is), so any shift can be replayed exactly.
3. **Keep the star targets fair.** The thresholds in `SHIFTS` were tuned for fixed incidents. With a budget, every draw costs about the same,
   so the targets hold. `season-check.mjs` already plays every level with a bot: it would play each level over many seeds and fail if a draw can
   make the stars unreachable, or if a level's mean score drifts.
4. **Teach before you randomise.** An incident enters the random pool only after the player has met it (the `intro` levels stay guaranteed:
   dog 4, fish 5, Carl 6, outage 7, trampoline 11, VIP 17), and the game already remembers first sightings. A new player's level 1 and 2 stay gentle.
5. **Vary more than the kind.** Who it targets (which swimmer cramps, which lane the fish lands in), the order of arrivals (the type mix gets a
   little jitter), the twist (one drawn from the ones the venue allows), and for the outdoor venues the weather. Variety on top of the draw makes
   two shifts with the same incidents still feel different.
6. **Bookings become budget.** A booking raises the budget and may force a kind (Carl for the Stag party) instead of adding a fixed slot.
7. **Optional, cheap once it is seeded: a "shift of the day".** The same seed for everyone, a Steam leaderboard (Steam's own leaderboards fit a
   single-player game). Not a commitment; it is here because the director makes it nearly free.

What the ranking decides: which incidents are in the pool at all, how often (the weights), and how hard (the costs). Incidents the creator cuts
leave the pool; incidents the creator wants that do not exist yet are listed as ideas and come after.

### Open questions for the ranking

- Should level 1 ever have an incident, and if so which ones count as gentle (a lost goggle, a puddle, a loose fin, the dog's first sniff)?
- Is Karen a level-4 teaching incident only, or a roaming one for the rest of the game? (Her model and calming loop are built.)
- Cramps, tummy trouble and goggles are already random per swimmer. Should the director also control their *rate*, so a calm shift is calm?
- Do the twists belong in the same budget, or stay as the "this level's flavour"?

## 5. Watching an incident in the log (playtest mode)

An incident that gets stuck is the hardest bug to describe from a device, so every incident can be read in the crash log (README, "Playtest mode"):

- **`describe(sim)`** on the incident module returns where it stands as a short sentence that changes only when its stage does (`stage loose · kid crying · net wall · pool closed`). The diary writes a line each time it changes, and says it is `waiting` when the same sentence has lasted 25 s of the shift's own clock. **`detail(sim)`** returns what moves (positions, the fish's stamina, Karen's calm) for the periodic `pulse` line. **A new incident must have both.**
- The gear that can end up somewhere else (the fish net, the flashlight, the medical kit), the pool closing, a lane out of service and the storm are written whatever the incident.
- The 🐞 panel's "Make an incident happen now" starts a cramp rescue, the fish kid, the dog, Carl, Karen or the power cut in any level (`triggerChaos`, `startCramp`), and its "Seen so far" lists which of the incident kinds above the playtest has met (`INCIDENT_KINDS` in `dist/playtest.mjs`: add a new kind there).
- A shift can be replayed exactly from a report (`node tools/replay.mjs report.md --diary`): the level, the seed and the player's inputs decide everything, so the incident's whole story can be read again, stopped at a second (`--until`) and looked into.
