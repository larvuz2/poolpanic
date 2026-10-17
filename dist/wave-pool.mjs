// The Wave Pool's bathers (17 October 2026): what a guest does there, from the gate to the gate, and what the waves do to them.
//
// Nobody queues and nobody is sent anywhere: a guest comes in through the gate, walks straight down to the beach, drops their towel
// on the sand and wades into the waves (`bather`). The coach's chance to hand them a tube is on that walk, or from the water's edge
// once they are in (the fins' plumbing: `needsFins`, the tube hut holds the venue's few `tubes`). In the water each bather has a
// spot they like (the timid near the beach, the strong out in the deep) and paddles back to it after every shove.
//
// Every crest that passes a bather jolts them (waves.mjs `hitStrength`): it shoves them towards the beach and makes them a little
// dizzy, hardest in the impact zone where the waves break, a little less for the strong, far less in a tube (it rides the waves).
// Dizziness wears off between crests and in the calm. A bather who is woozy (`BATHE.woozy`) sees stars; one who is dizzy
// (`BATHE.dizzy`) has had enough and staggers for the beach, slowly, in trouble: the coach can stop the waves, hand them a tube or
// help them out from the edge (E: they rest on a towel and go back in). A crest that hits someone already that dizzy knocks them
// out: they go under, and it is a rescue with the life ring (the cramp's), and points lost. A monster wave can knock bathers off
// their tubes, and a lost tube floats off, rides the waves in and washes up on the beach for the coach to pick up.
//
// The bathers love the waves: every crest that does not leave them seeing stars cheers them up (a big one more, the monster most).
// Stopping the machine costs a little at once ("awww!") and, after a moment's grace, their mood drains away while it stays off;
// they start chanting for waves. The machine's emergency stops (a rescue, a closed pool, a blackout) cost nobody's patience.
//
// Coming out, a bather drops their tube on the sand and walks home dripping: at the Wave Pool more of them leave a wet spot than
// anywhere else (`wetChance`), on the deck just past the sand, on the way out.
import {
  WAVE,
  depthAt,
  hitStrength,
  updateWaves,
  waveRandom,
  createWaves,
  toggleWaves as toggleMachine,
  waveBoard,
} from "./waves.mjs";
import { WetSpots } from "./incidents/wet.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const BATHE = {
  dizzyPerHit: 30,
  woozy: 45,
  dizzy: 70,
  under: 100,
  clear: 38, // a dizzy bather is themselves again below this
  decay: 1.5, // dizziness lost a second
  calmDecay: 2.8, // a second, once no crest has passed for `calmAfter` seconds
  calmAfter: 3,
  tubeDecay: 4.5, // extra, in a tube
  tubeFactor: 0.3, // how much of a jolt a tube lets through
  type: { beginner: 1.5, intermediate: 1, advanced: 0.6 },
  star: 0.25, // Marco surfs
  paddle: { beginner: 0.42, intermediate: 0.6, advanced: 0.82 },
  wade: 1.05, // m/s walking in the shallows
  staggering: 0.34, // m/s, a dizzy bather making for the beach
  spots: { beginner: [-6.0, -3.2], intermediate: [-4.2, 1.8], advanced: [-0.6, 5.6] },
  shoreX: -8.3, // where a bather stands on the sand before wading in
  sandX: -10.6, // where the sand ends and the deck begins (on the near side)
  towel: 0.8, // s on the sand, dropping their towel
  stay: [26, 36], // s in the water
  fun: { normal: 1.0, big: 2.6, monster: 6 }, // mood a crest gives a bather enjoying it
  surge: 2.4, // m/s of shove towards the beach per unit of a jolt (it dies away in about half a second)
  impatience: 2.0, // mood a second lost while the coach keeps the machine stopped, after `grace`
  grace: 3,
  stopCost: 4, // mood each bather loses the moment the coach stops the waves
  knockout: 150, // points lost when a wave knocks a dizzy bather under
  helped: 50, // points for helping a dizzy bather out
  vipNoTube: 1.2, // mood a second a VIP without a tube loses in the water (they expected one)
  bump: 0.9, // two bathers this close when a crest hits both bump heads
  tubeLoss: { monster: 0.65, big: 0.15, normal: 0 }, // chance a hard hit in the impact zone knocks someone off their tube
  rest: 3.5, // s on a towel after being helped out
};

