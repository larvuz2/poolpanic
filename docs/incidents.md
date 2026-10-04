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

Seventeen entries in four groups (eleven incidents proper and six whole-shift changes). Where there is a warning window the coach can use it to
prevent the incident; otherwise the recovery is the coach's job. The points are from the code.

### In the pool: trouble for the swimmers in the water, or for the water itself

| Incident | Levels | What happens |
| --- | --- | --- |
| 🆘 **Cramp** | 2 and up, about 1 swimmer in 4 | The lanes freeze, a ring icon marks the victim. Take a wall ring, dive in, swim it to them, climb out, hang the ring back. Slow: the lanes stay frozen while the queue loses patience. |
| 💩 **Tummy trouble** | 3 and up, a few a shift | A 10-second meter over a swimmer. Send them to the locker in time (a bonus; sending a healthy one home costs points). Missed: a mess floats in the water, everyone evacuates and panics, the streak breaks and the clock holds until skimmer, bin and chlorine are done. |
| 💢 **Collisions and lost goggles** | any level; goggles from 2 | A fast swimmer stuck behind a slow one collides (−50, happiness drops). About 1 in 4 loses goggles; carry them back to their owner. Prevented by lane choice and lane moves. |
| 👁️ **Sore eyes** | every level | Too much chlorine (the target band is 40 to 65) gives red eyes and costs happiness; fetch eye relief. Dirty water costs happiness too. |

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
| 😡 **Karen** | 4 only, 74 to 94 s in | Storms out of a locker door at the coach. Everyone within 3.3 m stops, covers their ears and loses 20 points (once each). Hold E beside her for 3 seconds (+100, +50 if nobody was annoyed). |
| ⚡ **Power outage** | 7 to 10, 14 to 16, 18 to 20 (Night swim booking) | 7 seconds of flicker; reset the fuse box in time (+100). Missed: a blackout (−100), swimmers bump into each other. Flashlight, then breakers (+100). |
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

## 4. Proposal: an incident director (not built, waiting for the ranking)

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
