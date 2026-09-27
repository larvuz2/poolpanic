// Shared world geometry. Screen right is +Z, screen up is +X (the camera looks across the pool from -X).
//
// Everything a system needs to know about a location lives in a venue: lanes, basin bounds, deck walking
// corridors, doors, queue rows, stations, rescue fixtures and simple collision proxies. Scenes, routes,
// interaction points and collision all read the same venue, so geometry, hit targets and paths agree.

export const COACH_TUNING = {
  speed: 7.6,
  acceleration: 58,
  braking: 76,
  radius: 0.32,
  jumpSpeed: 7.4,
  gravity: 23,
  reach: 1.8,
  handoffReach: 3.6,
  dashSpeed: 19,
  dashDuration: 0.16,
  dashCooldown: 0.82,
};

// Across-pool camera: screen right is +Z, screen up is +X.
export function screenMovement(x, z) {
  return { x: -z, z: x };
}

// The starting-block end sits beside the locker rooms. Both venues share the basin length.
export const ENTRY = { walkZ: -9.9, edgeZ: -8.7, serviceZ: -9.55, waterZ: -7.2, dropZ: -9.6 };

const ARRIVAL_TIMING = { firstDelay: 3.4, doorDuration: 2.2, hold: 0.35, walkSpeed: 5 };

export function doorOpening(remaining) {
  if (remaining <= 0) return 0;
  const t = Math.min(1, (ARRIVAL_TIMING.doorDuration - remaining) / 0.3, remaining / 0.45);
  return Math.sin((Math.max(0, t) * Math.PI) / 2);
}

// Basin measurements derived from the lane count. Lane ropes sit 1.6 either side of each lane centre and
// the basin wall is 0.2 beyond the outer rope. Length values are shared by every venue.
function poolGeometry(lanes) {
  const halfX = lanes.length * 1.6 + 0.2;
  return {
    halfX, // inner basin wall
    halfZ: 8.3,
    turnZ: 7.2, // lap turn line
    solidX: halfX + 0.3, // collision proxy (coping included)
    solidZ: 8.65,
    keepOutX: halfX + 0.65, // walking routes never cut across this box
    keepOutZ: 9,
    deckX: halfX + 0.5, // deck-contact physics treats anything inside as water
    deckZ: 8.7,
    edgeX: halfX + 0.2, // coach "water point" clamp
    edgeZ: 8.55,
    reachX: halfX + 0.3, // standing beside an outer lane
    reachZ: 8.65, // standing at either end
    sideServiceX: halfX + 0.9,
    serviceZ: 9.55,
    corridorX: halfX + 1.3, // long-side walking corridor
    evacX: halfX + 1.7, // first evacuation waiting column
    climbOutX: halfX + 1.2, // coach climb-out target beside the long sides
    endWalkZ: 9.95, // deck path at either end after climbing out
    climbZ: 8.25, // swimmer climb start at either end
    swimX: halfX - 0.45, // coach swimming bounds
    swimZ: 7.85,
    entryX: halfX - 0.6, // dive landing clamp
    entryZ: 7.7,
    floatX: halfX - 0.65, // floating objects bounce here
    floatZ: 7.6,
  };
}

// Does segment a→b pass through the open box |x| < hx, minZ < z < maxZ? (Liang–Barsky clipping.)
function segmentHitsBox(a, b, hx, minZ, maxZ) {
  let t0 = 0,
    t1 = 1;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  for (const [p, q] of [
    [-dx, a.x + hx],
    [dx, hx - a.x],
    [-dz, a.z - minZ],
    [dz, maxZ - a.z],
  ]) {
    if (Math.abs(p) < 1e-9) {
      if (q <= 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 >= t1) return false;
    }
  }
  return t1 - t0 > 1e-6;
}

