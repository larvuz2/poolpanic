// The coach bot the season and drill checks play with: it manages lanes remotely and physically walks, swims
// and presses E through every incident, using only the real input the player has. Shared by season-check.mjs.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { plan, steer } from "./check-helpers.mjs";
import { roofServicePoint, seatVerdict } from "./dist/rooftop.mjs";
import { ROOF, ROOF_BEDS } from "./dist/roof-plan.mjs";
import { slide } from "./dist/ship.mjs";
import { SPRINGS, ONSEN_WATER } from "./dist/onsen-plan.mjs";
import { springGuests, onsenOutPath } from "./dist/onsen.mjs";

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const kidsHaveRoom = (s, p) =>
  s.people.filter((q) => q.type === "child" && (q.status === "swim" || q.status === "enter")).length <
    s.kidsRoom() || p.h < 30;
const CARL_CATCHABLE = ["walking", "windup", "charge", "running", "waiting"];

export class CoachBot {
  // `proactive` coaches prevent incidents; reactive ones only clean up what cannot be ignored.
  // `config` plays a custom shift (a drill) at feature tier `level`; `booking` folds a booking into the shift.
  constructor(
    level,
    seed,
    {
      proactive = true,
      clearSplash = true,
      config = null,
      drill = null,
      booking = null,
      tips = true,
      crew = null,
      sim = null,
    } = {},
  ) {
    // (`crew`: a co-op crew's looks, one coach each; `sim`: a crew's shared shift, for the second and third coach's bots: CrewBot)
    this.s = sim || new PoolSimulation(level, seed, { config, drill, booking, crew });
    this.helper = !!sim;
    this.crew = [this];
    this.doing = null;
    this.target = null;
    this.proactive = proactive;
    this.tips = tips; // (answers coaching tips: tips.mjs)
    this.clearSplash = clearSplash;
    this.frames = 0;
  }
  // Plays one of the generators below to its end on its own, ticking the shift between its frames.
  drive(gen) {
    for (;;) {
      const r = gen.next();
      if (r.done) return r.value;
      this.tickFrame();
    }
  }
  // An exclusive job (one incident, one mop) is not taken by a second coach of the crew.
  free(name) {
    return !this.crew.some((b) => b !== this && b.doing === name);
  }
  // A guest another coach of the crew is already on its way to (fins, a tip).
  claimed(p) {
    return this.crew.some((b) => b !== this && b.target === p.id);
  }
  get over() {
    return this.s.status === "ended" || this.frames > this.cap;
  }
  *frame$() {
    if (!this.helper) this.manage();
    yield;
  }
  // One tick of the shift, after every coach of the crew has had its frame.
  tickFrame() {
    const s = this.s;
    s.tick(1 / 60);
    s.events.length = 0;
    this.frames++;
    assert.equal(
      s.finCount(),
      s.venue.tubes ?? 3,
      "Fins stay accounted for (level " + s.level + ", t=" + s.time.toFixed(1) + ")",
    );
  }
  *wait$(n) {
    for (let i = 0; i < n && !this.over; i++) yield* this.frame$();
  }
  // A closed lane (a mid-shift twist) sends its usual swimmers to the nearest open one, emptiest first.
  openLane(preferred) {
    const s = this.s,
      tr = s.venue.trampoline;
    if (!s.laneLocked(preferred)) return preferred;
    const options = [...s.lanes.keys()]
      .filter((l) => l !== preferred && !s.laneLocked(l) && !(tr && this.clearSplash && l === tr.lane))
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
    if (s.venue.waves) return this.manageWaves();
    // (Up on the roof the coach seats the guests waiting by the lift: rooftop.mjs SEATS.)
    if (s.venue.roof) return this.manageRoof();
    if (s.venue.onsen) return this.manageSprings();
    for (const p of s.people.filter((p) => p.status === "queue" && !(p.finsFirst && !p.hasFins))) {
      s.select(p.id);
      if (p.queasy && p.sick) s.home();
      // (At the Kids Pool it waits for room: a packed pool makes every kid cross, and a cross kid pays little, sim.mjs
      // KID_MOOD_PAY. A kid about to give up goes in anyway.)
      else if (s.venue.kids) {
        if (kidsHaveRoom(s, p)) s.assign(s.poolLane());
      } else if (s.venue.river) {
        if (!s.closed && !s.cleanup) s.assign(this.riverRoute(p));
      } else if (p.type === "senior")
        // Senior Aqua Fit: the emptiest open lane, and not Marco's (he is quick, they are not).
        s.assign(
          [...s.lanes.keys()]
            .filter((l) => s.laneClosed() !== l)
            .sort(
              (a, b) =>
                s.people.some((q) => q.type === "advanced" && q.lane === a) -
                  s.people.some((q) => q.type === "advanced" && q.lane === b) ||
                s.occupancy(a) - s.occupancy(b) ||
                a - b,
            )[0],
        );
      else if (s.venue.class)
        // A class (the Aqua Disco): spread out, the emptiest open zone first.
        s.assign(
          [...s.lanes.keys()]
            .filter((l) => s.laneClosed() !== l)
            .sort((a, b) => s.occupancy(a) - s.occupancy(b) || a - b)[0],
        );
      else if (p.type === "daredevil") {
        if (!s.jumper && !s.rescue && !s.closed) s.assignTrampoline();
      } else
        s.assign(
          this.openLane(
            five
              ? { beginner: 0, aqua: 1, intermediate: 2, advanced: this.clearSplash ? 3 : 4 }[p.type]
              : { beginner: 0, aqua: 0, intermediate: 1, advanced: s.lanes.length - 1 }[p.type],
          ),
        );
    }
    s.selected = null;
    this.clearRaceLane();
    const j = tr && this.clearSplash && s.get(s.jumper);
    if (j && ["toStairs", "waiting"].includes(j.jumpStage) && !s.rescue && !s.closed)
      for (const p of s.people.filter((p) => p.lane === tr.lane && p.status === "swim" && !p.problem)) {
        s.select(p.id);
        s.assign(tr.lane - 1);
        s.selected = null;
      }
  }

