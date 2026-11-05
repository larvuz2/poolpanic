// Loose things on the deck that the coach (and the guests) knock about (5 November 2026, the creator: "if I walk and hit them, they
// should move… and react to the hit. Also like the furniture… a pot, if I run, it falls off. That doesn't affect the point system…
// all of the venues have physics and it's more alive").
//
// On screen only: nothing here is the simulation's, so the score, the replays and co-op's hashes never see it. Every venue gets a
// handful of props of its own kind (beach balls, kickboards, cones, potted plants, buckets, ducks, chairs, noodles, bottles), set
// down on free deck by the walls (`homeSpots`), and a builder can hand in its own (the Cruise Ship's steamer chairs and balls, which
// also slide with the roll: `tilt`). Three ways to move:
//   - roll   (balls): kicked away, they roll, hop and bounce off walls, furniture and each other, and may end up in the pool;
//   - slide  (kickboards, chairs, noodles, ducks): shoved, they skid and turn, and soon stop;
//   - tip    (pots, cones, buckets, bottles): a bump rocks them; hit at a run (or a dash) they fall over, and lie there to be
//            shoved about until the next shift.
// The pushers are the coaches (a jump clears things) and every guest on foot; their speed is read from where they were last frame.

import * as THREE from "../assets/three.module.js";

const TIP_SPEED = 4.2; // m/s of closing speed that knocks a standing prop over (the coach moves at 7.6, a guest at about 2)
const COACH_R = 0.34;
const GUEST_R = 0.28;
const KINDS = {
  // r: footprint radius; m: how much of a hit it takes (light things fly); drag: per second; bounce: off walls; stick: the slope it
  // stays put on (the cruise's roll)
  ball: { move: "roll", r: 0.24, m: 0.62, drag: 0.75, bounce: 0.62, stick: 0.12 },
  duck: { move: "slide", r: 0.13, m: 0.7, drag: 1.8, bounce: 0.4, stick: 0.3 },
  kick: { move: "slide", r: 0.24, m: 0.55, drag: 3.2, bounce: 0.3, stick: 0.7 },
  noodle: { move: "slide", r: 0.3, m: 0.6, drag: 2.6, bounce: 0.35, stick: 0.5 },
  chair: { move: "slide", r: 0.3, m: 0.32, drag: 5.0, bounce: 0.2, stick: 0.78 },
  steamer: { move: "slide", r: 0.45, m: 0.22, drag: 5.0, bounce: 0.15, stick: 0.78 },
  pot: { move: "tip", r: 0.2, m: 0.3, drag: 6.0, bounce: 0.15, stick: 1.0, h: 0.75 },
  cone: { move: "tip", r: 0.17, m: 0.45, drag: 4.5, bounce: 0.25, stick: 0.8, h: 0.5 },
  bucket: { move: "tip", r: 0.15, m: 0.5, drag: 3.5, bounce: 0.3, stick: 0.6, h: 0.28 },
  bottle: { move: "tip", r: 0.06, m: 0.65, drag: 3.0, bounce: 0.3, stick: 0.5, h: 0.3 },
};

// What each venue has lying about (the cruise adds its own steamer chairs and balls, scene/cruise.mjs).
export const VENUE_KITS = {
  club: ["ball", "ball", "kick", "kick", "kick", "cone", "pot", "pot", "duck", "bucket", "noodle"],
  resort: ["ball", "ball", "ball", "pot", "pot", "pot", "chair", "chair", "duck", "noodle"],
  lagoon: ["ball", "ball", "pot", "pot", "chair", "chair", "bucket", "noodle"],
  aquatic: ["kick", "kick", "kick", "kick", "cone", "cone", "bottle", "bottle", "bottle", "noodle"],
  disco: ["ball", "bottle", "bottle", "bottle", "chair", "chair", "cone", "pot"],
  kids: [
    "ball",
    "ball",
    "ball",
    "ball",
    "duck",
    "duck",
    "duck",
    "duck",
    "bucket",
    "bucket",
    "bucket",
    "noodle",
    "noodle",
  ],
  senior: ["pot", "pot", "pot", "kick", "kick", "chair", "chair", "bottle", "bottle"],
  river: ["pot", "pot", "bucket", "bucket", "ball", "ball", "duck"],
  wave: ["ball", "ball", "ball", "ball", "bucket", "bucket", "bucket", "cone"],
  roof: ["pot", "pot", "pot", "bottle", "bottle", "bottle", "chair"],
  cruise: ["pot", "pot", "duck", "bottle", "bottle", "noodle"],
  onsen: ["bucket", "bucket", "bucket", "bucket", "pot", "pot"],
  dive: ["ball", "ball", "kick", "kick", "cone", "pot", "pot", "noodle"],
  arena: ["bottle", "bottle", "bottle", "bottle", "pot", "pot", "cone", "chair"],
};
// The pools a ball may roll into and float in (a plain rectangle of water in the middle); elsewhere the water's edge is a wall.
const SPLASH_POOLS = new Set(["club", "resort", "lagoon", "aquatic", "disco", "kids", "senior", "arena"]);

