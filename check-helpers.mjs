// Shared drivers for deterministic checks: they move the coach with real input, never by teleporting.
export const tick = (s, n = 1) => {
  for (let i = 0; i < n; i++) s.tick(1 / 60);
};

// Grid A* over the walkable deck (coach-sized body), smoothed by line of sight. Cached per venue/level.
const grids = new Map();
function grid(s) {
  const key = s.venue.id + ":" + s.level;
  if (grids.has(key)) return grids.get(key);
  const d = s.venue.deck,
    step = 0.35,
    nx = Math.ceil((d.maxX - d.minX) / step) + 1,
    nz = Math.ceil((d.maxZ - d.minZ) / step) + 1,
    free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      free[i * nz + j] = s.venue.isDeck(d.minX + i * step, d.minZ + j * step, s.level, 0.36) ? 1 : 0;
  const g = { d, step, nx, nz, free };
  grids.set(key, g);
  return g;
}
function clear(s, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (!s.venue.isDeck(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, s.level, 0.34)) return false;
  }
  return true;
}
export function plan(s, to) {
  const g = grid(s),
    from = s.coach;
  if (clear(s, from, to)) return [to];
  const cell = (p) => [Math.round((p.x - g.d.minX) / g.step), Math.round((p.z - g.d.minZ) / g.step)];
  const nearestFree = ([i, j]) => {
    for (let r = 0; r < 6; r++)
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++) {
          const ii = i + a,
            jj = j + b;
          if (ii >= 0 && jj >= 0 && ii < g.nx && jj < g.nz && g.free[ii * g.nz + jj]) return [ii, jj];
        }
    return [i, j];
  };
  const [si, sj] = nearestFree(cell(from)),
    [ti, tj] = nearestFree(cell(to));
  const start = si * g.nz + sj,
    goal = ti * g.nz + tj,
    cost = new Float64Array(g.nx * g.nz).fill(Infinity),
    prev = new Int32Array(g.nx * g.nz).fill(-1),
    open = [[0, start]];
  cost[start] = 0;
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, u] = open.shift();
    if (u === goal) break;
    const ui = Math.floor(u / g.nz),
      uj = u % g.nz;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const vi = ui + a,
          vj = uj + b;
        if (vi < 0 || vj < 0 || vi >= g.nx || vj >= g.nz || !g.free[vi * g.nz + vj]) continue;
        const v = vi * g.nz + vj,
          c = cost[u] + Math.hypot(a, b);
        if (c < cost[v]) {
          cost[v] = c;
          prev[v] = u;
          open.push([c + Math.hypot(vi - ti, vj - tj), v]);
        }
      }
  }
  const cells = [];
  for (let v = goal; v >= 0 && v !== start; v = prev[v]) cells.unshift(v);
  const points = cells.map((v) => ({
    x: g.d.minX + Math.floor(v / g.nz) * g.step,
    z: g.d.minZ + (v % g.nz) * g.step,
  }));
  points.push(to);
  // Line-of-sight smoothing.
  const out = [];
  let anchor = { x: from.x, z: from.z },
    k = 0;
  while (k < points.length) {
    let far = k;
    for (let m = points.length - 1; m > k; m--)
      if (clear(s, anchor, points[m])) {
        far = m;
        break;
      }
    out.push(points[far]);
    anchor = points[far];
    k = far + 1;
  }
  return out;
}

// Walk to a point with real input along a planned path.
export function go(s, x, z, limit = 1500) {
  for (const point of plan(s, { x, z })) {
    let f = 0;
    while (Math.hypot(s.coach.x - point.x, s.coach.z - point.z) > 0.12 && f++ < limit) {
      const dx = point.x - s.coach.x,
        dz = point.z - s.coach.z,
        n = Math.hypot(dx, dz);
      s.setMovement(dx / n, dz / n);
      tick(s);
      if (s.coach.swimming || s.coach.waterTransition) break;
    }
  }
  s.clearInput();
}
// Chase a moving target, re-planning often, until `done()` or the frame limit.
export function pursue(s, target, done, limit = 1200) {
  let path = [],
    replan = 0;
  for (let f = 0; f < limit && !done(); f++) {
    if (replan-- <= 0 || !path.length) {
      path = plan(s, target());
      replan = 8;
    }
    while (path.length > 1 && Math.hypot(path[0].x - s.coach.x, path[0].z - s.coach.z) < 0.3) path.shift();
    const next = path[0],
      dx = next.x - s.coach.x,
      dz = next.z - s.coach.z,
      n = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / n, dz / n);
    tick(s);
  }
  s.clearInput();
  return done();
}
// Assign every waiting swimmer by type so lanes fill naturally (no cramps or stomach trouble).
export function assignAll(s) {
  for (const p of s.people) {
    p.crampAt = Infinity;
    p.sick = false;
  }
  for (const p of s.people.filter((p) => p.status === "queue")) {
    s.select(p.id);
    s.assign(p.type === "beginner" || p.type === "aqua" ? 0 : p.type === "advanced" ? s.lanes.length - 1 : 1);
  }
}
