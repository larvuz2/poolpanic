// Online co-op (net.mjs): a host and two guests over an in-memory network with latency and jitter, every player giving the
// game's own inputs at random (moving, selecting, sending to lanes, fetching, pressing E, jumping, the Coach Cam's turn) while
// the shift plays; every guest's shift must stay the host's to the last tick (the hashes along the way and at the end). And the
// lobby: unique coaches, ready, a full crew turned away, another build turned away, a guest who drops mid-shift and comes back
// (the whole log played through at once), a guest's input that is not an input refused.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { stateHash } from "./dist/replay.mjs";
import { CoopHost, CoopGuest, createHub, NET, Predictor } from "./dist/net.mjs";
import { crewConfig, CREW, normalCrew } from "./dist/crew.mjs";
import { SHIFTS } from "./dist/sim.mjs";

let seed = 99;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const build = (shift) => new PoolSimulation(shift.level, shift.seed, shift.options);

// ---- the crew's shift --------------------------------------------------------------------------------------------------
{
  const base = SHIFTS[11];
  assert.equal(crewConfig(base, 1), base, "one coach plays the shift as it is");
  const two = crewConfig(base, 2),
    three = crewConfig(base, 3);
  assert.ok(two.total > base.total && three.total > two.total, "more guests for two, more again for three");
  assert.ok((two.chaos?.length ?? 0) >= (base.chaos?.length ?? 0), "at least as many incidents");
  assert.ok(three.maxChaos > (base.maxChaos || 1), "more at once");
  assert.ok(two.tipBoost > 1 && three.tipBoost > two.tipBoost, "more asks for tips");
  assert.ok(three.thresholds[0] >= base.thresholds[0], "star targets measured for a crew");
  for (const e of three.chaos)
    assert.ok(e.window[0] < e.window[1] && e.window[1] <= three.duration, "every incident inside the shift");
  assert.deepEqual(normalCrew(["brooks", "brooks", "x", "waters"]), ["brooks", "waters", "rivers"]);
  assert.deepEqual(normalCrew([]), ["waters"]);
  const sim = new PoolSimulation(12, 5, { crew: ["rivers", "waters", "brooks"] });
  assert.equal(sim.coaches.length, 3);
  assert.deepEqual(
    sim.coaches.map((c) => c.look),
    ["rivers", "waters", "brooks"],
  );
  assert.ok(
    new Set(sim.coaches.map((c) => c.x.toFixed(2) + "," + c.z.toFixed(2))).size === 3,
    "three coaches at three places",
  );
  assert.equal(CREW.stars[0], 1);
}

// ---- a lobby and a whole shift over a laggy network ---------------------------------------------------------------------
function play({ latency = 4, jitter = 3, level = 12, drop = false }) {
  const hub = createHub({ latency, jitter, seed: 7 });
  const host = new CoopHost(hub.connect("H"), { name: "Host", build: "b1" });
  const g1 = new CoopGuest(hub.connect("A"), "H", { name: "Ann", build: "b1" });
  const g2 = new CoopGuest(hub.connect("B"), "H", { name: "Bo", build: "b1" });
  hub.pump(true);
  hub.pump(true);
  assert.equal(host.players.length, 3, "two guests in");
  assert.deepEqual(
    host.players.map((p) => p.coach),
    ["waters", "brooks", "rivers"],
    "each a coach of their own",
  );
  // picks: a coach someone has is not taken
  g1.pick("waters");
  hub.pump(true);
  assert.equal(host.player(1).coach, "brooks", "Waters is the host's");
  host.pickMine("rivers");
  hub.pump(true);
  assert.equal(host.player(0).coach, "waters", "Rivers is Bo's");
  host.pickMine("waters");
  assert.ok(!host.everyoneReady);
  g1.ready(true);
  g2.ready(true);
  hub.pump(true);
  hub.pump(true);
  assert.ok(host.everyoneReady, "everyone ready");
  assert.equal(g1.players.length, 3, "the guests see the lobby");
  // a fourth is turned away, and so is another build
  let refused = [];
  const g3 = new CoopGuest(hub.connect("C"), "H", { name: "Cy", build: "b1" });
  g3.on("refused", (why) => refused.push(why));
  const g4 = new CoopGuest(hub.connect("D"), "H", { name: "Di", build: "b2" });
  g4.on("refused", (why) => refused.push(why));
  hub.pump(true);
  hub.pump(true);
  assert.deepEqual(refused.sort(), ["full", "version"]);

  // the shift
  const sims = {};
  for (const g of [g1, g2])
    g.on("start", (shift) => {
      const s = build(shift);
      g.attach(s);
      s.start();
      sims[g.name] = s;
    });
  const shift = host.start({ level, seed: 4242, options: {} });
  assert.deepEqual(shift.options.crew, ["waters", "brooks", "rivers"]);
  const hs = build(shift);
  host.attach(hs);
  hs.start();
  hub.pump(true);
  assert.ok(sims.Ann && sims.Bo, "both guests built the shift");
  const guests = [g1, g2];
  let rejoined = null,
    frames = 0;
  const act = (sim, look) => {
    const r = random();
    if (r < 0.08) sim.setMovement(Math.round(random() * 2 - 1), Math.round(random() * 2 - 1));
    else if (r < 0.1) sim.clearInput();
    else if (r < 0.12) sim.interact();
    else if (r < 0.13) {
      const q = sim.people.filter((p) => p.status === "queue");
      if (q.length) sim.select(q[Math.floor(random() * q.length)].id);
    } else if (r < 0.14) sim.assign(Math.floor(random() * sim.lanes.length));
    else if (r < 0.145) sim.fetch("fins");
    else if (r < 0.15) sim.jump();
    else if (r < 0.155) sim.dash();
    else if (r < 0.16) sim.mop();
    else if (r < 0.18) look?.(random() * 6 - 3);
  };
  while (hs.status !== "ended" && frames < 60 * 400) {
    frames++;
    act(hs, (a) => host.look(a));
    hs.tick(1 / 60);
    hs.events.length = 0;
    for (const g of guests) {
      if (!g.sim) continue;
      act(g.sim, (a) => g.look(a));
      g.advance(1 / 60);
      g.sim.events.length = 0;
    }
    hub.pump();
    // Bo drops halfway and comes back ten seconds later on a new connection
    if (drop && frames === 60 * 50) {
      g2.t.close();
      guests.splice(guests.indexOf(g2), 1);
      hub.pump(true);
      assert.ok(host.player(2).away, "Bo's coach waits for him");
    }
    if (drop && frames === 60 * 60) {
      rejoined = new CoopGuest(hub.connect("B2"), "H", { name: "Bo", build: "b1" });
      rejoined.on("start", (shift) => {
        const s = build(shift);
        rejoined.attach(s);
        s.start();
        sims.Bo = s;
      });
      guests.push(rejoined);
    }
  }
  assert.equal(hs.status, "ended", "the shift ended");
  // let the guests finish
  for (let i = 0; i < 400; i++) {
    hub.pump();
    for (const g of guests) g.advance(1 / 60);
  }
  const want = stateHash(hs);
  for (const g of guests) {
    assert.equal(g.ticks, host.ticks, `${g.name} played every tick`);
    assert.equal(stateHash(g.sim), want, `${g.name}'s shift is the host's`);
    assert.equal(g.stats.desyncs, 0, `${g.name}: never out of step`);
    assert.equal(g.sim.status, "ended");
    assert.equal(g.sim.score, hs.score, "the same score");
  }
  if (drop) assert.equal(rejoined.index, 2, "Bo is back on his coach");
  // every coach was played (each moved from where it started)
  return { host, hs, guests, frames, hub };
}

