// Chaos layer: a seeded per-shift incident schedule, visiting characters (kids, dogs, cannonballers), deck
// hazards, fleeing swimmers and shared reopen/hint/panel plumbing. Each incident lives in its own module under
// incidents/ and plugs into the hooks below, so systems stay small and never reach into each other.
import { RescueController, waitingInWater } from "./rescue.mjs";
import { ENTRY } from "./spatial.mjs";
import { FishKid } from "./incidents/fish.mjs";
import { LooseDog } from "./incidents/dog.mjs";
import { CannonballCarl } from "./incidents/carl.mjs";
import { PowerOutage } from "./incidents/outage.mjs";
import { planTwists, startTwist } from "./incidents/twist.mjs";
import {
  Trampoline,
  tickJumper,
  blockedLane,
  assignTrampoline,
  injuredOnDeck,
} from "./incidents/trampoline.mjs";

export const SYSTEMS = [PowerOutage, CannonballCarl, FishKid, LooseDog, Trampoline];

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Clicking incident gear: what it is for, and whether the coach should head there right now.
const FIXTURES = {
  fishNet: {
    needed: (s) => s.fish?.stage === "loose" || s.coach.carry === "fishnet",
    go: "Walk to the fish net and press E.",
    about: "The fish net. You will need it if a fish ever ends up in the pool.",
  },
  treats: {
    needed: (s) => !!s.dog || s.coach.carry === "treats",
    go: "Walk to the dog treats and press E.",
    about: "Dog treats. Handy if a dog ever wanders in.",
  },
  flashlight: {
    needed: (s) => s.outage?.stage === "dark" || s.coach.carry === "flashlight",
    go: "Walk to the flashlight and press E.",
    about: "The flashlight, for finding the breakers in a blackout.",
  },
  fuseBox: {
    needed: (s) => ["flicker", "dark"].includes(s.outage?.stage),
    go: "Run to the fuse box and press E.",
    about: "The fuse box. Reset it quickly if the lights start flickering.",
  },
  medkit: {
    needed: (s) => s.coach.carry === "medkit" || s.people.some((p) => p.status === "injured"),
    go: "Walk to the medical kit and press E.",
    about: "The medical kit, for swimmers hurt in a trampoline crash.",
  },
};

export class ChaosController extends RescueController {
  constructor(venue) {
    super(venue);
    this.visitors = [];
    this.hazards = [];
    this.chaosPlan = [];
    this.chaosSeed = 1;
    // Mid-shift twists: a lane taken out of service, and an override of who arrives next (see incidents/twist.mjs).
    this.laneClosure = -1;
    this.mixOverride = null;
    this.storm = null;
    this.systems = SYSTEMS;
    for (const system of this.systems) system.init?.(this);
  }
  // A separate random stream keeps swimmer generation identical whether or not a shift has chaos.
  chaosRandom() {
    this.chaosSeed = (Math.imul(this.chaosSeed, 1664525) + 1013904223) >>> 0;
    return this.chaosSeed / 4294967296;
  }
  planChaos() {
    this.chaosSeed = (this.seed ^ 0x9e3779b9) >>> 0 || 1;
    this.chaosPlan = (this.config.chaos || []).map((entry) => ({
      kind: entry.kinds[Math.floor(this.chaosRandom() * entry.kinds.length)],
      at: entry.window[0] + this.chaosRandom() * (entry.window[1] - entry.window[0]),
      done: false,
    }));
    this.chaosPlan.push(...planTwists(this.config));
  }
  system(key) {
    return this.systems.find((s) => s.key === key);
  }
  activeSystems() {
    return this.systems.filter((s) => s.isActive(this));
  }
  canStartChaos(system) {
    if (this.status !== "playing" || system.isActive(this)) return false;
    if (this.rescue || this.cleanup || this.closed) return false;
    if (this.activeSystems().length >= (this.config.maxChaos || 1)) return false;
    return system.canStart ? system.canStart(this) : true;
  }
  // Debug/QA and checks can trigger an incident directly.
  triggerChaos(key) {
    const system = this.system(key);
    if (!system || system.isActive(this)) return false;
    return system.start(this) !== false;
  }
  updateChaos(dt) {
    for (const entry of this.chaosPlan) {
      if (entry.done || this.arrivalTime < entry.at) continue;
      if (this.config.duration - this.time < 14) {
        entry.done = true;
        continue;
      }
      if (entry.kind === "twist") {
        // A twist waits out a rescue, a cleanup or a closed pool, but not for the incident cap: it is no incident.
        if (this.rescue || this.cleanup || this.closed) continue;
        entry.done = startTwist(this, entry);
        continue;
      }
      const system = this.system(entry.kind);
      if (!system || !this.canStartChaos(system)) {
        entry.at = this.arrivalTime + 2.5;
        continue;
      }
      entry.done = system.start(this) !== false;
    }
    for (const system of this.systems) system.update?.(this, dt);
    this.updateStorm(dt);
    this.updateHazards(dt);
  }
  finCount() {
    return super.finCount() + this.systems.reduce((sum, s) => sum + (s.finCount?.(this) || 0), 0);
  }
  clockHeld() {
    return !!this.cleanup || this.systems.some((s) => s.holdsClock?.(this));
  }
  chaosPanic() {
    return !!this.cleanup || !!this.rescue || this.systems.some((s) => s.panic?.(this));
  }
  // The whole crowd panics on the spot (a cannonball man is in the pool): the swimmers in the water stop where they are, with
  // nothing lost, and the swimmers and everyone waiting on the deck hop with their hands up until it is over. Pure presentation
  // for everyone but the swimmers in the water, who are held (heldInWater in rescue.mjs).
  crowdPanic() {
    return this.systems.some((s) => s.crowdPanic?.(this));
  }

