// The Jumping Pool (24 October 2026, the creator: "assign each guest the correct height before they climb… correct height:
// successful jump and points; wrong height: higher chance of failed jump… make sure that player can make a mistake and assign the
// beginner to the highest platform and that will increase the failed by a lot!! and of course the point systems needs to be
// accordingly… also an advanced assign to a low end creates frustration and little points here!! lets do a nice gravity system here
// so the jumps are random and funny not all systematic and the same!! players need to laugh here!"). The plan is dive-plan.mjs.
//
// A guest comes in through a garden gate and waits on the lawn. The coach sends them to a height (LOW 1, MID 2, HIGH 3) or, if
// they only came for it, to the hot tub (4). A diver walks to that height's board at the end with the shorter line, waits in line,
// climbs its stairs, walks out to the tip, hesitates (a scared one peers over the edge, knees knocking), waits until the water
// below is clear, and jumps: off the springboard after two bounces, off a platform with a hop. The flight is a real throw under
// gravity (`G`): a launch speed up, a speed out over the water, a number of somersaults and twists, all drawn afresh for every
// jump, so no two dives are the same. Where the spin has got to when they hit the water decides the entry: clean (straight in,
// head or feet first), sloppy, or flat (a belly or back flop: SMACK). The right height (beginners LOW, intermediates MID, Pros
// HIGH) is mostly clean dives and full points; a height too high is a gamble that mostly ends in a failed jump: an uncontrolled
// tumble, a huge splash, and the diver winded in the water, needing the life ring (the same rescue as a cramp) and then a
// massage (the corner's two beds) or home. A height too low bores a Pro: little points and a cross guest.
//
// Some confident-looking guests are not what they seem (`bluff`, the 😎 show-offs, from level 4): they say they are Pros, and a
// few are; most are beginners. They never hesitate at the edge. The coach can check one (E beside them: a moment) before sending
// them up. From level 5, now and then someone cuts a line (`cut`): they push to the front of a board's line and argue there, the
// line growing crosser, until the coach sends them to the back (E beside them). Carl and the leopard man come to dive (no
// incident here: they are guests), intermediate or Pro, and every dive of theirs is a cannonball, the leopard man's with a flip.
//
// The hot tub (`TUB`) is for the guests who only came for it (♨️): six seats, a soak, and the tummy trouble of any pool (a poo or
// a wee closes the tub, not the diving pool). Nobody in the diving pool has tummy trouble or cramps, and nobody needs fins.
//
// Everything here draws from a stream of its own (`diveRandom`), so the rest of the shift draws what it would anywhere.
import {
  DIVE,
  HEIGHTS,
  BOARDS,
  TUB,
  TUB_LANE,
  LINE_ROOM,
  LINE_MAX,
  LANDING,
  landingSpot,
  nearestLadder,
  tubSteps,
  tubSeats,
  tubLocal,
  clampInTub,
  tubEdge,
  tubOutPath,
} from "./dive-plan.mjs";
import { WetSpots, addWetSpot } from "./incidents/wet.mjs";
import { Massage } from "./incidents/massage.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (t) => t * t * (3 - 2 * t);

// Gravity, m/s² (a diver from the 6 m platform falls for about a second and a half).
export const G = 9.8;
export const SKILL = { beginner: 0, intermediate: 1, advanced: 2 };
export const SKILL_TYPES = ["beginner", "intermediate", "advanced"];

export const DIVE_TUNING = {
  walk: 3.2, // m/s to the board's line
  shuffle: 1.6, // m/s moving up the line
  boardWalk: 1.9, // m/s out along the board (a scared diver: `scaredWalk`)
  scaredWalk: 1.0,
  bounce: 0.8, // s of bouncing on the springboard
  under: 0.75, // s under the water after the entry
  swim: 2.1, // m/s to the ladder
  ladder: 0.75, // s up the ladder
  lineMood: 1.25, // mood lost a second in line (about a third of the queue's)
  boredMood: 2.2, // …for a Pro sent to the LOW board
  crowdMood: 0.7, // more, for each one over LINE_ROOM in a line
  edgeMood: 1.6, // mood lost a second waiting at the edge for the water to clear
  edgeWait: 11, // s at the edge before a diver goes anyway, clear or not
  // What a dive is worth at each height, and the multipliers.
  points: [120, 170, 240],
  clean: 40, // a clean entry's style bonus
  sloppy: 0.75,
  flop: 0.45, // a belly flop off the springboard (funny, no harm)
  slap: 0.4, // a flat landing off a platform that did not need a rescue (it stings)
  tooLow: [0.35, 0.2], // one height too low, two
  boredHit: [30, 50], // mood lost by a Pro (or an intermediate) sent too low, one height, two
  slapHit: 25,
  fail: [0, 150, 220], // points lost for a failed jump from MID, from HIGH
  chicken: 60, // points lost when a diver climbs back down
  cannonball: 60, // Carl's and the leopard man's extra for the right height
  // The boards open as the shift gets going (the creator: "Opening: low only. Medium opens. High opens."): at these shares of the
  // shift, never before or after these seconds.
  opens: [
    [0, 0, 0],
    [0.12, 8, 25],
    [0.28, 18, 55],
  ],
  // The show-offs: from this level, this share of guests (and what they really are: beginner, intermediate, Pro).
  bluffFrom: 4,
  bluffShare: 0.16,
  bluffTruth: [0.6, 0.15, 0.25],
  check: 0.6, // s checking a show-off (busy)
  checkReach: 1.7,
  // The line-cutters: from this level, one every so often; the argument at the front, and the coach's reward.
  cutFrom: 5,
  cutEvery: [26, 44],
  argue: 7,
  cutMood: 3.2,
  cutHit: 15,
  cutPoints: 40,
  cutReach: 1.7,
  // The hot tub's guests and the soak.
  tubShare: 0.2,
  tubSick: 0.3,
  soak: [20, 30],
  step: 0.85,
  wade: 0.8,
  relax: 0.6,
  closing: 9,
  // Carl and the leopard man: when they come (shares of the arrivals), and a second one from this level.
  bigGuys: [0.45, 0.78],
  secondFrom: 9,
};
const T = DIVE_TUNING;

// The Jumping Pool's own stream.
export function diveRandom(sim) {
  sim.diveSeed = (Math.imul(sim.diveSeed || (sim.seed ^ 0x0d17e5) >>> 0 || 13, 1664525) + 1013904223) >>> 0;
  return sim.diveSeed / 4294967296;
}
const between = (sim, [a, b]) => a + diveRandom(sim) * (b - a);
const pick = (sim, list) => list[Math.floor(diveRandom(sim) * list.length) % list.length];

export function createDive(sim) {
  const d = sim.config.duration || 120;
  const D = {
    boards: BOARDS.map((b) => ({ id: b.id, line: [], up: null })),
    opens: T.opens.map(([k, a, b]) => (k ? clamp(k * d, a, b) : 0)),
    told: {},
    cut: null,
    nextCut: between(sim, T.cutEvery),
    arrivals: 0,
    bigGuys: [],
  };
  // Carl and the leopard man: which arrivals they are (the first at about half the shift's guests, a second later on from level
  // 9), and which of them comes first (by the seed).
  const n = sim.config.total || 10,
    first = diveRandom(sim) < 0.5 ? "carl" : "leopard";
  D.bigGuys = [{ at: Math.max(3, Math.round(n * T.bigGuys[0])), figure: first }];
  if (sim.level >= T.secondFrom)
    D.bigGuys.push({
      at: Math.max(5, Math.round(n * T.bigGuys[1])),
      figure: first === "carl" ? "leopard" : "carl",
    });
  return D;
}

