// The Jumping Pool's cast on screen (24 October 2026): the divers, the springboard under them, the guests in the hot tub, the
// landing spots and the tub's water.
//
// A diver climbs the stairs, walks out along the board (a scared one slowly, arms out), and stands at the tip: a confident one
// swings the arms up, a show-off puffs the chest out, a bored Pro folds the arms, a scared one peers over the edge with the knees
// knocking and leans back. The springboard bends under every bounce. In the air the simulation's throw is the path (dive.mjs: the
// height, the launch, gravity); the spin is the picture's: the somersaults the throw ends in, faster while tucked than stretched
// (the same turn in the end, spread over the flight as a body's spin is: a tuck spins it up, opening out slows it), the twists
// about the body's own length, and what the limbs do (a tuck, a pike, a header's arms overhead, a cannonball, the arms and legs
// flailing in a failed jump, spread flat for a flop). Carl and the leopard man play their own Cannonball clip, held in the tuck.
// Only the picture moves here.
import { THREE } from "./kit.mjs";
import { BOARDS, HEIGHTS, TUB, TUB_LANE, inTub, tubLocal } from "../dive-plan.mjs";
import { CLIP as CANNON } from "./figure-pose.mjs";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
// The hot tub is a raised one (the paving runs on under it): its rim's top and its water's surface (scene/dive.mjs builds it).
export const TUB_TOP = 0.62;
export const TUB_WATER_Y = 0.48;
const TUB_WATER = TUB_WATER_Y,
  TUB_WADE = 0.01, // (standing on the raised tub's floor)
  TUB_HOP = 0.68, // (over its rim, getting in or out)
  SHOULDERS = 1.38;

// How tucked a diver is at share `t` of the flight (0 stretched, 1 tight).
function tuckAt(J, t) {
  if (!J.tuck) return J.flail ? 0.25 + 0.25 * Math.sin(t * 30) : 0;
  const [a, b] = J.tuck;
  return smooth((t - a) / 0.12) * (1 - smooth((t - b) / 0.12));
}
// The spin: how far round (radians) the somersault has gone at share `t`, the whole of it (2π · turns) by the entry. A tucked body
// spins about two and a half times as fast as a stretched one (the same turn, spread over the flight that way).
function spinAt(J, t) {
  const n = 24,
    rate = (s) => 1 + 1.6 * tuckAt(J, s) + (J.pike ? 0.4 : 0);
  let done = 0,
    all = 0;
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) / n,
      r = rate(s);
    all += r;
    if (s < t) done += r * Math.min(1, (t - k / n) * n);
  }
  return TAU * J.turns * (all ? done / all : t);
}

// The Jumping Pool's part of a guest's frame. True when it has posed them (the rest of the world sync is skipped).
export function divePose(w, sim, p, g, time, dt) {
  if (p.status === "dive") return poseDiver(w, sim, p, g, time, dt);
  // The hot tub's guests: sitting in it, wading in or out.
  if (
    p.lane === TUB_LANE ||
    (["swim", "enter", "exit", "evacuating", "fleeing"].includes(p.status) && inTub(p.x, p.z, -0.05))
  )
    return poseTub(w, sim, p, g, time, dt);
  return false;
}

function reset(u) {
  u.root.position.set(0, 0, 0);
  u.root.rotation.set(0, 0, 0);
  u.root.rotation.order = "XYZ";
  u.root.scale.setScalar(u.baseScale || 1);
  u.legs.forEach((l) => {
    l.rotation.set(0, 0, 0);
    l.visible = !u.rig;
  });
  u.arms.forEach((a) => a.rotation.set(0, 0, 0));
  u.puppet.arms = u.puppet.legs = false;
  u.soreEyes.visible = false;
  u.f.visible = false;
}
function footSpeed(u, p, dt) {
  const at = u.diveAt;
  u.diveAt = { x: p.x, y: p.y || 0, z: p.z };
  return at && dt > 0 ? Math.hypot(p.x - at.x, p.z - at.z, (p.y || 0) - at.y) / dt : 0;
}
function rig(u, dt, state) {
  try {
    u.rig?.update(dt, { puppet: u.puppet, classic: u, ...state });
  } catch (error) {
    console.error(error);
  }
}

