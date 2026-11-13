// The HUD of 13 November 2026 (README "Stickers, and no lane bar"): the creator asked for the incidents as stickers ("the only
// thing I need to know on the HUD is that Karen is there… like a sticker, so maybe I can see there are two or three remaining
// incidents… if I hover… 'Find Karen and calm her down'. Do not add the 'Press E to interact' text"), and for the row of lane
// buttons to go ("whenever we click on a swimmer that is waiting… a very, very subtle glow on the lanes on top of the pool").
//  1) every sticker has its picture, and the tool that makes them makes exactly those;
//  2) every sting wears a sticker and has its one line;
//  3) incidentCards: one card an incident pending, several at once, the most pressing first, each a name and one short line
//     that never names a key; every venue's own incidents have theirs (bot-played shifts in all 14 venues);
//  4) the page: the stickers' row and card in the column, no banner, no status box, no steps;
//  5) no lane buttons: only the chips that are no place in the pool; a place to click and a glow for it in every venue.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { STINGS, MomentDirector } from "./dist/moments.mjs";
import {
  STICKERS,
  stickerUrl,
  stingSticker,
  stingLine,
  incidentCards,
  plain,
  cannonballSticker,
} from "./dist/incident-cards.mjs";
import { STICKERS as MADE } from "./tools/hud/stickers.mjs";
import { CoachBot } from "./check-bot.mjs";
import { POOL_IDS } from "./dist/week.mjs";

const read = (f) => readFileSync(f, "utf8");
const app = read("dist/app.mjs"),
  html = read("dist/index.html"),
  css = read("dist/style.css"),
  scene = read("dist/scene.mjs");

// A line of a card: short, plain words, and never a key ("press E", "· E", "(1)", "hold E", a lone capital key).
const KEYS = /\bpress\b|\bhold E\b|\bE to\b|· ?E\b|\([A-Z0-9]\)|\bkey\b|\bclick\b/i;
function sound(c, where) {
  assert.ok(STICKERS.includes(c.sticker), where + ": the sticker " + c.sticker + " exists");
  assert.ok(c.title && c.title === c.title.toUpperCase(), where + ": a title in capitals (" + c.title + ")");
  assert.ok(c.title.length <= 26, where + ": a title of a word or three (" + c.title + ")");
  assert.ok(c.line && c.line.length <= 44, where + ": one short line (" + c.line + ")");
  assert.ok(!KEYS.test(c.line) && !KEYS.test(c.title), where + ": no key in “" + c.line + "”");
  assert.ok(c.timer === null || (c.timer >= 0 && c.timer <= 1), where + ": a fuse from 1 to 0");
  assert.equal(typeof c.urgent, "boolean");
}

// 1) The pictures.
{
  assert.deepEqual(
    [...STICKERS].sort(),
    Object.keys(MADE).sort(),
    "the tool makes exactly the stickers the game wears",
  );
  let bytes = 0;
  for (const key of STICKERS) {
    const file = "dist/assets/hud/stickers/" + key + ".webp";
    assert.equal(stickerUrl(key), "./assets/hud/stickers/" + key + ".webp");
    assert.ok(existsSync(file), key + " has its picture");
    const data = readFileSync(file);
    assert.equal(
      data.subarray(0, 4).toString("latin1") + data.subarray(8, 12).toString("latin1"),
      "RIFFWEBP",
      key,
    );
    assert.ok(
      data.length > 4000 && data.length < 40000,
      key + " is a small picture (" + data.length + " bytes)",
    );
    bytes += data.length;
  }
  assert.ok(bytes < 700000, "all of them under 0.7 MB (" + Math.round(bytes / 1024) + " kB)");
  // (each drawn from the game's own character where there is one: its reference picture is in the repository)
  for (const [key, [ref, what]] of Object.entries(MADE)) {
    if (ref) assert.ok(existsSync("tools/hud/ref/" + ref + ".jpg"), key + "'s reference, " + ref);
    assert.ok(what.length > 60, key + " is described");
  }
  assert.ok(
    !existsSync("tools/hud/raw") || /tools\/hud\/raw\//.test(read(".gitignore")),
    "the raw pictures are not committed",
  );
}