// ---- the guests ----------------------------------------------------------------------------------------------------------

// A new guest at the Jumping Pool (sim.spawn): a diver of the type they were drawn (only beginners until the MID board opens, no
// Pros until the HIGH one does), maybe a show-off, maybe only here for the hot tub, maybe Carl or the leopard man. Nobody needs
// fins and nobody cramps; only the hot tub's guests can have tummy trouble.
export function diveSpawn(sim, p, spec = {}) {
  const D = sim.dive,
    k = D.arrivals++;
  Object.assign(p, { needsFins: false, midFins: false, finsFirst: false, hasFins: false, crampAt: Infinity });
  if (p.problem === "fins") p.problem = null;
  if (!SKILL_TYPES.includes(p.type)) p.type = "intermediate";
  const t = sim.arrivalTime;
  if (!p.star) {
    if (t < D.opens[1] - 2 && p.type !== "beginner") p.type = "beginner";
    else if (t < D.opens[2] - 2 && p.type === "advanced") p.type = "intermediate";
  }
  const roll = diveRandom(sim),
    truth = diveRandom(sim),
    sick = diveRandom(sim),
    guy = D.bigGuys.find((g) => g.at === k);
  if (guy && !p.star && !p.vip) {
    // Carl or the leopard man, here to dive (the creator: "not incidents!!! with random heights… sometime they spawn as
    // intermediate, or advanced… and do flips"). They are who they say they are.
    p.figure = guy.figure;
    p.bigGuy = guy.figure;
    p.name = guy.figure === "carl" ? "Carl" : "Leopard Man";
    p.type = truth < 0.5 ? "intermediate" : "advanced";
    p.sick = false;
    return p;
  }
  if (!p.star && !spec.big && roll < T.tubShare) {
    // Only here for the hot tub (♨️): they will not dive.
    p.tubOnly = true;
    if (sim.level >= 3 && !p.vip && sick < T.tubSick) {
      p.sick = true;
      p.stomachDelay = 4 + truth * 6;
      p.sickKind = p.phase < Math.PI * 2 * (sim.config.peeShare ?? 0.45) ? "pee" : "poo";
    }
    return p;
  }
  p.sick = false;
  p.sickKind = null;
  if (!p.star && sim.level >= T.bluffFrom && roll < T.tubShare + T.bluffShare) {
    // A show-off: says Pro, and might be one. (Never before the HIGH board opens: they would only stand there.)
    p.bluff = true;
    const [b, i] = T.bluffTruth;
    p.type = truth < b ? "beginner" : truth < b + i ? "intermediate" : "advanced";
  }
  return p;
}
// The type a guest says they are (a show-off says Pro until the coach has checked).
export const shownType = (p) => (p.bluff && !p.revealed ? "advanced" : p.type);
export const skillOf = (p) => SKILL[p.type] ?? 1;

// ---- sending guests ------------------------------------------------------------------------------------------------------

export const boardOpen = (sim, h) => sim.arrivalTime >= (sim.dive?.opens[h] ?? 0);
// How long a board's line is: those walking to it or waiting in it, and whoever is on its stairs or board.
export function lineLength(sim, b) {
  const B = sim.dive.boards[b];
  return B.line.length + (B.up != null ? 1 : 0);
}
// Which of the two boards of height `h` a guest goes to: the one with the shorter line (their own end's on a tie).
export function chooseBoard(sim, p, h) {
  const [a, b] = [h, 3 + h],
    la = lineLength(sim, a),
    lb = lineLength(sim, b);
  if (sim.dive.boards[a].line.length >= LINE_MAX && sim.dive.boards[b].line.length >= LINE_MAX) return -1;
  if (sim.dive.boards[a].line.length >= LINE_MAX) return b;
  if (sim.dive.boards[b].line.length >= LINE_MAX) return a;
  if (la !== lb) return la < lb ? a : b;
  return (p.side ?? -1) < 0 ? a : b;
}

// The coach's numbers at the Jumping Pool (sim.assign): 1 to 3 a height, 4 the hot tub. A guest already walking to a board, or
// waiting in its line, can be sent somewhere else. False when it cannot be done.
export function sendDiver(sim, lane) {
  const p = sim.get(sim.selected);
  if (!p || !(p.status === "queue" || (p.status === "dive" && ["walk", "line"].includes(p.dive)))) {
    sim.emit("toast", { text: "Pick a waiting guest first, then a height (1–3) or the hot tub (4)." });
    return false;
  }
  if (lane === TUB_LANE) return sendToTub(sim, p);
  if (p.tubOnly) {
    sim.emit("toast", { text: p.name + " only came for the hot tub ♨️! Send them there (4)." });
    sim.emit("lane-refused", { lane });
    return false;
  }
  if (!boardOpen(sim, lane)) {
    const left = Math.ceil(sim.dive.opens[lane] - sim.arrivalTime);
    sim.emit("toast", {
      text:
        "The " +
        HEIGHTS[lane].name +
        " board opens in " +
        left +
        " s. Send them to a lower one, or let them wait.",
      warning: true,
    });
    sim.emit("lane-refused", { lane });
    return false;
  }
  if (p.status === "dive" && p.board != null && BOARDS[p.board].h === lane) {
    sim.emit("toast", { text: p.name + " is already going up the " + HEIGHTS[lane].name + " board." });
    return false;
  }
  const b = chooseBoard(sim, p, lane);
  if (b < 0) {
    sim.emit("toast", {
      text: "Both " + HEIGHTS[lane].name + " lines are full! Try another height.",
      warning: true,
    });
    sim.emit("lane-refused", { lane });
    return false;
  }
  if (p.status === "dive") leaveLine(sim, p);
  else {
    p.assignedAt = sim.time;
    sim.stats.totalWait += p.wait;
  }
  joinLine(sim, p, b);
  // The verdict is the dive itself: a word now only when the coach could know (the shown type).
  const diff = lane - SKILL[shownType(p)];
  if (diff < 0 && !p.told) {
    p.told = true;
    sim.emit("toast", { text: "😒 " + p.name + " sighs: “The " + HEIGHTS[lane].name + " board? Really?”" });
  } else if (diff > 0 && !p.told) {
    p.told = true;
    sim.emit("toast", {
      text: "😰 " + p.name + " gulps at the " + HEIGHTS[lane].name + " board…",
      warning: true,
    });
  }
  sim.emit("assigned", { id: p.id, lane });
  sim.selected = null;
  return true;
}
function joinLine(sim, p, b) {
  const B = sim.dive.boards[b];
  B.line.push(p.id);
  p.status = "dive";
  p.board = b;
  p.dive = "walk";
  p.lane = null;
  p.y = 0;
  p.jump = null;
  p.edgeWait = 0;
  p.path = sim.venue.route(p, lineSpot(sim, b, B.line.length - 1));
}
function leaveLine(sim, p) {
  if (p.board == null) return;
  const B = sim.dive.boards[p.board];
  B.line = B.line.filter((id) => id !== p.id);
  if (B.up === p.id) B.up = null;
  if (sim.dive.cut?.id === p.id) sim.dive.cut = null;
}
// Where the k-th in a board's line stands (past the end of the line: crowding round its last place).
export function lineSpot(sim, b, k) {
  const spots = BOARDS[b].line;
  if (k < spots.length) return spots[k];
  const last = spots[spots.length - 1];
  return { x: last.x + ((k % 2) * 2 - 1) * 0.75, z: last.z };
}

