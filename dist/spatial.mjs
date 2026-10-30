// Shared world geometry. Screen right is +Z, screen up is +X (the camera looks across the pool from -X).
import { makeRiver, placeOn } from "./river.mjs";
import { WAVE as WAVE_BASIN } from "./waves.mjs";
import { ROOF as ROOF_PLAN, ROOF_BEDS, ROOF_CHILL, roofRoute } from "./roof-plan.mjs";
import { CRUISE as CRUISE_PLAN, CRUISE_CHILL, LOUNGERS, cruiseRoute } from "./cruise-plan.mjs";
import {
  ONSEN as ONSEN_PLAN,
  ONSEN_WATER,
  SPRINGS,
  onsenWalkable,
  onsenRoute,
  onsenEdgeSpots,
} from "./onsen-plan.mjs";
import {
  DIVE as DIVE_PLAN,
  HEIGHTS,
  TUB,
  STATIONS as DIVE_STATIONS,
  MASSAGE_BEDS,
  DIVE_WATER,
  diveWalkable,
  makeDiveRoute,
} from "./dive-plan.mjs";
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
function poolGeometry(lanes, basin = null) {
  // (The Wave Pool's basin is not a lane pool's: it brings its own size, `basin`. A lane pool's lengths stay the literal numbers
  // they always were, so its shifts replay to the last bit.)
  const halfX = basin?.halfX ?? lanes.length * 1.6 + 0.2,
    hz = basin?.halfZ,
    along = hz
      ? {
          halfZ: hz,
          turnZ: hz - 1.1,
          solidZ: hz + 0.35,
          keepOutZ: hz + 0.7,
          deckZ: hz + 0.4,
          edgeZ: hz + 0.25,
          reachZ: hz + 0.35,
          serviceZ: hz + 1.25,
          endWalkZ: hz + 1.65,
          walkZ: -(hz + 1.6),
          climbZ: hz - 0.05,
          swimZ: hz - 0.45,
          entryZ: hz - 0.6,
          floatZ: hz - 0.7,
        }
      : {
          halfZ: 8.3,
          turnZ: 7.2, // lap turn line
          solidZ: 8.65,
          keepOutZ: 9,
          deckZ: 8.7,
          edgeZ: 8.55,
          reachZ: 8.65, // standing at either end
          serviceZ: 9.55,
          endWalkZ: 9.95, // deck path at either end after climbing out
          walkZ: -9.9, // the walk behind the near end (ENTRY.walkZ)
          climbZ: 8.25, // swimmer climb start at either end
          swimZ: 7.85,
          entryZ: 7.7,
          floatZ: 7.6,
        };
  return {
    halfX, // inner basin wall
    solidX: halfX + 0.3, // collision proxy (coping included)
    keepOutX: halfX + 0.65, // walking routes never cut across this box
    deckX: halfX + 0.5, // deck-contact physics treats anything inside as water
    edgeX: halfX + 0.2, // coach "water point" clamp
    reachX: halfX + 0.3, // standing beside an outer lane
    sideServiceX: halfX + 0.9,
    corridorX: halfX + 1.3, // long-side walking corridor
    evacX: halfX + 1.7, // first evacuation waiting column
    climbOutX: halfX + 1.2, // coach climb-out target beside the long sides
    swimX: halfX - 0.45, // coach swimming bounds
    entryX: halfX - 0.6, // dive landing clamp
    floatX: halfX - 0.65, // floating objects bounce here
    ...along,
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

// The Lazy River in the room (17 October 2026): the river (river.mjs) and what is built on and over it. A wooden bridge crosses it
// (the way everyone walks from one bank to the other), two flat stepping stones stand in its bend (the coach's shortcut: jump from
// the bank to a stone, to the other, to the far bank; miss and he falls in), and two docks on the near bank: the boarding dock,
// where a guest sits into a tube, and upstream of it the exit dock, where riders coming back round climb off, with the tube return
// beside it. `walkable` is the river's part of the deck test; `route` walks round it, over the bridge.
function riverPlace(spec) {
  const r = spec.river,
    river = makeRiver({ points: r.points, halfWidth: r.halfWidth, room: spec.room }),
    w = river.w;
  const bridge = { s: r.bridge.s, half: r.bridge.half ?? 0.85, reach: w + 1.3 };
  bridge.ends = [-1, 1].map((side) => ({ ...river.point(bridge.s, side * (w + 1.3)), side }));
  const stones = r.stones.map((st) => ({ ...placeOn(river, st.s, st.d), r: st.r, top: st.r - 0.08 }));
  // A dock is a spot on the near bank (d < 0): where a guest stands, and where their tube floats beside it.
  const dock = (s) => ({
    s,
    stand: river.point(s, -(w + 0.55)),
    water: river.point(s, -(w - 0.8)),
    angle: Math.atan2(river.at(s).nx, river.at(s).nz),
  });
  const docks = { board: dock(r.board), exit: dock(r.exit) };
  docks.tubeReturn = river.point(r.exit - 1.9, -(w + 1.5));
  const onBridge = (q, radius = 0) =>
    Math.abs(q.s - bridge.s) < bridge.half - radius * 0.5 && Math.abs(q.d) < bridge.reach;
  const place = {
    ...river,
    bridge,
    stones,
    docks,
    flow: r.flow,
    hidden: r.hidden,
    // Where a coach-sized body can stand, as far as the river goes: the bridge and the stones are dry, the water is not (its edge
    // `edge` out from the banks, plus half the body).
    walkable(x, z, radius = 0) {
      const q = river.locate(x, z);
      if (onBridge(q, radius)) return true;
      for (const st of stones) if (Math.hypot(x - st.x, z - st.z) < st.top) return true;
      const reach = w + 0.12 + radius * 0.5;
      return !(Math.abs(q.d) < reach && q.dist < reach + 0.001);
    },
    onBridge: (x, z, radius = 0) => onBridge(river.locate(x, z), radius),
    // On a stepping stone (the coach can stand there; nobody else goes).
    stoneAt: (x, z) => stones.find((st) => Math.hypot(x - st.x, z - st.z) < st.top) || null,
    // Over open water, as a jumping coach can be: in the river, off the bridge and off the stones.
    overWater(x, z) {
      const q = river.locate(x, z);
      return Math.abs(q.d) < w + 0.6 && !onBridge(q) && !place.stoneAt(x, z);
    },
    // Does a walk from a to b get its feet wet (the bridge is dry)?
    wet(a, b) {
      const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n,
          z = a.z + ((b.z - a.z) * k) / n,
          q = river.locate(x, z);
        if (Math.abs(q.d) < w + 0.35 && q.dist < w + 0.35 && !onBridge(q)) return true;
      }
      return false;
    },
    // A deck route round the river: straight when dry, else through waypoints along the banks, over the bridge if it must cross.
    route(from, to) {
      if (!place.wet(from, to)) return [{ x: to.x, z: to.z }];
      const nodes = navNodes(),
        all = [from, ...nodes, to],
        n = all.length,
        dist = Array(n).fill(Infinity),
        prev = Array(n).fill(-1),
        done = Array(n).fill(false),
        edge = (i, j) =>
          i > 0 && j > 0 && i < n - 1 && j < n - 1 ? nav.edges[i - 1][j - 1] : !place.wet(all[i], all[j]);
      dist[0] = 0;
      for (let k = 0; k < n; k++) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || dist[u] === Infinity || u === n - 1) break;
        done[u] = true;
        for (let v = 0; v < n; v++) {
          if (done[v] || !edge(u, v)) continue;
          const d = dist[u] + Math.hypot(all[u].x - all[v].x, all[u].z - all[v].z);
          if (d < dist[v]) {
            dist[v] = d;
            prev[v] = u;
          }
        }
      }
      if (prev[n - 1] < 0) return [{ x: to.x, z: to.z }];
      const path = [];
      for (let i = n - 1; i > 0; i = prev[i]) path.unshift({ x: all[i].x, z: all[i].z });
      return path;
    },
    // Deck spots along both banks, facing the water (where a visitor goes to reach it): `side` is the bank (-1 the near one),
    // (fx, fz) the way into the water.
    edgeSpots(venue) {
      if (place._spots) return place._spots;
      const spots = [];
      for (let s = river.start + 2.2; s <= river.end - 2.2; s += 1.6)
        for (const side of [-1, 1]) {
          if (Math.abs(s - bridge.s) < 1.6) continue;
          const c = river.at(s),
            p = river.point(s, side * (w + 0.45));
          if (!venue.isDeck(p.x, p.z, 3, 0.3)) continue;
          spots.push({ ...p, s, side, axis: "river", face: -side, fx: -side * c.nx, fz: -side * c.nz });
        }
      return (place._spots = spots);
    },
    // A point in the water `depth` in from a bank spot.
    fromBank(spot, depth) {
      return river.point(spot.s, spot.side * (w - depth));
    },
  };
  // The waypoints a route may use, along both banks and at the bridge's ends, and which pairs a walker can go straight between.
  const nav = { nodes: null, edges: null };
  function navNodes() {
    if (nav.nodes) return nav.nodes;
    const nodes = [...bridge.ends.map((e) => ({ x: e.x, z: e.z }))],
      d = spec.deck,
      inside = (p) => p.x > d.minX + 0.6 && p.x < d.maxX - 0.6 && p.z > d.minZ + 0.6 && p.z < d.maxZ - 0.6;
    for (let s = river.start + 1; s <= river.end - 1; s += 2.4)
      for (const side of [-1, 1])
        for (const off of [1.5, 4.2]) {
          const p = river.point(s, side * (w + off));
          if (inside(p) && place.walkable(p.x, p.z, 0.4)) nodes.push(p);
        }
    nav.nodes = nodes;
    nav.edges = nodes.map((a) => nodes.map((b) => a !== b && !place.wet(a, b)));
    return nodes;
  }
  return place;
}