  // The Lazy River's way round (river-ride.mjs ROUTES): the rapids for a thrill-seeker while they have room, else the lazy loop.
  riverRoute(p) {
    const s = this.s,
      rapids = s.people.filter(
        (q) => q.lane === 1 && ["swim", "enter"].includes(q.status) && !q.rushDone,
      ).length;
    return p.thrill && rapids < 3 ? 1 : 0;
  }
  // The big moment's race (big-moment.mjs): everyone in the race lane moves to the nearest other open lane.
  clearRaceLane() {
    const s = this.s,
      B = s.big;
    if (!this.proactive || B?.kind !== "race" || !["announce", "live"].includes(B.stage) || B.started) return;
    if (s.rescue || s.closed) return;
    for (const p of s.people.filter(
      (p) => p.lane === B.lane && p.status === "swim" && !["cramp", "injured"].includes(p.problem),
    )) {
      s.select(p.id);
      s.assign(this.openLane(B.lane));
      s.selected = null;
    }
  }
  // …and the coach blows the whistle at the blocks once the racers stand there and the lane is clear.
  *raceStart$() {
    const s = this.s,
      B = s.big,
      at = { x: s.lanes[B.lane] + 1.15, z: -s.venue.pool.serviceZ };
    if (s.coach.swimming) return yield* this.climbOut$();
    yield* this.walkTo$(at, { reach: 0.6, limit: 600 });
    const clear = !s.people.some((p) => p.lane === B.lane && ["swim", "enter", "switch"].includes(p.status));
    const ready = B.racers.every((id) => s.get(id)?.raceStage === "ready");
    if (clear && ready && (yield* this.use$("whistle", 30))) return;
    yield* this.wait$(6);
  }
  // The roof: each guest by the lift where they wished (a cabana or a sunbed if one is free and tidy, else the water), VIPs first.
  manageRoof(max = 99) {
    const s = this.s;
    if (s.closed || s.cleanup) return;
    const waiting = s.people
      .filter((p) => p.status === "queue" && p.chill)
      .sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || b.wait - a.wait)
      .slice(0, max);
    for (const p of waiting) {
      const want = { pool: 0, bed: 1, cabana: 2 }[p.wish] ?? 0,
        v = seatVerdict(s, p, want);
      s.select(p.id);
      s.assign(v && v.good ? want : want === 2 && seatVerdict(s, p, 1)?.good !== false ? 1 : 0);
    }
    s.selected = null;
  }
  // The hot springs: everyone waiting goes to the spring with the most room (none with a monkey in it), the coldest first.
  manageSprings() {
    const s = this.s;
    if (s.closed || s.cleanup) return;
    const waiting = s.people
      .filter((p) => p.status === "queue")
      .sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || (b.cold || 0) - (a.cold || 0));
    for (const p of waiting) {
      const k = SPRINGS.map((sp) => sp.id)
        .filter((k) => s.laneClosed() !== k && springGuests(s, k).length < SPRINGS[k].cap)
        .sort(
          (a, b) =>
            !!s.onsen.monkeys.find((m) => m.stage === "soak" && m.spring === a) -
              !!s.onsen.monkeys.find((m) => m.stage === "soak" && m.spring === b) ||
            SPRINGS[b].cap - springGuests(s, b).length - (SPRINGS[a].cap - springGuests(s, a).length) ||
            a - b,
        )[0];
      if (k == null) break;
      s.select(p.id);
      s.assign(k);
    }
    s.selected = null;
  }

  // The Wave Pool's machine, from the WAVES button (wave-pool.mjs): stop it when a monster is coming and someone is already seeing
  // stars, or when two are dizzy at once; start it again once the water has calmed them (or the bathers grow too restless).
  manageWaves() {
    const s = this.s,
      w = s.waves,
      bathers = s.people.filter((p) => p.status === "swim"),
      woozy = bathers.filter((p) => !p.hasFins && (p.dizzy || 0) >= 45).length,
      dizzy = bathers.filter((p) => p.problem === "dizzy").length;
    if (!this.proactive) return;
    if (w.state === "stopped") {
      if ((woozy === 0 && dizzy === 0 && w.stoppedFor > 2) || w.stoppedFor > 9) s.toggleWaves();
    } else if (w.state !== "halted" && ((w.monster !== null && woozy > 0) || dizzy >= 2)) s.toggleWaves();
  }

  // ----------------------------------------------------------------------------------------------------
  // Movement with real input.
  // (On the hot springs' ice the shared helper steers like a skater: check-helpers.mjs `steer`.)
  steer(to, last = true) {
    steer(this.s, to, last);
  }
  *walkTo$(to, { reach = 0.2, limit = 1500, until = null } = {}) {
    const s = this.s;
    let path = plan(s, to);
    for (let f = 0; f < limit && !this.over; f++) {
      if (until?.() || s.coach.swimming || s.coach.waterTransition) break;
      if (distance(s.coach, to) < reach) break;
      while (path.length > 1 && distance(path[0], s.coach) < (s.venue.ice ? 0.45 : 0.25)) path.shift();
      if (!path.length || (path.length === 1 && distance(path[0], s.coach) < 0.12)) break;
      this.steer(path[0], path.length === 1);
      yield* this.frame$();
      if (f % 24 === 23) path = plan(s, to);
    }
    s.clearInput();
    return distance(s.coach, to) < Math.max(reach, 0.5);
  }
  *chase$(target, done, limit = 1500) {
    const s = this.s;
    let path = [];
    for (let f = 0; f < limit && !this.over && !done(); f++) {
      if (f % 8 === 0 || !path.length) path = plan(s, target());
      while (path.length > 1 && distance(path[0], s.coach) < (s.venue.ice ? 0.45 : 0.3)) path.shift();
      if (path.length) this.steer(path[0], path.length === 1);
      yield* this.frame$();
    }
    s.clearInput();
    return done();
  }
  // Press E for a specific interaction once it is on offer (waiting out slips and busy moments).
  *use$(kind, patience = 90) {
    const s = this.s;
    for (let f = 0; f < patience && !this.over; f++) {
      const option = s.nearestInteraction();
      if (option?.kind === kind) {
        option.run();
        yield* this.waitBusy$();
        return true;
      }
      if (s.coach.busy || s.coach.slipTime > 0 || s.coach.y > 0.05) {
        yield* this.frame$();
        continue;
      }
      return false;
    }
    return false;
  }
  *waitBusy$() {
    for (let f = 0; f < 240 && this.s.coach.busy && !this.over; f++) yield* this.frame$();
  }
  *approach$(point, reach = 1.2) {
    return yield* this.walkTo$(point, { reach });
  }
  wallPoint(fixture) {
    return {
      x: fixture.x + Math.sin(fixture.angle || 0) * 0.9,
      z: fixture.z + Math.cos(fixture.angle || 0) * 0.9,
    };
  }
  // Walk to the long-side edge nearest a point in the pool; a coach on a water mission dives in by itself.
  *diveNear$(point) {
    const s = this.s,
      river = s.venue.river;
    if (river) {
      // The bank nearest the point (the near bank if the far one is out of the way), then step towards the water.
      const near = river.bank(point.x, point.z, { side: -1, outside: 0.6 }),
        far = river.bank(point.x, point.z, { side: 1, outside: 0.6 }),
        bank = distance(s.coach, far.deck) + 4 < distance(s.coach, near.deck) ? far : near;
      yield* this.walkTo$(bank.deck, { until: () => s.coach.swimming || s.coach.waterTransition });
      for (let f = 0; f < 150 && !s.coach.swimming && !this.over; f++) {
        this.steer(bank.water);
        yield* this.frame$();
      }
      s.clearInput();
      return s.coach.swimming;
    }
    if (s.venue.onsen) {
      // The rim of the spring nearest the point, then on into the water.
      const bank = ONSEN_WATER.bank(point.x, point.z, { inside: 0.8, outside: 0.6 });
      yield* this.walkTo$(bank.deck, { until: () => s.coach.swimming || s.coach.waterTransition });
      for (let f = 0; f < 150 && !s.coach.swimming && !this.over; f++) {
        this.steer(bank.water);
        yield* this.frame$();
      }
      s.clearInput();
      return s.coach.swimming;
    }
    const P = s.venue.pool,
      // (The Wave Pool is entered from its beach: the far side is the wave house.)
      side = s.venue.waves ? -1 : Math.sign(point.x) || 1,
      edge = { x: side * (P.solidX + 0.7), z: Math.max(-P.turnZ, Math.min(P.turnZ, point.z)) };
    yield* this.walkTo$(edge, { until: () => s.coach.swimming || s.coach.waterTransition });
    for (let f = 0; f < 150 && !s.coach.swimming && !this.over; f++) {
      s.setMovement(-side, 0);
      yield* this.frame$();
    }
    s.clearInput();
    return s.coach.swimming;
  }
  *climbOut$() {
    const s = this.s,
      river = s.venue.river;
    for (let f = 0; f < 900 && (s.coach.swimming || s.coach.waterTransition) && !this.over; f++) {
      if (river) {
        // To the near bank beside him, or the far one where the near bank is jungle.
        const near = river.bank(s.coach.x, s.coach.z, { side: -1, outside: 1 }),
          bank = s.venue.isDeck(near.deck.x, near.deck.z, s.level)
            ? near
            : river.bank(s.coach.x, s.coach.z, { side: 1, outside: 1 });
        this.steer(bank.deck);
        if (f % 30 === 29) s.jump();
      } else if (s.venue.onsen) {
        // Over to the rim beside him (or the steps), and out.
        this.steer(onsenOutPath(s, s.coach)[1]);
        if (f % 30 === 29) s.jump();
      } else if (s.venue.waves) {
        // Back to the beach (a press of Space on the way, in case he is already at the edge).
        s.setMovement(-1, 0);
        if (f % 30 === 29) s.jump();
      } else s.setMovement(Math.sign(s.coach.x) || 1, 0);
      yield* this.frame$();
    }
    s.clearInput();
  }
  *putAway$() {
    const s = this.s,
      c = s.coach,
      fx = s.venue.fixtures;
    if (c.swimming) yield* this.climbOut$();
    const home = {
      fishnet: () => this.wallPoint(fx.fishNet),
      flashlight: () => fx.flashlight,
      medkit: () => fx.medkit,
      treats: () => fx.treats,
      mop: () => fx.mop,
      lifering: () => this.wallPoint(s.lifeRings.find((r) => r.state === "coach").mount),
      tray: () => s.venue.stations.bar,
    }[c.carry];
    if (!home) {
      // Fins have no hook to go back to: in a hurry they are left on the deck. Whatever else, time moves on.
      if (!(c.carry === "fins" && s.dropCarriedFins())) yield* this.frame$();
      return;
    }
    yield* this.approach$(home(), 1.0);
    for (let f = 0; f < 60 && c.carry && !this.over; f++) {
      if (s.canInteract()) s.returnItem();
      else yield* this.frame$();
      if (c.carry) yield* this.frame$();
    }
  }

  // ----------------------------------------------------------------------------------------------------
  // Incident handlers. Each is bounded; the main loop re-evaluates priorities between calls.
  nextTask() {
    const s = this.s,
      c = s.coach;
    if ((s.rescue?.kind === "crash" || s.people.some((p) => p.status === "injured")) && this.free("crash"))
      return this.crash;
    // (A wave knockout at the Wave Pool: the cramp's rescue, which the bot otherwise never meets.)
    if (s.venue.waves && s.rescue?.stage === "stranded" && this.free("crash")) return this.crash;
    if (
      this.proactive &&
      s.big?.kind === "race" &&
      s.big.stage === "live" &&
      !s.big.started &&
      this.free("raceStart")
    )
      return this.raceStart;
    if (s.fish?.stage === "loose" && this.free("fishLoose")) return this.fishLoose;
    if (c.netLoaded) return this.fishReturn;
    if (s.outage?.stage === "dark" && this.free("outage")) return this.outage;
    // A pair of fins already in hand goes to the swimmer waiting for it before anything that can wait a few seconds.
    if (c.carry === "fins" && this.finsWanted()) return this.giveFins;
    if (this.proactive) {
      if (s.fish?.stage === "approach" && this.free("fishKid")) return this.fishKid;
      if (s.outage?.stage === "flicker" && this.free("outage")) return this.outage;
      const carl = s.carl && s.visitor(s.carl.id);
      if (carl && CARL_CATCHABLE.includes(carl.status) && this.free("carl")) return this.carl;
      if (s.dog && s.dog.stage !== "leaving" && this.free("dog")) return this.dog;
      const karen = s.karen && s.visitor(s.karen.id);
      if (karen && ["marching", "ranting"].includes(karen.status) && this.free("karen")) return this.karen;
    }
    // The hot springs: a monkey in the water is shooed out at once (whoever the coach is); one on its way, met before it gets there.
    if (s.onsen?.monkeys.some((m) => m.stage === "soak") && this.free("monkeyOut")) return this.monkeyOut;
    if (
      this.proactive &&
      s.onsen?.monkeys.some((m) => ["approach", "pause"].includes(m.stage)) &&
      this.free("monkey")
    )
      return this.monkey;
    // The Wave Pool: a dizzy bather is helped out before anything else that can wait; then the tubes.
    if (s.venue.waves && this.proactive) {
      if (this.dizzyBather() && this.free("helpDizzy")) return this.helpDizzy;
      const wanted = this.tubeWanted();
      if (wanted && (c.carry === "fins" || (!c.carry && (s.finsAvailable > 0 || this.spareTube()))))
        return this.giveTube;
      // A tube in hand and nobody to give it to: hold it at the beach corner, or put it back to go and mop.
      if (c.carry === "fins") return s.wetSpots?.length ? this.putAway : this.giveTube;
    }
    // The cruise ship: someone who slid into the pool is helped out before anything else that can wait.
    if (s.ship && this.proactive && s.people.some((p) => p.status === "fell-in") && this.free("helpFallen"))
      return this.helpFallen;
    // The Rooftop Pool (and the cruise ship's chilling guests): someone overboard or up on the edge before anything else that can
    // wait; then the margaritas.
    if (s.venue.chill && this.proactive) {
      if (s.people.some((p) => p.status === "overboard") && this.free("haulRoof")) return this.haulRoof;
      if (s.people.some((p) => p.problem === "selfie") && this.free("stopRoofSelfie"))
        return this.stopRoofSelfie;
      const thirsty = s.people.some((p) => p.problem === "drink"),
        // (On the cruise ship a tray with nobody to serve goes back when the deck needs the coach.)
        chores = s.ship && (s.wetSpots?.length || s.roof.beds.some((b) => b.adrift || b.messy));
      if (((c.carry === "tray" && (thirsty || !chores)) || (!c.carry && thirsty)) && this.free("serveRoof"))
        return this.serveRoof;
    }
    // The cruise ship's loungers, slid out of place: a row put back while the deck is level (before the mop when several are out).
    if (
      this.proactive &&
      s.ship &&
      !c.carry &&
      !slide(s) &&
      s.roof.beds.filter((b) => b.adrift).length >= 3 &&
      this.free("straighten")
    )
      return this.straighten;
    // Wet spots (incidents/wet.mjs): a proactive coach mops them as soon as nothing more urgent is going on.
    if (this.proactive && s.wetSpots?.length && (!c.carry || c.carry === "mop") && this.free("mopWet"))
      return this.mopWet;
    // Fins: a waiting swimmer who will not swim without them gets a pair (a pair in hand always goes to someone).
    if (c.carry === "fins") return this.giveFins;
    if (!c.carry && (s.finsAvailable > 0 || (s.venue.river && this.spareTube())) && this.finsWanted())
      return this.giveFins;
    // Coaching tips (tips.mjs): a swimmer asking for one gets the coach at the end of their lane.
    if (this.proactive && this.tips && (!c.carry || c.carry === "mop") && this.tipWanted())
      return this.coachTip;
    // The Rooftop Pool's messy sunbeds, when the deck is dry.
    if (
      this.proactive &&
      s.venue.chill &&
      !c.carry &&
      s.roof.beds.some((b) => b.messy) &&
      this.free("tidyRoof")
    )
      return this.tidyRoof;
    // The cruise ship's loungers, slid out of place, straightened in a calm.
    if (
      this.proactive &&
      s.ship &&
      !c.carry &&
      !slide(s) &&
      s.roof.beds.some((b) => b.adrift) &&
      this.free("straighten")
    )
      return this.straighten;
    // The Lazy River: used tubes go back to the rack when there is nothing more pressing.
    if (!c.carry && s.venue.river && this.spareTube()) return this.rackTube;
    if (c.carry) return this.putAway;
    return null;
  }
  // ---- the hot springs ----
  // Meet the monkey nearest its spring before it gets there: running into it shoos it.
  *monkey$() {
    const s = this.s,
      live = s.onsen.monkeys.filter((m) => ["approach", "pause"].includes(m.stage)),
      m = live.sort((a, b) => distance(a, a.rim) - distance(b, b.rim))[0];
    if (!m) return yield* this.wait$(2);
    if (s.coach.swimming) return yield* this.climbOut$();
    yield* this.chase$(
      () => m,
      () => !["approach", "pause"].includes(m.stage),
      600,
    );
  }
  // A monkey sitting in a spring: to the rim beside it, and E.
  *monkeyOut$() {
    const s = this.s,
      m = s.onsen.monkeys.find((q) => q.stage === "soak");
    if (!m) return yield* this.wait$(2);
    if (s.coach.swimming) return yield* this.climbOut$();
    yield* this.walkTo$(m.rim, { reach: 0.5, until: () => m.stage !== "soak" });
    if (m.stage === "soak" && !(yield* this.use$("assist"))) yield* this.wait$(3);
  }
  // ---- the Rooftop Pool ----
  // Haul a guest back over the infinity edge: wade to the edge beside them.
  *haulRoof$() {
    const s = this.s,
      p = s.people.find((q) => q.status === "overboard");
    if (!p) return yield* this.wait$(2);
    yield* this.walkTo$(
      { x: ROOF.halfX - 0.5, z: p.z },
      { reach: 0.6, until: () => p.status !== "overboard" },
    );
    if (!(yield* this.use$("assist"))) yield* this.wait$(3);
  }
  // Talk a guest down off the edge (or stop them on the way): wade over to them.
  *stopRoofSelfie$() {
    const s = this.s,
      p = s.people.find((q) => q.problem === "selfie");
    if (!p) return yield* this.wait$(2);
    yield* this.chase$(
      () => ({ x: Math.min(p.x - 0.5, ROOF.halfX - 0.8), z: p.z }),
      () => p.problem !== "selfie" || s.nearestInteraction()?.kind === "assist",
      900,
    );
    if (!(yield* this.use$("assist"))) yield* this.wait$(2);
  }
  // Margaritas: a tray from the bar, then the orders, nearest first (a VIP before anyone).
  *serveRoof$() {
    const s = this.s,
      c = s.coach,
      orders = s.people.filter((p) => p.problem === "drink");
    if (c.carry && c.carry !== "tray") return yield* this.putAway$();
    if (c.carry !== "tray") {
      if (!orders.length) return yield* this.wait$(5);
      yield* this.walkTo$(s.venue.stations.bar, { reach: 0.9 });
      if (!(yield* this.use$("fetch"))) yield* this.wait$(5);
      return;
    }
    if (!orders.length) {
      // Nobody waiting: hold on to the tray by the middle of the walk, where orders come from.
      yield* this.walkTo$(s.venue.roof ? { x: -4.4, z: 0 } : { x: s.venue.chill.edge.stand, z: 0 }, {
        reach: 0.8,
        limit: 40,
      });
      return yield* this.wait$(10);
    }
    const p = orders.sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || distance(a, c) - distance(b, c))[0];
    yield* this.chase$(
      () => roofServicePoint(s, p),
      () => p.problem !== "drink" || c.carry !== "tray" || s.nearestInteraction()?.kind === "deliver",
      600,
    );
    if (s.nearestInteraction()?.kind === "deliver") yield* this.use$("deliver");
    else yield* this.wait$(3);
  }
  // A messy sunbed, the nearest.
  *tidyRoof$() {
    const s = this.s,
      bed = s.roof.beds
        .filter((b) => b.messy)
        .sort(
          (a, b) =>
            distance(s.venue.chill.bed(s, a.id).foot, s.coach) -
            distance(s.venue.chill.bed(s, b.id).foot, s.coach),
        )[0];
    if (!bed) return yield* this.wait$(2);
    yield* this.walkTo$(s.venue.chill.bed(s, bed.id).foot, { reach: 0.6 });
    if (!(yield* this.use$("tidy"))) yield* this.wait$(5);
  }
  // ---- the cruise ship ----
  // Someone slid into the pool: to the edge by them, and help them out.
  *helpFallen$() {
    const s = this.s,
      p = s.people
        .filter((q) => q.status === "fell-in")
        .sort((a, b) => distance(a.fallen.edge, s.coach) - distance(b.fallen.edge, s.coach))[0];
    if (!p) return yield* this.wait$(2);
    if (s.coach.carry) return yield* this.putAway$();
    yield* this.walkTo$(p.fallen.edge, { reach: 0.7, until: () => p.status !== "fell-in" });
    if (!(yield* this.use$("assist"))) yield* this.wait$(3);
  }
  // A row of loungers out of place: to the nearest one that is adrift, and straighten its row.
  *straighten$() {
    const s = this.s,
      bed = s.roof.beds
        .filter((b) => b.adrift)
        .sort(
          (a, b) =>
            distance(s.venue.chill.bed(s, a.id).foot, s.coach) -
            distance(s.venue.chill.bed(s, b.id).foot, s.coach),
        )[0];
    if (!bed) return yield* this.wait$(2);
    yield* this.walkTo$(s.venue.chill.bed(s, bed.id).foot, { reach: 0.6, until: () => !bed.adrift });
    if (bed.adrift && !(yield* this.use$("tidy"))) yield* this.wait$(5);
  }
  // ---- the Wave Pool ----
  // A dizzy bather in the water, staggering for the beach (the nearest first).
  dizzyBather() {
    const s = this.s;
    return (
      s.people
        .filter((p) => p.status === "swim" && p.problem === "dizzy")
        .sort((a, b) => distance(a, s.coach) - distance(b, s.coach))[0] || null
    );
  }
  *helpDizzy$() {
    const s = this.s,
      c = s.coach,
      p = this.dizzyBather();
    if (!p) return yield* this.wait$(2);
    if (c.carry === "fins" && !p.hasFins) return yield* this.giveTube$(p);
    if (c.carry) return yield* this.putAway$();
    yield* this.chase$(
      () => s.servicePoint(p),
      () => p.problem !== "dizzy" || p.status !== "swim" || s.nearestInteraction()?.kind === "assist",
      600,
    );
    if (!(yield* this.use$("assist"))) yield* this.wait$(2);
  }
  // Who should have a tube: a guest walking down to the beach without one (a VIP first, then the timid), or a woozy bather in reach.
  tubeWanted() {
    const s = this.s,
      rank = (p) => (p.vip ? 0 : p.type === "beginner" ? 1 : p.type === "intermediate" ? 2 : 3);
    return (
      s.people
        .filter(
          (p) =>
            p.needsFins &&
            !p.hasFins &&
            (p.status === "enter" || (p.status === "swim" && (p.dizzy || 0) >= 45 && p.x < -3.5)),
        )
        .sort((a, b) => rank(a) - rank(b) || distance(a, s.coach) - distance(b, s.coach))[0] || null
    );
  }
  *giveTube$(target = null) {
    const s = this.s,
      c = s.coach;
    if (c.carry !== "fins") {
      if (c.carry) return yield* this.putAway$();
      const tube = this.spareTube();
      if (tube && (!s.finsAvailable || distance(tube, c) < distance(s.venue.stations.fins, c))) {
        yield* this.walkTo$(tube, { reach: 0.9, limit: 600 });
        if (!(yield* this.use$("pickup"))) return yield* this.wait$(5);
      } else if (s.finsAvailable) {
        yield* this.walkTo$(s.venue.stations.fins, { reach: 1.5, limit: 600 });
        s.fetch("fins");
        yield* this.waitBusy$();
      }
      if (c.carry !== "fins") return yield* this.wait$(10);
    }
    const p = target || this.tubeWanted();
    if (!p) {
      // Nobody needs it now: wait at the beach corner with it, where everyone comes past.
      yield* this.walkTo$({ x: -9.2, z: -8.6 }, { reach: 0.6, limit: 60 });
      return yield* this.wait$(10);
    }
    yield* this.chase$(
      () => s.servicePoint(p),
      () => p.hasFins || !["enter", "swim"].includes(p.status) || s.nearestInteraction()?.kind === "deliver",
      600,
    );
    if (s.nearestInteraction()?.kind === "deliver") yield* this.use$("deliver");
    else yield* this.wait$(3);
  }
  // A used tube lying at the Lazy River's tube return (or anywhere on the deck).
  spareTube() {
    const s = this.s;
    return (
      s.clutter
        .filter((f) => f.type === "fins")
        .sort((a, b) => distance(a, s.coach) - distance(b, s.coach))[0] || null
    );
  }
  *rackTube$() {
    const s = this.s,
      tube = this.spareTube();
    if (!tube) return yield* this.wait$(5);
    yield* this.walkTo$(tube, { reach: 0.9, limit: 600 });
    if (!(yield* this.use$("pickup"))) return yield* this.wait$(5);
    // (giveFins takes it from here: to a guest who wants one, or back on the rack.)
    yield* this.giveFins$();
  }
  // A swimmer in the queue who will not swim without fins. (One who asks in the water is service the bot leaves alone: the star
  // targets count on a player doing it.)
  finsWanted() {
    return (
      this.s.people.find((q) => q.status === "queue" && q.finsFirst && !q.hasFins && !this.claimed(q)) || null
    );
  }
  *giveFins$() {
    const s = this.s,
      c = s.coach;
    const p =
      this.finsWanted() ||
      (c.carry === "fins" && s.people.find((q) => q.status === "queue" && q.needsFins && !q.hasFins));
    if (c.carry !== "fins") {
      if (!p) return yield* this.wait$(10);
      const tube = s.venue.river && !s.finsAvailable && this.spareTube();
      if (tube) {
        // The Lazy River's rack is empty: a used tube from the tube return will do.
        yield* this.walkTo$(tube, { reach: 0.9, limit: 600 });
        if (!(yield* this.use$("pickup"))) return yield* this.wait$(5);
      } else {
        // The rack stands in its counter: stop within arm's reach of it, not on it.
        yield* this.walkTo$(s.venue.stations.fins, { reach: 1.5, limit: 600 });
        s.fetch("fins");
        yield* this.waitBusy$();
      }
      if (c.carry !== "fins") return yield* this.wait$(10);
    }
    this.target = p?.id ?? null;
    if (!p) {
      // Nobody waiting needs them any more: a tube goes back on its rack; fins are left on the deck, out of the way.
      if (s.venue.river) {
        yield* this.walkTo$(s.venue.stations.fins, { reach: 1.5, limit: 600 });
        if (!(yield* this.use$("return"))) yield* this.wait$(5);
        return;
      }
      if (!s.dropCarriedFins()) yield* this.wait$(5);
      return;
    }
    yield* this.walkTo$(s.servicePoint(p), { reach: 0.5, limit: 600 });
    if (s.deliver(p.id)) yield* this.waitBusy$();
    else yield* this.wait$(5);
  }
  // The swimmer asking for a tip the coach should answer first: a VIP, else whoever has waited longest.
  tipWanted() {
    return (
      this.s.people
        .filter((q) => q.ask && q.status === "swim" && !this.claimed(q))
        .sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || b.ask.t - a.ask.t)[0] || null
    );
  }
  *coachTip$() {
    const s = this.s,
      p = this.tipWanted();
    if (!p) return yield* this.wait$(1);
    this.target = p.id;
    yield* this.chase$(
      () => s.servicePoint(p),
      () => !p.ask || p.status !== "swim" || s.swimmerInReach(p),
      600,
    );
    if (p.ask && s.swimmerInReach(p)) {
      if (!(yield* this.use$("tip", 30))) yield* this.wait$(2);
    } else yield* this.wait$(2);
  }
  // Grab the mop, mop the nearest wet spot, and put the mop back once the deck is dry.
  *mopWet$() {
    const s = this.s,
      c = s.coach;
    if (c.carry !== "mop") {
      yield* this.approach$(s.venue.fixtures.mop, 1.0);
      if (!(yield* this.use$("mop"))) return yield* this.wait$(1);
    }
    const spot = [...s.wetSpots].sort((a, b) => distance(a, c) - distance(b, c))[0];
    if (spot) {
      yield* this.walkTo$(spot, { reach: 0.7, limit: 900 });
      if (!(yield* this.use$("mop-spot"))) yield* this.wait$(1);
    }
    if (!s.wetSpots.length) yield* this.putAway$();
  }
  *fishKid$() {
    const s = this.s,
      kid = s.visitor(s.fish.kid);
    if (!kid) return yield* this.wait$(1);
    yield* this.chase$(
      () => kid,
      () => s.fish?.stage !== "approach" || s.nearestInteraction()?.kind === "stop-kid",
      900,
    );
    yield* this.use$("stop-kid");
  }
  *fishLoose$() {
    const s = this.s,
      c = s.coach;
    if (!c.swimming) {
      if (c.carry && c.carry !== "fishnet") return yield* this.putAway$();
      if (c.carry !== "fishnet") {
        yield* this.approach$(this.wallPoint(s.venue.fixtures.fishNet), 0.6);
        if (!(yield* this.use$("fishnet"))) return yield* this.wait$(1);
      }
      if (!(yield* this.diveNear$(s.fish))) return;
    }
    for (let f = 0; f < 60 * 40 && s.fish?.stage === "loose" && c.swimming && !this.over; f++) {
      this.steer(s.fish);
      yield* this.frame$();
    }
    s.clearInput();
    if (s.fish?.stage !== "loose") yield* this.climbOut$();
  }
  *fishReturn$() {
    const s = this.s,
      kid = s.fish && s.visitor(s.fish.kid);
    if (s.coach.swimming) yield* this.climbOut$();
    if (kid && kid.status === "crying") {
      yield* this.chase$(
        () => kid,
        () => s.nearestInteraction()?.kind === "return-fish",
        900,
      );
      yield* this.use$("return-fish");
    }
    if (!s.coach.netLoaded) yield* this.putAway$();
    else yield* this.wait$(1);
  }
  *carl$() {
    const s = this.s,
      v = s.visitor(s.carl.id);
    yield* this.chase$(
      () => v,
      () => !s.carl || !CARL_CATCHABLE.includes(v.status) || s.nearestInteraction()?.kind === "red-card",
      600,
    );
    yield* this.use$("red-card");
  }
  // Run to Karen and hold E until she is calm (letting go early only drains the ring).
  *karen$() {
    const s = this.s,
      v = s.visitor(s.karen.id);
    yield* this.chase$(
      () => v,
      () => !s.karen || s.nearestInteraction()?.kind === "calm",
      900,
    );
    if (!s.karen || s.nearestInteraction()?.kind !== "calm") return;
    s.setHold(true);
    s.interact();
    for (let f = 0; f < 60 * 10 && s.karen && s.karen.calming && !this.over; f++) yield* this.frame$();
    s.setHold(false);
  }
  *outage$() {
    const s = this.s,
      fx = s.venue.fixtures,
      box = this.wallPoint(fx.fuseBox);
    if (s.outage.stage === "flicker") {
      yield* this.walkTo$(box, { reach: 0.6, until: () => s.outage?.stage !== "flicker" });
      yield* this.use$("reset-breaker");
      return;
    }
    if (s.coach.carry !== "flashlight") {
      if (s.coach.carry) return yield* this.putAway$();
      yield* this.approach$(fx.flashlight, 1.0);
      if (!(yield* this.use$("flashlight"))) return yield* this.wait$(1);
    }
    yield* this.walkTo$(box, { reach: 0.6 });
    if (yield* this.use$("reset-breaker")) yield* this.putAway$();
  }
  *dog$() {
    const s = this.s,
      fx = s.venue.fixtures;
    if (s.coach.carry !== "treats") {
      if (s.coach.carry) return yield* this.putAway$();
      yield* this.approach$(fx.treats, 1.0);
      if (!(yield* this.use$("treats"))) return yield* this.wait$(1);
    }
    const v = s.visitor(s.dog.id);
    if (!v) return yield* this.wait$(1);
    yield* this.chase$(
      () => v,
      () => !s.dog || s.dog.stage === "following",
      900,
    );
    if (s.dog?.stage !== "following") return;
    const door = s.venue.arrival,
      side = door.sideOf(s.coach),
      out = door.at(side, "outside");
    yield* this.walkTo$(door.alongZ ? { x: out.x + 0.6, z: out.z } : { x: out.x, z: out.z + 0.6 }, {
      until: () => s.dog?.stage !== "following",
    });
    for (let f = 0; f < 240 && s.dog?.stage === "following"; f++) yield* this.frame$();
  }
  // Trampoline crash: a ring for every victim, then the medical kit for everyone on the deck.
  *crash$() {
    const s = this.s,
      c = s.coach;
    if (s.rescue?.kind === "crash" || (s.venue.waves && s.rescue)) {
      if (s.rescue.stage !== "stranded") return yield* this.wait$(1);
      if (c.swimming) return yield* this.climbOut$();
      if (c.carry !== "lifering") {
        if (c.carry) return yield* this.putAway$();
        const ring = s.lifeRings
          .filter((r) => ["wall", "deck"].includes(r.state))
          .sort((a, b) => distance(a, c) - distance(b, c))[0];
        if (!ring) return yield* this.wait$(1);
        yield* this.approach$(ring.state === "wall" ? this.wallPoint(ring.mount) : ring, 0.8);
        if (!(yield* this.use$("lifering"))) return yield* this.wait$(1);
      }
      const victim = s.strandedVictims().sort((a, b) => distance(a, c) - distance(b, c))[0];
      if (!victim || !(yield* this.diveNear$(victim))) return;
      const waiting = s.strandedVictims().length;
      for (
        let f = 0;
        f < 60 * 20 && s.strandedVictims().length === waiting && c.swimming && !this.over;
        f++
      ) {
        const next = s.strandedVictims().sort((a, b) => distance(a, c) - distance(b, c))[0];
        if (!next) break;
        this.steer(next);
        yield* this.frame$();
      }
      return yield* this.climbOut$();
    }
    const injured = s.people.filter((p) => p.status === "injured");
    if (!injured.length) return;
    if (c.carry !== "medkit") {
      if (c.carry) return yield* this.putAway$();
      yield* this.approach$(s.venue.fixtures.medkit, 1.0);
      if (!(yield* this.use$("medkit"))) return yield* this.wait$(1);
    }
    const p = injured.sort((a, b) => distance(a, c) - distance(b, c))[0];
    if (p.path.length) return yield* this.wait$(10);
    yield* this.walkTo$(p, { reach: 1.1 });
    if (s.tendInjured(p.id)) yield* this.waitBusy$();
    else yield* this.wait$(1);
    if (!s.people.some((q) => q.status === "injured")) yield* this.putAway$();
  }
  *run$() {
    const s = this.s;
    this.cap = Math.ceil(s.config.duration * 60 * 4);
    if (!this.helper) s.start();
    const standby = this.helper ? { x: s.coach.x, z: s.coach.z } : s.venue.coachStart;
    while (!this.over) {
      const task = this.nextTask();
      if (task) {
        this.doing = task.name;
        yield* this[task.name + "$"]();
        this.doing = null;
        this.target = null;
      } else if (distance(s.coach, standby) > 1.5) yield* this.walkTo$(standby, { limit: 20 });
      else yield* this.frame$();
    }
    return this;
  }
}

