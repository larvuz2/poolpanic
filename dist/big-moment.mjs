// ⭐ The big moment (Phase 3, 20 October 2026). The diagnostic: "One big moment in each shift, at about two thirds of the way …
// Gives each shift a build and a climax, like a song." Every shift of the week from the first Tuesday (and every free-play level
// from 2) has one (`config.big = { at }`, a share of the shift), and each kind of pool has its own:
//
// - 🏁 **The race** (the lane pools): two racers walk out to the blocks of the race lane. The coach clears the lane (nobody new
//   goes in; the swimmers in it are moved to another, as for the trampoline) and blows the whistle at the blocks (E). They race a
//   length and back while the crowd roars. Left too long, the starter goes without him; anyone still in the lane is swum into.
// - 💃 **The encore** (the Aqua Disco): five more dancers arrive for Valentina's big number; when it ends, every zone with two to
//   four dancers in it is in formation.
// - 🎂 **The birthday party** (the Kids Pool): six party kids burst in, running about; the cake comes when the song ends, and every
//   party kid in the water by then counts.
// - 🎉 **The tube parade** (the Lazy River): five guests arrive together, all wanting tubes, all to be on the river before the
//   drums stop.
// - 🌊 **The monster set** (the Wave Pool): three monster waves in a row, with the siren. Ride them out (nobody knocked under), or
//   stop the machine and play it safe.
// - 🎧 **The headline drop** (the Rooftop Pool): the DJ's biggest drop of the night, with fireworks over the city: the water slops
//   over everywhere. Nobody over the edge, and the deck mopped before the end.
// - 🌊 **The rogue wave** (the Cruise Ship): the biggest roll of the voyage, three bells. Everyone who slides in helped out, every
//   row of loungers straightened.
// - 🐒 **The troop** (the Mountain Hot Springs): four snow monkeys out of the forest at once. Not one in a spring.
//
// Each goes: waiting → announced (BIG.announce seconds: a sting, the banner, a countdown) → live → done, graded great, good or
// missed, with its points and a stamp. It waits out a rescue, a clean-up or a closed pool, and incidents wait for it. Its own
// random numbers come from a stream of its own; the extra guests it brings come through the arrivals like a rush's.
import { launch } from "./waves.mjs";
import { spawnMonkey } from "./onsen.mjs";
import { rogueSwell } from "./ship.mjs";

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CIRCUIT = 31.2; // (sim.mjs: one lap of a lane)
const EDGE_Z = -8.7; // (spatial.mjs ENTRY.edgeZ: the starting-block end, on the deck)

export const BIG = {
  announce: 8, // s of build-up, announced
  earliest: 20, // s into the shift at the soonest
  room: 28, // s it keeps clear of the end of the shift
  points: { great: 300, good: 150, miss: 0 },
  // the race
  raceWait: 9, // s the racers wait on the blocks for the whistle before the starter goes without the coach
  marks: 1.4, // s of "on your marks… get set…"
  raceSpeed: [4.3, 5.1], // m/s
  whistleReach: 2.4,
  pileUp: 50, // points lost for each swimmer in the race lane at the start
  raceFail: 100,
  // the arrivals
  crowd: { encore: 5, party: 6, parade: 5 },
  window: { encore: 22, party: 26, parade: 30 },
  // the monster set
  monsters: 3,
  monsterGap: 5,
  // the headline drop, the rogue wave, the troop
  mopWindow: 20,
  shipWindow: 26,
  troop: 4,
  troopWindow: 24,
};
const T = BIG;

