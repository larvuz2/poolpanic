import { prepareDeck, resolveDeck, deckHeading } from "./deck-physics.mjs";
import { RescueController, waitingInWater } from "./rescue.mjs";
import { ENTRY, VENUES, createCoach } from "./spatial.mjs";
export { LANES, STATIONS } from "./spatial.mjs";
export const TYPES = {
  beginner: { label: "Beginner", color: "#71ba54", speed: 0.55, icon: "🐢" },
  intermediate: { label: "Intermediate", color: "#4c97e9", speed: 1, icon: "🏊" },
  advanced: { label: "Pro", color: "#f26857", speed: 1.5, icon: "⚡" },
  aqua: { label: "Aqua aerobics", color: "#b782db", speed: 0, icon: "💦" },
};
export const SHIFTS = [
  {
    name: "Morning dip",
    duration: 30,
    total: 4,
    thresholds: [150, 300, 400],
    finChance: 0,
    workoutSeconds: 8,
    closingPenalty: 0,
  },
  { name: "Lunch rush", duration: 60, total: 8, thresholds: [600, 1000, 1400] },
  { name: "Peak panic", duration: 90, total: 14, thresholds: [1100, 1800, 2500] },
  { name: "Fin club", duration: 120, total: 20, thresholds: [1800, 2900, 3800], finChance: 0.55 },
  { name: "Aqua hour", duration: 120, total: 21, thresholds: [1800, 2900, 3900], mix: [0.18, 0.43, 0.6] },
  { name: "Fast company", duration: 120, total: 22, thresholds: [2000, 3100, 4200], mix: [0.19, 0.43, 0.9] },
  {
    name: "Mixed company",
    duration: 135,
    total: 23,
    thresholds: [2100, 3300, 4500],
    mix: [0.36, 0.53, 0.78],
  },
  { name: "The relay", duration: 135, total: 24, thresholds: [2200, 3500, 4700], finChance: 0.52 },
  {
    name: "Championship day",
    duration: 150,
    total: 26,
    thresholds: [2300, 3700, 5000],
    mix: [0.21, 0.47, 0.86],
    finChance: 0.44,
  },
  {
    name: "Pool legend",
    duration: 150,
    total: 27,
    thresholds: [2400, 3900, 5300],
    mix: [0.27, 0.49, 0.77],
    finChance: 0.5,
  },
];
export const CIRCUIT = 31.2;
const NAMES = [
  "Pip",
  "Coco",
  "Gus",
  "Bea",
  "Otto",
  "Milo",
  "Nell",
  "Dot",
  "Remy",
  "Winnie",
  "Bo",
  "Lulu",
  "Finn",
  "Kit",
  "Teddy",
  "Mo",
  "Ziggy",
  "Nico",
  "Polly",
  "Mabel",
  "Alfie",
  "Lou",
  "Sunny",
  "Ivy",
  "Rory",
  "Olive",
  "Theo",
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function loopPosition(p, center = 0) {
  p = ((p % CIRCUIT) + CIRCUIT) % CIRCUIT;
  if (p < 14.4) return { x: center + 0.6, z: -7.2 + p, angle: 0 };
  if (p < 15.6) return { x: center + 0.6 - (p - 14.4), z: 7.2, angle: -Math.PI / 2 };
  if (p < 30) return { x: center - 0.6, z: 7.2 - (p - 15.6), angle: Math.PI };
  return { x: center - 0.6 + (p - 30), z: -7.2, angle: Math.PI / 2 };
}
export class PoolSimulation extends RescueController {
  constructor(level = 1, seed = Date.now(), options = {}) {
    const lvl = Math.max(1, Math.min(SHIFTS.length, Math.floor(level) || 1));
    const venue =
      typeof options.venue === "object"
        ? options.venue
        : VENUES[options.venue || SHIFTS[lvl - 1].venue || "club"];
    super(venue);
    this.level = lvl;
    this.difficulty = Math.min(3, this.level);
    this.config = SHIFTS[this.level - 1];
    this.seed = seed >>> 0;
    this.time = 0;
    this.arrivalTime = 0;
    this.cleanup = null;
    this.waterBrown = 0;
    this.status = "ready";
    this.people = [];
    this.events = [];
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.selected = null;
    this.contamination = 3;
    this.chlorine = 44;
    this.closed = 0;
    this.doors = { "-1": 0, 1: 0 };
    this.finsAvailable = 3;
    this.clutter = [];
    this.uid = 0;
    this.coach = createCoach(this.venue);
    this.stats = {
      served: 0,
      happy: 0,
      angry: 0,
      lost: 0,
      collisions: 0,
      prevented: 0,
      catastrophes: 0,
      totalWait: 0,
      totalHappiness: 0,
    };
    this.schedule = this.director();
    this.nextArrival = 0;
    this.warnedWater = false;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  director() {
    if (this.level === 1)
      return ["beginner", "intermediate", "beginner", "intermediate"].map((type, i) => ({
        at: this.venue.arrival.firstDelay + i * 3,
        type,
        sick: false,
      }));
    const n = this.config.total,
      span = this.config.duration - 30;
    return Array.from({ length: n }, (_, i) => ({
      at:
        this.venue.arrival.firstDelay +
        (i === 0 ? 0 : Math.max(2, (i * span) / (n - 1) + (this.random() - 0.5) * 3)),
      type:
        i === 0
          ? "beginner"
          : i === 1
            ? "intermediate"
            : i === 2
              ? "advanced"
              : i === Math.floor(n * 0.45)
                ? "aqua"
                : null,
      sick: this.level >= 3 && i >= 2 && i < n - 2 && this.random() < 0.2,
    })).sort((a, b) => a.at - b.at);
  }
  start({ countdown = false } = {}) {
    this.countdown = countdown ? 3 : 0;
    this.status = countdown ? "countdown" : "playing";
    if (countdown) this.emit("countdown", { value: 3 });
  }
  spawn(spec = {}) {
    const r = this.random();
    const mix = this.config.mix || [0.29, 0.6, 0.83];
    const type =
      spec.type || (r < mix[0] ? "beginner" : r < mix[1] ? "intermediate" : r < mix[2] ? "advanced" : "aqua");
    const index = this.people.length;
    const side = index % 2 === 0 ? -1 : 1;
    const occupied = new Set(
      this.people
        .filter((p) => ["queue", "arriving"].includes(p.status) && p.side === side)
        .map((p) => p.queueSlot),
    );
    let q = 0;
    while (occupied.has(q)) q++;
    const sick = this.level >= 3 && (spec.sick ?? (index > 2 && this.random() < 0.08));
    const need =
      type !== "aqua" &&
      index > 2 &&
      this.random() < (this.config.finChance ?? (this.level === 1 ? 0.24 : 0.38));
    const p = {
      id: ++this.uid,
      name: NAMES[(index + Math.floor(this.random() * 5)) % NAMES.length],
      type,
      side,
      status: "queue",
      ...this.venue.queuePosition(side, q),
      queueSlot: q,
      angle: 0,
      h: 100,
      wait: 0,
      waitLimit: 32 - this.difficulty * 2 + this.random() * 8,
      lane: null,
      path: [],
      p: 0,
      traveled: 0,
      workTime: 0,
      workTarget: type === "aqua" ? 23 + this.random() * 7 : CIRCUIT,
      desiredSpeed: TYPES[type].speed * 2.6,
      actualSpeed: 0,
      blocked: 0,
      slowTime: 0,
      collisionTime: 0,
      collisionCooldown: 0,
      hadCollision: false,
      sick,
      queasy: false,
      stomachWarning: false,
      stomachDelay: 3 + this.random() * 4,
      stomachElapsed: 0,
      sicknessTimer: 10,
      sicknessDuration: 10,
      needsFins: need,
      midFins: need && this.level > 1 && this.random() < 0.62,
      hasFins: false,
      problem: null,
      irritation: 0,
      chlorineTolerance: 63 + this.random() * 15,
      eyeCooldown: 0,
      skin: Math.floor(this.random() * 5),
      shape: this.random(),
      phase: this.random() * 6.28,
      assignedAt: null,
      slipTime: 0,
      stunned: 0,
      complained: false,
      stationary: 0,
      crampDone: false,
    };
    p.crampAt =
      this.level >= 2 && ((this.level === 2 && index === 1) || p.shape < 0.25)
        ? 9 + (p.phase / 6.28) * 4
        : Infinity;
    if (spec.entrance) {
      const door = this.venue.arrival;
      p.status = "arriving";
      p.queueTarget = { x: p.x, z: p.z };
      p.x = side * door.insideX;
      p.z = door.doorZ;
      p.arrivalHold = door.hold;
      p.path = [{ x: side * door.outsideX, z: door.doorZ }, p.queueTarget];
      this.keepDoorOpen(side);
      this.emit("door-open", { side, x: side * door.doorX, z: door.doorZ });
    }
    this.people.push(p);
    this.emit("spawn", { id: p.id });
    if (type === "aqua" && !this.aquaIntro) {
      this.aquaIntro = true;
      this.emit("toast", { text: "Aqua aerobics stays in place. Give the class some space." });
    }
    return p;
  }
  get(id) {
    return this.people.find((p) => p.id === id);
  }
  get lanes() {
    return this.venue.lanes;
  }
  isDeck(x, z) {
    return this.venue.isDeck(x, z, this.level);
  }
  lanePeople(i) {
    return this.people.filter((p) => p.lane === i && p.status === "swim");
  }
  occupancy(i) {
    return this.people.filter((p) => p.lane === i && (p.status === "swim" || p.status === "enter")).length;
  }
  multiplier() {
    return this.streak >= 8 ? 2 : this.streak >= 5 ? 1.5 : this.streak >= 3 ? 1.2 : 1;
  }
  select(id) {
    const p = this.get(id);
    if (!p || p.status === "gone" || p.status === "exit" || p.status === "arriving") return;
    this.selected = id;
    this.emit("select", { id });
  }
  walk(p, target, mode = "enter") {
    p.status = mode;
    const side = Math.sign(p.x) || p.side || 1;
    p.path =
      p.z <= ENTRY.walkZ
        ? [{ x: p.x, z: ENTRY.walkZ }, { x: target.x, z: ENTRY.walkZ }, target]
        : [
            { x: side * this.venue.pool.corridorX, z: p.z },
            { x: side * this.venue.pool.corridorX, z: ENTRY.walkZ },
            { x: target.x, z: ENTRY.walkZ },
            target,
          ];
  }

  assign(lane) {
    if (!Number.isInteger(lane) || lane < 0 || lane >= this.lanes.length) return false;
    if (this.status !== "playing") return false;
    if (this.rescue) {
      this.emit("toast", { text: "Rescue in progress. Get the swimmer safely out first." });
      return false;
    }
    if (this.closed > 0) {
      this.emit("toast", { text: "Pool is closed. Keep an eye on the waiting swimmers.", warning: true });
      return false;
    }
    const p = this.get(this.selected);
    if (this.coach.carry === "chlorine" && p?.status !== "queue") {
      return this.deliverWater(lane);
    }
    if (!p || p.status !== "queue") {
      this.emit("toast", { text: "Pick a waiting swimmer first, then choose a lane." });
      return false;
    }
    p.lane = lane;
    p.assignedAt = this.time;
    p.p = 30;
    this.stats.totalWait += p.wait;
    this.walk(p, { x: this.lanes[lane] + 0.6, z: ENTRY.edgeZ });
    this.emit("assigned", { id: p.id, lane });
    this.selected = null;
    return true;
  }
  home() {
    if (this.status !== "playing") return;
    const p = this.get(this.selected);
    if (!p || !["queue", "enter", "swim"].includes(p.status)) return;
    if (p.problem === "cramp") {
      this.assist();
      return;
    }
    if (this.rescue && p.status === "swim") return;
    if (p.sick) {
      this.score += 100;
      this.stats.prevented++;
      this.emit("toast", { text: "Good catch! Prevention bonus +100" });
      this.emit("points", { x: p.x, z: p.z, value: 100 });
    } else {
      this.score -= 50;
      this.emit("toast", { text: p.name + " was healthy. Wrongful ejection −50", warning: true });
    }
    if (p.status === "swim") this.evacuatePerson(p, true);
    else this.depart(p, false);
    this.selected = null;
  }
  keepDoorOpen(side) {
    const remaining = this.doors[side];
    this.doors[side] =
      remaining < 0.45 ? this.venue.arrival.doorDuration - (remaining / 0.45) * 0.3 : Math.max(1, remaining);
  }
  returnRoute(side) {
    const door = this.venue.arrival;
    return [
      { x: side * door.outsideX, z: door.doorZ },
      { x: side * door.insideX, z: door.doorZ },
    ];
  }
  depart(p, served = true) {
    const fromQueue = p.status === "queue";
    const fromWater = p.status === "swim";
    if (!fromWater) this.dropFins(p);
    p.problem = null;
    if (served) {
      this.stats.served++;
      this.stats.totalHappiness += Math.max(0, p.h);
      let points = 100;
      if (p.h >= 70) {
        points += 50;
        this.stats.happy++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
      } else if (p.h < 30) {
        this.stats.angry++;
        points -= 25;
        this.streak = 0;
      } else this.streak = 0;
      if (p.wait < 8) points += 20;
      if (!p.hadCollision) points += 20;
      if (p.slowTime < 3) points += 25;
      const others = this.lanePeople(p.lane).filter((a) => a !== p);
      if (others.every((a) => a.type === p.type)) points += 25;
      points = Math.round(points * this.multiplier());
      this.score += points;
      this.emit("points", { x: p.x, z: p.z, value: points });
      this.emit("served", { happy: p.h >= 70, id: p.id });
    }
    p.status = "exit";
    if (fromWater) this.beginWaterExit(p);
    else
      p.path = fromQueue
        ? this.returnRoute(p.side)
        : [{ x: p.side * this.venue.pool.corridorX, z: p.z }, ...this.returnRoute(p.side)];
    p.lane = null;
    if (this.selected === p.id) this.selected = null;
  }
  dropFins(p) {
    if (!p.hasFins) return;
    p.hasFins = false;
    this.clutter.push({ id: ++this.uid, type: "fins", x: p.x, z: p.z });
    this.emit("drop", { x: p.x, z: p.z });
  }
  beginWaterExit(p) {
    // Finish in the water at the nearer end, then climb out beside the blocks.
    const P = this.venue.pool;
    p.exitEnd = p.z >= 0 ? 1 : -1;
    p.exitPhase = "water";
    p.exitProgress = 0;
    const x = this.lanes[p.lane ?? 1] + 1.15;
    p.path = [
      { x: p.x, z: p.exitEnd * P.turnZ },
      { x, z: p.exitEnd * P.turnZ },
      { x, z: p.exitEnd * P.climbZ },
    ];
    p.bumpTime = 0;
    p.slipTime = 0;
  }
  tickWaterExit(p, dt) {
    if (p.status !== "exit" || !["water", "climb"].includes(p.exitPhase)) return false;
    if (p.exitPhase === "water") {
      p.actualSpeed = Math.max(1.6, p.desiredSpeed || 2.1);
      if (this.moveAlong(p, dt, p.actualSpeed)) {
        p.exitPhase = "climb";
        p.exitProgress = 0;
        p.angle = p.exitEnd > 0 ? 0 : Math.PI;
      }
    } else {
      const P = this.venue.pool;
      p.exitProgress = Math.min(1, p.exitProgress + dt / 0.65);
      const t = p.exitProgress * p.exitProgress * (3 - 2 * p.exitProgress);
      p.z = p.exitEnd * (P.climbZ + (P.endWalkZ - P.climbZ) * t);
      if (p.exitProgress === 1) {
        p.exitPhase = "deck";
        p.actualSpeed = 0;
        if (p.rescueRecover) {
          this.rescueOnDeck(p);
          return true;
        }
        this.dropFins(p);
        p.stunned = Math.max(p.stunned || 0, 1);
        // Reach the outside corner first, then follow the long side back to the locker.
        p.path = [
          { x: p.side * P.corridorX, z: p.exitEnd * P.endWalkZ },
          { x: p.side * P.corridorX, z: this.venue.arrival.doorZ },
          ...this.returnRoute(p.side),
        ];
        this.emit("splash", { x: p.x, z: p.exitEnd * P.climbZ });
      }
    }
    return true;
  }
  lose(p) {
    this.score -= 100;
    this.stats.lost++;
    this.streak = 0;
    this.emit("toast", { text: p.name + " lost patience. Customer lost −100", warning: true });
    if (p.status === "swim") {
      this.depart(p, false);
      return;
    }
    if (p.hasFins) {
      p.hasFins = false;
      this.clutter.push({ id: ++this.uid, type: "fins", x: p.x, z: p.z });
      this.emit("drop", { x: p.x, z: p.z });
    }
    p.status = "exit";
    p.path = this.returnRoute(p.side);
    p.lane = null;
    if (this.selected === p.id) this.selected = null;
  }
  moveAlong(entity, dt, speed) {
    if (!entity.path.length) return true;
    // Shared corners are approach zones, not single points every body must occupy.
    if (
      entity.path.length > 1 &&
      Math.hypot(entity.path[0].x - entity.x, entity.path[0].z - entity.z) <
        (entity.path[0].z === this.venue.arrival.doorZ ? 0.08 : 0.58)
    )
      entity.path.shift();
    const target = entity.path[0],
      dx = target.x - entity.x,
      dz = target.z - entity.z,
      dist = Math.hypot(dx, dz);
    entity.angle = Math.atan2(dx, dz);
    if (dist <= speed * dt) {
      entity.x = target.x;
      entity.z = target.z;
      entity.path.shift();
    } else {
      const heading = deckHeading(this, entity, dx / dist, dz / dist);
      let x = entity.x + heading.x * speed * dt,
        z = entity.z + heading.z * speed * dt;
      // A passing sidestep on the return route must also stay outside the water.
      const P = this.venue.pool;
      if (
        (entity.exitPhase === "deck" || (entity.status === "enter" && entity.path.length > 1)) &&
        Math.abs(x) < P.keepOutX &&
        Math.abs(z) < P.keepOutZ
      ) {
        if (Math.abs(entity.x) >= P.keepOutX) x = Math.sign(entity.x) * P.keepOutX;
        else z = Math.sign(entity.z) * P.keepOutZ;
      }
      entity.x = x;
      entity.z = z;
    }
    return entity.path.length === 0;
  }

  tickDeckTrip(p, dt) {
    p.annoyedTime = Math.max(0, (p.annoyedTime || 0) - dt);
    if (
      !["enter", "exit", "arriving", "recovering", "evacuating"].includes(p.status) ||
      p.evacWater ||
      p.recoveryStage === "resting" ||
      ["water", "climb"].includes(p.exitPhase) ||
      p.arrivalHold > 0
    )
      return false;
    if (p.slipTime > 0) {
      p.slipTime = Math.max(0, p.slipTime - dt);
      return true;
    }
    p.stunned = Math.max(0, (p.stunned || 0) - dt);
    if (!p.stunned && this.clutter.some((f) => f.type === "fins" && Math.hypot(p.x - f.x, p.z - f.z) < 0.6)) {
      p.slipTime = 0.65;
      p.stunned = 3;
      p.annoyedTime = 0.85;
      p.deckPenalty = (p.deckPenalty || 0) + 6;
      p.h = Math.max(0, p.h - 6);
      this.emit("slip", { id: p.id, x: p.x, z: p.z });
      return true;
    }
    return false;
  }
  tick(dt) {
    dt = Math.min(Math.max(0, dt), 0.1);
    if (this.status === "countdown") {
      const before = Math.ceil(this.countdown);
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 0.000001) {
        this.countdown = 0;
        this.status = "playing";
        this.emit("go");
      } else if (Math.ceil(this.countdown) !== before)
        this.emit("countdown", { value: Math.ceil(this.countdown) });
      return;
    }
    if (this.status !== "playing") return;
    this.time += this.cleanup ? 0 : dt;
    this.arrivalTime += dt;
    for (const side of [-1, 1]) this.doors[side] = Math.max(0, this.doors[side] - dt);
    while (this.nextArrival < this.schedule.length && this.arrivalTime >= this.schedule[this.nextArrival].at)
      this.spawn({ ...this.schedule[this.nextArrival++], entrance: true });
    this.updateRescue();
    prepareDeck(this, dt);
    this.updateCoach(dt);
    this.updateSanitation(dt);
    for (const p of this.people) {
      if (waitingInWater(this, p) || (this.rescue && p.status === "enter")) continue;
      if (
        this.tickDeckTrip(p, dt) ||
        this.tickRecovery(p, dt) ||
        this.tickWaterExit(p, dt) ||
        this.tickEvacuation(p, dt)
      )
        continue;
      p.eyeCooldown = Math.max(0, p.eyeCooldown - dt);
      p.collisionCooldown = Math.max(0, p.collisionCooldown - dt);
      if (p.status === "arriving") {
        if (p.arrivalHold > 0) p.arrivalHold = Math.max(0, p.arrivalHold - dt);
        else if (this.moveAlong(p, dt, this.venue.arrival.walkSpeed)) {
          p.status = "queue";
          p.angle = 0;
          this.emit("arrived", { id: p.id });
        }
      } else if (p.status === "queue") {
        p.wait += dt;
        p.h = clamp(100 - (p.wait / p.waitLimit) * 100 - (p.deckPenalty || 0), 0, 100);
        if (p.h <= 0) this.lose(p);
      } else if (p.status === "enter" || p.status === "exit") {
        if (
          p.status === "exit" &&
          Math.hypot(p.x - p.side * this.venue.arrival.doorX, p.z - this.venue.arrival.doorZ) < 2.4
        )
          this.keepDoorOpen(p.side);
        if (this.moveAlong(p, dt, p.status === "exit" ? 4.5 : 3.3)) {
          if (p.status === "exit") {
            p.status = "gone";
            this.emit("gone", { id: p.id });
          } else {
            p.status = "swim";
            if (!p.resumingWorkout) p.workTime = 0;
            else if (this.chlorine > 75 && this.chlorine > p.chlorineTolerance && !p.problem) {
              p.problem = "eyes";
              p.irritation = 10;
            }
            p.resumingWorkout = false;
            const lane = this.lanePeople(p.lane);
            let candidate = 30;
            for (let n = 0; n < lane.length; n++) {
              if (
                lane.some(
                  (a) =>
                    a !== p &&
                    Math.min((a.p - candidate + CIRCUIT) % CIRCUIT, (candidate - a.p + CIRCUIT) % CIRCUIT) <
                      1.1,
                )
              )
                candidate = (candidate + 1.5) % CIRCUIT;
            }
            p.p = candidate;
            if (p.needsFins && !p.midFins && !p.hasFins) p.problem = "fins";
            this.emit("splash", { x: p.x, z: ENTRY.waterZ });
          }
        }
      }
    }
    resolveDeck(this);
    for (let i = 0; i < this.lanes.length; i++) this.updateLane(i, dt);
    if (this.closed === 0) {
      const swimmers = this.people.filter((p) => p.status === "swim").length;
      this.contamination = clamp(
        this.contamination +
          swimmers * dt * (0.14 + this.difficulty * 0.025) -
          dt * Math.max(0, this.chlorine - 25) * 0.005,
        0,
        100,
      );
      this.chlorine = Math.max(0, this.chlorine - dt * (0.055 + swimmers * 0.012));
      if (this.contamination > 48 && !this.warnedWater) {
        this.warnedWater = true;
        this.emit("toast", { text: "The water is getting cloudy. Time for a chlorine run.", warning: true });
      }
      if (this.contamination < 30) this.warnedWater = false;
    }
    if (this.time >= this.config.duration && !this.cleanup) {
      this.status = "ended";
      for (const p of this.people) {
        if (["swim", "enter", "queue", "arriving", "evacuating", "panic", "recovering"].includes(p.status)) {
          this.stats.lost++;
          this.score -= this.config.closingPenalty ?? 100;
          p.status = "gone";
        }
      }
      this.emit("ended");
    }
  }
  updateLane(i, dt) {
    if (this.rescue) return;
    const swimmers = this.lanePeople(i);
    if (!swimmers.length) return;
    const n = swimmers.length,
      laps = swimmers.filter((p) => p.type !== "aqua"),
      aqua = swimmers.filter((p) => p.type === "aqua");
    const circle = n >= 3;
    const ordered = [...laps].sort((a, b) => a.p - b.p);
    const desired = new Map();
    for (const p of laps) {
      let speed = p.desiredSpeed * (p.hasFins ? 1.3 : 1);
      if (p.problem) speed = p.p >= 29.9 || p.p <= 0.1 ? 0 : 1.9;
      if (p.collisionTime > 0) speed = 0;
      const pos = loopPosition(p.p, this.lanes[i]);
      if (aqua.length && Math.abs(pos.z) < 2.1 + aqua.length * 0.2) speed = Math.min(speed, 0.55);
      desired.set(p.id, speed);
    }
    // Propagate every restriction around the circle; movement is computed from a shared snapshot.
    const actual = new Map(desired);
    if (circle && laps.length > 1) {
      for (let pass = 0; pass < laps.length; pass++) {
        for (let k = 0; k < ordered.length; k++) {
          const p = ordered[k],
            ahead = ordered[(k + 1) % ordered.length];
          const gap = (ahead.p - p.p + CIRCUIT) % CIRCUIT;
          const limit = gap < 2 ? actual.get(ahead.id) : Math.max(0, (gap - 1.1) / dt);
          actual.set(p.id, Math.min(actual.get(p.id), limit));
        }
      }
    }
    for (const p of swimmers) {
      p.workTime += dt;
      this.tickStomach(p, dt);
      if (this.cleanup) return;
      p.collisionTime = Math.max(0, p.collisionTime - dt);
      if (p.type === "aqua") {
        const idx = aqua.indexOf(p);
        p.x = this.lanes[i] + (idx % 2 ? -0.55 : 0.55);
        const targetZ = p.problem ? ENTRY.waterZ : -1.5 + Math.floor(idx / 2) * 1.2;
        p.z += clamp(targetZ - p.z, -dt * 2.4, dt * 2.4);
        p.actualSpeed = 0;
        p.angle = 0;
        if (laps.length) p.h -= dt * 0.5;
      } else {
        p.actualSpeed = actual.get(p.id);
        const desiredSpeed = p.desiredSpeed * (p.hasFins ? 1.3 : 1);
        const deficit = Math.max(0, desiredSpeed - p.actualSpeed);
        if (deficit > 0.35 && !p.problem) {
          p.blocked += dt;
          p.slowTime += dt;
          p.h -= dt * deficit * (0.58 + this.difficulty * 0.06);
          if (p.blocked > 2.5 && !p.complained) {
            p.complained = true;
            this.emit("blocked", { id: p.id, lane: i });
          }
        } else {
          p.blocked = Math.max(0, p.blocked - dt);
          if (p.blocked < 0.2) p.complained = false;
        }
        if (circle && p.blocked > 4 && p.collisionCooldown === 0 && deficit > 1) {
          const k = ordered.indexOf(p),
            ahead = ordered[(k + 1) % ordered.length];
          if (ahead && ahead !== p && (ahead.p - p.p + CIRCUIT) % CIRCUIT < 2.05) {
            p.collisionTime = 1.1;
            ahead.collisionTime = 0.8;
            p.collisionCooldown = 10;
            this.stats.collisions++;
            this.score -= 50;
            p.h -= 10;
            ahead.h -= 8;
            p.hadCollision = true;
            this.emit("collision", { x: p.x, z: p.z, id: p.id });
            if (this.level > 1 && !p.problem && this.random() < 0.26) {
              p.problem = "goggles";
              this.clutter.push({
                id: ++this.uid,
                type: "goggles",
                owner: p.id,
                x: this.lanes[i],
                z: ENTRY.dropZ,
              });
              this.emit("toast", {
                text: p.name + " lost their goggles. Bring them help at the starting-block end.",
                warning: true,
              });
            }
          }
        }
        p.p = (p.p + p.actualSpeed * dt) % CIRCUIT;
        p.traveled += p.problem ? 0 : p.actualSpeed * dt;
        let pos = loopPosition(p.p, this.lanes[i]);
        if (!circle) {
          pos.x = this.lanes[i] + (laps.indexOf(p) === 0 ? -0.65 : 0.65);
          if (n === 1) pos.x = this.lanes[i];
        }
        p.x = pos.x;
        p.z = pos.z;
        p.angle = pos.angle;
        if (p.needsFins && p.midFins && !p.hasFins && p.traveled >= 15.6 && !p.problem) {
          p.problem = "fins";
          this.emit("toast", {
            text: p.name + " finished a lap and needs fins. Meet them at the starting-block end with a pair!",
            warning: true,
          });
        }
      }
      if (this.chlorine > p.chlorineTolerance && p.eyeCooldown === 0) {
        p.irritation += dt * (this.chlorine - p.chlorineTolerance) * 0.14;
        if (p.irritation > 10 && !p.problem) {
          p.problem = "eyes";
          this.emit("toast", { text: p.name + " has sore eyes. Fetch eye relief.", warning: true });
        }
      } else p.irritation = Math.max(0, p.irritation - dt * 0.8);
      const crowd = Math.max(0, n - (p.type === "beginner" ? 3 : 4));
      p.h -= dt * (crowd * 0.5 + Math.max(0, this.contamination - 35) * 0.025 + (p.problem ? 1.6 : 0));
      if (p.type === "beginner" && swimmers.some((s) => s.type === "advanced")) p.h -= dt * 0.25;
      p.h = clamp(p.h, 0, 100);
      if (p.h <= 0) {
        this.lose(p);
        continue;
      }
      if (
        !p.problem &&
        !p.stomachWarning &&
        (this.config.workoutSeconds
          ? p.workTime >= this.config.workoutSeconds
          : (p.type === "aqua" && p.workTime >= p.workTarget) ||
            (p.type !== "aqua" && p.traveled >= p.workTarget && p.workTime > 12))
      )
        this.depart(p, true);
    }
  }
  summary() {
    const stars = this.config.thresholds.filter((t) => this.score >= t).length;
    return {
      ...this.stats,
      score: this.score,
      stars,
      bestStreak: this.bestStreak,
      avgWait: this.people.filter((p) => p.assignedAt !== null).length
        ? this.stats.totalWait / this.people.filter((p) => p.assignedAt !== null).length
        : 0,
      avgHappiness: this.stats.served ? this.stats.totalHappiness / this.stats.served : 0,
    };
  }
}