// Where the mop bucket stands (incidents/wet.mjs) when a venue does not say: a free corner of the deck by the starting-block
// end, right of the lockers, in every one of the first six pools.
const MOP_SPOT = { x: 12.6, z: -11.6 };
function makeVenue(spec) {
  const pool = poolGeometry(spec.lanes, spec.basin);
  spec = { ...spec, fixtures: { mop: MOP_SPOT, ...spec.fixtures } };
  // The Lazy River has no basin: a river curves across the room (river.mjs), with its bridge, stepping stones and docks.
  const river = spec.river ? riverPlace(spec) : null;
  // A door is crossed along x (the side wall of a locker room: inside at insideX, out on the deck at outsideX, both at doorZ) or,
  // with `insideZ`, along z (a door in the back wall: inside at insideZ behind it, out on the deck at doorZ).
  const arrival = { ...ARRIVAL_TIMING, ...spec.doors };
  arrival.insideZ ??= arrival.doorZ;
  // Where each side's door is (side -1 or 1): `inside` (the locker room, the lift), `door` (the doorway) and `outside` (a step out on
  // the deck). The two doors mirror each other across x in every venue but the Rooftop Pool, whose two lifts face each other from
  // the two ends of the deck (`alongZ`: the same x, side × z, each crossed along z). Everything that walks through a door asks here.
  if (arrival.alongZ) {
    const x = arrival.doorX;
    arrival.at = (side, where) => ({ x, z: side * arrival[where + "Z"] });
    arrival.sideOf = (p) => (Math.abs(p.z + arrival.outsideZ) < Math.abs(p.z - arrival.outsideZ) ? -1 : 1);
    arrival.isInside = (p) => Math.abs(p.x - x) < 0.2 && Math.abs(Math.abs(p.z) - arrival.insideZ) < 0.2;
    arrival.isDoorPoint = (at) => Math.abs(at.z) === arrival.doorZ;
    arrival.crossesZ = true;
    arrival.enterAngle = (side) => (side > 0 ? Math.PI : 0);
  } else {
    arrival.at = (side, where) =>
      where === "inside"
        ? { x: side * arrival.insideX, z: arrival.insideZ }
        : where === "door"
          ? { x: side * arrival.doorX, z: arrival.doorZ }
          : { x: side * arrival.outsideX, z: arrival.doorZ };
    arrival.sideOf = (p) => (Math.abs(p.x + arrival.outsideX) < Math.abs(p.x - arrival.outsideX) ? -1 : 1);
    arrival.isInside = (p) =>
      Math.abs(p.z - arrival.insideZ) < 0.2 && Math.abs(Math.abs(p.x) - arrival.insideX) < 0.2;
    arrival.isDoorPoint = (at) => at.z === arrival.doorZ;
    arrival.crossesZ = arrival.insideZ !== arrival.doorZ;
    arrival.enterAngle = (side) => (arrival.insideZ === arrival.doorZ ? -side * (Math.PI / 2) : 0);
  }
  // The Mountain Hot Springs have no basin either: four springs in the snow (onsen-plan.mjs).
  const onsen = spec.onsen || null;
  // The Jumping Pool: a lane pool's basin, and a hot tub on the far deck (dive-plan.mjs), walked round by routes of its own.
  const dive = spec.dive || null,
    diveRoute = dive ? makeDiveRoute([...spec.furniture, ...massageBlocks(spec.fixtures)]) : null;
  const obstacles = [
    ...(river || onsen ? [] : [{ x: 0, z: 0, hx: pool.solidX, hz: pool.solidZ, kind: "pool" }]),
    ...(spec.blocks === false
      ? []
      : spec.lanes.map((x) => ({ x, z: -9.15, hx: 0.6, hz: 0.56, kind: "block" }))),
    { ...spec.sanitation.bin, hx: 0.62, hz: 0.62, kind: "waste-bin", minLevel: 3 },
    ...spec.furniture.filter((f) => f.hx).map((f) => ({ x: f.x, z: f.z, hx: f.hx, hz: f.hz, kind: f.kind })),
    { x: spec.fixtures.mop.x, z: spec.fixtures.mop.z, hx: 0.34, hz: 0.34, kind: "mop-bucket" },
    // The massage table (incidents/massage.mjs), where a venue has one: 2 m long, lying along its `angle` (0 or a right angle).
    // Only its legs are in the way (0.1 m either side of its middle line): a coach stands close enough to reach across its top.
    ...(spec.fixtures.massage ? [massageObstacle(spec.fixtures.massage)] : []),
    ...(spec.fixtures.massageMore || []).map(massageObstacle),
  ];
  const venue = {
    ...spec,
    pool,
    river,
    arrival,
    entry: ENTRY,
    obstacles,
    laneCount: spec.lanes.length,
    // What the way out is called in a toast: the locker doors, or the Aqua Disco's one door.
    doorWord: spec.doorWord ?? (spec.lockers.length ? "a locker door" : "the door"),
    // Walkable deck test for a coach-sized body. Level-gated furniture (the waste bin) is absent early on.
    isDeck(x, z, level = 3, radius = COACH_TUNING.radius) {
      const d = spec.deck;
      if (x < d.minX || x > d.maxX || z < d.minZ || z > d.maxZ) return false;
      return (
        !obstacles.some(
          (b) =>
            (!b.minLevel || level >= b.minLevel) &&
            Math.abs(x - b.x) < b.hx + radius &&
            Math.abs(z - b.z) < b.hz + radius,
        ) &&
        (!river || river.walkable(x, z, radius)) &&
        (!onsen || onsenWalkable(x, z, radius)) &&
        (!dive || diveWalkable(x, z, radius))
      );
    },
    // Out of the doorway and on the deck (a guest or a visitor who came in has cleared the door).
    pastDoor(v) {
      if (arrival.alongZ) return Math.abs(v.z) <= arrival.outsideZ + 0.2;
      return arrival.insideZ === arrival.doorZ
        ? Math.abs(v.x) <= arrival.outsideX + 0.2
        : v.z >= arrival.doorZ - 0.2;
    },
    // Waiting rows sit behind the starting blocks, beneath the clubhouse wall.
    queuePosition(side, slot) {
      const q = spec.queue,
        row = q.perRow ?? 4;
      // (The Rooftop Pool's lifts face each other from the two ends: each side waits in rows by its own lift, `alongZ`.)
      if (q.alongZ)
        return {
          x: q.startX + (slot % row) * q.stepX,
          z: side * (q.startZ - Math.floor(slot / row) * q.stepZ),
        };
      // (The Lazy River's lounge is all on one side of its door: both sides fill blocks of their own, `blockX`.)
      if (q.blockX)
        return {
          x: q.blockX[side < 0 ? 0 : 1] - (slot % row) * q.stepX,
          z: q.startZ - Math.floor(slot / row) * q.stepZ,
        };
      return {
        x: side * (q.outerX - (slot % row) * q.stepX),
        z: q.startZ - Math.floor(slot / row) * q.stepZ,
      };
    },
    // Shortest deck route around the basin: straight when clear, otherwise via the corridor corners.
    // Coach-sized bodies collide with the starting blocks, so `solid` routes pass further behind them.
    route(from, to, { solid = false } = {}) {
      if (river) return river.route(from, to);
      // (The hot springs: round the springs and the boulders, onsen-plan.mjs.)
      if (onsen) return onsenRoute(from, to);
      // (The Jumping Pool: round the pool, the diving stations, the hot tub and the deck's furniture, dive-plan.mjs.)
      if (dive) return diveRoute(from, to);
      // (The Rooftop Pool: round the basin on the near side only, the sunbeds, the cabanas and the bar, roof-plan.mjs.)
      if (spec.roof) return roofRoute(from, to);
      // (The cruise ship: round the whole pool (both halves), the rows of loungers, the bar and the lobbies, cruise-plan.mjs.)
      if (spec.cruise) return cruiseRoute(from, to);
      // Solid bodies also collide with the starting-block row just behind the basin's left end.
      const kx = pool.keepOutX - 0.05,
        kz = pool.keepOutZ - 0.05,
        minZ = solid ? -10.1 : -kz;
      const blocked = (a, b) => segmentHitsBox(a, b, kx, minZ, kz);
      if (!blocked(from, to)) return [{ x: to.x, z: to.z }];
      const cx = pool.corridorX,
        backZ = solid ? pool.walkZ - 0.55 : pool.walkZ,
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
      if (river) return river.edgeSpots(venue);
      if (onsen) return onsenEdgeSpots().filter((s) => venue.isDeck(s.x, s.z, 3, 0.3));
      const spots = [];
      // The Rooftop Pool: along the near side and both ends (the far side is the infinity edge).
      if (spec.roof) {
        for (let z = -8; z <= 8; z += 2) spots.push({ x: -(pool.solidX + 0.45), z, face: 1, axis: "x" });
        for (const side of [-1, 1])
          for (const x of [-2.2, 0, 2.2])
            spots.push({ x, z: side * (pool.solidZ + 0.45), face: -side, axis: "z" });
        return spots.filter((s) => venue.isDeck(s.x, s.z, 3, 0.3));
      }
      // The cruise ship: along the near side and the lane half's ends (the far side of the lanes is the rope and the free water).
      if (spec.cruise) {
        for (let z = -6; z <= 6; z += 2) spots.push({ x: -(pool.solidX + 0.45), z, face: 1, axis: "x" });
        for (const x of spec.lanes) spots.push({ x: x + 1.15, z: pool.solidZ + 0.45, face: -1, axis: "z" });
        return spots.filter((s) => venue.isDeck(s.x, s.z, 3, 0.3));
      }
      // The Wave Pool: along the beach at the water's edge and along both ends (the far side is the wave house).
      if (spec.waves) {
        for (let z = -8; z <= 8; z += 2) spots.push({ x: -(pool.solidX + 0.45), z, face: 1, axis: "x" });
        for (const side of [-1, 1])
          for (let x = -5.6; x <= 5.6; x += 2.8)
            spots.push({ x, z: side * (pool.solidZ + 0.45), face: -side, axis: "z" });
        return spots.filter((s) => venue.isDeck(s.x, s.z, 3, 0.3));
      }
      for (const side of [-1, 1])
        for (let z = -6; z <= 6; z += 2)
          spots.push({ x: side * (pool.solidX + 0.45), z, face: -side, axis: "x" });
      for (const x of spec.lanes) spots.push({ x: x + 1.15, z: pool.solidZ + 0.45, face: -1, axis: "z" });
      return spots.filter((s) => venue.isDeck(s.x, s.z, 3, 0.3));
    },
  };
  return venue;
}

