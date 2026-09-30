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
| `game_export.py -- in.glb out.glb [--tex 1024] [--quality 85]` | Game-ready GLB: textures shrunk to JPEG, skin and every clip kept under its own name; prints the triangle count, the clips and the size |
| `idle_clips.py -- in.glb out.glb [--scan 42] [--hang 8] [--only IdleScan\|IdleScratch]` | Adds two looping idle clips to a T-pose humanoid (Meshy, Tripo): `IdleScan` (4 s, breathes and turns the head left and right) and `IdleScratch` (6 s, the same, then scratches the back of the head with the right hand). Every bone is keyed, so switching clips in the game leaves nothing behind |
| `humanoid_rig.py -- in.glb out.glb [--walk] [--frames 24] [--height M]` | Fits a 19-bone humanoid armature to the mesh, automatic weights, optional looping walk cycle named `Walk`, exports GLB with skin and animation |
| `make_test_humanoid.py -- out.glb` | A blocky stand-in character (T-pose, 1.8 m) for trying the pipeline without a real mesh |

`common.py` holds what they share (import any of glTF/GLB, FBX, OBJ, blend; bounds; lights; camera; engine choice).

## A Meshy character for the game

Generate with `fal-ai` `meshy/v7/image-to-3d` (`enable_rigging`, a modest `target_polycount`), then:

```sh
tools/blender/run.sh tools/blender/polish_walk.py -- walking.glb walk.glb            # clip "Walk": seamless loop, natural arms
tools/blender/run.sh tools/blender/idle_clips.py -- walk.glb clips.glb               # adds IdleScan and IdleScratch
tools/blender/run.sh tools/blender/game_export.py -- clips.glb coach-panic.glb --tex 1024
tools/blender/run.sh tools/blender/turntable.py -- coach-panic.glb out --animation IdleScratch --static --angle -35
```

Every clip loops: its last frame is its first again, so a game plays frames 0 to N (three.js does this by itself) and a
preview shows 0 to N-1. `turntable.py --static` does that, and `--angle` is where the camera stands (0 the front, 90 the
character's left side, -35 a three-quarter view of his right).

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
