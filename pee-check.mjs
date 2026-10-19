// The wee (16 October 2026, the creator: "the same as the poo, same mechanic, just a different thing happening"): a sick guest has a poo
// or a wee coming, decided from numbers already drawn (a third of them a wee, half at the Kids Pool). A wee shows a 🚽 tag; sending
// them to the locker room in time prevents it; missed, a yellow cloud spreads in the pool, the water turns yellow, everybody is out
// and it costs as much as a poo, but there is nothing to scoop: the chlorine clears it, and the pool opens again once the water settles.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS, LANES } from "./dist/sim.mjs";
import { STINGS } from "./dist/moments.mjs";
import { HOLD_LIMIT } from "./dist/chaos.mjs";
import { isDeckPosition } from "./dist/spatial.mjs";

const tick = (s, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) s.tick(1 / 60);
};
const game = (level = 4, extra = {}) => {
  const s = new PoolSimulation(level, 31, { config: { ...SHIFTS[level - 1], ...extra } });
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
};
const swimmer = (s, kind, lane = 1) => {
  const p = s.spawn({ type: "beginner", sick: true });
  p.sickKind = kind;
  Object.assign(p, {
    status: "swim",
    lane,
    x: LANES[lane],
    z: 0,
    p: 7.2,
    needsFins: false,
    problem: null,
    stomachDelay: 0.1,
  });
  return p;
};
const at = (s, x, z) => {
  assert.ok(isDeckPosition(x, z));
  Object.assign(s.coach, { x, z, y: 0, vx: 0, vz: 0 });
  s.clearInput();
};

// 1) Which it is: a third of sick guests have a wee coming, half at the Kids Pool (`peeShare`); healthy guests have neither.
{
  const share = (extra) => {
    const s = game(6, extra);
    let pee = 0,
      sick = 0;
    for (let i = 0; i < 3000; i++) {
      const p = s.spawn({ type: "intermediate", sick: true });
      if (p.sickKind) sick++;
      if (p.sickKind === "pee") pee++;
      s.people.length = 0;
    }
    return pee / sick;
  };
  assert.ok(Math.abs(share({}) - 0.35) < 0.04, "a third: " + share({}).toFixed(2));
  assert.ok(Math.abs(share({ peeShare: 0.5 }) - 0.5) < 0.04, "half at the Kids Pool");
  assert.equal(game().spawn({ type: "beginner", sick: false }).sickKind, null);
  assert.ok(STINGS.bladder && STINGS.pee, "a sting for the warning and one for the accident");
}

// 2) The warning: a 🚽 tag (the bladder sting, a toast), and sending them to the locker room in time prevents it.
{
  const s = game(),
    p = swimmer(s, "pee");
  tick(s, 0.2);
  assert.equal(p.stomachWarning, true);
  assert.ok(s.events.some((e) => e.type === "incident" && e.kind === "bladder"));
  assert.ok(s.events.some((e) => e.type === "toast" && /🚽/.test(e.text)));
  const alerts = [];
  s.collectAlerts(alerts);
  assert.ok(alerts.some((a) => a.kind === "stomach" && a.icon === "🚽"));
  s.select(p.id);
  s.home();
  tick(s, 16);
  assert.equal(s.cleanup, null, "prevented");
  assert.equal(s.stats.catastrophes, 0);
}

// 3) Missed: the water goes yellow, everybody out, −500, the clock waits; no skimmer, the chlorine clears it; then the pool opens.
{
  const s = game(),
    p = swimmer(s, "pee"),
    other = swimmer(s, "poo", 2);
  other.sick = false;
  tick(s, 12);
  const q = s.cleanup;
  assert.ok(q && q.kind === "pee", "a wee in the pool");
  assert.equal(q.stage, "treat", "nothing to scoop: straight to the chlorine");
  assert.ok(s.waterYellow > 0.1 && !s.waterBrown, "the water is yellow, not brown");
  assert.equal(s.closed, 1);
  assert.equal(s.stats.catastrophes, 1);
  assert.ok(s.events.some((e) => e.type === "incident" && e.kind === "pee"));
  assert.ok(s.events.some((e) => e.type === "points" && e.value === -500));
  assert.ok(["evacuating", "panic"].includes(other.status), "everybody out");
  const clock = s.time;
  tick(s, 4);
  assert.equal(s.time, clock, "the shift clock waits while you clean");
  assert.ok(s.clockHeld());
  const yellow = s.waterYellow;
  assert.ok(yellow >= 0.3, "untreated, it spreads (" + yellow.toFixed(2) + ")");
  assert.equal(s.fetch("skimmer"), false, "no skimmer for this one");
  let doses = 0;
  while (s.cleanup && doses < 4) {
    at(s, 9.5, 7.8);
    assert.ok(s.fetch("chlorine"));
    at(s, 5.8, 4);
    assert.ok(s.deliverWater(1), "a dose of chlorine");
    doses++;
    tick(s, 5);
  }
  assert.equal(s.cleanup, null, "clean again after " + doses + " doses");
  assert.ok(doses <= 2, "one dose or two");
  assert.equal(s.waterYellow, 0);
  assert.equal(s.closed, 0, "the pool is open");
  assert.ok(s.events.some((e) => e.type === "save" && e.kind === "cleanup"));
}

// 4) A poo is still a poo: the floater, the skimmer, the brown water.
{
  const s = game(),
    p = swimmer(s, "poo");
  tick(s, 12);
  assert.equal(s.cleanup?.stage, "floating");
  assert.ok(!s.cleanup.kind);
  assert.ok(s.waterBrown > 0 && !s.waterYellow);
}

// A hold has a limit (HOLD_LIMIT, 19 October 2026): a mess left alone stops the clock for 30 s, then the clock runs again
// (with a warning) until the shift ends, so no shift can go on for ever.
{
  const s = game(),
    p = swimmer(s, "pee");
  tick(s, 12);
  assert.ok(s.cleanup, "a wee in the pool, left alone");
  const clock = s.time;
  tick(s, HOLD_LIMIT - s.heldFor - 1);
  assert.equal(s.time, clock, "held while the limit lasts");
  tick(s, 3);
  assert.ok(s.time > clock && s.cleanup, "then the clock runs again, the mess still there");
  assert.ok(
    s.events.some((e) => e.type === "toast" && /clock is running again/.test(e.text)),
    "with a warning",
  );
  tick(s, s.config.duration + 30);
  assert.equal(s.status, "ended", "and the shift ends");
}
console.log(
  "Pee checks passed: a third of sick guests have a wee coming (half at the Kids Pool), a 🚽 tag and a sending-home that prevents it, and a missed one turning the water yellow, emptying the pool and costing as much as a poo, cleared with chlorine alone; a poo is still a poo; a mess left alone holds the clock for 30 s at most, then the shift goes on and ends.",
);