// Classic indoor community club: three lanes, office in the upper-right corner. No locker rooms since 30 October 2026 (the
// creator: "remove the lockers and place the doors on the same axis as the wall"): the MEN's and the WOMEN's doors are flush in
// the back wall where the locker rooms stood, each crossed along z (inside behind the wall, out on the deck), as the Aqua Disco's.
export const CLUB = makeVenue({
  id: "club",
  name: "Community Swim Club",
  indoor: true,
  lanes: [-3.2, 0, 3.2],
  deck: { minX: -14.1, maxX: 14.1, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -14.7, maxX: 14.7, minZ: -16.7, maxZ: 13.5 },
  doors: { insideX: 10.7, doorX: 10.7, doorZ: -14.85, outsideX: 10.7, insideZ: -16.55 },
  doorWord: "a changing-room door",
  lockers: [],
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
  ],
});

// Open-air resort: a wider five-lane pool with a trampoline tower whose splash zone lands in lane 5. Splash Park, the
// Sunset Lagoon and the Grand Gala Arena share this floor plan exactly (so a shift plays the same anywhere) and only
// dress it differently.
const RESORT_SPEC = {
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
    relief: { x: 13.6, z: 0.4 },
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
  // Launch bed overhangs the far deck; jumpers land in the last lane around landZ. The tower stands off to
  // the right of the scoreboard so every flip stays in view.
  trampoline: {
    lane: 4,
    x: 11.4,
    z: 5,
    bedX: 9.5,
    bedY: 2.62,
    stairBottomX: 15.75,
    landZ: 5,
    zone: 3,
  },
  furniture: [
    { kind: "bench", x: -12.2, z: -0.9, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "bench", x: 13.9, z: -6.2, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "rack", x: -12.6, z: 7.9, hx: 0.48, hz: 1.03 },
    { kind: "station", x: 13.6, z: 8.1, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 13.6, z: 0.4, hx: 0.9, hz: 0.6 },
    { kind: "medkit-cabinet", x: -15.35, z: 4.7, hx: 0.3, hz: 0.7 },
    { kind: "lifeguard-tower", x: -13.4, z: -7.6, hx: 0.75, hz: 0.75 },
    { kind: "tower", x: 11.4, z: 5, hx: 0.95, hz: 1.05 },
    { kind: "stairs", x: 14, z: 5, hx: 1.45, hz: 0.55 },
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
};
// Where the massage table stands in the venues that have one (23 October 2026, the creator: "add this massage table in some venues
// !! not all!!"): its middle, the way its head end points (`angle`) and its front side (`side`: +1 is the side to the head end's
// right), the side the first coach works from. Behind the far end of the pool, lying across the deck, clear of the walks, the
// stations and the evacuation rows: the coach bots' routes do not pass there, so no level plays differently for it being there.
const MASSAGE_TABLE = { x: -5.5, z: 11.75, angle: Math.PI / 2, side: -1 };
// The massage beds as boxes a route goes round (the Jumping Pool's two: dive-plan.mjs), their legs' box a little padded.
function massageBlocks(fixtures = {}) {
  return [fixtures.massage, ...(fixtures.massageMore || [])].filter(Boolean).map((t) => {
    const alongX = Math.abs(Math.sin(t.angle || 0)) > 0.5;
    return { x: t.x, z: t.z, hx: alongX ? 1.0 : 0.32, hz: alongX ? 0.32 : 1.0 };
  });
}
function massageObstacle(t) {
  const alongX = Math.abs(Math.sin(t.angle || 0)) > 0.5;
  return { x: t.x, z: t.z, hx: alongX ? 1.0 : 0.1, hz: alongX ? 0.1 : 1.0, kind: "massage-table" };
}
export const RESORT = makeVenue({
  ...RESORT_SPEC,
  id: "resort",
  name: "Splash Park",
  scenery: "park",
  sunAzimuth: 2.65,
});
// Open-air beach club on a lagoon: the sun sinks into the sea behind the start line, from golden hour into dusk.
export const LAGOON = makeVenue({
  ...RESORT_SPEC,
  id: "lagoon",
  name: "Sunset Lagoon",
  scenery: "lagoon",
  sunAzimuth: 2.45,
  lighting: "golden",
  fixtures: { ...RESORT_SPEC.fixtures, massage: MASSAGE_TABLE },
});
// A domed indoor arena for the season finale: grandstands, spotlights and a very tall roof.
export const ARENA = makeVenue({
  ...RESORT_SPEC,
  id: "arena",
  name: "Grand Gala Arena",
  indoor: true,
  lighting: "gala",
  fixtures: { ...RESORT_SPEC.fixtures, massage: MASSAGE_TABLE },
});

// The Aquatic Centre (16 October 2026): an indoor competition pool for serious swimmers. Splash Park's floor plan (the same five
// lanes, doors, stations and kit, so every system plays as it does there) without the trampoline: a victory podium stands where
// the tower was and the snack kiosk is the officials' table (it keeps the dog treats).
const NOT_AQUATIC = new Set(["tower", "stairs", "palm", "lounger", "umbrella"]);
export const AQUATIC = makeVenue({
  ...RESORT_SPEC,
  id: "aquatic",
  name: "Aquatic Centre",
  indoor: true,
  lighting: "aquatic",
  trampoline: null,
  fixtures: { ...RESORT_SPEC.fixtures, massage: MASSAGE_TABLE },
  furniture: [
    ...RESORT_SPEC.furniture.filter((f) => !NOT_AQUATIC.has(f.kind)),
    { kind: "podium", x: 12.4, z: 4.8, hx: 1.35, hz: 0.62 },
    { kind: "team-bench", x: -12.9, z: 10.6, angle: 0, hx: 1.5, hz: 0.42 },
    { kind: "plant", x: 15.4, z: -11.2, hx: 0.5, hz: 0.5, scale: 0.9 },
  ],
});

// The Aqua Disco (16 October 2026): a party pool for an aqua-aerobics class, and nothing else. A plan of its own: four wide
// zones of open water (no ropes, no lane lines, no starting blocks: `blocks: false`) where the class spreads out in rows facing
// the instructor's stage at the far end (`class`), a DJ booth, a bar, speaker stacks. The coach still gives each guest a zone
// (the lanes, inside), and every incident plays as anywhere else.
export const DISCO = makeVenue({
  id: "disco",
  name: "Aqua Disco",
  indoor: true,
  lighting: "disco",
  class: true,
  blocks: false,
  lanes: [-4.8, -1.6, 1.6, 4.8],
  deck: { minX: -13.6, maxX: 13.6, minZ: -15.2, maxZ: 12.9 },
  room: { minX: -14.2, maxX: 14.2, minZ: -16.7, maxZ: 13.6 },
  // No locker rooms (the creator, 16 October 2026): one double door flush in the back wall, in the middle; each side of the line
  // comes in and goes out through its own leaf.
  doors: { insideX: 0.62, doorX: 0.62, doorZ: -14.85, outsideX: 0.62, insideZ: -16.55 },
  lockers: [],
  queue: { outerX: 4.6, stepX: 1.1, startZ: -11.1, stepZ: 1.15 },
  coachStart: { x: -8.4, z: 0 },
  cameraFollow: { kx: 0.22, maxX: 2.4 },
  // Where the class looks: Valentina's stage, past the far end of the pool.
  stage: { x: 0, z: 11.6, y: 0.62 },
  stations: {
    fins: { x: -11.4, z: 7.2 },
    chlorine: { x: 11.6, z: 7.0 },
    relief: { x: 11.6, z: 2.8 },
  },
  sanitation: { rack: { x: -13.1, z: -2.6 }, bin: { x: -11.8, z: 1.4 }, reach: 6.2 },
  ringMounts: [
    { x: -3.6, z: -15.7, angle: 0 },
    { x: -13.85, z: -6, angle: Math.PI / 2 },
    { x: 13.85, z: -4.6, angle: -Math.PI / 2 },
  ],
  rescue: { bench: { x: -10.4, z: -1.2 }, approach: { x: -9.1, z: -1.2 } },
  fixtures: {
    fishNet: { x: 13.85, z: -1.6, angle: -Math.PI / 2 },
    treats: { x: -12.6, z: 10.6 },
    flashlight: { x: 11.6, z: -7.4 },
    fuseBox: { x: 13.9, z: 11.4, angle: -Math.PI / 2 },
  },
  trampoline: null,
  furniture: [
    { kind: "bench", x: -10.4, z: -1.85, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "bench", x: 10.6, z: -2.6, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "rack", x: -11.4, z: 7.2, hx: 0.48, hz: 1.03 },
    { kind: "station", x: 11.6, z: 7.0, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 11.6, z: 2.8, hx: 0.9, hz: 0.6 },
    { kind: "stage", x: 0, z: 11.6, hx: 2.8, hz: 1.0 },
    { kind: "dj-booth", x: -12.2, z: -9.4, hx: 1.0, hz: 1.3 },
    { kind: "bar", x: -12.9, z: 10.6, hx: 0.75, hz: 1.5 },
    { kind: "speaker", x: -12.9, z: 4.2, hx: 0.6, hz: 0.6 },
    { kind: "speaker", x: 12.9, z: -10.2, hx: 0.6, hz: 0.6 },
    { kind: "speaker", x: 4.6, z: 12.2, hx: 0.6, hz: 0.6 },
    { kind: "speaker", x: -4.6, z: 12.2, hx: 0.6, hz: 0.6 },
    { kind: "plant", x: -13.0, z: -12.4, hx: 0.5, hz: 0.5, scale: 0.9 },
  ],
});

// The Kids Pool (16 October 2026): an outdoor paddling pool for children and nobody else. No lanes for the coach to pick (the
// pool's three zones are only where the kids are counted: the coach sends a kid "into the pool"), no starting blocks; the kids do
// not queue, they run all over the deck until the coach catches one (`kids`). One gate in the back fence (no locker rooms), a
// slide, a lifeguard chair and a toy box, and toys floating in the water (scene/kids.mjs).
export const KIDS = makeVenue({
  id: "kids",
  name: "Kids Pool",
  doorWord: "the gate",
  indoor: false,
  scenery: "park",
  lighting: "day",
  kids: true,
  blocks: false,
  lanes: [-3.2, 0, 3.2],
  deck: { minX: -14.1, maxX: 14.1, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -14.7, maxX: 14.7, minZ: -16.7, maxZ: 13.5 },
  doors: { insideX: 0.62, doorX: 0.62, doorZ: -14.85, outsideX: 0.62, insideZ: -16.55 },
  lockers: [],
  queue: { outerX: 4.6, stepX: 1.1, startZ: -11.1, stepZ: 1.15 },
  coachStart: { x: -6.6, z: 0 },
  cameraFollow: { kx: 0.22, maxX: 2.4 },
  props: ["mop", "mop-bucket", "duck", "swim-ring"],
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
    { kind: "rack", x: -10.3, z: 7.8, hx: 0.48, hz: 1.03 },
    { kind: "station", x: 10.8, z: 7.8, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 10.8, z: 3.9, hx: 0.9, hz: 0.6 },
    { kind: "treat-table", x: -13.4, z: 8.4, hx: 0.36, hz: 0.36 },
    { kind: "slide", x: -11.8, z: -8.4, hx: 0.75, hz: 1.9 },
    { kind: "lifeguard", x: 12.6, z: 0.4, hx: 0.6, hz: 0.6 },
    { kind: "toy-box", x: -12.9, z: 11.2, hx: 0.65, hz: 0.45 },
  ],
});

