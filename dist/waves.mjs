// The Wave Pool's waves (17 October 2026, the creator: "the wave can hit harder on someone… we get a lot of dizziness here… we
// could stop the wave, but people start getting impatient and mad… if we don't shut down the wave and the wave hits a dizzy
// person, then it gets critical… we need to work a lot on the water mechanics here").
//
// The pool: a beach of sand at the near side (screen bottom, -x) that slopes down into the water, a shelf a metre deep in the
// middle, and the deep end against the wave house on the far side (+x), where the machine pushes each wave out of its chambers.
// A wave is a crest that runs across the pool towards the beach, faster in deep water than in shallow (`speedAt`). It grows as the
// water shallows (Green's law, `shoal`) and breaks where it gets too tall for the depth (`BREAK`): a small wave breaks close to the
// beach, a big one out on the shelf, the monster out in the deep. Broken, it is a wall of white water that loses height as it rolls
// in, and it runs up the sand and is gone. Where it breaks is where it hits hardest (the impact zone): every crest that passes a
// bather jolts them (wave-pool.mjs), and how hard is `hitStrength`.
//
// The machine runs a program of sets: a horn, then a wave every few seconds for half a minute or so, then a calm, and again. Some
// waves are big; late in a run a set can end with a monster, announced by a siren a few seconds before it leaves the wave house.
// The coach can stop the machine at any moment (the WAVES button): no new wave leaves (the ones already out still roll in), the
// program waits, and the bathers grow impatient (wave-pool.mjs). Starting it again sounds the horn and the program goes on. A
// rescue, a closed pool, a panicking crowd or a blackout stops it too (`halted`), and that costs nobody's patience.
//
// Everything here is the simulation's: the scene reads `sim.waves` to draw the water (scene/wave.mjs) and never moves it. The
// machine's own random numbers come from a stream of its own, so the rest of a shift draws what it would anywhere.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The basin, in the venue's x (across the pool, the beach at -x) and the water's surface at rest.
export const WAVE = {
  halfX: 7.2, // the shoreline at -halfX, the wave house's wall at +halfX
  halfZ: 9.4,
  water: -0.25, // the surface at rest (the deck is at 0)
  shelf: -1.0, // where the beach slope meets the shelf (1 m deep)
  shelfDepth: 1.0,
  deep: 2.1, // at the wave house
  sandTop: -9.0, // where the sand meets the deck's height above the shoreline
  launchX: 6.9, // where a crest leaves the wave house
  runUp: 0.9, // how far up the sand a wave runs before it is gone
  // The program (scaled by the shift's level in `program`): seconds of a set, of the calm, between waves.
  horn: 3, // the horn before a set (and before the machine starts again)
  restart: 2.2, // the horn when the coach starts it again
  monsterWarning: 4.2, // the siren before a monster leaves the wave house
  // A wave's height as it leaves (metres, crest over the rest level).
  normal: 0.26,
  big: 0.42,
  monster: 0.72,
  breakRatio: 0.48, // a wave breaks once it is taller than this share of the depth
  // How much taller the picture draws a wave than the simulation's height (the game's camera is high above the pool, and a crest of
  // a third of a metre seen from there is hard to make out). Only the picture: nothing in the simulation reads it.
  show: 1.8,
};
const BREAK_DECAY = 0.18; // per metre rolled since it broke
const BORE = [0.55, 0.04]; // a broken wave is at most this share of the depth (plus a little)