// ---- arriving ----------------------------------------------------------------------------------------------------------

// A new guest at the Wave Pool: a bather who would like a tube (Marco surfs without one) and a spot of their own in the waves.
export function batherSpawn(sim, p) {
  Object.assign(p, {
    needsFins: !p.star,
    midFins: false,
    finsFirst: false,
    hasFins: false,
    problem: null,
    dizzy: 0,
    lane: 0,
  });
  p.workTarget = BATHE.stay[0] + waveRandom(sim) * (BATHE.stay[1] - BATHE.stay[0]);
  p.spot = pickSpot(sim, p);
  // Fewer cramps than in a lane pool: the waves bring rescues enough of their own.
  if (p.crampAt !== Infinity && waveRandom(sim) < 0.6) p.crampAt = Infinity;
}
// The guest types at the Wave Pool (no aqua class, no daredevils): timid, average and strong swimmers.
export function batherType(sim, spec, r) {
  if (["beginner", "intermediate", "advanced"].includes(spec.type)) return spec.type;
  return r < 0.38 ? "beginner" : r < 0.76 ? "intermediate" : "advanced";
}

// Where a bather likes to be: out to the depth that suits them, along the pool, away from the others' spots.
function pickSpot(sim, p) {
  const [x0, x1] = p.star ? [1.5, 5.8] : BATHE.spots[p.type] || BATHE.spots.intermediate;
  let best = null,
    bestGap = -1;
  for (let k = 0; k < 6; k++) {
    const spot = {
      x: x0 + waveRandom(sim) * (x1 - x0),
      z: (waveRandom(sim) - 0.5) * 2 * (WAVE.halfZ - 1.2),
    };
    const gap = Math.min(
      9,
      ...sim.people
        .filter((q) => q !== p && q.spot && q.status !== "gone")
        .map((q) => distance(q.spot, spot)),
    );
    if (gap > bestGap) {
      best = spot;
      bestGap = gap;
    }
  }
  return best;
}

// Into the waves: down to the beach, the sand nearest their spot.
export function walkToWaves(sim, p, mode = "enter") {
  p.status = mode;
  p.lane = 0;
  p.spot ||= pickSpot(sim, p);
  const z = clamp(p.spot.z + (waveRandom(sim) - 0.5) * 1.6, -WAVE.halfZ + 0.9, WAVE.halfZ - 0.9);
  p.shore = { x: BATHE.shoreX, z };
  p.towelT = 0;
  p.path = sim.venue.route(p, p.shore);
}

// Walking down to the beach, then a moment on the sand (the towel), then in. True while it has them (the caller skips the rest).
export function tickWaveEnter(sim, p, dt) {
  if (p.status !== "enter") return false;
  if (p.towelT > 0) {
    p.towelT = Math.max(0, p.towelT - dt);
    if (p.towelT === 0) startBathing(sim, p);
    return true;
  }
  if (sim.moveAlong(p, dt, sim.pace(p, 3.3))) {
    p.towelT = BATHE.towel;
    p.angle = Math.PI / 2;
    sim.emit("towel", { id: p.id, x: p.x, z: p.z });
  }
  return true;
}
function startBathing(sim, p) {
  p.status = "swim";
  p.surge = 0;
  if (!p.resumingWorkout) {
    p.workTime = 0;
    p.dizzy = 0;
  }
  p.resumingWorkout = false;
  p.respot = 8 + waveRandom(sim) * 8;
  sim.emit("wade-in", { id: p.id, x: p.x, z: p.z });
  // A VIP expects a tube: one who goes in without lets everyone know.
  if (p.vip && !p.hasFins && !p.star && !p.vipMoaned) {
    p.vipMoaned = true;
    sim.emit("toast", {
      text: p.name + ", the VIP, expected a tube! 👑 They're not impressed. Hand them one from the edge.",
      warning: true,
    });
  }
}

// ---- in the water ------------------------------------------------------------------------------------------------------