function makeVenue(spec) {
  const pool = poolGeometry(spec.lanes);
  const arrival = { ...ARRIVAL_TIMING, ...spec.doors };
  const obstacles = [
    { x: 0, z: 0, hx: pool.solidX, hz: pool.solidZ, kind: "pool" },
    ...spec.lanes.map((x) => ({ x, z: -9.15, hx: 0.6, hz: 0.56, kind: "block" })),
    { ...spec.sanitation.bin, hx: 0.62, hz: 0.62, kind: "waste-bin", minLevel: 3 },
    ...spec.furniture.filter((f) => f.hx).map((f) => ({ x: f.x, z: f.z, hx: f.hx, hz: f.hz, kind: f.kind })),
  ];
  const venue = {
    ...spec,
    pool,
    arrival,
    entry: ENTRY,
    obstacles,
    laneCount: spec.lanes.length,
    // Walkable deck test for a coach-sized body. Level-gated furniture (the waste bin) is absent early on.
    isDeck(x, z, level = 3, radius = COACH_TUNING.radius) {
      const d = spec.deck;
      if (x < d.minX || x > d.maxX || z < d.minZ || z > d.maxZ) return false;
      return !obstacles.some(
        (b) =>
          (!b.minLevel || level >= b.minLevel) &&
          Math.abs(x - b.x) < b.hx + radius &&
          Math.abs(z - b.z) < b.hz + radius,
      );
    },
    // Waiting rows sit behind the starting blocks, beneath the clubhouse wall.
    queuePosition(side, slot) {
      const q = spec.queue;
      return { x: side * (q.outerX - (slot % 4) * q.stepX), z: q.startZ - Math.floor(slot / 4) * q.stepZ };
    },
    // Shortest deck route around the basin: straight when clear, otherwise via the corridor corners.
    // Coach-sized bodies collide with the starting blocks, so `solid` routes pass further behind them.
    route(from, to, { solid = false } = {}) {
      // Solid bodies also collide with the starting-block row just behind the basin's left end.
      const kx = pool.keepOutX - 0.05,
        kz = pool.keepOutZ - 0.05,
        minZ = solid ? -10.1 : -kz;
      const blocked = (a, b) => segmentHitsBox(a, b, kx, minZ, kz);
      if (!blocked(from, to)) return [{ x: to.x, z: to.z }];
      const cx = pool.corridorX,
        backZ = solid ? ENTRY.walkZ - 0.55 : ENTRY.walkZ,
        corners = [
          { x: -cx, z: backZ },
          { x: cx, z: backZ },
          { x: cx, z: pool.endWalkZ },
          { x: -cx, z: pool.endWalkZ },
        ];
      const nodes = [from, ...corners, to],
        n = nodes.length,
        dist = Array(n).fill(Infinity),
        prev = Array(n).fill(-1),
        done = Array(n).fill(false);
      dist[0] = 0;
      for (let k = 0; k < n; k++) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || dist[u] === Infinity) break;
        done[u] = true;
        for (let v = 0; v < n; v++) {
          if (done[v] || blocked(nodes[u], nodes[v])) continue;
          const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
          if (d < dist[v]) {
            dist[v] = d;
            prev[v] = u;
          }
        }
      }
      const path = [];
      for (let i = n - 1; i > 0; i = prev[i]) {
        if (i < 0) return [{ x: to.x, z: to.z }];
        path.unshift({ x: nodes[i].x, z: nodes[i].z });
      }
      return path;
    },
    // Deck spots right at the pool edge, used by visitors who want to reach the water.
    edgeSpots() {
      const spots = [];
      for (const side of [-1, 1])
        for (let z = -6; z <= 6; z += 2)
          spots.push({ x: side * (pool.solidX + 0.45), z, face: -side, axis: "x" });
      for (const x of spec.lanes) spots.push({ x: x + 1.15, z: pool.solidZ + 0.45, face: -1, axis: "z" });
      return spots.filter((s) => venue.isDeck(s.x, s.z, 3, 0.3));
    },
  };
  return venue;
}