// Depth of the water at rest over the floor at x (0 on the beach and beyond).
export function depthAt(x) {
  if (x <= -WAVE.halfX) return 0;
  if (x <= WAVE.shelf) return ((x + WAVE.halfX) / (WAVE.shelf + WAVE.halfX)) * WAVE.shelfDepth;
  return WAVE.shelfDepth + ((x - WAVE.shelf) / (WAVE.halfX - WAVE.shelf)) * (WAVE.deep - WAVE.shelfDepth);
}
// The floor's height at x: the pool floor under the water, the sand rising out of it to the deck's height up the beach.
export function floorAt(x) {
  if (x <= -WAVE.halfX)
    return Math.min(0, WAVE.water + ((-WAVE.halfX - x) / (-WAVE.halfX - WAVE.sandTop)) * -WAVE.water);
  return WAVE.water - depthAt(x);
}
// How fast a crest runs at x (m/s): the square root of the depth, as shallow-water waves do, kept within reason.
export function speedAt(x) {
  return clamp(2.75 * Math.sqrt(Math.max(0.05, depthAt(x))), 1.4, 3.8);
}
// How tall an unbroken wave of starting height `a0` stands at x (it grows as the water shallows).
export function shoal(a0, x) {
  return a0 * Math.pow(WAVE.deep / Math.max(0.15, depthAt(x)), 0.25);
}

// ---- the machine ---------------------------------------------------------------------------------------------------------

// The program for a shift's level (1 to 20): longer sets, shorter calms, waves closer together, more big ones, and from level 5 a
// monster at the end of most sets.
export function program(level) {
  const L = clamp(level || 1, 1, 24);
  return {
    set: 16 + Math.min(14, L * 0.75),
    calm: Math.max(5, 11 - L * 0.3),
    period: Math.max(2.6, 3.4 - L * 0.04),
    bigChance: Math.min(0.45, 0.08 + L * 0.02),
    monsterChance: L >= 5 ? Math.min(0.9, 0.2 + L * 0.04) : 0,
    normal: WAVE.normal + Math.min(0.06, L * 0.003),
  };
}

export function waveRandom(sim) {
  sim.waveSeed = (Math.imul(sim.waveSeed || (sim.seed ^ 0x7f4a7c15) >>> 0 || 5, 1664525) + 1013904223) >>> 0;
  return sim.waveSeed / 4294967296;
}

export function createWaves(sim) {
  const prog = program(sim.level);
  return {
    prog,
    // calm | horn | running | stopped (by the coach) | halted (a rescue, a closed pool, a blackout, a panicking crowd)
    state: "calm",
    // The program's own clock: how long is left of the calm, the horn or the set, and to the next wave.
    left: 4, // (the first set starts a few seconds into the shift)
    next: 0,
    // A monster on its way: seconds until it leaves the wave house (the siren is sounding), or null.
    monster: null,
    monsterPlanned: false,
    sets: 0,
    launched: 0,
    // While stopped by the coach: for how long, and what the program was doing when it stopped.
    stoppedFor: 0,
    paused: null,
    haltReason: "",
    list: [],
    uid: 0,
    // How long since the last crest passed anyone (the calm of the water, for the scene and the bathers).
    sinceWave: 99,
  };
}

// Why the machine must stand still now ("" when it may run).
export function haltReason(sim) {
  if (sim.rescue) return "rescue";
  if (sim.cleanup || sim.closed) return "closed";
  if (sim.crowdPanic?.()) return "panic";
  if (sim.outage && sim.outage.stage === "dark") return "blackout";
  return "";
}

// Is the machine making waves (or about to), as far as the bathers can tell?
export const wavesOn = (w) => w.state === "running" || w.state === "horn" || w.state === "calm";