  // ------------------------------------------------------------------------------------------------------
  // Visitors: characters who are not customers. They walk through the locker doors like everyone else.
  spawnVisitor(kind, extra = {}) {
    const side = extra.side ?? (this.chaosRandom() < 0.5 ? -1 : 1),
      door = this.venue.arrival;
    const v = {
      id: ++this.uid,
      visitor: true,
      kind,
      type: kind,
      side,
      x: side * door.insideX,
      z: door.doorZ,
      angle: -side * (Math.PI / 2),
      status: "entering",
      hold: 0.4,
      path: [{ x: side * door.outsideX, z: door.doorZ }],
      skin: Math.floor(this.chaosRandom() * 5),
      phase: this.chaosRandom() * 6.28,
      ...extra,
    };
    this.visitors.push(v);
    this.keepDoorOpen(side);
    this.emit("door-open", { side, x: side * door.doorX, z: door.doorZ });
    return v;
  }
  visitor(id) {
    return this.visitors.find((v) => v.id === id);
  }
  // Leave through the nearer locker door; the door opens as they reach it.
  sendVisitorHome(v, status = "leaving") {
    const door = this.venue.arrival,
      side = Math.abs(v.x + door.outsideX) < Math.abs(v.x - door.outsideX) ? -1 : 1;
    v.side = side;
    v.status = status;
    v.path = [...this.venue.route(v, { x: side * door.outsideX, z: door.doorZ }), ...this.returnRoute(side)];
  }
  // Advance a visitor along its path. Returns true on arrival. Removes visitors who went through a door.
  walkVisitor(v, dt, speed) {
    if (v.hold > 0) {
      v.hold = Math.max(0, v.hold - dt);
      return false;
    }
    const door = this.venue.arrival;
    if (Math.hypot(v.x - v.side * door.doorX, v.z - door.doorZ) < 2.4) this.keepDoorOpen(v.side);
    const arrived = this.moveAlong(v, dt, speed);
    const inside = Math.abs(v.z - door.doorZ) < 0.2 && Math.abs(Math.abs(v.x) - door.insideX) < 0.2;
    if (arrived && inside && ["leaving", "sulking", "happy", "carded"].includes(v.status)) {
      v.status = "gone";
      this.visitors = this.visitors.filter((a) => a !== v);
      this.emit("visitor-gone", { id: v.id, kind: v.kind });
    }
    return arrived;
  }
  pickEdgeSpot(avoid = null) {
    const spots = this.venue.edgeSpots().filter((s) => !avoid || distance(s, avoid) > 5);
    return spots[Math.floor(this.chaosRandom() * spots.length)] || this.venue.edgeSpots()[0];
  }

