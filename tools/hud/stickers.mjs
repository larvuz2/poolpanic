// Makes the incidents' stickers (13 November 2026, the creator: "we do need to have icons for all of the incidents, so make them
// on GPT Image Maker using FAL… very visual and illustrative… like a sticker") with GPT Image 2.5 on fal, and readies them for
// the game:
//
//   FAL_KEY=… node tools/hud/stickers.mjs            every sticker not made yet (tools/hud/raw/, not committed)
//   … --only=karen,dog                                only these (made again with --again)
//   node tools/hud/stickers.mjs --process-only        only the second step, from what is in raw/
//
// Each is drawn from the game's own character (tools/hud/ref/<name>.jpg: its head and shoulders and its whole figure, rendered
// from the game's model) with the HUD's coin as the style to match, on a transparent background; then trimmed, squared and made
// a 192 px WebP in dist/assets/hud/stickers/<key>.webp. dist/stickers.mjs says which incident wears which.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, existsSync, statSync, readFileSync, writeFileSync } from "node:fs";

const run = promisify(execFile);
const ENDPOINT = "openai/gpt-image-2.5/flare/edit";
const HERE = new URL("./", import.meta.url).pathname;
const RAW = HERE + "raw/";
const OUT = new URL("../../dist/assets/hud/stickers/", import.meta.url).pathname;
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

// What every sticker has in common. (The game's people have no mouths: eyes and brows do the acting.)
const STYLE =
  "Make ONE die-cut vinyl sticker, centred, on a fully transparent background. " +
  "Chunky toy-like 3D cartoon look, exactly the style of the reference character picture: smooth rounded clay shapes, big round " +
  "white eyes with black pupils, thick expressive eyebrows, and NO MOUTH on any person (these characters have no mouths: all " +
  "the expression is in the eyes and the brows). A bold dark navy outline round every shape, then a thick clean white sticker " +
  "border all the way round the whole silhouette, glossy highlights, saturated cheerful colours, like the glossy gold coin " +
  "icon in the last reference picture (it is there for the finish and the outline only: do not draw a coin). " +
  "The subject fills the sticker and reads at a glance when shown very small (64 pixels). " +
  "No text, no letters, no numbers, no exclamation mark, no logo, no frame, no background scene, no ground shadow.";
const person = (who) =>
  `The first reference picture shows ${who} twice (head and shoulders, then the whole figure): keep that exact character, ` +
  "the same face, hair, colours and clothes. ";