// 2) The stings: a sticker and a line for each.
{
  for (const kind of Object.keys(STINGS)) {
    const sticker = stingSticker(kind, { name: "Carl" });
    assert.ok(STICKERS.includes(sticker), "the " + kind + " sting wears a sticker");
    if (kind.startsWith("big-")) continue;
    const line = stingLine(kind, { name: "Pip", lane: 1 });
    assert.ok(
      line && line.length <= 44 && !KEYS.test(line),
      kind + ": one short line, no key (" + line + ")",
    );
    assert.ok(!/[{}]/.test(line), kind + ": its name and lane filled in");
  }
  assert.equal(stingSticker("carl", { name: "Leopard Man" }), "leopard", "the leopard man has his own face");
  assert.equal(stingSticker("carl", { name: "Carl" }), "carl");
  const d = new MomentDirector();
  const first = d.incident({ kind: "karen", x: 0, z: 0 }, 0);
  assert.equal(first.sticker, "karen");
  assert.equal(first.line, "Find Karen and calm her down", "the creator's own words");
  assert.equal(stingLine("fish", { name: "Timmy" }), "Stop Timmy before the edge");
  assert.equal(stingLine("tower", { lane: 2 }), "Move everyone out of lane 3");
  // (what the old banner wrote, without its keys)
  assert.equal(plain("😡 Run to Karen · then hold E"), "Run to Karen");
  assert.equal(plain("Lane clear · whistle at the blocks (E)!"), "Lane clear · whistle at the blocks!");
  assert.equal(plain("Stop the waves (1) · or brace!"), "Stop the waves · or brace!");
  // the sting on screen: its sticker, its name, the line only the first time, nothing about keys
  const sting = app.slice(app.indexOf("function showSting("), app.indexOf("function hideMoments("));
  assert.match(
    sting,
    /if \(sting\.sticker\) icon\.replaceChildren\(stickerImage\(sting\.sticker, sting\.icon\)\);/,
  );
  assert.match(sting, /textContent = sting\.first \? sting\.line \|\| "" : "";/);
  assert.ok(!/sting\.verb|sting\.how/.test(sting), "the sting no longer writes what to press");
}

