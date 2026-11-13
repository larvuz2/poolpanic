// What needs the coach right now, as the HUD shows it since 13 November 2026 (the creator: "minimize all of the text that is on
// the HUD… when Karen comes out, we see a lot of text displaying on a card saying, 'Go near, press E to interact.' I don't need
// to know all that. The only thing I need to know on the HUD is that Karen is there… minimize the card into an icon… like a
// sticker, so maybe I can see there are two or three remaining incidents that need my attention… if I hover over the sticker…
// 'Find Karen and calm her down'… Do not add the 'Press E to interact' text. That's obvious").
//
// One card for every incident pending, the most pressing first, each with the sticker it wears (assets/hud/stickers/, made by
// tools/hud/stickers.mjs), a title of a word or three and one short line: what to do, never which key. Until then the HUD showed
// one incident's banner at a time (sim.incidentPanel) with its steps, and a status box that said it again with the keys.
// Pure: it reads the simulation and writes nothing.

// The stickers there are (every key has its picture; stickers-check.mjs).
export const STICKERS = [
  "karen",
  "carl",
  "leopard",
  "fish",
  "dog",
  "influencer",
  "massage",
  "rescue",
  "firstaid",
  "tummy",
  "trampoline",
  "linecut",
  "drop",
  "monkey",
  "outage",
  "poo",
  "pee",
  "monster",
  "swell",
  "big",
  "wet",
  "dizzy",
  "storm",
  "rush",
  "closure",
];
export const stickerUrl = (key) => "./assets/hud/stickers/" + key + ".webp";

// The sticker a sting wears (moments.mjs STINGS: the moment an incident begins or gets worse), by the sting's kind.
const STING_STICKERS = {
  cramp: "rescue",
  stomach: "tummy",
  bladder: "tummy",
  pee: "pee",
  spill: "poo",
  fish: "fish",
  "fish-loose": "fish",
  dog: "dog",
  karen: "karen",
  influencer: "influencer",
  massage: "massage",
  carl: "carl",
  flicker: "outage",
  blackout: "outage",
  tower: "trampoline",
  "tower-go": "trampoline",
  rush: "rush",
  team: "rush",
  class: "rush",
  closure: "closure",
  storm: "storm",
  wet: "wet",
  dizzy: "dizzy",
  knockout: "rescue",
  monster: "monster",
  selfie: "influencer",
  overboard: "rescue",
  "fell-in": "rescue",
  monkey: "monkey",
  "monkey-in": "monkey",
  "dive-fail": "rescue",
  "line-cut": "linecut",
  crash: "firstaid",
};
// (the cannonball man is Carl or the leopard man, by the level: his own face)
export const cannonballSticker = (sim) => (sim?.carl?.figure === "leopard" ? "leopard" : "carl");
// (`e`: the sting's event; the cannonball man's is told by his name)
export function stingSticker(kind, e = {}) {
  if (String(kind).startsWith("big-")) return "big";
  if (kind === "carl") return /leopard/i.test(e?.name || "") ? "leopard" : "carl";
  return STING_STICKERS[kind] || null;
}
// What a sting says under its title the first time a player meets it: the same short line as the sticker's card.
const STING_LINES = {
  cramp: "Bring them a life ring",
  stomach: "Send {name} to the locker room",
  bladder: "Send {name} to the locker room",
  pee: "Chlorine the water",
  spill: "Skim it out, then chlorine",
  fish: "Stop {name} before the edge",
  "fish-loose": "Net the fish",
  dog: "Lure it out with the dog treats",
  karen: "Find Karen and calm her down",
  influencer: "Move them along",
  massage: "{name} wants a massage",
  carl: "Stop him before he jumps",
  flicker: "Reset the fuse box",
  blackout: "Flashlight, then the fuse box",
  tower: "Move everyone out of lane {lane}",
  "tower-go": "Keep the lane clear",
  rush: "A crowd is coming",
  closure: "One lane fewer for a while",
  team: "They all want fast lanes",
  class: "They all want a quiet corner",
  storm: "The lights may go",
  wet: "Mop it before somebody slips",
  dizzy: "Hand them a tube",
  knockout: "Bring them a life ring",
  monster: "Stop the waves, or brace",
  selfie: "Talk them down from the edge",
  overboard: "Haul them back up",
  "fell-in": "Help them out of the pool",
  monkey: "Shoo it off before it gets in",
  "monkey-in": "Shoo it out of the spring",
  "dive-fail": "Bring them a life ring",
  "line-cut": "Send them to the back",
  crash: "A ring for everyone, then first aid",
};
export const stingLine = (kind, e = {}) =>
  (STING_LINES[kind] || "")
    .replace("{name}", e.name || "them")
    .replace("{lane}", e.lane != null ? e.lane + 1 : "");

