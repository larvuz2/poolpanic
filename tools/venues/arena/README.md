# The Grand Gala Arena's assets (three.js)

The scripts that make the Grand Gala Arena's dressed look for the three.js game (`dist/scene/arenaclub.mjs`, README "The Grand Gala
Arena dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. **THE POOL PANIC AWARDS**, the
season's last night, in a grand old domed arena: navy and gold, crimson velvet, walnut, black marble. The LED screens and their
chasing marquee, the drapes, the trophy turning in its niche, the crowd and its ribbons, the scoreboard, the spotlights and the
balloons stay the game's (`dist/scene/arena.mjs`); these make the hall and everything round the pool. The crowd's people are the
Aquatic Centre's Meshy spectators in their evening clothes (`dist/scene/crowd-models.mjs`), not made here.

    tools/venues/arena/build_all.sh        # every step below, into dist/assets/arena-club/

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan (dist/spatial.mjs ARENA: Splash Park's floor plan, the doors in the stage's wall), every place the scripts use |
| Textures | `arena_textures.py` (Blender's numpy) | terrazzo, navy and gold mosaic, the art deco band, black marble, Calacatta, crimson velvet, theatre carpet, gold leaf, walnut, damask, concrete, linen (each with its normal map) |
| The painted pieces | `painted.py` (python3 with Pillow and numpy; the Cruise Ship's keying and cutting) | the duck-and-trophy emblem keyed into a cut-out; the press pen's ducks, the seal, the roses and the star balloon cut apart; the pictures into the signs |
| Signs | `signs.py` (python3 with Pillow) | black and midnight enamel with gold rims: DAREDEVILS · SPLASH ZONE, LIFEGUARD, WATER CARE, EYE CARE, GENTLEMEN and LADIES, the CHAMPAGNE BAR, the ice swan's PLEASE DO NOT LICK, VIP LOUNGE, PRESS, Reserved · M., ROYAL BOX, THE POOL PANIC PHILHARMONIC, the confetti cannon's warning, COACHES' TUNNEL, AND THE WINNER IS…, THE GOLDEN WHISTLE, THE POOL PANIC AWARDS, tonight's programme, the GRAND GALA banners, the windows' night |
| The hall | `shell.py` | the terrazzo deck and its walnut fascia with marquee bulbs, the band and coping, the basin (the emblem on its floor), ladders, starting blocks, pennants' posts; the stage's wall (gold-leaf frames round the game's screens, the velvet pelmet, the trophy's niche, sunburst and plinth, the pictures, THE POOL PANIC AWARDS); the carpet, the far walls (damask, pilasters, opera boxes, arched windows), the grandstands; `ceiling.glb` (the Coach Cam's: the coffered vault, gilded trusses, two chandeliers, banners, the near side); `floor.glb` (the red carpet along the stage, the lane numbers, GRAND GALA) |
| The stations | `props_stations.py` (Splash Park's, in the gala's colours) | the trampoline tower, the lifeguard's chair (`Flashlight`), WATER CARE and EYE CARE, the fin rack (`Fins_1..3`), the skimmer's board, the bin, the fish net's board, the ring boards (`LifeRing`), the benches |
| The doors | `props_doors.py` | the changing rooms' doors in the stage's wall (`Door_A`, `Door_B`): stepped gold-leaf frames, walnut leaves with a brass sunburst, GENTLEMEN and LADIES, a marquee, velvet ropes; the first-aid cabinet |
| The gala | `props_gala.py` | the CHAMPAGNE BAR, the floral urns, the ice swan, the VIP chaises and the champagne stand, the confetti cannons, the flamingo's memorial, the winner's lectern, the PRESS pen and the TV jib, the orchestra pit, the royal box, the coaches' tunnel |
| Export | `../common/export_three.py -- tools/venues/arena` | one mesh per material class (the ceiling's apart, `C_<class>`: kit.COACH_PARTS), the atlases, the floor's paint and occlusion, `arena.json` |
| Pack | `VENUE_VP=16 ../common/pack.sh arena dist/assets/arena-club` | `dist/assets/arena-club/` |

Everything is modelled in game coordinates (`kit.py`: the plan, the palette, the tile sets). `arenaclub-check.mjs` holds the result
to the classic arena's hit boxes and labels and to its budget.

The pictures made once on fal, kept in `$ARENA_GEN` (default the work folder's `gen/`; their links expire, so the results live in
the model's pictures). The Rooftop Pool's marble, concrete and linen (`tools/venues/roof/README.md`) are copied in beside them. The
materials and the art with `fal-ai/nano-banana-2.1` (2K); each material's prompt ends "Photographic PBR material texture for a video
game, fills the frame edge to edge, edges continue seamlessly. No text, no border.":

- **The terrazzo**: "Seamless tileable texture, straight top-down orthographic view, flat even lighting, no shadows, no perspective:
  a polished ivory and champagne terrazzo floor with small chips of white marble, honey onyx, mother of pearl and a few gold flecks,
  divided into exactly three by three large square panels by thin polished brass divider strips."
- **The mosaic**: "… straight front-on orthographic view, flat even lighting: the lining of a luxurious grand swimming pool in small
  square glass mosaic tiles, about 24 tiles across, a rich mix of deep royal blue, sapphire, midnight navy and a few tiles of
  gold-leaf glass smalti scattered at random, each tile with a glassy sheen and uneven glaze, thin dark grey grout lines."
- **The art deco band** (4:1): "Seamless horizontally tileable strip texture … a single row of art deco glass mosaic border tiles for
  a grand swimming pool's waterline, exactly four square tiles side by side filling the frame, each with the same bold pattern of a
  gold sunburst fan rising from the bottom edge on a deep navy blue ground with thin cream and coral red lines, glossy uneven glaze,
  thin gold grout lines between the tiles."
- **The velvet**: "… rich deep crimson red theatre velvet fabric, a soft lustrous pile with a subtle sheen, a few gentle vertical
  folds and faint pressed marks, luxurious and slightly worn."
- **The carpet**: "… straight top-down … a grand old theatre's wool carpet, deep navy blue with a repeating art deco pattern of gold
  fans and thin burgundy lines, exactly two by two repeats of the pattern, a soft short pile, a little worn."
- **The gold leaf**: "… an aged gilded wall surface covered in squares of genuine gold leaf, exactly six by six squares with faint
  overlapping seams, warm rich gold with subtle crackle, slight tarnish and a few dark red bole showing through at the edges of some
  squares."
- **The walnut**: "… dark French-polished walnut wood panelling, rich figured grain running vertically, deep warm brown with a glossy
  lacquer, three vertical boards across with fine joints."
- **The damask**: "… luxurious midnight navy silk damask wall covering with a classic repeating baroque damask pattern woven in a
  slightly lighter navy and a thin metallic gold thread, exactly two by two repeats of the pattern, subtle sheen."
- **The black marble**: "… polished black Nero Marquina marble with fine white and pale grey veins running diagonally, deep glossy
  black, a mirror polish."
- **The emblem**: "Top-down view of one big funny cartoon emblem made as a grand art deco swimming pool floor mosaic, centred, on a
  completely flat plain pure white (#FFFFFF) background: a plump cheerful yellow rubber duck wearing a tiny black bow tie and a
  little gold crown, proudly holding up a shining golden trophy cup with both wings, rays of a gold art deco sunburst fanning out
  behind it, inside a round laurel wreath with a red ribbon. Made entirely of small square glazed glass mosaic tiles (about 60
  tiles across the duck), in gold, cream, navy, crimson, yellow and orange, each tile slightly uneven, thin grout lines, flat
  graphic shapes, bold readable silhouette. Only the emblem is tiled; everything around it is pure flat white, no tiles, no
  shadow, no water, no border, no text."
- **The press pen and the bouquets** (3:2): "A game-asset sheet of six comic awards-night things, each one separate and not
  overlapping, evenly spaced in two rows of three on a completely flat plain pure white (#FFFFFF) background, flat even lighting,
  no shadows, painterly stylized 3D game look, side and three-quarter views: a yellow rubber duck paparazzo in a little black beret
  holding up a big old press camera with a bright flash bulb, a yellow rubber duck reporter in a tiny trench coat holding out a
  microphone, a yellow rubber duck in a black bow tie clapping its wings, a harbour seal in a black bow tie balancing a gold ball on
  its nose, a big bouquet of red roses wrapped in gold paper, a golden balloon shaped like a star. Bright saturated colours with
  dark outlines so they stand out from the background. No text."
- **The flamingo's memorial** (3:4): "A solemn memorial portrait on an easel at an awards night, front-on, filling the whole frame:
  a framed formal photograph, in a heavy black-and-gold frame with a black ribbon across one corner, of a slightly deflated pink
  inflatable flamingo pool float posed dramatically against a mottled grey studio backdrop, softly lit; under the photograph a
  small gold plaque in the frame reading IN MEMORIAM · FLAMINGO · 2019 – 2026 · SHE FLOATED. A wreath of white lilies at the
  bottom of the frame. Gently funny, very serious." (cut to its frame by `painted.py`)

**The people in its pictures are our characters**: painted with `openai/gpt-image-2.5/flare/edit` (quality high), the coaches'
pictures as the references (`dist/assets/coach-waters.webp`, `coach-brooks.webp`, `coach-rivers.webp`, `coach-storm.webp`,
flattened on white):

- **THE GRAND GALA** (1536 × 2048; Coach Waters): "A glamorous vintage 1930s art deco awards-night poster, flat screen-print style
  with bold geometric shapes and a limited palette (midnight navy, gold, crimson red, cream): a grand domed arena with a sparkling
  blue swimming pool on a raised stage, gold sunburst searchlights sweeping up into the dark, confetti falling, a crowd in
  silhouette, and in the middle, standing proudly on the edge of the pool, a character from our game's own cartoon universe exactly
  like the character in the image (chunky stylised cartoon proportions, warm tan clay-like skin, round head, huge round googly white
  eyes, big bulbous nose, a thick moustache, NO mouth, chunky rounded hands), here in a black tuxedo with a red bow tie and a
  whistle on a gold cord, holding a huge golden trophy cup high over his head. Bold art deco lettering at the top reading THE GRAND
  GALA and at the bottom reading POOL PANIC · SEASON FINALE. Elegant and gently funny."
- **COACH OF THE YEAR · THE NOMINEES** (2048 × 1024; Coach Waters, Coach Brooks, Coach Storm, Coach Rivers): "A grand awards-night
  display board in a heavy gilded art deco frame, front-on, filling the whole frame, a deep navy velvet background with gold
  lettering across the top reading COACH OF THE YEAR · THE NOMINEES, and four glamorous black-and-gold studio portrait photographs
  in little gold sunburst frames side by side, each with a small brass plate under it. Each portrait shows one of the four
  characters from our game's own cartoon universe, exactly like the four characters in the images, one each (…), each in formal
  black tie, posing with a smouldering dramatic look under studio light: one with a whistle held like a cigar, one leaning on a
  pool skimmer like a cane, one with arms folded and sunglasses on his head, one blowing a kiss. The brass plates read: WATERS,
  BROOKS, STORM, RIVERS. Glamorous and gently funny."
- **The red carpet** (2048 × 1536; Coach Brooks and Coach Rivers): "A glossy celebrity-magazine red carpet photograph, flash
  photography at night, a step-and-repeat backdrop behind covered in small gold logos reading POOL PANIC and GRAND GALA, a red
  carpet and velvet ropes on brass posts: two characters from our game's own cartoon universe, exactly like the two characters in
  the images (…): the older round one with the grey moustache in a slightly too small white dinner jacket and a crooked bow tie,
  holding a life ring like a handbag; the young woman coach in a sparkling sequinned gown with her coach's whistle worn as a
  necklace, striking a confident pose; a big yellow rubber duck in a bow tie photobombing between them. Camera flashes, lens
  flares, glamorous and funny."