// Senior Aqua Fit (16 October 2026, the creator: "do not follow our venues' layout… no lockers… impress me"): a Victorian glass
// conservatory over a four-lane pool for a gentle crowd of seniors, laid out for them. No starting blocks (steps with brass handrails
// at the near end, a pool hoist at the side); no locker rooms but a pair of tall glass doors in the back wall; the waiting area is a
// lounge on a rug with room between the guests for a wheelchair (`queue`: wider steps, four to a row); the kit is on the far side
// (fins, water care, eye care, the fish net), the skimmer, bin and rest bench on the near side, a hydrotherapy spa and the tea
// trolley (the dog treats are its biscuits) at the near right, the gramophone and a reading corner at the far right (scene/senior.mjs).
// The seniors walk slowly, stooped; some come in wheelchairs and stand up to swim (`seniors`, sim.mjs).
export const SENIOR = makeVenue({
  id: "senior",
  name: "Senior Aqua Fit",
  doorWord: "the glass doors",
  indoor: true,
  lighting: "senior",
  seniors: true,
  blocks: false,
  lanes: [-4.8, -1.6, 1.6, 4.8],
  deck: { minX: -14.6, maxX: 14.6, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -15.2, maxX: 15.2, minZ: -16.7, maxZ: 13.6 },
  doors: { insideX: 0.62, doorX: 0.62, doorZ: -14.85, outsideX: 0.62, insideZ: -16.55 },
  lockers: [],
  queue: { outerX: 6.1, stepX: 1.3, startZ: -11.05, stepZ: 1.3, perRow: 4 },
  coachStart: { x: -9.0, z: -4.6 },
  cameraFollow: { kx: 0.22, maxX: 2.6 },
  props: [
    "mop",
    "mop-bucket",
    "wheelchair",
    "hoist",
    "armchair",
    "monstera",
    "trolley",
    "gramophone",
    "lounger",
  ],
  stations: {
    fins: { x: 12.4, z: -5.6 },
    chlorine: { x: 12.4, z: 7.4 },
    relief: { x: 12.4, z: 3.4 },
  },
  sanitation: { rack: { x: -13.7, z: -3.6 }, bin: { x: -12.5, z: -1.3 }, reach: 6.2 },
  ringMounts: [
    { x: -4.2, z: -15.7, angle: 0 },
    { x: -14.85, z: -6.6, angle: Math.PI / 2 },
    { x: 14.85, z: 1.4, angle: -Math.PI / 2 },
  ],
  rescue: { bench: { x: -11.4, z: 2.4 }, approach: { x: -10.1, z: 2.4 } },
  fixtures: {
    fishNet: { x: 14.85, z: -2.2, angle: -Math.PI / 2 },
    treats: { x: -12.9, z: 11.3 },
    flashlight: { x: 12.4, z: -9.4 },
    fuseBox: { x: 14.9, z: 11.6, angle: -Math.PI / 2 },
    // The spa's massage table, on the far deck between the door and the fins rack (incidents/massage.mjs).
    massage: { x: 10.2, z: -11.6, angle: 0, side: 1 },
  },
  trampoline: null,
  furniture: [
    { kind: "bench", x: -11.4, z: 1.75, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "rack", x: 12.4, z: -5.6, hx: 0.48, hz: 1.03 },
    { kind: "station", x: 12.4, z: 7.4, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 12.4, z: 3.4, hx: 0.9, hz: 0.6 },
    { kind: "spa", x: -11.7, z: 8.0, hx: 1.55, hz: 1.55 },
    { kind: "hoist", x: -7.35, z: 4.4, hx: 0.36, hz: 0.36 },
    { kind: "trolley", x: -12.9, z: 11.3, hx: 0.5, hz: 0.38 },
    { kind: "gramophone", x: 12.9, z: 10.9, hx: 0.5, hz: 0.5 },
    { kind: "armchair", x: 13.3, z: -1.3, angle: -Math.PI / 2, hx: 0.5, hz: 0.5 },
    { kind: "armchair", x: 13.3, z: 0.1, angle: -Math.PI / 2, hx: 0.5, hz: 0.5 },
    { kind: "lounger", x: -4.6, z: 11.75, angle: Math.PI / 2, hx: 1.05, hz: 0.45 },
    { kind: "lounger", x: 4.6, z: 11.75, angle: Math.PI / 2, hx: 1.05, hz: 0.45 },
    { kind: "plant", x: -13.9, z: -14.3, hx: 0.5, hz: 0.5 },
    { kind: "plant", x: 13.9, z: -14.3, hx: 0.5, hz: 0.5 },
    { kind: "plant", x: -13.9, z: 4.9, hx: 0.5, hz: 0.5 },
    { kind: "plant", x: 0, z: 12.0, hx: 0.5, hz: 0.5 },
  ],
});

