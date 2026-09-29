// The coach bot the season and drill checks play with: it manages lanes remotely and physically walks, swims
// and presses E through every incident, using only the real input the player has. Shared by season-check.mjs.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { plan } from "./check-helpers.mjs";

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const CARL_CATCHABLE = ["walking", "windup", "charge", "running", "waiting"];

export class CoachBot {
  // `proactive` coaches prevent incidents; reactive ones only clean up what cannot be ignored.
  // `config` plays a custom shift (a drill) at feature tier `level`; `booking` folds a booking into the shift.
  constructor(
    level,
    seed,
    { proactive = true, clearSplash = true, config = null, drill = null, booking = null } = {},
  ) {
    this.s = new PoolSimulation(level, seed, { config, drill, booking });
    this.proactive = proactive;
    this.clearSplash = clearSplash;
    this.frames = 0;
  }
  get over() {
    return this.s.status === "ended" || this.frames > this.cap;
  }
  frame() {
    const s = this.s;
    this.manage();
    s.tick(1 / 60);
    s.events.length = 0;
    this.frames++;
    assert.equal(
      s.finCount(),
      3,
      "Fins stay accounted for (level " + s.level + ", t=" + s.time.toFixed(1) + ")",
    );
  }
  wait(n) {
    for (let i = 0; i < n && !this.over; i++) this.frame();
  }
  // A closed lane (a mid-shift twist) sends its usual swimmers to the nearest open one, emptiest first.
  openLane(preferred) {
    const s = this.s,
      tr = s.venue.trampoline;
    if (s.laneClosed() !== preferred) return preferred;
    const options = [...s.lanes.keys()]
      .filter((l) => l !== preferred && !(tr && this.clearSplash && l === tr.lane))
      .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || s.occupancy(a) - s.occupancy(b));
    return options[0] ?? preferred;
  }
  // Remote management: lanes by type, stomach trouble home, daredevils to the tower, splash lane kept clear.
  manage() {
    const s = this.s,
      five = s.lanes.length > 3,
      tr = s.venue.trampoline;
    for (const p of s.people) p.crampAt = Infinity;
    for (const p of s.people.filter((p) => p.stomachWarning)) {
      s.select(p.id);
      s.home();
    }
    if (s.status !== "playing") return;
    for (const p of s.people.filter((p) => p.status === "queue")) {
      s.select(p.id);
      if (p.queasy && p.sick) s.home();
      else if (p.type === "daredevil") {
        if (!s.jumper && !s.rescue && !s.closed) s.assignTrampoline();
      } else
        s.assign(
          this.openLane(
            five
              ? { beginner: 0, aqua: 1, intermediate: 2, advanced: this.clearSplash ? 3 : 4 }[p.type]
              : { beginner: 0, aqua: 0, intermediate: 1, advanced: 2 }[p.type],
          ),
        );
    }
    s.selected = null;
    const j = tr && this.clearSplash && s.get(s.jumper);
    if (j && ["toStairs", "waiting"].includes(j.jumpStage) && !s.rescue && !s.closed)
      for (const p of s.people.filter((p) => p.lane === tr.lane && p.status === "swim" && !p.problem)) {
        s.select(p.id);
        s.assign(tr.lane - 1);
        s.selected = null;
      }
  }

  // ----------------------------------------------------------------------------------------------------
  // Movement with real input.
  steer(to) {
    const s = this.s,
      dx = to.x - s.coach.x,
      dz = to.z - s.coach.z,
      m = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / m, dz / m);
  }
  walkTo(to, { reach = 0.2, limit = 1500, until = null } = {}) {
    const s = this.s;
    let path = plan(s, to);
    for (let f = 0; f < limit && !this.over; f++) {
      if (until?.() || s.coach.swimming || s.coach.waterTransition) break;
      if (distance(s.coach, to) < reach) break;
      while (path.length > 1 && distance(path[0], s.coach) < 0.25) path.shift();
      if (!path.length || (path.length === 1 && distance(path[0], s.coach) < 0.12)) break;
      this.steer(path[0]);
      this.frame();
      if (f % 24 === 23) path = plan(s, to);
    }
    s.clearInput();
    return distance(s.coach, to) < Math.max(reach, 0.5);
  }
  chase(target, done, limit = 1500) {
    const s = this.s;
    let path = [];
    for (let f = 0; f < limit && !this.over && !done(); f++) {
      if (f % 8 === 0 || !path.length) path = plan(s, target());
      while (path.length > 1 && distance(path[0], s.coach) < 0.3) path.shift();
      if (path.length) this.steer(path[0]);
      this.frame();
    }
    s.clearInput();
    return done();
  }
  // Press E for a specific interaction once it is on offer (waiting out slips and busy moments).
  use(kind, patience = 90) {
    const s = this.s;
    for (let f = 0; f < patience && !this.over; f++) {
      const option = s.nearestInteraction();
      if (option?.kind === kind) {
        option.run();
        this.waitBusy();
        return true;
      }
      if (s.coach.busy || s.coach.slipTime > 0 || s.coach.y > 0.05) {
        this.frame();
        continue;
      }
      return false;
    }
    return false;
  }
  waitBusy() {
    for (let f = 0; f < 240 && this.s.coach.busy && !this.over; f++) this.frame();
  }
  approach(point, reach = 1.2) {
    return this.walkTo(point, { reach });
  }
  wallPoint(fixture) {
    return {
      x: fixture.x + Math.sin(fixture.angle || 0) * 0.9,
      z: fixture.z + Math.cos(fixture.angle || 0) * 0.9,
    };
  }
  // Walk to the long-side edge nearest a point in the pool; a coach on a water mission dives in by itself.
  diveNear(point) {
    const s = this.s,
      P = s.venue.pool,
      side = Math.sign(point.x) || 1,
      edge = { x: side * (P.solidX + 0.7), z: Math.max(-P.turnZ, Math.min(P.turnZ, point.z)) };
    this.walkTo(edge, { until: () => s.coach.swimming || s.coach.waterTransition });
    for (let f = 0; f < 150 && !s.coach.swimming && !this.over; f++) {
      s.setMovement(-side, 0);
      this.frame();
    }
    s.clearInput();
    return s.coach.swimming;
  }
  climbOut() {
    const s = this.s;
    for (let f = 0; f < 900 && (s.coach.swimming || s.coach.waterTransition) && !this.over; f++) {
      s.setMovement(Math.sign(s.coach.x) || 1, 0);
      this.frame();
    }
    s.clearInput();
  }
  putAway() {
    const s = this.s,
      c = s.coach,
      fx = s.venue.fixtures;
    if (c.swimming) this.climbOut();
    const home = {
      fishnet: () => this.wallPoint(fx.fishNet),
      flashlight: () => fx.flashlight,
      medkit: () => fx.medkit,
      treats: () => fx.treats,
      lifering: () => this.wallPoint(s.lifeRings.find((r) => r.state === "coach").mount),
    }[c.carry];
    if (!home) return;
    this.approach(home(), 1.0);
    for (let f = 0; f < 60 && c.carry && !this.over; f++) {
      if (s.canInteract()) s.returnItem();
      else this.frame();
      if (c.carry) this.frame();
    }
  }

  // ----------------------------------------------------------------------------------------------------
  // Incident handlers. Each is bounded; the main loop re-evaluates priorities between calls.
  nextTask() {
    const s = this.s,
      c = s.coach;
    if (s.rescue?.kind === "crash" || s.people.some((p) => p.status === "injured")) return this.crash;
    if (s.fish?.stage === "loose") return this.fishLoose;
    if (c.netLoaded) return this.fishReturn;
    if (s.outage?.stage === "dark") return this.outage;
    if (this.proactive) {
      if (s.fish?.stage === "approach") return this.fishKid;
      if (s.outage?.stage === "flicker") return this.outage;
      const carl = s.carl && s.visitor(s.carl.id);
      if (carl && CARL_CATCHABLE.includes(carl.status)) return this.carl;
      if (s.dog && s.dog.stage !== "leaving") return this.dog;
    }
    if (c.carry) return this.putAway;
    return null;
  }
  fishKid() {
    const s = this.s,
      kid = s.visitor(s.fish.kid);
    if (!kid) return this.wait(1);
    this.chase(
      () => kid,
      () => s.fish?.stage !== "approach" || s.nearestInteraction()?.kind === "stop-kid",
      900,
    );
    this.use("stop-kid");
  }
  fishLoose() {
    const s = this.s,
      c = s.coach;
    if (!c.swimming) {
      if (c.carry && c.carry !== "fishnet") return this.putAway();
      if (c.carry !== "fishnet") {
        this.approach(this.wallPoint(s.venue.fixtures.fishNet), 0.6);
        if (!this.use("fishnet")) return this.wait(1);
      }
      if (!this.diveNear(s.fish)) return;
    }
    for (let f = 0; f < 60 * 40 && s.fish?.stage === "loose" && c.swimming && !this.over; f++) {
      this.steer(s.fish);
      this.frame();
    }
    s.clearInput();
    if (s.fish?.stage !== "loose") this.climbOut();
  }
  fishReturn() {
    const s = this.s,
      kid = s.fish && s.visitor(s.fish.kid);
    if (s.coach.swimming) this.climbOut();
    if (kid && kid.status === "crying") {
      this.chase(
        () => kid,
        () => s.nearestInteraction()?.kind === "return-fish",
        900,
      );
      this.use("return-fish");
    }
    if (!s.coach.netLoaded) this.putAway();
    else this.wait(1);
  }
  carl() {
    const s = this.s,
      v = s.visitor(s.carl.id);
    this.chase(
      () => v,
      () => !s.carl || !CARL_CATCHABLE.includes(v.status) || s.nearestInteraction()?.kind === "red-card",
      600,
    );
    this.use("red-card");
  }
  outage() {
    const s = this.s,
      fx = s.venue.fixtures,
      box = this.wallPoint(fx.fuseBox);
    if (s.outage.stage === "flicker") {
      this.walkTo(box, { reach: 0.6, until: () => s.outage?.stage !== "flicker" });
      this.use("reset-breaker");
      return;
    }
    if (s.coach.carry !== "flashlight") {
      if (s.coach.carry) return this.putAway();
      this.approach(fx.flashlight, 1.0);
      if (!this.use("flashlight")) return this.wait(1);
    }
    this.walkTo(box, { reach: 0.6 });
    if (this.use("reset-breaker")) this.putAway();
  }
  dog() {
    const s = this.s,
      fx = s.venue.fixtures;
    if (s.coach.carry !== "treats") {
      if (s.coach.carry) return this.putAway();
      this.approach(fx.treats, 1.0);
      if (!this.use("treats")) return this.wait(1);
    }
    const v = s.visitor(s.dog.id);
    if (!v) return this.wait(1);
    this.chase(
      () => v,
      () => !s.dog || s.dog.stage === "following",
      900,
    );
    if (s.dog?.stage !== "following") return;
    const door = s.venue.arrival,
      side = Math.abs(s.coach.x + door.outsideX) < Math.abs(s.coach.x - door.outsideX) ? -1 : 1;
    this.walkTo(
      { x: side * door.outsideX, z: door.doorZ + 0.6 },
      { until: () => s.dog?.stage !== "following" },
    );
    for (let f = 0; f < 240 && s.dog?.stage === "following"; f++) this.frame();
  }
  // Trampoline crash: a ring for every victim, then the medical kit for everyone on the deck.
  crash() {
    const s = this.s,
      c = s.coach;
    if (s.rescue?.kind === "crash") {
      if (s.rescue.stage !== "stranded") return this.wait(1);
      if (c.swimming) return this.climbOut();
      if (c.carry !== "lifering") {
        if (c.carry) return this.putAway();
        const ring = s.lifeRings
          .filter((r) => ["wall", "deck"].includes(r.state))
          .sort((a, b) => distance(a, c) - distance(b, c))[0];
        if (!ring) return this.wait(1);
        this.approach(ring.state === "wall" ? this.wallPoint(ring.mount) : ring, 0.8);
        if (!this.use("lifering")) return this.wait(1);
      }
      const victim = s.strandedVictims().sort((a, b) => distance(a, c) - distance(b, c))[0];
      if (!victim || !this.diveNear(victim)) return;
      const waiting = s.strandedVictims().length;
      for (
        let f = 0;
        f < 60 * 20 && s.strandedVictims().length === waiting && c.swimming && !this.over;
        f++
      ) {
        const next = s.strandedVictims().sort((a, b) => distance(a, c) - distance(b, c))[0];
        if (!next) break;
        this.steer(next);
        this.frame();
      }
      return this.climbOut();
    }
    const injured = s.people.filter((p) => p.status === "injured");
    if (!injured.length) return;
    if (c.carry !== "medkit") {
      if (c.carry) return this.putAway();
      this.approach(s.venue.fixtures.medkit, 1.0);
      if (!this.use("medkit")) return this.wait(1);
    }
    const p = injured.sort((a, b) => distance(a, c) - distance(b, c))[0];
    if (p.path.length) return this.wait(10);
    this.walkTo(p, { reach: 1.1 });
    if (s.tendInjured(p.id)) this.waitBusy();
    else this.wait(1);
    if (!s.people.some((q) => q.status === "injured")) this.putAway();
  }
  run() {
    const s = this.s;
    this.cap = Math.ceil(s.config.duration * 60 * 4);
    s.start();
    const standby = s.venue.coachStart;
    while (!this.over) {
      const task = this.nextTask();
      if (task) task.call(this);
      else if (distance(s.coach, standby) > 1.5) this.walkTo(standby, { limit: 20 });
      else this.frame();
    }
    return this;
  }
}