export const BIG_KINDS = {
  race: {
    icon: "🏁",
    title: "THE RACE",
    verb: "Clear lane {lane} · blow the whistle at the blocks (E)",
    how: "Two racers are coming out for a race in lane {lane}. Move everyone out of it (select them, then another lane), walk to the starting blocks and press E to start them. Too slow, and the starter goes without you.",
  },
  encore: {
    icon: "💃",
    title: "ENCORE!",
    verb: "Five more dancers · two to four in every zone",
    how: "Valentina's big number: five more dancers are on their way. When the song ends, every zone with two to four dancers is in formation.",
  },
  party: {
    icon: "🎂",
    title: "BIRTHDAY PARTY!",
    verb: "Six party kids · all in the pool before the cake",
    how: "A birthday party bursts in: catch every party kid and send them into the pool before the song ends.",
  },
  parade: {
    icon: "🎉",
    title: "TUBE PARADE!",
    verb: "Five guests · a tube each · all on the river",
    how: "A parade of five arrives together. Every one of them needs a tube and a trip down the river before the drums stop. Keep the rack stocked!",
  },
  monsters: {
    icon: "🌊",
    title: "MONSTER SET!",
    verb: "Three monsters · tube them up or stop the waves (Z)",
    how: "Three monster waves in a row. A dizzy bather hit by one goes under: get tubes to them, or stop the machine and play it safe.",
  },
  headline: {
    icon: "🎧",
    title: "THE HEADLINE DROP",
    verb: "Nobody on the edge · mop the deck after",
    how: "The DJ's biggest drop of the night, with fireworks. Anyone up on the edge goes over, and the water slops everywhere: mop it all before the night moves on.",
  },
  rogue: {
    icon: "🔔",
    title: "ROGUE WAVE!",
    verb: "Hold on! · then help them out and straighten the rows",
    how: "The biggest roll of the voyage. Whoever slides into the pool needs a hand out, and every row of loungers needs straightening.",
  },
  troop: {
    icon: "🐒",
    title: "THE TROOP!",
    verb: "Four monkeys · not one in a spring",
    how: "A whole troop of snow monkeys comes out of the forest at once. Run into each one before it gets into a spring.",
  },
};

// The stamps (moments.mjs SAVES has them too) and the words of each result.
export const BIG_RESULTS = {
  great: {
    stamp: "SHOWSTOPPER!",
    words: {
      race: "What a race!",
      encore: "Perfect formation!",
      party: "Best party ever!",
      parade: "What a parade!",
      monsters: "Rode it out!",
      headline: "Best night ever!",
      rogue: "Shipshape!",
      troop: "Not one!",
    },
  },
  good: {
    stamp: "NICE ONE!",
    words: {
      race: "They went without you",
      encore: "Nearly in formation",
      party: "A good party",
      parade: "Most of the parade",
      monsters: "Played it safe",
      headline: "Nobody went over",
      rogue: "Nearly shipshape",
      troop: "Only one got in",
    },
  },
  miss: {
    stamp: "",
    words: {
      race: "Pile-up!",
      encore: "Out of step",
      party: "Party pooped",
      parade: "Parade rained off",
      monsters: "Wiped out",
      headline: "Over the edge!",
      rogue: "All at sea",
      troop: "Monkey business",
    },
  },
};

// Which big moment a pool has.
export function bigKind(venue) {
  if (venue.waves) return "monsters";
  if (venue.roof) return "headline";
  if (venue.cruise) return "rogue";
  if (venue.onsen) return "troop";
  if (venue.class) return "encore";
  if (venue.kids) return "party";
  if (venue.river) return "parade";
  return "race";
}
// When in a shift of `duration` seconds the moment comes (shift-clock seconds), for `at` a share of the shift.
export const bigTime = (duration, at = 0.66) =>
  clamp(at * duration, T.earliest + T.announce, duration - T.room);
// A shift's moment, drawn from its own stream: about two thirds of the way.
export const planBig = (random) => ({ at: +(0.6 + random() * 0.1).toFixed(2) });

function bigRandom(sim) {
  if (!sim.bigSeed) sim.bigSeed = (sim.seed ^ 0x3c6ef372) >>> 0 || 5;
  sim.bigSeed = (Math.imul(sim.bigSeed, 1664525) + 1013904223) >>> 0;
  return sim.bigSeed / 4294967296;
}

// The race lane: the middle lane (never the splash lane, never a closed one).
export function raceLane(sim) {
  const n = sim.lanes.length,
    splash = sim.venue.trampoline?.lane ?? -1,
    mid = Math.floor((n - 1) / 2);
  return (
    [...sim.lanes.keys()]
      .filter((l) => l !== splash && l !== sim.laneClosure)
      .sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b)[0] ?? 0
  );
}
const blockPoint = (sim, lane) => ({ x: sim.lanes[lane], z: EDGE_Z - 0.45 });
const inLane = (sim, lane) =>
  sim.people.filter((p) => p.lane === lane && ["swim", "enter", "switch"].includes(p.status) && !p.racer);

export function createBig(sim) {
  if (!sim.config.big) return null;
  return {
    kind: bigKind(sim.venue),
    at: bigTime(sim.config.duration, sim.config.big.at),
    stage: "wait", // wait · announce · live · done · skipped
    t: 0,
    result: null,
    points: 0,
    lane: -1,
    racers: [],
    guests: [],
    base: {},
  };
}

