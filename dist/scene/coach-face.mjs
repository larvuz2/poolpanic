// Coach Waters' face (21 October 2026, the creator: "more personality to the coach … face expressions … chaos, struggle,
// panic. Like eyes wide open. We don't have a mouth … so we have to be very expressive with the eyes and with the eyebrows
// when there's trouble"). His model (assets/coach-panic.glb) has face bones that tools/blender/coach_face.py added: under
// `Face`, for each eye `Eye` (the ball: it grows), `Lid` and `LidLow` (the upper and lower lids, turned about the eye's axis),
// `Look` (the gaze) and `Pupil` (its size); `BrowIn` and `BrowOut` (each brow's two ends); `Stache` (the moustache) and
// `StacheL` and `StacheR` (its two ends). Every face bone's frame at rest is the model's own (x to his left, y up, z forward, metres), so an
// expression is written in those terms. No clip keys a face bone: this module poses them after the mixer, every frame,
// whatever the body is doing. Render only: nothing here touches the simulation.
//
// An expression is a set of numbers (EXPRESSIONS below); the face eases from one to the next, blinks, glances about, and
// some expressions shake (the pupils in a panic, the brows and the moustache in an effort). `coachMood` picks the
// expression from what is happening to the coach in the shift (scene.mjs calls it).

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The numbers of an expression (all optional; NEUTRAL's are the defaults):
//   eye: [width, height] of the ball, times its size at rest; drop: metres the eyes sink (big eyes grow down, not into the
//     brows); lid / low: where the upper / lower lid's edge crosses the front of the eye, degrees above the middle (90 is the
//     top of the ball, -90 the bottom; the lids rest open at 100 and -100, tucked behind the face); pupil: its size;
//   gaze: [left, up] degrees; shake: degrees the pupils jitter (a fright); dart: seconds between glances (fast in a panic);
//   spin: degrees the pupils circle, the two eyes against each other (dizzy);
//   browIn / browOut: [toward the middle, up] metres for each brow's inner and outer end; tremble: metres the brows shake;
//   curl: degrees the moustache's ends turn up (down if negative); stache: [width, height] of it; sag: metres it drops;
//   quiver: degrees it shivers;
//   blink: blinks a second; L / R: anything of the above for one side only (a lopsided face).
export const NEUTRAL = {
  eye: [1, 1],
  drop: 0,
  lid: 100,
  low: -100,
  pupil: 1,
  gaze: [0, 0],
  shake: 0,
  dart: 1.8,
  spin: 0,
  browIn: [0, 0],
  browOut: [0, 0],
  tremble: 0,
  curl: 0,
  stache: [1, 1],
  sag: 0,
  quiver: 0,
  blink: 0.28,
};
export const EXPRESSIONS = {
  // Nothing wrong: open, a glance about now and then, a blink every few seconds.
  neutral: {},
  // On his way to a job: a little narrowed, the brows down at the middle.
  focus: { lid: 72, low: -96, browIn: [0.004, -0.005], browOut: [0, 0.003], curl: -3, dart: 2.6 },
  // A problem on the deck: the eyes wider, the brows up at the middle.
  worried: {
    eye: [1.1, 1.1],
    drop: 0.003,
    pupil: 0.8,
    browIn: [0.003, 0.01],
    browOut: [0, -0.002],
    curl: -6,
    dart: 1.0,
  },
  // The moment it starts (with the Startle clip): eyes popped wide, the pupils shrunk to dots, the brows shot up.
  alarm: {
    eye: [1.24, 1.2],
    drop: 0.008,
    lid: 112,
    low: -112,
    pupil: 0.5,
    gaze: [0, 3],
    browIn: [0.0, 0.016],
    browOut: [-0.002, 0.012],
    curl: 14,
    stache: [1.1, 1.04],
    blink: 0,
    dart: 4,
  },
  // Trouble he cannot get to: huge eyes, pinpoint pupils shaking and darting, the brows up and tilted, the moustache
  // bristling and shivering.
  panic: {
    eye: [1.28, 1.22],
    drop: 0.01,
    lid: 114,
    low: -114,
    pupil: 0.42,
    shake: 3.2,
    dart: 0.22,
    browIn: [0.005, 0.017],
    browOut: [0, 0.004],
    tremble: 0.0012,
    curl: 16,
    stache: [1.14, 0.96],
    quiver: 5,
    blink: 0.5,
  },
  // Hauling, heaving, swimming a tow: screwed up eyes (lids down, the lower lids up), the brows down and squeezed, the
  // moustache bristling, all of it straining.
  struggle: {
    eye: [1.02, 0.96],
    lid: 34,
    low: -40,
    pupil: 0.9,
    gaze: [0, -4],
    dart: 3,
    browIn: [0.008, -0.011],
    browOut: [0, 0.004],
    tremble: 0.001,
    curl: 10,
    stache: [1.12, 0.92],
    quiver: 3.5,
    blink: 0,
    L: { lid: 26 },
  },
  // Just slipped: heavy, lopsided lids, the pupils going round, the brows at odds, the moustache drooping.
  dizzy: {
    lid: 44,
    low: -78,
    spin: 13,
    dart: 99,
    curl: -5,
    sag: 0.004,
    stache: [0.97, 1.06],
    blink: 0,
    L: { lid: 32, browIn: [0, 0.012], browOut: [0, 0.007] },
    R: { lid: 58, browIn: [0, -0.004], browOut: [0, -0.006] },
  },
  // It went wrong: the brows up at the middle, the eyes a little wide, the moustache drooping, looking down.
  dismay: {
    eye: [1.06, 1.06],
    drop: 0.002,
    lid: 80,
    pupil: 1.1,
    gaze: [0, -9],
    dart: 3,
    browIn: [0.004, 0.013],
    browOut: [0, -0.005],
    curl: -7,
    sag: 0.006,
    stache: [0.96, 1.08],
    blink: 0.1,
  },
  // A save: soft half-lids, big pupils, the brows lifted softly, the moustache's ends up.
  relief: {
    lid: 58,
    low: -92,
    pupil: 1.25,
    gaze: [0, 2],
    dart: 3,
    browIn: [0, 0.008],
    browOut: [0, -0.003],
    curl: 9,
    stache: [1.05, 1],
    blink: 0.1,
  },
};
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
// How fast the face reaches a new expression (per second): a fright is near instant, the rest eases.
const SPEED = { alarm: 24, panic: 16, dizzy: 10, struggle: 12 };
const BONES = ["Face", "Eye", "Lid", "LidLow", "Look", "Pupil", "BrowIn", "BrowOut"];
const SIDES = ["L", "R"];
const BLINK = 0.15; // seconds, down and up
const BROW_CLEAR = 0.006 + 0.004; // half a brow's depth and a gap: how far in front of an eye ball a brow keeps

// The full numbers of an expression for one side (the defaults filled in, the side's own overrides on top). `temper`: a
// coach's own resting face, from the `Face` bone's extras (coach_face.py --temper), over every expression: Coach Marsh (23
// October 2026, the grumpy coach) scowls even when nothing is wrong. {browIn, browOut}: added to every expression's brows;
// lid: the upper lids' resting place where an expression leaves them open (100), so a fright still opens his eyes wide.
export function expressionFor(name, side, temper = null) {
  const e = EXPRESSIONS[name] || {};
  const out = { ...NEUTRAL, ...e, ...(e[side] || {}) };
  if (!temper) return out;
  for (const k of ["browIn", "browOut"])
    if (temper[k]) out[k] = out[k].map((v, i) => v + (temper[k][i] || 0));
  if (temper.lid != null && out.lid === NEUTRAL.lid) out.lid = temper.lid;
  return out;
}
const NUMERIC = Object.keys(NEUTRAL);
function mix(a, b, u) {
  const out = {};
  for (const k of NUMERIC) {
    const x = a[k],
      y = b[k];
    out[k] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * u) : x + (y - x) * u;
  }
  return out;
}

