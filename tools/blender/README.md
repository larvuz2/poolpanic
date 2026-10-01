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
| `character_clips.py -- in.glb out.glb --character marco [--only WaitWatch]` | Adds a character's own clips to a character on Coach Panic's skeleton (the clips of the file stay). A clip is a list of keys per control (the wrist's target and the elbow's direction for each arm, the hips, spine and head turns, where the head looks, a foot lifting for a tap) written in the `CLIPS` table of the script, and every frame is solved: arms by two-bone IK in fractions of the arm's reach, so one pose fits a tall swimmer and a child, legs with the feet held where they stand and the knees bending to the hips. Every bone is keyed, the clip loops. Run `ground_clips.py` after it. `--character shared` is the table of clips every character gets (Panic), made on Coach Panic and moved to the others with `transplant_clips.py` |
| `transplant_clips.py SOURCE.glb TARGET.glb OUT.glb --only Panic [--scale K]` | Plain Python (no Blender): adds clips of one GLB to a finished character on the same skeleton and changes nothing else in the file (the mesh, skin, textures and the other clips stay byte for byte). Rotation keys are copied by name, the hips' travel is scaled by the ratio of the two hip heights (or `--scale`), and a bone's translation is carried as its offset from its own rest position, since glTF stores the whole local translation. Refuses a skeleton that differs or a clip the target already has. Run `ground_clips.py --only Panic` after it |
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
