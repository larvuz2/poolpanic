# Coach Waters in the three.js game: what the Godot test has to match

Read from the three.js game on 27 October 2026 (file:line references are into `dist/`). The model is
`godot/assets/characters/coach-waters.glb`, a copy of `dist/assets/coach-panic.glb` (his file kept its old name in the three.js game).

## 1. The model

- **No scale, rotation or ground offset.**
  - The armature node is scaled 0.01: the bones are in centimetres.
  - Mesh bounds run y 0 to 1.75 (feet on y = 0), x ±0.815 (the T-pose), z ±0.274.
  - He **faces +Z**, with x to his left.
- **Bones:**
  - Body: Hips, Spine02, Spine01, Spine, neck, Head, head_end, headfront.
  - Each side, L/R: Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase.
  - Face: 18 face bones under `Face` (section 4).
- **Clips (seconds):** FreakOut 2.0, Haul 1.333, IceSkate 1.333, IceSlide 2.0, IdleScan 4, IdleScratch 6, Massage 2.0, Panic 1.0,
  Run 0.625, Startle 1.0, Swim 1.0, SwimRing 1.0, Walk 1.042. There is **no Jump clip**.
- **Materials:** `Material_1` (its texture, roughness 0.75, double-sided) and `CoachFace` (roughness 0.68).
- **Shadows:** every mesh casts them. The renderer uses soft shadows (PCFSoftShadowMap, scene.mjs:462).
- **The angle:**
  - The simulation turns him with `angle = atan2(vx, vz)` (coach.mjs:222), so forward is (sin a, 0, cos a).
  - The scene sets `rotation.y = angle` (scene.mjs:1520), eased by 30% of the wrapped difference each frame.
  - **Godot has the same axes (right-handed, y up)**, so `rotation.y = angle` works unchanged. Keep the model facing +Z: that is
    Godot's "back" (`-basis.z` is Godot's forward), so do not use `look_at`'s default forward for him, or pass `use_model_front = true`.

## 2. Which clip plays (CoachRig.update, scene/coach-model.mjs:164-249)

The rules are checked in this order:

| State | Clip | Rate |
| --- | --- | --- |
| Swimming or diving while holding the life ring | SwimRing | 0.85 + 0.45·clamp(speed/4.2, 0, 1) |
| Moving (walking, running, dashing, swimming without the ring) | Run | clamp(speed/3.85, 0.6, 2.1) |
| Swimming, standing still in the water | Swim | 1.1 |
| Massaging | Massage | 1 |
| Heavy job (haul, help out, straighten, breaker) | Haul | 1 |
| Otherwise | IdleScan | 1 |

**Moving** starts above a speed of 0.9 m/s and stops below 0.35 (hysteresis). Walk is played only in the countdown's walk-in: in a
shift he always *runs*, with the rate following his speed.

**On idle only:**

- **Startle:** once, on the frame an incident starts, to its end minus 0.15 s.
- **FreakOut:** after 0.8 s still while the urgency is 80 or more and his hands are free.
- **IdleScratch:** after 7–13 s idle (random each time), held to its end minus 0.35 s.

**Clip settings:**

- **Loop:** Startle and IdleScratch play once and hold their last frame.
- **Crossfade:** 0.12 s into Run, Swim, SwimRing, IceSlide and Startle; 0.22 s into anything else.
- **Rate smoothing:** `rate += (target − rate)·min(1, dt·14)`.

**Movement effects drawn on the model's parent (the `root`):**

- **Jump:** no clip. The current clip keeps playing while he rises by the simulation's `y`, and the root squashes and stretches:
  - in the air, scaleY = 1 + max(0, vy)·0.017;
  - landing, scaleY = 1 − 0.17·(landing/0.18), with landing a 0.18 s timer;
  - x and z are scaled by 1/√scaleY.
- **Dash:** Run at its top rate (2.1), the root leaning forward 0.25 rad, and four yellow speed streaks behind him (scene.mjs:793-805).
- **Slip** (a wet spot 1.3 s, fins 0.7 s; scene.mjs:953-973):
  - He falls on his back: root `rotation.x = −π/2·down`, y = 0.37·down, z = −0.12·down.
  - `down` eases in (smoothstep) over the first 22%, holds, then eases out over the last 42%.
- **Swim, dive and climb-out** (scene.mjs:1584-1592):
  - `prone` is 1 while swimming, min(1, 2t) in the dive, 1−t in the climb-out.
  - The root takes `rotation.x = π/2·prone` and position (0, 0.27·prone, −0.65·prone).
  - Heights:
    - dive: 0.55 s, y = sin(tπ)·0.95 − 0.39t;
    - climb-out: 0.6 s, y = −0.39(1−t);
    - swimming: y = −0.39 (rescue.mjs:340-358).
- **Never on the coach:** Panic. The creator's rule: **with the life ring in the water he plays SwimRing, never Swim or Run.**

