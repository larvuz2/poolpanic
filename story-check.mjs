// The story: what a shift pays into the Ocean Fund (and that it cannot be farmed), Marina's texts, sane saved data,
// well-formed scenes, and the cinematic player (next, skip, auto-advance, once-only finish) against a fake dialog.
import assert from "node:assert/strict";
import {
  STORY,
  PAY,
  MILESTONES,
  INTRO,
  ENDING,
  money,
  shiftPay,
  normalizeStory,
  recordPay,
  fundOf,
  fundShare,
} from "./dist/story.mjs";
import { playCinematic, panelHtml } from "./dist/cinematic.mjs";

// 1) Pay: finishing pays a little, each star more, a booking's payout multiplies it, in steps of five.
assert.equal(shiftPay(0), PAY.finish);
assert.equal(shiftPay(3), PAY.finish + 3 * PAY.perStar);
assert.equal(shiftPay(3, 1.45), 145);
assert.ok(shiftPay(3, 1.45) > shiftPay(3), "A riskier booking pays more");
assert.equal(shiftPay(9), shiftPay(3), "Stars are capped");
assert.equal(shiftPay(2) % 5, 0);
assert.equal(money(1500), "$1,500");
// A full season at three stars can pay for the trip, and a lazy one cannot.
assert.ok(20 * shiftPay(3) >= STORY.goal);
assert.ok(20 * shiftPay(0) < STORY.goal);

// 2) Saved data is sanitised.
assert.deepEqual(normalizeStory(), { seen: false, ending: false, pay: {} });
assert.deepEqual(normalizeStory(null), { seen: false, ending: false, pay: {} });
const messy = normalizeStory({
  seen: 1,
  pay: { 3: 40, "drill:x": 20, bad: -5, "../evil": 9, 4: "nope", 5: 1e12, 6: 12.9 },
});
assert.equal(messy.seen, true);
assert.deepEqual(messy.pay, { 3: 40, "drill:x": 20, 5: 10000, 6: 12 });
assert.equal(fundOf(messy), 40 + 20 + 10000 + 12);
assert.deepEqual(normalizeStory("garbage"), { seen: false, ending: false, pay: {} });

// 3) The fund: only pay beyond a shift's best counts, so replays cannot farm it and it never goes down.
{
  const story = normalizeStory();
  let r = recordPay(story, "1", 60);
  assert.deepEqual([r.gained, r.before, r.after], [60, 0, 60]);
  r = recordPay(story, "1", 60);
  assert.equal(r.gained, 0, "The same pay again adds nothing");
  r = recordPay(story, "1", 30);
  assert.equal(r.gained, 0);
  assert.equal(fundOf(story), 60, "A worse run never lowers the fund");
  r = recordPay(story, "1", 100);
  assert.equal(r.gained, 40, "Only the improvement counts");
  r = recordPay(story, "drill:storm", 50);
  assert.equal(fundOf(story), 150, "Drills pay too, under their own key");
}

// 4) Marina's texts come once each, in order, and the goal is reached once.
{
  const story = normalizeStory(),
    seen = [];
  let reached = 0;
  for (let level = 1; level <= 20 && !reached; level++) {
    const r = recordPay(story, String(level), shiftPay(3));
    seen.push(...r.texts.map((t) => t.at));
    if (r.reached) reached++;
  }
  assert.equal(reached, 1);
  assert.deepEqual(
    seen,
    MILESTONES.map((m) => m.at),
    "Every text, once, in order",
  );
  assert.equal(fundShare(story), 1);
  assert.equal(recordPay(story, "20", shiftPay(3)).reached, false, "The goal is reached once");
  // One big jump passes several texts at once.
  const jump = recordPay(normalizeStory(), "9", STORY.goal);
  assert.equal(jump.texts.length, MILESTONES.length);
  assert.ok(jump.reached);
}

