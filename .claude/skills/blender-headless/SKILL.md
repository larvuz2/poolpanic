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
   - `turntable.py -- model.glb out_dir --animation Walk`: `still.png` and `turntable.mp4`. With `--static --angle 35`
     the camera stays still and the clip loops (what a person wants when judging an animation).
   - `polish_walk.py -- in.glb out.glb`: a Mixamo-style walk (Meshy, Tripo) gets a seamless loop and arms that hang close
     to the body and swing opposite the legs, and is named `Walk`. Run it before `game_export.py`.
   - `idle_clips.py -- in.glb out.glb`: adds `IdleScan` (head turns left/right, alert) and `IdleScratch` (the same, then a
     head scratch) to the file, next to the walk. Every bone is keyed so clip switches in the game never leave a bone behind.
   - `merge_clips.py -- base.glb out.glb more.glb`: add the clips of other GLBs (same rig) to a character.
   - `rig_from_template.py -- body.glb rigged.glb`: a T-pose biped (Meshy, Tripo) gets Coach Panic's own 24-bone skeleton,
     fitted to its body, with skin weights and no clips. Use it instead of `humanoid_rig.py` or Meshy's rigging for any
     human-shaped character, because the Coach's animations then retarget onto it by bone name (copy the rotation
     tracks, scale the Hips travel). Shorts can fool the crotch landmark: `--set y_crotch=0.70` (metres). `node
     rig-check.mjs` verifies the result. Details: "More characters on the same skeleton" in `tools/blender/README.md`.
   - `smooth_joints.py -- in.glb out.glb`: extra rings and smooth weights at knees and elbows, so deep bends (a run) do
     not tear the mesh. Run it before `game_export.py`.
   - `game_export.py -- in.glb out.glb --tex 1024`: shrink textures, keep every clip, print triangles, clips and size.
3. **Check before handing over.** Inspect the rigged file (one weight group per bone, the clip present), then preview it
   on the web instead of recording a video: copy the GLB into `tools/viewer/models/`, list it in
   `tools/viewer/characters.json`, run `tools/viewer/build.sh` and update the Anim Bench artifact (`tools/viewer/README.md`
   has the exact publish call and the URL). It shows every clip with scrub, speed, loop and pop checks and ground speed.
   A still from `turntable.py` is fine for a quick look; send the GLB itself when the user wants the file.
4. **Limits.** CPU only: rigging, weights, keyframes, previews and glTF export are fine; heavy Cycles renders and
   sculpting are not. Mixamo clips and AI auto-rig APIs (Tripo, Meshy on fal) are the shortcut for a plain rigged
   character; use this for custom bones, fixes and own animation.
5. **Game use.** The game is a static three.js site (`dist/`), so a finished GLB goes under `dist/assets/` and is loaded
   with three's GLTFLoader; clips come through as `gltf.animations`.