// The moment's start, kind by kind (the build-up: guests on their way, racers to the blocks, the DJ's build).
function announce(sim, B) {
  const S = sim.stats;
  B.base = {
    knockouts: S.knockouts || 0,
    overboard: S.overboard || 0,
    monkeysIn: S.monkeysIn || 0,
    fellIn: S.fellIn || 0,
    collisions: S.collisions || 0,
  };
  if (B.kind === "race") {
    B.lane = raceLane(sim);
    const senior = !!sim.venue.seniors,
      names = senior ? ["Speedy Dot", "Turbo Ted"] : ["Rocket", "Torpedo"];
    B.racers = [-1, 1].map((side, i) => makeRacer(sim, B, side, names[i], senior));
  } else if (B.kind === "encore" || B.kind === "party" || B.kind === "parade") {
    const n = T.crowd[B.kind],
      extras = Array.from({ length: n }, (_, i) => ({
        at: sim.arrivalTime + 0.4 + i * 0.7,
        type: null,
        sick: false,
        big: true,
      }));
    const rest = sim.schedule.splice(sim.nextArrival);
    sim.schedule.push(...[...rest, ...extras].sort((a, b) => a.at - b.at));
  } else if (B.kind === "headline") {
    // (everyone wants a selfie of the drop: the next one comes now)
    if (sim.roof) sim.roof.selfieIn = Math.min(sim.roof.selfieIn, 1);
  }
  const style = BIG_KINDS[B.kind];
  sim.incident(
    "big-" + B.kind,
    B.lane >= 0 ? { x: sim.lanes[B.lane], z: 0 } : sim.coach,
    B.lane >= 0 ? { lane: B.lane + 1 } : {},
  );
  sim.emit("big-announce", { kind: B.kind, in: T.announce, lane: B.lane, icon: style.icon });
}

function makeRacer(sim, B, side, name, senior) {
  const door = sim.venue.arrival,
    at = blockPoint(sim, B.lane),
    spot = { x: at.x + side * 0.42, z: at.z };
  const p = {
    id: ++sim.uid,
    name,
    type: senior ? "senior" : "advanced",
    side,
    status: "racewalk", // (walking out to the blocks: no deck contacts, so the queue never holds them up)
    racer: true,
    raceStage: "walk",
    ...door.at(side, "inside"),
    angle: 0,
    h: 100,
    wait: 0,
    waitLimit: 99,
    lane: null,
    path: [door.at(side, "outside"), ...sim.venue.route(door.at(side, "outside"), spot)],
    p: 0,
    traveled: 0,
    workTime: 0,
    workTarget: CIRCUIT,
    desiredSpeed: 4,
    actualSpeed: 0,
    blocked: 0,
    slowTime: 0,
    collisionTime: 0,
    collisionCooldown: 0,
    hadCollision: false,
    sick: false,
    queasy: false,
    stomachWarning: false,
    sicknessTimer: 99,
    sicknessDuration: 99,
    needsFins: false,
    midFins: false,
    hasFins: false,
    finsFirst: false,
    problem: null,
    irritation: 0,
    chlorineTolerance: 999,
    eyeCooldown: 0,
    skin: Math.floor(bigRandom(sim) * 5),
    shape: bigRandom(sim),
    phase: bigRandom(sim) * 6.28,
    slipTime: 0,
    stunned: 0,
    crampAt: Infinity,
    crampDone: true,
    spot,
    offset: side * 0.3,
    speed: T.raceSpeed[0] + bigRandom(sim) * (T.raceSpeed[1] - T.raceSpeed[0]),
    ...(senior && { figure: side < 0 ? "senior-granny" : "senior-grandpa" }),
  };
  if (senior) p.speed *= 0.62;
  sim.people.push(p);
  sim.keepDoorOpen(side);
  sim.emit("door-open", { side, ...door.at(side, "door") });
  sim.emit("spawn", { id: p.id });
  return p.id;
}

