// The week: Pool Panic's main loop. Coach Panic has five days (two shifts a day) to save up for a weekend date with Marina.
// Pure: no DOM, no storage of its own (the app hands the state in and saves what comes back), seeded, so a check can play it.
//
//   a WEEK      ten shifts, Monday morning to Friday afternoon, at one pool (a chapter). Every shift's pay goes into the Date
//               Fund, which only ever goes up; the goal (the date) is on screen all week. A shift that earns no star loses
//               the week: it starts again on Monday, a new week, with nothing of the old one but what was discovered.
//   a SHIFT     built when it is reached, not written down: a blueprint (one of the season's shifts, for its length, crowd and
//               star targets) and the incident director's draw (which incidents, how many, when), so the same Tuesday never
//               plays the same twice. Before it, the player picks one of two or three cards (a regular day, a booking that
//               pays more for more trouble, a mystery). With it come Marina's wishes, small objectives that pay extra.
//   TIPS        the coach's pocket money, earned in every shift, spent in the shop between shifts on perks that last the week.
//               Spending tips never touches the Date Fund.
//   a CHAPTER   one week at one pool, one date: the club pool, Splash Park, the Sunset Lagoon, the Grand Gala Arena (the
//               ocean trip). After the last one, harder weeks ("heat") go on for good.

import { SHIFTS } from "./sim.mjs";
import { BOOKINGS } from "./bookings.mjs";

export const WEEK_KEY = "pool-panic.week.v1";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const SLOTS = ["morning", "afternoon"];
export const SHIFTS_PER_WEEK = DAYS.length * SLOTS.length;

// ---- the incident director -------------------------------------------------------------------------------------------

// The order in which the roaming incidents first surprise a player. Change it freely: the director only ever brings in the
// next one in this list, and only once the player has played a few shifts.
export const INCIDENT_ORDER = ["dog", "fish", "carl", "outage", "karen"];

// Every roaming incident the director can draw: how heavy it is (`cost`, what it takes from a shift's budget) and how often
// it comes (`weight`). All of them work in every pool.
export const INCIDENTS = {
  dog: { icon: "🐶", name: "Loose dog", cost: 2, weight: 3 },
  fish: { icon: "🐟", name: "Fish kid", cost: 3, weight: 3 },
  carl: { icon: "💣", name: "Cannonball man", cost: 3, weight: 3 },
  outage: { icon: "⚡", name: "Power outage", cost: 3, weight: 2 },
  karen: { icon: "😡", name: "Karen", cost: 2, weight: 2 },
};

// The mid-shift twists, and where each may happen.
export const TWIST_RULES = {
  rush: { weight: 3 },
  closure: { weight: 2 },
  team: { weight: 2 },
  class: { weight: 1, venues: ["club"] },
  storm: { weight: 3, venues: ["lagoon"], lighting: ["dusk", "golden"] },
};

// A small seeded random stream (the same numbers for the same seed, everywhere).
export function stream(seed) {
  // Scrambled first, so seeds next to each other (two weeks started a second apart) start far apart.
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 2246822507) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pickWeighted = (random, items) => {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = random() * total;
  for (const item of items) if ((roll -= item.weight) < 0) return item;
  return items[items.length - 1];
};

// ---- the chapters ----------------------------------------------------------------------------------------------------

