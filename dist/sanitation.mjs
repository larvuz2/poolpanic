import { CoachController } from "./coach.mjs";
import { ENTRY } from "./spatial.mjs";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export class SanitationController extends CoachController {
  sanitationHint() {
    const q = this.cleanup;
    if (!q) return "";
    if (q.stage === "floating")
      return this.coach.carry === "skimmer"
        ? "Follow the floater · E to scoop"
        : "Grab the pool skimmer from the wall";
    if (q.stage === "caught") return "Carry the loaded skimmer to the waste bin";
    if (q.stage === "return") return "Hang the empty skimmer back on the wall";
    if (q.settle > 0)
      return "Chlorine " + Math.round(this.chlorine) + " · back in " + Math.ceil(3 - q.settle) + "s";
    return (
      "Chlorine " +
      Math.round(this.chlorine) +
      " / target 40–65 · " +
      (this.chlorine < 40
        ? "add a dose"
        : this.contamination > 25
          ? "still dirty—add a dose"
          : "water settling")
    );
  }
  collectInteractions(options) {
    super.collectInteractions(options);
    if (this.level < 3) return;
    const c = this.coach,
      q = this.cleanup,
      S = this.venue.sanitation,
      tier = -100;
    if (c.carry === "skimmer") {
      if (c.skimmerLoaded && distance(c, S.bin) < 1.8)
        options.push({
          kind: "dispose",
          label: "Empty skimmer into bin",
          ...S.bin,
          rank: tier,
          run: () => this.disposeWaste(),
        });
      if (!c.skimmerLoaded && distance(c, S.rack) < 1.8)
        options.push({
          kind: "hang-skimmer",
          label: "Hang up skimmer",
          ...S.rack,
          rank: tier + 0.1,
          run: () => this.returnItem(),
        });
      if (
        !c.skimmerLoaded &&
        q?.stage === "floating" &&
        distance(c, this.waterPoint()) < 1.55 &&
        distance(c, q) <= S.reach
      )
        options.push({
          kind: "scoop",
          label: c.scoopTimer ? "Scooping…" : "Scoop the floater",
          x: q.x,
          z: q.z,
          rank: tier + 0.2,
          run: () => this.scoop(),
        });
    } else if (!c.carry && distance(c, S.rack) < 1.8)
      options.push({
        kind: "skimmer",
        label: "Pick up pool skimmer",
        ...S.rack,
        rank: tier + 0.3,
        run: () => this.fetch("skimmer"),
      });
    if (c.carry === "chlorine" && q?.stage === "treat" && distance(c, this.waterPoint()) < 1.55)
      options.push({
        kind: "water",
        label: "Dose chlorine · target 40–65",
        ...this.waterPoint(),
        rank: tier + 0.4,
        run: () => this.deliverWater(1),
      });
  }
  fetch(item) {
    if (item !== "skimmer") return super.fetch(item);
    if (this.level < 3 || !this.canInteract() || this.coach.carry) return false;
    if (distance(this.coach, this.venue.sanitation.rack) > 1.8)
      return this.guideTo(this.venue.sanitation.rack, "The pool skimmer hangs on the side wall. Walk over and press E.");
    this.coach.carry = "skimmer";
    this.coach.skimmerLoaded = false;
    this.feedback();
    return true;
  }
  returnItem() {
    const c = this.coach;
    if (c.carry !== "skimmer") return super.returnItem();
    if (!this.canInteract()) return false;
    if (c.skimmerLoaded) return this.guideTo(this.venue.sanitation.bin, "Empty the loaded net into the waste bin first.");
    if (distance(c, this.venue.sanitation.rack) > 1.8) return this.guideTo(this.venue.sanitation.rack, "Return the skimmer to its wall hooks.");
    c.carry = null;
    c.scoopTimer = 0;
    if (this.cleanup?.stage === "return") this.cleanup.stage = "treat";
    this.feedback("pickup");
    return true;
  }
  deliver(id) {
    if (this.coach.carry === "skimmer") return false;
    return super.deliver(id);
  }
  scoop() {
    const c = this.coach,
      q = this.cleanup;
    if (
      !this.canInteract() ||
      c.carry !== "skimmer" ||
      c.skimmerLoaded ||
      q?.stage !== "floating" ||
      c.scoopCooldown > 0
    )
      return false;
    if (distance(c, this.waterPoint()) >= 1.55 || distance(c, q) > this.venue.sanitation.reach)
      return this.guideTo(q, "Move along the pool edge until the floater is in reach.");
    c.scoopTimer = 0.42;
    c.scoopCooldown = 0.85;
    c.scoopTarget = { x: q.x, z: q.z };
    c.angle = Math.atan2(q.x - c.x, q.z - c.z);
    this.emit("scoop-cast");
    return true;
  }
  disposeWaste() {
    const c = this.coach;
    if (!this.canInteract() || c.carry !== "skimmer" || !c.skimmerLoaded) return false;
    if (distance(c, this.venue.sanitation.bin) > 1.8)
      return this.guideTo(this.venue.sanitation.bin, "Walk to the waste bin and press E to empty the net.");
    c.skimmerLoaded = false;
    if (this.cleanup) this.cleanup.stage = "return";
    this.feedback("waste-bin");
    return true;
  }
  deliverWater(lane) {
    if (!this.cleanup) return super.deliverWater(lane);
    const c = this.coach,
      q = this.cleanup;
    if (!this.canInteract() || c.carry !== "chlorine") return false;
    if (q.stage !== "treat") {
      this.emit("toast", {
        text: "Scoop it, empty the net, then hang up the skimmer before treating the water.",
      });
      return false;
    }
    if (distance(c, this.waterPoint()) >= 1.55)
      return this.guideTo(this.waterPoint(), "Walk to the pool edge to add a dose.");
    this.contamination = Math.max(0, this.contamination - 60);
    this.chlorine = Math.min(120, this.chlorine + 22);
    this.waterBrown = Math.max(0, this.waterBrown - 0.6);
    c.carry = null;
    this.feedback("splash", this.waterPoint());
    this.emit("toast", {
      text:
        this.chlorine > 75
          ? "Too much! They’ll jump in anyway—keep eye drops ready."
          : "Chlorine " + Math.round(this.chlorine) + " · target 40–65",
      warning: this.chlorine > 75,
    });
    return true;
  }
  evacuatePerson(p, sendHome = false) {
    p.resumeLane = p.lane ?? 1;
    p.returnToLocker = sendHome;
    p.evacWater = p.status === "swim";
    p.status = "evacuating";
    p.stomachWarning = false;
    p.sick = false;
    p.actualSpeed = 0;
    p.lane = null;
    p.path = p.evacWater ? [{ x: p.x, z: ENTRY.waterZ }] : this.evacDeckRoute(p);
  }
  evacDeckRoute(p) {
    const slot = this.people.filter((a) => a.id < p.id && a.side === p.side).length;
    const P = this.venue.pool;
    const end = { x: p.side * (P.evacX + Math.floor(slot / 8) * 0.75), z: -2.7 + (slot % 8) * 1.35 };
    return [
      { x: this.lanes[p.resumeLane] + 1.15, z: ENTRY.walkZ },
      { x: p.side * P.corridorX, z: ENTRY.walkZ },
      { x: end.x, z: ENTRY.walkZ },
      end,
    ];
  }
  tickEvacuation(p, dt) {
    if (p.status === "panic") {
      p.h = Math.max(35, p.h - dt * 0.08);
      return true;
    }
    if (p.status !== "evacuating") return false;
    if (this.moveAlong(p, dt, p.evacWater ? 5.2 : 4.2)) {
      if (p.evacWater) {
        p.evacWater = false;
        p.path = this.evacDeckRoute(p);
      } else if (p.returnToLocker) {
        p.status = "queue";
        this.depart(p, false);
      } else {
        p.status = "panic";
        p.angle = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    return true;
  }
  tickStomach(p, dt) {
    if (!p.sick || this.level < 3 || this.cleanup) return;
    p.stomachElapsed = (p.stomachElapsed || 0) + dt;
    if (!p.stomachWarning && p.stomachElapsed >= (p.stomachDelay ?? 5)) {
      p.stomachWarning = true;
      this.emit("stomach-warning", { id: p.id });
      this.emit("toast", {
        text: p.name + " needs the locker room! Select the 💩 tag, then Send to locker.",
        warning: true,
      });
    }
    if (p.stomachWarning) {
      p.sicknessTimer = Math.max(0, p.sicknessTimer - dt);
      if (p.sicknessTimer === 0) this.catastrophe(p);
    }
  }
  catastrophe(p) {
    if (this.cleanup || this.level < 3) return;
    this.closed = 1;
    this.cleanup = {
      stage: "floating",
      x: clamp(p.x, -this.venue.pool.entryX, this.venue.pool.entryX),
      z: clamp(p.z, -this.venue.pool.entryZ, this.venue.pool.entryZ),
      vx: 0.48,
      vz: 0.62,
      phase: this.random() * 6.28,
      elapsed: 0,
      settle: 0,
    };
    this.waterBrown = 0.15;
    this.contamination = Math.max(50, this.contamination);
    this.chlorine = Math.min(18, this.chlorine);
    this.score -= 500;
    this.streak = 0;
    this.stats.catastrophes++;
    this.emit("catastrophe", { x: p.x, z: p.z });
    this.emit("toast", {
      text: "Everybody out! Get the pool skimmer. The shift clock waits while you clean.",
      warning: true,
    });
    for (const a of this.people)
      if (["swim", "enter"].includes(a.status)) {
        a.h = Math.max(35, a.h - 25);
        this.evacuatePerson(a, a.id === p.id);
      }
  }
  updateSanitation(dt) {
    const c = this.coach,
      q = this.cleanup;
    c.scoopCooldown = Math.max(0, (c.scoopCooldown || 0) - dt);
    if (c.scoopTimer > 0) {
      c.scoopTimer = Math.max(0, c.scoopTimer - dt);
      if (c.scoopTimer === 0) {
        if (
          q?.stage === "floating" &&
          c.carry === "skimmer" &&
          this.canInteract() &&
          distance(c, this.waterPoint()) < 1.55 &&
          distance(c, q) <= this.venue.sanitation.reach &&
          distance(q, c.scoopTarget) < 0.85
        ) {
          q.stage = "caught";
          c.skimmerLoaded = true;
          this.feedback("scooped");
        } else this.emit("scoop-miss");
      }
    }
    if (!q) {
      this.waterBrown = Math.max(0, (this.waterBrown || 0) - dt * 0.15);
      return;
    }
    q.elapsed += dt;
    if (q.stage === "floating") {
      q.vx += Math.sin(q.elapsed * 0.7 + q.phase) * dt * 0.14;
      q.vz += Math.cos(q.elapsed * 0.6 + q.phase) * dt * 0.13;
      const speed = Math.hypot(q.vx, q.vz);
      if (speed > 0.9) {
        q.vx *= 0.9 / speed;
        q.vz *= 0.9 / speed;
      }
      q.x += q.vx * dt;
      q.z += q.vz * dt;
      const P = this.venue.pool;
      if (Math.abs(q.x) > P.floatX) {
        q.x = clamp(q.x, -P.floatX, P.floatX);
        q.vx = -q.vx;
      }
      if (Math.abs(q.z) > P.floatZ) {
        q.z = clamp(q.z, -P.floatZ, P.floatZ);
        q.vz = -q.vz;
      }
      this.contamination = Math.min(100, this.contamination + dt * 2.7);
      this.waterBrown = Math.min(1, this.waterBrown + dt * 0.027);
    }
    const ready =
      q.stage === "treat" &&
      this.contamination <= 25 &&
      this.chlorine >= 40 &&
      !this.people.some((p) => p.status === "evacuating");
    q.settle = ready ? q.settle + dt : 0;
    if (q.settle >= 3) {
      this.closed = 0;
      this.cleanup = null;
      this.waterBrown = 0;
      for (const p of this.people)
        if (p.status === "panic") {
          const lane = p.resumeLane;
          p.status = "queue";
          p.lane = lane;
          p.resumingWorkout = true;
          this.walk(p, { x: this.lanes[lane] + 0.6, z: ENTRY.edgeZ });
        }
      this.emit("reopened");
      this.emit("toast", {
        text: this.chlorine > 75 ? "Pool open—watch those red eyes!" : "All clear! Everybody back in.",
        warning: this.chlorine > 75,
      });
    }
  }
}
