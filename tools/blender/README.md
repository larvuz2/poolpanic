# Headless Blender

Blender 4.5 runs here without a screen, driven by Python scripts: rig a character, build a walk cycle, render a
preview you can watch on any device, inspect a model, export glTF. Nothing needs a GPU (EEVEE, Workbench and Cycles all
render on the CPU; fine for rigging and previews, slow for big Cycles frames).

```sh
tools/blender/setup.sh            # once per session: installs Blender into /opt/blender (about a minute)
tools/blender/run.sh SCRIPT.py -- ARGS...
```

| Script | What it does |
| --- | --- |
| `inspect_model.py -- model.glb` | Size, meshes (verts, triangles, materials), armatures (bones) and animations (frame ranges) |
| `turntable.py -- model.glb out_dir [--frames 48] [--size 480] [--engine eevee\|workbench\|cycles] [--animation NAME] [--still-frame N] [--no-mp4] [--static [--angle DEG] [--loops N]]` | `still.png` and `turntable.mp4` (the camera circles the model; `--animation` plays a clip meanwhile; `--static` keeps the camera still at `--angle` (0 front, 90 side) and loops the clip `--loops` times) |
| `polish_walk.py -- in.glb out.glb [--hang 9] [--swing 20] [--swing-back 26] [--elbow-min 10] [--elbow-max 34] [--no-arms] [--keep-timing]` | For a Mixamo-style walk (Meshy, Tripo): closes the loop (last key a copy of the first, whole frames) and rewrites the arms so they hang close to the body and swing opposite the legs |
| `game_export.py -- in.glb out.glb [--tex 1024] [--quality 85] [--roughness 0.75] [--keep-material] [--height M] [--keep-origin]` | Game-ready GLB: textures shrunk to JPEG, skin and every clip kept under its own name, and Meshy's emissive, fully metallic material made a plain matte one (it would glow like a mirror under the game's lights); prints the triangle count, the clips and the size. A mesh with no skin (straight from Meshy) is stood on the floor, centred and facing the front, scaled to `--height` metres (Meshy makes everyone the same height) unless `--keep-origin` |
| `idle_clips.py -- in.glb out.glb [--scan 42] [--hang 8] [--only IdleScan\|IdleScratch]` | Adds two looping idle clips to a T-pose humanoid (Meshy, Tripo): `IdleScan` (4 s, breathes and turns the head left and right) and `IdleScratch` (6 s, the same, then scratches the back of the head with the right hand). Every bone is keyed, so switching clips in the game leaves nothing behind |
| `smooth_joints.py -- in.glb out.glb [--joints knee,elbow] [--half 0.4] [--cuts 2]` | Stops the mesh tearing at deep bends (a run's knees): adds rings of vertices across each knee and elbow and spreads the skin weights over them. Adds about 1.7k triangles to Coach Panic. Run it before `game_export.py` |
| `humanoid_rig.py -- in.glb out.glb [--walk] [--frames 24] [--height M]` | Fits a 19-bone humanoid armature to the mesh, automatic weights, optional looping walk cycle named `Walk`, exports GLB with skin and animation |
| `rig_from_template.py -- body.glb rigged.glb [--template dist/assets/coach-panic.glb] [--set y_crotch=0.70] [--debug joints.json] [--tex-quality 90]` | Rigs a T-pose humanoid with another character's skeleton (Coach Panic's 24 bones): same names, hierarchy and rest rotations, joints moved to fit the body, skin weights worked out for the new mesh. No animation is added (`retarget_clips.py` brings the template's clips over). Uses `rigfit.py` (measures landmarks on a mesh, places joints by the template's proportions) |
| `retarget_clips.py -- rigged.glb out.glb [--template dist/assets/coach-panic.glb] [--scale K] [--only Run,Walk] [--tex-quality 90]` | Puts the template's clips (Coach Panic's Run, Walk, IdleScan, IdleScratch) on a character rigged by `rig_from_template.py`: every bone's rotation keys are copied by name, the hips' travel is multiplied by the ratio of the two hip heights (or `--scale`), each clip keeps its name and length, mesh, skin and textures stay as they were. A clip already in the file is dropped |
| `ground_clips.py -- in.glb out.glb [--only Walk,Run]` | Stands a character's clips on the floor: plays each clip in Blender, finds how far the mesh sinks under the floor at its lowest point, and lifts the hips by that much in every key of that clip (one height per clip; the pose, speed and loop do not change). Only those position keys are rewritten, in the GLB itself, so the rest of the file is byte for byte what it was. A clip that already stands on the floor (an idle) is left alone, so running it twice changes nothing. Run it last |
| `character_clips.py -- in.glb out.glb --character marco [--only WaitWatch]` | Adds a character's own clips to a character on Coach Panic's skeleton (the clips of the file stay). A clip is a list of keys per control (the wrist's target and the elbow's direction for each arm, the hips, spine and head turns, where the head looks, a foot lifting for a tap) written in the `CLIPS` table of the script, and every frame is solved: arms by two-bone IK in fractions of the arm's reach, so one pose fits a tall swimmer and a child, legs with the feet held where they stand and the knees bending to the hips. Every bone is keyed, the clip loops. Run `ground_clips.py` after it. `--character shared` is the table of clips every character gets (Panic and Swim), made on Coach Panic and moved to the others with `transplant_clips.py` |
| `transplant_clips.py SOURCE.glb TARGET.glb OUT.glb --only Panic,Swim [--scale K]` | Plain Python (no Blender): adds clips of one GLB to a finished character on the same skeleton and changes nothing else in the file (the mesh, skin, textures and the other clips stay byte for byte). Rotation keys are copied by name, the hips' travel is scaled by the ratio of the two hip heights (or `--scale`), and a bone's translation is carried as its offset from its own rest position, since glTF stores the whole local translation. Refuses a skeleton that differs (a target with bones of its own on top, the belly bones, is fine: they stay at rest) or a clip the target already has. Run `ground_clips.py --only Panic,Swim` after it |
| `belly_bones.py -- rigged.glb out.glb [--front 0.2] [--keep-legs 0]` | Adds three bones to a character rigged on Coach Panic's skeleton, for a round body whose stomach should move by itself: BellyUpper (child of Spine01), BellyMid (Spine02), BellyLower (Hips), each a short bone at the belly's middle line pointing forward to its front, with the front of the belly weighted to them by height (the 24 bones, the bind pose and the clips stay). First it takes the thigh bones' hold off the lower back and the behind (on a wide body the automatic weights give them most of it, and the back swings with every knee). Needs Blender |
| `belly_jiggle.py in.glb out.glb [--only Walk,Run] [--oneshot Cannonball] [--gain 1.0]` | Plain Python (numpy): writes the belly's own motion into the clips, as position keys of the three belly bones: a mass on a spring per axis that lags the spine and hips, bounces on every step and landing, sways with a turn and rises with a breath in the idles. A looping clip is run round for ten loops and the last one kept, so the belly is in step with its loop; a one-shot clip starts at rest. The belly never goes more than 2.5 / 4 / 3 cm (sideways / up / forward) from where it hangs |
| `clear_limbs.py in.glb out.glb [--only Walk,Run] [--oneshot Cannonball] [--arms-only Cannonball] [--overlap 0.015] [--arm-max 50]` | Plain Python (numpy, scipy): keeps arms and knees out of a belly. A clip taken from a slim body hangs the arms by the sides, swings them past the hips and kicks the heels up behind; on a wide body that is inside it. The torso is a volume (the body's bind pose, filled, carried by the skin weights) and each clip is played on the skinned mesh: the least outward turn of the whole arm about the shoulder, and the least cut of the knee's bend, that leave the limb no more than 1.5 cm inside it is found frame by frame, smoothed in time, and written into the arm and knee rotation keys. A clip that is clear is left byte for byte as it is |
| `cannonball_clip.py in.glb out.glb` | Plain Python (numpy): makes Carl's one-shot clip `Cannonball` (below) and puts it in his file. `posing.py` (poses the skeleton from joint angles and wrist and ankle targets, with two-bone IK) and `skinpose.py` (reads a GLB, skins it, measures the body) are its libraries, and the other plain-Python tools' |
| `round_character.sh retargeted.glb out.glb` | Everything a round character gets after `retarget_clips.py`, in the order that works: `belly_bones.py`, `belly_jiggle.py`, `clear_limbs.py`, `cannonball_clip.py` (its tuck depth measured on the body), the Cannonball's arms cleared and its belly moved, and `ground_clips.py` on the six other clips (not the Cannonball). Carl and the leopard man are made with it |
| `make_test_humanoid.py -- out.glb` | A blocky stand-in character (T-pose, 1.8 m) for trying the pipeline without a real mesh |

`common.py` holds what they share (import any of glTF/GLB, FBX, OBJ, blend; bounds; lights; camera; engine choice).

## A Meshy character for the game

Generate with `fal-ai` `meshy/v7/image-to-3d` (`enable_rigging`, a modest `target_polycount`), then:

```sh
tools/blender/run.sh tools/blender/polish_walk.py -- walking.glb walk.glb            # clip "Walk": seamless loop, natural arms
tools/blender/run.sh tools/blender/idle_clips.py -- walk.glb clips.glb               # adds IdleScan and IdleScratch
tools/blender/run.sh tools/blender/merge_clips.py -- clips.glb all.glb run.glb       # adds clips from another file (Meshy's Run, after polish_walk.py --name Run)
tools/blender/run.sh tools/blender/smooth_joints.py -- all.glb smooth.glb            # knees and elbows that bend without tearing
tools/blender/run.sh tools/blender/game_export.py -- smooth.glb exported.glb --tex 1024
tools/blender/run.sh tools/blender/ground_clips.py -- exported.glb coach-panic.glb            # the feet on the floor, not under it
tools/blender/run.sh tools/blender/turntable.py -- coach-panic.glb out --animation IdleScratch --static --angle -35
```

To look at a model with all its clips, use the web viewer instead of videos: `tools/viewer/README.md`.

Every clip loops: its last frame is its first again, so a game plays frames 0 to N (three.js does this by itself) and a
preview shows 0 to N-1. `turntable.py --static` does that, and `--angle` is where the camera stands (0 the front, 90 the
character's left side, -35 a three-quarter view of his right).

## More characters on the same skeleton (rig once, retarget the clips)

Every character in the game is a biped, so a new one needs neither its own rig nor its own clips: give it Coach Panic's
skeleton and Coach's animations play on it. Same bone names, same hierarchy, same rest orientations; only the joint
positions differ, because the bodies do.

```sh
tools/blender/run.sh tools/blender/game_export.py -- meshy.glb body.glb --height 1.72    # on the floor, T-pose, game material
tools/blender/run.sh tools/blender/rig_from_template.py -- body.glb rigged.glb            # 24 bones + skin weights, no clips
tools/blender/run.sh tools/blender/retarget_clips.py -- rigged.glb retargeted.glb         # the Coach's Run, Walk, IdleScan, IdleScratch
tools/blender/run.sh tools/blender/ground_clips.py -- retargeted.glb marco.glb             # the feet on the floor, not under it
node rig-check.mjs                                                                         # same bones, bind pose, weights and clips as the Coach, on the floor
```

`rig_from_template.py` measures landmarks on the mesh (neck, crotch, ankle, the line each arm lies on, how deep the
body is) and puts every joint where the Coach's own joints sit relative to the same landmarks (`rigfit.py`), then copies
the template's bone orientations (Blender's automatic weights fail on Meshy's split-vertex meshes, so the weights are
worked out on a welded copy and carried back by position). The five secondary characters were made this way, about five
seconds each (the same input always gives the same GLB), and the same rig is what a future biped needs.

- **Shorts and long garments fool the crotch.** If the legs look joined too high or too low in a pose test, give the
  landmark by hand, in metres: `--set y_crotch=0.70` (Bruno), `--set y_crotch=0.33` (Nico). `--debug joints.json`
  writes the fitted joints. `--set` also takes `y_neck`, `y_top` and `y_ankle_det` (the ankle as measured, before the
  Coach's ratio).
- **Check a pose before trusting a rig.** Pose the legs wide, the arms down and the elbows bent (Pose Mode, or a script),
  render, and look for tearing at the crotch, the armpits and the neck. Weights are automatic: loose clothing next to a
  limb (Berta's and Nico's inner thighs) can pull a little.
- **Retargeting** (`retarget_clips.py`). A clip is a rotation per bone, and a rotation means the same thing on two
  skeletons that start from the same orientation, so every bone's rotation keys are copied by name, unchanged. Distance
  is what does not carry over: the hips' travel (their bob and sway) is multiplied by the ratio of the two hip heights
  (Marco 1.15, Berta 0.63, Nico 0.50, Valentina 0.97, Bruno 1.01 of the Coach's), and the other bones keep their own
  offsets. Names, lengths and loops stay the Coach's. List them in `characters.json` as `"retargeted": [...]` and
  `rig-check.mjs` compares them with the Coach's frame by frame.
  - These are baselines: each character moves like the Coach, scaled. The planted foot stops sliding at a different ground
    speed on each body (Anim Bench's *Match*, m/s, Run / Walk): Coach 3.85 / 1.21, Marco 4.67 / 1.50, Berta 2.21 / 0.74,
    Nico 1.72 / 0.59, Valentina 4.00 / 1.28, Bruno 3.92 / 1.26. The game's walk and run speeds (`coach-model.mjs`) are the
    Coach's, so a character in the game needs its own.
- **Hip lift** (`ground_clips.py`). A walk or run often holds the body a little low, so the feet are cut off by the floor:
  the Coach's own Walk sinks 6.2 cm at its lowest and his Run 6.5 cm, and the retargeted clips inherited it. The tool plays
  each clip and lifts the hips, in every key, by the height that puts the lowest point of the mesh on the floor. Lifts in cm,
  Walk / Run: Coach 6.2 / 6.5, Marco 5.7 / 7.4, Berta 7.9 / 6.9, Nico 5.3 / 4.6, Valentina 5.1 / 6.0, Bruno 5.2 / 6.8. One
  height per clip cannot plant the foot in every frame: in the middle of a step the lowest foot hovers 1 to 4 cm (more in
  the airborne frames of a run), but never sinks. The idles already stand on the floor and are not touched. `rig-check.mjs`
  plays every clip on the skinned mesh and fails if its lowest point is more than half a centimetre above or below the floor.
- **Adding a clip to everyone later** (`transplant_clips.py`). `retarget_clips.py` brings all of the Coach's clips to a freshly
  rigged body, through Blender and out again; a character that is finished (grounded, with its own clip) is better left
  alone, so a new shared clip goes in at the file level. Make the clip on the Coach (`character_clips.py -- coach-panic.glb
  out.glb --character shared`), transplant it into his own file (K = 1) and into every other character's, then ground it on each
  (`ground_clips.py --only Panic`, which lifts the hips by 0.1 to 1 cm), list it in `characters.json` as `retargeted` and run
  `rig-check.mjs`, which compares it with the Coach's frame by frame (hips travel x0.50 on Nico, x1.15 on Marco). Start from the
  files without the clip: the tool will not overwrite one.
- **Panic** (`panic_clip()` in `character_clips.py`) is what every swimmer does when the pool closes or the queue is a mess:
  jumping on the spot without a pause, arms and hands thrown up and flapping, head tipped back and shaking. Two mirrored hops
  make the 24-frame loop (1 s at 24 fps, 0.5 s a hop): the hips follow a parabola 22 cm above standing on the Coach, the feet
  rise with them and tuck 9 cm more at the top, the hips sink 8.5 cm into bent knees on landing (the knees are never locked,
  or a knee would go from straight to 50 degrees in one frame), the arms go from a bent V at head height to straight up as the
  body rises (the right one 3 frames behind the left), one knee comes up higher and then the other, the hips and head twist
  to either side. The fastest bone turns 30 degrees a frame (the knees on landing). Everything is a number in the clip table, so
  a hop can be made higher or faster by changing `height`, `contact` and the 12-frame `hop`.
- **Swim** (`swim_clip()` in `character_clips.py`) is the freestyle crawl for every swimming guest and for the Coach in the
  water. It is made standing, like every clip: the game lays a swimmer on its front (head leading, belly down), so what the
  body does about its own long axis is what a swimmer does about the water. `characters.json` says `"clips": {"Swim":
  {"prone": true}}` and Anim Bench then shows it lying on its front, from the side. One stroke cycle is 24 frames (1 s at
  24 fps; the game plays it at 0.4 to 1.5 times that, with the swimmer's speed) and both arms make it, half a cycle apart:
  the hand goes round the shoulder, overhead (entering ahead of the head), down in front of the body for the pull (deep, the
  elbow bent and high), by the thigh, and back up shallow for the recovery (the hand skimming the water 0.4 of the reach out
  from the shoulder, so the elbow leads and sticks out). The body rolls 50 degrees toward the pulling arm (the shoulders
  first, the hips a little after), the head turns against the roll to stay in the water and 62 degrees out to the side once a
  cycle to breathe, and the feet kick in a six-beat flutter, 13 cm each way on the Coach. The hips do not move (`"breath": 0`
  switches off the breathing wobble every other clip has), and the fastest bone turns 31 degrees a frame. The elbow's
  direction (the pole) is one fixed direction, out and back, which is never along the arm: an elbow direction that lines up
  with the line from shoulder to wrist flips the arm.
- **Their own clips** (`character_clips.py`). Each of the five has one clip of its own, for the time it spends waiting to be
  assigned a lane (not wired into the game yet: the guests there are the five generic swimmers below): Marco `WaitWatch`
  (impatient: a long look at his watch, a sigh, hand on hip, looking around, a foot tapping, a second quick look),
  Berta `WaitChat` (hands clasped, rocking, looking about, a pat of her cap, a little wave), Nico `WaitFidget` (bouncing,
  arms swinging, a hand shot up to be noticed), Valentina `WaitWarmUp` (stretch, side bends, shoulder rolls, hips circle),
  Bruno `WaitNervous` (arms hugged round himself, a tug at his goggles and his vest strap, worried glances). They are
  listed as `"own"` in `characters.json`. To add one, add keys to `CLIPS`, build it, look at it in Anim Bench (the front,
  the side and the three-quarter view show different faults), and keep a bone from turning more than 40 degrees in a frame.
  Aiming a bone by the shortest turn from its rest direction flips near the opposite direction, which is where a
  folded arm goes: the script frames each bone by its direction and the way its joint bends instead.
- **The five generic swimmers** (`swimmer-boy`, `swimmer-tall-man`, `swimmer-woman`, `swimmer-heavy-man`,
  `swimmer-tall-woman`, in `dist/assets/`, where the game loads them too) are the unnamed guests: Meshy meshes of GPT Image 2.5 T-poses, goggles on
  their eyes, no mouth. Made the same way, one `game_export.py --height` each (1.58, 1.84, 1.70, 1.56, 1.86 m: the tall man's
  1.84 and the others in the proportions of the lineup the designs came from), then `rig_from_template.py` (no `--set`
  needed), `retarget_clips.py` (hip travel x0.89, 1.05, 1.03, 0.76, 1.14) and `ground_clips.py` (Walk / Run lifts in cm:
  boy +1.1 / +2.9, tall man -1.4 / -0.2, woman -1.5 / -0.6, heavy man +0.1 / +0.2, tall woman -1.7 / -0.9). They have only
  the Coach's four clips, which is all the game plays (`dist/scene/swimmer-models.mjs` adds the poses on top): the named, premium characters are the ones with clips of their own. Meshy modelled a smile on the
  boy (a lip groove with a dark inside): `fix_mouth.py` took it off the raw mesh before the pipeline (its header has the
  box he needed). The mesh's front-most point is not always the face, so `rig-check.mjs` lets the `headfront` marker stand
  up to 8 cm in front of a shallow head.
- Knee and elbow smoothing (`smooth_joints.py`) is not applied to these ten yet. Add it when a run shows tearing there.

## A character with a belly (Carl and the leopard man)

Carl (`carl`, `tools/viewer/models/carl.glb`; he is not in the game yet) is the man who does the cannonball: 1.70 m, very round
(the belly is 90 cm across, wider than his shoulders and hanging over short legs), messy hair, big worried eyes, no mouth. His
mesh is Meshy's from the T-pose picked for him (`game_export.py --height 1.70`, about 10k triangles), rigged on Coach Panic's
skeleton like the others (`rig_from_template.py`, `retarget_clips.py`, hip travel x0.70), and then four things a slim body never
needs:

```sh
tools/blender/round_character.sh retargeted.glb carl.glb      # all of the steps below, in one go
# or one by one:
tools/blender/run.sh tools/blender/belly_bones.py -- retargeted.glb belly.glb            # + BellyUpper, BellyMid, BellyLower, and the thighs off his back
python3 tools/blender/belly_jiggle.py belly.glb jiggle.glb                               # the belly's motion, in every clip
python3 tools/blender/clear_limbs.py jiggle.glb cleared.glb --arm-max 62                 # arms out of the belly, shins out of the behind
python3 tools/blender/cannonball_clip.py cleared.glb jump.glb                            # the one clip only he has
python3 tools/blender/clear_limbs.py jump.glb jump2.glb --only Cannonball --oneshot Cannonball --arms-only Cannonball --arm-max 70
python3 tools/blender/belly_jiggle.py jump2.glb jump3.glb --only Cannonball --oneshot Cannonball
tools/blender/run.sh tools/blender/ground_clips.py -- jump3.glb carl.glb --only IdleScan,IdleScratch,Panic,Run,Swim,Walk   # not the Cannonball
```

- **The belly bones.** Three bones, 27 in all, so the stomach can move on its own while the rest of him walks. 1609 vertices
  (the front of the belly, by height) are weighted to them; the back, the flanks behind the middle, the chest, thighs and arms
  keep the skin they had. Nothing in the game has to simulate it: `belly_jiggle.py` bakes the motion into the clips (the lower
  belly, the heaviest, goes up and down 3.5 cm in the Walk and 3.6 cm in the Run, 0.6 cm with each breath in the idles).
  `rig-check.mjs` knows them as `"extraBones": {"BellyUpper": "Spine01", ...}` in `characters.json`: they hang from the bone
  named, sit inside the body, carry skin, and the Walk and Run move them.
- **Arms and legs out of the body.** The arms of a retargeted clip hang by the sides and the heels kick up behind, which on his
  body is inside it (by up to 23 cm for the arms, in the Swim, and 24 for the legs, in the Run). `clear_limbs.py` turns each arm out about the shoulder and cuts
  the knee's bend just far enough: the arms by up to 35 degrees in the Walk and idles, 45 in the Run, 54 in the Swim; the knees by up to
  34% of the bend in the Run (51 degrees). Everything else of the clip (the swing, the rhythm, the loop) stays. What is kept out of
  is the torso as it is before the arm turns, to within 1.5 cm (skin resting on skin), and in the Walk, Run, IdleScan and Panic the
  forearms and hands end clear of it. The skin of the armpit and the flank follows the arm's own weights, so it is dragged out a little
  with the arm, and measured against the torso so deformed (the report prints that too) the upper arm rests on the belly's flank, up to
  5 cm into it in a few frames of the Walk, Run and idles: an arm pressed against a soft belly. Holding it clear of that as well takes
  about 20 degrees more turn (the arms held out like a wrestler's). In the Swim a hand rests on the belly for a few frames of each
  stroke (up to 5 cm into it) and in IdleScratch the scratching arm's elbow is up to 3 cm into it. The manifest says
  how far a clip may differ from the Coach's: `"adjusted": {"LeftArm": 55, "RightArm": 55, "LeftLeg": 55, "RightLeg": 55}` (degrees).
  The torso is measured as a volume (`skinpose.Volume`), because a surface normal says nothing at a fold; the noise floor of
  the measure is 1.2 to 1.7 cm, which is why the tolerance is 1.5.
- **Cannonball** (`cannonball_clip.py`, 55 frames, 2.25 s, plays once and is made in place: the game moves him). The pose
  respects his body instead of forcing a textbook tuck: a deep crouch, feet wide, arms swung back, the belly leaning forward over
  the knees (frames 6 to 13), a beat, then the push (frames 14 to 20: the hips rise 23 cm to the tiptoes, the arms swing up in
  front, the chest first), the takeoff at 2.9 m/s (0.42 m up), and in the air the thighs come up under and beside the belly only as
  far as it lets them, the lower legs folded underneath and the feet pointed, the arms down and out round the belly with the
  elbows wide and the hands resting on its flanks beside the knees, the shoulders rounded, the back curled (never folded over the
  legs) and the head tucked to look at the water. The tuck is held at the top (frame 27) and the body falls at 9.8 m/s^2; the
  tucked body's lowest part, the feet under the belly, reaches the water 0.25 m below the deck at frame 37, the pelvis rocks back,
  the water throws his arms out and his head up, and he sinks and slows while the belly goes on without him
  (`belly_jiggle.py --oneshot`). It is not grounded (`ground_clips.py` would lift it by the depth he sinks). His hands cannot
  really hold his shins: his arms are 53 cm long, the belly is wider than they reach round and his knees end up under it.
  `characters.json` marks it `"water": {"level": -0.25, "run": {"from": 20, "to": 37, "metres": 1.7}}`: Anim Bench shows it over
  a pool and runs him off the deck between those frames (see `tools/viewer/README.md`), and `rig-check.mjs` checks that the clip starts on the floor, jumps, tucks, falls
  at gravity's acceleration, is slowed by the water and ends well under its surface. The knees snap straight in the push-off and fold up in the tuck at about 40 degrees a frame
  (`"pop": true`).

- **The leopard man** (`leopard-man`, `tools/viewer/models/leopard-man.glb`; the name is a placeholder) is the second round character:
  bald with a curl of hair over each ear, thick brows, big white eyes, a mustache (no mouth), leopard-print briefs, from the T-pose
  the user supplied (Meshy 7, 10.4k triangles, `game_export.py --height 1.70`). His proportions are Carl's to within a few centimetres
  (hips 0.56 m, a belly 0.94 m across and 0.39 m forward of the spine at its fullest, the same height of belly), so everything above
  applies unchanged and `round_character.sh retargeted.glb out.glb` runs the whole chain. What differs: hip travel x0.69 against the
  Coach, the arms turned out by up to 33 degrees (Walk, idles), 34 (Run), 51 (Swim), the knees cut by up to 45 degrees in the Run, and
  the tucked body hangs 0.114 m above the floor (Carl's 0.124: `cannonball_clip.py` measures it on each body), so the splash is at the
  same frame, 37. His Cannonball is Carl's, made on his body.

## Rigging notes

- The mesh should stand on the floor in a T-pose or A-pose facing the front (glTF +Z, Blender -Y), which is what
  Tripo and Meshy produce. Bone positions come from body proportions (`PROPORTIONS` in `humanoid_rig.py`): check the
  result with `turntable.py --animation Walk` and adjust them for a stylised body.
- Custom bones (a jetpack, a weapon socket) are one `bone(...)` line each in `build_armature`.
- After rigging, `inspect_model.py` should show one weight group per bone and the `Walk` clip.
- Blender's glTF importer leaves bone-shape helper meshes in a `glTF_not_exported` collection; `common.meshes()`
  ignores them.

## Tried so far

A generated stand-in character: rigged (19 bones, every vertex weighted), walk cycle exported, re-imported, a turntable
MP4 rendered with the clip playing (24 frames at 400 px, about two minutes on 4 CPU cores).

Five Meshy characters rigged on Coach Panic's skeleton with `rig_from_template.py`: `rig-check.mjs` finds the Coach's 24
bones (names, hierarchy, rest rotations identical to a rounding error), a consistent bind pose and weights that add up to
one; each was posed in Blender (legs wide, arms down, elbows bent) without tearing. The Coach's four clips went onto all
five with `retarget_clips.py` (every bone's rotation identical to the Coach's to a rounding error at every frame, the hips'
travel scaled and nothing else, mesh and skin untouched) and were played in Anim Bench: they loop, nothing snaps beyond the
Coach's own Run knee, and no head, hair, cap or belly tears. `ground_clips.py` then stood all six on the floor: only the
hips' height keys of the Walk and Run changed (126 bytes in each file), and in the real game the Coach's lowest point on
the deck went from 5 to 6 cm under it to level with it.
