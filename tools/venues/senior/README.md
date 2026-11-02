# Senior Aqua Fit's assets (three.js)

The scripts that make Senior Aqua Fit's dressed look for the three.js game (`dist/scene/seniorclub.mjs`, README "Senior Aqua Fit
dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from the game's own plan:
`plan.mjs` writes it (the pool and its lanes, the deck and the room, the glass doors, the lounge's waiting places, the evacuation
columns, the furniture, stations and fixtures, the massage table the game draws, the rings' mounts, and the conservatory's lines
from the classic `dist/scene/senior.mjs`) from `dist/spatial.mjs` into the work folder, and `kit.py` reads it. What moves stays the
game's (`dist/scene/senior.mjs`), placed at the model's anchors (`Anchor_<Name>`, recorded as `info.anchors.<Name>`): `Spa` (the
spa's water, bubbles and steam), `Notes` (the gramophone's notes), `Biscuits` (the tin of treats on the tea trolley); the life
rings and the torch as before. The fins are the model's (`Fins_1..3`), the doors' leaves too (`Door_A`/`Door_B`); the roof is the
Coach Cam's (`COACH_PARTS`: merged as `C_` classes).

    tools/venues/senior/build_all.sh        # every step below, into dist/assets/senior-club/

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `senior_textures.py` (Blender's numpy) | from the classic venue's photographs (`dist/assets/senior/`): the travertine deck, the art-deco fan mosaic; made here: white marble with grey veins, cream brick, raked gravel, the cast-iron lace (a cut-out), fern fronds; from the earlier venues' scripts and the common kit: stucco, teak, the emerald-and-gold frieze, clipped hedge, ground cover, canopy and conifer, palm fronds, roses, lavender, geraniums |
| Signs | `signs.py` (python3 with Pillow) | the club's sign and the rugs (the classic's pictures), today's programme and moves, the rules, the founder's plate, the station clock, HYDROTHERAPY, QUIET PLEASE, SLIPPERS HERE, ZIMMER PARKING (a cut-out), AQUA BINGO and a bingo card, LOST PROPERTY, the CAP OF THE WEEK, the HONEST scale's dial, THE DAILY DIP, the SALVETE doormat, the depth plates, the stations' enamel boards |
| The painted pieces | `painted.sh` | the six club photographs (cut apart), the founder's portrait, the swan on the pool's floor (keyed into a cut-out), from the pictures made once on fal (below) |
| The shell | `shell.py` | the travertine deck, the frieze and its brass strips, the rugs and the runner with brass stair rods, the doormat, the pool (fan mosaic, waterline band, marble coping and steps, brass ladders and depth plates, the swan), the stucco back wall (dado, rail, pilasters, cornice, pediment, the sign, `Door_A`/`Door_B`), the near wall, the glazing (dwarf walls, columns, panes, fanlights, iron lace, gutters), the roof (`roof`: the Coach Cam's), the terrace's stone face; `floor.glb`: the deck's paint (the wear path, damp by the steps and the spa, petals, grime, moss) |
| The stations | `props_stations.py` | the fin rack (`Fins_1..3`), the apothecary's cabinet (WATER CARE), the marble washstand (EYE CARE), the ring boards (`LifeRing`), the fish net's and the skimmer's boards (notices pinned on it), the litter bin, the torch's pedestal (`Flashlight`), the fuse board, the spa's tub (`Anchor_Spa`), the hoist, the rest bench, the tea trolley (`Anchor_Biscuits`), the gramophone (`Anchor_Notes`), the wing chairs, the standard lamp (`Light_Torchiere`), the knitting, the side table, the steamer loungers |
| The dressing | `props_decor.py` | the back wall's salon hang bay by bay (the moves board, the slippers' corner and coat stand, the station clock, the lost property cabinet, the founder's portrait with its picture light and half-moon table, the penny scale, the umbrella stand, the rules and the photographs, ZIMMER PARKING and its four frames, the bingo console and the crossed flippers, the programme, a sconce on every pilaster: `Light_Sconce`), the noodle basket, the glass end's strip (fern stands, easels, the canary, the hamper, watering cans, pots), the sills' pots, the hanging baskets on every column, the near wall's troughs, the spa's corners, the big plants |
| The garden | `garden.py` | ground cover and gravel walks to the horizon, lamp posts (`Light_Lantern`), benches, urns, the rose bed and its topiary duck family and swan, the yew hedge, the fountain, the box and lavender past the end, the topiary teapot and cup, the sundial, the bandstand, Irish yews, limes |
| Export | `../common/export_three.py -- tools/venues/senior` | one mesh per material class, the sign and cut-out atlases, the floor's paint and occlusion, `senior.json` (with the anchors) |
| Pack | `../common/pack.sh senior dist/assets/senior-club` | `dist/assets/senior-club/` (positions as floats: the pictures sit 3 mm in front of their boards); the classic's photographs stay in `dist/assets/senior/` |
| Horizon | `../common/horizon.sh` | `dist/assets/senior-club/horizon.webp`, from the panorama made once on fal |

The pictures made once on fal (`fal-ai/nano-banana-2.1`), kept as `horizon.png`, `photos.png`, `founder.png` and `swan.png` in
`$SENIOR_GEN` (default the work folder's `gen/`; their links expire, so the results live in the model's atlases and the WebP):

- **The horizon** (4:1, 4K): "A seamless wide panoramic landscape backdrop for a stylized 3D video game, painted in a soft painterly
  toon style with clean shapes and gentle gradients (like a Pixar matte painting). The grounds of a grand English country estate
  seen from inside a Victorian glass conservatory, golden late afternoon: in the foreground band, clipped yew hedges, rose arbours,
  beds of lavender and foxgloves, a gravel walk with stone urns; in the middle distance great old oak and copper beech trees, a
  lily pond, a white wooden bandstand, a walled kitchen garden; behind, gently rolling green hills with sheep, a distant village
  with a church spire and honey-stone cottages, soft warm haze. The landscape fills only the bottom half of the image, its skyline
  gently rising and falling across the whole width. The sky above the landscape is a completely flat, plain, pure white (#FFFFFF),
  with no clouds, no sun, no birds, no gradient. No people, no text, no frame. The left and right edges match in height so it can
  wrap around."
- **The club photographs** (3:2, 2K): "A neat grid of six separate vintage photographs, two rows of three, each a square sepia or
  faded hand-tinted photo with a white border, evenly spaced on a plain flat white background, no overlap. The photos show a
  charming, funny 1950s seniors' aqua ballet club: 1) a line of elderly ladies in floral rubber swimming caps doing synchronized leg
  kicks in a pool; 2) an elderly gentleman with a grand handlebar moustache in a striped one-piece bathing suit proudly holding a
  small trophy; 3) six pairs of legs sticking straight up out of the water in a perfect row; 4) a lady in a flowery swim cap and
  pearls doing a graceful dive; 5) a team of grinning elderly swimmers posing in a pyramid at the pool's edge; 6) a dignified old
  lady floating on her back reading a newspaper in the pool. Warm, affectionate, slightly comic, authentic period photographic look
  with grain. No text, no captions, no frames other than the white photo borders."
