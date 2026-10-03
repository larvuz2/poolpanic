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
| `turntable.py -- model.glb out_dir [--frames 48] [--size 480] [--engine eevee\|workbench\|cycles] [--animation NAME] [--still-frame N] [--no-mp4]` | `still.png` and `turntable.mp4` (the camera circles the model; `--animation` plays a clip meanwhile) |
| `humanoid_rig.py -- in.glb out.glb [--walk] [--frames 24] [--height M]` | Fits a 19-bone humanoid armature to the mesh, automatic weights, optional looping walk cycle named `Walk`, exports GLB with skin and animation |
| `karen_rig.py -- raw.glb out.glb [--tris N] [--tex PX] [--height M] [--debug DIR]` | The whole pipeline for one character (Karen): decimate, scale, shrink the texture, fit the skeleton by measured proportions, skin by distance (for meshes whose pieces do not touch, where `humanoid_rig.py`'s automatic weights fail), and write five clips by aiming limbs along directions. `--debug` renders the fit and key frames. A good template for the next character |
| `karen_bagcheck.py -- karen.glb` | Poses every frame of every clip and counts right-arm vertices inside her bag |
| `make_test_humanoid.py -- out.glb` | A blocky stand-in character (T-pose, 1.8 m) for trying the pipeline without a real mesh |

`common.py` holds what they share (import any of glTF/GLB, FBX, OBJ, blend; bounds; lights; camera; engine choice).

## Rigging notes

- The mesh should stand on the floor in a T-pose or A-pose facing the front (glTF +Z, Blender -Y), which is what
  Tripo and Meshy produce. Bone positions come from body proportions (`PROPORTIONS` in `humanoid_rig.py`): check the
  result with `turntable.py --animation Walk` and adjust them for a stylised body.
- Custom bones (a jetpack, a weapon socket) are one `bone(...)` line each in `build_armature`.
- After rigging, `inspect_model.py` should show one weight group per bone and the `Walk` clip.
- Blender's glTF importer leaves bone-shape helper meshes in a `glTF_not_exported` collection; `common.meshes()`
  ignores them.

## Tried so far

Karen (the complaining visitor): a Meshy 7 mesh (fal `meshy/v7/image-to-3d`) from a single T-pose image, rigged and animated with `karen_rig.py` (Idle, Walk, Complain, Point, Defeated), exported to `dist/assets/models/karen.glb` at 2 MB and played in the game with three's `AnimationMixer`. Lessons: bone-heat weights failed outright (non-touching pieces); limbs skin better by position along the limb than by distance; **weld coincident vertices before smoothing weights** (glTF imports leave two at every UV seam, and smoothing them apart cracks the seams into streaks); posing by direction vectors is far easier than bone-local Euler angles; and `karen_bagcheck.py` shows how far a prop forces the arms out.


A generated stand-in character: rigged (19 bones, every vertex weighted), walk cycle exported, re-imported, a turntable
MP4 rendered with the clip playing (24 frames at 400 px, about two minutes on 4 CPU cores).