// A small seeded random, so a venue's props stand in the same places every time.
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// ---- the props' looks (low poly, each its own little group; materials shared within one venue's build) ----------------------

function makeKit(venueId) {
  const mats = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra }));
    return mats.get(key);
  };
  const mesh = (geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  };
  const builders = {
    ball(i) {
      // six gores, red, white, blue, white, yellow, white (vertex colours on one sphere)
      const geo = new THREE.SphereGeometry(0.24, 18, 12),
        pos = geo.attributes.position,
        colors = [],
        palette = [
          [0xd8312f, 0x1f8fd8, 0xffc93f],
          [0xff6fae, 0x31c48d, 0xffa53f],
          [0x7a5cff, 0xffd23f, 0x2fb8c9],
        ][i % 3],
        c = new THREE.Color();
      for (let k = 0; k < pos.count; k++) {
        const gore = Math.floor(((Math.atan2(pos.getZ(k), pos.getX(k)) + Math.PI) / (Math.PI * 2)) * 6) % 6;
        c.set(gore % 2 ? 0xffffff : palette[gore / 2]);
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const g = new THREE.Group();
      g.add(mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.35 }), 0, 0.24, 0));
      return g;
    },
    duck() {
      const g = new THREE.Group(),
        yellow = mat(0xffd21f, { roughness: 0.3 });
      g.add(mesh(new THREE.SphereGeometry(0.12, 12, 8).scale(1.25, 0.85, 1), yellow, 0, 0.1, 0));
      g.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), yellow, 0.08, 0.22, 0));
      const beak = mesh(new THREE.ConeGeometry(0.03, 0.07, 8), mat(0xff7a1a), 0.17, 0.21, 0);
      beak.rotation.z = -Math.PI / 2;
      g.add(beak);
      return g;
    },
    kick(i) {
      const g = new THREE.Group();
      g.add(
        mesh(
          new THREE.BoxGeometry(0.46, 0.045, 0.3),
          mat([0x2f8fe0, 0xffcf3a, 0xff5a4f, 0x35c48d][i % 4], { roughness: 0.7 }),
          0,
          0.025,
          0,
        ),
      );
      return g;
    },
    noodle(i) {
      const g = new THREE.Group(),
        n = mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10),
          mat([0xff5fa8, 0x8be04a, 0xffa531][i % 3], { roughness: 0.6 }),
          0,
          0.05,
          0,
        );
      n.rotation.z = Math.PI / 2;
      g.add(n);
      return g;
    },
    chair(i) {
      const g = new THREE.Group(),
        m = mat([0xf3f1ea, 0x2bb3a6, 0xff8a5c][i % 3], { roughness: 0.45 }),
        leg = new THREE.BoxGeometry(0.035, 0.42, 0.035);
      g.add(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), m, 0, 0.42, 0));
      g.add(mesh(new THREE.BoxGeometry(0.42, 0.38, 0.035), m, 0, 0.63, -0.19));
      for (const [x, z] of [
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ])
        g.add(mesh(leg, m, x, 0.21, z));
      return g;
    },
    pot(i) {
      const g = new THREE.Group();
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.2, 0.14, 0.34, 12),
          mat(venueId === "onsen" ? 0x5b4636 : [0xc0643c, 0xb5583a, 0xd1844f][i % 3], { roughness: 0.8 }),
          0,
          0.17,
          0,
        ),
      );
      g.add(
        mesh(
          new THREE.IcosahedronGeometry(0.28, 1).scale(1, 1.15, 1),
          mat(venueId === "onsen" ? 0x3f6a4a : [0x3f9a4a, 0x2f7f5a, 0x5aa83a][i % 3], {
            roughness: 0.85,
            flatShading: true,
          }),
          0,
          0.56,
          0,
        ),
      );
      return g;
    },
    cone() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.03, 0.34), mat(0xff6a1a), 0, 0.015, 0));
      g.add(mesh(new THREE.ConeGeometry(0.15, 0.48, 14), mat(0xff6a1a, { roughness: 0.5 }), 0, 0.27, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.07, 14), mat(0xffffff), 0, 0.27, 0));
      return g;
    },
    bucket(i) {
      const wooden = venueId === "onsen",
        g = new THREE.Group(),
        m = mat(wooden ? 0xc99a62 : [0xe8452f, 0x2f86e0, 0xffc22f][i % 3], {
          roughness: wooden ? 0.8 : 0.45,
        });
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.26, 14, 1, true), m, 0, 0.13, 0));
      g.children[0].material = m.clone();
      g.children[0].material.side = THREE.DoubleSide;
      g.add(mesh(new THREE.CircleGeometry(0.12, 14).rotateX(-Math.PI / 2), m, 0, 0.01, 0));
      const handle = mesh(
        new THREE.TorusGeometry(0.14, 0.008, 4, 16, Math.PI),
        mat(wooden ? 0x6a4a2a : 0x333333),
        0,
        0.26,
        0,
      );
      g.add(handle);
      return g;
    },
    bottle(i) {
      const g = new THREE.Group(),
        glass =
          venueId === "arena" || venueId === "roof" || venueId === "disco"
            ? mat([0x1f5a2f, 0x2a6a3a][i % 2], { roughness: 0.15, metalness: 0.1 })
            : mat(0x6ec6ff, { roughness: 0.15, transparent: true, opacity: 0.8 });
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.2, 10), glass, 0, 0.1, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.04, 0.09, 10), glass, 0, 0.245, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 8), mat(0xe8c24a), 0, 0.3, 0));
      return g;
    },
  };
  return (kind, i) => builders[kind](i);
}