// ---- the divers ----------------------------------------------------------------------------------------------------------

// A diver, each frame (sim.mjs calls it for everyone whose status is "dive"). True while it has them.
export function tickDiver(sim, p, dt) {
  if (p.status !== "dive") return false;
  const b = BOARDS[p.board],
    B = sim.dive.boards[p.board],
    H = HEIGHTS[b.h];
  switch (p.dive) {
    case "walk":
    case "line": {
      const k = B.line.indexOf(p.id),
        spot = lineSpot(sim, p.board, k < 0 ? 0 : k);
      if (p.dive === "walk") {
        if (sim.moveAlong(p, dt, sim.pace(p, T.walk))) p.dive = "line";
      } else if (distance(p, spot) > 0.05) {
        p.path = [spot];
        sim.moveAlong(p, dt, T.shuffle);
      } else p.angle = b.angle; // (facing the pool, waiting)
      lineMood(sim, p, b, B, dt);
      if (p.status !== "dive") return true;
      // First in line, the board free and open, nobody arguing at the front: up the stairs.
      if (
        p.dive === "line" &&
        k === 0 &&
        B.up == null &&
        boardOpen(sim, b.h) &&
        distance(p, spot) < 0.3 &&
        !(sim.dive.cut?.id === p.id && sim.dive.cut.argue > 0)
      ) {
        B.line.shift();
        B.up = p.id;
        p.dive = "climb";
        p.diveT = 0;
        p.x = b.x;
        p.z = b.footZ;
        p.angle = b.angle;
        if (sim.dive.cut?.id === p.id) cutThrough(sim, p);
        sim.emit("dive-climb", { id: p.id, h: b.h });
      }
      return true;
    }
    case "climb": {
      p.diveT = Math.min(1, p.diveT + dt / H.climb);
      p.x = b.x;
      p.z = b.footZ + (b.topZ - b.footZ) * p.diveT;
      p.y = H.y * p.diveT;
      p.angle = b.angle;
      if (p.diveT === 1) {
        p.dive = "out";
        p.path = [{ x: b.x, z: b.tipZ }];
      }
      return true;
    }
    case "out": {
      const scared = skillOf(p) < b.h && !p.bluff;
      p.y = H.y;
      if (sim.moveAlong(p, dt, scared ? T.scaredWalk : T.boardWalk)) {
        p.dive = "edge";
        p.angle = b.angle;
        planJump(sim, p, b);
        if (p.jump.scared) sim.emit("dive-scared", { id: p.id, h: b.h, x: p.x, z: p.z });
      }
      return true;
    }
    case "edge": {
      p.y = H.y;
      p.angle = b.angle;
      p.hesitate = Math.max(0, p.hesitate - dt);
      if (p.hesitate > 0) return true;
      if (sim.time >= sim.config.duration) return true; // (the time is up: the last jumps in flight land, nobody new goes)
      if (p.jump.outcome === "chicken") return chickenOut(sim, p, b);
      // (Nobody jumps into a rescue, a loose fish or a blackout: they wait at the edge.)
      const clear =
        landingClear(sim, p, b) &&
        !sim.rescue &&
        !(sim.fish?.stage === "loose") &&
        sim.outage?.stage !== "dark";
      if (!clear) {
        p.edgeWait += dt;
        p.h = Math.max(0, p.h - dt * T.edgeMood * (p.vip ? 1.4 : 1));
        if (!sim.dive.told.edge && p.edgeWait > 1.5) {
          sim.dive.told.edge = true;
          sim.emit("toast", {
            text: "🤸 " + p.name + " is waiting for the water below to clear. Keep the landing spot empty!",
          });
        }
        // Too long: off they go, clear or not.
        if (p.edgeWait < T.edgeWait || sim.rescue || sim.fish?.stage === "loose") return true;
        sim.emit("toast", {
          text: p.name + " can't wait any longer and jumps! Look out below!",
          warning: true,
        });
      }
      launch(sim, p, b);
      return true;
    }
    case "bounce": {
      // Two bounces on the springboard, the second deeper (the board bends: the scene's), then up.
      p.diveT = Math.min(1, p.diveT + dt / T.bounce);
      const phase = p.diveT * 2,
        k = Math.min(1, Math.floor(phase));
      p.y = H.y + Math.sin((phase - k) * Math.PI) * (k ? 0.55 : 0.32);
      p.bend = -Math.sin((phase - k) * Math.PI * 2) * 0.5; // (how far the board dips: the scene's)
      if (k !== p.bounceK) {
        p.bounceK = k;
        sim.emit("dive-bounce", { id: p.id, x: p.x, z: p.z, k });
      }
      if (p.diveT === 1) fly(sim, p, b);
      return true;
    }
    case "air": {
      const J = p.jump;
      J.t = Math.min(J.T, J.t + dt);
      p.diveT = J.t / J.T;
      p.x = b.x + J.drift * J.t;
      p.z = b.tipZ + b.dir * J.u * J.t;
      p.y = J.y0 + J.vy * J.t - (G * J.t * J.t) / 2;
      if (J.t >= J.T) impact(sim, p, b);
      return true;
    }
    case "under": {
      p.diveT = Math.min(1, p.diveT + dt / T.under);
      p.y = -0.9 * Math.sin(p.diveT * Math.PI);
      if (p.diveT === 1) {
        p.y = 0;
        p.dive = "swimOut";
        const l = nearestLadder(p, b.h === 1 ? (p.id % 2 ? -1 : 1) : b.h === 0 ? -1 : 1);
        p.ladder = l;
        p.path = [{ x: l.water.x, z: clamp(p.z, -DIVE.halfZ + 0.8, DIVE.halfZ - 0.8) }, { ...l.water }];
      }
      return true;
    }
    case "swimOut": {
      p.actualSpeed = T.swim;
      if (sim.moveAlong(p, dt, T.swim)) {
        p.dive = "ladder";
        p.diveT = 0;
      }
      return true;
    }
    case "ladder": {
      const l = p.ladder;
      p.diveT = Math.min(1, p.diveT + dt / T.ladder);
      const e = smooth(p.diveT);
      p.x = l.water.x + (l.deck.x - l.water.x) * e;
      p.z = l.deck.z;
      p.angle = l.angle;
      p.actualSpeed = 0;
      if (p.diveT === 1) outOnDeck(sim, p, l.deck);
      return true;
    }
    case "down": {
      // Chickened out: back along the board and down the stairs, the walk of shame.
      p.diveT = Math.min(1, p.diveT + dt / (H.climb * 0.8 + 1));
      const e = p.diveT;
      p.z = b.tipZ + (b.footZ - b.tipZ) * e;
      p.y = H.y * (1 - clamp((e - 0.35) / 0.65, 0, 1));
      p.angle = b.angle + Math.PI;
      if (p.diveT === 1) {
        p.y = 0;
        if (B.up === p.id) B.up = null;
        p.board = null;
        p.dive = null;
        p.status = "exit";
        p.exitPhase = "deck";
        p.path = homePath(sim, p);
      }
      return true;
    }
  }
  return true;
}

