---
name: blender-headless
description: Run Blender headless in this sandbox to rig a mesh with a humanoid armature, build a walk cycle, render a turntable preview (PNG/MP4) and export glTF/GLB. Use when asked to rig, animate, inspect, preview or convert a 3D model (Tripo, Meshy, Mixamo, any GLB/FBX/OBJ).
---

# Headless Blender

Everything lives in `tools/blender/` (see its README). The person never touches Blender: they ask, this renders a
preview they can check on any device and exports the glTF.

1. **Setup (once per session).** `tools/blender/setup.sh` installs Blender 4.5 into `/opt/blender` and the graphics
   libraries it needs. It does nothing when `blender --background --version` already works.
2. **Run a script.** `tools/blender/run.sh tools/blender/SCRIPT.py -- args`.
   - `inspect_model.py -- model.glb`: what is in a model.
   - `humanoid_rig.py -- in.glb out.glb --walk`: armature fitted to the mesh, auto weights, looping walk clip, GLB out.
   - `turntable.py -- model.glb out_dir --animation Walk`: `still.png` and `turntable.mp4`.
3. **Check before handing over.** Inspect the rigged file (one weight group per bone, the clip present) and look at the
   turntable still and a frame of the walk; send the user the PNG/MP4 from the scratchpad or an artifact.
4. **Limits.** CPU only: rigging, weights, keyframes, previews and glTF export are fine; heavy Cycles renders and
   sculpting are not. Mixamo clips and AI auto-rig APIs (Tripo, Meshy on fal) are the shortcut for a plain rigged
   character; use this for custom bones, fixes and own animation.
5. **Game use.** The game is a static three.js site (`dist/`), so a finished GLB goes under `dist/assets/` and is loaded
   with three's GLTFLoader; clips come through as `gltf.animations`.