function poseDiver(w, sim, p, g, time, dt) {
  const u = g.userData,
    b = BOARDS[p.board ?? 0],
    motion = w.reducedMotion?.matches ? 0 : 1,
    J = p.jump;
  reset(u);
  const speed = footSpeed(u, p, dt),
    y = p.y || 0;
  g.position.set(p.x, y, p.z);
  g.rotation.set(0, p.angle ?? 0, 0);
  u.shadow.visible = y < 0.05 && !["under", "swimOut", "air"].includes(p.dive);
  u.hit.position.y = 0.9;
  const fit = u.fit || 1;
  switch (p.dive) {
    case "walk":
    case "line": {
      // On the deck: walking to the line, or standing in it (an angry cutter turns round and waves the arms about).
      if (p.cutter && sim.dive?.cut?.id === p.id && sim.dive.cut.argue > 0) {
        u.arms.forEach((a, i) =>
          a.rotation.set(-1.2 + Math.sin(time * 9 + i * 2) * 0.6 * motion, 0, (i ? -1 : 1) * 0.5),
        );
        u.puppet.arms = true;
      }
      if (!u.rig) {
        const k = time * 9;
        u.legs.forEach((l, i) => (l.rotation.x = speed > 0.3 ? Math.sin(k + i * Math.PI) * 0.52 : 0));
      }
      rig(u, dt, { speed });
      return true;
    }
    case "climb":
    case "down": {
      // Up (or down) the stairs: the walk, leaning into the climb.
      const k = time * 9 * motion;
      u.root.rotation.x = p.dive === "climb" ? 0.16 : -0.08;
      u.legs.forEach((l, i) => (l.rotation.x = Math.sin(k + i * Math.PI) * 0.55 - 0.25));
      u.arms.forEach((a, i) => a.rotation.set(-0.9 + Math.sin(k + i * Math.PI) * 0.35, 0, 0));
      u.puppet.legs = u.puppet.arms = HEIGHTS[b.h].y > 4; // (the HIGH stairs are nearly a ladder: hands on the rails)
      rig(u, dt, { speed: Math.max(speed, 1.1) });
      return true;
    }
    case "out": {
      // Out along the board; a scared one slowly, arms out for balance.
      if (J?.scared || (sim.dive && p.type === "beginner" && b.h > 0 && !p.bluff)) {
        u.arms.forEach((a, i) =>
          a.rotation.set(-0.2, 0, (i ? -1 : 1) * (1.35 + Math.sin(time * 3 + i) * 0.15 * motion)),
        );
        u.puppet.arms = true;
      }
      rig(u, dt, { speed: Math.max(speed, 0.6) });
      return true;
    }
    case "edge": {
      edgePose(w, u, p, b, time, motion);
      rig(u, dt, { speed: 0 });
      return true;
    }
    case "bounce": {
      // Two bounces on the springboard: a crouch as it bends, arms swung up at the top.
      const phase = (p.diveT || 0) * 2,
        k = phase % 1,
        squat = Math.max(0, 1 - Math.sin(k * Math.PI) * 1.4);
      u.root.position.y = -squat * 0.12;
      u.legs.forEach((l) => (l.rotation.x = -squat * 0.55));
      u.arms.forEach((a, i) => a.rotation.set(squat > 0.4 ? 0.5 : -2.9, 0, (i ? -1 : 1) * 0.2));
      u.puppet.arms = u.puppet.legs = true;
      rig(u, dt, { speed: 0 });
      return true;
    }
    case "air": {
      airPose(w, u, p, b, time, motion);
      const ball = J?.ball && u.rig?.actions?.cannonball;
      rig(u, dt, { speed: 0, jump: ball ? ((CANNON.takeoff + CANNON.splash) / 2 + 3) / CANNON.fps : null });
      if (ball) u.puppet.arms = u.puppet.legs = false;
      return true;
    }
    case "under": {
      // Under the water after the entry, coming back up: upright, a trail of bubbles.
      g.position.y = -0.82 + y;
      u.arms.forEach((a, i) =>
        a.rotation.set(-2.6 + Math.sin(time * 6 + i) * 0.3 * motion, 0, (i ? -1 : 1) * 0.3),
      );
      u.puppet.arms = true;
      if (motion && Math.random() < dt * 6) w.splash(p.x, -0.2, p.z, 2, true, 0xe8ffff);
      rig(u, dt, { speed: 0 });
      return true;
    }
    case "swimOut": {
      // The crawl to the ladder, on the front (as any swimmer's).
      g.position.y = -0.39;
      u.root.rotation.x = Math.PI / 2;
      u.root.position.set(0, 0.27, -0.65 * fit);
      u.root.scale.setScalar(0.85 * (u.baseScale || 1));
      const tempo = 2.1 * 3.2;
      u.arms.forEach((a, i) =>
        a.rotation.set(Math.sin(time * tempo + u.phase + i * Math.PI) * 1.4, 0, i ? -0.2 : 0.2),
      );
      u.legs.forEach((l, i) => (l.rotation.x = Math.sin(time * tempo * 1.4 + i * Math.PI) * 0.35));
      u.hit.position.y = 0.25;
      if (motion && Math.random() < dt * 2.5) w.splash(p.x, -0.16, p.z, 2, true);
      rig(u, dt, { swim: true, stroke: 0.7 });
      return true;
    }
    case "ladder": {
      const t = p.diveT || 0;
      g.position.y = -0.39 * (1 - t);
      u.root.rotation.x = (Math.PI / 2) * (1 - t);
      u.root.position.set(0, 0.27 * (1 - t), -0.65 * (1 - t) * fit);
      u.arms.forEach((a) => a.rotation.set(-1.5 * (1 - t), 0, 0));
      u.legs.forEach((l) => (l.rotation.x = -0.5 * Math.sin(t * Math.PI)));
      u.puppet.arms = u.puppet.legs = true;
      rig(u, dt, { speed: 0 });
      return true;
    }
  }
  rig(u, dt, { speed });
  return true;
}