// The line: patience, a bored Pro, a crowded line, a cutter at the front.
function lineMood(sim, p, b, B, dt) {
  const bored = skillOf(p) > b.h,
    over = Math.max(0, B.line.length - LINE_ROOM),
    cut =
      sim.dive.cut && sim.dive.cut.board === p.board && sim.dive.cut.id !== p.id && sim.dive.cut.argue > 0;
  const rate =
    (bored ? T.boredMood : T.lineMood) + over * T.crowdMood + (cut ? T.cutMood : 0) * (p.vip ? 1.4 : 1);
  p.h = Math.max(0, p.h - dt * rate * (p.vip ? 1.3 : 1) * (100 / Math.max(10, p.waitLimit * 2)) * 0.5);
  if (over > 0 && !sim.dive.told["crowd" + p.board]) {
    sim.dive.told["crowd" + p.board] = true;
    sim.emit("toast", {
      text: "The " + HEIGHTS[b.h].name + " line is packed! Send some of them to the other end.",
      warning: true,
    });
  }
  if (p.h <= 0) {
    leaveLine(sim, p);
    p.board = null;
    p.dive = null;
    p.status = "queue"; // (lose() walks them home from wherever they stand)
    sim.lose(p);
  }
}

// Is the water below a board's landing spot clear? Nobody in it within LANDING.reach (a diver swimming out, a rescue, the coach).
export function landingClear(sim, p, b) {
  const at = p.jump?.land || landingSpot(b, 1.6);
  for (const q of sim.people) {
    if (q === p) continue;
    const inPool =
      (q.status === "dive" && ["under", "swimOut"].includes(q.dive)) ||
      (q.status === "swim" && q.lane !== TUB_LANE) ||
      (q.status === "exit" && q.exitPhase === "water" && q.diveExit);
    if (inPool && distance(q, at) < LANDING.reach) return false;
  }
  for (const c of sim.coaches)
    if ((c.swimming || c.waterTransition) && distance(c, at) < LANDING.reach) return false;
  return true;
}

// The jump, drawn when the diver gets to the edge: what kind of dive they mean (their style), how it will go (the odds of their
// height against their skill), and the throw that makes it so (the launch, the spin to the entry it ends in).
export const STYLES = {
  pencil: { turns: 0, label: "pencil jump" },
  dive: { turns: 0.5, label: "header" },
  pike: { turns: 0.5, pike: true, label: "pike dive" },
  flip: { turns: 1.5, tuck: true, label: "front flip" },
  back: { turns: -1, tuck: true, label: "back flip" },
  twist: { turns: 1.5, twist: 1, label: "twisting flip" },
  double: { turns: 2.5, pike: true, label: "double somersault" },
  triple: { turns: 3.5, tuck: true, label: "triple!" },
  lazy: { turns: 0, lazy: true, label: "bored pencil" },
  cannonball: { turns: 0, ball: true, label: "CANNONBALL" },
  flipball: { turns: 1, ball: true, tuck: true, label: "flip into a CANNONBALL" },
};
function styleFor(sim, p, h) {
  const s = skillOf(p);
  if (p.bigGuy) return p.bigGuy === "leopard" && diveRandom(sim) < 0.6 ? "flipball" : "cannonball";
  if (p.star) return "triple";
  if (s > h) return "lazy";
  if (s === 0) return diveRandom(sim) < 0.55 ? "pencil" : "dive";
  if (s === 1)
    return h === 0 ? pick(sim, ["dive", "pike", "pencil"]) : pick(sim, ["flip", "back", "flip", "dive"]);
  return h === 2 ? pick(sim, ["double", "triple", "twist", "double"]) : pick(sim, ["flip", "twist", "back"]);
}
// The odds of each outcome, by how far above the diver's skill the height is (`diff`) and the height.
export function outcomeOdds(diff, h, level = 1) {
  let o;
  if (diff < 0) o = { clean: 0.82, sloppy: 0.14, flop: 0.04 };
  else if (diff === 0)
    o =
      h === 0
        ? { clean: 0.66, sloppy: 0.22, flop: 0.12 }
        : { clean: 0.68, sloppy: 0.18, flop: 0.07, fail: 0.07 };
  else if (diff === 1) o = { clean: 0.18, sloppy: 0.2, flop: 0.14, fail: 0.4, chicken: 0.08 };
  else o = { clean: 0.04, sloppy: 0.06, flop: 0.08, fail: 0.7, chicken: 0.12 };
  if (o.fail) o.fail *= 1 + (Math.min(20, level) - 1) * 0.012;
  const total = Object.values(o).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / total]));
}
function rollOutcome(sim, odds) {
  let r = diveRandom(sim);
  for (const [k, v] of Object.entries(odds)) if ((r -= v) < 0) return k;
  return "clean";
}
export function planJump(sim, p, b) {
  const s = skillOf(p),
    diff = b.h - s,
    H = HEIGHTS[b.h],
    style = styleFor(sim, p, b.h),
    S = STYLES[style],
    outcome = rollOutcome(sim, outcomeOdds(diff, b.h, sim.level));
  // The launch: off the springboard high (it throws them), off a platform a hop; a scared diver barely leaves the board.
  const scared = diff > 0 && !p.bluff;
  const vy = H.spring
    ? between(sim, [4.3, 5.4])
    : scared
      ? between(sim, [0.5, 1.5])
      : style === "lazy"
        ? between(sim, [0.4, 1.0])
        : between(sim, [1.8, 3.1]);
  const u = (scared ? between(sim, [0.5, 1.1]) : between(sim, [0.9, 1.9])) * (S.ball ? 1.15 : 1),
    y0 = H.y + (H.spring ? 0.55 : 0),
    Tf = (vy + Math.sqrt(vy * vy + 2 * G * y0)) / G;
  // How far from a straight entry (in turns: 0 is straight in; a quarter turn is flat on the water) the spin ends.
  const off =
    outcome === "clean"
      ? between(sim, [0, 0.045])
      : outcome === "sloppy"
        ? between(sim, [0.07, 0.14])
        : outcome === "flop"
          ? between(sim, [0.21, 0.27])
          : between(sim, [0.19, 0.3]);
  const sign = diveRandom(sim) < 0.5 ? -1 : 1;
  // A failed jump spins out of control: a half turn or a whole one more (or less) than meant, and the arms flail.
  const extra = outcome === "fail" ? pick(sim, [-1, -0.5, 0.5, 1, 1.5]) : 0;
  let turns = S.turns + extra + sign * off;
  // (A diver meaning to go in feet first who ends flat goes in on the back or the belly: either way it is a quarter turn.)
  const twist = S.twist
    ? S.twist + (outcome === "clean" ? 0 : between(sim, [-0.3, 0.3]))
    : outcome === "fail"
      ? between(sim, [-0.6, 0.6])
      : 0;
  const hesitate =
    (scared ? between(sim, [2.2, 4.5]) : between(sim, [0.25, 0.9])) + (b.h === 2 && !p.bluff ? 0.4 : 0);
  p.hesitate = outcome === "chicken" ? hesitate + 1.5 : hesitate;
  p.jump = {
    style,
    outcome,
    diff,
    scared,
    vy,
    u,
    y0,
    T: Tf,
    t: 0,
    turns,
    twist,
    drift: between(sim, [-0.25, 0.25]),
    // The tuck, as shares of the flight (the scene opens out for the entry); a failed jump flails instead.
    tuck: S.tuck || S.ball ? [between(sim, [0.08, 0.2]), between(sim, [0.6, 0.85])] : null,
    pike: !!S.pike,
    ball: !!S.ball,
    lazy: !!S.lazy,
    flail: outcome === "fail" || (outcome === "flop" && diff > 0),
    land: landingSpot(b, u * Tf),
    seed: diveRandom(sim),
  };
  return p.jump;
}
function launch(sim, p, b) {
  const H = HEIGHTS[b.h];
  if (H.spring) {
    p.dive = "bounce";
    p.diveT = 0;
    p.bounceK = -1;
    return;
  }
  fly(sim, p, b);
}
function fly(sim, p, b) {
  const B = sim.dive.boards[p.board];
  p.dive = "air";
  p.diveT = 0;
  p.bend = 0;
  p.jump.t = 0;
  p.y = p.jump.y0;
  // Off the board: the next in line can start up the stairs.
  if (B.up === p.id) B.up = null;
  sim.emit("dive-launch", { id: p.id, h: b.h, style: p.jump.style, x: p.x, z: p.z });
}