// Every bather in the water and the machine, each frame. The waves keep rolling in a rescue (the ones already out); the bathers hold
// on where they are, as everyone in the water does in a rescue or while the crowd panics.
export function updateWavePool(sim, dt) {
  updateWaves(sim, dt);
  const w = sim.waves,
    held = !!sim.rescue || sim.crowdPanic(),
    bathers = sim.people.filter((p) => p.status === "swim");
  impatience(sim, w, bathers, dt);
  if (!held)
    for (const p of bathers) {
      if (moveBather(sim, p, dt, bathers) === "stop") return;
    }
  if (!held) for (const wave of w.list) crossings(sim, wave, bathers);
  updateLostTubes(sim, dt);
}

function moveBather(sim, p, dt, bathers) {
  if (p.status !== "swim") return;
  p.workTime += dt;
  sim.tickStomach(p, dt);
  if (sim.cleanup || sim.closed) return "stop";
  p.collisionTime = Math.max(0, (p.collisionTime || 0) - dt);
  p.eyeCooldown = Math.max(0, (p.eyeCooldown || 0) - dt);
  // Dizziness wears off (fastest in a tube and in the calm), except for someone dizzy and struggling without a tube.
  const calm = sim.waves.sinceWave > BATHE.calmAfter,
    struggling = p.problem === "dizzy" && !p.hasFins;
  if (!struggling)
    p.dizzy = Math.max(
      0,
      (p.dizzy || 0) - dt * ((calm ? BATHE.calmDecay : BATHE.decay) + (p.hasFins ? BATHE.tubeDecay : 0)),
    );
  if (p.problem === "dizzy" && p.dizzy < BATHE.clear) {
    p.problem = null;
    sim.emit("dizzy-over", { id: p.id, x: p.x, z: p.z });
  }
  // Eyes sting in strong chlorine, as in any pool.
  if (sim.chlorine > p.chlorineTolerance && p.eyeCooldown === 0) {
    p.irritation += dt * (sim.chlorine - p.chlorineTolerance) * 0.14;
    if (p.irritation > 10 && !p.problem) {
      p.problem = "eyes";
      sim.emit("toast", {
        text: p.name + " has sore eyes and is coming to the beach. Bring eye relief.",
        warning: true,
      });
    }
  } else p.irritation = Math.max(0, p.irritation - dt * 0.8);
  // Where to: the beach when dizzy (staggering) or in trouble (into the shallows, to wait for the coach), else their spot (a new
  // one now and then).
  p.respot = (p.respot ?? 10) - dt;
  if (p.respot <= 0 && !p.problem) {
    p.spot = pickSpot(sim, p);
    p.respot = 10 + waveRandom(sim) * 10;
  }
  let target = p.spot,
    speed = (BATHE.paddle[p.type] || 0.6) * (p.star ? 1.4 : 1);
  if (p.problem === "dizzy") {
    target = { x: -WAVE.halfX - 0.2, z: p.z };
    speed = BATHE.staggering;
  } else if (p.problem) target = { x: -WAVE.halfX + 1.3, z: p.z };
  const d = depthAt(p.x);
  if (d < 0.55 && p.problem !== "dizzy") speed = Math.max(speed, BATHE.wade);
  if (p.collisionTime > 0) speed *= 0.3;
  const dx = target.x - p.x,
    dz = target.z - p.z,
    dist = Math.hypot(dx, dz),
    go = dist > 0.05 ? Math.min(speed, dist * 2) / dist : 0;
  let vx = dx * go,
    vz = dz * go;
  // Elbow room: bathers drift apart.
  for (const o of bathers) {
    if (o === p) continue;
    const ox = p.x - o.x,
      oz = p.z - o.z,
      od = Math.hypot(ox, oz);
    if (od > 0.001 && od < 1.15) {
      vx += (ox / od) * (1.15 - od) * 1.2;
      vz += (oz / od) * (1.15 - od) * 1.2;
    }
  }
  // The shove of the last crest, dying away.
  p.surge = (p.surge || 0) * Math.exp(-dt * 2.5);
  p.x = clamp(p.x + (vx + p.surge) * dt, -WAVE.halfX - 0.35, WAVE.halfX - 0.7);
  p.z = clamp(p.z + vz * dt, -WAVE.halfZ + 0.55, WAVE.halfZ - 0.55);
  p.actualSpeed = Math.hypot(vx, vz);
  p.traveled += p.actualSpeed * dt;
  // They face the waves, except walking in the shallows or staggering out.
  if ((d < 0.55 || p.problem === "dizzy") && Math.hypot(vx, vz) > 0.15) p.angle = Math.atan2(vx, vz);
  else p.angle = Math.PI / 2;
  // Mood: dirty water, waiting in trouble, a VIP without the tube they expected.
  p.h -=
    dt *
    (Math.max(0, sim.contamination - 35) * 0.025 +
      (p.problem ? 1.6 : 0) +
      (p.vip && !p.hasFins && !p.star ? BATHE.vipNoTube : 0)) *
    (p.vip ? 1.4 : 1);
  p.h = clamp(p.h, 0, 100);
  if (p.h <= 0) {
    sim.lose(p);
    return;
  }
  // Out of the water: a dizzy bather who reached the beach staggers out (they have had enough), and everyone else when their time
  // is up.
  if (p.problem === "dizzy" && p.x <= -WAVE.halfX + 0.25) {
    p.problem = null;
    sim.depart(p, true);
    return;
  }
  if (p.workTime >= p.workTarget && !p.problem && !p.stomachWarning) sim.depart(p, true);
}