// Classic indoor community club: three lanes, lockers in the left wall, office in the upper-right corner.
export const CLUB = makeVenue({
  id: "club",
  name: "Community Swim Club",
  lanes: [-3.2, 0, 3.2],
  deck: { minX: -14.1, maxX: 14.1, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -14.7, maxX: 14.7, minZ: -16.7, maxZ: 13.5 },
  doors: { insideX: 8.8, doorX: 8.05, doorZ: -14.4, outsideX: 7.25 },
  lockers: [-10.7, 10.7],
  queue: { outerX: 4.6, stepX: 1.1, startZ: -11.1, stepZ: 1.15 },
  coachStart: { x: -6.6, z: 0 },
  cameraFollow: { kx: 0.22, maxX: 2.4 },
  stations: {
    fins: { x: -10.3, z: 7.8 },
    chlorine: { x: 10.8, z: 7.8 },
    relief: { x: 10.8, z: 3.9 },
  },
  sanitation: { rack: { x: -13.5, z: -1.9 }, bin: { x: -12.5, z: 1.5 }, reach: 6.2 },
  ringMounts: [
    { x: -4, z: -15.7, angle: 0 },
    { x: -14.35, z: -5, angle: Math.PI / 2 },
    { x: 14.35, z: 5, angle: -Math.PI / 2 },
  ],
  rescue: { bench: { x: -10.2, z: -0.25 }, approach: { x: -8.9, z: -0.25 } },
  // Incident fixtures: wall hooks and pickups used by the chaos events.
  fixtures: {
    fishNet: { x: 14.35, z: -2.6, angle: -Math.PI / 2 },
    treats: { x: -13.4, z: 8.4 },
    flashlight: { x: 11.2, z: -7.3 },
    fuseBox: { x: 14.4, z: 12.05, angle: -Math.PI / 2 },
  },
  trampoline: null,
  furniture: [
    { kind: "bench", x: -10.2, z: -0.9, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "bench", x: 10.3, z: -0.5, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "bench", x: -9.8, z: 3.3, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "rack", x: -10.3, z: 7.8, hx: 0.48, hz: 1.03 },
    { kind: "station", x: 10.8, z: 7.8, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 10.8, z: 3.9, hx: 0.9, hz: 0.6 },
    { kind: "plant", x: -13, z: 10.6, hx: 0.5, hz: 0.5, scale: 0.85 },
    { kind: "fountain", x: -12.9, z: 5.5, hx: 0.54, hz: 0.5 },
    { kind: "chair", x: 12.2, z: -7.3, hx: 0.6, hz: 0.7 },
    { kind: "desk", x: 13, z: 9.5, hx: 0.6, hz: 1.4 },
    { kind: "treat-table", x: -13.4, z: 8.4, hx: 0.36, hz: 0.36 },
    ...[-10.7, 10.7].flatMap((x) => [
      { kind: "locker-wall", x: x - 2.65, z: -15.06, hx: 0.15, hz: 1.4 },
      { kind: "locker-wall", x: x + 2.65, z: -15.06, hx: 0.15, hz: 1.4 },
      { kind: "locker-wall", x, z: -16.2, hx: 2.65, hz: 0.3 },
      { kind: "locker-bench", x, z: -15.17, hx: 1.55, hz: 0.36 },
    ]),
  ],
});