// Each of those is a generator (one yield a frame, so a crew of bots can share a shift: CrewBot) with a plain method beside it that
// plays it to the end on its own, ticking the shift between its frames, as the checks call it.
export const FRAMED = [
  "approach",
  "carl",
  "chase",
  "climbOut",
  "coachTip",
  "crash",
  "diveNear",
  "dog",
  "fishKid",
  "fishLoose",
  "fishReturn",
  "frame",
  "giveFins",
  "giveTube",
  "haulRoof",
  "helpDizzy",
  "helpFallen",
  "karen",
  "monkey",
  "monkeyOut",
  "mopWet",
  "outage",
  "putAway",
  "raceStart",
  "rackTube",
  "run",
  "serveRoof",
  "stopRoofSelfie",
  "straighten",
  "tidyRoof",
  "use",
  "wait",
  "waitBusy",
  "walkTo",
];
for (const name of FRAMED)
  Object.defineProperty(CoachBot.prototype, name, {
    value: {
      [name](...args) {
        return this.drive(this[name + "$"](...args));
      },
    }[name],
    writable: true,
    configurable: true,
  });

// A co-op crew of bots on one shift (two or three coaches): the first manages the lanes and starts the shift; every coach then
// takes the next job nobody else is on, each a frame at a time, as its own player, and the shift ticks once they all have.
export class CrewBot {
  constructor(level, seed, { crew = ["waters", "brooks"], ...options } = {}) {
    this.lead = new CoachBot(level, seed, { ...options, crew });
    this.s = this.lead.s;
    this.bots = [this.lead];
    for (let i = 1; i < this.s.coaches.length; i++)
      this.bots.push(new CoachBot(level, seed, { ...options, sim: this.s }));
    for (const b of this.bots) b.crew = this.bots;
  }
  run() {
    const s = this.s,
      gens = this.bots.map((b) => b.run$());
    for (const b of this.bots) b.cap = Math.ceil(s.config.duration * 60 * 4);
    while (!this.lead.over) {
      gens.forEach((g, i) => s.as(i, () => g.next()));
      if (this.lead.over) break;
      this.lead.tickFrame();
      for (const b of this.bots.slice(1)) b.frames++;
    }
    return this;
  }
}