// Into the water: the entry the spin ended in, the splash, the points, and what comes next.
function impact(sim, p, b) {
  const J = p.jump,
    H = HEIGHTS[b.h];
  p.y = 0;
  p.x = clamp(p.x, -DIVE.halfX + 0.7, DIVE.halfX - 0.7);
  p.z = clamp(p.z, -DIVE.halfZ + 0.9, DIVE.halfZ - 0.9);
  const flat = J.outcome === "flop" || J.outcome === "fail",
    size = (J.ball ? 1.6 : flat ? 1.3 : J.outcome === "sloppy" ? 0.8 : 0.45) * (0.6 + b.h * 0.3);
  // Anyone left in the landing spot is landed on: they and the diver both need the ring.
  const under = sim.people.filter(
    (q) =>
      q !== p &&
      distance(q, p) < 1.0 &&
      ((q.status === "dive" && ["under", "swimOut"].includes(q.dive)) ||
        (q.status === "swim" && q.lane !== TUB_LANE)),
  );
  sim.emit("dive-splash", {
    id: p.id,
    x: p.x,
    z: p.z,
    h: b.h,
    size,
    outcome: J.outcome,
    style: J.style,
    ball: J.ball,
    flat,
  });
  sim.stats.dives = (sim.stats.dives || 0) + 1;
  // A cannonball from up high soaks the deck nearby: a wet spot by the pool's edge.
  if (J.ball && b.h >= 1 && Math.abs(p.x) > DIVE.halfX - 2.2)
    addWetSpot(sim, Math.sign(p.x) * (DIVE.halfX + 1.0), p.z);
  if (J.outcome === "fail" || under.length) return failed(sim, p, b, under);
  scoreDive(sim, p, b);
  p.dive = "under";
  p.diveT = 0;
}

// What a dive is worth, as it hits the water: the height's points, the entry, the right height or not, and the usual service
// bonuses. A served guest.
function scoreDive(sim, p, b) {
  const J = p.jump,
    diff = J.diff,
    H = HEIGHTS[b.h];
  let points = T.points[b.h],
    word = "";
  if (J.outcome === "clean") {
    if (diff >= 0) points += T.clean;
    word = J.ball ? "💣 CANNONBALL!" : diff > 0 ? "😅 Lucky!" : "✨ Clean " + STYLES[J.style].label + "!";
    sim.stats.cleanDives = (sim.stats.cleanDives || 0) + 1;
    if (J.ball && diff === 0) points += T.cannonball;
    if (!J.ball && b.h >= 1 && ["flip", "back", "twist", "double", "triple", "flipball"].includes(J.style))
      sim.stats.flips = (sim.stats.flips || 0) + 1;
  } else if (J.outcome === "sloppy") {
    points *= T.sloppy;
    word = "💦 Splashy!";
  } else if (b.h === 0) {
    points *= T.flop;
    p.h = Math.max(0, p.h - 12);
    word = "🫃 BELLY FLOP!";
    sim.stats.flops = (sim.stats.flops || 0) + 1;
  } else {
    points *= T.slap;
    p.h = Math.max(0, p.h - T.slapHit);
    word = "💥 SMACK! That stung!";
    sim.stats.flops = (sim.stats.flops || 0) + 1;
  }
  if (diff < 0) {
    points *= T.tooLow[Math.min(1, -diff - 1)];
    p.h = Math.max(0, p.h - T.boredHit[Math.min(1, -diff - 1)]);
    word = "😒 Boring… (too low for " + p.name + ")";
    sim.stats.bored = (sim.stats.bored || 0) + 1;
  }
  const happy = p.h >= 70;
  if (happy) points += 30;
  if (p.wait < 8) points += 20;
  if (p.vip) {
    points += 150;
    sim.stats.vips++;
  }
  points = Math.round(points * sim.scoreMultiplier());
  sim.score += points;
  sim.stats.served++;
  sim.stats.totalHappiness += Math.max(0, p.h);
  if (happy) sim.stats.happy++;
  else if (p.h < 30) sim.stats.angry++;
  p.served = true;
  p.diveResult = J.outcome;
  sim.emit("points", { x: p.x, z: p.z, value: points });
  sim.emit("served", { happy, id: p.id });
  sim.emit("dive-result", { id: p.id, name: p.name, outcome: J.outcome, diff, h: b.h, word, x: p.x, z: p.z });
  sim.emit("toast", { text: word + " +" + points, ...(diff < 0 && { warning: true }) });
  if (happy && diff >= 0) sim.bumpStreak("dive", p);
  else if (!happy) sim.breakStreak(diff < 0 ? "bored" : "flop", p);
}

