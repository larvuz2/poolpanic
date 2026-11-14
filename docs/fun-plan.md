# The fun plan: making a run addictive

**Proposed on 14 November 2026 and approved the same day ("ok implement all 8! and for the 5 decisions go with the recommended").
Built: steps 1 to 8, but for the Daily Shift, which waits for the Steam work (the fourth decision). What each step became, the
numbers the bots measured and what is not met are in the README, "The fun plan, built". Still the creator's: to rank the perks,
the day rules and the crossovers, and to say after playing whether weeks 2 and 3 ask too much or too little (`GOAL_SHARE`).
The plan as it was proposed follows.**

The question it answers: with everything the game already has, what is the least we must change so that every run feels fresh and
rewarding, and a player always wants one more shift?

## What is true today

- **The toy is strong.** Fifteen pools, each with its own thing. Five roaming incidents, the venue ones (massage, influencer), wet
  spots, cramps, tummy aches, a big moment in every shift, mid-shift twists (`TWIST_RULES`), a streak to ×2.5, two wishes from Marina.
- **The run varies in what happens to the player, not in who the player becomes.** Pools and incidents rotate, but two runs are played
  the same way. The twelve perks (`PERKS`) are flat bonuses (12% faster, 25% longer queue, 10% more score): none changes a decision,
  none combines with another, none has a price beyond money. There is no build, so there is no "this run I am the VIP coach".
- **The stakes are late and binary.** Only Saturday night decides anything. A good coach fills the Date Fund early (the README: by
  Thursday in week 1, 1.1 to 1.3 times the goal later), so the last shifts carry no tension; a struggling one knows by Thursday it is
  lost. A failed shift pays nothing, a passed one $15 plus $15 a star: the difference between two and three stars is small.
- **A lost run restarts at its dullest.** The next START is week 1, whose first shift is the gentle minute (`FIRST_SHIFT`) and whose
  week is the easiest band. The moment the player most wants revenge is the moment the game asks least.
- **Surprise runs out.** After week 1 the five incidents are known. They never meet each other. Nothing rare ever happens.
- **The expert bot still idles 20 to 29%** of a mid-level lane-pool shift.

## The principles

1. **Triage is the fun.** Two things always want the coach and one must wait. Never zero, never more than three.
2. **A shift is a song**: build, peak, breath, bigger peak, last call, release.
3. **A run is a build.** Choices compound, so run 7 is played differently from run 6.
4. **Every shift matters to the week**, and every coin to something.
5. **A near miss becomes drama**, not a flat game over.
6. **Rewards are frequent, and some are rare.** A small win every 30 seconds, a choice every shift, a jackpot now and then.
7. **Trouble can be wanted.** The best perks make the player hope Karen shows up.
8. **The pull is the game itself**: no timers, no login guilt.

## The work, in order

### 1. Measure the fun first (small; no change to the game)

`tools/fun-report.mjs`: whole runs played by the novice, average and expert bots over many seeds, one page of numbers:

- per shift: idle time, how many things want the coach over time (the pressure curve), the longest calm, the worst pile-up;
- per week: on which day the Fund was decided (target: Friday or Saturday in 6 weeks of 10);
- per run: where runs end, how long they take, how alike two runs are (shared pool, twist and perk).

Every later step names its target in this report. Nothing ships on feel alone, since nobody here can play it on the creator's machines.

### 2. Stakes in every shift (small rule changes, large effect)

- **Overtime instead of a flat game over.** Short by a fifth or less on Saturday night: *One last shift?* A sudden-death shift at the
  top of the week's band, paying double. Pass and the date is on. Once per run. The near miss becomes the best minute of the run.
- **The surplus counts.** Check what money over the goal does today; make half of it carry into the next week, so Friday and Saturday
  are worth playing well even with the Fund full.
- **Three stars are worth chasing.** Steepen the pay ($10 to pass, then $10, $20, $30 for the stars, the same $70 at most plus a
  little), and say on the results how close the next star was: *12 short of ★★★*.
- **A veteran's Monday.** From the third run, no gentle minute and no one-new-incident-a-day ramp: Monday is a real shift, and it
  opens with a free pick of one perk from three. A new run starts hot and already different.
- **Making it up.** After a failed incident, the next success within 12 seconds pays double and gives back half the streak. No death
  spiral; heroic recoveries.

### 3. The shift as a song (tuning the director; medium)

The director already has a budget, costs and the big moment at 60 to 70%. Add an intensity it reads from the simulation alone
(pending incidents, cross guests, swimmers at risk), so it stays deterministic:

- it holds new trouble while three things are pending (four for a crew), and for a breath of 10 to 15 seconds after each peak;
- from level 6 it never leaves the coach with nothing for more than about 12 seconds: it fills a calm with something small that
  exists already (a coaching tip, a wet spot, a VIP);
- **last call**: in the final 25 seconds no new guests, everything scores ×1.5, the music lifts.

Targets: expert idle 10 to 15%, average 20 to 30%, no shift with a pile-up of five.

### 4. Perks become a build (the largest step, and the heart of it)