// What the coach's face shows, from what is happening to him. `s`: {slipping, struggling (a heavy job in hand or a rescue
// swim), startled (seconds since a new incident), saved (seconds since a save), failed (seconds since something went
// wrong), urgency (0 to 100: the loudest open problem), moving}. The most pressing wins.
export function coachMood(s) {
  if (s.slipping) return "dizzy";
  if (s.startled != null && s.startled < 1.3) return "alarm";
  if (s.struggling) return "struggle";
  if (s.saved != null && s.saved < 1.8) return "relief";
  if (s.failed != null && s.failed < 2.2) return "dismay";
  if ((s.urgency || 0) >= 80) return s.moving ? "worried" : "panic";
  if ((s.urgency || 0) >= 55) return s.moving ? "focus" : "worried";
  return s.moving ? "focus" : "neutral";
}

// The face of one coach model. `random` is for the blinks and the glances (Math.random in the game; a seeded one in a check).
export class CoachFace {
  constructor(model, random = Math.random) {
    this.random = random;
    this.bones = {};
    // only the face's own bones (under `Face`): the body is the clips'
    const face = model.getObjectByName("Face");
    face?.traverse((o) => {
      if (o.name && !this.bones[o.name]) this.bones[o.name] = o;
    });
    this.ok = !!face && SIDES.every((s) => BONES.slice(1).every((b) => this.bones[b + s]));
    if (!this.ok) return;
    this.info = face.userData || {};
    this.temper = this.info.temper || null;
    this.rest = {};
    for (const o of Object.values(this.bones))
      this.rest[o.name] = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
    this.name = "neutral";
    this.current = {
      L: expressionFor("neutral", "L", this.temper),
      R: expressionFor("neutral", "R", this.temper),
    };
    this.time = 0;
    this.blinkIn = 1 + random() * 3;
    this.blinkT = -1;
    this.gaze = [0, 0];
    this.gazeTo = [0, 0];
    this.dartIn = 1;
  }
  // Show an expression (eases there over the next frames); `now` jumps straight to it (a still for a picture).
  set(name, now = false) {
    if (!EXPRESSIONS[name]) name = "neutral";
    if (name !== this.name && name === "alarm") this.blinkT = -1; // a fright never comes with the eyes shut
    this.name = name;
    if (now) {
      this.current = { L: expressionFor(name, "L", this.temper), R: expressionFor(name, "R", this.temper) };
      const g = this.current.L.gaze;
      this.gaze = [g[0], g[1]];
      this.gazeTo = [0, 0];
    }
  }
  // dt: seconds (the world's: zero in a hit-stop). still: no blinks, no glances, no shaking (a picture, or reduced motion).
  update(dt, { mood = null, still = false } = {}) {
    if (!this.ok) return;
    if (mood) this.set(mood);
    this.time += dt;
    const speed = SPEED[this.name] || 8,
      u = 1 - Math.exp(-speed * dt);
    for (const side of SIDES)
      this.current[side] = mix(this.current[side], expressionFor(this.name, side, this.temper), u);
    const e = this.current.L;
    // blinks
    let close = 0;
    if (!still) {
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        if (this.blinkT > BLINK) this.blinkT = -1;
        else close = Math.sin((Math.PI * this.blinkT) / BLINK);
      } else if (e.blink > 0) {
        this.blinkIn -= dt;
        if (this.blinkIn <= 0) {
          this.blinkT = 0;
          this.blinkIn = (0.6 + this.random() * 1.4) / e.blink;
        }
      }
      // glances: a quick jump of the eyes to a new spot, then a hold
      this.dartIn -= dt;
      if (this.dartIn <= 0) {
        const wide = e.dart < 0.5 ? 22 : 11;
        this.gazeTo = [(this.random() * 2 - 1) * wide, (this.random() * 2 - 1) * wide * 0.45];
        this.dartIn = e.dart * (0.5 + this.random());
      }
    } else this.gazeTo = [0, 0];
    const g = 1 - Math.exp(-28 * dt);
    this.gaze[0] += (this.gazeTo[0] - this.gaze[0]) * g;
    this.gaze[1] += (this.gazeTo[1] - this.gaze[1]) * g;
    this.apply(close, still);
  }
  apply(close = 0, still = false) {
    const b = this.bones,
      rest = this.rest,
      t = this.time,
      info = this.info;
    const jit = (amp, f, k) =>
      still ? 0 : amp * (Math.sin(t * f + k) * 0.6 + Math.sin(t * f * 1.73 + 2 * k) * 0.4);
    const sizes = {};
    for (const side of SIDES) {
      const e = this.current[side],
        sign = side === "L" ? 1 : -1;
      const eye = b["Eye" + side],
        r = rest["Eye" + side];
      eye.position.copy(r.p);
      eye.position.y -= e.drop;
      eye.scale.set(e.eye[0], e.eye[1], (e.eye[0] + e.eye[1]) / 2);
      sizes[side] = {
        y: r.p.y + (info.origin?.[1] || 0) - e.drop,
        sx: e.eye[0],
        sy: e.eye[1],
        sz: (e.eye[0] + e.eye[1]) / 2,
      };
      // lids: the edge's elevation, the blink taking the upper lid down over the ball
      const [restUp, restLow] = info.lidRest || [100, -100];
      const up = e.lid + (-92 - e.lid) * close;
      turn(b["Lid" + side].quaternion, 0, -(up - restUp) * DEG);
      turn(b["LidLow" + side].quaternion, 0, -(e.low - restLow) * DEG);
      // the gaze (+ left, + up), the shake, the dizzy circles (one eye against the other)
      const spin = still ? 0 : e.spin;
      const yaw =
        e.gaze[0] + this.gaze[0] + jit(e.shake, 71, side === "L" ? 0 : 1.3) + spin * Math.cos(t * 10 * sign);
      const pitch =
        e.gaze[1] +
        this.gaze[1] +
        jit(e.shake, 63, side === "L" ? 0.7 : 2.1) +
        spin * Math.sin(t * 10 * sign);
      look(b["Look" + side].quaternion, clamp(yaw, -40, 40) * DEG, -clamp(pitch, -40, 40) * DEG);
      b["Pupil" + side].scale.set(e.pupil, e.pupil, 1); // (across the ball: a curved disc scaled in depth too would sink into it)
      // brows: each end moves (toward the middle and up), shakes, and keeps in front of a grown eye ball
      for (const [end, key] of [
        ["BrowIn", "browIn"],
        ["BrowOut", "browOut"],
      ]) {
        const bone = b[end + side],
          rr = rest[end + side];
        bone.position.copy(rr.p);
        bone.position.x -= sign * e[key][0];
        bone.position.y += e[key][1] + jit(e.tremble, 47, end === "BrowIn" ? 0.4 : 1.9);
      }
    }
    // push the brows out in front of the eyes (both ends checked against both eye balls, at their middle too)
    for (const side of SIDES) {
      const inner = b["BrowIn" + side].position,
        outer = b["BrowOut" + side].position;
      // (the brows' positions are offsets from the Face bone, the eyes' numbers are in the model: `origin` is the one in the other)
      const [ox, oy, oz] = info.origin || [0, 0, 0];
      const need = (bx, by) => {
        const x = bx + ox,
          y = by + oy;
        let z = -Infinity;
        for (const s of SIDES) {
          const eye = info.eyes?.[s];
          if (!eye) continue;
          const sz = sizes[s],
            dx = (x - eye.centre[0]) / (eye.radius * sz.sx),
            dy = (y - sz.y) / (eye.radius * sz.sy),
            d = 1 - dx * dx - dy * dy;
          if (d > 0) z = Math.max(z, eye.centre[2] + eye.radius * sz.sz * Math.sqrt(d) + BROW_CLEAR);
        }
        return z - oz;
      };
      const zi = need(inner.x, inner.y),
        zo = need(outer.x, outer.y),
        zm = need((inner.x + outer.x) / 2, (inner.y + outer.y) / 2);
      inner.z = Math.max(inner.z, zi, zm);
      outer.z = Math.max(outer.z, zo, zm);
    }
    // the moustache: it sags and bristles as a whole, and its two ends turn up or down, shivering
    const e = this.current.L;
    const st = b.Stache;
    if (st) {
      st.position.copy(rest.Stache.p);
      st.position.y -= e.sag;
      st.scale.set(e.stache[0], e.stache[1], 1);
      for (const side of SIDES) {
        const sign = side === "L" ? 1 : -1;
        turn(
          b["Stache" + side].quaternion,
          2,
          sign * (e.curl + jit(e.quiver, 55, side === "L" ? 0 : 0.8)) * DEG,
        );
      }
    }
  }
  // Back to rest (the model as the file has it).
  reset() {
    if (!this.ok) return;
    for (const [name, r] of Object.entries(this.rest)) {
      const o = this.bones[name];
      o.position.copy(r.p);
      o.quaternion.copy(r.q);
      o.scale.copy(r.s);
    }
  }
}

// Rotations without three's classes (the module is shared with Anim Bench, which has its own copy of three): a turn about
// the x (0) or z (2) axis, and a look (a turn about y, then about x).
function turn(q, axis, angle) {
  const h = angle / 2,
    s = Math.sin(h);
  q.set(axis === 0 ? s : 0, 0, axis === 2 ? s : 0, Math.cos(h));
}
function look(q, yaw, pitch) {
  const cy = Math.cos(yaw / 2),
    sy = Math.sin(yaw / 2),
    cx = Math.cos(pitch / 2),
    sx = Math.sin(pitch / 2);
  q.set(cy * sx, sy * cx, -sy * sx, cy * cx); // (about y) times (about x)
}