// The Lazy River (17 October 2026, the creator: "a lazy river… curves, plants and rocks… we only see a section of it, where the
// people get on and get off… hand them a tube… a door to enter and exit… rocks in the middle so Coach Waters can jump on them and
// cut corners… an aquatic park, lazy river, jungle kind of thing"): an outdoor jungle water park. The river comes in from a cave in
// the upper left, swings down through the middle of the room in an S and leaves through a tunnel on the right (river.mjs); the near
// bank (below it on screen) has the door, the lounge, the tube rack and the two docks, the far bank the water care, the fish net and
// the fuse box. No lanes and no swimmers: every guest rides a tube once round the loop (sim.mjs `updateRiver`).
export const RIVER = makeVenue({
  id: "river",
  name: "Lazy River",
  indoor: false,
  scenery: "jungle",
  sunAzimuth: 2.5,
  lighting: "river",
  doorWord: "the jungle gate",
  river: {
    points: [
      { x: 9.2, z: -19.5 },
      { x: 8.6, z: -14 },
      { x: 5.6, z: -9 },
      { x: 1.2, z: -5 },
      { x: -2.4, z: -0.6 },
      { x: -2.2, z: 4.4 },
      { x: 1.6, z: 8.2 },
      { x: 5.4, z: 11.2 },
      { x: 7.2, z: 16.5 },
    ],
    halfWidth: 3,
    flow: 1.35, // m/s, the current a tube rides
    hidden: 3, // s out of sight, round the rest of the loop
    exit: 12.5, // the exit dock, along the river
    board: 19.5, // the boarding dock
    bridge: { s: 34 },
    stones: [
      { s: 26.2, d: -1.35, r: 0.66 },
      { s: 26.2, d: 1.35, r: 0.66 },
    ],
  },
  tubes: 10,
  blocks: false,
  // (Two "lanes" since Phase 3: the two ways round the loop, the LAZY LOOP and the RAPIDS, river-ride.mjs ROUTES.)
  lanes: [0, 0],
  deck: { minX: -14.6, maxX: 14.6, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -15.2, maxX: 15.2, minZ: -16.7, maxZ: 13.6 },
  doors: { insideX: 0.62, doorX: 0.62, doorZ: -14.85, outsideX: 0.62, insideZ: -16.55 },
  lockers: [],
  queue: { blockX: [-1.7, -7.9], stepX: 1.2, startZ: -12.1, stepZ: 1.2, perRow: 5 },
  coachStart: { x: -7.0, z: -4.0 },
  cameraFollow: { kx: 0.22, maxX: 2.6 },
  props: ["mop", "mop-bucket", "swim-ring"],
  stations: {
    fins: { x: -5.6, z: -9.4 }, // the tube rack
    chlorine: { x: 9.2, z: 2.4 },
    relief: { x: 9.2, z: -1.4 },
  },
  sanitation: { rack: { x: -13.7, z: 3.6 }, bin: { x: -12.6, z: 6.2 }, reach: 6.2 },
  ringMounts: [
    { x: -14.85, z: -1.2, angle: Math.PI / 2 },
    { x: 14.85, z: 5.6, angle: -Math.PI / 2 },
    { x: -14.85, z: 9.4, angle: Math.PI / 2 },
  ],
  rescue: { bench: { x: -10.6, z: -5.8 }, approach: { x: -9.4, z: -5.8 } },
  // Where everyone out of the river waits while it is closed (a floater, a fish): a block on the near bank.
  evacSpots: [-3.6, -2.4, -1.2, 0, 1.2].flatMap((z) =>
    [-6.8, -7.9, -9.0, -10.1, -11.2].map((x) => ({ x, z })),
  ),
  fixtures: {
    fishNet: { x: 14.85, z: -4.6, angle: -Math.PI / 2 },
    treats: { x: -11.8, z: 10.2 },
    flashlight: { x: -7.6, z: 10.6 },
    fuseBox: { x: 14.9, z: 9.8, angle: -Math.PI / 2 },
    mop: { x: -9.4, z: 3.2 },
  },
  trampoline: null,
  furniture: [
    { kind: "bench", x: -10.6, z: -6.45, angle: Math.PI / 2, hx: 0.49, hz: 1.7 },
    { kind: "tube-rack", x: -5.6, z: -9.4, hx: 0.6, hz: 1.1 },
    { kind: "station", x: 9.2, z: 2.4, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 9.2, z: -1.4, hx: 0.9, hz: 0.6 },
    { kind: "tiki", x: -14.0, z: -14.75, hx: 0.45, hz: 0.45 },
    { kind: "tiki", x: 12.6, z: 11.4, hx: 0.5, hz: 0.5 },
    { kind: "palm", x: -12.8, z: 0.8, hx: 0.5, hz: 0.5 },
    { kind: "palm", x: 11.6, z: -9.6, hx: 0.5, hz: 0.5 },
    { kind: "palm", x: 12.2, z: -12.6, hx: 0.5, hz: 0.5 },
    { kind: "boulder", x: -13.2, z: 11.6, hx: 0.9, hz: 0.8 },
    { kind: "boulder", x: 13.0, z: 0.2, hx: 0.8, hz: 0.9 },
    { kind: "snack-hut", x: -9.8, z: 7.2, hx: 1.2, hz: 1.0 },
  ],
});