// The crest of `wave` passed these bathers since the last step: each is jolted, and two jolted side by side bump heads.
function crossings(sim, wave, bathers) {
  const hit = [];
  for (const p of bathers) {
    if (p.status !== "swim" || !(wave.prevX >= p.x && wave.x < p.x)) continue;
    // (Once a wave: one shoved ahead of the crest who paddles back through it is not jolted by it again.)
    if (wave.hits.includes(p.id)) continue;
    wave.hits.push(p.id);
    const s = hitStrength(wave, p.x) * (depthAt(p.x) < 0.08 ? 0.4 : 1);
    if (s < 0.02) continue;
    hit.push(p);
    jolt(sim, p, wave, s);
  }
  for (let i = 0; i < hit.length; i++)
    for (let j = i + 1; j < hit.length; j++) {
      const a = hit[i],
        b = hit[j];
      if (a.status !== "swim" || b.status !== "swim" || distance(a, b) > BATHE.bump) continue;
      if ((a.bumpCooldown || 0) > sim.time || (b.bumpCooldown || 0) > sim.time) continue;
      a.bumpCooldown = b.bumpCooldown = sim.time + 4;
      for (const q of [a, b]) {
        q.dizzy += 8;
        q.h = Math.max(0, q.h - 4);
        q.collisionTime = 0.7;
      }
      sim.stats.collisions++;
      sim.emit("bather-bump", { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, a: a.id, b: b.id });
      for (const q of [a, b]) checkDizzy(sim, q, wave);
    }
}

function jolt(sim, p, wave, s) {
  sim.waves.sinceWave = 0;
  const typeF = p.star ? BATHE.star : BATHE.type[p.type] || 1,
    tubeF = p.hasFins ? BATHE.tubeFactor : 1;
  p.dizzy = (p.dizzy || 0) + BATHE.dizzyPerHit * s * typeF * tubeF;
  p.surge = -BATHE.surge * s * (p.hasFins ? 1.4 : 1);
  // Fun, for anyone who is not seeing stars.
  if (p.dizzy < BATHE.woozy && !p.problem) p.h = Math.min(100, p.h + BATHE.fun[wave.kind]);
  // A hard hit right where it broke can knock a bather off their tube.
  if (
    p.hasFins &&
    wave.broken &&
    wave.brokeX - p.x < 2.2 &&
    waveRandom(sim) < (BATHE.tubeLoss[wave.kind] || 0)
  )
    loseTube(sim, p);
  if (s > 0.12) sim.emit("wave-hit", { id: p.id, x: p.x, z: p.z, s: +s.toFixed(2), kind: wave.kind });
  checkDizzy(sim, p, wave);
}

function checkDizzy(sim, p, wave) {
  if (p.status !== "swim") return;
  if (p.dizzy >= BATHE.under) goUnder(sim, p, wave);
  else if (p.dizzy >= BATHE.dizzy && !p.problem) {
    p.problem = "dizzy";
    sim.stats.dizzy = (sim.stats.dizzy || 0) + 1;
    sim.emit("dizzy", { id: p.id, x: p.x, z: p.z });
    sim.incident("dizzy", p, { id: p.id, name: p.name });
    sim.emit("toast", {
      text:
        "💫 " +
        p.name +
        " is dizzy and staggering for the beach! Stop the waves (1), hand them a tube or help them out (E at the edge).",
      warning: true,
    });
  }
}

