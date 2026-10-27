# The Community Pool: the look

The art direction for the Godot test's first venue (27 October 2026). The creator's brief: AAA indie detail, crafty and well thought
out, no empty spaces or empty walls; every asset made in Blender; a real difference from the three.js game.

## The idea: the Harbourside Community Swim Club

A 1960s seaside-town pool, loved and lovingly restored. It is late afternoon:

- **Light.** A low golden sun pours through a long wall of tall steel-framed windows and a skylight. The warm, humid air makes its
  shafts visible, and the light bounces off glazed tiles and dances off the water.
- **Materials.** Sand-coloured non-slip deck tiles, sea-green glazed wall tiles with a navy band, cream stone coping, honey timber,
  white-painted steel.
- **Accents.** Coral (life rings, the starting blocks' wedges, lane-rope ends), mustard (the lifeguard chair, signage) and navy (lane
  lines, lettering).
- **Character.** Things a real club accumulates: trophies, notices, lost property, kickboards in racks, a vending machine that
  hums, plants someone waters. It should feel used and cared for, never dirty.

**Style.** Stylised realism, the "toy diorama" look of the best indie management games: real materials and real light on
simplified, chunky, bevelled shapes. No hard 90° edges (bevel everything), no noisy grime. Colours stay saturated but warm.

## The pipeline

- **Blender scripts:** `godot/tools/blender/*.py` (Blender 4.5 LTS, `blender -b -P <script>`).
  - `lib.py`: the palette (`PALETTE`), materials, bevelled boxes and cylinders, tubes, text, export, preview renders.
  - `textures.py`: the tiling texture sets.
  - `build_shell.py`: the building.
  - `props_*.py`: the props.
  - `assemble.py`: renders the room with every placed prop, to check placement and scale fast.
  - The props:
    - `props_pool.py`: blocks, ladders, floats, flags.
    - `props_floor.py`: paint and mosaic on the deck.
    - `props_stations.py`: the gameplay furniture.
    - `props_lockers.py`: the changing rooms.
    - `props_dressing.py`: the edges.
    - `props_kit.py`: small shared items.
  - `exterior.py`: the garden.
  - `mural.py`.
  - `build_all.sh` runs them all.
  - `props_dressing_textures.py` draws the dressing's signs and posters with Pillow under the system Python 3 (Blender's Python
    has no Pillow). The prop scripts run it when a texture is missing.
- **Exports:** to `godot/assets/venue/` (the shell) and `godot/assets/venue/props/<name>.glb` (one prop per file). `export()`
  merges each prop into one mesh per material (except the parts named below), so a prop costs a few draw calls.
- **Placement:** in `godot/data/placements/<group>.json`, a list of
  `{"asset": "props/<name>.glb", "pos": [x, y, z], "rot": <degrees about y>, "scale": 1, "note": "..."}`.
  - The front of a prop (Godot +Z) turns to face (sin rot, 0, cos rot).
  - rot 0 faces +Z, 90 faces +X, −90 faces −X, 180 faces −Z.
  - Godot (`scripts/club/club_scene.gd`) loads them all.
- **Conventions:**
  - Metres.
  - Model a prop with its pivot on the floor at the centre of its footprint, its front facing Blender −Y (Godot +Z).
  - `g(x, y, z)` in `lib.py` turns a Godot position into Blender's.
- **Materials:**
  - Use the palette by name (`mat("coral")`, `mat("steel")`…) or a new named one.
  - `GD_` materials are replaced in Godot by world-space tile shaders: `GD_deck`, `GD_pool_tile`, `GD_wall_sea`, `GD_wall_navy`,
    `GD_wall_cream`, `GD_plaster`, `GD_timber`, `GD_terrazzo`, `GD_deck_band`, `GD_waterline`. Use them for large tiled or timber
    surfaces (`gdmat("terrazzo")` in `lib.py`).
  - Image textures (signs, posters, labels) go in `godot/assets/textures/` and are embedded in the GLB.
- **Object names Godot reads:**
  - `ShadowOnly_*`: casts shadows, never seen.
  - `Glass_*`: transparent, casts no shadow.
  - `Light_*`: a small warm light is added at its centre.
  - `UnderwaterLight_*`
  - `Door`: a node that swings (its pivot on the hinge).
  - `Fins_1..3`: hidden as the rack empties.
- **Budget:**
  - A prop under about 15k triangles, most well under; bevel segments 2–3.
  - Instanced things (lane floats, pennants) are tiny.
  - Textures 1024² at most.

## The room (Godot coordinates; all positions from `godot/data/club-venue.json`)