// The Wave Pool (17 October 2026, the creator: "a new venue with its unique mechanic… an amazing architecture and aesthetics… the
// water needs to look amazing… we don't click on the swimmers and assign them… they just enter and go straight at it, so we need
// to intercept the people and hand them the tubes… there are not a lot of tubes"): an outdoor surf park. A big basin with a
// beach: the sand runs down into the water along the near side (screen bottom), the deep end is against the wave house on the far
// side, which fills the far side of the room (`wave-house`, solid) and pushes the waves out of its chambers (waves.mjs). The gate
// is in the left wall; a guest walks round the near end of the pool to the beach and straight into the waves (wave-pool.mjs), so
// the coach meets them on the way with a tube from the tube hut by the beach corner (only five). The lifeguard tower stands on the
// sand with a ring on it, towels to rest on beside it; the water care in the far corner by the gate, eye care at the right end.
const WAVE_SAND_SPOTS = [-8.2, -7.0, -5.8, -4.6, -3.4, -2.2, 6.6, 7.8, 8.8].flatMap((z) =>
  [-8.9, -9.9].map((x) => ({ x, z })),
);
export const WAVE = makeVenue({
  id: "wave",
  name: "Wave Pool",
  indoor: false,
  scenery: "surf",
  sunAzimuth: 2.3,
  lighting: "wave",
  doorWord: "the surf gate",
  waves: true,
  basin: { halfX: WAVE_BASIN.halfX, halfZ: WAVE_BASIN.halfZ },
  tubes: 5,
  wetChance: 0.35, // everyone comes out soaked: more drips than anywhere
  blocks: false,
  lanes: [0],
  deck: { minX: -14.6, maxX: 14.6, minZ: -15.2, maxZ: 12.65 },
  room: { minX: -15.2, maxX: 15.2, minZ: -16.7, maxZ: 13.6 },
  doors: { insideX: 0.62, doorX: 0.62, doorZ: -14.85, outsideX: 0.62, insideZ: -16.55 },
  lockers: [],
  // (Nobody queues: guests only wait here, inside the gate, while the pool is closed.)
  queue: { outerX: 5.4, stepX: 1.15, startZ: -11.7, stepZ: 1.15, perRow: 4 },
  coachStart: { x: -9.4, z: -6.4 },
  cameraFollow: { kx: 0.22, maxX: 2.6 },
  props: ["mop", "mop-bucket", "lifeguard-tower", "surfboard", "beach-umbrella", "deck-chair"],
  stations: {
    fins: { x: -12.5, z: -11.5 }, // the tube hut
    chlorine: { x: 9.8, z: -12.7 },
    relief: { x: 6.4, z: 11.5 },
  },
  sanitation: { rack: { x: -13.9, z: 6.4 }, bin: { x: -12.9, z: 9.0 }, reach: 6.2 },
  ringMounts: [
    { x: -14.85, z: -4.4, angle: Math.PI / 2 },
    { x: -10.75, z: 2.0, angle: Math.PI / 2 }, // on the lifeguard tower
    { x: -14.85, z: 9.6, angle: Math.PI / 2 },
  ],
  // The towels on the sand beside the tower: where a rescued or helped-out bather rests (wave-pool.mjs `towelSpot`).
  rescue: { bench: { x: -9.6, z: 3.6 }, approach: { x: -9.0, z: 4.8 } },
  evacSpots: WAVE_SAND_SPOTS,
  fixtures: {
    fishNet: { x: -14.85, z: -1.4, angle: Math.PI / 2 },
    treats: { x: -11.4, z: 11.6 },
    flashlight: { x: 3.4, z: -14.6 },
    fuseBox: { x: 14.9, z: -12.2, angle: -Math.PI / 2 },
    mop: { x: -6.6, z: -13.9 },
  },
  trampoline: null,
  furniture: [
    // The wave house: the whole far side, from the deep end's wall to the back of the room.
    { kind: "wave-house", x: 11.05, z: 0, hx: 3.55, hz: 10.6 },
    { kind: "lifeguard-tower", x: -11.6, z: 2.0, hx: 0.8, hz: 0.8 },
    { kind: "tube-hut", x: -12.5, z: -11.5, hx: 0.75, hz: 1.05 },
    { kind: "station", x: 9.8, z: -12.7, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 6.4, z: 11.5, hx: 0.9, hz: 0.6 },
    { kind: "surf-shack", x: -12.1, z: 11.4, hx: 1.25, hz: 0.95 },
    { kind: "umbrella", x: -12.9, z: -6.2, hx: 0.25, hz: 0.25 },
    { kind: "umbrella", x: -12.9, z: 7.0, hx: 0.25, hz: 0.25 },
    { kind: "deck-chair", x: -13.7, z: -7.4, angle: Math.PI / 2, hx: 0.45, hz: 0.4 },
    { kind: "deck-chair", x: -13.7, z: -5.0, angle: Math.PI / 2, hx: 0.45, hz: 0.4 },
    { kind: "deck-chair", x: -13.7, z: 5.8, angle: Math.PI / 2, hx: 0.45, hz: 0.4 },
    { kind: "surf-rack", x: -4.0, z: -14.6, hx: 1.3, hz: 0.35 },
    { kind: "palm", x: -14.0, z: -14.4, hx: 0.5, hz: 0.5 },
    { kind: "palm", x: 13.8, z: 11.9, hx: 0.5, hz: 0.5 },
    { kind: "palm", x: -14.1, z: 0.4, hx: 0.5, hz: 0.5 },
  ],
});

// The Rooftop Pool (17 October 2026, the creator: "the rooftop pool… it has to be epic… Marina Bay Sands… infinity pool… umbrellas
// and chairs… guests from opposite sides… they just chill… they talk to each other inside the pool… margaritas… a DJ set on the far
// right… the buildings down below… no swimmers… some lay down… the water spilling on the floor, you have to mop"): a shallow
// infinity pool on the roof of a tower, the city far below past its far edge. Nobody swims and nobody is sent anywhere: guests
// come up in the lifts at both ends and go to the water to chat, or to a sunbed (rooftop.mjs). The plan is roof-plan.mjs.
const RP = ROOF_PLAN;
const ROOF_EVAC = [-4.5, -5.1].flatMap((x) =>
  [-9.6, -8.4, -7.2, -6.0, -4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6, 4.8, 6.0, 7.2, 8.4, 9.6].map((z) => ({
    x,
    z,
  })),
);
export const ROOFTOP = makeVenue({
  id: "roof",
  name: "Rooftop Pool",
  indoor: false,
  scenery: "skyline",
  sunAzimuth: 0.35,
  lighting: "roof",
  doorWord: "a lift",
  roof: true,
  chill: ROOF_CHILL, // (its guests chill: rooftop.mjs)
  basin: { halfX: RP.halfX, halfZ: RP.halfZ },
  tubes: 0, // (no fins and no tubes up here: the coach carries trays of margaritas, rooftop.mjs)
  wetChance: 0.3, // everyone climbs out dripping onto the walk
  blocks: false,
  lanes: [0],
  deck: { minX: -14.6, maxX: 4.55, minZ: -15.2, maxZ: 15.2 },
  room: { minX: -15.2, maxX: 5.0, minZ: -16.9, maxZ: 16.9 },
  doors: {
    alongZ: true,
    doorX: RP.lift.x,
    insideX: RP.lift.x,
    outsideX: RP.lift.x,
    insideZ: RP.lift.insideZ,
    doorZ: RP.lift.doorZ,
    outsideZ: RP.lift.outsideZ,
  },
  lockers: [],
  // (Nobody queues: guests only wait here, by their lift, while the pool is closed.)
  queue: { alongZ: true, startX: -9.0, stepX: 1.1, startZ: 12.8, stepZ: 1.1, perRow: 3 },
  coachStart: { x: -4.7, z: -1.5 },
  cameraFollow: { kx: 0.22, maxX: 2.4 },
  props: [
    "mop",
    "mop-bucket",
    "sunbed",
    "cabana",
    "parasol",
    "dj-booth",
    "speaker",
    "bar-counter",
    "bar-stool",
    "margarita",
    "palm-planter",
    "side-table",
    "lounge-sofa",
    "ice-bucket",
    "lantern",
    "potted-plant",
  ],
  beds: ROOF_BEDS,
  stations: {
    bar: { x: RP.bar.x, z: RP.bar.z + RP.bar.hz + 0.75 }, // the trays of margaritas
    chlorine: { x: -13.3, z: 12.2 },
    relief: { x: -13.3, z: -12.2 },
  },
  sanitation: { rack: { x: -14.4, z: 6.4 }, bin: { x: -13.5, z: 7.9 }, reach: 6.2 },
  ringMounts: [
    { x: -10.6, z: -15.4, angle: 0 },
    { x: -14.55, z: -0.2, angle: Math.PI / 2 },
    { x: -10.6, z: 15.4, angle: Math.PI },
  ],
  rescue: { bench: { x: -9.3, z: 0.9 }, approach: { x: -8.7, z: 0.9 } },
  evacSpots: ROOF_EVAC,
  fixtures: {
    fishNet: { x: -14.55, z: -6.2, angle: Math.PI / 2 },
    treats: { x: -12.6, z: 13.8 },
    flashlight: { x: -9.4, z: -15.0 },
    fuseBox: { x: -14.55, z: 11.0, angle: Math.PI / 2 },
    mop: { x: -11.2, z: -14.3 },
  },
  trampoline: null,
  furniture: [
    // The catch gutter past the infinity edge, and the glass rail: nobody walks there.
    { kind: "infinity-gutter", x: 4.15, z: 0, hx: 0.6, hz: RP.halfZ + 0.7 },
    ...ROOF_BEDS.filter((b) => !b.cabana).map((b) => ({
      kind: "sunbed",
      bed: b.id,
      x: b.x,
      z: b.z,
      hx: RP.bed.hx,
      hz: RP.bed.hz,
    })),
    ...[
      [RP.rowA, RP.pairsA],
      [RP.rowB, RP.pairsB],
    ].flatMap(([x, pairs]) =>
      pairs.flatMap((z) => [
        { kind: "parasol", x: x - RP.bed.hx - 0.22, z, hx: 0.22, hz: 0.22 },
        { kind: "side-table", x: x + 0.45, z, hx: 0.2, hz: 0.2 },
      ]),
    ),
    ...ROOF_BEDS.filter((b) => b.cabana).map((b) => ({
      kind: "cabana",
      bed: b.id,
      x: b.x,
      z: b.z,
      hx: RP.cabana.hx,
      hz: RP.cabana.hz,
    })),
    { kind: "lounge", ...RP.lounge },
    { kind: "bar", ...RP.bar },
    { kind: "bar-back", x: RP.bar.x, z: -15.0, hx: 2.2, hz: 0.25 },
    { kind: "dj-booth", ...RP.dj },
    { kind: "dj-riser", x: RP.dj.x, z: 14.75, hx: 1.7, hz: 0.5 },
    { kind: "speaker", x: 4.0, z: 13.2, hx: 0.35, hz: 0.35 },
    { kind: "speaker", x: -0.85, z: 13.4, hx: 0.35, hz: 0.35 },
    { kind: "station", x: -13.3, z: 12.2, hx: 0.6, hz: 0.9 },
    { kind: "station", x: -13.3, z: -12.2, hx: 0.6, hz: 0.9 },
    ...[
      [-13.9, -9.6],
      [-13.9, -3.2],
      [-13.9, 3.2],
      [-13.9, 9.6],
      [-2.6, -14.6],
      [-2.6, 14.6],
    ].map(([x, z]) => ({ kind: "palm", x, z, hx: 0.55, hz: 0.55 })),
  ],
});