// Each chapter is a week at one pool. `blueprints` are the season's shifts the ten shifts are built on (their length, crowd,
// star targets and features), `scale` stretches a blueprint (the Arena's one gala serves for the whole week), `pay` is what a
// star is worth there. The goal is what the date costs: a good week makes it with something to spare, a week of one-star
// shifts does not.
export const CHAPTERS = [
  {
    id: 1,
    venue: "club",
    place: "Community Pool",
    date: { id: "icecream", icon: "🍦", name: "Ice cream on the pier" },
    goal: 500,
    pay: 1,
    blueprints: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 2,
    venue: "resort",
    place: "Splash Park",
    date: { id: "movie", icon: "🎬", name: "Movie night" },
    goal: 700,
    pay: 1.35,
    blueprints: [11, 11, 12, 12, 13, 13, 14, 14, 15, 16],
  },
  {
    id: 3,
    venue: "lagoon",
    place: "Sunset Lagoon",
    date: { id: "dinner", icon: "🍝", name: "Dinner by the lagoon" },
    goal: 780,
    pay: 1.7,
    blueprints: [17, 17, 17, 18, 18, 18, 18, 19, 19, 19],
  },
  {
    id: 4,
    venue: "arena",
    place: "Grand Gala Arena",
    date: { id: "ocean", icon: "🌊", name: "The ocean trip" },
    goal: 1100,
    pay: 2.1,
    blueprints: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    scale: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1],
  },
];
// After the last chapter the weeks go on, each a little hotter: the pools come round again, harder and better paid.
export const HEAT_DATES = [
  { id: "picnic", icon: "🧺", name: "A picnic in the park" },
  { id: "concert", icon: "🎸", name: "A concert under the stars" },
  { id: "karaoke", icon: "🎤", name: "Karaoke night" },
  { id: "sailing", icon: "⛵", name: "A day on a sailboat" },
];
export function chapterFor(n) {
  const index = Math.max(1, Math.floor(n) || 1) - 1;
  if (index < CHAPTERS.length) return { ...CHAPTERS[index], heat: 0 };
  const heat = index - CHAPTERS.length + 1,
    base = CHAPTERS[(heat - 1) % CHAPTERS.length];
  return {
    ...base,
    id: index + 1,
    heat,
    date: HEAT_DATES[(heat - 1) % HEAT_DATES.length],
    goal: Math.round((base.goal * (1 + 0.15 * heat)) / 10) * 10,
    pay: +(base.pay * (1 + 0.15 * heat)).toFixed(2),
  };
}

// ---- the shop --------------------------------------------------------------------------------------------------------

// What the coach can buy with tips, for the rest of the week. `sim` perks are read by the simulation (sim.mjs `perks`), the
// others by the week itself. `price` is in tips.
export const PERKS = {
  shoes: {
    icon: "👟",
    name: "Running shoes",
    text: "The coach runs 12% faster",
    price: 6,
    sim: { speed: 1.12 },
  },
  whistle: { icon: "📯", name: "Turbo whistle", text: "Dash again 40% sooner", price: 5, sim: { dash: 0.6 } },
  benches: {
    icon: "⛱️",
    name: "Shady benches",
    text: "The queue waits 25% longer",
    price: 7,
    sim: { patience: 1.25 },
  },
  stretch: {
    icon: "🧘",
    name: "Stretching poster",
    text: "Half as many cramps",
    price: 6,
    sim: { cramp: 0.5 },
  },
  tummy: {
    icon: "🔔",
    name: "Tummy alarm",
    text: "4 more seconds to send a queasy swimmer home",
    price: 5,
    sim: { warning: 4 },
  },
  megaphone: {
    icon: "📣",
    name: "Megaphone",
    text: "Every swim scores 10% more",
    price: 8,
    sim: { score: 1.1 },
  },
  nodogs: {
    icon: "🚫",
    name: "No dogs sign",
    text: "The loose dog comes far less",
    price: 4,
    director: { dog: 0.25 },
  },
  nobombs: {
    icon: "🪧",
    name: "No bombs sign",
    text: "The cannonball man comes far less",
    price: 4,
    director: { carl: 0.25 },
  },
  tipjar: { icon: "🫙", name: "Tip jar", text: "50% more tips from every shift", price: 5, tips: 1.5 },
  charm: {
    icon: "💐",
    name: "Lucky charm from Marina",
    text: "Marina's wishes pay 50% more",
    price: 6,
    wishes: 1.5,
  },
  sponsor: {
    icon: "🤝",
    name: "Local sponsor",
    text: "+$15 for the date after every shift",
    price: 9,
    sponsor: 15,
  },
  insurance: {
    icon: "🛟",
    name: "Shift insurance",
    text: "One starless shift does not lose the week",
    price: 8,
    insurance: true,
  },
};
export const REROLL_PRICE = 2;
export const SHOP_SIZE = 3;