// One step of the machine and of every wave in the water. Returns nothing; crossings are left on each wave (`prevX`, `x`).
export function updateWaves(sim, dt) {
  const w = sim.waves;
  const reason = haltReason(sim);
  if (reason && w.state !== "halted") {
    // Stopped for an emergency: the program waits where it was; any monster on its way is called off.
    w.wasStopped = w.state === "stopped";
    w.paused = w.wasStopped ? w.paused : { state: w.state, left: w.left, next: w.next };
    w.state = "halted";
    w.haltReason = reason;
    if (w.monster !== null) w.monster = null;
    sim.emit("waves-halted", { reason });
  } else if (!reason && w.state === "halted") {
    // The emergency is over: the horn, and the program goes on (or it stays stopped, if the coach had stopped it).
    w.haltReason = "";
    if (w.wasStopped) {
      w.state = "stopped";
      w.stoppedFor = 0;
    } else resume(sim, w);
  }
  if (w.state === "stopped") w.stoppedFor += dt;
  else if (w.state !== "halted") runProgram(sim, w, dt);
  for (const wave of w.list) moveWave(sim, wave, dt);
  w.list = w.list.filter((wave) => wave.x > -WAVE.halfX - WAVE.runUp);
  w.sinceWave += dt;
}

function resume(sim, w) {
  const was = w.paused || { state: "calm", left: 3, next: 0 };
  w.paused = null;
  w.state = "horn";
  w.left = WAVE.restart;
  w.after = was.state === "running" ? { left: Math.max(4, was.left), next: 0.3 } : null;
  sim.emit("waves-horn", { restart: true });
}

function runProgram(sim, w, dt) {
  const prog = w.prog;
  if (w.state === "calm") {
    w.left -= dt;
    if (w.left <= 0) {
      w.state = "horn";
      w.left = WAVE.horn;
      w.after = null;
      sim.emit("waves-horn", {});
    }
    return;
  }
  if (w.state === "horn") {
    w.left -= dt;
    if (w.left <= 0) {
      w.state = "running";
      if (w.after) {
        w.left = w.after.left;
        w.next = w.after.next;
      } else {
        w.sets++;
        w.left = prog.set;
        w.next = 0.2;
        // Will this set end with a monster? (Planned now, so the siren comes at the same moment of the set every time.)
        w.monsterPlanned = waveRandom(sim) < prog.monsterChance;
      }
      w.after = null;
      sim.emit("waves-on", { set: w.sets });
    }
    return;
  }
  // Running: a wave every `period`, sometimes a big one; near the end of the set, the monster's siren.
  w.left -= dt;
  if (w.monster !== null) {
    w.monster -= dt;
    if (w.monster <= 0) {
      w.monster = null;
      launch(sim, w, "monster");
      w.next = prog.period * 1.4;
    }
  } else if (w.monsterPlanned && w.left <= WAVE.monsterWarning + 1.2) {
    w.monsterPlanned = false;
    w.monster = WAVE.monsterWarning;
    sim.emit("monster-warning", { in: WAVE.monsterWarning });
    sim.incident("monster", { x: WAVE.halfX, z: 0 });
  }
  w.next -= dt;
  if (w.next <= 0 && w.monster === null) {
    launch(sim, w, waveRandom(sim) < prog.bigChance ? "big" : "normal");
    w.next = prog.period * (0.85 + waveRandom(sim) * 0.3);
  }
  if (w.left <= 0 && w.monster === null) {
    w.state = "calm";
    w.left = prog.calm;
    sim.emit("waves-calm", {});
  }
}

function launch(sim, w, kind) {
  const a0 = kind === "monster" ? WAVE.monster : kind === "big" ? WAVE.big : w.prog.normal;
  const wave = {
    id: ++w.uid,
    kind,
    a0,
    a: a0 * 0.6,
    x: WAVE.launchX,
    prevX: WAVE.launchX,
    broken: false,
    brokeX: null,
    aBreak: 0,
    foam: 0,
    born: sim.time,
    hits: [], // the bathers it has jolted (wave-pool.mjs)
  };
  w.list.push(wave);
  w.launched++;
  sim.emit("wave-launch", { id: wave.id, kind });
}