// The cruise ship's pool deck (18 October 2026, cruise-plan.mjs): a pool across the deck, two lap lanes in its near half and free
// water past a rope in its far half, rows of sun loungers that slide when the ship rolls (ship.mjs), the Lido Bar on the far deck,
// and two stairway lobbies at the left end where the guests come up. The lane half is every venue's lane pool (two lanes), so the
// swimmers play as anywhere; the free half is the Rooftop Pool's chilling (rooftop.mjs, `chill`).
const CP = CRUISE_PLAN;
const CRUISE_EVAC = [-5.3, -6.0].flatMap((x) =>
  [-7.2, -5.8, -4.4, -3.0, -1.6, -0.2, 1.2, 2.6, 4.0, 5.4, 6.8].map((z) => ({ x, z })),
);
export const CRUISE = makeVenue({
  id: "cruise",
  name: "Cruise Ship",
  indoor: false,
  scenery: "ocean",
  sunAzimuth: 2.4,
  lighting: "cruise",
  cruise: true,
  chill: CRUISE_CHILL, // (half its guests chill in the free half or on a lounger: rooftop.mjs)
  doorWord: "a stairway",
  lanes: CP.lanes,
  deck: CP.deck,
  room: { minX: -15.8, maxX: 17.4, minZ: -16.4, maxZ: 16.4 },
  doors: { insideX: 10.1, doorX: 9.35, doorZ: -14.4, outsideX: 8.5 },
  lockers: [-11.6, 11.6], // (the stairway lobbies)
  queue: { outerX: 4.6, stepX: 1.1, startZ: -11.1, stepZ: 1.15 },
  coachStart: { x: -5.0, z: 0 },
  cameraScale: 1.26, // (wide: the whole deck and the sea past its rails, to see her roll)
  cameraFollow: { kx: 0.3, maxX: 4.4 },
  props: [
    "mop",
    "mop-bucket",
    "cruise-lounger",
    "steamer-chair",
    "lifeboat",
    "pool-bar",
    "towel-cart",
    "ship-bell",
    "lifejacket-box",
    "deck-umbrella",
    "margarita",
    "bar-stool",
    "palm-planter",
    "potted-plant",
  ],
  beds: LOUNGERS,
  stations: {
    bar: { x: CP.bar.x - CP.bar.hx - 0.6, z: CP.bar.z }, // the trays of margaritas, on the far walk
    fins: { x: -13.4, z: -9.4 },
    chlorine: { x: -13.4, z: 10.6 },
    relief: { x: -9.4, z: 11.9 },
  },
  sanitation: { rack: { x: -14.6, z: 0.6 }, bin: { x: -14.2, z: 2.6 }, reach: 6.2 },
  ringMounts: [
    { x: -4, z: -15.7, angle: 0 },
    { x: -15.0, z: -10.6, angle: Math.PI / 2 },
    { x: 6.5, z: 15.7, angle: Math.PI },
  ],
  rescue: { bench: { x: -9.6, z: -10.4 }, approach: { x: -8.3, z: -10.4 } },
  evacSpots: CRUISE_EVAC,
  fixtures: {
    fishNet: { x: 3.0, z: 15.7, angle: Math.PI },
    treats: { x: -5.6, z: 13.6 },
    flashlight: { x: -13.9, z: 13.4 },
    fuseBox: { x: 16.75, z: 6.2, angle: -Math.PI / 2 },
    medkit: { x: -15.0, z: 6.0 },
    mop: { x: 1.2, z: 12.6 },
  },
  trampoline: null,
  furniture: [
    // The free half of the pool, past the rope (water: nobody walks there; the coach may wade in, rooftop.mjs `chill`).
    {
      kind: "free-water",
      x: (CP.free.x0 + CP.free.x1 + 0.3) / 2,
      z: 0,
      hx: (CP.free.x1 + 0.3 - CP.free.x0) / 2,
      hz: CP.halfZ + 0.35,
    },
    // The rows of loungers (each lounger slides along its row: ship.mjs), the bar, the hot tub, the stairway lobbies.
    ...CP.rows.map((r, i) => ({
      kind: "lounger-row",
      row: i,
      x: r.x,
      z: (r.z0 + r.z1) / 2,
      hx: CP.lounger.hx + 0.05,
      hz: (r.z1 - r.z0) / 2 + 0.1,
    })),
    { kind: "pool-bar", ...CP.bar },
    ...CP.tubs.map((t) => ({ kind: "hot-tub", x: t.x, z: t.z, hx: t.r, hz: t.r, r: t.r })),
    { kind: "lobby", side: -1, x: -11.6, z: -14.35, hx: 2.0, hz: 1.05 },
    { kind: "lobby", side: 1, x: 11.6, z: -14.35, hx: 2.0, hz: 1.05 },
    { kind: "bench", x: -9.6, z: -11.0, angle: Math.PI / 2, hx: 0.49, hz: 1.2 },
    { kind: "rack", x: -13.4, z: -9.4, hx: 0.48, hz: 1.03 },
    { kind: "station", x: -13.4, z: 10.6, hx: 0.6, hz: 0.9 },
    { kind: "station", x: -9.4, z: 11.9, hx: 0.9, hz: 0.6 },
    { kind: "medkit-cabinet", x: -15.0, z: 6.0, hx: 0.3, hz: 0.7 },
    { kind: "treat-table", x: -5.6, z: 13.6, hx: 0.36, hz: 0.36 },
    { kind: "ship-bell", x: -2.2, z: 14.6, hx: 0.35, hz: 0.35 },
    { kind: "lifejacket-box", x: 7.6, z: 14.9, hx: 0.75, hz: 0.45 },
    { kind: "lifejacket-box", x: -6.0, z: -15.0, hx: 0.75, hz: 0.45 },
    { kind: "towel-cart", x: 15.6, z: -3.6, hx: 0.6, hz: 0.4 },
    { kind: "palm", x: 16.0, z: 6.4, hx: 0.55, hz: 0.55 },
    { kind: "palm", x: 16.0, z: -13.8, hx: 0.55, hz: 0.55 },
    { kind: "palm", x: -14.6, z: 14.4, hx: 0.55, hz: 0.55 },
  ],
});

