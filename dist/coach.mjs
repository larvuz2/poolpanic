import { ENTRY, COACH_TUNING as T } from "./spatial.mjs";
const names = {
  fins: "fins",
  chlorine: "chlorine",
  relief: "eye relief",
  goggles: "goggles",
  skimmer: "pool skimmer",
  lifering: "life ring",
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const approach = (v, target, amount) =>
  v < target ? Math.min(target, v + amount) : Math.max(target, v - amount);
export class CoachController {
  setMovement(x, z) {
    const n = Math.max(1, Math.hypot(x, z));
    this.coach.input = { x: x / n, z: z / n };
  }
  clearInput() {
    const c = this.coach;
    this.setMovement(0, 0);
    c.vx = 0;
    c.vz = 0;
    c.jumpBuffer = 0;
    c.dashTime = 0;
  }
  jump() {
    if (this.status === "playing") this.coach.jumpBuffer = 0.12;
  }
  dash() {
    const c = this.coach;
    if (this.status !== "playing" || c.dashCooldown > 0 || c.slipTime > 0) return false;
    const n = Math.hypot(c.input.x, c.input.z);
    c.dashX = n ? c.input.x / n : Math.sin(c.angle);
    c.dashZ = n ? c.input.z / n : Math.cos(c.angle);
    c.dashTime = T.dashDuration;
    c.dashCooldown = T.dashCooldown;
    this.emit("dash", { x: c.x, z: c.z });
    return true;
  }
  updateCoach(dt) {
    const c = this.coach;
    c.feedback = Math.max(0, c.feedback - dt);
    c.landing = Math.max(0, c.landing - dt);
    c.slipCooldown = Math.max(0, c.slipCooldown - dt);
    c.slipTime = Math.max(0, c.slipTime - dt);
    c.dashCooldown = Math.max(0, c.dashCooldown - dt);
    if (c.jumpBuffer > 0 && c.y === 0 && c.slipTime === 0) {
      c.vy = T.jumpSpeed;
      c.jumpBuffer = 0;
      this.emit("jump", { x: c.x, z: c.z });
    }
    c.jumpBuffer = Math.max(0, c.jumpBuffer - dt);
    const moving = c.slipTime === 0;
    const accel = c.input.x || c.input.z ? T.acceleration : T.braking;
    const dashing = c.dashTime > 0 && moving;
    const dx = (moving ? c.input.x * T.speed : 0) - c.vx,
      dz = (moving ? c.input.z * T.speed : 0) - c.vz;
    const velocityStep = Math.min(1, (accel * dt) / Math.max(0.000001, Math.hypot(dx, dz)));
    if (dashing) {
      c.vx = c.dashX * T.dashSpeed;
      c.vz = c.dashZ * T.dashSpeed;
    } else {
      c.vx += dx * velocityStep;
      c.vz += dz * velocityStep;
    }
    c.dashTime = Math.max(0, c.dashTime - dt);
    if (!moving) c.dashTime = 0;
    // Sliding collision resolution keeps diagonals and tight passages responsive.
    const slices = Math.max(1, Math.ceil((Math.max(Math.abs(c.vx), Math.abs(c.vz)) * dt) / 0.12));
    for (let i = 0; i < slices; i++) {
      const x = c.x + (c.vx * dt) / slices;
      if (this.isDeck(x, c.z)) c.x = x;
      else c.vx = 0;
      const z = c.z + (c.vz * dt) / slices;
      if (this.isDeck(c.x, z)) c.z = z;
      else c.vz = 0;
    }
    if (Math.hypot(c.vx, c.vz) > 0.12) c.angle = Math.atan2(c.vx, c.vz);
    if (c.y > 0 || c.vy > 0) {
      c.vy -= T.gravity * dt;
      c.y = Math.max(0, c.y + c.vy * dt);
      if (c.y === 0 && c.vy < 0) {
        c.vy = 0;
        c.landing = 0.18;
        this.emit("land", { x: c.x, z: c.z });
      }
    }
    if (c.y < 0.18 && c.slipCooldown === 0 && this.slipperyAt(c.x, c.z, 0.58)) {
      c.slipTime = 0.7;
      c.slipCooldown = 2;
      c.dashTime = 0;
      c.vx *= 0.25;
      c.vz *= 0.25;
      this.emit("coach-slip", { x: c.x, z: c.z });
    }
    c.state = c.slipTime
      ? "Whoops!"
      : c.carry
        ? "Holding " + names[c.carry]
        : Math.hypot(c.vx, c.vz) > 0.2
          ? "On the move"
          : "Ready to help";
  }
  // Anything underfoot that trips walkers: dropped fins here; wet puddles are added by the chaos layer.
  slipperyAt(x, z, reach = 0.6) {
    return this.clutter.some((f) => f.type === "fins" && Math.hypot(x - f.x, z - f.z) < reach);
  }
  guideTo(point, text) {
    this.coach.goal = { ...point, label: text };
    this.emit("toast", { text });
    return false;
  }
  canInteract() {
    return this.status === "playing" && this.coach.y < 0.08 && this.coach.slipTime === 0;
  }
  servicePoint(p) {
    if (p.status !== "swim" || p.lane == null) return { x: p.x, z: p.z };
    const P = this.venue.pool,
      last = this.lanes.length - 1;
    const points = [
      { x: this.lanes[p.lane] + 1.15, z: -P.serviceZ },
      { x: p.x, z: P.serviceZ },
    ];
    if (p.lane === 0) points.push({ x: -P.sideServiceX, z: p.z });
    if (p.lane === last) points.push({ x: P.sideServiceX, z: p.z });
    const reachable = points.filter((a) => distance(a, p) <= T.handoffReach);
    return (reachable.length ? reachable : points).sort((a, b) =>
      reachable.length ? distance(a, this.coach) - distance(b, this.coach) : distance(a, p) - distance(b, p),
    )[0];
  }
  swimmerInReach(p) {
    if (!["queue", "enter", "swim"].includes(p.status) || distance(this.coach, p) > T.handoffReach)
      return false;
    if (p.status !== "swim") return true;
    const c = this.coach,
      P = this.venue.pool;
    return (
      (Math.abs(c.z) >= P.reachZ && Math.sign(c.z) === Math.sign(p.z)) ||
      (p.lane === 0 && c.x <= -P.reachX) ||
      (p.lane === this.lanes.length - 1 && c.x >= P.reachX)
    );
  }
  waterPoint() {
    const c = this.coach,
      P = this.venue.pool;
    return { x: Math.max(-P.edgeX, Math.min(P.edgeX, c.x)), z: Math.max(-P.edgeZ, Math.min(P.edgeZ, c.z)) };
  }
  // Every controller layer contributes ranked options; E runs the best one. Lower rank wins. Incident
  // layers use negative tiers so an active emergency's action outranks routine service nearby.
  nearestInteraction() {
    if (!this.canInteract()) return null;
    const options = [];
    this.collectInteractions(options);
    return options.sort((a, b) => a.rank - b.rank)[0] || null;
  }
  collectInteractions(options) {
    const c = this.coach;
    if (c.carry === "chlorine" && this.closed <= 0 && distance(c, this.waterPoint()) < 1.55) {
      const p = this.waterPoint();
      options.push({
        kind: "water",
        label: "Treat the water",
        ...p,
        rank: 0.1,
        run: () => this.deliverWater(1),
      });
    }
    for (const p of this.people) {
      if (!this.swimmerInReach(p)) continue;
      const point = this.servicePoint(p),
        rank = distance(c, point) + (p.id === this.selected ? -0.4 : 0);
      let label, kind, run;
      if (c.carry === "fins" && p.needsFins && !p.hasFins) {
        label = "Give fins to " + p.name;
        kind = "deliver";
      } else if (c.carry === "relief" && p.problem === "eyes") {
        label = "Soothe " + p.name + "’s eyes";
        kind = "deliver";
      } else if (c.carry === "goggles" && p.id === c.carryOwner && p.problem === "goggles") {
        label = "Return " + p.name + "’s goggles";
        kind = "deliver";
      } else if (!c.carry && p.problem === "cramp") {
        label = "Help " + p.name + " with cramp";
        kind = "assist";
        run = () => {
          this.select(p.id);
          return this.assist();
        };
      } else if (!c.carry && p.status === "queue") {
        label = "Select " + p.name;
        kind = "select";
        run = () => {
          this.select(p.id);
          this.emit("toast", { text: "Choose a lane for " + p.name + "." });
          return true;
        };
      }
      if (kind)
        options.push({
          kind,
          id: p.id,
          label,
          ...point,
          rank: rank + (kind === "select" ? 4 : 0),
          run: run || (() => this.deliver(p.id)),
        });
    }
    for (const [item, point] of Object.entries(this.venue.stations)) {
      if (distance(c, point) > T.reach) continue;
      if (!c.carry) {
        options.push({
          kind: "fetch",
          item,
          label:
            item === "fins"
              ? this.finsAvailable
                ? "Pick up fins"
                : "Fin rack is empty"
              : item === "chlorine"
                ? "Pick up chlorine"
                : "Pick up eye relief",
          ...point,
          rank: distance(c, point) + 2,
          run: () => this.fetch(item),
        });
      } else if ((c.carry === item && item !== "fins") || (c.carry === "goggles" && item === "relief"))
        options.push({
          kind: "return",
          label: "Return " + names[c.carry],
          ...point,
          rank: distance(c, point) + 2,
          run: () => this.returnItem(),
        });
    }
    if (!c.carry)
      for (const f of this.clutter)
        if (distance(c, f) <= 1.45)
          options.push({
            kind: "pickup",
            id: f.id,
            label: "Pick up " + names[f.type],
            x: f.x,
            z: f.z,
            rank: distance(c, f) + 0.3,
            run: () => this.pickup(f.id),
          });
    if (c.carry === "fins")
      options.push({
        kind: "drop-fins",
        label: "Drop fins on the floor",
        x: c.x,
        z: c.z,
        rank: 99,
        run: () => this.dropCarriedFins(),
      });
  }
  interact() {
    if (!this.canInteract()) return false;
    const option = this.nearestInteraction();
    if (!option) {
      this.emit("toast", {
        text: this.coach.carry
          ? "Meet a swimmer at either end or beside an outer lane."
          : "Move next to equipment, dropped gear, or a waiting swimmer.",
      });
      return false;
    }
    return option.run();
  }
  dropCarriedFins() {
    const c = this.coach;
    if (!this.canInteract() || c.carry !== "fins") return false;
    let x = c.x - Math.sin(c.angle) * 0.5,
      z = c.z - Math.cos(c.angle) * 0.5;
    if (!this.isDeck(x, z)) {
      x = c.x;
      z = c.z;
    }
    this.clutter.push({ id: ++this.uid, type: "fins", x, z });
    c.carry = null;
    c.carryOwner = null;
    c.slipCooldown = Math.max(c.slipCooldown, 1);
    this.feedback("drop", { x, z });
    return true;
  }
  feedback(type = "pickup", extra = {}) {
    this.coach.goal = null;
    this.coach.feedback = 0.25;
    this.emit(type, { x: this.coach.x, z: this.coach.z, ...extra });
  }
  fetch(item) {
    const station = this.venue.stations[item];
    if (this.status !== "playing" || !station) return false;
    const c = this.coach;
    if (c.carry) {
      this.emit("toast", {
        text: "Hands full. Deliver your " + names[c.carry] + " or return it to its station.",
      });
      return false;
    }
    if (distance(c, station) > T.reach)
      return this.guideTo(
        station,
        "Walk to the " + (item === "fins" ? "fin rack" : names[item] + " station") + " and press E.",
      );
    if (!this.canInteract()) return false;
    if (item === "fins" && this.finsAvailable === 0) {
      this.emit("toast", { text: "No fins left. Pick up a dropped pair from the deck.", warning: true });
      return false;
    }
    if (item === "fins") this.finsAvailable--;
    c.carry = item;
    c.carryOwner = null;
    this.feedback();
    return true;
  }
  returnItem() {
    const c = this.coach;
    if (!c.carry || this.status !== "playing") return false;
    const point = this.venue.stations[c.carry === "goggles" ? "relief" : c.carry];
    if (distance(c, point) > T.reach)
      return this.guideTo(
        point,
        "Return to the " + (c.carry === "fins" ? "fin rack" : "station") + " and press E.",
      );
    if (!this.canInteract()) return false;
    if (c.carry === "fins") this.finsAvailable++;
    if (c.carry === "goggles") {
      const p = this.get(c.carryOwner);
      if (p && p.problem === "goggles") {
        return this.guideTo(
          this.servicePoint(p),
          p.name + " still needs these goggles at the starting-block end.",
        );
      }
    }
    c.carry = null;
    c.carryOwner = null;
    this.feedback();
    return true;
  }
  deliver(id) {
    const p = this.get(id),
      c = this.coach;
    if (!p || !c.carry || this.status !== "playing") return false;
    if (c.carry === "chlorine") return this.deliverWater(p.lane ?? 1);
    if (!["queue", "enter", "swim"].includes(p.status)) {
      this.emit("toast", { text: "They have already left. Return the item to its station." });
      return false;
    }
    if (c.carry === "fins" && (!p.needsFins || p.hasFins)) {
      this.emit("toast", { text: p.name + " does not need fins." });
      return false;
    }
    if (c.carry === "relief" && p.problem !== "eyes") {
      this.emit("toast", { text: p.name + " does not need eye relief." });
      return false;
    }
    if (c.carry === "goggles" && (p.id !== c.carryOwner || p.problem !== "goggles")) {
      this.emit("toast", {
        text: "These goggles belong to " + (this.get(c.carryOwner)?.name || "another swimmer") + ".",
      });
      return false;
    }
    if (!this.swimmerInReach(p)) {
      const point = this.servicePoint(p);
      return this.guideTo(
        point,
        p.status === "swim"
          ? "Meet " +
              p.name +
              (p.lane === 1 ? " at either end" : " along their side or either end") +
              " and press E."
          : "Move next to " + p.name + " and press E.",
      );
    }
    if (!this.canInteract()) return false;
    const item = c.carry;
    if (item === "fins") {
      p.hasFins = true;
      if (p.problem === "fins") p.problem = null;
    } else if (item === "relief") {
      p.problem = null;
      p.irritation = 0;
      p.eyeCooldown = 22;
      p.h = Math.min(100, p.h + 10);
    } else if (item === "goggles") {
      p.problem = null;
      p.h = Math.min(100, p.h + 8);
    }
    c.carry = null;
    c.carryOwner = null;
    this.feedback("handoff", { id: p.id, item, to: { x: p.x, z: p.z } });
    return true;
  }
  deliverWater(lane) {
    const c = this.coach;
    if (c.carry !== "chlorine" || this.status !== "playing") return false;
    if (this.closed) {
      this.emit("toast", { text: "The cleanup crew is treating the water. Keep your bucket." });
      return false;
    }
    const point = this.waterPoint();
    if (distance(c, point) > 1.55)
      return this.guideTo(
        { x: this.lanes[lane] + 1.15, z: ENTRY.serviceZ },
        "Walk to the pool edge and press E to pour.",
      );
    if (!this.canInteract()) return false;
    this.contamination = Math.max(0, this.contamination - 46);
    this.chlorine = Math.min(120, this.chlorine + 37);
    c.carry = null;
    this.feedback("splash", point);
    this.emit("toast", {
      text:
        this.chlorine > 75
          ? "That is a lot of chlorine. Watch for sore eyes."
          : "Fresh water. Nicely done, coach!",
      warning: this.chlorine > 75,
    });
    return true;
  }
  pickup(id) {
    const c = this.coach,
      f = this.clutter.find((f) => f.id === id);
    if (!f || c.carry || !this.canInteract()) return false;
    if (distance(c, f) > 1.45) return this.guideTo(f, "Walk to the dropped gear and press E.");
    this.clutter = this.clutter.filter((a) => a !== f);
    c.carry = f.type;
    c.carryOwner = f.owner ?? null;
    this.feedback();
    return true;
  }
  tidy() {
    if (this.status !== "playing") return false;
    if (this.coach.carry) {
      this.emit("toast", { text: "Deliver or return your item before picking up more." });
      return false;
    }
    const f = [...this.clutter].sort((a, b) => distance(this.coach, a) - distance(this.coach, b))[0];
    if (!f) {
      this.emit("toast", { text: "The deck is spotless. Nice work!" });
      return false;
    }
    return this.pickup(f.id);
  }
  assist() {
    const p = this.get(this.selected);
    if (this.status !== "playing" || !p) return false;
    if (p.problem === "goggles") {
      if (this.coach.carry === "goggles") return this.deliver(p.id);
      const f = this.clutter.find((f) => f.owner === p.id);
      if (f)
        return this.guideTo(
          f,
          "Pick up " + p.name + "’s goggles, then return them at either end or beside their outer lane.",
        );
      return false;
    }
    if (p.problem !== "cramp") {
      this.emit("toast", { text: "Select a swimmer with cramp or lost goggles." });
      return false;
    }
    if (this.coach.carry) {
      this.emit("toast", { text: "Free your hands to assist " + p.name + "." });
      return false;
    }
    if (!this.swimmerInReach(p))
      return this.guideTo(this.servicePoint(p), "Meet " + p.name + " at the starting-block end and press E.");
    if (!this.canInteract()) return false;
    p.problem = null;
    p.h = Math.min(100, p.h + 12);
    this.feedback("helped", { id: p.id });
    return true;
  }
}