// Knocked out by a wave while dizzy: under they go. The cramp's rescue (rescue.mjs): a glowing life ring, a dive, a tow to the beach.
function goUnder(sim, p, wave) {
  if (sim.rescue || sim.level < 2 || p.stomachWarning || p.problem === "cramp") {
    p.dizzy = BATHE.under - 1;
    return;
  }
  p.problem = "cramp";
  p.under = true;
  p.crampDone = true;
  p.actualSpeed = 0;
  p.surge = 0;
  sim.rescue = { kind: "cramp", under: true, victim: p.id, victims: [p.id], stage: "stranded" };
  for (const a of sim.people) if (a.status === "swim") a.actualSpeed = 0;
  sim.score -= BATHE.knockout;
  sim.streak = 0;
  sim.stats.knockouts = (sim.stats.knockouts || 0) + 1;
  sim.emit("cramp-alarm", { id: p.id, x: p.x, z: p.z, under: true });
  sim.emit("knockout", { id: p.id, x: p.x, z: p.z, kind: wave?.kind || "normal" });
  sim.emit("points", { x: p.x, z: p.z, value: -BATHE.knockout });
  sim.incident("knockout", p, { id: p.id, name: p.name });
  sim.emit("toast", {
    text:
      "🌊 " +
      p.name +
      " was dizzy and a wave knocked them under! −" +
      BATHE.knockout +
      " · Grab a glowing life ring and dive in!",
    warning: true,
  });
}

// ---- tubes in the water ------------------------------------------------------------------------------------------------

function loseTube(sim, p) {
  p.hasFins = false;
  sim.lostTubes.push({ id: ++sim.uid, x: p.x, z: p.z, vx: 0, vz: (waveRandom(sim) - 0.5) * 0.6, spin: 0 });
  sim.emit("tube-lost", { id: p.id, x: p.x, z: p.z });
  if (!sim.tubeLostTold) {
    sim.tubeLostTold = true;
    sim.emit("toast", {
      text: "Wipeout! " + p.name + " lost their tube. It'll wash up on the beach: pick it up (E).",
    });
  }
}
// A lost tube rides the waves in (every crest shoves it towards the beach) and washes up on the sand.
function updateLostTubes(sim, dt) {
  const list = sim.lostTubes;
  if (!list.length) return;
  for (const t of list) {
    for (const wave of sim.waves.list)
      if (wave.prevX >= t.x && wave.x < t.x) t.vx -= 1.8 * Math.max(0.15, hitStrength(wave, t.x));
    t.vx = t.vx * Math.exp(-dt * 0.9) - 0.05 * dt; // (and a little drift shorewards)
    t.vz *= Math.exp(-dt * 0.9);
    t.x += t.vx * dt;
    t.z = clamp(t.z + t.vz * dt, -WAVE.halfZ + 0.6, WAVE.halfZ - 0.6);
    t.x = Math.min(t.x, WAVE.halfX - 0.6);
    t.spin += dt * (0.6 + Math.abs(t.vx));
    if (t.x < -WAVE.halfX - 0.2) {
      t.ashore = true;
      const at = { x: -WAVE.halfX - 0.9 - waveRandom(sim) * 0.5, z: t.z };
      sim.clutter.push({ id: ++sim.uid, type: "fins", x: at.x, z: at.z });
      sim.emit("tube-ashore", { x: at.x, z: at.z });
    }
  }
  sim.lostTubes = list.filter((t) => !t.ashore);
}

// ---- the machine and the crowd ----------------------------------------------------------------------------------------

