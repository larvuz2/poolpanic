# The Community Pool: its layout, its look and its camera in the three.js game

Read from the three.js game on 27 October 2026 (file:line references are into `dist/`). The exact positions are in
`godot/data/club-venue.json`, exported from the game (`node godot/tools/export-data.mjs`). The pictures of it are in
`godot/reference/`.

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
| Doors | the locker doors at x ±8.05, z −14.4; MEN's bay x −10.7 (teal), WOMEN's +10.7 (coral) |
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

## 2. The look (the "indoor" lighting preset; scene.mjs:64-75, 603-668)

**Light:**

| Setting | Value |
| --- | --- |
| Background | #537e7b, plain |
| Fog | linear #537e7b, 50 → 125 m |
| Tone mapping | ACES Filmic, exposure 0.95 |
| Hemisphere light | sky #cfe3e0, ground #80654d, 1.2 |
| Sun (shadows) | #ffd6a0, 2.45, from (−12, 27, 10). Soft shadows, 2048 map. |
| Fill (no shadows) | #8fc3cb, 0.6, from (15, 15, −18) |
| Environment | a soft gradient (#d8efe9 / #b9d5cc / #a17c5e) at 0.55 |

**The deck and the pool:**

- **Deck tiles:** 1 m, base #c99a70, grout #a27a5a, roughness 0.74.
- **Coping:** #dcc394, 0.35 m wide. Gutters #5f7f7f; waterline band #2d7f8c.
- **Water:**
  - #33ccd6 by the walls, blending to #17b0c9 over the first 2.8 m.
  - Fresnel sky ≈ #b3edf2, glints #fff5db.
  - About half transparent, small ripples (0.034 m), caustic lines drawn in the shader.
- **Lane ropes:** floats r 0.115 at y −0.19, cream #ffe3a2 and blue #3593c1, red #ed7556 where |z| > 5.8.
- **Starting blocks:** base #d1ded3, top #529fd5. Floor numbers "01–03" at z −10.75.
- **Backstroke flags:** on posts at x ±6, z ±5.7, 3.35 m tall.

**The room** (an open "dollhouse" in the overview, scene/club.mjs):

- **Back wall:** at z −16.35, 29.7 × 5.9 m.
  - Plaster #82a79b, a teal tiled wainscot #4fa3a1 1.25 m high, and a band #268994.
  - Five sky windows (4.6 × 2 m) with soft light shafts.
  - A POOL PANIC crest, a notice board and a clock.
- **Side walls:** low walls 1.1 m high at x ±14.8, #447d7a with a #cda477 cap.
- **Office:** at (14.3, 9.5), #277982. "NO RUNNING" painted on the floor.
- **Colours of the props:**
  - Chlorine station #f4c849, first aid #ddf3d7.
  - Lifeguard chair #f0bc51.
  - Life-ring boards #277982 with rings #f47742.
  - A lane highlight #ffe58b when a guest is chosen.

## 3. The camera (scene.mjs)

- **Lens:** perspective, vertical FOV **42°**, near 0.1, far 180.
- **Direction:** it looks along normalize(−0.65, 0.76, 0) from its target, about 49.5° down, toward +X.
- **Distance:** max(20.5, min(64, 30 / (2·tan 21°·aspect))), about **22 m** at 16:9.
- **Follow** (`followCoach`, :2089-2149):
  - Target = (clamp(0.22·x, ±2.4), 0.45, clamp(0.13·z, ±1.5) − 3.2), eased by 1 − e^(−2.5·dt).
  - It pans further only to keep the coach clear of the HUD's edges.
- **Measured in the game:** at the coach's start the camera stood at (−16.55, 18.41, −3.2), FOV 42.

## 4. The HUD (index.html, app.mjs)

| Where | What |
| --- | --- |
| Top centre | The score ("0000"), three stars, a bar to the next star, the shift clock |
| Left column | Every message: the incident's banner, the tip, the streak, the toasts, the chosen guest |
| Right | The water (clarity, chlorine) and the tool buttons C, F, Q with counts; "IN HAND" |
| Bottom | The lane buttons, 155 × 76 px: "LANE 01", its mode (OPEN, SOLO, SPLIT, CIRCLE), "N swimmers" and a coloured dot per swimmer; the interaction prompt ("Interact E") |

**Over each guest:** a tag with their type's icon, a mood bar (#73b65b above 70, #e6b445 above 40, otherwise #eb7754), and their name
when chosen.

The fonts are Barlow Condensed (headings, numbers) and DM Sans (text), copied to `godot/assets/fonts/`.
