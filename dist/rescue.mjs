import { SanitationController } from "./sanitation.mjs";
import { RESCUE as R, ENTRY } from "./spatial.mjs";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const waitingInWater = (s, p) =>
  !!s.rescue && !p.rescueRecover && (p.status === "swim" || (p.status === "exit" && p.exitPhase === "water"));

export class RescueController extends SanitationController {
  constructor(venue) {
    super();
    this.venue = venue;
    this.rescue = null;
    this.lifeRings = venue.ringMounts.map((mount, id) => ({
      id,
      mount,
      state: "wall",
      owner: null,
      ...mount,
    }));
  }
  get lifeRing() {
    return (
      this.lifeRings.find((r) => r.state === "coach") ||
      this.lifeRings.find((r) => ["victim", "deck"].includes(r.state)) ||
      this.lifeRings[0]
    );
  }
  startCramp(p) {
    if (
      this.status !== "playing" ||
      this.level < 2 ||
      this.cleanup ||
      this.rescue ||
      this.people.some((a) => a.rescueRecover) ||
      !this.lifeRings.some((r) => ["wall", "deck", "coach"].includes(r.state)) ||
      p.status !== "swim" ||
      p.problem ||
      p.sick ||
      p.crampDone
    )
      return false;
    p.problem = "cramp";
    p.crampDone = true;
    p.actualSpeed = 0;
    this.rescue = { victim: p.id, stage: "stranded" };
    for (const a of this.people) if (waitingInWater(this, a)) a.actualSpeed = 0;
    this.emit("cramp-alarm", { id: p.id, x: p.x, z: p.z });
    this.emit("toast", {
      text: p.name + " has a cramp! Grab a glowing life ring and walk to the pool edge.",
      warning: true,
    });
    return true;
  }
  updateRescue() {
    if (this.rescue || this.cleanup || this.level < 2) return;
    const p = this.people.find(
      (a) =>
        a.status === "swim" &&
        !a.crampDone &&
        !a.problem &&
        !a.sick &&
        a.workTime >= a.crampAt &&
        Math.abs(a.z) < 5.6,
    );
    if (p) this.startCramp(p);
  }
  rescueHint() {
    if (this.rescue?.stage === "escaping")
      return "Swimmer heading to safety · pool resumes once they are out";
    if (this.coach.swimming)
      return this.rescue
        ? "Swim to the 🦵 swimmer · life ring transfers automatically"
        : "Swim to an edge to climb out";
    if (this.coach.waterTransition)
      return this.coach.waterTransition.kind === "dive" ? "Rescue dive!" : "Climbing out";
    if (this.rescue)
      return this.coach.carry === "lifering"
        ? "Walk to the pool edge · dive in automatically"
        : "Glowing life ring · E to pick up";
    if (this.coach.carry === "lifering") return "Return the life ring to its wall hook · E";
    return this.lifeRing.state === "deck" ? "Life ring beside the bench · E to collect" : "";
  }
  canInteract() {
    return !this.coach.swimming && !this.coach.waterTransition && super.canInteract();
  }
  collectInteractions(options) {
    super.collectInteractions(options);
    if (this.level < 2) return;
    const c = this.coach,
      tier = -200,
      ring = this.lifeRings
        .filter((r) => ["wall", "deck"].includes(r.state))
        .sort((a, b) => distance(c, a) - distance(c, b))[0],
      carried = this.lifeRings.find((r) => r.state === "coach");
    if (c.carry === "lifering" && carried && distance(c, carried.mount) < 1.8)
      options.push({
        kind: "ring-return",
        label: "Hang up life ring",
        ...carried.mount,
        rank: tier,
        run: () => this.returnItem(),
      });
    if (!c.carry && ring && distance(c, ring) < 1.8)
      options.push({
        kind: "lifering",
        ringId: ring.id,
        label: "Pick up life ring",
        x: ring.x,
        z: ring.z,
        rank: tier + 0.1,
        run: () => this.fetch("lifering", ring.id),
      });
  }
  fetch(item, ringId) {
    if (item !== "lifering") return super.fetch(item);
    const c = this.coach,
      r =
        ringId === undefined
          ? this.lifeRings
              .filter((r) => ["wall", "deck"].includes(r.state))
              .sort((a, b) => distance(c, a) - distance(c, b))[0]
          : this.lifeRings[ringId];
    if (this.level < 2 || !this.canInteract() || c.carry || !r || !["wall", "deck"].includes(r.state))
      return false;
    if (distance(c, r) > 1.8) return this.guideTo(r, "Walk to the life ring and press E.");
    c.carry = "lifering";
    c.carryOwner = r.id;
    r.state = "coach";
    r.owner = null;
    this.feedback();
    return true;
  }
  returnItem() {
    if (this.coach.carry !== "lifering") return super.returnItem();
    if (!this.canInteract()) return false;
    const r = this.lifeRings.find((r) => r.state === "coach");
    if (!r) return false;
    if (distance(this.coach, r.mount) > 1.8)
      return this.guideTo(r.mount, "Return the life ring to its wall hook.");
    this.coach.carry = null;
    this.coach.carryOwner = null;
    Object.assign(r, { state: "wall", owner: null, ...r.mount });
    this.feedback();
    return true;
  }
  deliver(id) {
    if (this.coach.carry === "lifering") return false;
    return super.deliver(id);
  }
  assist() {
    const p = this.get(this.selected);
    if (p?.problem === "cramp") {
      const ring = this.lifeRings
        .filter((r) => ["wall", "deck"].includes(r.state))
        .sort((a, b) => distance(this.coach, a) - distance(this.coach, b))[0];
      return this.guideTo(
        this.coach.carry === "lifering" ? this.waterPoint() : ring || this.venue.ringMounts[0],
        this.coach.carry === "lifering"
          ? "Walk to the edge, then swim the ring to " + p.name + "."
          : "Get a glowing life ring to rescue " + p.name + ".",
      );
    }
    return super.assist();
  }
  dash() {
    if (this.coach.swimming || this.coach.waterTransition) return false;
    return super.dash();
  }
  jump() {
    const c = this.coach;
    if (this.status !== "playing" || c.waterTransition) return;
    if (c.swimming) {
      this.leaveWater();
      return;
    }
    if (this.tryRescueEntry()) return;
    super.jump();
  }
  tryRescueEntry() {
    const c = this.coach;
    if (
      this.rescue?.stage === "stranded" &&
      c.carry === "lifering" &&
      c.rescueEntryArmed !== false &&
      this.canInteract() &&
      distance(c, this.waterPoint()) < 1.5
    ) {
      const P = this.venue.pool;
      const to = { x: clamp(c.x, -P.entryX, P.entryX), z: clamp(c.z, -P.entryZ, P.entryZ) };
      c.waterTransition = { kind: "dive", from: { x: c.x, z: c.z }, to, t: 0 };
      c.vx = c.vz = c.vy = 0;
      c.dashTime = 0;
      c.jumpBuffer = 0;
      c.angle = Math.atan2(to.x - c.x, to.z - c.z);
      this.emit("jump");
      return true;
    }
    return false;
  }
  leaveWater() {
    const c = this.coach;
    if (!c.swimming || c.waterTransition) return false;
    const P = this.venue.pool;
    const sides = [
      { gap: P.swimX - Math.abs(c.x), to: { x: Math.sign(c.x) * P.climbOutX, z: c.z } },
      { gap: P.swimZ - Math.abs(c.z), to: { x: c.x, z: Math.sign(c.z) * P.endWalkZ } },
    ].sort((a, b) => a.gap - b.gap);
    const exit = sides.find((a) => a.gap < 0.35 && this.isDeck(a.to.x, a.to.z));
    if (!exit) return false;
    c.waterTransition = { kind: "climb", from: { x: c.x, z: c.z }, to: exit.to, t: 0 };
    c.vx = c.vz = 0;
    c.angle = Math.atan2(exit.to.x - c.x, exit.to.z - c.z);
    return true;
  }
  updateCoach(dt) {
    const c = this.coach;
    if (c.waterTransition) {
      const q = c.waterTransition;
      q.t = Math.min(1, q.t + dt / (q.kind === "dive" ? 0.55 : 0.6));
      const t = q.t;
      c.x = q.from.x + (q.to.x - q.from.x) * t;
      c.z = q.from.z + (q.to.z - q.from.z) * t;
      c.y = q.kind === "dive" ? Math.sin(t * Math.PI) * 0.95 - 0.39 * t : -0.39 * (1 - t);
      if (t === 1) {
        c.swimming = q.kind === "dive";
        if (!c.swimming) c.rescueEntryArmed = false;
        c.waterTransition = null;
        c.y = c.swimming ? -0.39 : 0;
        c.vy = 0;
        this.emit("splash", { x: c.x, z: c.z });
      }
      return;
    }
    if (!c.swimming) {
      super.updateCoach(dt);
      if (distance(c, this.waterPoint()) >= 1.6) c.rescueEntryArmed = true;
      this.tryRescueEntry();
      return;
    }
    c.y = -0.39;
    c.state = c.carry === "lifering" ? "Swimming with life ring" : "Swimming to the edge";
    const n = Math.max(1, Math.hypot(c.input.x, c.input.z)),
      x = c.input.x / n,
      z = c.input.z / n;
    const rate = Math.min(1, dt * 10);
    c.vx += (x * R.swimSpeed - c.vx) * rate;
    c.vz += (z * R.swimSpeed - c.vz) * rate;
    const P = this.venue.pool;
    c.x = clamp(c.x + c.vx * dt, -P.swimX, P.swimX);
    c.z = clamp(c.z + c.vz * dt, -P.swimZ, P.swimZ);
    if (Math.hypot(c.vx, c.vz) > 0.1) c.angle = Math.atan2(c.vx, c.vz);
    const p = this.get(this.rescue?.victim);
    if (p && this.rescue.stage === "stranded" && c.carry === "lifering" && distance(c, p) < 1.25) {
      const ring = this.lifeRings[c.carryOwner];
      p.rescueRingId = ring.id;
      Object.assign(ring, { state: "victim", owner: p.id });
      c.carry = null;
      c.carryOwner = null;
      p.resumeLane = p.lane;
      p.rescueRecover = true;
      p.problem = null;
      p.status = "exit";
      this.beginWaterExit(p);
      p.lane = null;
      this.rescue.stage = "escaping";
      this.feedback("helped", { id: p.id });
    }
    if (
      (Math.abs(c.x) >= P.swimX - 0.01 && x * Math.sign(c.x) > 0.3) ||
      (Math.abs(c.z) >= P.swimZ - 0.01 && z * Math.sign(c.z) > 0.3)
    )
      this.leaveWater();
  }
  rescueOnDeck(p) {
    this.rescue = null;
    p.status = "recovering";
    p.recoveryStage = "to-bench";
    p.stunned = 1;
    const P = this.venue.pool,
      bench = this.venue.rescue;
    const x = Math.sign(bench.bench.x) * P.corridorX;
    p.path = [
      { x, z: p.exitEnd * P.endWalkZ },
      { x, z: bench.approach.z },
      { ...bench.approach },
      { ...bench.bench },
    ];
    this.emit("rescue-safe", { id: p.id });
    this.emit("toast", { text: p.name + " is safely out. Swimming resumes!" });
  }
  tickRecovery(p, dt) {
    if (p.status !== "recovering") return false;
    if (p.recoveryStage === "to-bench") {
      if (this.moveAlong(p, dt, 3.1)) {
        p.recoveryStage = "resting";
        p.restTime = R.restSeconds;
        p.angle = Math.PI / 2;
        Object.assign(this.lifeRings[p.rescueRingId], {
          state: "deck",
          owner: null,
          ...this.venue.rescue.approach,
        });
      }
    } else {
      p.restTime = Math.max(0, p.restTime - dt);
      if (p.restTime === 0 && !this.cleanup && !this.rescue) {
        p.rescueRecover = false;
        p.recoveryStage = null;
        p.exitPhase = null;
        p.resumingWorkout = true;
        p.lane = p.resumeLane;
        p.h = Math.min(100, p.h + 12);
        this.walk(p, { x: this.lanes[p.lane] + 0.6, z: ENTRY.edgeZ });
        p.path.unshift({ ...this.venue.rescue.approach });
      }
    }
    return true;
  }
}