// The coach's WAVES button. Stopping costs everyone in the water a little at once.
export function toggleWaves(sim) {
  const changed = toggleMachine(sim);
  if (changed && sim.waves.state === "stopped") {
    const bathers = sim.people.filter((p) => p.status === "swim");
    for (const p of bathers) p.h = Math.max(0, p.h - BATHE.stopCost);
    sim.stats.waveStops = (sim.stats.waveStops || 0) + 1;
    sim.emit("toast", {
      text:
        sim.waves.paused?.state === "running"
          ? "Waves stopped. Awww! The bathers want them back."
          : "Waves stopped.",
    });
  }
  return changed;
}
function impatience(sim, w, bathers, dt) {
  if (w.state !== "stopped") return;
  // (Stopped in a calm, the bathers only miss the waves once the calm would have ended.)
  const grace = BATHE.grace + (w.paused?.state === "calm" ? Math.max(0, w.paused.left) : 0);
  if (w.stoppedFor < grace) return;
  for (const p of bathers) {
    p.h -= dt * BATHE.impatience * (p.vip ? 1.4 : 1);
    if (p.h <= 0) {
      p.h = 0;
      sim.lose(p);
    }
  }
  if (bathers.length && !(sim.time - (w.chantAt ?? -99) < 9)) {
    w.chantAt = sim.time;
    sim.emit("chant", {});
    if (!w.chantTold) {
      w.chantTold = true;
      sim.emit("toast", {
        text: "“WAVES! WAVES! WAVES!” The bathers want the waves back on. Start them up (1).",
        warning: true,
      });
    }
  }
}

// ---- out of the water --------------------------------------------------------------------------------------------------

// Out by the beach: wade to the shoreline, up the sand, leave the tube on it, and home (or to a towel, for a rescued bather).
export function beginWaveExit(sim, p) {
  p.exitPhase = "water";
  p.exitProgress = 0;
  p.path = [{ x: -WAVE.halfX + 0.1, z: clamp(p.z, -WAVE.halfZ + 0.6, WAVE.halfZ - 0.6) }];
  p.bumpTime = 0;
  p.slipTime = 0;
}
export function tickWaveExit(sim, p, dt) {
  if (p.status !== "exit" || !["water", "climb"].includes(p.exitPhase)) return false;
  if (p.exitPhase === "water") {
    if (sim.moveAlong(p, dt, p.rescueRecover ? 1.6 : BATHE.wade * 1.15)) {
      p.exitPhase = "climb";
      p.exitProgress = 0;
      p.climbFrom = { x: p.x, z: p.z };
      sim.emit("climb-out", { id: p.id, x: p.x, z: p.z });
    }
    return true;
  }
  p.exitProgress = Math.min(1, p.exitProgress + dt / 0.9);
  const t = p.exitProgress * p.exitProgress * (3 - 2 * p.exitProgress),
    to = { x: BATHE.shoreX - 0.2, z: p.climbFrom.z };
  p.x = p.climbFrom.x + (to.x - p.climbFrom.x) * t;
  p.z = p.climbFrom.z + (to.z - p.climbFrom.z) * t;
  p.angle = -Math.PI / 2;
  if (p.exitProgress < 1) return true;
  p.actualSpeed = 0;
  p.exitPhase = "deck";
  if (p.rescueRecover) {
    sim.rescueOnDeck(p);
    return true;
  }
  // The tube stays on the sand, for the coach.
  if (p.hasFins) {
    p.hasFins = false;
    const at = { x: p.x - 0.5, z: p.z + (p.z > 0 ? -0.5 : 0.5) };
    sim.clutter.push({ id: ++sim.uid, type: "fins", x: at.x, z: at.z });
    sim.emit("drop", at);
  }
  p.stunned = Math.max(p.stunned || 0, 1);
  const door = sim.venue.arrival;
  p.path = [...sim.venue.route(p, door.at(p.side, "outside")), ...sim.returnRoute(p.side)];
  // Dripping: the first stretch of deck past the sand on the way out gets the wet spot (incidents/wet.mjs), if any.
  const drip = dripPoint(sim, p);
  if (drip) WetSpots.climbedOut(sim, p, drip);
  return true;
}
// Where the sand ends along a path home, a step or two further on (where wet feet first touch the deck).
export const onSand = (x, z) => x > BATHE.sandX && x < -WAVE.halfX + 0.4 && Math.abs(z) < WAVE.halfZ + 0.45;
function dripPoint(sim, p) {
  let from = { x: p.x, z: p.z },
    past = -1;
  for (const to of p.path) {
    const n = Math.max(1, Math.ceil(distance(from, to) / 0.25));
    for (let k = 1; k <= n; k++) {
      const x = from.x + ((to.x - from.x) * k) / n,
        z = from.z + ((to.z - from.z) * k) / n;
      if (past < 0 && !onSand(x, z)) past = 0;
      if (past >= 0 && (past += 0.25) >= 1 + waveRandom(sim) * 1.8) return { x, z };
    }
    from = to;
  }
  return null;
}

