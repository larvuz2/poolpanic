// The Aqua Disco (16 October 2026): an aqua-aerobics party pool with no lanes, four zones of a class that dances facing
// Valentina on the stage. The floor plan (every station, fixture and queue spot reachable, no starting blocks, a stage at the end),
// the class (nobody but aqua dancers, Marco and the VIPs included; rows spread down each zone, all facing the stage; more than
// four to a zone and they bump elbows), the words (zones, not lanes) and the dance (dance.mjs: one routine, the same for all).
import assert from "node:assert/strict";
import { VENUES } from "./dist/spatial.mjs";
import { PoolSimulation, SHIFTS, MARCO, CLASS_ROOM } from "./dist/sim.mjs";
import { danceAt, ROUTINE, DANCE_CLIP, BEAT, BAR, pulse } from "./dist/dance.mjs";
import { MomentDirector } from "./dist/moments.mjs";
import { tick } from "./check-helpers.mjs";

const disco = VENUES.disco;

// 1) The floor plan.
{
  assert.equal(disco.name, "Aqua Disco");
  assert.ok(disco.indoor && disco.class, "an indoor class venue");
  assert.equal(disco.lanes.length, 4, "four zones");
  assert.equal(disco.trampoline, null);
  assert.ok(!disco.obstacles.some((o) => o.kind === "block"), "no starting blocks: nobody races here");
  assert.ok(
    disco.obstacles.some((o) => o.kind === "stage"),
    "the instructor's stage",
  );
  assert.ok(disco.stage.z > disco.pool.halfZ, "the stage is past the pool's end, where the class faces");
  for (const [name, at] of [...Object.entries(disco.stations), ...Object.entries(disco.fixtures)])
    assert.ok(
      disco.isDeck(at.x + (at.x > 0 ? -0.9 : 0.9), at.z, 3, 0.3) || disco.isDeck(at.x, at.z + 1.2, 3, 0.3),
      name + " can be reached",
    );
  for (let slot = 0; slot < 12; slot++)
    for (const side of [-1, 1]) {
      const q = disco.queuePosition(side, slot);
      assert.ok(disco.isDeck(q.x, q.z, 3, 0.2), "queue spot " + side + "/" + slot + " is on the deck");
    }
  assert.ok(disco.edgeSpots().length >= 8, "room at the edge for rescues and the dog");
}

// A disco shift with nobody scheduled: the check brings its own guests.
function shift(extra = {}) {
  const s = new PoolSimulation(6, 11, {
    config: { ...SHIFTS[5], venue: "disco", lighting: "disco", ...extra },
  });
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  for (const p of s.people) p.crampAt = Infinity;
  return s;
}
const toQueue = (s, n) => {
  const people = Array.from({ length: n }, () => s.spawn({ type: "advanced" }));
  for (let i = 0; i < 2400 && people.some((p) => p.status !== "queue"); i++) tick(s);
  people.forEach((p) => (p.crampAt = Infinity));
  assert.ok(
    people.every((p) => p.status === "queue"),
    "the guests reach the line",
  );
  return people;
};
const assign = (s, p, lane) => {
  s.select(p.id);
  assert.ok(s.assign(lane), "assigned to zone " + (lane + 1));
};