// ---- where they stand: free deck by the walls, clear of every station, door, line and walk ----------------------------------

export function homeSpots(venue, count, level = 3) {
  const rand = seeded("loose:" + venue.id),
    d = venue.deck,
    clear = [
      ...Object.values(venue.stations || {}),
      ...Object.values(venue.fixtures || {}),
      ...(venue.ringMounts || []),
      venue.rescue?.bench,
      venue.rescue?.approach,
      venue.coachStart,
      venue.doors && { x: venue.doors.doorX ?? venue.doors.insideX, z: venue.doors.doorZ },
      venue.doors && { x: -(venue.doors.doorX ?? venue.doors.insideX), z: venue.doors.doorZ },
      ...[-1, 1].flatMap((side) =>
        Array.from({ length: 8 }, (_, slot) => {
          try {
            return venue.queuePosition(side, slot);
          } catch {
            return null;
          }
        }),
      ),
      ...(venue.lanes || []).map((x) => ({ x, z: venue.entry?.edgeZ ?? -9.6 })),
    ].filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  const candidates = [];
  for (let x = d.minX + 0.6; x <= d.maxX - 0.6; x += 0.45)
    for (let z = d.minZ + 0.6; z <= d.maxZ - 0.6; z += 0.45) {
      if (!venue.isDeck(x, z, level, 0.45)) continue;
      if (clear.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2)) continue;
      // by a wall: how many of eight directions are blocked a metre away (a corner or a wall's foot, never the open floor)
      let blocked = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (!venue.isDeck(x + Math.cos(a) * 1.0, z + Math.sin(a) * 1.0, level, 0.2)) blocked++;
      }
      if (blocked < 2 || blocked > 5) continue;
      candidates.push({ x, z, blocked, score: blocked + rand() * 1.5 });
    }
  candidates.sort((a, b) => b.score - a.score);
  const spots = [];
  for (const c of candidates) {
    if (spots.length >= count) break;
    if (spots.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < 2.4)) continue;
    spots.push({ x: c.x, z: c.z, blocked: c.blocked, yaw: rand() * Math.PI * 2 });
  }
  return spots;
}

// ---- the system ---------------------------------------------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