**Bounds:**

- Room: x −14.7…14.7, z −16.7…13.5.
- Deck top: y 0. Walls: 9.6 m high.
- The pool: x ±5, z ±8.3, water at y −0.25, floor sloping from 1.85 m deep at the −Z end (the starting blocks) to 1.1 m at +Z.

**The camera** looks across the pool from −X toward +X, about 50° down, so screen up is +X and screen right is +Z. It mostly sees:

| Part of the frame | What it shows |
| --- | --- |
| The middle | The deck and the pool |
| The top edge | The foot of the +X window wall (its tiles, radiators and anything at its foot) |
| The upper-left corner | The −Z wall's right half (x 0…14.7) and the +X locker bay |
| The bottom edge | The near deck to about x −9.6 (the −X side, its benches and the fins rack) |

The −X wall is never seen (it only casts its shadow), nor is the roof (its skylight and beams cast the sun's patterns).

**Walls:**

| Wall | Treatment |
| --- | --- |
| −Z, behind the blocks | Glazed sea-green tiles to 1.6 m, a navy band, a cream row, a timber dado rail at 1.97 m, warm plaster above. Pilasters at x ±7.85; a mural between them, y 2.35–7.15. The locker bays fill the corners. |
| +X, the window wall | Tiles to 1.6 m, a timber sill at 2.1 m. Six windows 4 m wide from 2.1 to 8.4 m, centred at z −13.81, −8.93, −4.04, 0.84, 5.73, 10.62. A cream radiator under each window, at x ≈ 14.57, z = centre ± 1.1. Plaster piers between the windows. |
| +Z, the far end | Tiles and plaster, a cornice |
| −X, the near wall | Never seen |

**The walkable deck** is gameplay: the coach and the guests walk everywhere except inside the furniture's footprints. So:

- **New 3D dressing goes where nobody walks:**
  - the strip along the −Z wall, z −16.7…−15.45;
  - the strips along the other walls, beyond |x| 14.1 and z 12.65;
  - on the walls themselves;
  - inside the furniture footprints below.
- **On the open deck, dressing is flat:** paint, inlaid mosaic, drains, rubber mats.
- **Nothing on the deck may look like a wet spot**, which is a gameplay hazard: no puddles as decoration.

### The gameplay furniture (footprints are exact: build each to fill its box)

| Thing | Centre (x, z) | Half size (x, z) | Notes |
| --- | --- | --- | --- |
| Bench | (−10.2, −0.9) | 0.49 × 1.7 | a rescued swimmer rests on the one at (−10.2, −0.25) |
| Bench | (10.3, −0.5) | 0.49 × 1.7 | |
| Bench | (−9.8, 3.3) | 0.49 × 1.7 | |
| Fins rack | (−10.3, 7.8) | 0.48 × 1.03 | 3 pairs |
| Chlorine station | (10.8, 7.8) | 0.6 × 0.9 | |
| Eye-relief (first-aid) station | (10.8, 3.9) | 0.9 × 0.6 | |
| Plant | (−13, 10.6) | 0.5 × 0.5 | |
| Drinking fountain | (−12.9, 5.5) | 0.54 × 0.5 | |
| Lifeguard chair | (12.2, −7.3) | 0.6 × 0.7 | the flashlight hangs on it, (11.2, −7.3) |
| Office counter (desk) | (13, 9.5) | 0.6 × 1.4 | |
| Treat table | (−13.4, 8.4) | 0.36 × 0.36 | dog treats, for the dog incident |
| Waste bin | (−12.5, 1.5) | 0.62 × 0.62 | |
| Mop bucket | (12.6, −11.6) | 0.34 × 0.34 | |
| Skimmer rack | (−13.5, −1.9) | | on the −X wall, x −14.55 |
| Life rings | (−4, −15.7) facing +Z; (−14.35, −5) facing +X; (14.35, 5) facing −X | | |
| Fish net | (14.35, −2.6) | | on the +X wall |
| Fuse box | (14.4, 12.05) | | on the +X wall |
| Locker bays | x ±8.05…±13.35, z −16.46…−13.66 | | side walls 0.3 thick at x ±8.05 and ±13.35; back wall to z −15.9; a bench at z −15.17 (half 1.55 × 0.36). The bay is an open alcove toward the pool (the coach can walk in), with a door in its inner wall at z −14.4 through which the guests come out. |
| Starting blocks | (−3.2 / 0 / 3.2, −9.15) | | |
| Ladders | (−5, 5), (5, −4.1) | | |
| Backstroke flags | x ±6, z ±5.7 | | |