// A failed jump: an uncontrolled tumble into the water, a huge splash, the diver winded in it (and anyone landed on): the cramp's
// rescue, a ring to each.
function failed(sim, p, b, under = []) {
  const J = p.jump,
    victims = [p, ...under];
  const cost = Math.max(T.fail[b.h] || 100, 100);
  for (const v of victims) {
    if (v.status === "dive") {
      v.dive = null;
      v.y = 0;
    }
    v.status = "swim";
    v.problem = "cramp";
    v.diveFail = true;
    v.actualSpeed = 0;
    v.lane = null;
    v.resumeLane = null;
    v.h = Math.max(0, v.h - 20);
  }
  p.board = null;
  p.diveResult = "fail";
  const ids = victims.map((v) => v.id);
  if (sim.rescue) {
    sim.rescue.stage = "stranded";
    sim.rescue.victims = [...new Set([...(sim.rescue.victims || [sim.rescue.victim]), ...ids])];
  } else sim.rescue = { kind: "dive", victim: p.id, victims: ids, stage: "stranded" };
  sim.score -= cost;
  sim.breakStreak("wipeout", p);
  sim.stats.diveFails = (sim.stats.diveFails || 0) + 1;
  sim.emit("points", { x: p.x, z: p.z, value: -cost });
  sim.emit("cramp-alarm", { id: p.id, x: p.x, z: p.z });
  sim.emit("dive-fail", { id: p.id, h: b.h, x: p.x, z: p.z, name: p.name });
  sim.incident("dive-fail", p, { id: p.id, name: p.name, height: HEIGHTS[b.h].name });
  sim.emit("toast", {
    text:
      (J.diff > 0
        ? "💥 " + p.name + " was NOT ready for the " + HEIGHTS[b.h].name + " board! "
        : "💥 Wipeout! ") +
      (under.length
        ? p.name + " landed on " + under.map((v) => v.name).join(" & ") + "! "
        : p.name + " is winded. ") +
      "Grab a life ring! −" +
      cost,
    warning: true,
  });
}
// The chicken: back down the stairs, and home (a guest lost, at a smaller cost).
function chickenOut(sim, p, b) {
  p.dive = "down";
  p.diveT = 0;
  sim.score -= T.chicken;
  sim.stats.chickens = (sim.stats.chickens || 0) + 1;
  sim.stats.lost++;
  sim.breakStreak("chicken", p);
  p.h = Math.min(p.h, 20);
  sim.emit("points", { x: p.x, z: p.z, value: -T.chicken });
  sim.emit("dive-chicken", { id: p.id, x: p.x, z: p.z, h: b.h });
  sim.emit("toast", {
    text:
      "🐔 " +
      p.name +
      " chickened out on the " +
      HEIGHTS[b.h].name +
      " board and climbs back down. −" +
      T.chicken,
    warning: true,
  });
  return true;
}

// Up the ladder and onto the deck: a drip (one in five), a massage table waiting, or home.
function outOnDeck(sim, p, at) {
  p.dive = null;
  p.board = null;
  p.y = 0;
  p.status = "exit";
  p.exitPhase = "deck";
  p.stunned = Math.max(p.stunned || 0, 0.6);
  WetSpots.climbedOut(sim, p, at);
  sim.emit("splash", { x: p.x, z: p.z, small: true });
  if (sim.massage && Massage.claim(sim, p)) return;
  p.path = homePath(sim, p);
}
export function homePath(sim, p) {
  const door = sim.venue.arrival;
  return [...sim.venue.route(p, door.at(p.side, "outside")), ...sim.returnRoute(p.side)];
}

// A diver rescued from a failed jump (rescue.mjs, once they are up the ladder with the ring): to a massage bed if one is free (the
// creator: "exit or massage area"), else home. The ring is left on the deck where they climbed out.
export function diverRescued(sim, p) {
  const ring = sim.lifeRings[p.rescueRingId];
  if (ring)
    Object.assign(ring, { state: "deck", owner: null, x: p.x + Math.sign(p.x || 1) * 0.6, z: p.z + 0.5 });
  p.rescueRecover = false;
  p.problem = null;
  p.diveFail = false;
  p.exitPhase = "deck";
  if (Massage.request(sim, p)) return;
  p.status = "exit";
  p.path = homePath(sim, p);
}

// Out of the water by a ladder (sim.beginWaterExit at the Jumping Pool, for a ringed diver): to the nearest one, and up.
export function beginDiveExit(sim, p) {
  if (tubLocal(p.x, p.z).inside > -0.3 && !p.diveFail && !p.rescueRecover) return beginTubExit(sim, p);
  const l = nearestLadder(p);
  p.ladder = l;
  p.diveExit = true;
  p.exitPhase = "water";
  p.exitProgress = 0;
  p.path = [{ ...l.water }];
}
export function tickDiveExit(sim, p, dt) {
  if (p.status !== "exit" || !["water", "climb"].includes(p.exitPhase)) return false;
  if (!p.diveExit) return tickTubExit(sim, p, dt);
  const l = p.ladder;
  if (p.exitPhase === "water") {
    if (sim.moveAlong(p, dt, T.swim * 0.85)) {
      p.exitPhase = "climb";
      p.exitProgress = 0;
    }
    return true;
  }
  p.exitProgress = Math.min(1, p.exitProgress + dt / T.ladder);
  const e = smooth(p.exitProgress);
  p.x = l.water.x + (l.deck.x - l.water.x) * e;
  p.z = l.deck.z;
  p.angle = l.angle;
  if (p.exitProgress === 1) {
    p.exitPhase = "deck";
    p.diveExit = false;
    p.actualSpeed = 0;
    WetSpots.climbedOut(sim, p, l.deck);
    if (p.rescueRecover) {
      sim.rescueOnDeck(p);
      return true;
    }
    p.path = homePath(sim, p);
  }
  return true;
}

// ---- the hot tub ---------------------------------------------------------------------------------------------------------