// 3) The cards.
{
  const fresh = (venue = "club", level = 12) => {
    const s = new PoolSimulation(level, 5, { config: { ...SHIFTS[level - 1], venue, maxChaos: 4 } });
    s.start({ countdown: false });
    // (a quarter of a minute of the shift, the guests sent to the emptiest lane as they come)
    for (let i = 0; i < 900; i++) {
      s.tick(1 / 60);
      if (i % 30) continue;
      const q = s.people.find((p) => p.status === "queue");
      if (!q) continue;
      s.select(q.id);
      s.assign([...s.lanes.keys()].sort((x, y) => s.occupancy(x) - s.occupancy(y))[0]);
      s.select(null);
    }
    return s;
  };
  const s = fresh();
  assert.deepEqual(incidentCards(s), [], "a calm pool has no sticker");
  assert.ok(s.triggerChaos("karen"));
  for (let i = 0; i < 600 && !incidentCards(s).length; i++) s.tick(1 / 60);
  let cards = incidentCards(s);
  assert.deepEqual(
    cards.map((c) => [c.id, c.sticker, c.title, c.line]),
    [["karen", "karen", "KAREN", "Find Karen and calm her down"]],
  );
  sound(cards[0], "karen");
  // several at once, the rescue first
  assert.ok(s.triggerChaos("carl") || s.triggerChaos("dog"));
  const swimmer = s.people.find((p) => p.status === "swim" && !p.cramp);
  assert.ok(swimmer && s.startCramp(swimmer));
  for (let i = 0; i < 240; i++) s.tick(1 / 60);
  cards = incidentCards(s);
  assert.ok(cards.length >= 3, "three incidents, three stickers (" + cards.map((c) => c.id) + ")");
  assert.equal(cards[0].id, "rescue");
  assert.equal(cards[0].line, "Bring them a life ring");
  assert.ok(cards[0].urgent, "a rescue presses");
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length, "one sticker an incident");
  const carl = cards.find((c) => c.id === "carl");
  if (carl) {
    assert.equal(carl.sticker, cannonballSticker(s));
    assert.ok(carl.timer !== null, "his run to the edge is a fuse");
  }
  cards.forEach((c) => sound(c, c.id));
  // the old banner showed one of them (kept for the checks and the bots that read it)
  assert.ok(s.incidentPanel(), "the simulation's own banner is still told");

  // a clean-up: its line follows the job
  const dirty = fresh();
  dirty.cleanup = { kind: "poo", stage: "floating", x: 0, z: 0 };
  assert.deepEqual(
    incidentCards(dirty).map((c) => [c.sticker, c.line]),
    [["poo", "Get the skimmer"]],
  );
  dirty.cleanup.stage = "treat";
  assert.equal(incidentCards(dirty)[0].line, "Chlorine the water");
  dirty.cleanup = { kind: "pee", stage: "treat" };
  assert.deepEqual(
    incidentCards(dirty).map((c) => [c.sticker, c.title]),
    [["pee", "WHO PEED?!"]],
  );
  // a guest about to be sick: one sticker for them all, the nearest fuse
  const queasy = fresh();
  const [a, b] = queasy.people.filter((p) => p.status !== "gone");
  Object.assign(a, { stomachWarning: true, sicknessTimer: 3, sicknessDuration: 12 });
  let tummy = incidentCards(queasy).find((c) => c.id === "tummy");
  assert.equal(tummy.line, "Send " + a.name + " to the locker room");
  assert.equal(tummy.timer, 0.25);
  assert.ok(tummy.urgent, "a fuse nearly burnt presses");
  Object.assign(b, { stomachWarning: true, sicknessTimer: 9, sicknessDuration: 12 });
  tummy = incidentCards(queasy).find((c) => c.id === "tummy");
  assert.equal(tummy.line, "2 guests need the locker room");
  sound(tummy, "tummy");

  // Every venue's own incidents have their cards: bot-played shifts in all 14 venues, every card that comes up looked at.
  const met = new Map();
  for (const venue of POOL_IDS)
    for (const [level, seed] of [
      [9, 3],
      [14, 8],
    ]) {
      const bot = new CoachBot(level, seed, { config: { ...SHIFTS[level - 1], venue } });
      const tick = bot.s.tick.bind(bot.s);
      let n = 0;
      bot.s.tick = (dt) => {
        tick(dt);
        if (++n % 20) return;
        const list = incidentCards(bot.s);
        assert.ok(list.length <= 6, venue + ": a handful at most");
        for (const c of list) {
          sound(c, venue + " " + c.id);
          met.set(c.id + "/" + c.sticker, (met.get(c.id + "/" + c.sticker) || 0) + 1);
        }
      };
      bot.run();
    }
  const stickersMet = new Set([...met.keys()].map((k) => k.split("/")[1]));
  for (const sticker of ["rescue", "tummy"])
    assert.ok(
      stickersMet.has(sticker),
      "these shifts bring the " + sticker + " sticker (met: " + [...stickersMet] + ")",
    );
  const classic = ["karen", "carl", "leopard", "fish", "dog", "outage"].filter((k) => stickersMet.has(k));
  assert.ok(classic.length >= 3, "…and most of the classic incidents' (" + classic + ")");
  assert.ok(stickersMet.size >= 10, "ten kinds of sticker in 28 shifts (" + [...stickersMet].sort() + ")");

  // The ones a good coach's shifts may not bring, from their banners as the simulation writes them.
  const told = (key, panel, more = {}) =>
    incidentCards({
      status: "playing",
      people: [],
      coach: {},
      systems: [{ key, panel: () => panel }],
      ...more,
    })[0];
  const big = told("big", {
    title: "⭐ THE BIG RACE",
    task: "Lane clear · whistle at the blocks (E)!",
    timer: 0.5,
    big: true,
  });
  assert.deepEqual(
    [big.sticker, big.title, big.line, big.timer],
    ["big", "THE BIG RACE", "Lane clear · whistle at the blocks!", 0.5],
  );
  for (const [key, panel, sticker, title, line] of [
    ["boards", { title: "LINE CUTTER!", timer: 0.8 }, "linecut", "LINE CUTTER", "Send them to the back"],
    ["monkeys", { title: "MONKEY IN SPRING 2!" }, "monkey", "MONKEY IN SPRING 2", "Shoo it out"],
    ["roof", { title: "THE DROP IN 5!" }, "drop", "THE DROP IN 5", "Get everyone off the edge"],
    ["ship", { title: "BIG SWELL IN 3!" }, "swell", "BIG SWELL IN 3", "Hold on"],
    ["waves", { title: "MONSTER WAVE IN 4!" }, "monster", "MONSTER WAVE IN 4", "Stop the waves, or brace"],
  ]) {
    const c = told(key, panel);
    assert.deepEqual([c.sticker, c.title, c.line], [sticker, title, line], key);
    sound(c, key);
  }
  sound(big, "big");
  const influencer = told(
    "influencer",
    { title: "x" },
    { influencer: { id: 7 }, visitor: () => ({ name: "Bea" }) },
  );
  assert.deepEqual([influencer.sticker, influencer.line], ["influencer", "Move Bea along"]);
  const massage = told(
    "massage",
    { icon: "😤", title: "x" },
    { massages: [{ id: 3, stage: "lying", patience: 2 }], get: () => ({ name: "Otto" }) },
  );
  assert.deepEqual(
    [massage.sticker, massage.line, massage.urgent],
    ["massage", "Otto is losing patience", true],
  );

  // …and each of the systems that has a banner has its words (so a new incident cannot come without a card)
  const cardsSrc = read("dist/incident-cards.mjs");
  for (const system of new PoolSimulation(9, 1).systems)
    if (typeof system.panel === "function")
      assert.match(
        cardsSrc,
        new RegExp("\\n  " + system.key + "[:(]"),
        "the " + system.key + " incident has its words",
      );
}