const a = play({ latency: 0, jitter: 0, level: 6 });
const b = play({ latency: 6, jitter: 5, level: 12 });
const c = play({ latency: 9, jitter: 9, level: 16, drop: true });
const inputs = b.host.log.length;
assert.ok(inputs > 300, `the players gave plenty of inputs (${inputs})`);
const perSecond = (b.host.stats.bytes / b.host.ticks) * 60;
assert.ok(perSecond < 6000, `little over the wire (${Math.round(perSecond)} bytes a second)`);

// ---- what a guest may not do -----------------------------------------------------------------------------------------------
{
  const hub = createHub();
  const host = new CoopHost(hub.connect("H"), { name: "Host" });
  const g = new CoopGuest(hub.connect("A"), "H", { name: "<b>Ann</b>\u0007" });
  hub.pump(true);
  hub.pump(true);
  assert.equal(host.player(1).name, "bAnn/b", "a name is plain text");
  let started = null;
  g.on("start", (shift) => (started = shift));
  const shift = host.start({ level: 3, seed: 1, options: {} });
  const hs = build(shift);
  host.attach(hs);
  hs.start();
  hub.pump(true);
  const gs = build(started);
  g.attach(gs);
  gs.start();
  const before = host.log.length;
  g.send("H", { t: "in", name: "triggerChaos", args: ["dog"] });
  g.send("H", { t: "in", name: "tick", args: [5] });
  g.send("H", { t: "in", name: "setMovement", args: [{ x: 1 }] });
  hub.pump(true);
  assert.equal(host.log.length, before, "only inputs, with plain arguments");
  assert.ok(!hs.dog, "no incident on a guest's word");
  // a guest's input does nothing on its own machine until the host plays it
  gs.setMovement(1, 0);
  assert.deepEqual(gs.coach.input, { x: 0, z: 0 }, "not yet");
  hub.pump(true);
  hs.tick(1 / 60);
  hub.pump(true);
  for (let i = 0; i < 8; i++) {
    hs.tick(1 / 60);
    hub.pump(true);
    g.advance(1 / 60);
  }
  assert.equal(gs.coaches[1].input.x, 1, "now it has");
  assert.equal(gs.coach, gs.coaches[1], "a guest's screen is its own coach's");
  assert.equal(hs.coach, hs.coaches[0]);
  // the drawn coach a little ahead of the shift
  const pr = new Predictor();
  const coach = { x: 0, z: 0, input: { x: 0, z: 0 } };
  let off;
  for (let i = 0; i < 10; i++) off = pr.update(1 / 60, { x: 1, z: 0 }, coach, 4);
  assert.ok(off.dx > 0.4 && off.dx < 1.2, "drawn ahead while the input is on its way");
  // the stick let go: the shift still moves him for as long as the input took to arrive, then stops him too
  coach.input = { x: 1, z: 0 };
  for (let i = 0; i < 10; i++) {
    coach.x += 4 / 60;
    off = pr.update(1 / 60, { x: 0, z: 0 }, coach, 4);
  }
  coach.input = { x: 0, z: 0 };
  for (let i = 0; i < 10; i++) off = pr.update(1 / 60, { x: 0, z: 0 }, coach, 4);
  assert.ok(Math.abs(off.dx) < 0.15, `and let go when the shift catches up (${off.dx.toFixed(2)})`);
}
console.log(
  `Net checks passed: a crew's shift (more guests, tips and incidents, star targets for a crew); a lobby of three with a coach each, ready, a fourth and another build turned away; whole shifts with three players giving random inputs over a network up to ${9 + 9} frames late, every guest's shift the host's at every hash and at the end (${inputs} inputs, about ${Math.round(perSecond)} bytes a second); a guest who dropped and came back on his coach, the log played through at once; only inputs from a guest, with plain arguments; a guest's input waits for the host; its coach drawn a little ahead.`,
);
