# The Lazy River's assets (three.js)

The scripts that make the Lazy River's dressed look for the three.js game (`dist/scene/riverclub.mjs`, README "The Lazy River
dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from the game's own plan:
`plan.mjs` writes it (the river's centreline sampled every 0.25 m with its flow and its left normal, its half-width, the seen
stretch, the bridge, the stepping stones, the docks and the tube return; the deck and the room, the jungle gate, the queue's
places, the evacuation spots, the furniture, stations and fixtures, the rings' mounts) from `dist/spatial.mjs` into the work folder,
and `kit.py` reads it (`at(s)`, `point(s, d)`, `locate(x, z)`: the river's own frame). What moves stays the game's
(`dist/scene/river.mjs`): the river's water and its flow, the waterfall and its mist, the flames (at the model's `Anchor_Flame`
places: every torch, the totems, the temple's bowls and the camp fire), the parrots, the tubes on the rack; the life rings and the
torch at their anchors as before; the gate's leaves are the model's (`Door_A`/`Door_B`).

    tools/venues/river/build_all.sh        # every step below, into dist/assets/river-club/

**Its materials are photographic.** Seven materials were painted once on fal as flat, even-lit photographs (the prompts below)
and are made seamless here (`river_textures.py`): the picture is blended with itself shifted by half, in a band along the edges
whose line is broken by noise, so no straight seam shows; each gets a normal map from its own relief (its luminance minus a
blurred copy, so the joints, grain and pebbles stand out and the photograph's slow shading does not tilt the normals). All seven are
packed at 1024 pixels (`SHARP_TILES`: the other venues keep only their deck and basin that sharp), the normals at 512.

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `river_textures.py` (Blender's numpy) | from the fal photographs: the sandstone flagstones, the carved temple stone, the wet mossy river rock, the river's bed of sand and pebbles, the hardwood planks, the lashed bamboo, the leaf litter (each with its normal map); from the earlier venues' scripts: thatch, canopy and bush tufts, palm fronds |
| The painted pieces | `painted.py` (python3 with Pillow and numpy) | the Lazy Idol keyed into a cut-out; the foliage sheet cut apart (three monstera leaves, two banana leaves, the liana, heliconia, bird of paradise, bromeliad); the explorer's map and the travel poster into the signs |
| Signs | `signs.py` (python3 with Pillow) | boards cut from the planks photograph and a lintel from the temple stone: LAZY RIVER, ALL ABOARD! (ONE BOTTOM PER TUBE), EXIT, TUBE RETURN, TUBES, the Coconut Shack's sign and chalk menu (Temple Fries), TEMPLE RAPIDS, SHHH! IDOL SLEEPING, NO SPLASHING THE IDOL, the crocodile's sign, the river's rules, MISSING: ONE TUBE, the signpost's arrows (cut-outs), the crates' stencils, the depth marks, the stations' boards (WATER CARE, EYE CARE, LIFE RING, FISH NET, SKIMMER, LITTER), DANGER |
| The shell | `shell.py` | the sandstone deck cut exactly round the river, the river's bed, its bank walls of river rock, the carved coping along both banks, the bamboo palisade (the back with the gate and the cave's gap, the end with the temple's, the low near side), the ruined temple wall on the far side (two collapsed bays, `ruin.json` for the dressing), the jungle gate (pillars with the idol's face, LAZY RIVER under a thatched hood, `Door_A`/`Door_B`), the leaf litter out to the horizon; `floor.glb`: the deck's paint (the wet band along the banks, puddles, moss, leaves, the worn path, damp in the cave's and the temple's shade) |
| On and over the river | `props_river.py` | the cave (an arch of boulders, stalactites, the mound, moss, plants, lianas, the dark inside), the temple of the Lazy Idol (pillars, steps, torch bowls, TEMPLE RAPIDS, the idol on its slab, ruins, `Anchor_Flame`), the rope bridge (planks, posts, rope rails, `Light_Lantern`), the stepping stones, the docks (planks, piles, steps, bamboo arches with their signs and a tube on top, a rope coil and a bell), the tube return, the tube rack, the torches (`Anchor_Flame`) |
| The deck and its edges | `props_deck.py` | the stations (a stone cistern with a brass pump, a stone basin with an idol's face), the Coconut Shack, the treats' crates, the rescue bench, the totems, palms in stone rings (leaning away from the river) and the near side's banana plant, boulders and a sunken idol's head, the ring boards (`LifeRing`), the net's and the skimmer's boards, the litter urn, the torch's pedestal (`Flashlight`), the fuse board; the notice wall, the expedition's crates, pots, the signpost, the rules, the crocodile (a log), the dugout canoe, the stone bench, SHHH! on the ruin, lianas and moss on its standing bays, the near wall's planters; the explorer's camp beyond the ruin's gaps (a tent, a table with the map and a lantern, chairs, the camp fire) |
| The jungle | `garden.py` | palms in groves, broadleaf giants hung with lianas, bamboo groves, banana plants, monstera, heliconia, bird of paradise, bromeliads, ferns, bushes, mossy rocks; low on the near side, nothing in the river's way |
| Export | `../common/export_three.py -- tools/venues/river` | one mesh per material class, the sign and cut-out atlases (the cut-outs at 2048, `CUT_ATLAS`), the floor's paint and occlusion, `river.json` (with the anchors) |
| Pack | `../common/pack.sh river dist/assets/river-club` | `dist/assets/river-club/` (positions as floats: the signs sit millimetres in front of their boards) |
| Horizon | `../common/horizon.sh` | `dist/assets/river-club/horizon.webp`, from the panorama made once on fal |

The pictures made once on fal (`fal-ai/nano-banana-2.1`), kept as `sandstone.png`, `templestone.png`, `riverrock.png`,
`riverbed.png`, `planks.png`, `leaflitter.png`, `bamboo.png`, `horizon.png`, `idol.png`, `foliage.png`, `map.png` and `poster.png` in
`$RIVER_GEN` (default the work folder's `gen/`; their links expire, so the results live in the model's pictures):

- **The sandstone** (1:1, 2K): "Seamless tileable texture, straight top-down orthographic view, flat even overcast lighting, no
  shadows, no perspective: weathered warm tan sandstone flagstone paving of an ancient jungle temple courtyard, irregular
  rectangular slabs of different sizes laid in a broken-bond pattern, soft rounded worn edges, subtle carved erosion and pitting,
  faint lichen spots, thin joints filled with bright green moss and a few tiny sprouting ferns. Rich natural color variation between
  slabs (honey, ochre, pale grey). Photographic PBR material texture for a video game, fills the whole frame edge to edge, the
  left/right and top/bottom edges continue seamlessly. No text, no border."
- **The temple stone** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting, no
  perspective: an ancient overgrown jungle temple wall made of large weathered grey-green sandstone blocks in regular courses, every
  few blocks carved with shallow Mayan-Khmer style relief glyphs (stylised faces, spirals, serpents, a carved sleepy face), worn and
  eroded, patches of dark green moss and pale lichen, black damp streaks running down from the joints. Photographic PBR material
  texture for a video game, fills the whole frame edge to edge, edges continue seamlessly. No text, no border."
- **The river rock** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting: a riverbank
  retaining wall of large rounded wet river boulders and cobbles packed tightly in dark mortar, grey and brown and slate-blue stones,
  glistening wet, thick velvety green moss on the upper sides of the stones, a few tiny ferns in the cracks. Photographic PBR
  material texture for a video game, fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The river's bed** (1:1, 2K): "Seamless tileable texture, straight top-down orthographic view, flat even lighting, no shadows:
  the bed of a clear shallow tropical river, rippled golden sand with scattered smooth rounded pebbles of many colours (ochre, grey,
  white, reddish), a few small flat stones, a couple of fallen leaves. Photographic PBR material texture for a video game, fills
  the frame edge to edge, edges continue seamlessly. No water surface, no text, no border."
- **The planks** (1:1, 2K): "Seamless tileable texture, straight top-down orthographic view, flat even lighting: weathered tropical
  hardwood boardwalk planks running vertically, each plank its own warm brown tone from honey to dark teak, silvered sun-bleached
  patches, deep wood grain, a few dark iron nail heads at the ends, narrow dark gaps between planks. Photographic PBR material
  texture for a video game, fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The leaf litter** (1:1, 2K): "Seamless tileable texture, straight top-down orthographic view, flat even lighting: a rainforest
  floor of fallen leaves in browns, oranges and yellows, small green seedlings, ferns sprouting, twigs, moss patches and exposed
  roots, damp dark earth showing between. No grass lawn. Photographic PBR material texture for a video game, fills the frame edge to
  edge, edges continue seamlessly. No text, no border."
- **The bamboo** (1:1, 2K): "Seamless tileable texture, straight front-on orthographic view, flat even lighting: a tall palisade of
  vertical golden bamboo poles tightly packed side by side, each pole a slightly different yellow-green-tan tone, visible nodes at
  irregular heights, dried brown patches and dark spots, lashed together with two horizontal bands of brown coconut-fibre rope.
  Photographic PBR material texture for a video game, fills the frame edge to edge, edges continue seamlessly. No text, no border."
- **The horizon** (4:1, 4K): "A seamless wide panoramic landscape backdrop for a stylized 3D video game, painted in a soft
  painterly toon style with clean shapes and gentle gradients (like a Pixar matte painting). A lush tropical rainforest seen from a
  jungle water park clearing: in the foreground band, dense jungle canopy, giant tree ferns, banana plants and palms; in the middle
  distance, the overgrown stepped pyramid of an ancient lost temple rising from the trees with vines, a tall misty waterfall
  plunging off a green cliff, a river glinting; behind, steep green karst mountains and volcanic peaks wrapped in soft mist, a flock
  of white birds. The landscape fills only the bottom half of the image, its skyline gently rising and falling across the whole
  width. The sky above the landscape is a completely flat, plain, pure white (#FFFFFF), with no clouds, no sun, no birds in the sky,
  no gradient. Warm late-morning light, no people, no text, no frame. The left and right edges match in height so it can wrap
  around."
- **The Lazy Idol** (1:1, 2K): "Front-on orthographic view of one huge ancient carved stone idol face, a relief in the style of
  Mayan and Khmer temple carvings, weathered grey-green sandstone with moss in the grooves and pale lichen: the face is comically
  sleepy and lazy, heavy half-closed drooping eyelids, a big contented yawn showing a round open mouth, a tiny carved drool drip, a
  carved nightcap-like headdress with tassel, big ear plugs. Rich carved detail, deep relief shading with soft light from above.
  Centred, isolated on a completely flat plain pure white (#FFFFFF) background, nothing else, no text, no frame."
- **The foliage sheet** (1:1, 2K): "A botanical game-asset sheet of tropical foliage cut-outs, each piece separate and not
  overlapping, evenly spaced on a completely flat plain pure white (#FFFFFF) background, flat even lighting, no shadows: top row,
  three large glossy split monstera deliciosa leaves on short stalks; middle row, two long arching banana leaves with torn edges and
  a long hanging liana vine with small heart-shaped leaves; bottom row, a spray of red and yellow heliconia lobster-claw flowers
  with leaves, an orange bird-of-paradise flower with leaves, and a pink bromeliad rosette. Painterly realistic style for a
  stylized 3D game. No text."
- **The explorer's map** (4:3, 2K): "An old explorer's hand-drawn treasure map on stained, creased parchment, 1930s adventure style,
  top-down flat lay filling the whole frame: a winding blue river loops through dense jungle drawn as little trees, a cave with a
  waterfall at one end, a temple with a big sleepy stone face at the other, a rope bridge, two stepping stones, a dock, a snack hut,
  crocodiles drawn in the margins with question marks, a compass rose, dotted paths, a red X, hand-lettered labels reading LAZY
  RIVER, TEMPLE RAPIDS, CAVE FALLS, SNACKS, HERE BE TUBES. Ink and watercolour, charming and funny. Fills the frame edge to edge."
- **The travel poster** (3:4, 2K): "A vintage 1930s art-deco travel poster, flat screen-print style with bold shapes and limited
  palette (jungle green, teal, sunshine yellow, coral orange, cream): a happy explorer in a pith helmet lounging in a bright
  inflatable ring floating down a lazy jungle river past a giant sleepy stone idol face and palms, parrots overhead, sunbeams. Bold
  lettering at the top reading LAZY RIVER and at the bottom reading FLOAT THE LOST TEMPLE. Fills the frame edge to edge, slightly
  faded and sun-bleached paper texture."