## 3. What he carries

Nothing is attached to a bone. Each prop sits in a `carry` node under the root at the hands' place, `[0.3, 1.0, 0.34]`
(coach-model.mjs:316). The arms keep the clip's pose.

| Prop | Shape | Placement |
| --- | --- | --- |
| Life ring | torus R 0.49, tube 0.13 | on the deck (0, 1.02, 0.55); swimming (0, 1.88, 0.05) in the prone root's space |
| Fins | a pair (props.mjs `finsObject`) | the hands' place |
| Chlorine | a bucket, cylinder r 0.28/0.21, h 0.38 | the hands' place |
| Mop | 1.5 m | (0.32, 0.12, 0.5), rotated (−0.45, 0, −0.35 + sin(11t)·0.45 while mopping) |

## 4. The face (scene/coach-face.mjs)

He has **no mouth**: the face acts with the eyes, lids, pupils, brows and moustache.

**The bones:**

| Feature | Bones | Moved by |
| --- | --- | --- |
| Eye balls | EyeL/R | scale |
| Upper and lower lids | LidL/R, LidLowL/R | rotation about x |
| Gaze | LookL/R | yaw, then pitch |
| Pupils | PupilL/R | scale in x and y |
| Brows | BrowInL/R, BrowOutL/R | position |
| Moustache | Stache, StacheL/R | Stache moved and scaled; the sides rotated about z |

**How it moves:**

- **Easing:** an expression is reached at `1 − exp(−k·dt)`, with k 24 (alarm), 16 (panic), 12 (struggle), 10 (dizzy), 8 for the rest.
- **Blink:** the upper lid goes to −92° along a sine over 0.15 s. The next blink comes after (0.6 + rand·1.4)/blinkRate s.
- **Glances:** every dart·(0.5 + rand) s the eyes jump up to ±11°, eased at 28/s.

**Neutral values:** eye [1, 1], lid 100, low −100, pupil 1, dart 1.8, blink rate 0.28/s.

The first match wins:

| Expression | Key values | When |
| --- | --- | --- |
| dizzy | lid 44 (L 32 / R 58), low −78, spin 13°, curl −5, no blink | slipping |
| alarm | eye 1.24×1.2, lid 112, low −112, pupil 0.5, brows +0.016, curl 14, no blink | < 1.3 s after an incident starts |
| struggle | lid 34 (L 26), low −40, brows −0.011, curl 10, quiver 3.5 | a heavy job, or swimming with the ring in a rescue |
| relief | lid 58, pupil 1.25, curl 9 | < 1.8 s after a save |
| dismay | eye 1.06, lid 80, gaze −9°, curl −7 | < 2.2 s after a catastrophe or a broken streak |
| panic | eye 1.28×1.22, lid 114, pupil 0.42, shake 3.2°, dart 0.22, curl 16 | urgency ≥ 80, standing |
| worried | eye 1.1, pupil 0.8, inner brows +0.01, curl −6, dart 1.0 | urgency ≥ 80 moving, or ≥ 55 standing |
| focus | lid 72, low −96, inner brows −0.005, curl −3 | urgency ≥ 55 moving, or moving at all |
| neutral | the defaults | otherwise |

The real numbers are in `dist/scene/coach-face.mjs`. The rest pose has a scowl-free face. A first pass in Godot can do the blink and
the glances alone: they are what make him look alive.

## 5. Movement and the keys

`COACH_TUNING` (spatial.mjs:29), also in `godot/data/tuning.json`:

| Setting | Value |
| --- | --- |
| Speed | 7.6 m/s |
| Acceleration / braking | 58 / 76 m/s² |
| Radius | 0.32 |
| Jump | 7.4 m/s up against gravity 23: apex about 1.19 m, about 0.64 s in the air |
| Reach | 1.8 m to stations and things |
| Hand-off reach | 3.6 m to a guest |
| Dash | 19 m/s for 0.16 s (about 3 m), cooldown 0.82 s |

- **The jump:** its press is kept for 0.12 s, so a press just before landing still jumps.
- **The dash:** it locks its direction to the keys held, or to his facing with none held.
- **Water:** wading is half speed (no dash or jump). Swimming is 4.2 m/s, approached at min(1, dt·10).

**Keys:**

| Key | What it does |
| --- | --- |
| WASD or arrows | Move. The camera looks across the pool, so **screen up is +X and screen right is +Z** (`screenMovement`, spatial.mjs:44-46): W moves +x, D moves +z. |
| Space | Jump, dive in, climb out |
| Shift | Dash |
| E | Interact, or hold it for a hold-E job |
| 1–3 | Send the selected guest to a lane |
| F / C / R | Fins / chlorine / eye relief (fetch, or show the way) |
| Q | Mop |
| V | Coach Cam |
| P or Esc | Pause |