// What the perks bought this week add up to: the simulation's multipliers, the director's weights and the week's own rules.
export function perkEffects(owned = []) {
  const sim = { speed: 1, dash: 1, patience: 1, cramp: 1, warning: 0, score: 1 },
    director = {};
  let tips = 1,
    wishes = 1,
    sponsor = 0,
    insurance = false;
  for (const id of owned) {
    const p = PERKS[id];
    if (!p) continue;
    for (const [k, v] of Object.entries(p.sim || {})) sim[k] = k === "warning" ? sim[k] + v : sim[k] * v;
    for (const [k, v] of Object.entries(p.director || {})) director[k] = (director[k] ?? 1) * v;
    tips *= p.tips || 1;
    wishes *= p.wishes || 1;
    sponsor += p.sponsor || 0;
    insurance ||= !!p.insurance;
  }
  return { sim, director, tips, wishes, sponsor, insurance };
}

// Three perks the coach does not have yet, from a seeded draw (`roll` counts rerolls so each gives a new hand).
export function shopOffer(week, roll = 0) {
  const random = stream(
    (week.seed ^ Math.imul(week.shift + 1, 2246822519) ^ Math.imul(roll + 1, 3266489917)) >>> 0,
  );
  const pool = Object.keys(PERKS).filter((id) => !week.perks.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SHOP_SIZE);
}

// ---- Marina's wishes (the objectives of a shift) ---------------------------------------------------------------------

// Each wish is something Marina texts before a shift and checks after it. `fits` says whether a shift can have it at all;
// `goal` makes its target for that shift; `met` reads the shift's summary (sim.summary() plus sim.stats).
export const WISHES = {
  smiles: {
    icon: "😊",
    text: (n) => `Make ${n} swimmers happy`,
    say: "Make people smile today! 😊",
    goal: (s) => Math.max(3, Math.round(s.total * 0.45)),
    met: (r, n) => r.happy >= n,
    pay: 15,
  },
  nobody: {
    icon: "🙅",
    text: () => "Nobody storms off",
    say: "Don't let anyone leave grumpy 🥺",
    fits: (s) => s.total >= 6,
    met: (r) => r.lost === 0,
    pay: 20,
  },
  streak: {
    icon: "✨",
    text: (n) => `A happy streak of ${n}`,
    say: "Keep a happy streak going ✨",
    goal: (s) => Math.min(8, Math.max(3, Math.round(s.total * 0.25))),
    met: (r, n) => r.bestStreak >= n,
    pay: 15,
  },
  twostars: {
    icon: "⭐",
    text: () => "Earn ★★ or better",
    say: "Two stars and I'll be impressed ⭐",
    met: (r) => r.stars >= 2,
    pay: 20,
  },
  perfect: {
    icon: "🌟",
    text: () => "A perfect ★★★ shift",
    say: "Three stars? You'd be my hero 🌟",
    fits: (s) => s.index >= 2,
    met: (r) => r.stars >= 3,
    pay: 40,
  },
  smooth: {
    icon: "🏊",
    text: () => "No collisions in the lanes",
    say: "No bumping into each other! 🏊",
    fits: (s) => s.total >= 6,
    met: (r) => r.collisions === 0,
    pay: 20,
  },
  quick: {
    icon: "⏱️",
    text: (n) => `Average wait under ${n} s`,
    say: "Nobody likes waiting ⏱️",
    goal: (s) => (s.tier >= 8 ? 14 : 12),
    met: (r, n) => r.avgWait <= n,
    pay: 15,
  },
  mood: {
    icon: "💛",
    text: (n) => `Average mood ${n}% or more`,
    say: "Happy pool, happy me 💛",
    goal: (s) => (s.tier >= 10 ? 70 : 75),
    met: (r, n) => r.avgHappiness >= n,
    pay: 15,
  },
  saves: {
    icon: "🛡️",
    text: () => "Stop trouble before it starts",
    say: "Catch trouble early, my hero 🛡️",
    fits: (s) => s.incidents.length > 0,
    met: (r, n, st) => (st.prevented || 0) >= 1,
    pay: 25,
  },
  clean: {
    icon: "💧",
    text: () => "Keep the water clean",
    say: "Please, no accidents in the pool 💧",
    fits: (s) => s.tier >= 3,
    met: (r) => (r.catastrophes || 0) === 0,
    pay: 15,
  },
  vips: {
    icon: "👑",
    text: (n) => `Serve ${n} VIP${n > 1 ? "s" : ""}`,
    say: "Treat the VIPs like royalty 👑",
    fits: (s) => s.vips > 0,
    goal: (s) => s.vips,
    met: (r, n, st) => (st.vips || 0) >= n,
    pay: 30,
  },
  flips: {
    icon: "🤸",
    text: (n) => `${n} clean trampoline flip${n > 1 ? "s" : ""}`,
    say: "Show me some flips! 🤸",
    fits: (s) => s.daredevils > 0,
    goal: (s) => Math.max(1, Math.min(3, s.daredevils - 1)),
    met: (r, n, st) => (st.flips || 0) >= n,
    pay: 25,
  },
};
export const WISHES_PER_SHIFT = 2;

