// The story, as data: Coach Panic wants to take Marina to the ocean and has to earn the trip, one shift at a time. Every
// shift pays into the Ocean Fund; a riskier booking pays more. Pure module (no DOM, no globals) so a check can drive it.
//
// The scenes are placeholders on purpose (emoji on a painted backdrop, see cinematic.mjs): they are plain data, so
// real art can replace them later without touching the rules below. A layer is {e: emoji, x, y, s, a?} (x and y in
// percent of the stage, s the size in percent of its width, a an animation name) or {b: text, x, y} for a speech bubble.

export const STORY = {
  coach: "Coach Panic",
  love: "Marina",
  goal: 1500, // what the day at the ocean costs, in dollars
  storageKey: "pool-panic.story.v1",
};

// What a shift pays: a little for finishing, more for every star, times the booking's payout.
export const PAY = { finish: 10, perStar: 30 };

export const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

export function shiftPay(stars = 0, payout = 1) {
  const base = PAY.finish + Math.max(0, Math.min(3, stars)) * PAY.perStar;
  return Math.round((base * (payout || 1)) / 5) * 5;
}

// Marina texts the coach as the fund grows.
export const MILESTONES = [
  { at: 0.25, text: "I bought a sun hat for the trip! 👒" },
  { at: 0.5, text: "Halfway there! I packed the sunscreen ☀️" },
  { at: 0.75, text: "I can almost smell the salt already 🌊" },
  { at: 1, text: "Pick me up at eight. Bring your whistle! 🎉" },
];

// Saved on the device: whether the intro has been seen, whether the ending has been earned, and the best pay of each
// shift (a replay only adds what it earns beyond that best, so the fund cannot be farmed and never goes down).
export function normalizeStory(saved = {}) {
  const pay = {};
  for (const [key, value] of Object.entries(saved?.pay && typeof saved.pay === "object" ? saved.pay : {})) {
    const n = Math.max(0, Math.min(10000, Math.floor(Number(value)) || 0));
    if (n && /^(drill:)?\w{1,24}$/.test(key)) pay[key] = n;
  }
  return { seen: !!saved?.seen, ending: !!saved?.ending, pay };
}

export const fundOf = (story) => Object.values(story.pay).reduce((sum, n) => sum + n, 0);
export const fundShare = (story) => Math.min(1, fundOf(story) / STORY.goal);

// A shift is over: what it paid, what the fund holds now, and which of Marina's texts (and the goal) it just passed.
export function recordPay(story, key, amount) {
  const before = fundOf(story),
    best = story.pay[key] || 0,
    gained = Math.max(0, Math.round(amount) - best);
  if (gained) story.pay[key] = best + gained;
  const after = fundOf(story),
    share = (n) => Math.min(1, n / STORY.goal);
  return {
    paid: Math.round(amount),
    gained,
    before,
    after,
    texts: MILESTONES.filter((m) => share(before) < m.at && share(after) >= m.at),
    reached: before < STORY.goal && after >= STORY.goal,
  };
}

// ---- the scenes -----------------------------------------------------------------------------------------------------

export const INTRO = [
  {
    bg: "pool",
    hold: 3800,
    text: `${STORY.coach} guards Splash Park. Every splash, every swimmer, every day.`,
    layers: [
      { e: "🏊", x: 22, y: 74, s: 9, a: "bob" },
      { e: "🏊", x: 78, y: 78, s: 8, a: "bob2" },
      { e: "🧑", x: 50, y: 52, s: 18, a: "sway" },
      { e: "📣", x: 64, y: 40, s: 7, a: "pulse" },
    ],
  },
  {
    bg: "pool",
    hold: 3800,
    text: `${STORY.love} loves the ocean. She has never seen it.`,
    layers: [
      { e: "👩", x: 36, y: 56, s: 18, a: "sway" },
      { b: "I've never seen the ocean… someday! 🌊", x: 66, y: 30 },
      { e: "🌊", x: 86, y: 78, s: 10, a: "float" },
    ],
  },
  {
    bg: "dream",
    hold: 4200,
    text: `${STORY.coach} has one dream: to take ${STORY.love} to the ocean.`,
    layers: [
      { e: "🧑", x: 34, y: 66, s: 15, a: "bob" },
      { e: "☁️", x: 62, y: 34, s: 44, a: "float" },
      { e: "🧑", x: 55, y: 34, s: 10 },
      { e: "👩", x: 68, y: 34, s: 10 },
      { e: "🌅", x: 62, y: 20, s: 8 },
      { e: "🏖️", x: 62, y: 46, s: 9 },
    ],
  },
  {
    bg: "jar",
    hold: 0,
    text: `But the trip costs ${money(STORY.goal)}. Time to work! Every shift pays into the Ocean Fund. Riskier gigs pay more.`,
    layers: [
      { e: "💰", x: 50, y: 56, s: 22, a: "pulse" },
      { e: "🎟️", x: 30, y: 40, s: 9, a: "float" },
      { e: "🎟️", x: 70, y: 42, s: 9, a: "float2" },
      { b: `Ocean Fund: {fund} / ${money(STORY.goal)}`, x: 50, y: 18 },
    ],
  },
];

export const ENDING = [
  {
    bg: "sea",
    hold: 3800,
    text: `The Ocean Fund is full! ${STORY.coach} picks ${STORY.love} up at eight.`,
    layers: [
      { e: "🚌", x: 40, y: 66, s: 20, a: "drive" },
      { e: "☀️", x: 84, y: 20, s: 10, a: "pulse" },
      { b: "Are we there yet? 😄", x: 62, y: 30 },
    ],
  },
  {
    bg: "sea",
    hold: 4200,
    text: `${STORY.love} sees the ocean for the very first time.`,
    layers: [
      { e: "👩", x: 40, y: 60, s: 16, a: "sway" },
      { e: "🧑", x: 56, y: 62, s: 16, a: "sway" },
      { e: "🌊", x: 24, y: 84, s: 12, a: "float" },
      { e: "🌊", x: 78, y: 86, s: 12, a: "float2" },
      { b: "It's even bluer than the pool! 🌊", x: 52, y: 26 },
    ],
  },
  {
    bg: "sea",
    hold: 0,
    text: "Thanks for playing! The pool never really closes, so keep going for bigger scores.",
    layers: [
      { e: "❤️", x: 50, y: 34, s: 14, a: "pulse" },
      { e: "🏖️", x: 50, y: 66, s: 20 },
    ],
  },
];