// The racers, each frame (sim.mjs leaves them to this: they are no customers).
function tickRacers(sim, B, dt) {
  const racers = B.racers.map((id) => sim.get(id)).filter(Boolean);
  for (const p of racers) {
    if (p.status === "exit" || p.status === "gone") continue;
    if (p.raceStage === "walk") {
      if (sim.moveAlong(p, dt, 3.6)) {
        p.raceStage = "ready";
        p.status = "racer";
        p.x = p.spot.x;
        p.z = p.spot.z;
        p.angle = 0;
      }
    } else if (p.raceStage === "swim") {
      p.p = Math.min(CIRCUIT, p.p + p.speed * dt);
      p.actualSpeed = p.speed;
      const pos = lapPosition(p.p, sim.lanes[B.lane]);
      p.x = pos.x + p.offset;
      p.z = pos.z;
      p.angle = pos.angle;
      if (p.p >= CIRCUIT) {
        p.raceStage = "done";
        if (!B.winner) {
          B.winner = p.id;
          sim.emit("race-finish", { id: p.id, name: p.name, x: p.x, z: p.z });
        }
        p.status = "exit";
        sim.beginWaterExit(p);
      }
    }
  }
  return racers;
}
// One lap of a lane: up one side, across, back down the other (sim.mjs loopPosition).
function lapPosition(p, center) {
  p = ((p % CIRCUIT) + CIRCUIT) % CIRCUIT;
  if (p < 14.4) return { x: center + 0.6, z: -7.2 + p, angle: 0 };
  if (p < 15.6) return { x: center + 0.6 - (p - 14.4), z: 7.2, angle: -Math.PI / 2 };
  if (p < 30) return { x: center - 0.6, z: 7.2 - (p - 15.6), angle: Math.PI };
  return { x: center - 0.6 + (p - 30), z: -7.2, angle: Math.PI / 2 };
}

// "On your marks…": the coach's whistle (or the starter's, when he is too slow).
export function startRace(sim, byCoach = true) {
  const B = sim.big;
  if (!B || B.kind !== "race" || B.stage !== "live" || B.started) return false;
  const racers = B.racers.map((id) => sim.get(id)).filter((p) => p?.raceStage === "ready");
  if (racers.length < B.racers.length) {
    if (byCoach) sim.emit("toast", { text: "The racers are still on their way to the blocks!" });
    return false;
  }
  const busy = inLane(sim, B.lane);
  if (byCoach && busy.length) {
    sim.emit("toast", {
      text:
        "Lane " +
        (B.lane + 1) +
        " isn’t clear! Move " +
        busy.map((p) => p.name).join(", ") +
        " to another lane first.",
      warning: true,
    });
    return false;
  }
  B.started = true;
  B.byCoach = byCoach;
  B.marks = T.marks;
  B.pileUp = busy.map((p) => p.id);
  sim.emit("race-marks", { byCoach, x: sim.lanes[B.lane], z: EDGE_Z });
  if (byCoach) sim.feedback("whistle");
  return true;
}
function goRace(sim, B) {
  const racers = B.racers.map((id) => sim.get(id)).filter(Boolean);
  for (const p of racers) {
    p.raceStage = "swim";
    p.status = "swim";
    p.p = 0;
    sim.emit("splash", { x: p.x, z: EDGE_Z + 1.5 });
  }
  sim.emit("race-go", { x: sim.lanes[B.lane], z: 0 });
  // Anyone left in the lane is swum straight into.
  for (const p of inLane(sim, B.lane).filter((q) => ["swim", "switch"].includes(q.status))) {
    p.collisionTime = 1.6;
    p.hadCollision = true;
    p.h = Math.max(0, p.h - 15);
    sim.score -= T.pileUp;
    sim.stats.collisions++;
    sim.emit("collision", { x: p.x, z: p.z, id: p.id });
    sim.emit("points", { x: p.x, z: p.z, value: -T.pileUp });
  }
  B.crashed = inLane(sim, B.lane).some((q) => ["swim", "switch"].includes(q.status));
  if (B.crashed) sim.breakStreak("race");
}