function moveWave(sim, wave, dt) {
  wave.prevX = wave.x;
  wave.x -= speedAt(wave.x) * dt;
  const d = depthAt(wave.x);
  if (!wave.broken) {
    // Out of the chamber it rises to its height over the first metre and a half, then shoals.
    const out = clamp((WAVE.launchX - wave.x) / 1.5, 0, 1);
    wave.a = shoal(wave.a0, wave.x) * (0.6 + 0.4 * out);
    if (wave.a > WAVE.breakRatio * d) {
      wave.broken = true;
      wave.brokeX = wave.x;
      wave.aBreak = wave.a;
      sim.emit("wave-break", { id: wave.id, kind: wave.kind, x: wave.x, a: wave.a });
    }
  }
  if (wave.broken) {
    const rolled = wave.brokeX - wave.x;
    wave.a = Math.min(wave.aBreak * Math.exp(-BREAK_DECAY * rolled), BORE[0] * d + BORE[1]);
    wave.foam = Math.exp(-rolled / 3.2);
  }
  // Up the sand: the last of it.
  if (wave.x < -WAVE.halfX) wave.a *= Math.exp(-dt * 3);
}

// How hard a crest jolts someone it passes at x: gentle as a swell in deep water, hardest where it has just broken (the impact
// zone), a shove as white water nearer the beach.
export function hitStrength(wave, x) {
  if (!wave.broken) return wave.a * 0.6;
  const rolled = Math.max(0, wave.brokeX - x);
  return wave.a * (1 + 1.1 * Math.exp(-rolled / 1.2));
}

// The water's height over its rest level at x as the picture draws it (`show` times the simulation's: for the scene, and anything
// drawn floating on it): every wave's crest and the trough
// behind it, steep in front, long behind, steeper still once broken.
export function surfaceAt(list, x) {
  let h = 0;
  for (const wave of list) h += waveProfile(wave, x);
  return h * WAVE.show;
}
export function waveProfile(wave, x) {
  const u = x - wave.x;
  const front = wave.broken ? 0.32 : 0.55;
  const shape =
    u < 0
      ? Math.exp(-((u / front) ** 2))
      : Math.exp(-((u / 1.5) ** 2)) - 0.22 * Math.exp(-(((u - 2.4) / 1.1) ** 2));
  return wave.a * shape;
}

// The coach's WAVES button: stop the machine, or start it again. Returns true when it changed.
export function toggleWaves(sim) {
  const w = sim.waves;
  if (!w || sim.status !== "playing") return false;
  if (w.state === "halted") {
    sim.emit("toast", {
      text:
        w.haltReason === "rescue"
          ? "The waves are stopped for the rescue. They start again once everyone is safe."
          : w.haltReason === "blackout"
            ? "No power for the wave machine! Fix the fuse box first."
            : "The waves are stopped while the pool is closed.",
    });
    return false;
  }
  if (w.state === "stopped") {
    w.stoppedFor = 0;
    resume(sim, w);
    sim.emit("waves-started", {});
    sim.emit("toast", { text: "🌊 Waves back on! The horn sounds: here they come." });
    return true;
  }
  // Stop: the program waits; a monster on its way is called off (the siren stops).
  w.paused = { state: w.state, left: w.left, next: w.next };
  const cancelled = w.monster !== null;
  w.monster = null;
  if (cancelled) w.monsterPlanned = false;
  w.state = "stopped";
  w.stoppedFor = 0;
  sim.emit("waves-stopped", { cancelled });
  return true;
}

// What the board on the wave house and the WAVES button say: the state and a number of seconds.
export function waveBoard(w) {
  if (!w) return null;
  if (w.state === "halted") return { state: "halted", text: "STOPPED", reason: w.haltReason };
  if (w.state === "stopped") return { state: "stopped", text: "STOPPED", seconds: w.stoppedFor };
  if (w.monster !== null) return { state: "monster", text: "MONSTER WAVE", seconds: w.monster };
  if (w.state === "horn") return { state: "horn", text: "WAVES IN", seconds: w.left };
  if (w.state === "calm") return { state: "calm", text: "NEXT SET", seconds: w.left + WAVE.horn };
  return { state: "running", text: "WAVES ON", seconds: w.left };
}
