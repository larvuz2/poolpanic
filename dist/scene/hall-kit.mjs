// Small helpers shared by the hall's builders: placing flat geometry, arched windows, beams and roof-line points.
import { THREE } from "./kit.mjs";

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _o = new THREE.Object3D();

// Copy of a geometry placed at `pos` and turned so its +Z faces `target`.
export function orient(geo, pos, target) {
  _o.position.copy(pos);
  _o.scale.set(1, 1, 1);
  _o.up.set(0, 1, 0);
  _o.lookAt(target);
  _o.updateMatrix();
  return geo.clone().applyMatrix4(_o.matrix);
}

// A window shape: a rectangle topped with a half circle, UVs 0..1 across the whole pane.
export function archGeo(width, height, segments = 10) {
  const r = width / 2,
    s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, height - r);
  s.absarc(0, height - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const g = new THREE.ShapeGeometry(s, segments),
    uv = g.attributes.uv,
    p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / width + 0.5, p.getY(i) / height);
  return g;
}

// The roof's underside as a polyline of points from the left eave to the right eave.
export function roofProfile(S) {
  const mid = (S.minX + S.maxX) / 2,
    half = (S.maxX - S.minX) / 2,
    rise = S.ridge - S.eave;
  if (S.profile === "arch") {
    const n = S.arcSegments || 14,
      line = [];
    for (let i = 0; i <= n; i++) {
      const u = -1 + (2 * i) / n;
      line.push(new THREE.Vector2(mid + u * half, S.eave + rise * (1 - u * u)));
    }
    return line;
  }
  return [
    new THREE.Vector2(S.minX, S.eave),
    new THREE.Vector2(mid, S.ridge),
    new THREE.Vector2(S.maxX, S.eave),
  ];
}

export function tex(c, t) {
  c.w.textures.push(t);
  return t;
}

// A beam from a to b (world points) with a section of sx × sy.
export function beam(c, mat, a, b, sx, sy, r = 0.02, parent = c.g) {
  const A = new THREE.Vector3(...a),
    B = new THREE.Vector3(...b),
    d = B.clone().sub(A),
    len = d.length();
  const m = c.w.box(sx, sy, len, mat, 0, 0, 0, r, parent);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Z_AXIS, d.normalize());
  return m;
}

// A point on the roof underside: `along` (0..1) of segment `i`, pushed `off` metres inside the roof.
export function onRoof(c, i, along, off = 0) {
  const s = c.segs[i];
  return new THREE.Vector3(
    s.a.x + (s.b.x - s.a.x) * along + s.n.x * off,
    s.a.y + (s.b.y - s.a.y) * along + s.n.y * off,
    0,
  );
}

// Height of the roof underside above x.
export function roofHeight(line, x, fallback) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1];
    if (x >= a.x - 1e-6 && x <= b.x + 1e-6) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
  }
  return fallback;
}

// Horizontal distance from the middle at which the roof underside, dropped by `drop`, is at height `y`.
export function roofSpanAt(line, mid, y, drop = 0) {
  const left = line.filter((p) => p.x <= mid + 1e-6);
  for (let i = 0; i < left.length - 1; i++) {
    const a = left[i],
      b = left[i + 1],
      ya = a.y - drop,
      yb = b.y - drop;
    if (y >= Math.min(ya, yb) - 1e-6 && y <= Math.max(ya, yb) + 1e-6) {
      const t = (y - ya) / (yb - ya || 1);
      return Math.abs(mid - (a.x + (b.x - a.x) * t));
    }
  }
  return 0;
}