// At the tip of the board, waiting to go: what kind of diver they are shows.
function edgePose(w, u, p, b, time, motion) {
  const J = p.jump || {},
    s = (k) => Math.sin(time * k + (u.phase || 0)) * motion;
  if (J.scared && p.hesitate > 0) {
    // Peering over the edge, then leaning back from it; the knees knocking, the arms out.
    const peek = 0.5 + 0.5 * Math.sin(time * 1.7 + (u.phase || 0));
    u.root.rotation.x = (peek * 0.38 - 0.14) * motion;
    u.legs.forEach((l, i) => l.rotation.set(-0.15, 0, (i ? -1 : 1) * (0.06 + Math.abs(s(26)) * 0.12)));
    u.arms.forEach((a, i) => a.rotation.set(-0.3 + s(5) * 0.2, 0, (i ? -1 : 1) * (1.2 + s(7) * 0.3)));
    u.puppet.arms = u.puppet.legs = true;
    if (motion && Math.random() < 0.02) w.splash(p.x, (p.y || 0) + 1.6, p.z, 1, true, 0xbfeaff); // (a bead of sweat)
  } else if (J.lazy) {
    // A Pro sent to the springboard: arms folded, foot tapping.
    u.arms[0].rotation.set(-1.25, 0.2, 0.95);
    u.arms[1].rotation.set(-1.25, -0.2, -0.95);
    u.legs[0].rotation.x = -Math.max(0, s(6)) * 0.25;
    u.puppet.arms = u.puppet.legs = true;
  } else if (p.bluff && !p.revealed) {
    // A show-off: chest out, fists on the hips, a little bounce.
    u.root.rotation.x = -0.1;
    u.root.position.y = Math.abs(s(4)) * 0.04;
    u.arms.forEach((a, i) => a.rotation.set(0.4, 0, (i ? -1 : 1) * 0.95));
    u.puppet.arms = true;
  } else {
    // Ready: arms swing up overhead as they get set.
    const set = smooth(1 - (p.hesitate || 0) / 0.8);
    u.arms.forEach((a, i) => a.rotation.set(-2.9 * set + s(2) * 0.05, 0, (i ? -1 : 1) * 0.15));
    u.root.position.y = -0.04 * set;
    u.puppet.arms = true;
  }
}