// 1b) The way in and out (the creator, 16 October 2026): no locker rooms, one double door flush in the back wall, a leaf for
// each side of the line. Guests come out of the dark behind it into the line and go back into it; a dog led out goes too.
{
  assert.ok(!disco.obstacles.some((o) => /locker/.test(o.kind)), "no locker walls or benches");
  const door = disco.arrival;
  assert.ok(door.insideZ < disco.room.minZ + 0.3, "inside is behind the back wall");
  assert.ok(disco.isDeck(door.outsideX, door.doorZ, 3, 0.3), "the doorway opens onto the deck");
  assert.equal(disco.doorWord, "the door");
  assert.equal(VENUES.club.doorWord, "a locker door", "the other pools keep their locker rooms");
  const s = shift();
  const [p] = toQueue(s, 1);
  assert.ok(p.status === "queue");
  const q = s.spawn({ entrance: true });
  assert.ok(
    Math.abs(q.z - door.insideZ) < 1e-9 && Math.abs(Math.abs(q.x) - door.insideX) < 1e-9,
    "comes in from behind it",
  );
  for (let i = 0; i < 600 && q.status !== "queue"; i++) tick(s);
  assert.equal(q.status, "queue", "walks through the door into the line");
  s.lose(q);
  for (let i = 0; i < 900 && q.status !== "gone"; i++) tick(s);
  assert.equal(q.status, "gone", "and back out through it");
  const dog = s.spawnVisitor("dog", { name: "Rex" });
  assert.ok(Math.abs(dog.z - door.insideZ) < 1e-9);
  for (let i = 0; i < 120; i++) s.walkVisitor(dog, 1 / 60, 3);
  assert.ok(disco.pastDoor(dog), "the dog is out on the deck");
  s.sendVisitorHome(dog, "leaving");
  for (let i = 0; i < 900 && s.visitors.includes(dog); i++) s.walkVisitor(dog, 1 / 60, 3);
  assert.ok(!s.visitors.includes(dog), "and goes back out through the door");
}

// 2) The class: aqua dancers only, whatever the level wrote (and Marco, a VIP, dances too).
{
  const s = new PoolSimulation(9, 5, {
    config: { ...SHIFTS[8], venue: "disco", lighting: "disco", star: { ...MARCO, at: 0.1 } },
  });
  s.start();
  for (let i = 0; i < 60 * 60 && s.status === "playing"; i++) tick(s);
  const guests = s.people.filter((p) => p.type);
  assert.ok(guests.length >= 5);
  assert.ok(
    guests.every((p) => p.type === "aqua"),
    "only aqua dancers: " + guests.map((p) => p.type),
  );
  const marco = guests.find((p) => p.star === "marco");
  assert.ok(marco, "Marco comes to the class");
  assert.equal(marco.type, "aqua", "…and dances");
  assert.ok(marco.vip);
}
{
  const s = shift({ star: { ...MARCO, at: 0 } });
  s.schedule = [{ at: 0, star: "marco" }];
  const said = [];
  const emit = s.emit.bind(s);
  s.emit = (type, e) => {
    if (type === "toast") said.push(e.text);
    return emit(type, e);
  };
  s.spawn({ ...MARCO, star: "marco", vip: true, name: MARCO.name });
  assert.ok(
    said.some((t) => /joins the class/.test(t)),
    "Marco's arrival is told as a dancer's: " + said,
  );
}

// 3) Rows down the zone, everyone facing the stage; four to a zone is comfortable.
{
  const s = shift();
  const four = toQueue(s, CLASS_ROOM);
  four.forEach((p) => assign(s, p, 1));
  for (let i = 0; i < 60 * 8; i++) tick(s);
  const inZone = s.people.filter((p) => p.lane === 1 && p.status === "swim");
  assert.equal(inZone.length, CLASS_ROOM);
  for (const p of inZone) {
    assert.equal(p.type, "aqua");
    assert.equal(p.angle, 0, "facing the stage");
    assert.ok(Math.abs(p.x - disco.lanes[1]) < 1.2, "in its zone");
    assert.ok(Math.abs(p.z) < disco.pool.halfZ, "in the water");
  }
  const rows = new Set(inZone.map((p) => Math.round(p.z)));
  assert.ok(rows.size >= 2, "spread in rows down the zone, not bunched at one spot");
  assert.ok(Math.max(...inZone.map((p) => p.z)) > 5, "the front row is by the stage");
  assert.ok(
    inZone.every((p) => p.h > 90),
    "four to a zone have room",
  );
  assert.ok(!inZone.some((p) => p.complained));
}