// Outdoor resort: a wider five-lane pool with a trampoline tower whose splash zone lands in lane 5.
export const RESORT = makeVenue({
  id: "resort",
  name: "Riviera Splash Resort",
  lanes: [-6.4, -3.2, 0, 3.2, 6.4],
  deck: { minX: -15.6, maxX: 16.4, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -16.2, maxX: 17, minZ: -16.7, maxZ: 13.5 },
  doors: { insideX: 10.1, doorX: 9.35, doorZ: -14.4, outsideX: 8.5 },
  lockers: [-12, 12],
  queue: { outerX: 4.6, stepX: 1.1, startZ: -11.1, stepZ: 1.15 },
  coachStart: { x: -9.9, z: 0 },
  cameraScale: 1.08,
  cameraFollow: { kx: 0.3, maxX: 4.4 },
  stations: {
    fins: { x: -12.6, z: 7.9 },
    chlorine: { x: 13.6, z: 8.1 },
    relief: { x: 13.6, z: 4.6 },
  },
  sanitation: { rack: { x: -15, z: -2.2 }, bin: { x: -14, z: 1.6 }, reach: 6.2 },
  ringMounts: [
    { x: -4, z: -15.7, angle: 0 },
    { x: -15.85, z: -5.4, angle: Math.PI / 2 },
    { x: 16.85, z: -6.6, angle: -Math.PI / 2 },
  ],
  rescue: { bench: { x: -12.2, z: -0.25 }, approach: { x: -10.9, z: -0.25 } },
  fixtures: {
    fishNet: { x: 16.85, z: -2.8, angle: -Math.PI / 2 },
    treats: { x: 11.9, z: 11.2 },
    flashlight: { x: -12.6, z: -6.7 },
    fuseBox: { x: 16.9, z: 11.2, angle: -Math.PI / 2 },
    medkit: { x: -14.9, z: 4.7 },
  },
  // Launch bed overhangs the far deck; jumpers land in the last lane around landZ.
  trampoline: {
    lane: 4,
    x: 11.2,
    z: 1.5,
    bedX: 9.35,
    bedY: 2.62,
    stairBottomX: 15.55,
    landZ: 1.5,
    zone: 3.2,
  },
  furniture: [
    { kind: "bench", x: -12.2, z: -0.9, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "bench", x: 13.9, z: -1.2, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "rack", x: -12.6, z: 7.9, hx: 0.48, hz: 1.03 },
    { kind: "station", x: 13.6, z: 8.1, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 13.6, z: 4.6, hx: 0.9, hz: 0.6 },
    { kind: "medkit-cabinet", x: -15.35, z: 4.7, hx: 0.3, hz: 0.7 },
    { kind: "lifeguard-tower", x: -13.4, z: -7.6, hx: 0.75, hz: 0.75 },
    { kind: "tower", x: 11.2, z: 1.5, hx: 0.95, hz: 1.05 },
    { kind: "stairs", x: 13.85, z: 1.5, hx: 1.5, hz: 0.55 },
    { kind: "kiosk", x: 13.4, z: 11.2, hx: 1.05, hz: 1.2 },
    { kind: "palm", x: -14.7, z: 11.5, hx: 0.55, hz: 0.55 },
    { kind: "palm", x: 15.5, z: -11.2, hx: 0.55, hz: 0.55 },
    { kind: "palm", x: -14.7, z: -9.6, hx: 0.55, hz: 0.55 },
    { kind: "lounger", x: -13.2, z: 10.1, angle: 0, hx: 0.45, hz: 1.05 },
    { kind: "lounger", x: -11.4, z: 10.1, angle: 0, hx: 0.45, hz: 1.05 },
    { kind: "umbrella", x: -12.3, z: 11.7, hx: 0.25, hz: 0.25 },
    ...[-12, 12].flatMap((x) => [
      { kind: "locker-wall", x: x - 2.65, z: -15.06, hx: 0.15, hz: 1.4 },
      { kind: "locker-wall", x: x + 2.65, z: -15.06, hx: 0.15, hz: 1.4 },
      { kind: "locker-wall", x, z: -16.2, hx: 2.65, hz: 0.3 },
      { kind: "locker-bench", x, z: -15.17, hx: 1.55, hz: 0.36 },
    ]),
  ],
});

export const VENUES = { club: CLUB, resort: RESORT };

export function createCoach(venue = CLUB) {
  return {
    x: venue.coachStart.x,
    z: venue.coachStart.z,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    angle: Math.PI / 2,
    carry: null,
    carryOwner: null,
    job: null,
    path: [],
    state: "Ready to help",
    input: { x: 0, z: 0 },
    jumpBuffer: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashX: 0,
    dashZ: 0,
    landing: 0,
    slipTime: 0,
    slipCooldown: 0,
    goal: null,
    feedback: 0,
  };
}

// Classic-club values remain exported for existing checks and simple callers.
export const LANES = CLUB.lanes;
export const STATIONS = CLUB.stations;
export const SANITATION = CLUB.sanitation;
export const RING_MOUNTS = CLUB.ringMounts;
export const RESCUE = {
  wall: { x: -4, z: -15.7 },
  bench: CLUB.rescue.bench,
  approach: CLUB.rescue.approach,
  restSeconds: 4,
  swimSpeed: 4.2,
};
export const ARRIVAL = CLUB.arrival;
export const DECK_OBSTACLES = CLUB.obstacles;
export function isDeckPosition(x, z, level = 3, venue = CLUB) {
  return venue.isDeck(x, z, level);
}
export function queuePosition(side, slot, venue = CLUB) {
  return venue.queuePosition(side, slot);
}