export class LooseProps {
  constructor(world, venue) {
    this.world = world;
    this.venue = venue;
    this.group = new THREE.Group();
    this.group.name = "LooseProps";
    this.items = [];
    this.tilt = { x: 0, z: 0 }; // a slope's pull, m/s² (the Cruise Ship's roll, scene/cruise.mjs)
    this.prev = new Map(); // the pushers' last places
    this.level = 3;
  }
  // A builder's own loose thing (already in its scene): it joins the physics from where it stands.
  adopt(object, kind, extra = {}) {
    const k = KINDS[kind];
    const item = {
      object,
      kind,
      ...k,
      ...extra,
      home: {
        x: object.position.x,
        z: object.position.z,
        y: object.position.y,
        q: object.quaternion.clone(),
      },
    };
    this.reset1(item);
    this.items.push(item);
    return item;
  }
  // The venue's own kit, set down on free deck by the walls.
  populate() {
    // (what rolls or slides gets the open spots along a wall, what stands and tips the corners)
    const order = { roll: 0, slide: 1, tip: 2 },
      kit = [...(VENUE_KITS[this.venue.id] || VENUE_KITS.club)].sort(
        (a, b) => order[KINDS[a].move] - order[KINDS[b].move],
      ),
      spots = homeSpots(this.venue, kit.length).sort((a, b) => a.blocked - b.blocked),
      make = makeKit(this.venue.id),
      counts = {};
    spots.forEach((s, i) => {
      const kind = kit[i];
      counts[kind] = (counts[kind] || 0) + 1;
      const object = make(kind, counts[kind] - 1);
      object.name = "Loose_" + kind;
      object.position.set(s.x, 0, s.z);
      object.quaternion.setFromAxisAngle(UP, s.yaw);
      this.group.add(object);
      this.adopt(object, kind);
    });
    this.world.scene.add(this.group);
  }
  reset1(item) {
    Object.assign(item, {
      x: item.home.x,
      z: item.home.z,
      y: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      spin: 0,
      tipped: 0, // 0 standing, rising to 1 lying on its side
      tipping: 0,
      tipAxis: new THREE.Vector3(1, 0, 0),
      wobble: 0,
      wobbleAxis: new THREE.Vector3(1, 0, 0),
      water: false,
      posed: false,
      roll: new THREE.Quaternion(),
      yaw: new THREE.Quaternion().copy(item.home.q),
    });
    item.object.position.set(item.home.x, item.home.y, item.home.z);
    item.object.quaternion.copy(item.home.q);
  }
  // A new shift: everything back where it stood.
  reset() {
    for (const item of this.items) this.reset1(item);
    this.prev.clear();
  }
  // Free deck for a thing of this size (walls, furniture, the pool's edge, a river or a spring all say no).
  free(x, z, r) {
    return this.venue.isDeck(x, z, this.level, r);
  }
  inPool(x, z) {
    const P = this.venue.pool;
    return (
      SPLASH_POOLS.has(this.venue.id) &&
      P &&
      Math.abs(x) < P.halfX - 0.2 &&
      Math.abs(z) < (P.halfZ ?? 0) - 0.2
    );
  }
  // The coaches and every guest on foot, with how fast they move (from last frame's place).
  pushers(sim, dt) {
    const list = [],
      seen = new Set();
    const add = (key, x, z, r, airborne) => {
      const was = this.prev.get(key);
      let vx = 0,
        vz = 0;
      if (was && dt > 0) {
        vx = (x - was.x) / dt;
        vz = (z - was.z) / dt;
        if (Math.hypot(vx, vz) > 30) vx = vz = 0; // a jump in place (a teleport, a new shift)
      }
      this.prev.set(key, { x, z });
      seen.add(key);
      if (!airborne) list.push({ x, z, r, vx, vz });
    };
    (sim.coaches || [sim.coach]).forEach((c, i) => {
      if (!c || c.swimming || c.waterTransition) return;
      add("c" + i, c.x, c.z, COACH_R, (c.y || 0) > 0.35);
    });
    for (const p of sim.people || []) {
      if (["gone", "swim", "trampoline", "lounge"].includes(p.status) || p.away || p.chill) continue;
      add("p" + p.id, p.x, p.z, GUEST_R, (p.y || 0) > 0.35);
    }
    for (const key of this.prev.keys()) if (!seen.has(key)) this.prev.delete(key);
    return list;
  }
  update(sim, dt) {
    if (!this.items.length || !sim || !(dt > 0)) return;
    dt = Math.min(dt, 1 / 20);
    this.level = sim.level || 3;
    const pushers = this.pushers(sim, dt);
    for (const it of this.items) this.hits(it, pushers);
    // the props bump each other
    for (let i = 0; i < this.items.length; i++)
      for (let j = i + 1; j < this.items.length; j++) this.bump(this.items[i], this.items[j]);
    for (const it of this.items) this.step(it, dt);
  }
  hits(it, pushers) {
    for (const p of pushers) {
      const dx = it.x - p.x,
        dz = it.z - p.z,
        dist = Math.hypot(dx, dz),
        reach = it.r + p.r;
      if (dist >= reach || dist < 1e-4) continue;
      const nx = dx / dist,
        nz = dz / dist,
        closing = (p.vx - it.vx) * nx + (p.vz - it.vz) * nz;
      // out of the way first
      const push = reach - dist;
      if (this.free(it.x + nx * push, it.z + nz * push, it.r * 0.6)) {
        it.x += nx * push;
        it.z += nz * push;
      }
      if (closing <= 0) continue;
      if (it.move === "tip" && it.tipped < 0.02 && it.tipping === 0) {
        if (closing >= TIP_SPEED) {
          it.tipping = 1; // over it goes, away from the hit
          it.tipAxis.set(nz, 0, -nx).normalize();
          it.vx += nx * closing * it.m * 0.6;
          it.vz += nz * closing * it.m * 0.6;
        } else {
          it.wobble = Math.min(0.35, it.wobble + closing * 0.08);
          it.wobbleAxis.set(nz, 0, -nx).normalize();
          it.vx += nx * closing * it.m * 0.25;
          it.vz += nz * closing * it.m * 0.25;
        }
        continue;
      }
      // (a ball flies off faster than the foot that kicked it; a board or a chair takes some of the push)
      const kick = it.move === "roll" ? 1 + it.bounce : it.m * 1.5;
      it.vx += nx * closing * kick;
      it.vz += nz * closing * kick;
      // a glancing hit turns a board or a chair; a ball hit hard hops
      it.spin += ((p.vx * nz - p.vz * nx) / Math.max(0.2, it.r)) * 0.15 * it.m;
      if (it.move === "roll" && closing > 3 && !it.water) it.vy = Math.max(it.vy, closing * 0.22);
    }
  }
  bump(a, b) {
    if (a.water !== b.water) return;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      dist = Math.hypot(dx, dz),
      reach = a.r + b.r;
    if (dist >= reach || dist < 1e-4) return;
    const nx = dx / dist,
      nz = dz / dist,
      over = (reach - dist) / 2;
    a.x -= nx * over;
    a.z -= nz * over;
    b.x += nx * over;
    b.z += nz * over;
    const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (closing <= 0) return;
    const wa = 1 / (1 - a.m * 0.5 + 0.2),
      wb = 1 / (1 - b.m * 0.5 + 0.2),
      share = closing / (wa + wb);
    a.vx -= nx * share * wb;
    a.vz -= nz * share * wb;
    b.vx += nx * share * wa;
    b.vz += nz * share * wa;
    // a hard knock topples a standing prop too
    for (const t of [a, b])
      if (t.move === "tip" && t.tipping === 0 && t.tipped < 0.02 && closing > TIP_SPEED * 0.9) {
        t.tipping = 1;
        t.tipAxis.set(nz, 0, -nx).normalize();
      }
  }
  step(it, dt) {
    // (at rest, on level ground: nothing to do, and nothing to draw anew)
    if (
      !it.vx &&
      !it.vz &&
      !it.vy &&
      !it.y &&
      !it.spin &&
      !it.tipping &&
      it.wobble < 0.005 &&
      !it.water &&
      !this.tilt.x &&
      !this.tilt.z &&
      it.posed
    )
      return;
    it.posed = true;
    // a slope's pull (the ship's roll), unless it is not enough to unstick a thing at rest
    const pull =
      Math.hypot(this.tilt.x, this.tilt.z) * (it.move === "roll" ? 0.7 : it.tipped > 0.5 ? 0.35 : 0.55);
    if (pull > 0 && !it.water) {
      const moving = Math.hypot(it.vx, it.vz) > 0.05;
      if (moving || pull > it.stick * 9.8 * 0.1) {
        const k = (it.move === "roll" ? 0.7 : 0.55) * dt;
        it.vx += this.tilt.x * k;
        it.vz += this.tilt.z * k;
      }
    }
    const drag = it.water ? 1.2 : it.move === "tip" && it.tipped > 0.5 ? it.drag * 0.7 : it.drag;
    const f = Math.exp(-drag * dt);
    it.vx *= f;
    it.vz *= f;
    it.spin *= Math.exp(-3 * dt);
    if (Math.abs(it.spin) < 0.01) it.spin = 0;
    const speed = Math.hypot(it.vx, it.vz);
    if (speed < 0.01 && !it.vy) {
      it.vx = it.vz = 0;
    }
    // move, sliding along what it meets; the pool takes a ball (it floats), else its edge is a wall
    let nx = it.x + it.vx * dt,
      nz = it.z + it.vz * dt;
    if (it.water) {
      const P = this.venue.pool,
        hx = P.halfX - it.r - 0.15,
        hz = (P.halfZ ?? 0) - it.r - 0.15;
      if (Math.abs(nx) > hx) ((nx = Math.sign(nx) * hx), (it.vx *= -0.5));
      if (Math.abs(nz) > hz) ((nz = Math.sign(nz) * hz), (it.vz *= -0.5));
    } else if (!this.free(nx, nz, it.r * 0.6)) {
      if (it.move === "roll" && this.inPool(nx, nz)) {
        it.water = true; // splash
        it.vx *= 0.4;
        it.vz *= 0.4;
      } else {
        const okX = this.free(nx, it.z, it.r * 0.6),
          okZ = this.free(it.x, nz, it.r * 0.6);
        if (okX && !okZ) {
          nz = it.z;
          it.vz *= -it.bounce;
        } else if (okZ && !okX) {
          nx = it.x;
          it.vx *= -it.bounce;
        } else {
          nx = it.x;
          nz = it.z;
          it.vx *= -it.bounce;
          it.vz *= -it.bounce;
        }
      }
    }
    const mx = nx - it.x,
      mz = nz - it.z;
    it.x = nx;
    it.z = nz;
    // up and down: a hop falls back; afloat, it bobs on the water
    if (it.water) {
      const surface = (this.world.floatY ?? -0.15) - 0.12;
      it.y += (surface + Math.sin(this.world.clock * 2.4 + it.home.x) * 0.03 - it.y) * Math.min(1, dt * 4);
      it.vy = 0;
    } else if (it.vy || it.y > 0) {
      it.vy -= 18 * dt;
      it.y += it.vy * dt;
      if (it.y <= 0) {
        it.y = 0;
        it.vy = Math.abs(it.vy) > 1.2 ? -it.vy * 0.4 : 0;
      }
    }
    // tipping over: quick, as a thing falls, with a small bounce at the end
    if (it.tipping) {
      it.tipped = Math.min(1, it.tipped + dt * (2 + it.tipped * 9));
      if (it.tipped >= 1) it.tipping = 0;
    }
    it.wobble *= Math.exp(-4 * dt);
    // the pose: its own turn, the roll of a ball, the tip or the wobble
    if (it.spin) it.yaw.premultiply(tmpQ.setFromAxisAngle(UP, it.spin * dt));
    if (it.move === "roll" && (mx || mz)) {
      const d = Math.hypot(mx, mz);
      tmpV.set(mz / d, 0, -mx / d);
      it.roll.premultiply(tmpQ.setFromAxisAngle(tmpV, d / it.r));
    }
    const o = it.object;
    o.quaternion.copy(it.yaw);
    if (it.move === "roll") o.quaternion.premultiply(it.roll);
    let lift = 0;
    if (it.move === "tip") {
      const angle = (it.tipped * it.tipped * (3 - 2 * it.tipped) * Math.PI) / 2,
        wobble = Math.sin(this.world.clock * 17) * it.wobble;
      if (angle > 0) o.quaternion.premultiply(tmpQ.setFromAxisAngle(it.tipAxis, angle));
      else if (it.wobble > 0.01) o.quaternion.premultiply(tmpQ.setFromAxisAngle(it.wobbleAxis, wobble));
      lift = Math.sin(angle) * it.r * 0.9;
    }
    // (a ball's group holds the sphere at its own height: turn it about its middle, not its foot)
    if (it.move === "roll" && it.kind === "ball" && !it.ownPivot) {
      const c = it.r;
      tmpV.set(0, c, 0).applyQuaternion(o.quaternion);
      o.position.set(it.x - tmpV.x, it.y + c - tmpV.y + it.home.y, it.z - tmpV.z);
    } else o.position.set(it.x, it.y + lift + it.home.y, it.z);
  }
}