// The Mountain Hot Springs (18 October 2026, onsen-plan.mjs, onsen.mjs): a snowy terrace in the mountains with four natural hot
// springs, the bathhouse at its left end (one door, crossed along z, like the Lazy River's gate), the guests waiting in the snow in
// front of it until the coach sends them to a spring, and the forest round the far side and the right end, where the snow monkeys
// live. The deck is icy for the coach (`ice`: he slides, coach.mjs), and he can wade into a spring (it is shallow).
export const ONSEN = makeVenue({
  id: "onsen",
  name: "Mountain Hot Springs",
  indoor: false,
  scenery: "snow",
  sunAzimuth: 2.2,
  lighting: "onsen",
  doorWord: "the bathhouse door",
  onsen: ONSEN_WATER,
  // The ice underfoot (the coach's only): how quickly he picks up speed and slows down without input (m/s²), and his top speed.
  ice: { grip: 11, glide: 4.6, top: 1.06 },
  blocks: false,
  // (The springs are the lanes: SPRING 1 to 4. Their x is each spring's middle, for the code that asks where a lane is.)
  lanes: SPRINGS.map((s) => s.x),
  deck: ONSEN_PLAN.deck,
  room: { minX: -15.4, maxX: 15.4, minZ: -16.6, maxZ: 13.6 },
  doors: { insideX: 0.62, doorX: 0.62, doorZ: -14.85, outsideX: 0.62, insideZ: -16.55 },
  lockers: [],
  queue: { blockX: [-1.5, 6.5], stepX: 1.2, startZ: -11.4, stepZ: 1.2, perRow: 5 },
  coachStart: { x: -9.6, z: -6.2 },
  cameraFollow: { kx: 0.22, maxX: 2.6 },
  props: [
    "mop",
    "mop-bucket",
    "swim-ring",
    "stone-lantern",
    "onsen-bucket",
    "snowy-cedar",
    "bamboo-spout",
    "onsen-bench",
    "bathhouse",
    "yu-sign",
    "towel-cart",
  ],
  stations: {
    fins: { x: 12.2, z: -13.6 }, // (nobody needs fins here: a rack of towels)
    chlorine: { x: -13.4, z: 3.2 }, // the water care: the springs' minerals
    relief: { x: -13.4, z: 9.6 },
  },
  sanitation: { rack: { x: -13.6, z: -9.6 }, bin: { x: -12.4, z: -12.2 }, reach: 6.2 },
  ringMounts: [
    { x: -14.85, z: -1.4, angle: Math.PI / 2 },
    { x: -14.85, z: 6.4, angle: Math.PI / 2 },
    { x: 2.0, z: 12.9, angle: Math.PI },
  ],
  rescue: { bench: { x: -10.8, z: -9.0 }, approach: { x: -9.6, z: -9.0 } },
  // Where everyone out of the springs waits while they are closed (a floater, a fish): on the paths in front of the bathhouse.
  evacSpots: [-9.6, -8.4, -7.2].flatMap((z) => [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0].map((x) => ({ x, z }))),
  fixtures: {
    fishNet: { x: -14.85, z: -4.6, angle: Math.PI / 2 },
    treats: { x: -11.6, z: 11.8 },
    flashlight: { x: -8.4, z: 12.6 },
    fuseBox: { x: 9.6, z: -14.85, angle: 0 },
    mop: { x: -9.0, z: -12.6 },
  },
  trampoline: null,
  furniture: [
    { kind: "bench", x: -10.8, z: -9.65, angle: Math.PI / 2, hx: 0.49, hz: 1.2 },
    { kind: "towel-rack", x: 12.2, z: -13.6, hx: 0.6, hz: 1.0 },
    { kind: "station", x: -13.4, z: 3.2, hx: 0.6, hz: 0.9 },
    { kind: "station", x: -13.4, z: 9.6, hx: 0.6, hz: 0.9 },
    { kind: "lantern", x: -7.8, z: -13.9, hx: 0.35, hz: 0.35 },
    { kind: "lantern", x: 8.2, z: -13.9, hx: 0.35, hz: 0.35 },
    { kind: "lantern", x: 0.2, z: 6.2, hx: 0.35, hz: 0.35 },
    { kind: "lantern", x: 10.6, z: 2.9, hx: 0.35, hz: 0.35 },
    { kind: "bamboo-spout", x: 9.5, z: -4.9, hx: 0.4, hz: 0.4 },
  ],
});

// The Jumping Pool (24 October 2026, dive-plan.mjs, dive.mjs): an open-air country club. One big deep pool with no lanes, a diving
// station at each end (LOW springboard, MID and HIGH platforms, each with its own stairs and line), two garden gates at the near
// corners (crossed along z, like the rooftop's lifts), the guests waiting on the lawn by their gate, the hot tub and the open massage
// corner (two beds) on the far deck. The "lanes" are where the coach sends a guest: LOW, MID, HIGH (1 to 3) and the hot tub (4).
const DIVE_STATION_BOXES = DIVE_STATIONS.map((s) => ({
  kind: "dive-station",
  side: s.side,
  x: (s.x0 + s.x1) / 2,
  z: (s.z0 + s.z1) / 2,
  hx: (s.x1 - s.x0) / 2,
  hz: (s.z1 - s.z0) / 2,
  block: false, // (dive-plan.mjs routes round the stations itself)
}));
export const DIVE = makeVenue({
  id: "dive",
  name: "The Jumping Pool",
  indoor: false,
  scenery: "garden",
  sunAzimuth: 2.35,
  lighting: "dive",
  doorWord: "a garden gate",
  dive: DIVE_WATER,
  // The roaming incidents it leaves out (week.mjs, chaos.mjs): Carl and the leopard man come to dive here, as guests (dive.mjs; the
  // creator: "not incidents!!!"), and nothing gets into its deep diving pool but divers (no fish kid, no dog).
  skips: ["carl", "fish", "dog"],
  basin: { halfX: DIVE_PLAN.halfX, halfZ: DIVE_PLAN.halfZ },
  wetChance: 0.3, // (everyone climbs out of a deep pool dripping)
  blocks: false,
  lanes: [...HEIGHTS.map((h) => h.x), TUB.x],
  deck: DIVE_PLAN.deck,
  room: DIVE_PLAN.room,
  doors: {
    alongZ: true,
    doorX: DIVE_PLAN.gateX,
    insideX: DIVE_PLAN.gateX,
    outsideX: DIVE_PLAN.gateX,
    insideZ: 16.4,
    doorZ: 15.0,
    outsideZ: 14.2,
  },
  lockers: [],
  queue: { alongZ: true, startX: -9.3, stepX: 1.05, startZ: 12.0, stepZ: 1.1, perRow: 3 },
  // (The near side, the camera's, is a narrow walk with the hot tub and the massage beds: the coach starts between them.)
  coachStart: { x: -6.9, z: -0.2 },
  cameraScale: 1.5,
  // (stood back and leaning toward the far side, so both HIGH boards and a diver on them clear the score panel at the top
  // while the narrow near side, the tub and the beds, stays above the buttons at the bottom)
  cameraFollow: { kx: 0.24, maxX: 3.2, biasX: 3.3 },
  props: [
    "mop",
    "mop-bucket",
    "swim-ring",
    "sunbed",
    "parasol",
    "potted-plant",
    "palm-planter",
    "towel-cart",
    "side-table",
  ],
  stations: {
    fins: { x: 12.9, z: -3.0 }, // (nobody needs fins here: a rack of towels)
    chlorine: { x: -9.1, z: -6.3 }, // the hot tub's water care, on the near side past the tub's far end
    relief: { x: 12.9, z: 6.6 },
  },
  // The skimmer on the near hedge between the hot tub and the massage beds, the waste bin between the two beds.
  sanitation: { rack: { x: -9.3, z: -0.2 }, bin: { x: -8.8, z: 3.25 }, reach: 6.2 },
  ringMounts: [
    { x: -10.05, z: -7.8, angle: Math.PI / 2 },
    { x: -10.05, z: 7.3, angle: Math.PI / 2 },
    { x: 13.75, z: 4.0, angle: -Math.PI / 2 },
  ],
  rescue: { bench: { x: 12.7, z: 0.4 }, approach: { x: 11.4, z: 0.4 } },
  // Where the hot tub's guests wait while it is closed (a floater, a wee): on the walk in front of it.
  evacSpots: [-4.4, -3.6, -2.8, -2.0, -1.2, -0.4].map((z) => ({ x: -6.75, z })),
  fixtures: {
    fishNet: { x: 13.75, z: -8.6, angle: -Math.PI / 2 },
    treats: { x: 12.6, z: -7.2 },
    flashlight: { x: 12.4, z: 9.8 },
    fuseBox: { x: 13.75, z: 12.4, angle: -Math.PI / 2 },
    mop: { x: 7.4, z: 11.2 },
    massage: MASSAGE_BEDS[0],
    massageMore: MASSAGE_BEDS.slice(1),
  },
  trampoline: null,
  furniture: [
    ...DIVE_STATION_BOXES,
    { kind: "bench", x: 12.7, z: 0.4, angle: -Math.PI / 2, hx: 0.49, hz: 1.2 },
    { kind: "towel-rack", x: 12.9, z: -3.0, hx: 0.5, hz: 1.0 },
    { kind: "station", x: -9.1, z: -6.3, hx: 0.6, hz: 0.9 },
    { kind: "station", x: 12.9, z: 6.6, hx: 0.6, hz: 0.9 },
    { kind: "lifeguard", x: 8.4, z: -5.2, hx: 0.6, hz: 0.6 },
    { kind: "planter", x: 8.2, z: 5.6, hx: 0.5, hz: 0.5 },
    { kind: "planter", x: 7.0, z: -13.6, hx: 0.5, hz: 0.5 },
    { kind: "planter", x: 12.8, z: 13.4, hx: 0.5, hz: 0.5 },
  ],
});

export const VENUES = {
  club: CLUB,
  resort: RESORT,
  lagoon: LAGOON,
  arena: ARENA,
  aquatic: AQUATIC,
  disco: DISCO,
  kids: KIDS,
  senior: SENIOR,
  river: RIVER,
  wave: WAVE,
  roof: ROOFTOP,
  cruise: CRUISE,
  onsen: ONSEN,
  dive: DIVE,
};

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