// In the air: the spin, the twist and the limbs for the dive the throw ends in.
function airPose(w, u, p, b, time, motion) {
  const J = p.jump;
  if (!J) return;
  const t = clamp(J.t / J.T, 0, 1),
    theta = spinAt(J, t) * (motion ? 1 : 1),
    twist = TAU * (J.twist || 0) * smooth(t),
    h = u.hipsY ?? 0.85,
    tuck = tuckAt(J, t),
    late = smooth((t - 0.72) / 0.28); // (opening out for the entry)
  u.root.rotation.order = "XYZ";
  u.root.rotation.set(theta, twist, 0);
  // (The somersault turns about the hips.)
  u.root.position.set(0, h * (1 - Math.cos(theta)), -h * Math.sin(theta));
  const arms = u.arms,
    legs = u.legs;
  if (J.flail) {
    // Out of control: arms windmilling, legs bicycling, all the way down; a flop spreads flat at the end.
    const k = time * 15;
    arms.forEach((a, i) =>
      a.rotation.set(Math.sin(k + i * Math.PI) * 2.4, 0, (i ? -1 : 1) * (0.9 + Math.sin(k * 0.7 + i) * 0.6)),
    );
    legs.forEach((l, i) => l.rotation.set(Math.sin(k * 1.2 + i * Math.PI) * 0.9, 0, (i ? -1 : 1) * 0.25));
    if (J.outcome === "flop") {
      arms.forEach((a, i) =>
        a.rotation.set(a.rotation.x * (1 - late), 0, (i ? -1 : 1) * (1.5 * late + a.rotation.z * (1 - late))),
      );
      legs.forEach((l, i) => l.rotation.set(l.rotation.x * (1 - late), 0, (i ? -1 : 1) * 0.35 * late));
    }
  } else if (J.ball) {
    // A cannonball: hugging the knees (the classic figure; a cannonball man's model plays his own clip).
    const ball = Math.max(tuck, smooth(t / 0.15));
    legs.forEach((l) => (l.rotation.x = -2.2 * ball));
    arms.forEach((a, i) => a.rotation.set(-0.9 * ball, 0, (i ? -1 : 1) * 0.35 * ball));
  } else if (J.outcome === "flop") {
    // Meant well, ends flat: a starfish for the last of it.
    legs.forEach((l, i) => l.rotation.set(-1.9 * tuck, 0, (i ? -1 : 1) * 0.3 * late));
    arms.forEach((a, i) =>
      a.rotation.set(-2.6 * (1 - late) + tuck * 1.6, 0, (i ? -1 : 1) * (0.3 + 1.2 * late)),
    );
  } else if (J.lazy) {
    // A bored pencil: arms still folded.
    arms[0].rotation.set(-1.25, 0.2, 0.95);
    arms[1].rotation.set(-1.25, -0.2, -0.95);
  } else {
    // A tuck, a pike or a straight dive, opening out for the entry: head first with the arms overhead, feet first with them in.
    const headFirst = Math.abs((((J.turns % 1) + 1) % 1) - 0.5) < 0.25;
    if (J.pike) {
      legs.forEach((l) => (l.rotation.x = -1.4 * (1 - late) * smooth(t / 0.25)));
      arms.forEach((a, i) => a.rotation.set(-1.5 - (headFirst ? 1.4 : 0) * late, 0, (i ? -1 : 1) * 0.1));
    } else {
      legs.forEach((l) => (l.rotation.x = -1.9 * tuck));
      arms.forEach((a, i) =>
        a.rotation.set(
          -2.9 + tuck * 1.7 + (headFirst ? 0 : 2.9 * late * (1 - tuck)),
          0,
          (i ? -1 : 1) * 0.3 * (1 - tuck),
        ),
      );
    }
  }
  u.puppet.arms = u.puppet.legs = true;
  u.shadow.visible = false;
}

