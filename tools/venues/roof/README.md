# The Rooftop Pool's assets (three.js)

The scripts that make the Rooftop Pool's dressed look for the three.js game (`dist/scene/roofclub.mjs`, README "The Rooftop Pool
dressed for real"), with the shared venue kit in `tools/venues/common/`. Three.js only. Every place comes from the game's own plan:
`plan.mjs` writes it (the basin, the knife edge and the gutter, the glass rail, the beds and the cabanas, the lounge, the bar, the
DJ, the lifts, the walkers' blocks, the roof's lines from the classic `dist/scene/rooftop.mjs`, the queue, the evacuation spots, the
furniture, stations and fixtures, the rings' mounts) from `dist/spatial.mjs` and `dist/roof-plan.mjs` into the work folder, and
`kit.py` reads it.

**The Sky Pool of Hotel Vertigo**, level 57, 185 m above the city at golden hour. What moves stays the game's: the water and its
ripples, the sheets of water over the knife edge and along the gutter, the lifts' sliding doors, the fire's flames, SKY BAR's neon
and the margaritas, the LED wall, its light, beams and the riser's lit edge, the tower's glass walls and the city, the towels, the
DJ and the bartender; the life rings and the torch at their anchors as before.

    tools/venues/roof/build_all.sh        # every step below, into dist/assets/roof-club/

**Its materials are photographic.** Ten were painted once on fal as flat, even-lit photographs (the prompts below) and are made
seamless here (`roof_textures.py`, the Lazy River's and the Cruise Ship's method): their periods measured (most came out a whole
number of repeats across: the zellige 14 tiles by 4 rows, the travertine 2 slabs by 4 courses, the bronze 6 fins, the mosaic 16
rows, the concrete 4 panels), so they are blended with themselves shifted by half only in a thin band at the edges; the teak's
boards are each turned round by their own amount along their length so the wrap becomes staggered joints (no blending); the
bronze's bright middle is taken out row by row. Each gets a normal map from its own relief.

| Step | Script | Makes |
| --- | --- | --- |
| Plan | `plan.mjs` (Node) | `plan.json`: the game's plan, every place the scripts use |
| Textures | `roof_textures.py` (Blender's numpy) | from the fal photographs: teak, travertine, glass mosaic, granite, marble, bronze, linen, rattan, concrete, zellige (each with its normal map); palm fronds |
| The painted pieces | `painted.py` (python3 with Pillow and numpy; the Cruise Ship's keying and cutting) | the emblem keyed into a cut-out; the pigeons and what fell off the roof cut apart; the posters with our characters into the signs; the phone net's mesh (drawn) |
| Signs | `signs.py` (python3 with Pillow) | black glass and brass plates: HOTEL VERTIGO, ▲ 57 SKY POOL, the Sky Bar's menu, the pool's rules, DAYS WITHOUT A PHONE GOING OVER THE EDGE, the window cleaner's notice, SEE YOUR HOUSE!, VIP ONLY, ALTITUDE 185 m, the aircraft light's, PIGEONS ARE NOT GUESTS, the Employee of the Month's plaque, DJ SPLASH, the lift's buttons, the stations' boards, the depth plates, the floor's stencils |
| The shell | `shell.py` | the teak and travertine deck, the pool (mosaic, the bench step, the light under the coping, the emblem, the coping, depth plates), the knife edge and the gutter in granite, the slab's edges and underside, the glass rails, the lift cores (the lit cars, the signs, the canopies, the aircraft mast, the anemometer); `floor.glb`: the deck's paint |
| The furniture | `props_furniture.py` | the sunbeds, the cabanas, the parasols and festoons (`Light_Festoon`), the side tables (`Light_Lantern`), the lounge, the Sky Bar (`Light_Kiosk`), the DJ's riser, booth, speakers and truss, the palms, bay balls, lanterns, ice buckets, the stations and fixtures (`LifeRing`, `Flashlight`) |
| The stories | `props_stories.py` | the window cleaner's cradle, the phone net and what fell in it, the coin binoculars, the champagne tower, the luggage cart, the concierge's desk, the framed pictures and plates on the lift cores, the pigeons |
| Export | `../common/export_three.py -- tools/venues/roof` | one mesh per material class, the sign and cut-out atlases, the floor's paint and occlusion, `roof.json` |
| Pack | `VENUE_VP=16 ../common/pack.sh roof dist/assets/roof-club` | `dist/assets/roof-club/` |

The pictures made once on fal, kept in `$ROOF_GEN` (default the work folder's `gen/`; their links expire, so the results live in the
model's pictures). The materials and the art with `fal-ai/nano-banana-2.1` (1:1 or 3:2, 2K):

- **The teak**: "Seamless tileable texture, straight top-down orthographic view, flat even overcast lighting, no shadows, no
  perspective: a luxury rooftop pool deck of oiled honey-golden teak boards running vertically, each board its own warm tone from
  pale honey to deep amber, fine straight wood grain, narrow dark open gaps between the boards, neat rows of tiny stainless screw
  heads, a few sun-silvered patches and faint water drips. Photographic PBR material texture for a video game, fills the whole
  frame edge to edge, edges continue seamlessly. No text, no border."
- **The travertine**: "… honed ivory travertine stone pavers on a five-star hotel's rooftop terrace, large rectangular slabs in a
  running bond, exactly four slabs across, warm cream and pale honey tones with natural pitted holes and soft veining, very thin
  pale grout joints, a faint sheen. …" (the same frame as the teak's: seamless, orthographic, even light, no text)
- **The mosaic**: "… the lining of a luxury infinity pool in small square glass mosaic tiles, about 24 tiles across, deep emerald
  green and dark teal with scattered jade, petrol blue and a few iridescent gold-flecked tiles, each tile with a glassy sheen and
  uneven glaze, thin dark grey grout lines. …"
- **The granite**: "… polished absolute black granite with fine silver and gold mica sparkles and faint grey crystal flecks, a
  deep glossy surface, no veins, no joints. …"
- **The marble**: "… polished Calacatta gold marble slab, bright warm white with bold soft grey veins and thin golden veins flowing
  diagonally, a subtle polished sheen, no joints. …"
- **The bronze**: "… architectural cladding of dark brushed bronze metal, vertical fluted fins and narrow ribs running top to
  bottom, exactly eight ribs across, warm brown-gold patina with fine vertical brushing marks, slight darker oxidation in the
  grooves. …"
- **The linen**: "… heavy natural cream linen outdoor upholstery fabric, a visible slub weave with irregular thicker threads, warm
  off-white oatmeal colour, very soft subtle creases. …"
- **The rattan**: "… tightly hand-woven natural rattan wicker for luxury outdoor furniture, a basket weave of flat honey and
  caramel coloured strands, small dark gaps between them, a regular repeating pattern. …"
- **The concrete**: "… smooth white architectural concrete of a luxury hotel tower, warm off-white, faint board-formed horizontal
  lines, a regular grid of small round tie holes, subtle pores and the slightest grey mottling, very clean. …"
- **The zellige**: "… handmade glossy zellige ceramic tiles in a deep peacock teal, small vertical rectangular tiles in a stack
  bond, exactly eight tiles across, each tile with an uneven wavy glaze, colour pooling darker at the edges and pale highlights,
  thin cream grout lines. …"
- **The emblem** (1:1): "Top-down view of one giant funny cartoon emblem made as a luxury swimming pool floor mosaic, centred, on a
  completely flat plain pure white (#FFFFFF) background: a plump cool city pigeon wearing big gold aviator sunglasses lying back on
  a pink flamingo pool float, one wing behind its head, the other wing holding a tiny cocktail with an umbrella, a gold crown above
  it and a ring of gold stars around. Made entirely of small square glazed glass tiles (about 60 tiles across the pigeon), in gold,
  ivory, pearl grey, coral pink and turquoise, each tile slightly uneven, thin grout lines, flat graphic shapes, bold readable
  silhouette. Only the emblem is tiled; everything around it is pure flat white, no tiles, no shadow, no water, no border, no
  text."
- **The pigeons** (3:2): "A game-asset sheet of six comic cartoon city pigeons, each one separate and not overlapping, evenly
  spaced in two rows of three on a completely flat plain pure white (#FFFFFF) background, flat even lighting, no shadows,
  painterly stylized 3D game look: a plump pigeon wearing tiny gold sunglasses and a gold chain, a pigeon proudly carrying a
  cocktail cherry on a stick in its beak, a fat pigeon asleep sitting down, a pigeon wearing a tiny VIP lanyard looking smug, a
  pigeon dancing on one leg with its wings up, a pigeon with a tiny paper cocktail umbrella. Blue-grey bodies with iridescent
  green and purple necks so they stand out from the background, orange eyes, pink feet, side views. No text."
- **What fell off the roof** (3:2): "A game-asset sheet of six things people dropped off a rooftop pool, each one separate and not
  overlapping, evenly spaced in two rows of three on a completely flat plain pure white (#FFFFFF) background, flat even lighting,
  no shadows, painterly stylized 3D game look, seen from above: a smartphone in a sparkly pink case with a cracked screen, a single
  flip-flop with a flamingo on it, a big floppy straw sun hat, a hairpiece toupee, a yellow rubber duck wearing sunglasses, a selfie
  stick. Bright colours that stand out from the background. No text."

**The people in its pictures are our characters** (the creator: "Use same character as references if you are adding posters or
stuff"): painted with `openai/gpt-image-2.5/flare/edit` (quality high), the coaches' pictures as the references
(`dist/assets/coach-waters.webp`, `coach-brooks.webp`, `coach-rivers.webp`, `coach-storm.webp`, flattened on white):

- **The Employee of the Month** (1536 × 2048; Coach Waters): "A cheesy staff photograph for a luxury rooftop hotel's EMPLOYEE OF
  THE MONTH frame, of the exact character in the image: our game's cartoon pool coach, Coach Waters, keeping exactly his look (the
  same chunky stylised cartoon proportions, warm tan clay-like skin, round head, two huge round googly white eyes with small dark
  pupils, big bulbous nose, thick bushy brown moustache, NO mouth visible under the moustache, simple rounded hands with chunky
  fingers, the same clothes and cap). Head and shoulders, three-quarter view, giving a big proud thumbs up with one hand and
  holding a red-and-white life ring under the other arm, a gold 'staff' name badge pinned on his chest, a tiny pigeon perched on his
  shoulder. Behind him a ridiculous 1990s school-photo backdrop of purple and turquoise laser beams. Soft studio flash lighting, a
  warm slightly faded print, gently funny. Portrait format, fills the frame. No text, no lettering, no frame, no border."
- **HOTEL VERTIGO · DON'T LOOK DOWN** (1536 × 2048; Coach Brooks and Coach Waters): "A vintage 1930s art-deco luxury hotel travel
  poster in the style of Cassandre, flat screen-print style with bold geometric shapes and a limited palette (deep teal, sunset
  coral, gold, cream, navy): the top of a soaring hotel tower with an infinity pool on its roof at sunset, the city a dizzying
  long way below, and lounging right on the infinity edge, cocktail in hand, a character from our game's own cartoon universe
  exactly like the characters in the two images: chunky stylised cartoon proportions, warm tan clay-like skin, a big round head,
  huge round googly white eyes, a big bulbous nose, a bushy white moustache, NO mouth, chunky rounded hands, here in a striped
  bathing suit and a white sun hat, perfectly relaxed; a pigeon in sunglasses beside him; his sunglasses tumbling off into the
  void. Bold art-deco lettering at the top reading HOTEL VERTIGO and at the bottom reading DON'T LOOK DOWN. Fills the frame edge
  to edge, slightly faded sun-bleached paper texture."
- **DJ SPLASH** (1536 × 2048; Coach Storm and Coach Waters): "A bold neon club gig poster for a rooftop pool party, risograph print
  style in hot pink, electric cyan, purple and gold on deep navy: a character from our game's own cartoon universe exactly like the
  characters in the two images (chunky stylised cartoon proportions, warm tan clay-like skin, a big round shaved head like the
  first image's, tattoo sleeves, huge round googly white eyes, a big bulbous nose, NO mouth), here as a superstar DJ in huge gold
  headphones and mirrored sunglasses, one hand on the decks and the other punching the air, a giant wave of pool water erupting
  out of the speakers behind him, tiny swimmers surfing it, a city skyline at sunset, light beams. Bold lettering reading SUNSET
  SESSIONS at the top, DJ SPLASH big in the middle, and EVERY NIGHT · LEVEL 57 · WAIT FOR THE DROP at the bottom. Fills the frame
  edge to edge, a few staple holes and torn corners."
- **The Wall of Shame** (2048 × 1536; Coach Waters, Coach Brooks, Coach Rivers and Coach Storm): "A cork noticeboard in a hotel
  staff room, front-on, filling the whole frame, with a hand-lettered paper banner across the top reading WALL OF SHAME: PHONES
  LOST OVER THE EDGE, and six instant polaroid photos pinned on it with coloured pushpins, slightly crooked, each with a
  handwritten caption on its white strip. Every polaroid shows a hotel guest who is a character from our game's own cartoon
  universe, exactly like the characters in the four images (chunky stylised cartoon proportions, warm tan clay-like skin, round
  heads, huge round googly white eyes, big bulbous noses, moustaches on some, NO mouths, chunky rounded hands), in swimwear at a
  rooftop infinity pool at sunset, each reacting in horror or comedy as their phone flies off over the glass edge into the city
  far below: … Captions reading: BYE BYE, NOT AGAIN, WORTH IT, MY SELFIE!, SO CLOSE, 185 M. Also pinned: a crumpled tally sheet
  and a sticky note reading TOTAL: 312. Gently funny."