// ---- the coach and the bathers -----------------------------------------------------------------------------------------

// Can the coach reach a bather in the water? From the beach at the water's edge, or from either end of the pool.
export function batherInReach(sim) {
  const c = sim.coach,
    P = sim.venue.pool;
  return !c.swimming && (c.x <= -P.reachX + 0.05 || Math.abs(c.z) >= P.reachZ);
}
// Where the coach stands to serve a bather: on the sand at the water's edge beside them, or at the nearer end.
export function batherServicePoint(sim, p) {
  const P = sim.venue.pool,
    points = [
      { x: -P.reachX - 0.4, z: clamp(p.z, -WAVE.halfZ, WAVE.halfZ) },
      { x: clamp(p.x, -WAVE.halfX + 0.5, WAVE.halfX - 1.5), z: Math.sign(p.z || 1) * (P.reachZ + 0.4) },
    ];
  return points.sort((a, b) => distance(a, p) - distance(b, p))[0];
}

// Help a dizzy bather out of the water (E, from the edge): out onto a towel, a rest, and back in for the rest of their session.
export function helpOut(sim, p) {
  if (!p || p.problem !== "dizzy" || p.status !== "swim") return false;
  if (!sim.swimmerInReach(p))
    return sim.guideTo(
      batherServicePoint(sim, p),
      "Get to the water's edge beside " + p.name + " and press E.",
    );
  if (!sim.canInteract()) return false;
  p.problem = null;
  p.dizzy = Math.min(p.dizzy, BATHE.clear);
  p.status = "recovering";
  p.recoveryStage = "to-towel";
  p.helped = true;
  p.resumeLane = 0;
  p.path = [{ x: -WAVE.halfX - 0.3, z: p.z }, towelSpot(sim, p)];
  sim.score += BATHE.helped;
  sim.stats.helped = (sim.stats.helped || 0) + 1;
  sim.emit("points", { x: p.x, z: p.z, value: BATHE.helped });
  sim.feedback("helped", { id: p.id });
  sim.save("helped-out", p, BATHE.helped, { id: p.id, name: p.name });
  sim.emit("toast", { text: "Steady now! " + p.name + " sits on a towel for a moment. +" + BATHE.helped });
  return true;
}
// A towel on the sand to rest on: up the beach from where they came out, clear of the others resting.
function towelSpot(sim, p) {
  const taken = sim.people.filter((q) => q !== p && q.towel).map((q) => q.towel);
  let z = clamp(p.z, -WAVE.halfZ + 0.8, WAVE.halfZ - 0.8);
  for (let k = 0; k < 8 && taken.some((t) => Math.abs(t.z - z) < 1); k++) z += k % 2 ? -1.1 * k : 1.1 * k;
  p.towel = { x: -9.6, z: clamp(z, -WAVE.halfZ + 0.8, WAVE.halfZ - 0.8) };
  return p.towel;
}
// Resting on the sand (helped out, or rescued and towed in): to the towel, a rest, and back into the waves.
export function benchOnBeach(sim, p) {
  p.status = "recovering";
  p.recoveryStage = "to-towel";
  p.stunned = 1;
  p.path = sim.venue.route(p, towelSpot(sim, p));
}
export function tickBeachRecovery(sim, p, dt, restSeconds) {
  if (p.status !== "recovering") return false;
  if (p.recoveryStage === "to-towel") {
    if (sim.moveAlong(p, dt, p.helped ? 1.6 : 3.1)) {
      p.recoveryStage = "resting";
      p.restTime = p.helped ? BATHE.rest : restSeconds;
      p.angle = Math.PI / 2;
      if (p.rescueRingId != null && sim.lifeRings[p.rescueRingId])
        Object.assign(sim.lifeRings[p.rescueRingId], {
          state: "deck",
          owner: null,
          ...sim.venue.rescue.approach,
        });
    }
    return true;
  }
  p.restTime = Math.max(0, p.restTime - dt);
  p.dizzy = Math.max(0, (p.dizzy || 0) - dt * 12);
  if (p.restTime === 0 && !sim.cleanup && !sim.rescue && !sim.closed) {
    p.rescueRecover = false;
    p.recoveryStage = null;
    p.exitPhase = null;
    p.resumingWorkout = true;
    p.towel = null;
    p.h = Math.min(100, p.h + (p.helped ? 6 : 12));
    p.helped = false;
    p.under = false;
    p.dizzy = 0;
    walkToWaves(sim, p);
  }
  return true;
}