// A guest in the hot tub: sitting in it to the shoulders, or wading (the water as deep as they are far in from its edge).
function poseTub(w, sim, p, g, time, dt) {
  const u = g.userData,
    motion = w.reducedMotion?.matches ? 0 : 1,
    inside = tubLocal(p.x, p.z).inside,
    k = clamp(inside / 0.55, 0, 1);
  if (["queue", "arriving", "gone"].includes(p.status) || inside < -0.1) return false;
  reset(u);
  u.soreEyes.visible = p.problem === "eyes";
  u.shadow.visible = false;
  const fit = u.fit || 1,
    speed = footSpeed(u, p, dt),
    seated = p.status === "swim" && speed < 0.2 && !sim.rescue && !p.stomachWarning;
  // Up over the rim and down onto the floor (a raised tub).
  let y = k < 1 ? TUB_HOP * Math.sin(Math.PI * Math.min(1, k * 1.15)) : TUB_WADE;
  if (seated) {
    u.sink = Math.min(1, (u.sink || 0) + dt * 1.6);
    y =
      TUB_WADE +
      (TUB_WATER - SHOULDERS * fit - TUB_WADE) * u.sink +
      Math.sin(time * 1.1 + (u.phase || 0)) * 0.015 * motion;
    // Arms resting along the tub's rim.
    u.arms.forEach((a, i) => a.rotation.set(-0.2, 0, (i ? -1 : 1) * 1.1));
    u.puppet.arms = true;
  } else u.sink = Math.max(0, (u.sink || 0) - dt * 2.5);
  if (p.stomachWarning) {
    u.arms[0].rotation.x = -1.1;
    u.root.rotation.z = Math.sin(time * 4) * 0.08 * motion;
    u.puppet.arms = true;
  }
  g.position.set(p.x, y, p.z);
  g.rotation.set(0, p.angle ?? 0, 0);
  u.hit.position.y = Math.max(0.5, -y + 0.6);
  if (!seated && speed > 0.3 && motion && Math.random() < dt * 3)
    w.splash(p.x, TUB_WATER, p.z, 1, true, 0xe8ffff);
  rig(u, dt, { speed: seated ? 0 : Math.min(speed, 1.6) });
  return true;
}

// ---- the world's own updaters: the springboards, the landing spots, the tub's water ------------------------------------------

export function buildDiveCast(w, ctx) {
  // A ring on the water at each board's landing spot, while a diver stands on its tip: green when the water is clear, red when
  // someone is in it.
  ctx.landings = BOARDS.map(() => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.5, 40),
      new THREE.MeshBasicMaterial({
        color: 0x5cff8a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.2;
    m.renderOrder = 4;
    ctx.live.add(m);
    return m;
  });
  // Steam over the hot tub: soft puffs rising, swelling and fading.
  ctx.steam = Array.from({ length: 12 }, (_, i) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: w.glowMap,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    s.userData = { t: i / 12, a: (i * 2.39) % TAU, r: 0.4 + ((i * 0.37) % 1) * 1.2 };
    ctx.live.add(s);
    return s;
  });
  w.updaters.push((time, dt, world, sim) => syncDive(w, sim, time, dt, ctx));
}
const CLEAN = new THREE.Color(0x7fe3ee),
  MURKY = new THREE.Color(0x8fb36a),
  BROWN = new THREE.Color(0x7a5a2a),
  YELLOW = new THREE.Color(0xe8d84a),
  tmp = new THREE.Color();