// 4) The page.
{
  const rail = html.slice(html.indexOf('<div id="hud-rail"'), html.indexOf('<div id="map"'));
  assert.match(rail, /<div id="stickers" class="stickers" role="group" aria-label="Incidents"><\/div>/);
  assert.match(
    rail,
    /<div id="sticker-card" class="sticker-card" role="status" hidden>\s*<strong><\/strong\s*><small><\/small\s*>\s*<\/div>/,
  );
  for (const gone of [
    'id="closure"',
    "cleanup-steps",
    "closure-timer",
    'id="pool-status',
    'id="hint"',
    "sting-how",
  ])
    assert.ok(!html.includes(gone), "no " + gone + " in the page");
  assert.match(app, /renderStickers\(mode === "menu" \? NO_CARDS : incidentCards\(sim\)\);/);
  for (const gone of ["renderIncidentPanel", "sanitationPanel", '$("pool-status")', "sim.incidentHint()"])
    assert.ok(!app.includes(gone), "the game no longer has " + gone);
  const render = app.slice(
    app.indexOf("function renderStickers(cards) {"),
    app.indexOf("function bindStickers() {"),
  );
  assert.match(render, /className: "sticker-bang", textContent: "!"/, "an exclamation mark at its corner");
  assert.match(render, /s\.el\.classList\.toggle\("urgent", !!c\.urgent\);/);
  assert.match(
    render,
    /put\(box\.firstElementChild, s\.card\.title\);\s*put\(box\.lastElementChild, s\.card\.line\);/,
  );
  assert.match(render, /s\.el\.classList\.add\("leaving"\);/, "a sticker dealt with peels off");
  const bind = app.slice(app.indexOf("function bindStickers() {"), app.indexOf("function updateContext() {"));
  for (const how of ['"pointerover"', '"focusin"', '"click"'])
    assert.ok(bind.includes(how), "its card by " + how);
  assert.match(css, /\.hud-rail > \.stickers \{[^}]*pointer-events: auto;/);
  assert.match(css, /\.sticker\.urgent \.sticker-bang \{[^}]*animation: stickerBang/);
  assert.match(css, /\.sticker\.timed \.sticker-fuse \{\s*display: block;/);
  assert.match(
    css,
    /body\.calm \.sticker,\s*body\.calm \.sticker\.urgent \.sticker-bang \{\s*animation: none;/,
  );
  // the selected guest's chip says who and how they are, not what to press
  const queue = app.slice(app.indexOf("function updateQueue() {"), app.indexOf("function updateShipGauge("));
  assert.ok(
    !/· [1T]"|INTO THE POOL|Pick a lane/.test(queue),
    "no key and no instruction in the selected guest's chip",
  );
}

// 5) No row of lane buttons; the place itself is clicked, and glows.
{
  const lanes = app.slice(
    app.indexOf("function renderLaneControls(venue) {"),
    app.indexOf("\n}\n", app.indexOf("function renderLaneControls(venue) {")),
  );
  assert.ok(
    !/data-lane="\$\{i\}"|data-lane="pool"|data-lane="trampoline"|ship-gauge|lane-top|lane-no/.test(lanes),
  );
  assert.deepEqual(
    [...lanes.matchAll(/data-lane="(\w+)"/g)].map((m) => m[1]),
    ["bar", "river", "river", "seat", "waves"],
    "what is left: the bar, the river's two ways, the rooftop's seats, the wave machine",
  );
  assert.match(lanes, /chip\("river-btn when-ready"/);
  assert.match(lanes, /chip\("seat-btn when-ready"/);
  assert.match(
    css,
    /\.lane-controls \.lane-btn\.chip\[hidden\],\s*\.lane-controls \.lane-btn\.chip\.when-ready:not\(\.assignable\) \{\s*display: none;/,
  );
  // the numbers still send a guest
  assert.match(app, /sim\.assign\(Number\(key\) - 1\);/);
  // the glow: drawn after the water, soft, the place under the mouse brighter
  assert.match(scene, /map: laneGlowTexture\(\),/);
  assert.match(scene, /m\.renderOrder = 6;/);
  assert.match(scene, /this\.hoverLane = over\?\.kind === "lane" \? over\.lane : -1;/);
  assert.match(scene, /canvas\.addEventListener\("pointerleave", \(\) => \(this\.hoverLane = -1\)\);/);
  assert.match(read("dist/tutorial.mjs"), /Now click a lane in the pool: they glow\./);

  // In every venue: somewhere in the world to click that sends a guest, and a glow for it.
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const { createCanvas } = runtime
    ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
    : await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  console.warn = () => {};
  const { PoolWorld } = await import("./dist/scene.mjs");
  const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
  for (const venue of POOL_IDS) {
    const sim = new PoolSimulation(9, 2, { config: { ...SHIFTS[8], venue } });
    sim.start({ countdown: false });
    world.sync(sim, 0, 1 / 60);
    const targets = world.clickables.filter((c) => c.userData?.kind === "lane");
    assert.ok(targets.length >= 1, venue + " has a place to click");
    assert.ok(world.laneHighlights.length >= 1, venue + " has its glow");
    assert.ok(
      world.laneRims.length >= world.laneHighlights.length || venue === "wave",
      venue + ": a rim for each",
    );
    for (const t of targets) assert.ok(Number.isInteger(t.userData.lane), venue + ": a target says where");
    // nothing glows with nobody selected; with a waiting guest selected, the places glow (softly)
    for (let i = 0; i < 1500 && !sim.people.some((p) => p.status === "queue"); i++) sim.tick(1 / 60);
    const waiting = sim.people.find((p) => p.status === "queue");
    if (!waiting || sim.venue.waves) continue;
    sim.select(null);
    world.sync(sim, 1, 1 / 60);
    const calm = world.laneHighlights.map((m) => m.material.opacity);
    sim.select(waiting.id);
    if (sim.selected !== waiting.id) continue; // (a guest the coach must catch or serve first)
    world.hoverLane = -1;
    world.sync(sim, 1, 1 / 60);
    const lit = world.laneHighlights.map((m) => m.material.opacity);
    assert.ok(
      lit.some((o, i) => o > calm[i] + 0.05),
      venue + ": the places glow while a waiting guest is selected",
    );
    assert.ok(Math.max(...lit) <= 0.45, venue + ": softly (" + Math.max(...lit).toFixed(2) + ")");
    world.hoverLane =
      world.laneHighlights.length === 1 ? 0 : world.laneHighlights.findIndex((m, i) => lit[i] > calm[i]);
    world.sync(sim, 1, 1 / 60);
    const hot = world.laneHighlights[world.hoverLane].material.opacity;
    assert.ok(hot > lit[world.hoverLane] && hot >= 0.4, venue + ": the place under the mouse answers");
  }
}

console.log(
  "Sticker HUD checks passed: " +
    STICKERS.length +
    " stickers with their pictures, each made by the tool from the game's own characters; a sticker and one line for every sting; one card an incident pending (three at once, the rescue first), a name and one short line that never names a key, in bot-played shifts in all 14 venues; the page with the stickers' row and card and no banner, status box or steps; no lane buttons, the chips that are left, and in every venue a place to click that glows softly while a waiting guest is selected and answers the mouse.",
);