  // ------------------------------------------------------------------------------------------------------
  // Weather (the storm twist): how far the storm has come, 0..1, and the rain puddles it leaves on the deck. The
  // scene reads stormLevel() to darken the sky and start the rain.
  stormLevel() {
    return this.storm ? clamp((this.time - this.storm.start) / this.storm.ramp, 0, 1) : 0;
  }
  updateStorm(dt) {
    const st = this.storm;
    if (!st || this.stormLevel() < 0.7) return;
    st.next -= dt;
    if (st.next > 0) return;
    st.next = 2.6 + this.chaosRandom() * 1.8;
    if (this.hazards.filter((h) => h.rain).length >= 6) return;
    const d = this.venue.deck;
    // Half the puddles form where people walk to the water, the rest anywhere on the deck; never on top of the coach.
    for (let tries = 0; tries < 16; tries++) {
      const spot =
        this.chaosRandom() < 0.5
          ? this.pickEdgeSpot(this.coach)
          : {
              x: d.minX + this.chaosRandom() * (d.maxX - d.minX),
              z: d.minZ + this.chaosRandom() * (d.maxZ - d.minZ),
            };
      if (distance(spot, this.coach) < 2.2) continue;
      const puddle = this.addPuddle(spot.x, spot.z, 0.85, 14);
      if (puddle) {
        puddle.rain = true;
        return;
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------
  // Hazards: wet puddles that dry over time and trip anyone who walks across them.
  addPuddle(x, z, r = 0.9, life = 16) {
    if (!this.isDeck(x, z) && !this.venue.isDeck(x, z, this.level, 0)) return null;
    const puddle = { id: ++this.uid, kind: "puddle", x, z, r, life, maxLife: life };
    this.hazards.push(puddle);
    return puddle;
  }
  updateHazards(dt) {
    for (const h of this.hazards) h.life -= dt;
    this.hazards = this.hazards.filter((h) => h.life > 0);
  }
  slipperyAt(x, z, reach) {
    return (
      super.slipperyAt(x, z, reach) ||
      this.hazards.some(
        (h) => h.kind === "puddle" && Math.hypot(x - h.x, z - h.z) < h.r * Math.min(1, h.life / 3 + 0.4),
      )
    );
  }

  // ------------------------------------------------------------------------------------------------------
  // Fleeing: swimmers race to the nearest wall, leap onto the deck and run around in panicked circles.
  startFleeing(p) {
    const P = this.venue.pool;
    p.resumeLane = p.lane ?? p.resumeLane ?? this.nearestLane(p.x);
    p.lane = null;
    p.status = "fleeing";
    p.actualSpeed = 0;
    p.problem = p.problem === "cramp" ? null : p.problem;
    p.slipTime = 0;
    p.circleDir = this.chaosRandom() < 0.5 ? -1 : 1;
    p.circleAngle = this.chaosRandom() * Math.PI * 2;
    if (Math.abs(p.x) < P.halfX && Math.abs(p.z) < P.halfZ) {
      const side = P.halfX - Math.abs(p.x) < P.halfZ - Math.abs(p.z);
      p.fleePhase = "swim";
      if (side) {
        const s = Math.sign(p.x) || 1;
        p.fleeTarget = { x: s * (P.halfX - 0.35), z: clamp(p.z, -P.turnZ, P.turnZ) };
        p.fleeLanding = { x: s * (P.solidX + 0.6), z: p.fleeTarget.z };
      } else {
        const s = Math.sign(p.z) || 1,
          lane = this.nearestLane(p.x),
          gap = this.lanes[lane] + (p.x >= this.lanes[lane] ? 1.15 : -1.15);
        const x = clamp(gap, -P.halfX + 0.5, P.halfX - 0.5);
        p.fleeTarget = { x, z: s * (P.halfZ - 0.35) };
        p.fleeLanding = { x, z: s * (P.solidZ + 0.75) };
      }
    } else {
      p.fleePhase = "run";
      p.panicCenter = this.panicSpot(p, { x: p.x, z: p.z });
    }
  }
  panicSpot(p, from) {
    const P = this.venue.pool;
    const outX = Math.abs(from.x) >= P.solidX ? Math.sign(from.x) : 0,
      outZ = outX ? 0 : Math.sign(from.z) || -1;
    for (const push of [1.5, 1.0, 0.5, 0]) {
      const spot = { x: from.x + outX * push, z: from.z + outZ * push };
      if (this.venue.isDeck(spot.x, spot.z, this.level, 0.95)) return spot;
    }
    return { x: from.x, z: from.z };
  }
  tickFleeing(p, dt) {
    if (p.status !== "fleeing") return false;
    p.h = Math.max(30, p.h - dt * 0.22);
    if (p.fleePhase === "swim") {
      const d = distance(p, p.fleeTarget),
        step = 5.2 * dt;
      p.angle = Math.atan2(p.fleeTarget.x - p.x, p.fleeTarget.z - p.z);
      if (d <= step) {
        Object.assign(p, p.fleeTarget);
        p.fleePhase = "leap";
        p.leapT = 0;
        p.leapFrom = { x: p.x, z: p.z };
        this.emit("splash", { x: p.x, z: p.z });
      } else {
        p.x += ((p.fleeTarget.x - p.x) / d) * step;
        p.z += ((p.fleeTarget.z - p.z) / d) * step;
      }
    } else if (p.fleePhase === "leap") {
      p.leapT = Math.min(1, p.leapT + dt / 0.5);
      p.x = p.leapFrom.x + (p.fleeLanding.x - p.leapFrom.x) * p.leapT;
      p.z = p.leapFrom.z + (p.fleeLanding.z - p.leapFrom.z) * p.leapT;
      if (p.leapT === 1) {
        p.fleePhase = "run";
        p.panicCenter = this.panicSpot(p, p.fleeLanding);
      }
    } else {
      // Run a small loop around the panic spot, arms up. Deck contacts keep circles from overlapping.
      p.circleAngle += dt * 4.2 * p.circleDir;
      const target = {
        x: p.panicCenter.x + Math.cos(p.circleAngle) * 0.62,
        z: p.panicCenter.z + Math.sin(p.circleAngle) * 0.62,
      };
      const d = distance(p, target),
        step = Math.min(d, 3.4 * dt);
      if (d > 0.001) {
        const nx = p.x + ((target.x - p.x) / d) * step,
          nz = p.z + ((target.z - p.z) / d) * step;
        if (this.venue.isDeck(nx, nz, this.level, 0.25)) {
          p.x = nx;
          p.z = nz;
        }
        p.angle = Math.atan2(target.x - p.x, target.z - p.z);
      }
    }
    return true;
  }
  // Hold off new cramps while a daredevil is already in the air: their landing may need the rescue.
  rescueBlocked() {
    const j = this.get(this.jumper);
    return (
      super.rescueBlocked() || (!!j && ["climbing", "boarding", "bouncing", "flying"].includes(j.jumpStage))
    );
  }
  // Swimmers coming back rejoin their own lane, or a neighbour while a daredevil holds the splash lane.
  returnLane(p) {
    const lane = super.returnLane(p);
    if (!this.laneLocked(lane)) return lane;
    const open = [lane - 1, lane + 1, lane - 2, lane + 2].find(
      (l) => l >= 0 && l < this.lanes.length && !this.laneLocked(l),
    );
    return open ?? lane;
  }
  // Return every evacuated or fleeing swimmer to their original lane and unfinished workout. A loose fish keeps
  // the pool closed whatever else finished first; netting it reopens the pool.
  reopenPool() {
    if (this.fish?.stage === "loose") return;
    this.closed = 0;
    for (const p of this.people)
      if (p.status === "panic" || p.status === "fleeing") {
        if (p.type === "daredevil") {
          p.status = "queue";
          continue;
        }
        const lane = (p.resumeLane = this.returnLane(p));
        p.status = "queue";
        p.lane = lane;
        p.resumingWorkout = true;
        p.fleePhase = null;
        this.walk(p, { x: this.lanes[lane] + 0.6, z: ENTRY.edgeZ });
      }
    this.emit("reopened");
  }

  // ------------------------------------------------------------------------------------------------------
  // Hooks shared with the controller chain.
  waterMission() {
    for (const system of this.systems) {
      const mission = system.waterMission?.(this);
      if (mission) return mission;
    }
    return super.waterMission();
  }
  onSwimStep(dt) {
    for (const system of this.systems) system.onSwimStep?.(this, dt);
    super.onSwimStep(dt);
  }
  onClimbOut() {
    for (const system of this.systems) system.onClimbOut?.(this);
    super.onClimbOut();
  }
  collectInteractions(options) {
    super.collectInteractions(options);
    if (!this.canInteract()) return;
    for (const system of this.systems) system.interactions?.(this, options);
  }
  collectAlerts(alerts) {
    super.collectAlerts(alerts);
    for (const system of this.systems) system.alert?.(this, alerts);
  }
  returnItem() {
    for (const system of this.systems) {
      const handled = system.returnItem?.(this);
      if (handled !== undefined) return handled;
    }
    return super.returnItem();
  }
  // Short hint for the bottom bar, most urgent incident first.
  incidentHint() {
    if (this.rescue) return this.rescueHint();
    for (const system of this.systems) {
      const hint = system.hint?.(this);
      if (hint) return hint;
    }
    return this.rescueHint();
  }
  // Top-centre incident banner: icon, title, current task and step list.
  incidentPanel() {
    if (this.rescue?.kind === "crash") {
      const victims = this.rescueVictims(),
        next = victims.findIndex((v) => waitingInWater(this, v));
      return {
        icon: "💥",
        title: this.rescue.stage === "stranded" ? "CRASH! A RING FOR EVERYONE" : "OUT OF THE WATER",
        task: this.rescueHint(),
        steps: [
          ...victims.map((v, i) => ({
            label: "🛟 " + v.name.toUpperCase(),
            active: i === next,
            done: !waitingInWater(this, v),
          })),
          { label: "🩹 FIRST AID", active: next < 0, done: false },
        ],
      };
    }
    if (this.rescue)
      return {
        icon: "🛟",
        title: this.rescue.stage === "stranded" ? "SWIMMER NEEDS HELP!" : "HEADING TO SAFETY",
        task: this.rescueHint(),
      };
    if (this.cleanup) return null;
    for (const system of this.systems) {
      const panel = system.panel?.(this);
      if (panel) return panel;
    }
    return null;
  }
  // Trampoline (resort only): daredevil jumps, the splash-lane lock and crash victims on deck.
  laneBlocked() {
    return this.venue.trampoline ? blockedLane(this) : -1;
  }
  // The lane a mid-shift twist has closed, or -1.
  laneClosed() {
    return this.laneClosure;
  }
  // Nobody new can go into a lane that is the splash zone or closed.
  laneLocked(lane) {
    return lane === this.laneBlocked() || lane === this.laneClosure;
  }
  assignTrampoline() {
    return assignTrampoline(this);
  }
  tickJumper(p, dt) {
    return tickJumper(this, p, dt);
  }
  injuredOnDeck(p) {
    injuredOnDeck(this, p);
  }
  // Crash rescues need one ring per victim, so the hint counts down who is still waiting.
  rescueHint() {
    if (this.rescue?.kind !== "crash") return super.rescueHint();
    const left = this.strandedVictims().length,
      c = this.coach;
    if (this.rescue.stage === "escaping") return "Victims climbing out · first aid next";
    if (c.swimming)
      return c.carry === "lifering"
        ? `Swim to a 🤕 swimmer · ${left} still need${left === 1 ? "s" : ""} a ring`
        : "Climb out · grab another life ring";
    if (c.waterTransition) return c.waterTransition.kind === "dive" ? "Rescue dive!" : "Climbing out";
    return c.carry === "lifering"
      ? "Walk to the pool edge · dive in automatically"
      : `Grab a life ring · E · ${left} hurt swimmer${left === 1 ? "" : "s"} waiting`;
  }

  // ------------------------------------------------------------------------------------------------------
  // Pointer shortcuts: clicking gear, visitors or injured swimmers runs the matching E action when the coach
  // is already in reach; otherwise the coach is pointed the right way.
  interactionNear(point, reach, filter = () => true) {
    if (!this.canInteract()) return null;
    const options = [];
    this.collectInteractions(options);
    return (
      options
        .filter((o) => filter(o) && Math.hypot(o.x - point.x, o.z - point.z) < reach)
        .sort((a, b) => a.rank - b.rank)[0] || null
    );
  }
  useFixture(item) {
    const point = this.venue.fixtures?.[item],
      info = FIXTURES[item];
    if (!point || !info || this.status !== "playing") return false;
    const option = this.interactionNear(point, 1.3);
    if (option) return option.run();
    if (info.needed(this)) return this.guideTo(point, info.go);
    this.emit("toast", { text: info.about });
    return false;
  }
  approachVisitor(id) {
    const v = this.visitor(id);
    if (!v || this.status !== "playing") return false;
    const option = this.interactionNear(v, 0.6);
    if (option) return option.run();
    if (v.kind === "dog") {
      if (this.coach.carry !== "treats")
        return this.guideTo(this.venue.fixtures.treats, "Grab the dog treats to lure the dog out.");
      const door = this.venue.arrival,
        side = Math.sign(this.coach.x) || 1;
      return this.guideTo(
        { x: side * door.outsideX, z: door.doorZ },
        "Lead the dog to a locker door. It follows the treats.",
      );
    }
    return this.guideTo(
      v,
      v.kind === "kid"
        ? "Catch the kid before the edge and press E!"
        : `Walk up to ${v.name || "Carl"} and press E to red-card him!`,
    );
  }
  tendInjured(id) {
    const p = this.get(id);
    if (!p || p.status !== "injured" || this.status !== "playing") return false;
    const option = this.interactionNear(p, 0.3, (o) => o.kind === "heal" && o.id === id);
    if (option) return option.run();
    if (this.coach.carry === "medkit")
      return this.guideTo(p, "Kneel beside " + p.name + " and press E to patch them up.");
    return this.guideTo(this.venue.fixtures.medkit, "Grab the medical kit to patch up " + p.name + ".");
  }
  // Tag shown over a visitor (emoji + optional meter).
  visitorTag(v) {
    return this.system(v.systemKey)?.tag?.(this, v) || null;
  }
}