function syncDive(w, sim, time, dt, ctx) {
  const motion = w.reducedMotion?.matches ? 0 : 1;
  // The springboards bend under whoever is bouncing on them (and spring back).
  for (const s of w.springboards || []) {
    const d = sim?.people.find(
      (p) => p.status === "dive" && p.board === s.board.id && ["bounce", "edge", "out"].includes(p.dive),
    );
    let bend = 0;
    if (d?.dive === "bounce") bend = d.bend || 0;
    else if (d) bend = -0.12 * clamp(Math.abs(d.z - s.board.topZ) / s.len, 0, 1); // (it sags under someone standing on it)
    // (a damped spring: it follows the diver, and wobbles on a little after a launch)
    s.v = (s.v || 0) + ((bend - (s.bend || 0)) * 320 - (s.v || 0) * (d ? 30 : 7)) * Math.min(dt, 0.05);
    s.bend = (s.bend || 0) + s.v * Math.min(dt, 0.05);
    s.pivot.rotation.x = s.board.side * s.bend * 0.16 * motion;
  }
  // The landing spots.
  BOARDS.forEach((b, i) => {
    const m = ctx.landings[i],
      d = sim?.people.find((p) => p.status === "dive" && p.board === b.id && p.dive === "edge" && p.jump);
    if (!d) {
      m.material.opacity = Math.max(0, m.material.opacity - dt * 3);
      return;
    }
    m.position.x = d.jump.land.x;
    m.position.z = d.jump.land.z;
    const blocked = d.edgeWait > 0.2;
    m.material.color.setHex(blocked ? 0xff5040 : 0x5cff8a);
    m.material.opacity = (blocked ? 0.55 : 0.32) + Math.sin(time * 8) * 0.12 * motion;
    m.scale.setScalar(1 + Math.sin(time * 5) * 0.04 * motion);
  });
  // The tub's water: clear turquoise, clouding with dirt, brown with a floater, yellow with a wee.
  const water = w.tubWater;
  if (water && sim) {
    tmp.copy(CLEAN).lerp(MURKY, clamp((sim.contamination - 30) / 60, 0, 0.7));
    if (sim.waterBrown) tmp.lerp(BROWN, clamp(sim.waterBrown * 1.5, 0, 0.85));
    if (sim.waterYellow) tmp.lerp(YELLOW, clamp(sim.waterYellow * 1.2, 0, 0.8));
    water.material.color.copy(tmp);
    water.material.emissiveIntensity =
      0.25 * (1 - clamp((sim.waterBrown || 0) + (sim.waterYellow || 0), 0, 1)) + 0.05;
    water.position.y = TUB_WATER + Math.sin(time * 2.1) * 0.008 * motion;
  }
  // The steam.
  for (const s of ctx.steam) {
    const u = s.userData;
    u.t = (u.t + dt * 0.18) % 1;
    const r = u.r + u.t * 0.4;
    s.position.set(TUB.x + Math.cos(u.a + u.t) * r, TUB_WATER + u.t * 2.0, TUB.z + Math.sin(u.a + u.t) * r);
    s.scale.setScalar(0.6 + u.t * 1.6);
    s.material.opacity = Math.sin(u.t * Math.PI) * 0.22 * (motion ? 1 : 0.5);
  }
  // Bubbles in the tub now and then.
  if (motion && Math.random() < dt * 4) {
    const a = Math.random() * TAU,
      r = Math.random() * (TUB.r - 0.4);
    w.splash(TUB.x + Math.cos(a) * r, TUB_WATER + 0.02, TUB.z + Math.sin(a) * r, 1, true, 0xffffff);
  }
}
