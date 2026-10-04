# Anim Bench

An internal page for previewing animated characters in a browser, with the game's own three.js (r170). It replaces
recording videos: pick a character, click a clip, scrub, slow it down, orbit around it.

What it shows for every clip: length and frames (24 fps), whether the last pose equals the first (**loops clean** or
**open loop**), whether any bone turns more than 40 degrees in one frame (**pop?**), and, for walks and runs, the ground
speed at which the planted foot stops sliding. The Ground slider scrolls a 1 m grid under the character so sliding is
visible; **Match** sets it for you. Blend is the crossfade length used when switching clips, as the game will do.

Anything can be previewed without publishing: drop a `.glb` on the page, or use **Open .glb**.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page, written as a fragment: the artifact host adds the document, head and body |
| `viewer.js` | The app |
| `characters.json` | The characters the page lists: `{id, name, file, note, clipFiles?, clips?, skeleton?, extraBones?, adjusted?, retargeted?, own?, premium?}` |
| `models/*.glb` | Characters that are only in the viewer. A character's `file` in `characters.json` is found from this folder, so Coach Panic's is the game's own `../../dist/assets/coach-panic.glb`, and so are the five generic swimmers' (`../../dist/assets/swimmer-*.glb`), the two cannonball men's (`../../dist/assets/carl.glb`, `leopard-man.glb`) and Karen's (`../../dist/assets/models/karen.glb`: her own 19-bone skeleton, not Coach Panic's, so she names no `skeleton`) |
| `vendor/` | three r170's `GLTFLoader`, `OrbitControls` and `BufferGeometryUtils`, untouched |
| `build.sh` | Assembles `.build/` (the flat folder that is published); takes `three.module.js` from `dist/assets` |

`npm test` runs `viewer-check.mjs`: every listed GLB has a skin, uniquely named clips that loop clean and never snap a
bone, and the build is complete. A character that is only a mesh (no rig yet) is listed with `"static": true`. A clip that is meant to open or pop can say so in `characters.json`:
`"clips": {"Fall": {"open": true}}`.

A character rigged on another's skeleton (`rig_from_template.py`) says so with `"skeleton": "coach-panic"` (the `id` of the
character whose skeleton it copies). `rig-check.mjs`, also run by `npm test`, then checks it has that character's bones,
rest rotations, a consistent bind pose and weights that add up to one. Clips taken from that character
(`retarget_clips.py`, or `transplant_clips.py` for a clip added later) are listed as `"retargeted": ["Run", "Walk"]`, and `rig-check.mjs` compares each with the original
frame by frame, and fails any clip whose lowest point is off the floor (`ground_clips.py`). Clips made for the character itself (`character_clips.py`) are listed as `"own"`. A rigged character may have no clips yet: the viewer shows it in its T-pose, and the **Skeleton** button
draws the bones.

A clip made to be played lying on the front (a swim: the game lays the swimmer down, so the clip is made standing) says
`"clips": {"Swim": {"prone": true}}`. The page then shows the character lying on its front, floating over the grid, from its
right side with the head on the right, while the clip plays (and stands it up again for any other clip), marks the clip
"lying down", hides the name plate and gives it no ground speed.

A character with bones of its own on top of the template's (Carl's three belly bones, `tools/blender/belly_bones.py`) lists them as
`"extraBones": {"BellyUpper": "Spine01", "BellyMid": "Spine02", "BellyLower": "Hips"}` (name: the bone it hangs from), and
`rig-check.mjs` checks they hang from it, sit inside the body, carry skin and move in the Walk and Run. Clips taken from the template
that were changed on purpose (the arms swung out of a belly, the knees' bend cut: `tools/blender/clear_limbs.py`) say how far a bone
may differ from the template's, in degrees: `"adjusted": {"LeftArm": 55, "RightArm": 55, "LeftLeg": 55, "RightLeg": 55}`; every
other bone must still be the template's, exactly.

A clip that ends in the water (Carl's cannonball: made on the deck, falls into water 0.25 m below it) says
`"clips": {"Cannonball": {"open": true, "water": {"level": -0.25, "run": {"from": 20, "to": 37, "metres": 1.7}}}}`. Such a clip does not
loop (`open`) and is not grounded; `rig-check.mjs` checks that it starts on the floor, jumps, tucks its legs, falls at gravity's
acceleration, is slowed by the water and ends well under the surface. The clip is made in place (the game moves its characters), so
the page turns into a pool while it plays: the floor ends at an edge with the pool wall under it, translucent water lies at
`level`, and the character is carried forward `metres` between the frames `from` and `to` (a steady speed, from 0.9 m behind the edge)
so the fall ends over the water. The camera frames the whole jump from the right, and the clip is marked "into the water".

A named character that matters more than the generic swimmers says `"premium": true`. The page then floats a gold plate
over its head with a star, **Premium** and its name, which is how the game will mark those guests. The plate is placed from
a fixed point just above the character (not the head bone), so it stays still in a run, and the camera is framed to leave it
room: a character is fitted between the readouts at the top and bottom of the stage, from whichever side the camera is on.

## Adding a character or an animation

**Every character that goes into the game goes into `characters.json` too**, or it is not on the bench: Karen came into the game from another branch and was missing from the list until the creator asked where she was. `viewer-check.mjs` names the clips that need a flag (`open` for a one-shot, `pop` for a bone that turns more than 40 degrees a frame: Karen's Defeated and Complain).

1. Make the GLB with the Blender tools (`tools/blender/README.md`): `polish_walk.py`, `idle_clips.py`, `game_export.py`.
2. Put it in `models/` (or point `file` at the game's copy, as Coach Panic does) and add it to `characters.json`. More clips for the same rig can live in their own GLBs:
   list them as `"clipFiles": ["models/coach-panic-run.glb"]` (bone names must match).
3. `tools/viewer/build.sh`, then look at it locally:
   `python3 -m http.server 8766 --directory tools/viewer/.build`.
4. Publish. The page is an Artifact (private to the account that published it). Publish `.build/index.html` with every
   other file in `.build/` as a supporting file at the same relative path, and update the artifact in place (same URL):

   ```
   Artifact publish  url=<the artifact URL below>  file_path=tools/viewer/.build/index.html  root=tools/viewer/.build
     files=[viewer.js, three.module.js, GLTFLoader.js, OrbitControls.js, BufferGeometryUtils.js, characters.json,
            models/<name>.glb.b64.txt for each model]
   ```

   The artifact host serves no `.glb`, which is why `build.sh` writes each model as base64 text and the viewer decodes it.
   Files that are left out of a publish are kept, so a new model only needs `characters.json` and its own `.b64.txt`.

The artifact's URL is at the bottom of this file.

## Notes

- The artifact page may only load scripts from its own files and a few CDNs, and may not `fetch` anything else. So
  three.js is published next to the page, the loader's add-ons have their imports pointed at it by `build.sh`, and a GLB's
  textures are decoded with `<img>` (the loader is told `createImageBitmap` does not exist while it parses).
- The character faces +Z (glTF's front). Left is +X.
- Only the fonts come from outside (Google Fonts); if they fail to load the page falls back to system fonts.

## Artifact

https://claude.ai/artifact/FdaiNse3giSZFDnUDXNMJR (private to its owner; share it from the page's Share menu).