export function tubGuests(sim) {
  return sim.people.filter(
    (p) =>
      p.lane === TUB_LANE &&
      (p.status === "enter" ||
        p.status === "swim" ||
        (p.status === "exit" && ["water", "climb"].includes(p.exitPhase))),
  );
}
export const tubFull = (sim) => tubGuests(sim).length >= TUB.cap;
function sendToTub(sim, p) {
  if (!p.tubOnly) {
    sim.emit("toast", { text: p.name + " came to dive, not to soak! Pick a height (1–3)." });
    sim.emit("lane-refused", { lane: TUB_LANE });
    return false;
  }
  if (p.status !== "queue") return false;
  if (sim.cleanup || sim.closed) {
    sim.emit("toast", { text: "The hot tub is closed until it is clean.", warning: true });
    return false;
  }
  if (tubFull(sim)) {
    sim.emit("toast", { text: "The hot tub is full! " + p.name + " will have to wait.", warning: true });
    sim.emit("lane-refused", { lane: TUB_LANE });
    return false;
  }
  p.assignedAt = sim.time;
  sim.stats.totalWait += p.wait;
  p.lane = TUB_LANE;
  walkToTub(sim, p, "enter");
  sim.emit("assigned", { id: p.id, lane: TUB_LANE });
  sim.selected = null;
  return true;
}
export function walkToTub(sim, p, mode = "enter") {
  const others = tubGuests(sim).filter((q) => q !== p);
  if (p.seat == null || others.some((q) => q.seat === p.seat))
    p.seat = tubSeats().find((s) => !others.some((q) => q.seat === s.i))?.i ?? 0;
  p.lane = TUB_LANE;
  p.status = mode;
  p.tubStage = "walk";
  p.stepT = 0;
  p.path = sim.venue.route(p, tubSteps().deck);
}
export function tickTubEnter(sim, p, dt) {
  if (p.status !== "enter" || !p.tubStage) return false;
  const steps = tubSteps();
  if (p.tubStage === "walk") {
    if (sim.moveAlong(p, dt, sim.pace(p, 3.1))) {
      p.tubStage = "step";
      p.stepT = 0;
      p.stepFrom = { x: p.x, z: p.z };
      sim.emit("step-in", { id: p.id, x: steps.water.x, z: steps.water.z, tub: true });
    }
    return true;
  }
  if (p.tubStage === "step") {
    p.stepT = Math.min(1, p.stepT + dt / T.step);
    const e = smooth(p.stepT);
    p.x = p.stepFrom.x + (steps.water.x - p.stepFrom.x) * e;
    p.z = p.stepFrom.z + (steps.water.z - p.stepFrom.z) * e;
    p.angle = steps.angle;
    if (p.stepT === 1) {
      p.tubStage = "wade";
      const seat = tubSeats()[p.seat] || tubSeats()[0];
      p.path = [{ x: seat.x, z: seat.z }];
      sim.emit("splash", { x: p.x, z: p.z, small: true });
    }
    return true;
  }
  if (sim.moveAlong(p, dt, T.wade)) {
    const seat = tubSeats()[p.seat] || tubSeats()[0];
    p.angle = seat.angle;
    p.status = "swim";
    p.tubStage = null;
    if (!p.resumingWorkout) {
      p.workTime = 0;
      const left = sim.config.duration - sim.time - T.closing;
      p.workTarget = Math.max(6, Math.min(between(sim, T.soak) * (p.vip ? 1.2 : 1), left));
    }
    p.resumingWorkout = false;
    p.actualSpeed = 0;
    sim.emit("sit-in", { id: p.id, tub: true });
  }
  return true;
}
function beginTubExit(sim, p) {
  const steps = tubSteps();
  p.diveExit = false;
  p.exitPhase = "water";
  p.exitProgress = 0;
  p.path = [{ x: steps.water.x, z: steps.water.z }];
}
function tickTubExit(sim, p, dt) {
  const steps = tubSteps();
  if (p.exitPhase === "water") {
    if (sim.moveAlong(p, dt, T.wade * 1.3)) {
      p.exitPhase = "climb";
      p.exitProgress = 0;
      p.climbFrom = { x: p.x, z: p.z };
    }
    return true;
  }
  p.exitProgress = Math.min(1, p.exitProgress + dt / T.step);
  const e = smooth(p.exitProgress);
  p.x = p.climbFrom.x + (steps.deck.x - p.climbFrom.x) * e;
  p.z = p.climbFrom.z + (steps.deck.z - p.climbFrom.z) * e;
  p.angle = steps.angle + Math.PI;
  if (p.exitProgress === 1) {
    p.exitPhase = "deck";
    p.actualSpeed = 0;
    if (p.rescueRecover) {
      sim.rescueOnDeck(p);
      return true;
    }
    WetSpots.climbedOut(sim, p, steps.deck);
    if (sim.massage && Massage.claim(sim, p)) return true;
    p.path = homePath(sim, p);
  }
  return true;
}
// A floater in the tub (sanitation.mjs): off its edge, it turns back into the water.
export function keepInTub(q) {
  const l = tubLocal(q.x, q.z);
  if (l.inside >= 0.25) return;
  const back = clampInTub(q.x, q.z, 0.3);
  q.vx = (TUB.x - q.x) * 0.25 - q.vx * 0.4;
  q.vz = (TUB.z - q.z) * 0.25 - q.vz * 0.4;
  q.x = back.x;
  q.z = back.z;
}
// Where something lost in the tub starts (a floater, a cloud): where the guest was, a little in from the edge.
export const tubWaterSpot = (p) => clampInTub(p.x, p.z, 0.35);
// Where the coach serves a guest in the tub, and where he pours the water care in: the nearest edge he can stand at (the pool's side
// or an end: the hedge's side is against the hedge).
export function tubRim(at, out = 0.36) {
  const w = TUB.rim + TUB.deck + out,
    e = tubEdge(at.x, at.z, w);
  return e.x < TUB.x - 0.01 ? { x: TUB.x + TUB.hx + w, z: e.z } : e;
}
export function tubWaterPoint(at) {
  const e = tubEdge(at.x, at.z, -0.3);
  return e.x < TUB.x - 0.01 ? { x: TUB.x + TUB.hx - 0.3, z: e.z } : e;
}
export { tubOutPath };

// ---- every frame -------------------------------------------------------------------------------------------------------

// The Jumping Pool's own life (sim.mjs, in place of the lanes): the hot tub's soak, and the line-cutters.
export function updateDive(sim, dt) {
  const D = sim.dive;
  if (!D) return;
  for (const [h, at] of D.opens.entries())
    if (at > 0 && !D.told["open" + h] && sim.arrivalTime >= at && sim.status === "playing") {
      D.told["open" + h] = true;
      sim.emit("board-open", { h });
      sim.emit("toast", { text: "📣 The " + HEIGHTS[h].name + " board is open! (" + (h + 1) + ")" });
    }
  updateCut(sim, dt);
  if (sim.rescue || sim.crowdPanic()) return;
  for (const p of sim.people) {
    if (p.status !== "swim" || p.lane !== TUB_LANE) continue;
    p.workTime += dt;
    sim.tickStomach(p, dt);
    if (sim.cleanup || sim.closed) return;
    if (sim.chlorine > p.chlorineTolerance && p.eyeCooldown === 0) {
      p.irritation += dt * (sim.chlorine - p.chlorineTolerance) * 0.14;
      if (p.irritation > 10 && !p.problem) {
        p.problem = "eyes";
        sim.emit("toast", {
          text: p.name + " has sore eyes from the hot tub. Fetch eye relief.",
          warning: true,
        });
      }
    } else p.irritation = Math.max(0, p.irritation - dt * 0.8);
    p.h = clamp(
      p.h +
        dt *
          (T.relax - Math.max(0, sim.contamination - 35) * 0.025 * (p.vip ? 1.4 : 1) - (p.problem ? 1.6 : 0)),
      0,
      100,
    );
    if (p.h <= 0) {
      sim.lose(p);
      continue;
    }
    if (!p.problem && !p.stomachWarning && p.workTime >= (sim.config.workoutSeconds || p.workTarget || 20))
      sim.depart(p, true);
  }
}