// A task as the old banner wrote it, without its keys ("· E", "(E)", "hold E", "(1)") and its leading emoji.
export const plain = (text) =>
  String(text || "")
    .replace(/\s*\((?:[A-Z]|[0-9])\)/g, "")
    .replace(/\s*·\s*(?:then\s+)?(?:hold|press)?\s*E\b[^·]*/gi, "")
    .replace(/\s*·\s*[A-Z] (?:to|stops?)\b[^·]*/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
const upper = (s) => String(s || "").toUpperCase();
const clamp01 = (n) => Math.max(0, Math.min(1, n));
// (a fuse nearly burnt: the sticker's mark turns red)
const LOW = 0.35;

// One card: {id, sticker, title, line, timer (1 → 0, or null), urgent}.
const card = (id, sticker, title, line, timer = null, urgent = false) => ({
  id,
  sticker,
  title,
  line,
  timer: Number.isFinite(timer) ? clamp01(timer) : null,
  urgent: urgent || (Number.isFinite(timer) && timer < LOW),
});

// Each incident's own words. `p` is its old banner (system.panel), kept for whether it is on, its fuse and a name in its title.
const WORDS = {
  karen: (sim) =>
    card("karen", "karen", "KAREN", sim.karen?.calming ? "Keep calming her" : "Find Karen and calm her down"),
  carl(sim, p) {
    const k = sim.carl,
      v = sim.visitor(k.id),
      wet = ["flying", "floating", "swimming", "climbing"].includes(v?.status);
    return card(
      "carl",
      cannonballSticker(sim),
      "CANNONBALL " + upper(k.name),
      wet
        ? "Catch him when he climbs out"
        : k.cannonballs
          ? "Catch him on the deck"
          : "Stop him before he jumps",
      k.cannonballs ? null : p.timer,
    );
  },
  fish(sim, p) {
    const f = sim.fish,
      c = sim.coach,
      kid = sim.visitor(f.kid)?.name || "the kid";
    if (f.stage === "approach")
      return card("fish", "fish", "FISH KID", "Stop " + kid + " before the edge", p.timer);
    const line =
      f.stage === "loose"
        ? c.carry === "fishnet"
          ? "Net the fish"
          : "Get the fish net"
        : f.stage === "netted" || (c.carry === "fishnet" && c.netLoaded)
          ? "Give the fish back to " + kid
          : "Hang up the net";
    return card(
      "fish",
      "fish",
      f.stage === "loose" ? "FISH IN THE POOL" : "FISH CAUGHT",
      line,
      null,
      f.stage === "loose",
    );
  },
  dog(sim) {
    const d = sim.dog,
      name = sim.visitor(d.id)?.name || "the dog";
    return card(
      "dog",
      "dog",
      "LOOSE DOG",
      d.stage === "following"
        ? "Lead " + name + " to " + (sim.venue.doorWord || "the door")
        : sim.coach.carry === "treats"
          ? "Lure " + name + " with the treats"
          : "Get the dog treats",
    );
  },
  outage(sim, p) {
    const o = sim.outage;
    if (o.stage === "flicker")
      return card("outage", "outage", "LIGHTS FLICKERING", "Reset the fuse box", p.timer);
    return card(
      "outage",
      "outage",
      "BLACKOUT",
      sim.coach.carry === "flashlight" ? "Reset the fuse box" : "Get the flashlight",
      null,
      true,
    );
  },
  influencer: (sim) => {
    const v = sim.visitor(sim.influencer.id);
    return card("influencer", "influencer", "INFLUENCER", "Move " + (v?.name || "them") + " along");
  },
  massage(sim, p) {
    // (the one whose patience is shortest: the banner's own, massage.mjs `urgent`)
    const edgy = p.icon === "😤",
      lying = (sim.massages || [])
        .filter((m) => m.id != null && ["walk", "climb", "lying"].includes(m.stage))
        .sort((a, b) => a.patience - b.patience)[0],
      name = (lying && sim.get(lying.id)?.name) || "Someone";
    return card(
      "massage",
      "massage",
      "MASSAGE",
      name + (edgy ? " is losing patience" : " wants a massage"),
      null,
      edgy,
    );
  },
  trampoline(sim, p) {
    const hurt = sim.people.filter((q) => q.status === "injured").length;
    if (hurt)
      return card(
        "firstaid",
        "firstaid",
        "FIRST AID",
        sim.coach.carry === "medkit" ? "Patch them up" : "Get the medical kit",
        null,
        true,
      );
    const j = sim.get(sim.jumper),
      lane = sim.venue.trampoline.lane + 1;
    if (j?.jumpStage === "waiting")
      return card("trampoline", "trampoline", "DAREDEVIL", "Move everyone out of lane " + lane, p.timer);
    return card("trampoline", "trampoline", "FLIP INCOMING", "Keep lane " + lane + " clear");
  },
  big: (sim, p) => card("big", "big", p.title.replace(/^⭐\s*/, ""), plain(p.task), p.timer),
  boards: (sim, p) => card("linecut", "linecut", "LINE CUTTER", "Send them to the back", p.timer),
  monkeys: (sim, p) => card("monkey", "monkey", upper(p.title).replace(/!$/, ""), "Shoo it out", null, true),
  roof: (sim, p) =>
    card("drop", "drop", upper(p.title).replace(/!$/, ""), "Get everyone off the edge", null, true),
  ship: (sim, p) => card("swell", "swell", upper(p.title).replace(/!$/, ""), "Hold on", null, true),
  waves: (sim, p) =>
    card("monster", "monster", upper(p.title).replace(/!$/, ""), "Stop the waves, or brace", null, true),
};

const CLEANUP_LINES = { caught: "Bin it", return: "Hang up the skimmer", treat: "Chlorine the water" };

// Everything pending, the most pressing first: a rescue, a clean-up, a guest about to be sick, then the incidents in the
// director's own order (chaos.mjs SYSTEMS).
export function incidentCards(sim) {
  const cards = [];
  if (!sim || sim.status === "ended") return cards;
  const r = sim.rescue;
  if (r?.kind === "crash")
    cards.push(
      card(
        "rescue",
        "firstaid",
        "CRASH",
        r.stage === "stranded" ? "A life ring for everyone" : "Everyone out of the water",
        null,
        true,
      ),
    );
  else if (r)
    cards.push(
      card(
        "rescue",
        "rescue",
        "SWIMMER IN TROUBLE",
        r.stage === "stranded"
          ? sim.coach.carry === "lifering" || sim.coach.swimming
            ? "Swim the ring to them"
            : "Bring them a life ring"
          : "Get them to the edge",
        null,
        true,
      ),
    );
  const q = sim.cleanup;
  if (q)
    cards.push(
      q.kind === "pee"
        ? card("cleanup", "pee", "WHO PEED?!", "Chlorine the water", null, true)
        : card(
            "cleanup",
            "poo",
            "EVERYBODY OUT",
            CLEANUP_LINES[q.stage] || (sim.coach.carry === "skimmer" ? "Skim it out" : "Get the skimmer"),
            null,
            true,
          ),
    );
  // (guests about to be sick or to wee: one card for them all, the nearest fuse on it)
  let queasy = null,
    count = 0;
  for (const p of sim.people)
    if (p.stomachWarning && p.status !== "gone") {
      count++;
      if (!queasy || p.sicknessTimer < queasy.sicknessTimer) queasy = p;
    }
  if (queasy)
    cards.push(
      card(
        "tummy",
        "tummy",
        "TUMMY TROUBLE",
        count > 1 ? count + " guests need the locker room" : "Send " + queasy.name + " to the locker room",
        queasy.sicknessDuration ? queasy.sicknessTimer / queasy.sicknessDuration : null,
      ),
    );
  // (the incidents keep their stickers through a rescue or a clean-up: what is still to do after)
  for (const system of sim.systems || []) {
    const words = WORDS[system.key];
    if (!words) continue;
    let p = null;
    try {
      p = system.panel?.(sim);
    } catch {}
    if (!p) continue;
    const made = words(sim, p);
    if (made && !cards.some((c) => c.id === made.id)) cards.push(made);
  }
  return cards;
}