// The wishes of one shift: two that fit it, drawn from its seed. Each says its target and what it pays.
export function drawWishes(shape, random, payScale = 1) {
  const fitting = Object.entries(WISHES).filter(([, w]) => !w.fits || w.fits(shape));
  for (let i = fitting.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fitting[i], fitting[j]] = [fitting[j], fitting[i]];
  }
  return fitting.slice(0, WISHES_PER_SHIFT).map(([id, w]) => {
    const target = w.goal ? w.goal(shape) : 0;
    return { id, icon: w.icon, text: w.text(target), say: w.say, target, pay: roundPay(w.pay * payScale) };
  });
}
export function checkWishes(wishes, summary, stats = {}) {
  return wishes.map((w) => ({ ...w, met: !!WISHES[w.id]?.met(summary, w.target, stats) }));
}

// ---- building a shift -------------------------------------------------------------------------------------------------

const roundPay = (n) => Math.max(5, Math.round(n / 5) * 5);
const scaleBlueprint = (bp, f) =>
  f === 1
    ? bp
    : {
        ...bp,
        duration: Math.round(bp.duration * f),
        total: Math.max(4, Math.round(bp.total * f)),
        thresholds: bp.thresholds.map((t) => Math.round((t * f) / 50) * 50),
      };

// The director's draw for one shift. `known` are the incidents the player has met; one that is not yet known may come as a
// surprise (`surprise`). `extraBudget` is the mystery card's. Returns { chaos, twist, incidents, surprise }.
export function directShift({
  blueprint,
  venue,
  random,
  known = [],
  index = 0,
  heat = 0,
  extraBudget = 0,
  weights = {},
  surprised = false,
}) {
  const slots = (blueprint.chaos || []).length;
  // Gentle at first: the first shifts of the first week have nothing, then the count follows the blueprint, with a little
  // give either way so a player cannot count on it.
  let count = slots;
  if (slots > 0) count = Math.max(1, slots + (random() < 0.3 ? -1 : random() < 0.35 ? 1 : 0));
  count = Math.min(slots + 1, count + extraBudget + (heat > 0 ? 1 : 0));
  // A surprise: the next incident in the order, once the player has a few shifts behind them, never two in a row.
  const next = INCIDENT_ORDER.find((k) => !known.includes(k));
  const roll = random();
  const surprise = next && index >= 3 && !surprised && (roll < 0.55 || extraBudget > 0) ? next : null;
  if (surprise && count === 0) count = 1;
  const pool = INCIDENT_ORDER.filter((k) => known.includes(k)).map((k) => ({
    kind: k,
    weight: INCIDENTS[k].weight * (weights[k] ?? 1),
  }));
  const kinds = [];
  if (surprise) kinds.push(surprise);
  while (kinds.length < count && pool.length) {
    const last = kinds[kinds.length - 1];
    const choice = pickWeighted(
      random,
      pool.map((p) => ({ ...p, weight: p.kind === last ? p.weight * 0.25 : p.weight })),
    );
    kinds.push(choice.kind);
  }
  // Spread them over the shift (never in its last 20 s), in a random order, each in its own window.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const start = Math.max(12, blueprint.duration * 0.14),
    end = blueprint.duration - 22,
    span = Math.max(1, (end - start) / Math.max(1, kinds.length));
  const chaos = kinds.map((kind, i) => {
    const a = start + i * span + random() * span * 0.25;
    return { kinds: [kind], window: [Math.round(a + span * 0.05), Math.round(a + span * 0.7)] };
  });
  // Twists: as many as the blueprint had, of kinds this pool allows, at random moments.
  const allowed = Object.entries(TWIST_RULES)
    .filter(([, r]) => !r.venues || r.venues.includes(venue))
    .filter(([, r]) => !r.lighting || r.lighting.includes(blueprint.lighting))
    .map(([kind, r]) => ({ kind, weight: r.weight }));
  const twistCount = (blueprint.twist || []).length + (heat > 1 && random() < 0.5 ? 1 : 0);
  const twist = [];
  for (let i = 0; i < twistCount && allowed.length; i++) {
    const options = allowed.filter((t) => !twist.some((x) => x.kind === t.kind));
    if (!options.length) break;
    const t = pickWeighted(random, options);
    twist.push({
      kind: t.kind,
      at: +(0.25 + (0.5 * (i + random())) / twistCount).toFixed(2),
      ...(t.kind === "rush" && { count: blueprint.total >= 24 ? 5 : 3 }),
    });
  }
  twist.sort((a, b) => a.at - b.at);
  return { chaos, twist, incidents: [...new Set(kinds)], surprise };
}