// 4) Packed: six in one zone bump elbows (moods fall, the player is told once, in zones), and spreading them out is better.
{
  const packed = shift(),
    spread = shift(),
    said = [];
  const emit = packed.emit.bind(packed);
  packed.emit = (type, e) => {
    if (type === "toast") said.push(e.text);
    return emit(type, e);
  };
  toQueue(packed, 6).forEach((p) => assign(packed, p, 2));
  toQueue(spread, 6).forEach((p, i) => assign(spread, p, i % 4));
  for (let i = 0; i < 60 * 12; i++) {
    tick(packed);
    tick(spread);
  }
  const mood = (s) => s.people.filter((p) => p.status === "swim").reduce((a, p) => a + p.h, 0);
  assert.ok(mood(packed) < mood(spread) - 30, `packed moods fall (${mood(packed)} vs ${mood(spread)})`);
  const packedToasts = said.filter((t) => /Zone 3 is packed/.test(t));
  assert.equal(packedToasts.length, 1, "told once that zone 3 is packed: " + said);
  assert.ok(!said.some((t) => /\blane\b/i.test(t)), "no lanes in the disco: " + said);
}

// 5) The words: zones, not lanes, in the toasts and the stings.
{
  const s = shift();
  assert.equal(s.laneName(2), "Zone 3");
  assert.equal(s.laneName(null), "zone");
  const club = new PoolSimulation(1, 1);
  assert.equal(club.laneName(0), "Lane 1");
  const said = [];
  const emit = s.emit.bind(s);
  s.emit = (type, e) => {
    if (type === "toast") said.push(e.text);
    return emit(type, e);
  };
  s.laneClosure = 1;
  s.laneRefused(1);
  assert.equal(said.at(-1), "Zone 2 is closed. Use another zone!");
  const moments = new MomentDirector({ seen: ["closure"] });
  const sting = moments.incident({ type: "incident", kind: "closure", lane: 2, zone: true, x: 0, z: 0 }, 0);
  assert.match(sting.title, /^ZONE 2 CLOSED!$/);
  const lane = new MomentDirector({ seen: ["closure"] }).incident(
    { kind: "closure", lane: 2, x: 0, z: 0 },
    0,
  );
  assert.match(lane.title, /^LANE 2 CLOSED!$/, "the other pools keep their lanes");
}

// 6) The dance: one routine on one clock (beat 0 at the go), right arm, left arm, both, two bars each, round and round; the
// time inside a clip runs one bar and starts again; the light's pulse peaks on the beat.
{
  assert.deepEqual(ROUTINE, ["right", "right", "left", "left", "both", "both"]);
  assert.deepEqual(Object.values(DANCE_CLIP), ["danceRight", "danceLeft", "danceBoth"]);
  const bar = BEAT * BAR;
  for (let b = 0; b < 30; b++) {
    const d = danceAt(b * bar + 0.01);
    assert.equal(d.bar, b);
    assert.equal(d.move, ROUTINE[b % ROUTINE.length]);
    assert.equal(d.clip, DANCE_CLIP[d.move]);
    assert.ok(d.time >= 0 && d.time < bar);
  }
  assert.equal(danceAt(-3).bar, 0, "before the go: the first move, still");
  assert.equal(danceAt(BEAT * 2.5).beat, 2);
  assert.ok(Math.abs(danceAt(BEAT * 2.5).phase - 0.5) < 1e-9);
  assert.equal(pulse(0), 1);
  assert.ok(pulse(0.9) < 0.02);
  // Every dancer reads the same clock, so the whole class moves as one.
  const t = 37.3;
  assert.deepEqual(danceAt(t), danceAt(t));
}
console.log(
  "Disco checks passed: the Aqua Disco's floor plan and its one door in the back wall (no locker rooms), a class of aqua dancers (Marco and the VIPs too) in rows facing the stage, four to a zone, zones not lanes, and one dance routine for all.",
);