Keep the twelve as the common ones. Add about eighteen that change a rule, each with a cost, in families built on verbs the game has:

| Family | Examples (all from existing knobs: rates, patience, director weights, streak rules) |
| --- | --- |
| Streak | *Showboat*: the streak climbs twice as fast, one cross guest breaks all of it. *Second wind*: a rescue restores a broken streak. |
| VIP | *Red carpet*: twice the VIPs, double pay, half the patience. *Autograph*: Marco served perfectly doubles the next 30 seconds. |
| Trouble pays | *Karen's manager*: a calmed Karen tips $20, and she comes every shift. *Dog treats*: a quick catch adds 3 to the streak. *Carl's fan club*: a cannonball that soaks nobody pays. |
| Speed | *Roller skates*: 30% faster, and the deck slides like the springs' ice (`venue.ice`). *Mop on wheels*: instant mopping, twice the wet spots. |
| Crowd | *Happy hour*: 30% more guests, 20% more a swim. *Members only*: fewer guests, each worth half as much again, shorter patience. |
| Money | *A loan from Marina's dad*: $60 now, the week's goal $90 higher. *High roller*: bookings pay double for three stars, nothing under two. |

- **A pick, not a shop**: on the results of every passed shift, one of three, still paid from the Date Fund (one money, the creator's
  choice), and one of the three is always free with a catch. **Six slots**: a seventh replaces one. That limit is what makes a build.
- Choices between shifts are the host's in co-op, and enter the shift through its config, as perks do now.
- Target: at least five different builds within 10% of each other in the bots' runs; no perk taken more than 40% or under 5% of the time.

### 5. The day's doors get teeth (medium)

The day's card already offers a regular gig, a booking and a mystery. Make every day two or three doors that show **pool, day rule and
pay**, with about fourteen day rules, each only a setting of what exists:

Heatwave (more guests, less patience) · VIP night · Kids' day out · Rain (every swimmer drips) · Marco's fan day · Full moon (two
roaming incidents may overlap) · Health inspector (a dirty pool costs double, a clean shift pays a bonus) · Power saver (the outage
is certain) · Carl's birthday (three cannonballs) · Double date (three wishes) · Happy hour · Skeleton crew (no dash) · Calm (less
pay) · Mystery.

Pool × day rule × build is where runs become unrepeatable, and where a build pays off (*VIP night* with *Red carpet*).

### 6. Surprise (medium; each one is a small rule)

- **Crossovers**: incidents meet. The dog steals the fish kid's fish (catch one, both are solved). Karen during the outage complains
  twice as fast. The influencer films Carl: a cannonball on camera goes viral and tips. A VIP on the massage table. Each is rare
  (about one shift in eight), needs its sticker and words (`stickers-check.mjs`), and goes into `warmCast`.
- **The golden guest**: about one shift in ten, a guest who pays a star's worth if served perfectly. A pure jackpot.
- **The scrapbook** in the coach's locker: every crossover, rare guest and day rule seen, so there is always one more to find.
- The promise: something never seen before in each of the first ten runs.

### 7. What lasts, and a reason to come back (with Steam readiness)

- **Coach's challenges** (on `dist/achievements.mjs`) add rare perks, day rules and crossovers to the decks, so the locker gives toys
  and not only trophies. A lost run still moves the next unlock forward: no run is wasted.
- **Heat after the ending**: the endless weeks (`heatOf`) with conditions the player picks for a gold album.
- **The Daily Shift**: one seed for everybody, one try, a friends' leaderboard on Steam. The simulation is seeded and replays to the
  last bit, so it is nearly free, and it is the best honest reason to open the game every day.

### 8. The reward's feel (small)

Results to the next decision in under six seconds: coins fly into the Fund, the pick appears on the results, tomorrow's doors are
teased under it. The intro cinematic only the first time a venue comes in a run.

## What stays

No new pools. The Sunday date as it is. One money. Marina never on the deck. The HUD says that something is there and nothing more:
no new banner, no button row. Everything that changes the simulation stays seeded and goes through an input method; nothing compiles
mid-shift; the first week of a first run stays as gentle as it is.

## For the creator to decide

1. **Perks**: a pick on the results, paid from the Fund, one always free with a catch (recommended), or every pick free?
2. **Overtime** on a near miss: yes (recommended) or keep the plain game over?
3. **A veteran's Monday** from the third run: yes (recommended)?
4. **The Daily Shift**: now, or with the Steam work (recommended)?
5. **Rank** the perks, the day rules and the crossovers: which first, which never. They are yours, like `INCIDENT_ORDER`.

## The targets, in one place

| What | Today | Target |
| --- | --- | --- |
| Expert bot idle, mid-level lane pool | 20 to 29% | 10 to 15% |
| Weeks decided on Friday or Saturday | not measured | 6 in 10 |
| Builds within 10% of each other | none (no builds) | 5 or more |
| Two runs sharing pool, day rule and perk | not measured | under half |
| A lost run to the next real shift | a gentle minute first | one click |
| Something never seen before | week 1 only | each of the first ten runs |