// The cards offered before a shift: a regular day, a booking (more trouble, better pay) once a few shifts are behind, and a
// mystery once the week is under way. A booking is only offered when its trouble is known.
export function shiftCards(index, random, known = [], blueprint = {}) {
  const cards = [
    { id: "regular", icon: "🏊", name: "Regular day", note: "Just a normal shift", payout: 1, danger: 1 },
  ];
  if (index >= 2) {
    const fixedLight = blueprint.daylight || blueprint.venue === "arena" || blueprint.lighting === "night";
    const bookings = Object.values(BOOKINGS).filter(
      (b) =>
        b.id !== "regular" &&
        !(b.lighting && fixedLight) &&
        (b.chaos || []).every((c) => c.kinds.every((k) => known.includes(k))),
    );
    if (bookings.length) {
      const b = bookings[Math.floor(random() * bookings.length)];
      cards.push({
        id: b.id,
        booking: b.id,
        icon: b.icon,
        name: b.name,
        note: b.note,
        payout: b.payout,
        danger: 2,
      });
    }
  }
  if (index >= 4 && random() < 0.7)
    cards.push({
      id: "mystery",
      icon: "🎲",
      name: "Mystery gig",
      note: "Who knows what walks in? Pays well",
      payout: 1.3,
      danger: 3,
      mystery: true,
    });
  return cards;
}

// One shift of the week: everything the game needs to play it. `card` is the card picked (or null for the first look).
export function buildShift(week, card = null, known = week.known || []) {
  const chapter = chapterFor(week.chapter),
    index = week.shift,
    tier = chapter.blueprints[index],
    f = chapter.scale?.[index] ?? 1;
  const blueprint = scaleBlueprint({ ...SHIFTS[tier - 1], venue: SHIFTS[tier - 1].venue || "club" }, f);
  const random = stream((week.seed ^ Math.imul(index + 1, 2654435761)) >>> 0);
  const cards = shiftCards(index, stream((week.seed ^ Math.imul(index + 7, 40503)) >>> 0), known, blueprint);
  const chosen = (card && cards.find((c) => c.id === card)) || null;
  const effects = perkEffects(week.perks);
  const plan = directShift({
    blueprint,
    venue: blueprint.venue,
    random,
    known,
    index: week.chapter > 1 ? index + 3 : index,
    heat: chapter.heat,
    extraBudget: chosen?.mystery ? 1 : 0,
    weights: effects.director,
    surprised: !!week.history[week.history.length - 1]?.surprise,
  });
  const { chaos: _c, twist: _t, intro: _i, booking: _b, payout: _p, ...rest } = blueprint;
  const config = {
    ...rest,
    name: DAYS[Math.floor(index / 2)] + " " + SLOTS[index % 2],
    chaos: plan.chaos,
    twist: plan.twist,
    ...(chosen?.mystery && { payout: 1.15 }),
    week: { chapter: week.chapter, shift: index },
  };
  if (plan.surprise) config.intro = plan.surprise;
  const shape = {
    index,
    tier,
    total: config.total,
    incidents: plan.incidents,
    vips: (config.vipAt || []).length,
    daredevils: (config.daredevilAt || []).length,
  };
  const wishes = drawWishes(shape, stream((week.seed ^ Math.imul(index + 3, 362437)) >>> 0), chapter.pay);
  return {
    index,
    day: DAYS[Math.floor(index / 2)],
    slot: SLOTS[index % 2],
    tier,
    chapter,
    config,
    booking: chosen?.booking || null,
    cards,
    card: chosen,
    wishes,
    plan,
    pass: passMark(config),
    perks: effects.sim,
  };
}

