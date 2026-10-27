# The Community Pool: its layout, its camera and what the HUD must show

Read from the three.js game on 27 October 2026 (file:line references are into `dist/`). The exact positions are in
`godot/data/club-venue.json`, exported from the game (`node godot/tools/export-data.mjs`).

**This note holds what the gameplay needs and nothing about how it should look.** The positions, the sizes and the camera's framing
are gameplay: keep them. The look is deliberately left out, and there are no pictures of the three.js game here. The creator wants
the Godot test to push design, quality and lighting as far as Godot can go, not to copy the three.js game (`godot/README.md`, "The
look").

## 1. The layout

**Units and axes:**

- Metres, with y up. The lanes run along **z** and are spread across **x**.
- The camera stands at −X looking toward +X: **screen right is +Z and screen up is +X** (spatial.mjs:43-46).
- The locker end, where guests wait and dive in, is −Z (screen left).

**The basin** (`poolGeometry`, spatial.mjs:61-115):

- 10 m wide and 16.6 m long: halfX = lanes·1.6 + 0.2 = 5.0, halfZ = 8.3.
- Basin floor y −1.42, water surface y −0.25, deck top y −0.018 (scene/pool.mjs:141, 245, 499).

| Item | Value |
| --- | --- |
| Lanes (centres) | x = −3.2, 0, 3.2 |
| Lane ropes | x = −4.8, −1.6, 1.6, 4.8 |
| Starting blocks | (lane, −9.15), half size 0.6 × 0.56 |
| Ladders | (−5, 5) and (5, −4.1) |
| Deck | x ±14.1, z −15.2 … 12.65 |
| Room | x ±14.7, z −16.7 … 13.5 |
| Doors | the locker doors at x ±8.05, z −14.4; MEN's bay x −10.7, WOMEN's +10.7 |
| Queue | x = side·(4.6 − (slot%4)·1.1), z = −11.1 − ⌊slot/4⌋·1.15 |
| Coach start | (−6.6, 0), facing +X |
| Fins rack | (−10.3, 7.8) |
| Chlorine station | (10.8, 7.8) |
| Eye relief | (10.8, 3.9) |
| Mop bucket | (12.6, −11.6) |
| Life rings | (−4, −15.7, angle 0), (−14.35, −5, π/2), (14.35, 5, −π/2) |
| Rescue bench | (−10.2, −0.25) |
| Skimmer, bin | (−13.5, −1.9), (−12.5, 1.5) |
| Lifeguard chair | (12.2, −7.3) |

**Derived lines:**

| Name | Value |
| --- | --- |
| `swimX` | 4.55 |
| `swimZ` | 7.85 |
| The coach climbs out to | x ±6.2 (long sides) or z ±9.95 (ends) |
| Guests' walk by the long sides | x ±6.3 |
| Guests jump in at | (lane + 0.6, −8.7) |

The `walkGrid` in the JSON says where the coach may stand (its radius already counted), every 0.25 m.

## 2. The look

Not specified, on purpose: see `godot/README.md`, "The look". The only fixed things are what the place *is*:

- an indoor community swimming club;
- a 3-lane pool with lane ropes and starting blocks at the locker end;
- the two locker rooms the guests come out of;
- the stations the coach uses (fins rack, chlorine, eye relief, mop bucket, life rings, rescue bench);
- the characters, who are the game's own models.

## 3. The camera (scene.mjs)

- **Lens:** perspective, vertical FOV **42°**, near 0.1, far 180.
- **Direction:** it looks along normalize(−0.65, 0.76, 0) from its target, about 49.5° down, toward +X.
- **Distance:** max(20.5, min(64, 30 / (2·tan 21°·aspect))), about **22 m** at 16:9.
- **Follow** (`followCoach`, :2089-2149):
  - Target = (clamp(0.22·x, ±2.4), 0.45, clamp(0.13·z, ±1.5) − 3.2), eased by 1 − e^(−2.5·dt).
  - It pans further only to keep the coach clear of the HUD's edges.
- **Measured in the game:** at the coach's start the camera stood at (−16.55, 18.41, −3.2), FOV 42.
- **What is fixed:** the controls depend on it looking across the pool, screen up +X and screen right +Z. The lens, depth of field
  and any camera polish are yours.

## 4. What the HUD must show (its design is yours)

| Where (in the three.js game) | What it shows |
| --- | --- |
| Top centre | The score, three stars with a bar to the next, the shift clock |
| One column on the left | Every message: the incident's banner, a tip, the streak, the toasts, the chosen guest. The middle of the view stays the pool's. |
| Right | The water (clarity, chlorine), the tools C, F, Q with counts, what the coach has in his hands |
| Bottom | The three lane buttons (number, mode such as OPEN, SOLO, SPLIT or CIRCLE, how many swimmers, a dot per swimmer), the interaction prompt ("Interact E") |
| Over each guest | Their type, a mood bar, their name when chosen |

The game's fonts, Barlow Condensed and DM Sans, are in `godot/assets/fonts/`. Use them or better ones.