// key: [reference character or null, what to draw]
export const STICKERS = {
  karen: [
    "karen",
    person("Karen, an angry pool guest") +
      "Draw Karen from the chest up, furious and complaining: leaning toward the viewer, one arm out jabbing a pointing finger " +
      "straight at us, the other hand on her hip, brows slammed down hard over glaring eyes, her sunglasses pushed up in her " +
      "blonde hair, pink top, hoop earrings, the checkered bag on her shoulder, three small red anger puffs beside her head.",
  ],
  carl: [
    "carl",
    person("Cannonball Carl, a chubby pool guest in red trunks") +
      "Draw Carl in mid-air curled up in a cannonball jump, hugging his knees to his big round belly, messy black hair flying " +
      "up, eyes wide and thrilled, a ring of water droplets and a small splash crown bursting round him.",
  ],
  leopard: [
    "leopard",
    person("the leopard man, a chubby bald pool guest with a moustache and leopard-print trunks") +
      "Draw him in mid-air curled up in a cannonball jump, hugging his knees to his big round belly, moustache bristling, " +
      "eyes wide and thrilled, a ring of water droplets and a small splash crown bursting round him.",
  ],
  fish: [
    "fishkid",
    person("the fish kid, a boy with spiky brown hair and blue goggles carrying a blue bucket") +
      "Draw him from the chest up sneaking along, hugging his blue bucket, eyes sliding sideways with a guilty mischievous " +
      "look, one eyebrow up, and a bright orange goldfish leaping out of the bucket with a little splash.",
  ],
  dog: [
    "dog",
    person("the pool's loose dog, an orange dog with brown ears and a red collar") +
      "Draw the dog's happy head and shoulders, soaking wet, shaking itself so its ears fly out sideways and water drops spray " +
      "in an arc, tongue out, eyes delighted, the gold tag swinging on its red collar.",
  ],
  influencer: [
    "woman",
    person("a pool guest in a pink swim cap and round goggles") +
      "Draw her from the chest up taking a selfie: holding a bright hot-pink smartphone out at arm's length toward the viewer, " +
      "head tilted, the other hand making a peace sign, eyes half closed in a smug pose, a camera flash star on the phone and " +
      "two little sparkles.",
  ],
  massage: [
    "heavyman",
    person("a round pool guest in a green swim cap and round goggles") +
      "Draw him lying on his tummy on a white massage table with a rolled towel, chin propped on his folded arms and facing " +
      "the viewer, eyes narrowed and brows impatient, fingers drumming, and a pair of hands pressing on his shoulders from above.",
  ],
  rescue: [
    "woman",
    person("a pool guest in a pink swim cap and round goggles") +
      "Draw her in trouble in aqua pool water, shoulders up out of the water, both arms thrown up waving for help, eyes huge " +
      "with panic and brows tilted up, splashes round her, and a red-and-white life ring floating right in front of her.",
  ],
  firstaid: [
    "tallman",
    person("a pool guest in a black swim cap and round goggles") +
      "Draw him from the chest up dazed after a crash: a big white bandage wrapped round his head with a pink plaster crossed " +
      "on it, eyes swirly and unfocused, three yellow stars circling above his head, and a small white first-aid box with a " +
      "green cross held up beside him.",
  ],
  tummy: [
    "heavyman",
    person("a round pool guest in a green swim cap and round goggles") +
      "Draw him from the chest up feeling very sick: his face tinted green, both hands clutching his round belly, cheeks " +
      "puffed out, eyes squeezed and watery with brows knotted, big sweat drops flying off and a wobbly swirl over his tummy.",
  ],
  trampoline: [
    "boy",
    person("a young daredevil pool guest in a blue swim cap and round goggles") +
      "Draw him upside down in the middle of a backflip high over a small round blue trampoline, arms and legs spread, eyes " +
      "wide with thrill, speed lines and two star sparkles round him.",
  ],
  linecut: [
    "tallman",
    person("a pool guest in a black swim cap and round goggles") +
      "Draw him from the chest up barging in: shoulder first, elbows out wide shoving past, chin up, eyes half shut and one " +
      "eyebrow cocked in a smug look, two small shove lines at his elbow.",
  ],
  drop: [
    "dj",
    person("the pool's DJ, with a beard, dark sunglasses, headphones and a floral shirt") +
      "Draw the DJ from the chest up at the big moment of his set: one hand pressing a headphone to his ear, the other arm " +
      "raised high with the finger about to come down, brows up over his sunglasses, bold sound-wave rings pulsing out behind him.",
  ],
  monkey: [
    "monkey",
    person("a snow monkey, grey fur and a pink face") +
      "Draw the monkey's cheeky head and shoulders peeking up over the stone rim of a steaming hot spring, a small folded white " +
      "towel on its head, eyes sliding sideways slyly, wisps of steam rising round it.",
  ],
  // No character in these: an object with a face of its own, in the same finish.
  outage: [
    null,
    "Draw a big cartoon light bulb that has just gone out: dark grey-blue glass, its filament snapped, a bright yellow " +
      "lightning bolt cracking across it and orange sparks flying, and on the glass a pair of big round startled white eyes " +
      "with black pupils and worried eyebrows (no mouth).",
  ],
  poo: [
    null,
    "Draw a cute cartoon poo (a soft brown swirl) bobbing in a small ring of aqua pool water, with big round innocent white " +
      "eyes with black pupils and raised eyebrows (no mouth), two wavy green stink lines rising from it and a tiny fly.",
  ],
  pee: [
    null,
    "Draw a round puddle of aqua pool water with a bright lemon-yellow cloud spreading in the middle of it, and floating on " +
      "it a yellow rubber duck looking guilty: big round white eyes with black pupils sliding sideways, one eyebrow up.",
  ],
  monster: [
    null,
    "Draw a huge curling monster wave of deep teal water with a foaming white crest, towering and about to crash, with a pair " +
      "of big round glaring white eyes with black pupils and angry slanted eyebrows on its face (no mouth), spray flying.",
  ],
  swell: [
    null,
    "Draw a shiny brass ship's bell swinging hard to one side on its bracket, the clapper flying, bold ringing lines on both " +
      "sides, with big round alarmed white eyes with black pupils and raised eyebrows on the bell (no mouth), and a small " +
      "tilted wave under it.",
  ],
  big: [
    null,
    "Draw a big glossy gold star trophy cup bursting upward with confetti and streamers in cherry red, aqua and yellow, " +
      "sparkles round it, with big round excited white eyes with black pupils and raised eyebrows on the cup (no mouth).",
  ],
  wet: [
    null,
    "Draw a shiny blue puddle of water on a pool deck tile with a yellow wet-floor A-frame sign standing in it and a mop " +
      "leaning in from the side, the puddle having big round white eyes with black pupils looking up innocently (no mouth).",
  ],
  dizzy: [
    "woman",
    person("a pool guest in a pink swim cap and round goggles") +
      "Draw her from the shoulders up in aqua water, very dizzy: her eyes turned into spirals, head lolling to one side, brows " +
      "wobbly, a ring of yellow stars and a little bird circling her head, small wavelets round her.",
  ],
  storm: [
    null,
    "Draw a dark puffy storm cloud with a bright yellow lightning bolt striking down and slanting blue rain, with big round " +
      "grumpy white eyes with black pupils and heavy frowning eyebrows on the cloud (no mouth).",
  ],
  rush: [
    "boy",
    person("a pool guest in a blue swim cap and round goggles") +
      "Draw a crowd of five such pool guests in swim caps of different colours (pink, green, black, blue, yellow) all " +
      "squeezing forward together in a bunch toward the viewer, eager eyes, towels and swim rings under their arms.",
  ],
  closure: [
    null,
    "Draw an orange-and-white striped traffic cone with a strip of red-and-white barrier tape tied round it and a small pool " +
      "lane rope float beside it, with big round stern white eyes with black pupils and flat eyebrows on the cone (no mouth).",
  ],
};

