// The Lazy River's geometry (17 October 2026): a channel of water that curves across the room, pure numbers with no THREE in them,
// shared by the simulation (where the water is, where the banks are, where a rider is) and the scene (what to draw). The river has
// a centreline, a smooth curve through `points` sampled every few centimetres, and a half-width `w`; a place is described by `s`,
// how far along the centreline (from the upstream mouth, s = 0, to the downstream one, s = L), and `d`, how far across it (left of
// the flow positive). The mouths lie outside the room's walls, so inside the room the water is everywhere |d| < w.
//
// Only a stretch of the river is seen. A rider who floats out at the downstream mouth is gone from view for `hidden` seconds (the
// rest of the loop, in the jungle) and floats back in at the upstream mouth: the ride is a loop nobody sees all of.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A Catmull-Rom curve through the control points, sampled evenly by arc length.
function sampleCurve(points, step) {
  const dense = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < 40; k++) {
      const t = k / 40,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  dense.push({ ...points[points.length - 1] });
  // Arc length along the dense curve, then resample at even steps.
  const acc = [0];
  for (let i = 1; i < dense.length; i++)
    acc.push(acc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
  const total = acc[acc.length - 1],
    n = Math.ceil(total / step),
    out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * total;
    while (j < acc.length - 2 && acc[j + 1] < s) j++;
    const t = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push({
      s,
      x: dense[j].x + (dense[j + 1].x - dense[j].x) * t,
      z: dense[j].z + (dense[j + 1].z - dense[j].z) * t,
    });
  }
  // Tangent (the flow) and the normal to its left, at every sample.
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)],
      b = out[Math.min(out.length - 1, i + 1)],
      len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    out[i].tx = (b.x - a.x) / len;
    out[i].tz = (b.z - a.z) / len;
    // Left of the flow, seen from above (+y): rotate the tangent a quarter turn.
    out[i].nx = out[i].tz;
    out[i].nz = -out[i].tx;
  }
  return { samples: out, length: total };
}

export function makeRiver(spec) {
  const { samples, length } = sampleCurve(spec.points, 0.1);
  const w = spec.halfWidth,
    room = spec.room;
  // Where the river crosses the room's walls: the stretch that can be seen, from `start` to `end` along the centreline.
  const inRoom = (p) => p.x >= room.minX && p.x <= room.maxX && p.z >= room.minZ && p.z <= room.maxZ;
  const first = samples.findIndex(inRoom),
    last = samples.length - 1 - [...samples].reverse().findIndex(inRoom);
  const river = {
    ...spec,
    w,
    samples,
    length,
    start: samples[first].s,
    end: samples[last].s,
    // The point on the centreline `s` along (clamped to the curve), with its flow direction and left normal.
    at(s) {
      const f = clamp(s / length, 0, 1) * (samples.length - 1),
        i = Math.min(samples.length - 2, Math.floor(f)),
        t = f - i,
        a = samples[i],
        b = samples[i + 1];
      const tx = a.tx + (b.tx - a.tx) * t,
        tz = a.tz + (b.tz - a.tz) * t,
        n = Math.hypot(tx, tz) || 1;
      return {
        s,
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        tx: tx / n,
        tz: tz / n,
        nx: tz / n,
        nz: -tx / n,
        // The heading of the flow, as the game measures angles (atan2(dx, dz)).
        angle: Math.atan2(tx, tz),
      };
    },
    // A place given as (s, d).
    point(s, d) {
      const c = river.at(s);
      return { x: c.x + c.nx * d, z: c.z + c.nz * d };
    },
    // The nearest centreline place to (x, z): `s` and the signed distance across, `d` (left of the flow positive).
    locate(x, z) {
      let best = 0,
        bestD = Infinity;
      // Coarse, then fine around the best coarse sample.
      for (let i = 0; i < samples.length; i += 8) {
        const p = samples[i],
          dd = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      }
      for (let i = Math.max(0, best - 10); i <= Math.min(samples.length - 1, best + 10); i++) {
        const p = samples[i],
          dd = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      }
      // Between that sample and the next: along the flow from it (so a small step along the river is not lost to the
      // samples' spacing), across from the centreline at that point.
      const p = samples[best],
        along = clamp((x - p.x) * p.tx + (z - p.z) * p.tz, -0.06, 0.06),
        s = clamp(p.s + along, 0, length),
        c = river.at(s),
        d = (x - c.x) * c.nx + (z - c.z) * c.nz;
      return { s, d, dist: Math.hypot(x - c.x, z - c.z) };
    },
    // In the water, `margin` in from the banks (a negative margin reaches out over them).
    inWater(x, z, margin = 0) {
      const q = river.locate(x, z);
      return Math.abs(q.d) < w - margin && q.dist < w - margin + 0.001;
    },
    // The nearest place in the water at least `margin` from the banks and inside the seen stretch.
    clamp(x, z, margin = 0.5) {
      const q = river.locate(x, z);
      return river.point(
        clamp(q.s, river.start + margin, river.end - margin),
        clamp(q.d, -(w - margin), w - margin),
      );
    },
    // How much open water there is around (x, z) before a bank (negative: past it).
    clearance(x, z, margin = 0.5) {
      const q = river.locate(x, z);
      return Math.min(w - margin - Math.abs(q.d), q.s - river.start - margin, river.end - margin - q.s);
    },
    // The bank beside a place in the water: `water` just inside it, `deck` just outside, on the nearer bank (or `side` if asked).
    bank(x, z, { side = null, inside = 0.35, outside = 0.75 } = {}) {
      const q = river.locate(x, z),
        sign = side ?? (Math.sign(q.d) || 1),
        s = clamp(q.s, river.start + 0.6, river.end - 0.6);
      return {
        side: sign,
        s,
        water: river.point(s, sign * (w - inside)),
        deck: river.point(s, sign * (w + outside)),
      };
    },
    // Does the straight walk from a to b cross the water (`margin` out from the banks)?
    crosses(a, b, margin = 0.4) {
      const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        if (river.inWater(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, -margin)) return true;
      }
      return false;
    },
  };
  return river;
}

// Lateral offset of a stepping stone, a dock or the bridge, ready for the scene: centre, heading and the across direction.
export function placeOn(river, s, d = 0) {
  const c = river.at(s),
    p = river.point(s, d);
  return { ...p, s, d, angle: c.angle, nx: c.nx, nz: c.nz, tx: c.tx, tz: c.tz };
}