// ---- the week's state --------------------------------------------------------------------------------------------------

export const PAY = { base: 15, star: 15 };
// A shift is complete when its score reaches the pass mark, half of its first star: below it the pool is a mess and the week
// is lost. It is on screen before the shift and in the HUD during it.
export const PASS_SHARE = 0.5;
export const passMark = (config) => Math.max(50, Math.round((config.thresholds[0] * PASS_SHARE) / 50) * 50);

// What a shift pays into the Date Fund: a little for finishing, more for each star, by the chapter and the card.
export function shiftPay(stars, chapter, card) {
  if (stars < 0) return 0;
  return roundPay((PAY.base + PAY.star * Math.min(3, stars)) * chapter.pay * (card?.payout || 1));
}
// Tips: pocket money for the shop.
export function shiftTips(stars, summary = {}, stats = {}, wishesMet = 0, multiplier = 1) {
  const raw = 2 + stars + Math.min(3, stats.prevented || 0) + wishesMet;
  return Math.round(raw * multiplier);
}

export function newWeek(save, seed = Date.now()) {
  return {
    chapter: save.chapter,
    seed: seed >>> 0 || 1,
    shift: 0,
    fund: 0,
    tips: 0,
    perks: [],
    insuranceUsed: false,
    rolls: 0,
    history: [],
    status: "playing", // "playing" | "won" | "lost"
  };
}

// The save: which chapter the player is on, what they have discovered, the dates they have had, and the week in progress.
export function normalizeWeekSave(saved = {}) {
  const s = saved && typeof saved === "object" ? saved : {};
  const known = Array.isArray(s.known) ? s.known.filter((k) => INCIDENTS[k]) : [];
  const dates = Array.isArray(s.dates) ? s.dates.filter((d) => typeof d === "string" && d.length < 40) : [];
  const chapter = Math.max(1, Math.min(99, Math.floor(Number(s.chapter)) || 1));
  let week = null;
  const w = s.week;
  if (w && typeof w === "object" && w.status === "playing") {
    const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
    week = {
      chapter,
      seed: num(w.seed, 4294967295) || 1,
      shift: num(w.shift, SHIFTS_PER_WEEK - 1),
      fund: num(w.fund, 1e6),
      tips: num(w.tips, 1e4),
      perks: Array.isArray(w.perks) ? [...new Set(w.perks.filter((p) => PERKS[p]))] : [],
      insuranceUsed: !!w.insuranceUsed,
      rolls: num(w.rolls, 1e4),
      history: Array.isArray(w.history) ? w.history.slice(0, SHIFTS_PER_WEEK) : [],
      status: "playing",
    };
  }
  return {
    chapter,
    known: [...new Set(known)],
    dates,
    weeksLost: Math.max(0, Math.floor(Number(s.weeksLost)) || 0),
    bestFund: Math.max(0, Math.floor(Number(s.bestFund)) || 0),
    invited: Array.isArray(s.invited)
      ? s.invited.filter((n) => Number.isInteger(n) && n > 0).slice(-100)
      : [],
    week,
  };
}

