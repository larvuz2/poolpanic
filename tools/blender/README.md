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
| `rig_from_template.py -- body.glb rigged.glb [--template dist/assets/coach-panic.glb] [--set y_crotch=0.70] [--debug joints.json] [--tex-quality 90]` | Rigs a T-pose humanoid with another character's skeleton (Coach Panic's 24 bones): same names, hierarchy and rest rotations, joints moved to fit the body, skin weights worked out for the new mesh. No animation is added; the template's clips retarget onto it by bone name. Uses `rigfit.py` (measures landmarks on a mesh, places joints by the template's proportions) |
| `make_test_humanoid.py -- out.glb` | A blocky stand-in character (T-pose, 1.8 m) for trying the pipeline without a real mesh |

`common.py` holds what they share (import any of glTF/GLB, FBX, OBJ, blend; bounds; lights; camera; engine choice).

## A Meshy character for the game

Generate with `fal-ai` `meshy/v7/image-to-3d` (`enable_rigging`, a modest `target_polycount`), then:

```sh
tools/blender/run.sh tools/blender/polish_walk.py -- walking.glb walk.glb            # clip "Walk": seamless loop, natural arms
tools/blender/run.sh tools/blender/idle_clips.py -- walk.glb clips.glb               # adds IdleScan and IdleScratch
tools/blender/run.sh tools/blender/merge_clips.py -- clips.glb all.glb run.glb       # adds clips from another file (Meshy's Run, after polish_walk.py --name Run)
tools/blender/run.sh tools/blender/smooth_joints.py -- all.glb smooth.glb            # knees and elbows that bend without tearing
tools/blender/run.sh tools/blender/game_export.py -- smooth.glb coach-panic.glb --tex 1024
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
tools/blender/run.sh tools/blender/rig_from_template.py -- body.glb marco.glb            # 24 bones + skin weights, no clips
node rig-check.mjs                                                                         # same bones, bind pose and weights as the Coach
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
- **Retargeting a clip** (not built yet; the rig is made first). A clip is a rotation per bone, and a rotation means the
  same thing on two skeletons that start from the same orientation, so: copy every bone's rotation track by name;
  multiply the Hips translation by the ratio of the two hip heights (Marco 1.15, Berta 0.63, Nico 0.50, Valentina 0.97,
  Bruno 1.01 of the Coach's); do not copy the translation tracks of the other bones; and scale the game's walk and run
  speeds for the stride (they are the Coach's, so the feet would slide on a child). Playing the Coach's Run, Walk and
  IdleScratch on all five rigs in Blender this way looked right, with the Hips scaled and nothing else changed.
- Knee and elbow smoothing (`smooth_joints.py`) is not applied to these five yet. Add it when a run shows tearing there.

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
bones (names, hierarchy, rest rotations within 0.04 degrees), a consistent bind pose and weights that add up to one; each
was posed in Blender (legs wide, arms down, elbows bent) without tearing, and the Coach's Run, Walk and IdleScratch were
played on all five with only the Hips travel scaled.