// 5) The scenes are well-formed: a caption, a backdrop, sane layers, and the last one waits for the player.
for (const [name, scenes] of [
  ["intro", INTRO],
  ["ending", ENDING],
]) {
  assert.ok(scenes.length >= 3 && scenes.length <= 6, name + " is short");
  scenes.forEach((p, i) => {
    assert.ok(p.text.length > 10 && p.text.length < 160, `${name} ${i}: a short caption`);
    assert.match(p.bg, /^(pool|dream|jar|sea)$/);
    assert.ok(p.layers.length >= 1);
    for (const l of p.layers) {
      assert.ok(l.e || l.b, "A layer is an emoji or a bubble");
      assert.ok(l.x >= 0 && l.x <= 100 && l.y >= 0 && l.y <= 100, "Placed on the stage");
      if (l.e) assert.ok(l.s >= 4 && l.s <= 60);
    }
    assert.equal(
      i === scenes.length - 1 ? p.hold : p.hold > 0,
      i === scenes.length - 1 ? 0 : true,
      "Only the last scene waits",
    );
  });
}
assert.ok(
  INTRO.some((p) => p.text.includes(STORY.love)) &&
    INTRO.some((p) => p.text.includes(String(STORY.goal).slice(0, 1))),
);
assert.ok(
  INTRO.some((p) => p.layers.some((l) => l.b?.includes("{fund}"))),
  "The intro shows the live fund",
);
assert.ok(
  !panelHtml({ bg: "pool", layers: [{ b: "<img onerror=1>", x: 1, y: 1 }] }).includes("<img"),
  "Bubbles are escaped",
);

// 6) The player, against a fake dialog and fake timers.
{
  const timers = [];
  const realSet = globalThis.setTimeout,
    realClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms) => timers.push({ fn, ms, live: true }) && timers.length;
  globalThis.clearTimeout = (id) => timers[id - 1] && (timers[id - 1].live = false);
  const fire = () => {
    const t = timers.filter((x) => x.live).pop();
    t.live = false;
    t.fn();
  };
  const node = () => ({
    innerHTML: "",
    textContent: "",
    hidden: false,
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    offsetWidth: 0,
    focus() {},
  });
  const parts = {
    ".cine-stage": node(),
    ".cine-text": node(),
    ".cine-dots": node(),
    ".cine-next": node(),
    ".cine-skip": node(),
  };
  const listeners = {};
  const dialog = {
    open: false,
    querySelector: (q) => parts[q],
    addEventListener: (t, f) => (listeners[t] = f),
    removeEventListener: (t) => delete listeners[t],
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  const run = (panels) => {
    const log = [];
    const player = playCinematic(dialog, panels, { done: (s) => log.push(s ? "skipped" : "finished") });
    return { player, log };
  };
  const two = [
    { bg: "pool", text: "one", hold: 1000, layers: [] },
    { bg: "pool", text: "two", hold: 0, layers: [] },
  ];
  // Auto-advance, then wait on the last scene, then a click finishes.
  let { player, log } = run(two);
  assert.ok(dialog.open);
  assert.equal(parts[".cine-text"].textContent, "one");
  assert.equal(parts[".cine-skip"].hidden, false);
  fire();
  assert.equal(parts[".cine-text"].textContent, "two");
  assert.equal(parts[".cine-skip"].hidden, true, "No skip on the last scene");
  assert.equal(timers.filter((t) => t.live).length, 0, "The last scene waits for the player");
  listeners.click({ target: { closest: () => null } });
  assert.deepEqual(log, ["finished"]);
  assert.ok(!dialog.open);
  // Skip leaves at once, once only.
  ({ player, log } = run(two));
  listeners.click({ target: { closest: (q) => (q === ".cine-skip" ? {} : null) } });
  player.skip();
  player.next();
  assert.deepEqual(log, ["skipped"]);
  assert.equal(timers.filter((t) => t.live).length, 0, "No timer outlives the cinematic");
  // Keys: Enter moves on, Escape skips.
  ({ player, log } = run(two));
  const key = (k) => {
    let stopped = false;
    listeners.keydown({
      key: k,
      preventDefault() {},
      stopPropagation() {
        stopped = true;
      },
    });
    return stopped;
  };
  assert.ok(key("Enter"));
  assert.equal(parts[".cine-text"].textContent, "two");
  assert.ok(!key("a"), "Other keys are left alone");
  assert.ok(key("Escape"));
  assert.deepEqual(log, ["skipped"]);
  globalThis.setTimeout = realSet;
  globalThis.clearTimeout = realClear;
}

console.log(
  "Story checks passed: pay and payouts, sanitised saves, a fund that cannot be farmed, Marina's texts once each, well-formed and escaped scenes, and the cinematic's next, skip, keys and auto-advance.",
);