// ---- the wave machine as a system (chaos.mjs SYSTEMS): alerts, hints, the banner, the tubes it accounts for, the diary ------

export const WaveMachine = {
  key: "waves",
  // Not an incident: the venue's own machine (it never counts towards the incidents a shift may run at once).
  isActive: () => false,
  finCount: (sim) => sim.lostTubes?.length || 0,
  describe(sim) {
    const w = sim.waves;
    if (!w) return "";
    const dizzy = sim.people.filter((p) => p.problem === "dizzy").length;
    return w.state + (w.monster !== null ? " · monster" : "") + (dizzy ? " · " + dizzy + " dizzy" : "");
  },
  detail(sim) {
    const w = sim.waves;
    if (!w) return null;
    return {
      state: w.state,
      waves: w.list.length,
      dizzy: sim.people.filter((p) => p.problem === "dizzy").length,
      lost: sim.lostTubes.length,
    };
  },
  alert(sim, alerts) {
    const w = sim.waves;
    if (!w) return;
    const c = sim.coach;
    for (const p of sim.people)
      if (p.problem === "dizzy" && p.status === "swim")
        alerts.push({
          kind: "dizzy",
          icon: "💫",
          label: p.name,
          x: p.x,
          z: p.z,
          y: 1.6,
          urgency: 88,
          id: p.id,
        });
    if (w.monster !== null)
      alerts.push({
        kind: "monster",
        icon: "🌊",
        label: "Monster wave",
        x: WAVE.halfX,
        z: 0,
        y: 3,
        urgency: 70,
      });
    if (w.state === "stopped" && w.stoppedFor > BATHE.grace)
      alerts.push({
        kind: "waves-off",
        icon: "🌊",
        label: "Waves off",
        x: WAVE.halfX,
        z: 0,
        y: 3,
        urgency: 40,
      });
    for (const t of sim.lostTubes)
      if (distance(c, t) < 30)
        alerts.push({ kind: "lost-tube", icon: "🛟", label: "Lost tube", ...t, y: 0.8, urgency: 20 });
  },
  interactions(sim, options) {
    if (!sim.waves || sim.coach.carry) return;
    for (const p of sim.people) {
      if (p.problem !== "dizzy" || p.status !== "swim" || !sim.swimmerInReach(p)) continue;
      const point = batherServicePoint(sim, p);
      options.push({
        kind: "assist",
        id: p.id,
        label: "Help " + p.name + " out of the water",
        ...point,
        rank: -60 + distance(sim.coach, point),
        run: () => helpOut(sim, p),
      });
    }
  },
  hint(sim) {
    const w = sim.waves;
    if (!w) return "";
    const dizzy = sim.people.find((p) => p.problem === "dizzy" && p.status === "swim");
    if (w.monster !== null)
      return "🌊 MONSTER WAVE in " + Math.ceil(w.monster) + " · stop the waves (1) or brace!";
    if (dizzy)
      return (
        "💫 " +
        dizzy.name +
        " is dizzy · " +
        (sim.coach.carry === "fins" ? "hand them the tube" : "help them out (E at the edge)") +
        " or stop the waves (1)"
      );
    if (w.state === "stopped" && w.stoppedFor > BATHE.grace)
      return "🌊 The bathers want waves · start them (1)";
    return "";
  },
  panel(sim) {
    const w = sim.waves;
    if (!w || w.monster === null) return null;
    return {
      icon: "🌊",
      title: "MONSTER WAVE IN " + Math.ceil(w.monster) + "!",
      task: "Stop the waves (1) · or brace!",
    };
  },
};

export { waveBoard, createWaves };