const curl = async (args, seconds = 180) =>
  (await run("curl", ["-sS", "--max-time", String(seconds), ...args], { maxBuffer: 1 << 28 })).stdout;
const authed = () => [
  "-H",
  "Authorization: Key " + process.env.FAL_KEY,
  "-H",
  "Content-Type: application/json",
];
const dataUri = (file) => "data:image/jpeg;base64," + readFileSync(HERE + "ref/" + file).toString("base64");

async function make(key, again) {
  const raw = RAW + key + ".png";
  if (!again && existsSync(raw) && statSync(raw).size > 10000) return raw;
  const [ref, what] = STICKERS[key];
  // (the character first, the finish to match last)
  const refs = [...(ref ? [ref + ".jpg"] : ["style-stopwatch.jpg"]), "style-coin.jpg"];
  const body = RAW + key + ".json";
  writeFileSync(
    body,
    JSON.stringify({
      prompt:
        (ref ? "" : "The reference pictures are two of the game's own icons: match their finish. ") +
        what +
        " " +
        STYLE,
      image_urls: refs.map(dataUri),
      image_size: "square_hd",
      background: "transparent",
      quality: "high",
      output_format: "png",
      num_images: 1,
    }),
  );
  const queued = JSON.parse(
    await curl(["-X", "POST", ...authed(), "--data-binary", "@" + body, `https://queue.fal.run/${ENDPOINT}`]),
  );
  if (!queued.status_url) throw new Error(key + ": not queued: " + JSON.stringify(queued).slice(0, 300));
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = JSON.parse(await curl([...authed(), queued.status_url]));
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(key + ": " + JSON.stringify(s).slice(0, 300));
  }
  const result = JSON.parse(await curl([...authed(), queued.response_url]));
  const url = result.images?.[0]?.url;
  if (!url) throw new Error(key + ": no picture: " + JSON.stringify(result).slice(0, 300));
  await curl(["-L", "-o", raw, url]);
  console.log("made", key);
  return raw;
}

// Trimmed to what is drawn, squared with a little room, 192 px, WebP with its transparency.
const READY = `
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
# (the faint haze the model leaves round the white border goes: what is left is the sticker and a hair of soft edge)
r, g, b, a = im.split()
a = a.point(lambda v: 0 if v < 28 else v)
im = Image.merge("RGBA", (r, g, b, a))
box = a.getbbox()
if not box:
    raise SystemExit("nothing drawn in " + src)
im = im.crop(box)
side = int(max(im.size) * 1.04)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.alpha_composite(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
sq.resize((192, 192), Image.LANCZOS).save(out, "WEBP", quality=90, method=6)
`;
async function ready(key) {
  const raw = RAW + key + ".png";
  if (!existsSync(raw)) return console.warn("no raw picture for", key);
  await run(process.env.PYTHON || "python3", ["-c", READY, raw, OUT + key + ".webp"]);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const args = process.argv.slice(2),
    only = args
      .find((a) => a.startsWith("--only="))
      ?.slice(7)
      .split(","),
    keys = Object.keys(STICKERS).filter((k) => !only || only.includes(k)),
    again = args.includes("--again");
  if (!args.includes("--process-only")) {
    if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not set");
    // (a few at a time)
    const queue = [...keys],
      failed = [];
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let key; (key = queue.shift());)
          await make(key, again).catch(
            (e) => (failed.push(key), console.error(String(e.message).slice(0, 400))),
          );
      }),
    );
    if (failed.length) console.error("not made:", failed.join(", "));
  }
  for (const key of keys) await ready(key);
  console.log("ready:", keys.filter((k) => existsSync(OUT + k + ".webp")).length, "of", keys.length);
}