// Live, kind by kind: true when it is over (B.result set).
function live(sim, B, dt) {
  const S = sim.stats;
  if (B.kind === "race") {
    const racers = tickRacers(sim, B, dt);
    if (!B.started) {
      if (B.t >= T.raceWait) startRace(sim, false);
      return false;
    }
    if (B.marks > 0) {
      B.marks -= dt;
      if (B.marks <= 0) goRace(sim, B);
      return false;
    }
    if (racers.some((p) => p.raceStage === "swim")) return false;
    B.result = B.crashed ? "miss" : B.byCoach ? "great" : "good";
    return true;
  }
  if (B.kind === "encore" || B.kind === "party" || B.kind === "parade") {
    if (B.t < T.window[B.kind]) return false;
    const mine = sim.people.filter((p) => p.big);
    if (B.kind === "encore") {
      const zones = [...sim.lanes.keys()].filter((l) => l !== sim.laneClosure),
        good = zones.filter((l) => {
          const n = sim.people.filter((p) => p.lane === l && p.status === "swim").length;
          return n >= 2 && n <= 4;
        }).length;
      B.score = good + "/" + zones.length;
      B.result = good === zones.length ? "great" : good * 2 >= zones.length ? "good" : "miss";
    } else {
      const there = mine.filter(
        (p) => ["swim", "enter"].includes(p.status) || (p.served && p.status !== "queue"),
      ).length;
      B.score = there + "/" + mine.length;
      B.result = there >= mine.length ? "great" : there * 2 >= mine.length ? "good" : "miss";
    }
    return true;
  }
  if (B.kind === "monsters") {
    const w = sim.waves;
    if (!w) return true;
    B.launched ??= 0;
    B.held ??= 0;
    const due = Math.floor(B.t / T.monsterGap) + 1;
    while (B.launched < Math.min(T.monsters, due)) {
      B.launched++;
      if (w.state === "stopped" || w.state === "halted") B.held++;
      else {
        launch(sim, w, "monster");
        sim.emit("monster-warning", { in: 0 });
      }
    }
    if (B.t < T.monsters * T.monsterGap + 5) return false;
    const under = (S.knockouts || 0) - B.base.knockouts;
    B.result = under > 0 ? "miss" : B.held > 0 ? "good" : "great";
    return true;
  }
  if (B.kind === "headline") {
    B.spots ??= null;
    if (B.spots === null) {
      // (the drop itself: rooftop.mjs, at the bar the DJ set for it)
      if (!sim.roof || sim.roof.headlineDone) B.spots = (sim.wetSpots || []).map((s) => s.id);
      else return false;
    }
    const over = (S.overboard || 0) - B.base.overboard;
    const left = (sim.wetSpots || []).filter((s) => !B.before?.includes(s.id)).length;
    if (B.t < T.mopWindow && left > 0) return false;
    B.result = over > 0 ? "miss" : left === 0 ? "great" : "good";
    return true;
  }
  if (B.kind === "rogue") {
    if (!B.rolled) {
      if (sim.ship && rogueSwell(sim)) B.rolled = true;
      else if (B.t > 12) B.rolled = true;
      return false;
    }
    const wet = sim.people.filter((p) => p.status === "fell-in").length,
      adrift = sim.roof ? sim.roof.beds.filter((b) => b.adrift).length : 0,
      settled = !sim.ship || sim.ship.phase === "calm";
    if (B.t < T.shipWindow && !(settled && wet === 0 && adrift === 0 && B.t > 8)) return false;
    B.result = wet === 0 && adrift === 0 ? "great" : wet === 0 ? "good" : "miss";
    return true;
  }
  if (B.kind === "troop") {
    if (!B.troop) {
      B.troop = [];
      for (let i = 0; i < T.troop; i++) {
        const m = sim.onsen ? spawnMonkey(sim) : null;
        if (m) B.troop.push(m.id);
      }
    }
    const ms = (sim.onsen?.monkeys || []).filter((m) => B.troop.includes(m.id)),
      active = ms.filter((m) => !["gone", "flee"].includes(m.stage));
    if (B.t < T.troopWindow && active.length) return false;
    const got = (S.monkeysIn || 0) - B.base.monkeysIn;
    B.result = got === 0 ? "great" : got <= 1 ? "good" : "miss";
    return true;
  }
  return true;
}

function finish(sim, B) {
  B.stage = "done";
  const pts = T.points[B.result] - (B.result === "miss" && B.kind === "race" ? T.raceFail : 0);
  B.points = pts;
  sim.score += pts;
  sim.stats.big = { kind: B.kind, result: B.result, points: pts };
  const words = BIG_RESULTS[B.result].words[B.kind],
    where = B.lane >= 0 ? { x: sim.lanes[B.lane], z: 0 } : { x: sim.coach.x, z: sim.coach.z };
  if (B.result !== "miss") sim.save("big-" + B.result, where, pts, { name: words });
  else {
    sim.breakStreak("big");
    if (pts) sim.emit("points", { ...where, value: pts });
  }
  sim.emit("big-done", {
    kind: B.kind,
    result: B.result,
    points: pts,
    words,
    score: B.score ?? null,
    ...where,
  });
}

// Can the moment begin now? Not during a rescue, a clean-up or a closed pool.
const clear = (sim) => !sim.rescue && !sim.cleanup && !sim.closed;