// The line-cutter: now and then, from level 5, someone in a line of two or more pushes to its front and argues there; the line
// gets crosser by the second. The coach sends them to the back (E beside them, +40). Left alone, they win the argument and go up
// first, and everyone they pushed past is crosser for it.
function updateCut(sim, dt) {
  const D = sim.dive;
  if (sim.status !== "playing") return;
  if (D.cut) {
    const c = D.cut,
      p = sim.get(c.id);
    if (!p || p.status !== "dive" || p.board !== c.board || !["walk", "line"].includes(p.dive)) {
      D.cut = null;
      return;
    }
    if (c.argue > 0) {
      c.argue = Math.max(0, c.argue - dt);
      p.angle = BOARDS[c.board].angle + Math.PI; // (turned round, arguing with the line)
    }
    return;
  }
  if (sim.level < T.cutFrom || sim.config.duration - sim.time < 20) return;
  D.nextCut -= dt;
  if (D.nextCut > 0) return;
  D.nextCut = between(sim, T.cutEvery);
  // Someone at the back of a line of two or more, standing in it.
  const options = D.boards.filter((B) => {
    if (B.line.length < 2) return false;
    const q = sim.get(B.line[B.line.length - 1]);
    return q && q.dive === "line" && !q.star && !q.bigGuy;
  });
  if (!options.length) return;
  const B = pick(sim, options),
    p = sim.get(B.line[B.line.length - 1]);
  B.line = [p.id, ...B.line.filter((id) => id !== p.id)];
  D.cut = { id: p.id, board: B.id, argue: T.argue, victims: B.line.slice(1) };
  p.cutter = true;
  sim.emit("dive-cut", { id: p.id, x: p.x, z: p.z, board: B.id });
  sim.incident("line-cut", p, { id: p.id, name: p.name, height: HEIGHTS[BOARDS[B.id].h].name });
  sim.emit("toast", {
    text:
      "😤 " +
      p.name +
      " cut to the front of the " +
      HEIGHTS[BOARDS[B.id].h].name +
      " line! Send them to the back (E).",
    warning: true,
  });
}
// The coach sends a cutter to the back of their line.
export function sendBack(sim) {
  const D = sim.dive,
    c = D?.cut,
    p = c && sim.get(c.id);
  if (!p || !sim.canInteract()) return false;
  const B = D.boards[c.board];
  B.line = [...B.line.filter((id) => id !== p.id), p.id];
  p.cutter = false;
  p.h = Math.max(0, p.h - 10);
  D.cut = null;
  sim.score += T.cutPoints;
  sim.stats.cutsStopped = (sim.stats.cutsStopped || 0) + 1;
  sim.emit("points", { x: p.x, z: p.z, value: T.cutPoints });
  sim.save("line-cut", p, T.cutPoints, { name: p.name });
  sim.feedback("helped", { id: p.id });
  sim.emit("toast", { text: "☝️ Back of the line, " + p.name + "! +" + T.cutPoints });
  return true;
}
// The cutter got their way: up first, and the line they pushed past is crosser for it.
function cutThrough(sim, p) {
  const D = sim.dive;
  for (const id of D.cut.victims) {
    const q = sim.get(id);
    if (q && q.status === "dive") q.h = Math.max(0, q.h - T.cutHit);
  }
  p.cutter = false;
  D.cut = null;
  sim.stats.cutsMissed = (sim.stats.cutsMissed || 0) + 1;
  sim.breakStreak("cut", p);
  sim.emit("toast", {
    text: "😠 " + p.name + " pushed in and went first. The line is fuming!",
    warning: true,
  });
}
// The coach checks a show-off: what they really are.
export function checkGuest(sim, p) {
  if (!p?.bluff || p.revealed || !sim.canInteract()) return false;
  return sim.startBusy(
    "check",
    T.check,
    "Checking " + p.name + "…",
    () => {
      p.revealed = true;
      sim.stats.checked = (sim.stats.checked || 0) + 1;
      const real = p.type === "advanced";
      sim.emit("dive-check", { id: p.id, real, type: p.type, x: p.x, z: p.z });
      sim.emit("toast", {
        text: real
          ? "😎 " + p.name + " really is a Pro! The HIGH board it is."
          : "🙈 " +
            p.name +
            " is really a" +
            (p.type === "beginner" ? " Beginner 🐢" : "n Intermediate 🏊") +
            "! Good thing you checked.",
      });
    },
    p,
  );
}

// ---- the system (chaos.mjs SYSTEMS): alerts, the coach's options, hints, the banner, the diary -------------------------------

export const DivingBoards = {
  key: "boards",
  // Not an incident: the venue's own life (it never counts towards the incidents a shift may run at once).
  isActive: () => false,
  // A jump already under way when the time runs out lands before the shift ends (its points count): a second or two at most,
  // and never a new one (nobody leaves a board once the clock has stopped).
  holdsClock: (sim) =>
    !!sim.dive &&
    sim.time >= sim.config.duration &&
    sim.people.some((p) => p.status === "dive" && (p.dive === "air" || p.dive === "bounce")),
  describe(sim) {
    const D = sim.dive;
    if (!D) return "";
    const parts = D.boards
      .map((B, i) => {
        const up = B.up != null ? sim.get(B.up) : null;
        return B.line.length || up ? BOARDS[i].id + ":" + B.line.length + (up ? "+" + up.dive : "") : "";
      })
      .filter(Boolean);
    if (D.cut) parts.push("cut@" + D.cut.board + (D.cut.argue > 0 ? " arguing" : ""));
    return parts.join(" ");
  },
  detail(sim) {
    const D = sim.dive;
    if (!D) return null;
    return {
      lines: D.boards.map((B) => B.line.length),
      up: D.boards.map((B) => (B.up != null ? sim.get(B.up)?.dive || "?" : null)),
      cut: D.cut && { board: D.cut.board, argue: +D.cut.argue.toFixed(1) },
      tub: tubGuests(sim).length,
    };
  },
  alert(sim, alerts) {
    const D = sim.dive;
    if (!D) return;
    const p = D.cut && sim.get(D.cut.id);
    if (p && D.cut.argue > 0)
      alerts.push({ kind: "cut", icon: "😤", label: p.name, x: p.x, z: p.z, y: 1.9, urgency: 74, id: p.id });
    // A diver waiting at the edge for the water to clear (someone is in the landing spot).
    for (const q of sim.people)
      if (q.status === "dive" && q.dive === "edge" && q.hesitate === 0 && q.edgeWait > 1)
        alerts.push({
          kind: "landing",
          icon: "🤸",
          label: "Clear the landing!",
          x: q.jump.land.x,
          z: q.jump.land.z,
          y: 0.8,
          urgency: 62,
          id: q.id,
        });
  },
  interactions(sim, options) {
    const c = sim.coach,
      D = sim.dive;
    if (!D || c.swimming) return;
    const p = D.cut && sim.get(D.cut.id);
    if (p && distance(c, p) < T.cutReach)
      options.push({
        kind: "cut",
        id: p.id,
        label: "☝️ Send " + p.name + " to the back of the line",
        x: p.x,
        z: p.z,
        rank: -120 + distance(c, p),
        run: () => sendBack(sim),
      });
    for (const q of sim.people) {
      if (
        !q.bluff ||
        q.revealed ||
        !(q.status === "queue" || (q.status === "dive" && ["walk", "line"].includes(q.dive)))
      )
        continue;
      const d = distance(c, q);
      if (d > T.checkReach) continue;
      options.push({
        kind: "check",
        id: q.id,
        label: "😎 Check " + q.name + "'s skill",
        x: q.x,
        z: q.z,
        rank: -40 + d + (q.id === sim.selected ? -0.5 : 0),
        run: () => checkGuest(sim, q),
      });
    }
  },
  hint(sim) {
    const D = sim.dive;
    if (!D) return "";
    const p = D.cut && sim.get(D.cut.id);
    if (p && D.cut.argue > 0) return "😤 " + p.name + " cut the line! Walk over · E to send them to the back";
    const waiting = sim.people.find((q) => q.status === "dive" && q.dive === "edge" && q.edgeWait > 1);
    if (waiting) return "🤸 " + waiting.name + " is waiting for the water below to clear";
    const bluff = sim.people.find((q) => q.status === "queue" && q.bluff && !q.revealed);
    if (bluff) return "😎 " + bluff.name + " says they're a Pro… E beside them to check";
    return "";
  },
  panel(sim) {
    const D = sim.dive,
      p = D?.cut && sim.get(D.cut.id);
    if (!p || D.cut.argue <= 0) return null;
    return {
      icon: "😤",
      title: "LINE CUTTER!",
      task: p.name + " pushed in · E beside them to send them back",
      timer: D.cut.argue / T.argue,
    };
  },
};
