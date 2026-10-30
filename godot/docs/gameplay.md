# The Community Pool's gameplay, as the three.js game plays it

Read from the three.js simulation on 27 October 2026 (file:line references are into `dist/`). The numbers of one real shift are
in `godot/data/club-shift.json`, exported from the game itself (`node godot/tools/export-data.mjs`).

## 1. A shift

Free Play "Normal" at the Community Pool is level 8, "The relay" (`SHIFTS[7]`, sim.mjs:200):

| Setting | Value |
| --- | --- |
| Length | **135 s** after a 3-2-1 countdown |
| Guests | 24 |
| Fins | `finChance` 0.52 |
| VIPs | 4 |
| Marco "the Missile" (a VIP Pro) | in 66% of shifts |
| Stars | **2250 / 3550 / 4800** |

**Arrivals** (`director`, sim.mjs:808-869):

- The first guest comes at 3.4 s, then about one every 4.6 s until about 108 s.
- Guests come through the two changing-room doors in the back wall in turn, walk at 5 m/s, and wait in rows:
  `x = side·(4.6 − (slot%4)·1.1)`, `z = −11.1 − floor(slot/4)·1.15` (`queueSlots` in `club-venue.json`).
- The first three are a Beginner, an Intermediate and a Pro, and guest 10 is aqua aerobics. The rest are drawn 29% Beginner,
  31% Intermediate, 23% Pro, 17% Aqua.
- VIPs are always lap swimmers.

| Type | Lap speed (m/s) | Notes |
| --- | --- | --- |
| Beginner 🐢 | 1.43 | minds a crowd from 3 in a lane |
| Intermediate 🏊 | 2.6 | |
| Pro ⚡ | 3.9 | Marco ×1.12 |
| Aqua 💦 | 0 | works out in one place for 23–30 s |
| VIP 👑 | (their lap type) | patience ×0.75, drains ×1.4, +150 points, −300 if lost |

**Patience:**

- `waitLimit = 32 − 2·difficulty + rand·8`, which is 26–34 s at Normal (difficulty 3). A VIP's is ×0.75; a guest waiting for fins
  first gets ×1.5.
- Waiting, the mood falls linearly: `h = 100 − wait/waitLimit·100`. At 0 the guest goes home, **lost**.
- To leave happy (h ≥ 70) a guest must be given a lane within about a third of their limit.

## 2. Giving a lane

- **Choose a guest:** click them, or E beside them. Then click a lane, its button, or **1–3**. The lanes are at x = −3.2, 0, 3.2.
- **Move a swimmer:** a number moves one already in the water, for h −3.
- **Refused:** during a rescue, while the pool is closed, or for a guest who wants fins before they swim.
- **In the lane** (`updateLane`, sim.mjs:1841-2004):
  - One swimmer swims mid-lane; two swim side by side.
  - From three, they circle the lane, and the slowest ahead sets the pace (gap < 2 m).
  - Slowed by more than 0.35 m/s, a swimmer loses `deficit·0.76` h/s.
  - Blocked for more than 4 s with a deficit over 1, two swimmers collide: −50 points, both moods down, and 26% lost goggles.
  - Crowding costs −0.5 h/s for each swimmer over 3 (Beginners) or 4 (the rest).
  - A Beginner sharing with a Pro loses 0.25 h/s. Aqua sharing with lap swimmers loses 0.5 h/s, and the lap swimmers slow to 0.55 m/s
    round them.
- **The verdict** (`laneVerdict`, guidance.mjs:33-72) is shown over the swimmer the moment they get a lane. It is display only:
  - good: "Own lane", "Good match", "Sharing", "Aqua together", "OK";
  - bad: "Aqua blocks the laps", "Aqua in the way", "Stuck behind slower swimmers", "Too slow for this lane".
- **Fins:**
  - 52% of guests (from the 4th on, never aqua) want a pair.
  - Of those, 62% ask after 15.6 m of swimming, about 13% before they will swim at all (in the queue), and the rest as they get in.
  - The rack holds 3 pairs. Fins make a swimmer ×1.3 faster.
  - A guest climbing out drops theirs on the deck: whoever steps on them slips (the coach for 0.7 s).
- **The swim:**
  - The guest walks at 3.3 m/s to the lane's end, `(lane + 0.6, −8.7)`, and jumps in, facing down the lane.
  - Laps follow a 31.2 m circuit. A lap swimmer is done at 31.2 m **and** more than 12 s in the water: a Beginner about 22 s, the
    others 12 s.
  - Aqua is done after 23–30 s.