- **The founder** (3:4, 2K): "A formal oil painting portrait in the style of a 1920s British society portrait, the whole canvas
  filled with the painting (no frame, no wall): the dignified elderly founder of a seniors' swimming club, a stern but twinkly-eyed
  old lady with rosy cheeks, wearing a magnificent rubber swimming cap covered in big pastel rubber flowers, a string of pearls, and
  an elegant emerald silk bathing costume with a cape, sitting very upright in a carved armchair, holding a delicate china teacup
  with her little finger raised, a small rubber duck perched on the arm of the chair, a potted palm and a glimpse of a Victorian
  conservatory behind her. Rich warm varnished oil paint, visible brushstrokes, golden light, gently humorous. No text, no
  signature, no frame."
- **The swan** (1:1, 2K): "Top-down view of one elegant swan made as an art-deco pool floor tile mosaic, centred, on a completely
  flat plain pure white (#FFFFFF) background. The swan is white and pearl grey with a golden orange beak, gliding gracefully, wings
  slightly raised, wearing a charming pastel pink rubber swimming cap covered in little rubber flowers and a tiny string of pearls
  round its neck; a few stylised art-deco ripple lines in emerald green and gold curve around it. Made entirely of small square
  glazed ceramic tiles (about 50 tiles across the swan's body), each tile slightly uneven in colour, thin cream grout lines between
  tiles, flat graphic shapes, bold readable silhouette. Only the swan and its ripples are tiled; everything around them is pure flat
  white with no tiles, no shadow, no water, no border, no text."