export const BigMoment = {
  key: "big",
  init(sim) {
    sim.big = null; // (sim.mjs creates it once the config is known: createBig)
  },
  isActive: () => false,
  describe(sim) {
    const B = sim.big;
    return B && B.stage !== "wait"
      ? "big " + B.kind + " · " + B.stage + (B.result ? " · " + B.result : "")
      : "";
  },
  update(sim, dt) {
    const B = sim.big;
    if (!B || sim.status !== "playing" || B.stage === "done" || B.stage === "skipped") return;
    if (B.stage === "wait") {
      if (sim.time < B.at - T.announce) return;
      if (sim.config.duration - sim.time < T.room - 4) {
        B.stage = "skipped";
        return;
      }
      if (!clear(sim)) return;
      B.stage = "announce";
      B.t = 0;
      B.before = (sim.wetSpots || []).map((s) => s.id);
      announce(sim, B);
      return;
    }
    B.t += dt;
    if (B.stage === "announce") {
      if (B.kind === "race") tickRacers(sim, B, dt);
      if (B.t < T.announce) return;
      B.stage = "live";
      B.t = 0;
      sim.emit("big-live", { kind: B.kind });
      return;
    }
    if (live(sim, B, dt)) finish(sim, B);
  },
  interactions(sim, options) {
    const B = sim.big;
    if (!B || B.kind !== "race" || B.stage !== "live" || B.started) return;
    const at = blockPoint(sim, B.lane);
    if (distance(sim.coach, at) > T.whistleReach) return;
    options.push({
      kind: "whistle",
      label: "Blow the whistle: start the race!",
      ...at,
      rank: -30 + distance(sim.coach, at),
      run: () => startRace(sim, true),
    });
  },
  alert(sim, alerts) {
    const B = sim.big;
    if (!B || !["announce", "live"].includes(B.stage)) return;
    if (B.kind === "race" && !B.started) {
      const busy = inLane(sim, B.lane),
        at = blockPoint(sim, B.lane);
      if (busy.length) {
        const p = busy[0];
        alerts.push({
          kind: "big",
          icon: "🏁",
          label: "Clear lane " + (B.lane + 1),
          x: p.x,
          z: p.z,
          y: 1.2,
          urgency: 70,
        });
      } else if (B.stage === "live")
        alerts.push({
          kind: "big",
          icon: "📯",
          label: "Start the race",
          x: at.x,
          z: at.z,
          y: 1.4,
          urgency: 72,
        });
    }
  },
  hint(sim) {
    const B = sim.big;
    if (!B || !["announce", "live"].includes(B.stage)) return "";
    if (B.kind === "race" && !B.started) {
      const busy = inLane(sim, B.lane);
      return busy.length
        ? "🏁 Clear lane " + (B.lane + 1) + " for the race: move " + busy[0].name + " to another lane"
        : B.stage === "live"
          ? "🏁 Lane clear! Blow the whistle at the blocks · E"
          : "🏁 Lane " + (B.lane + 1) + " is clear. Get to the blocks!";
    }
    return "";
  },
  // The banner over the pool: the moment's name, what to do, and its clock.
  panel(sim) {
    const B = sim.big;
    if (!B || !["announce", "live"].includes(B.stage)) return null;
    const style = BIG_KINDS[B.kind];
    let task = style.verb.replace("{lane}", B.lane + 1),
      fuse = null;
    if (B.stage === "announce") {
      task = "In " + Math.max(1, Math.ceil(T.announce - B.t)) + " · " + task;
      fuse = { left: T.announce - B.t, total: T.announce };
    } else if (B.kind === "race") {
      if (!B.started) {
        const busy = inLane(sim, B.lane).length;
        task = busy
          ? busy + " still in lane " + (B.lane + 1) + "! Move them out"
          : "Lane clear · whistle at the blocks (E)!";
        fuse = { left: Math.max(0, T.raceWait - B.t), total: T.raceWait };
      } else task = B.marks > 0 ? "On your marks… get set…" : "GO! GO! GO!";
    } else {
      const win =
        B.kind === "monsters"
          ? T.monsters * T.monsterGap + 5
          : B.kind === "headline"
            ? T.mopWindow
            : B.kind === "rogue"
              ? T.shipWindow
              : B.kind === "troop"
                ? T.troopWindow
                : T.window[B.kind];
      fuse = { left: Math.max(0, win - B.t), total: win };
    }
    return {
      icon: style.icon,
      title: "⭐ " + style.title,
      task,
      ...(fuse && { timer: fuse.left / fuse.total }),
      big: true,
    };
  },
};