// A shift is over. Returns what happened (for the results screen) and changes `save` (and its week) in place:
//   failed   no star: the week is lost (unless insurance covers it)
//   last     the week's last shift: `won` when the Date Fund reached the goal, else lost
export function finishShift(save, shift, summary, stats = {}) {
  const week = save.week,
    chapter = chapterFor(week.chapter),
    effects = perkEffects(week.perks),
    stars = summary.stars || 0,
    pass = passMark(shift.config),
    passed = (summary.score || 0) >= pass;
  const wishes = checkWishes(shift.wishes, summary, stats);
  for (const k of shift.plan.incidents) if (!save.known.includes(k)) save.known.push(k);
  const insured = !passed && effects.insurance && !week.insuranceUsed;
  if (insured) week.insuranceUsed = true;
  const failed = !passed && !insured;
  const pay = passed ? shiftPay(stars, chapter, shift.card) : 0,
    wishPay = failed
      ? 0
      : wishes.filter((w) => w.met).reduce((sum, w) => sum + roundPay(w.pay * effects.wishes), 0),
    sponsor = passed ? effects.sponsor : 0,
    gained = failed ? 0 : pay + wishPay + sponsor,
    tips = failed ? 0 : shiftTips(stars, summary, stats, wishes.filter((w) => w.met).length, effects.tips);
  const before = week.fund;
  week.fund += gained;
  week.tips += tips;
  week.history.push({
    stars,
    score: Math.round(summary.score || 0),
    gained,
    wishes: wishes.filter((w) => w.met).length,
    surprise: shift.plan.surprise || null,
  });
  const last = week.shift >= SHIFTS_PER_WEEK - 1;
  const result = {
    stars,
    pass,
    passed,
    pay,
    wishPay,
    sponsor,
    gained,
    tips,
    wishes,
    insured,
    failed,
    before,
    fund: week.fund,
    goal: chapter.goal,
    last,
    won: false,
    lost: false,
    chapter,
    surprise: shift.plan.surprise,
  };
  if (failed) {
    result.lost = true;
    week.status = "lost";
    save.weeksLost++;
  } else if (last) {
    result.won = week.fund >= chapter.goal;
    result.lost = !result.won;
    week.status = result.won ? "won" : "lost";
    if (result.won) {
      save.dates.push(chapter.date.id);
      save.chapter = week.chapter + 1;
    } else save.weeksLost++;
  } else {
    week.shift++;
    week.rolls = 0;
  }
  save.bestFund = Math.max(save.bestFund, week.fund);
  if (week.status !== "playing") save.week = null;
  return result;
}

// Where the week stands against its goal, for the Date Fund bar: how far, and whether the pace will make it.
export function outlook(week) {
  const chapter = chapterFor(week.chapter),
    played = week.shift,
    left = SHIFTS_PER_WEEK - played,
    share = Math.min(1, week.fund / chapter.goal),
    need = Math.max(0, chapter.goal - week.fund),
    perShift = left > 0 ? need / left : need;
  // A two-star shift on a regular card, with one of Marina's wishes, is the "on track" pace.
  const pace = shiftPay(2, chapter, null) + roundPay(20 * chapter.pay);
  return {
    share,
    need,
    left,
    perShift: Math.ceil(perShift),
    onTrack: need === 0 || perShift <= pace,
    reached: need === 0,
  };
}

// Buying: tips go down, the perk is the week's. Never touches the Date Fund.
export function buyPerk(week, id) {
  const p = PERKS[id];
  if (!p || week.perks.includes(id) || week.tips < p.price) return false;
  week.tips -= p.price;
  week.perks.push(id);
  return true;
}
export function reroll(week) {
  if (week.tips < REROLL_PRICE) return false;
  week.tips -= REROLL_PRICE;
  week.rolls++;
  return true;
}

// Marina's texts as the Date Fund fills (a share of the goal passed by this shift).
export const MARINA_TEXTS = [
  { at: 0.25, text: "A quarter of the way! I'm already picking an outfit 👗" },
  { at: 0.5, text: "Halfway there! I can't wait for the weekend 💕" },
  { at: 0.75, text: "Almost! Don't let a fish ruin it now 🐟😅" },
  { at: 1, text: "You did it! It's a date this weekend 💖" },
];
export const textsPassed = (before, after, goal) =>
  MARINA_TEXTS.filter((m) => before / goal < m.at && after / goal >= m.at);