- **Leaving:** the guest swims to the nearer end and climbs out (0.65 s). One in five drips a wet spot. They walk out by the long side
  (x = ±6.3) at 4.5 m/s.

## 3. Points (`depart`, sim.mjs:1379-1415)

**A guest served:**

- Base 100.
- +50 happy (h ≥ 70); −25 if h < 30.
- +20 waited under 8 s.
- +20 no collision.
- +25 slowed under 3 s.
- +25 the lane all one type (an empty lane counts).
- +150 VIP.
- All of it × the streak's multiplier.

**The streak** grows with every happy guest, save and tip. It breaks on an unhappy guest, a loss, a mess or a slip.

| Streak | Multiplier | Label |
| --- | --- | --- |
| 3 | ×1.2 | WARMING UP |
| 5 | ×1.5 | ON A ROLL |
| 8 | ×2 | ON FIRE |
| 12 | ×2.5 | UNSTOPPABLE |

**Other points:**

| Event | Points |
| --- | --- |
| A guest lost | −100, VIP −300 |
| Two swimmers collide | −50 |
| A slip on a wet spot | −25 |
| A wet spot mopped | +10 |
| Poo or wee in the pool | −500 |

**The end:** the shift ends at its time, unless the clock is held (by a mess, at most 30 s). Every guest still there (queueing, walking
or swimming) counts as lost, −100 each. The stars are the thresholds reached.

## 4. The chores and the first incidents

Every incident has the same shape: a warning you can see, a window to prevent it, a funny failure with a cost, and a recovery done by
hand.

| Trouble | Warning | Prevention | Failure | Recovery |
| --- | --- | --- | --- | --- |
| **Wet spot** (incidents/wet.mjs) | 20% of guests climbing out drip a puddle (0.62 m, never dries, at most 10) | Mop it before someone steps in it | A guest slips: −25, h −12, the streak breaks. The coach slips: down 1.3 s. Jumping over it is safe. | Q, or E at the bucket (12.6, −11.6), takes the mop. E on the spot: 0.8 s, +10. Put the mop back. |
| **Chlorine** (sim.mjs:1794-1809) | Chlorine starts at 44 and falls `0.055 + 0.012·swimmers`/s; dirt rises `0.215·swimmers`/s. Over 48: "the water is getting cloudy". | Dose before the dirt passes 35 | Every swimmer loses `0.025·(dirt − 35)` h/s | C takes the bucket at (10.8, 7.8). E at the edge: dirt −46, chlorine +37. |
| **Cramp** (rescue.mjs) | 25% of swimmers cramp after 9–13 s in the water. The pool freezes and 🆘 shows. At most 3 a shift, 30 s apart. | none | The lanes stop while the queue keeps waiting | A life ring (3 wall hooks) → walk to the edge, auto-dive (0.55 s; Space forces it) → swim at 4.2 m/s → the ring goes over by itself within 1.25 m → the swimmer swims to the end, climbs out, rests 4 s on the bench (−10.2, −0.25), then back to their lane. The coach climbs out (Space, or push into the wall). Hang the ring back. A save. |
| **Poo / wee** (sanitation.mjs) | 20% of guests are sick (a third of those a wee). After 3–7 s in the water: 💩 or 🚽 over them. | 10 s to select them and send them to the lockers (+100) | −500, everyone out, the pool closed, the clock held | Poo: skimmer, scoop, bin, then chlorine. Wee: chlorine. |

## 5. The coach

- **One thing in his hands at a time**, "Hands full" otherwise: fins, the chlorine bucket, eye relief, goggles, the skimmer, a life
  ring, the mop.
- **E** does the best thing near him, in this order:
  1. the rescue's ring;
  2. the clean-up;
  3. mop a spot;
  4. pour the chlorine;
  5. give fins to a guest;
  6. take gear from a station or the deck;
  7. choose a waiting guest.

**Reach:**

| What | Distance |
| --- | --- |
| Stations, rings | 1.8 m |
| The water's edge | 1.55 m |
| A guest | 3.6 m |

A swimmer in the water is reached only from the end of their lane, or from beside an outer lane.

## 6. The first shift (dist/tutorial.mjs)

The run's first shift is 90 s, with 7 guests, patience ×2.5, no incidents and stars at 300 / 600 / 800. It teaches one line at a time:

1. Choose the waiting guest (click, or E).
2. Send them to a lane (click, or 1).
3. This one won't swim without fins: walk to the rack, E, walk to them, E.
4. Now give them a lane.
5. A wet spot: get the mop (Q), walk onto it, E.
6. "A happy streak multiplies your points."
