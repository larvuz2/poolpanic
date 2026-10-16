// The Lazy River (17 October 2026): a jungle water park. A river of clear green water curves through the room in an S (river.mjs
// says where), out of a rock cave behind a waterfall in the far left corner and into a ruined jungle temple in the far right one,
// and only that stretch is ever seen: the rest of the loop is behind the walls. Its banks are mossy rock, its bed sand and
// pebbles under moving caustics, and the water itself flows (the ripples, streaks and foam ride the current, and stand still
// when the pumps stop). Across it: a rope bridge, two stepping stones the coach can jump to, and the two wooden docks where the
// guests get on and off their tubes, with the tube return beside the exit. Around it: the deck of mossy sandstone, the tube
// rack, a thatched snack hut, tiki totems and torches, boulders and palms, a bamboo palisade with the jungle gate, and beyond it
// the jungle: palms, banana plants, big-leaved bushes, bamboo, flowers, and parrots circling over it all.
//
// Nothing here moves the simulation: the water's flow, the waterfall, the flames, the fronds and the parrots only move in the
// picture. The guests on their tubes are drawn by scene/river-view.mjs.
import { THREE, COLORS } from "./kit.mjs";
import { withCaustics } from "./pool.mjs";
import {
  grassTexture,
  paverTextures,
  sandTexture,
  thatchTexture,
  flameTexture,
  woodTexture,
} from "./textures.mjs";
import { mergeGeos, paint, placed, rngOf, wind } from "./geom.mjs";
import { swayPalm } from "./lagoon.mjs";
import {
  bench,
  station,
  stationHit,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  woodMaterial,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { tubeObject, TUBE_COLORS } from "./river-view.mjs";

const TAU = Math.PI * 2;
const BED = -1.15; // the river bed, under the water's surface at -0.25
const WATER = -0.25;
const MOSS = 0x5f8a3a,
  STONE = 0xb79a6c,
  ROCK = 0x8a8170,
  BAMBOO = 0xd8b568,
  JOINT = 0x9c7a3c,
  LEAF = [0x2f7a3a, 0x3d8f45, 0x4f9f4a, 0x2a6b3c, 0x5aa850];

export function buildRiver(w, venue) {
  const r = venue.river;
  const live = new THREE.Group();
  live.name = "river-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, r, live, rand: rngOf(171), fronds: [], leaves: [], flames: [] };
  w.poolUniforms = { uTime: { value: 0 }, uCaustic: { value: 1 } };
  ground(ctx);
  deck(ctx);
  channel(ctx);
  water(ctx);
  bankRocks(ctx);
  cave(ctx);
  temple(ctx);
  bridge(ctx);
  steppingStones(ctx);
  docks(ctx);
  tubeRack(ctx);
  palisade(ctx);
  gate(ctx);
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "station") continue; // (the stations below)
    if (f.kind === "tiki") tiki(ctx, f.x, f.z);
    // (A palm on the near side, between the camera and the deck, would hide it: a banana plant there.)
    if (f.kind === "palm" && f.x < -8) banana(ctx, f.x, f.z, 1.15);
    else if (f.kind === "palm") swayPalm(ctx, f.x, f.z, 4.8, f.x * 1.3 + f.z);
    if (f.kind === "boulder") boulder(ctx, f.x, f.z, Math.max(f.hx, f.hz) * 1.15, f.x + f.z);
    if (f.kind === "snack-hut") snackHut(ctx, f);
  }
  station(w, "chlorine", venue.stations.chlorine, 0xe8c64e, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xcfe9c8, "EYE CARE", -Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  kioskTreats(w, venue.fixtures.treats);
  torches(ctx);
  jungle(ctx);
  parrots(ctx);
  finishLeaves(ctx);
  pickVolume(ctx);
}

// ---- where things are --------------------------------------------------------------------------------------------

// The deck on one side of the river (side -1, the near bank, or +1): the bank's line through the room, then round the room's
// walls back to where it came in. Points in the room's (x, z).
function sidePolygon(r, room, side) {
  const inRoom = (p) => p.x >= room.minX && p.x <= room.maxX && p.z >= room.minZ && p.z <= room.maxZ;
  const bankAt = (s) => r.point(s, side * r.w);
  // Where the bank crosses the walls, found by halving the step between a point outside and one inside.
  const crossing = (outS, inS) => {
    for (let k = 0; k < 30; k++) {
      const mid = (outS + inS) / 2;
      if (inRoom(bankAt(mid))) inS = mid;
      else outS = mid;
    }
    return { s: inS, p: bankAt(inS) };
  };
  const step = 0.2;
  let first = null,
    last = null;
  for (let s = 0; s <= r.length; s += step) {
    if (inRoom(bankAt(s))) {
      if (first === null) first = s;
      last = s;
    }
  }
  const a = crossing(Math.max(0, first - step), first),
    b = crossing(Math.min(r.length, last + step), last);
  const line = [a.p];
  for (let s = a.s + step; s < b.s; s += step) line.push(bankAt(s));
  line.push(b.p);
  // The walls, as a loop of corners; a point on them has a place round the loop (0 to 4).
  const corners = [
    { x: room.minX, z: room.minZ },
    { x: room.maxX, z: room.minZ },
    { x: room.maxX, z: room.maxZ },
    { x: room.minX, z: room.maxZ },
  ];
  const around = (p) => {
    const e = 1e-6;
    if (Math.abs(p.z - room.minZ) < e) return (p.x - room.minX) / (room.maxX - room.minX);
    if (Math.abs(p.x - room.maxX) < e) return 1 + (p.z - room.minZ) / (room.maxZ - room.minZ);
    if (Math.abs(p.z - room.maxZ) < e) return 2 + (room.maxX - p.x) / (room.maxX - room.minX);
    return 3 + (room.maxZ - p.z) / (room.maxZ - room.minZ);
  };
  const snap = (p) => {
    // (The crossing is within a hair of a wall: put it on it.)
    const d = [
      [Math.abs(p.z - room.minZ), { x: p.x, z: room.minZ }],
      [Math.abs(p.x - room.maxX), { x: room.maxX, z: p.z }],
      [Math.abs(p.z - room.maxZ), { x: p.x, z: room.maxZ }],
      [Math.abs(p.x - room.minX), { x: room.minX, z: p.z }],
    ].sort((u, v) => u[0] - v[0]);
    return d[0][1];
  };
  line[0] = snap(line[0]);
  line[line.length - 1] = snap(line[line.length - 1]);
  const tA = around(line[0]),
    tB = around(line[line.length - 1]);
  // From the exit crossing back to the entry one, one way round or the other: the way whose corners are on this side.
  const walk = (dir) => {
    const out = [];
    let t = tB;
    for (let k = 0; k < 4; k++) {
      const next = dir > 0 ? Math.floor(t + 1e-9) + 1 : Math.ceil(t - 1e-9) - 1;
      const target = (tA - tB) * dir < 0 ? tA + 4 * dir : tA;
      if ((dir > 0 && next >= target) || (dir < 0 && next <= target)) break;
      out.push(corners[((next % 4) + 4) % 4]);
      t = next;
    }
    return out;
  };
  for (const dir of [1, -1]) {
    const corner = walk(dir);
    const probe = corner[0] || { x: (line[0].x + line.at(-1).x) / 2, z: (line[0].z + line.at(-1).z) / 2 };
    if (Math.sign(r.locate(probe.x, probe.z).d) === side) return [...line, ...corner];
  }
  return line;
}

// ---- the ground, the deck and the river's channel ------------------------------------------------------------------

function ground(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    tex = grassTexture({ base: "#3d7536", seed: 5 });
  tex.repeat.set(1 / 3, 1 / 3);
  w.textures.push(tex);
  const shape = new THREE.Shape();
  shape.moveTo(-160, -160);
  shape.lineTo(160, -160);
  shape.lineTo(160, 160);
  shape.lineTo(-160, 160);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(room.minX, -room.maxZ);
  hole.lineTo(room.minX, -room.minZ);
  hole.lineTo(room.maxX, -room.minZ);
  hole.lineTo(room.maxX, -room.maxZ);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: 0xb9d79a, roughness: 1 }));
  m.position.y = -0.03;
  m.receiveShadow = true;
  w.scene.add(m);
}

function deck(ctx) {
  const { w, venue, r } = ctx,
    tex = paverTextures({ base: "#cfae7c", grout: "#6d7a44", seed: 61 });
  for (const t of [tex.map, tex.bump]) {
    t.repeat.set(1 / 2.2, 1 / 2.2);
    w.textures.push(t);
  }
  const material = new THREE.MeshStandardMaterial({
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: 1.4,
    roughness: 0.82,
    color: 0xffffff,
  });
  w.deckTop = null;
  for (const side of [-1, 1]) {
    const poly = sidePolygon(r, venue.room, side),
      shape = new THREE.Shape();
    poly.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position,
      uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    const top = new THREE.Mesh(geo, material);
    top.position.y = -0.018;
    top.receiveShadow = true;
    w.scene.add(top);
    w.deckTop ||= top;
  }
}

// A strip along the river between two offsets across it (`d0` to `d1`, at heights `y0` to `y1`), from `s0` to `s1` every `step`
// metres, with `across` columns: the river's own (s, d) on every vertex as `aRiver`, and UVs in metres.
function ribbon(r, { s0, s1, d0, d1, y0 = 0, y1 = 0, step = 0.25, across = 1, uvScale = 1, bend = null }) {
  const rows = Math.max(2, Math.ceil((s1 - s0) / step) + 1),
    cols = across + 1;
  const position = new Float32Array(rows * cols * 3),
    uv = new Float32Array(rows * cols * 2),
    river = new Float32Array(rows * cols * 2),
    index = [];
  for (let i = 0; i < rows; i++) {
    const s = s0 + ((s1 - s0) * i) / (rows - 1);
    for (let j = 0; j < cols; j++) {
      const f = j / across,
        d = d0 + (d1 - d0) * f,
        y = bend ? bend(f, y0, y1) : y0 + (y1 - y0) * f,
        p = r.point(s, d),
        k = i * cols + j;
      position.set([p.x, y, p.z], k * 3);
      uv.set([d * uvScale - (y - y0) * uvScale * 1.6, s * uvScale], k * 2);
      river.set([s, d], k * 2);
    }
  }
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < across; j++) {
      const a = i * cols + j,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      // Wound so the face looks up (or, for the banks' walls, into the river).
      index.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("aRiver", new THREE.BufferAttribute(river, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function rockTexture({ base = "#8a8170", moss = "#5f8a3a", seed = 7 } = {}) {
  const size = 256,
    rand = rngOf(seed),
    cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const c = cv.getContext("2d");
  c.fillStyle = base;
  c.fillRect(0, 0, size, size);
  // Rounded stones of a few greys and browns, a dark crack between them, moss on top of some.
  for (let i = 0; i < 46; i++) {
    const x = rand() * size,
      y = rand() * size,
      rx = 14 + rand() * 26,
      ry = 10 + rand() * 18,
      tone = 0.75 + rand() * 0.45;
    const col = new THREE.Color(base).multiplyScalar(tone);
    c.fillStyle = "#" + col.getHexString();
    c.strokeStyle = "rgba(40,34,26,0.55)";
    c.lineWidth = 2;
    for (const [dx, dy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      c.beginPath();
      c.ellipse(x + dx, y + dy, rx, ry, rand() * Math.PI, 0, TAU);
      c.fill();
      c.stroke();
    }
    if (rand() < 0.35) {
      c.fillStyle = moss;
      c.globalAlpha = 0.55;
      c.beginPath();
      c.ellipse(x, y - ry * 0.4, rx * 0.8, ry * 0.45, 0, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// The bed (sand and pebbles), the banks' walls (stacked rock, caustics on what is under water) and a mossy stone lip along both
// banks, from just inside the cave to just inside the temple.
function channel(ctx) {
  const { w, r } = ctx,
    s0 = 0,
    s1 = r.length;
  const sand = sandTexture({ base: "#c8b48a", seed: 23 });
  sand.repeat.set(0.5, 0.5);
  w.textures.push(sand);
  const bedMat = withCaustics(
    new THREE.MeshStandardMaterial({ map: sand, color: 0xc9d6b0, roughness: 0.95 }),
    w.poolUniforms,
    1.5,
  );
  const bed = new THREE.Mesh(
    ribbon(r, { s0, s1, d0: -r.w - 0.2, d1: r.w + 0.2, y0: BED, y1: BED, across: 8, uvScale: 1 }),
    bedMat,
  );
  bed.receiveShadow = true;
  w.scene.add(bed);
  // Pebbles on the bed: an instanced scatter of flattened stones.
  const pebbles = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.09, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    170,
  );
  const dummy = new THREE.Object3D(),
    tone = new THREE.Color(),
    rand = rngOf(91);
  for (let i = 0; i < pebbles.count; i++) {
    const s = s0 + rand() * (s1 - s0),
      d = (rand() * 2 - 1) * (r.w - 0.3),
      p = r.point(s, d);
    dummy.position.set(p.x, BED + 0.03, p.z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    const k = 0.5 + rand() * 1.4;
    dummy.scale.set(k, k * 0.45, k * (0.8 + rand() * 0.5));
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    pebbles.setColorAt(i, tone.setHSL(0.08 + rand() * 0.06, 0.12 + rand() * 0.15, 0.22 + rand() * 0.18));
  }
  w.scene.add(pebbles);
  const rock = rockTexture({ seed: 13 });
  rock.repeat.set(0.6, 0.6);
  w.textures.push(rock);
  // (No caustics on the walls: the bed's are seen through the water; a wall gets darker with depth instead.)
  const wallMat = new THREE.MeshStandardMaterial({
    map: rock,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const geo = ribbon(r, {
      s0,
      s1,
      d0: side * r.w,
      d1: side * (r.w - 0.25),
      y0: 0.0,
      y1: BED,
      across: 3,
      uvScale: 0.9,
      bend: (f, a, b) => a + (b - a) * f,
    });
    paint(geo, (x, y) =>
      new THREE.Color(0xb3a78e).lerp(new THREE.Color(0x2f4038), Math.min(1, -y / -BED) * 0.85),
    );
    const m = new THREE.Mesh(geo, wallMat);
    m.receiveShadow = true;
    w.scene.add(m);
    // The lip: a fat mossy tube along the bank's edge.
    const points = [];
    for (let s = r.start - 0.6; s <= r.end + 0.6; s += 0.6) {
      const p = r.point(s, side * (r.w + 0.04));
      points.push(new THREE.Vector3(p.x, 0.0, p.z));
    }
    const lip = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 3, 0.17, 7, false),
      new THREE.MeshStandardMaterial({ map: rock, color: 0xe8dcb8, roughness: 0.88 }),
    );
    lip.scale.y = 0.55;
    lip.receiveShadow = lip.castShadow = true;
    w.scene.add(lip);
  }
}

// ---- the water --------------------------------------------------------------------------------------------------------

const CAUSTIC = `
float causticLayer(vec2 p, float t) {
  float a = sin(p.x * 2.1 + sin(p.y * 1.3 + t * 0.8) * 1.4 + t * 0.6);
  float b = sin(p.y * 2.3 + sin(p.x * 1.7 - t * 0.7) * 1.3 - t * 0.5);
  return pow(max(0.0, 1.0 - abs(a + b) * 0.85), 6.0);
}
float caustic(vec2 p, float t) {
  return causticLayer(p * 1.25, t) * 0.75 + causticLayer(p * 2.2 + 3.1, t * 1.25) * 0.45;
}`;
const RIVER_VERTEX = `
attribute vec2 aRiver;
uniform float uTime;
uniform float uPhase;
varying vec3 vWorld;
varying vec2 vRiver;
void main() {
  vec3 p = position;
  float s = aRiver.x - uPhase;
  p.y += sin(s * 1.7 + aRiver.y * 0.8 - uTime * 0.6) * 0.018 + sin(p.x * 2.3 + uTime) * cos(p.z * 1.9 + uTime * 0.8) * 0.01;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vRiver = aRiver;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const RIVER_FRAGMENT =
  CAUSTIC +
  `
uniform float uTime;
uniform float uPhase;
uniform float uDirty;
uniform float uBrown;
uniform float uYellow;
uniform float uLight;
uniform float uW;
uniform float uStart;
uniform float uEnd;
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uGlint;
uniform float uGlow;
uniform float uClarity;
uniform vec3 uStones[2];
varying vec3 vWorld;
varying vec2 vRiver;
void main() {
  float s = vRiver.x, d = vRiver.y;
  vec2 q = vec2(s - uPhase, d); // carried by the current
  vec2 p = vWorld.xz;
  float t = uTime;
  float gx = cos(q.x * 2.4 + q.y * 0.9 + t * 0.3) * 0.05 + cos(q.x * 4.7 - q.y * 2.1 + t * 1.3) * 0.02
    + cos(p.x * 2.6 + t) * cos(p.y * 2.1 + t * 0.7) * 0.015;
  float gz = sin(q.y * 2.2 + q.x * 0.7 + t * 0.6) * 0.04 + cos(q.y * 5.1 + q.x * 1.3 - t * 1.1) * 0.015;
  vec3 N = normalize(vec3(-gx * 5.0, 1.0, -gz * 5.0));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float edge = uW - abs(d);
  float deep = smoothstep(0.1, 2.4, edge);
  vec3 color = mix(uShallow, uDeep, deep);
  // Long thin streaks drifting downstream, and foam where the water meets the banks and the stones.
  float streak = pow(max(0.0, sin(q.x * 0.8 + sin(q.y * 2.7) * 1.3) * sin(q.y * 5.3 + q.x * 0.21)), 14.0);
  float foam = (1.0 - smoothstep(0.0, 0.3, edge)) * (0.55 + 0.45 * sin(q.x * 6.5 + d * 3.0));
  for (int i = 0; i < 2; i++) {
    float r = length(p - uStones[i].xy) - uStones[i].z;
    foam += (1.0 - smoothstep(0.0, 0.45, r)) * (0.6 + 0.4 * sin(q.x * 9.0 + atan(p.y - uStones[i].y, p.x - uStones[i].x) * 3.0));
  }
  foam = clamp(foam, 0.0, 1.0);
  color = mix(color, vec3(0.40, 0.61, 0.24), uDirty);
  color = mix(color, vec3(0.38, 0.20, 0.07), uBrown * 0.88);
  color = mix(color, vec3(0.93, 0.82, 0.18), uYellow * 0.7);
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 200.0) * 1.5;
  float lines = caustic(q * 1.6, t * 0.8);
  float clean = 1.0 - uBrown * 0.8;
  color += vec3(0.8, 1.0, 0.95) * lines * 0.07 * clean * uLight;
  color += vec3(1.0) * streak * 0.18 * clean * uLight;
  color += vec3(0.95, 1.0, 0.97) * foam * 0.32 * clean * uLight;
  color += uGlint * glint * (1.0 - uBrown) * uLight;
  color = mix(color, uSky * uLight, fres * 0.22);
  color += vec3(0.3, 0.85, 1.0) * uGlow * 0.15 * deep;
  color *= mix(0.22, 1.0, uLight);
  // Into the cave and the temple: dark.
  float seen = smoothstep(uStart - 1.6, uStart + 0.6, s) * (1.0 - smoothstep(uEnd - 0.6, uEnd + 1.6, s));
  color *= mix(0.1, 1.0, seen);
  float clear = uClarity * (1.0 - max(max(uDirty, uBrown), uYellow));
  float alpha = (0.55 + fres * 0.2 + uDirty * 0.22 + uBrown * 0.2 + foam * 0.2) * (1.0 - clear * 0.5);
  gl_FragColor = vec4(color, mix(0.97, alpha, seen));
}`;

function water(ctx) {
  const { w, r, live } = ctx,
    look = w.look.water;
  const geo = ribbon(r, { s0: 0, s1: r.length, d0: -r.w - 0.06, d1: r.w + 0.06, step: 0.22, across: 16 });
  const stones = r.stones.map((st) => new THREE.Vector3(st.x, st.z, st.r));
  while (stones.length < 2) stones.push(new THREE.Vector3(999, 999, 0));
  w.water = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uDirty: { value: 0 },
        uBrown: { value: 0 },
        uYellow: { value: 0 },
        uLight: { value: 1 },
        uW: { value: r.w },
        uStart: { value: r.start },
        uEnd: { value: r.end },
        uSun: { value: new THREE.Vector3(-0.35, 0.9, 0.3) },
        uShallow: { value: new THREE.Vector3(...look.shallow) },
        uDeep: { value: new THREE.Vector3(...look.deep) },
        uSky: { value: new THREE.Vector3(...(look.sky || [0.7, 0.93, 0.95])) },
        uGlint: { value: new THREE.Vector3(...(look.glint || [1, 0.96, 0.86])) },
        uGlow: { value: look.glow || 0 },
        uClarity: { value: look.clarity || 0 },
        uStones: { value: stones },
      },
      vertexShader: RIVER_VERTEX,
      fragmentShader: RIVER_FRAGMENT,
    }),
  );
  w.water.position.y = WATER;
  w.water.renderOrder = 2;
  w.water.frustumCulled = false;
  w.scene.add(w.water);
  w.poolLamps = null;
  // The current: the water's pattern moves at the river's flow while the pumps run, and eases to a standstill when they stop (a
  // rescue, a closed river, a panicking crowd), as the riders do.
  let flow = r.flow,
    phase = 0;
  w.updaters.push((time, dt, world, sim) => {
    const running = !sim || !(sim.rescue || sim.closed || sim.crowdPanic?.());
    flow += ((running ? r.flow : 0) - flow) * Math.min(1, dt * 1.5);
    phase += flow * dt;
    w.water.material.uniforms.uPhase.value = phase;
  });
  void live;
}

// Mossy boulders along both banks, half in the water, leaving the docks, the bridge's ends and the stones' banks clear.
function bankRocks(ctx) {
  const { w, r } = ctx,
    rand = rngOf(47),
    keepClear = [r.docks.board.s, r.docks.exit.s, r.bridge.s],
    parts = [];
  for (const side of [-1, 1])
    for (let s = r.start + 0.4; s < r.end - 0.4; s += 0.9 + rand() * 1.1) {
      if (keepClear.some((k) => Math.abs(s - k) < 2.0)) continue;
      const d = side * (r.w - 0.05 + rand() * 0.25),
        p = r.point(s, d),
        size = 0.22 + rand() * 0.3;
      parts.push(rockGeo(rand, size, [p.x, -0.12 + rand() * 0.05, p.z]));
    }
  const m = new THREE.Mesh(
    mergeGeos(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
  );
  m.castShadow = m.receiveShadow = true;
  w.scene.add(m);
}
// One lumpy rock, its top mossy.
function rockGeo(rand, size, at, squash = 0.7, mossy = 0.55) {
  const g = new THREE.IcosahedronGeometry(size, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.78 + rand() * 0.4;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * squash, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  const rock = new THREE.Color(ROCK).multiplyScalar(0.8 + rand() * 0.4),
    moss = new THREE.Color(MOSS);
  paint(g, (x, y) => (y > size * squash * (1 - mossy) ? moss : rock));
  const out = placed(g, { at, rot: [0, rand() * TAU, 0] });
  g.dispose();
  return out;
}

// ---- the cave and the temple -------------------------------------------------------------------------------------------

// The cave the river comes out of: an arch of piled rock over the water where it crosses the back wall, a dark mouth, ferns
// and vines on top, and a curtain of water falling across the mouth that the riders float out through.
function cave(ctx) {
  const { w, r, live, rand } = ctx,
    room = ctx.venue.room;
  const s = r.start,
    c = r.at(s),
    left = r.point(s, -r.w - 0.9),
    right = r.point(s, r.w + 0.9),
    parts = [];
  const span = Math.hypot(right.x - left.x, right.z - left.z),
    height = 3.4;
  // The arch: rocks along a half-ellipse, two or three deep, then a mound behind.
  for (let k = 0; k <= 22; k++) {
    const a = (k / 22) * Math.PI,
      u = 0.5 - Math.cos(a) / 2,
      y = Math.sin(a) * height,
      x = left.x + (right.x - left.x) * u,
      z = left.z + (right.z - left.z) * u;
    for (let depth = 0; depth < 3; depth++) {
      const back = depth * 0.8 + 0.2;
      parts.push(
        rockGeo(
          rand,
          0.55 + rand() * 0.35,
          [x - c.tx * back, y + rand() * 0.2 - 0.1, z - c.tz * back],
          0.9,
          0.3,
        ),
      );
    }
  }
  for (let k = 0; k < 40; k++) {
    const u = rand(),
      x = left.x + (right.x - left.x) * u - c.tx * (2 + rand() * 4),
      z = left.z + (right.z - left.z) * u - c.tz * (2 + rand() * 4);
    parts.push(rockGeo(rand, 0.9 + rand() * 0.9, [x, height * (0.6 + rand() * 0.5), z], 0.75, 0.6));
  }
  // The mouth's sides, down to the water.
  for (const side of [-1, 1])
    for (let y = -0.6; y < height * 0.8; y += 0.55) {
      const p = r.point(s - 0.3, side * (r.w + 0.5 + rand() * 0.4));
      parts.push(rockGeo(rand, 0.6 + rand() * 0.3, [p.x, y, p.z], 0.9, 0.2));
    }
  const m = new THREE.Mesh(
    mergeGeos(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
  );
  m.castShadow = m.receiveShadow = true;
  w.scene.add(m);
  // The dark inside.
  const back = r.point(Math.max(0.3, s - 2.6), 0);
  const dark = new THREE.Mesh(
    new THREE.PlaneGeometry(span + 0.6, height + 1.2),
    new THREE.MeshBasicMaterial({ color: 0x0b120c }),
  );
  dark.position.set(back.x, height / 2 - 0.4, back.z);
  dark.rotation.y = Math.atan2(c.tx, c.tz);
  w.scene.add(dark);
  // The waterfall: a sheet of falling water across the mouth, its streaks running down, and mist where it lands.
  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 0.86, height * 0.82, 1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main() {
          float x = vUv.x * 40.0;
          float streak = 0.5 + 0.5 * sin(x + sin(x * 0.37) * 2.0) * sin(vUv.y * 9.0 + uTime * 9.0 + sin(x * 1.7) * 3.0);
          float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
          float a = (0.22 + streak * 0.38) * edge * (0.6 + 0.4 * vUv.y);
          gl_FragColor = vec4(mix(vec3(0.75, 0.93, 0.95), vec3(1.0), streak), a);
        }`,
    }),
  );
  const mid = r.point(s + 0.15, 0);
  fall.position.set(mid.x, height * 0.41 + WATER - 0.05, mid.z);
  fall.rotation.y = Math.atan2(c.tx, c.tz);
  fall.renderOrder = 3;
  live.add(fall);
  const mist = [];
  for (let k = 0; k < 10; k++) {
    const blob = w.decal(w.glowMap, 1.6, 1.6, 0xeafcff, 0.0);
    blob.renderOrder = 4;
    live.add(blob);
    mist.push({ blob, phase: k / 10, d: (rand() * 2 - 1) * (r.w - 0.6) });
  }
  w.updaters.push((time, dt, world) => {
    const calm = world.reducedMotion?.matches;
    fall.material.uniforms.uTime.value = calm ? 0 : time;
    for (const m of mist) {
      const t = (time * 0.35 + m.phase) % 1,
        p = r.point(s + 0.4 + t * 1.2, m.d);
      m.blob.position.set(p.x, WATER + 0.15 + t * 0.9, p.z);
      m.blob.quaternion.copy(world.camera.quaternion);
      m.blob.scale.setScalar(0.6 + t * 1.2);
      m.blob.material.opacity = 0.22 * Math.sin(t * Math.PI);
    }
  });
  vines(ctx, left, right, height);
  void room;
}

// The temple the river goes into: two carved stone pillars with tiki faces, a lintel with glyphs, stone blocks stepped up
// either side, overgrown with vines and ferns, and the dark beyond.
function temple(ctx) {
  const { w, r, rand } = ctx,
    s = r.end,
    c = r.at(s),
    turn = Math.atan2(c.tx, c.tz),
    g = w.group(c.x, 0, c.z, w.scene, turn);
  const stone = 0xa7a08a,
    dark = 0x6f6a5a,
    halfOpen = r.w + 0.45,
    height = 3.2;
  // (In the group: x across the river, z along it, the river flowing towards +z.)
  for (const side of [-1, 1]) {
    const x = side * (halfOpen + 0.55);
    w.box(1.1, height + 1.4, 1.2, stone, x, (height + 1.4) / 2 - 1.2, 0, 0.06, g);
    w.box(1.3, 0.25, 1.4, dark, x, height + 0.25, 0, 0.04, g);
    // A tiki face carved into the pillar, looking upstream.
    const face = w.group(x, 1.6, -0.62, g);
    w.box(0.7, 1.1, 0.08, dark, 0, 0, 0, 0.03, face);
    for (const ex of [-0.17, 0.17]) {
      w.box(0.2, 0.14, 0.06, 0xe9e2c8, ex, 0.22, -0.05, 0.02, face);
      w.box(0.08, 0.08, 0.04, 0x1a1a14, ex, 0.21, -0.08, 0.01, face);
    }
    w.box(0.1, 0.3, 0.07, stone, 0, 0.0, -0.06, 0.02, face);
    w.box(0.46, 0.12, 0.06, 0xe9e2c8, 0, -0.3, -0.05, 0.02, face);
    for (let k = -2; k <= 2; k++) w.box(0.05, 0.1, 0.05, 0x1a1a14, k * 0.09, -0.3, -0.08, 0.01, face);
    // Steps of stone blocks either side, like a ruin.
    for (let k = 0; k < 4; k++)
      w.box(
        1.2,
        0.9 + k * 0.5,
        1.2,
        k % 2 ? stone : dark,
        side * (halfOpen + 1.6 + k * 1.1),
        (0.9 + k * 0.5) / 2 - 0.1,
        0.3 + k * 0.2,
        0.08,
        g,
      );
  }
  const lintel = w.box(halfOpen * 2 + 2.6, 0.75, 1.3, stone, 0, height + 0.62, 0, 0.06, g);
  void lintel;
  const glyphs = w.textPlane(
    "◈ TEMPLE RAPIDS ◈",
    halfOpen * 2 + 1.2,
    0.5,
    "#8d8670",
    "#3e3a2c",
    0,
    height + 0.62,
    -0.66,
    g,
    64,
  );
  glyphs.rotation.y = Math.PI;
  // The dark beyond, and a mound of overgrown blocks over it.
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(halfOpen * 2 + 0.4, height + 1.4),
    new THREE.MeshBasicMaterial({ color: 0x0a0f0b }),
  );
  back.position.set(0, (height + 1.4) / 2 - 1.2, 2.2);
  back.rotation.y = Math.PI;
  g.add(back);
  for (const side of [-1, 1])
    w.box(0.4, height + 1.4, 3, dark, side * (halfOpen + 0.1), (height + 1.4) / 2 - 1.2, 1.4, 0.04, g);
  w.box(halfOpen * 2 + 1, 0.5, 3.2, dark, 0, height + 0.15, 1.6, 0.05, g);
  const parts = [];
  for (let k = 0; k < 26; k++) {
    const x = (rand() * 2 - 1) * (halfOpen + 2.5),
      z = 1.2 + rand() * 4;
    const p = new THREE.Vector3(x, height + 0.6 + rand() * 1.2, z).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      turn,
    );
    parts.push(rockGeo(rand, 0.7 + rand() * 0.8, [c.x + p.x, p.y, c.z + p.z], 0.7, 0.75));
  }
  const mound = new THREE.Mesh(
    mergeGeos(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
  );
  mound.castShadow = mound.receiveShadow = true;
  w.scene.add(mound);
  const left = new THREE.Vector3(-halfOpen - 0.6, 0, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn),
    right = new THREE.Vector3(halfOpen + 0.6, 0, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  vines(ctx, { x: c.x + left.x, z: c.z + left.z }, { x: c.x + right.x, z: c.z + right.z }, height + 0.9);
}

// Vines hanging over an opening, from `a` to `b` at `height`: leafy strands of different lengths that sway.
function vines(ctx, a, b, height) {
  const { rand, leaves } = ctx;
  const leaf = new THREE.PlaneGeometry(0.22, 0.14);
  for (let k = 0; k < 18; k++) {
    const u = rand(),
      x = a.x + (b.x - a.x) * u,
      z = a.z + (b.z - a.z) * u,
      length = 0.6 + rand() * 1.8,
      phase = rand() * TAU;
    for (let y = 0; y < length; y += 0.16) {
      const g = placed(leaf, {
        at: [x + Math.sin(y * 3 + phase) * 0.05, height - y, z],
        rot: [rand() * 1.2 - 0.6, rand() * TAU, rand() * 0.6],
      });
      const flex = new Float32Array(g.attributes.position.count).fill(Math.min(1, y / 1.6 + 0.15));
      g.setAttribute("aFlex", new THREE.BufferAttribute(flex, 1));
      g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(flex.length).fill(phase), 1));
      paint(g, new THREE.Color(LEAF[k % LEAF.length]).multiplyScalar(0.85 + rand() * 0.3));
      leaves.push(g);
    }
  }
  leaf.dispose();
}

// ---- across the river -------------------------------------------------------------------------------------------------

// A rope bridge of planks across the river: posts at both ends, a rope rail each side that sags a little, logs underneath.
function bridge(ctx) {
  const { w, r } = ctx,
    b = r.bridge,
    c = r.at(b.s),
    turn = Math.atan2(c.tx, c.tz),
    g = w.group(c.x, 0, c.z, w.scene, turn),
    wood = woodMaterial(w, "#a5713f", 4),
    plank = woodMaterial(w, "#c48a52", 12);
  // (In the group: x across the river, z along it.)
  const reach = b.reach,
    half = b.half;
  for (let x = -reach; x <= reach; x += 0.32) w.box(0.28, 0.07, half * 2 + 0.2, plank, x, 0.035, 0, 0.02, g);
  for (const z of [-half, half]) {
    w.box(reach * 2 + 0.4, 0.16, 0.2, wood, 0, -0.09, z, 0.04, g);
    for (const x of [-reach - 0.1, -r.w - 0.3, r.w + 0.3, reach + 0.1]) {
      w.cyl(0.09, 0.11, 1.3, wood, x, 0.55, z, g, 8);
      w.ball(0.11, 0x8a5a2c, x, 1.22, z, g);
    }
    // The rope rail, sagging between the posts.
    const points = [];
    for (let k = 0; k <= 24; k++) {
      const x = -reach - 0.1 + ((reach + 0.1) * 2 * k) / 24,
        sag = 0.12 * (1 - (x / (reach + 0.1)) ** 2);
      points.push(new THREE.Vector3(x, 1.08 - sag, z));
    }
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 30, 0.03, 6, false),
      w.mat(0xd9c28e),
    );
    rope.castShadow = true;
    g.add(rope);
    // A few drop ropes from the rail to the plank edge.
    for (let x = -r.w + 0.2; x < r.w; x += 0.9) w.rod([x, 0.08, z], [x, 1.0, z], 0.012, 0xd9c28e, g);
  }
  // Logs in the water under the middle, holding it up.
  for (const x of [-r.w * 0.45, r.w * 0.45]) w.cyl(0.14, 0.16, 1.25, wood, x, -0.6, 0, g, 8);
}

// The stepping stones in the middle of the river: big flat-topped boulders, wet at the waterline, mossy round the edge, their
// tops at the deck's height (the coach stands on them), with a few small rocks about them.
function steppingStones(ctx) {
  const { w, r, rand } = ctx,
    parts = [];
  for (const st of r.stones) {
    const geo = new THREE.CylinderGeometry(st.r * 0.98, st.r * 1.3, -BED + 0.02, 11, 5);
    const pos = geo.attributes.position,
      bumps = Array.from({ length: 11 }, () => 0.86 + rand() * 0.28);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        y = pos.getY(i),
        a = Math.round(((Math.atan2(z, x) + Math.PI) / TAU) * 11) % 11,
        top = y > -BED / 2 - 0.01,
        k = bumps[a] * (top ? 1 : 0.94 + rand() * 0.12),
        // a rounded edge on top: the rim drops a little
        drop = top && Math.hypot(x, z) > st.r * 0.6 ? -0.06 : 0;
      pos.setXYZ(i, x * k, y + drop, z * k);
    }
    geo.computeVertexNormals();
    const height = -BED + 0.02;
    paint(geo, (x, y) => {
      const top = y > height / 2 - 0.02,
        wet = y < WATER - BED / 2 - height / 2 + 0.25;
      return new THREE.Color(top ? 0x9d927a : wet ? 0x4f5a4a : ROCK).lerp(
        new THREE.Color(MOSS),
        top && Math.hypot(x, 0) > st.r * 0.7 ? 0.6 : 0,
      );
    });
    parts.push(placed(geo, { at: [st.x, BED + height / 2 - 0.0, st.z], rot: [0, rand() * TAU, 0] }));
    geo.dispose();
    for (let k = 0; k < 4; k++) {
      const a = rand() * TAU,
        d = st.r + 0.15 + rand() * 0.3;
      parts.push(
        rockGeo(
          rand,
          0.12 + rand() * 0.14,
          [st.x + Math.cos(a) * d, -0.24, st.z + Math.sin(a) * d],
          0.6,
          0.3,
        ),
      );
    }
  }
  const m = new THREE.Mesh(
    mergeGeos(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
  );
  m.castShadow = m.receiveShadow = true;
  w.scene.add(m);
}

// The two docks on the near bank: wooden platforms out over the water's edge with steps down into it, a bamboo arch with a
// sign over the land end; and the tube return beside the exit dock, where the riders leave their tubes.
function docks(ctx) {
  const { w, r } = ctx,
    plank = woodMaterial(w, "#b98149", 21),
    wood = woodMaterial(w, "#8f5e33", 3);
  for (const [key, title, colors] of [
    ["board", "ALL ABOARD!", ["#ffd23f", "#2f6b3c"]],
    ["exit", "EXIT", ["#fff2d0", "#c44b2f"]],
  ]) {
    const dock = r.docks[key],
      c = r.at(dock.s),
      turn = Math.atan2(c.tx, c.tz),
      bank = r.point(dock.s, -r.w),
      g = w.group(bank.x, 0, bank.z, w.scene, turn);
    // (In the group: +x is across the river, towards the far bank; the dock reaches from x = -1.3 on the deck to 0.45 over
    // the water.)
    for (let z = -1.0; z <= 1.0; z += 0.25) w.box(1.75, 0.06, 0.22, plank, -0.42, 0.03, z, 0.015, g);
    for (const z of [-1.06, 1.06]) w.box(1.85, 0.12, 0.12, wood, -0.42, -0.04, z, 0.02, g);
    for (const z of [-0.95, 0.95]) w.cyl(0.08, 0.08, 1.3, wood, 0.42, -0.6, z, g, 8);
    // Steps down into the water.
    for (const [x, y] of [
      [0.62, -0.18],
      [0.86, -0.42],
    ])
      w.box(0.28, 0.06, 1.6, plank, x, y, 0, 0.015, g);
    // The arch over the land end, with its sign.
    for (const z of [-1.0, 1.0]) bambooPole(w, -1.25, z, 2.6, g);
    w.rod([-1.25, 2.5, -1.1], [-1.25, 2.5, 1.1], 0.07, BAMBOO, g);
    const sign = w.textPlane(title, 1.9, 0.42, colors[1], colors[0], -1.25, 2.22, 0, g, 52);
    sign.rotation.y = Math.PI / 2;
    for (const z of [-0.7, 0.7]) w.rod([-1.25, 2.47, z], [-1.25, 2.44, z], 0.01, 0x6b4a2a, g);
    // A little tube icon over the boarding sign.
    if (key === "board") {
      const tube = tubeObject(w, 2, 0.6);
      tube.position.set(-1.25, 2.85, 0);
      tube.rotation.set(0, Math.PI / 2, 0);
      tube.rotation.x = Math.PI / 2;
      tube.rotation.z = Math.PI / 2;
      g.add(tube);
    }
  }
  // The tube return: a low rack of bamboo where the used tubes are dropped, and its sign.
  const t = r.docks.tubeReturn,
    c = r.at(r.docks.exit.s - 1.9),
    g = w.group(t.x, 0, t.z, w.scene, Math.atan2(c.tx, c.tz));
  for (const z of [-0.9, 0.9]) {
    bambooPole(w, -0.75, z, 0.55, g);
    bambooPole(w, 0.75, z, 0.55, g);
  }
  w.rod([-0.75, 0.5, -0.9], [-0.75, 0.5, 0.9], 0.05, BAMBOO, g);
  w.rod([0.75, 0.5, -0.9], [0.75, 0.5, 0.9], 0.05, BAMBOO, g);
  const post = w.group(-0.95, 0, 0, g);
  bambooPole(w, 0, 0, 1.7, post);
  const sign = w.textPlane("TUBE RETURN", 1.3, 0.34, "#2f6b3c", "#ffe9a8", 0, 1.5, 0.06, post, 46);
  sign.rotation.y = -Math.PI / 2;
  w.labels.push({ text: "TUBE RETURN", x: t.x, y: 2.1, z: t.z });
}

// The tube rack (the venue's `fins` station): bamboo posts and a rail, the guests' tubes standing in a row on their edges (one
// for each tube on the rack: `finPairs`, shown while the rack has them).
function tubeRack(ctx) {
  const { w, venue } = ctx,
    p = venue.stations.fins,
    f = venue.furniture.find((x) => x.kind === "tube-rack") || { hx: 0.6, hz: 1.1 },
    g = w.group(p.x, 0, p.z),
    count = venue.tubes ?? 3,
    wood = woodMaterial(w, "#8f5e33", 3);
  for (const z of [-f.hz, f.hz]) {
    bambooPole(w, -0.35, z, 1.5, g);
    bambooPole(w, 0.35, z, 1.5, g);
  }
  w.box(0.9, 0.1, f.hz * 2 + 0.2, wood, 0, 0.1, 0, 0.03, g);
  w.rod([0, 1.38, -f.hz - 0.1], [0, 1.38, f.hz + 0.1], 0.06, BAMBOO, g);
  w.finPairs = [];
  for (let i = 0; i < count; i++) {
    const tube = tubeObject(w, i, 0.82);
    tube.rotation.set(0, Math.PI / 2, 0);
    tube.position.set(
      i % 2 ? 0.06 : -0.06,
      0.62,
      -f.hz + 0.12 + (i * (f.hz * 2 - 0.24)) / Math.max(1, count - 1),
    );
    tube.rotation.x = 0;
    tube.rotation.z = (i % 2 ? 1 : -1) * 0.12;
    g.add(tube);
    w.finPairs.push(tube);
  }
  const sign = w.textPlane("TUBES", 1.1, 0.34, "#2f6b3c", "#ffd23f", -0.36, 1.72, 0, g, 52);
  sign.rotation.y = -Math.PI / 2;
  stationHit(w, { kind: "station", item: "fins" }, p, 2.6, 2.2, Math.PI / 2);
  w.labels.push({ text: "E · TUBE RACK", x: p.x, y: 2.3, z: p.z });
}

// ---- the room's edge -----------------------------------------------------------------------------------------------

function bambooPole(w, x, z, height, parent = w.scene, r = 0.06) {
  w.cyl(r, r * 1.08, height, BAMBOO, x, height / 2, z, parent, 8);
  for (let y = 0.45; y < height; y += 0.6) w.cyl(r * 1.3, r * 1.3, 0.05, JOINT, x, y, z, parent, 8);
}

// A bamboo palisade along the walls: tall at the back and the far side (the picture's top), low along the near side (so it
// never hides the deck), with gaps for the jungle gate, the cave and the temple. One instanced mesh of poles, lashed with rails.
function palisade(ctx) {
  const { w, venue, r } = ctx,
    room = venue.room,
    rand = rngOf(5),
    door = venue.arrival,
    gateHalf = door.doorX * 2 + 0.25;
  // Where the river (and its rocks) crosses each wall, along that wall.
  const gapOn = (wall, value) => {
    const xs = [];
    for (const s of [r.start, r.end])
      for (const d of [-r.w - 1.2, r.w + 1.2]) {
        const p = r.point(s, d);
        if (wall === "back" && Math.abs(p.z - room.minZ) < 2.5) xs.push(p.x);
        if (wall === "front" && Math.abs(p.z - room.maxZ) < 2.5) xs.push(p.x);
      }
    return xs.length ? value >= Math.min(...xs) - 0.4 && value <= Math.max(...xs) + 0.4 : false;
  };
  const runs = [
    // [from, to, height, skip]
    [
      { x: room.minX, z: room.minZ + 0.05 },
      { x: room.maxX, z: room.minZ + 0.05 },
      2.4,
      (p) => Math.abs(p.x) < gateHalf || gapOn("back", p.x),
    ],
    [{ x: room.maxX - 0.05, z: room.minZ }, { x: room.maxX - 0.05, z: room.maxZ }, 2.6, () => false],
    [
      { x: room.minX, z: room.maxZ - 0.05 },
      { x: room.maxX, z: room.maxZ - 0.05 },
      2.4,
      (p) => gapOn("front", p.x),
    ],
    [{ x: room.minX + 0.05, z: room.minZ }, { x: room.minX + 0.05, z: room.maxZ }, 0.95, () => false],
  ];
  const poles = [];
  for (const [a, b, height, skip] of runs) {
    const length = Math.hypot(b.x - a.x, b.z - a.z),
      n = Math.floor(length / 0.15);
    let rail = null;
    const flush = (end) => {
      if (rail) {
        for (const y of [height * 0.3, height * 0.75])
          w.rod([rail.x, y, rail.z], [end.x, y, end.z], 0.035, 0x8a6a34);
        rail = null;
      }
    };
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (skip(p)) {
        flush(p);
        continue;
      }
      rail ||= p;
      poles.push({ ...p, h: height * (0.9 + rand() * 0.18), r: 0.065 + rand() * 0.02 });
      if (i === n) flush(p);
    }
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1.08, 1, 7),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    poles.length,
  );
  const dummy = new THREE.Object3D(),
    tone = new THREE.Color();
  poles.forEach((p, i) => {
    dummy.position.set(p.x, p.h / 2, p.z);
    dummy.scale.set(p.r, p.h, p.r);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, tone.set(BAMBOO).multiplyScalar(0.82 + rand() * 0.3));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  w.scene.add(mesh);
}

// The jungle gate in the back wall: two bamboo posts carved as tiki poles, a thatched lintel with the sign, and the two leaves
// that swing open as a guest comes or goes (`world.lockerDoors`, like the locker doors).
function gate(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    door = venue.arrival,
    half = door.doorX * 2 + 0.02,
    z = room.minZ + 0.05;
  for (const s of [-1, 1]) {
    const x = s * (half + 0.2);
    w.cyl(0.18, 0.2, 3.3, 0x8f5e33, x, 1.65, z, w.scene, 10);
    tikiFace(w, x, 2.4, z + 0.18, 0.5);
  }
  const thatch = thatchTexture({ base: "#c99a52", seed: 3 });
  thatch.repeat.set(3, 1);
  w.textures.push(thatch);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, half * 2 + 1.6, 3, 1),
    new THREE.MeshStandardMaterial({ map: thatch, roughness: 1 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.position.set(0, 3.55, z);
  roof.castShadow = true;
  w.scene.add(roof);
  const sign = w.textPlane(
    "LAZY RIVER",
    half * 2 + 0.6,
    0.55,
    "#2f6b3c",
    "#ffd23f",
    0,
    3.0,
    z + 0.14,
    w.scene,
    64,
  );
  sign.rotation.y = 0;
  w.box(half * 2 + 0.75, 0.66, 0.08, 0x8f5e33, 0, 3.0, z + 0.08, 0.04);
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * half, 0, z + 0.06);
    w.scene.add(hinge);
    for (let i = 0; i < 6; i++) {
      const x = -side * (0.12 + i * ((half - 0.18) / 5));
      w.cyl(0.05, 0.05, 1.5, BAMBOO, x, 0.85, 0.02, hinge, 7);
    }
    for (const y of [0.4, 1.3])
      w.box(half - 0.05, 0.07, 0.06, 0x8a6a34, (-side * half) / 2, y, 0.05, 0.02, hinge);
    w.lockerDoors.push({ side, hinge });
  }
}

// A carved tiki face: a slab with big eyes, a broad nose and a grin.
function tikiFace(w, x, y, z, size = 1, parent = w.scene, turn = 0) {
  const g = w.group(x, y, z, parent, turn);
  g.scale.setScalar(size);
  w.box(0.9, 1.2, 0.18, 0x7a4f2a, 0, 0, 0, 0.06, g);
  for (const ex of [-0.22, 0.22]) {
    w.box(0.3, 0.2, 0.06, 0xf2e6c8, ex, 0.26, 0.1, 0.03, g);
    w.box(0.12, 0.12, 0.04, 0x1a120a, ex, 0.25, 0.13, 0.02, g);
  }
  w.box(0.16, 0.36, 0.1, 0x8f5e33, 0, 0.0, 0.12, 0.03, g);
  w.box(0.6, 0.16, 0.06, 0xf2e6c8, 0, -0.34, 0.1, 0.03, g);
  for (let k = -3; k <= 3; k++) w.box(0.05, 0.12, 0.04, 0x1a120a, k * 0.08, -0.34, 0.13, 0.01, g);
  w.box(1.0, 0.12, 0.22, 0xc44b2f, 0, 0.55, 0.0, 0.03, g);
  return g;
}

// A tiki totem (the venue's `tiki`): three stacked faces on a post, a torch burning on top.
function tiki(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z);
  w.cyl(0.42, 0.5, 0.3, 0x5b3d22, 0, 0.15, 0, g, 10);
  const turn = Math.atan2(-x, -z);
  for (let k = 0; k < 3; k++) tikiFace(w, 0, 0.75 + k * 0.72, 0, 0.6 + (k === 1 ? 0.06 : 0), g, turn);
  w.cyl(0.18, 0.12, 0.3, 0x3a2614, 0, 2.55, 0, g, 8);
  ctx.flames.push({ x, y: 2.95, z, size: 1.1 });
}

function boulder(ctx, x, z, size, seed) {
  const { w } = ctx,
    rand = rngOf(Math.abs(Math.round(seed * 97)) + 3),
    parts = [rockGeo(rand, size, [x, size * 0.35, z], 0.75, 0.5)];
  for (let k = 0; k < 3; k++) {
    const a = rand() * TAU,
      d = size * (0.8 + rand() * 0.4);
    parts.push(
      rockGeo(
        rand,
        size * (0.3 + rand() * 0.25),
        [x + Math.cos(a) * d, size * 0.12, z + Math.sin(a) * d],
        0.7,
        0.5,
      ),
    );
  }
  const m = new THREE.Mesh(
    mergeGeos(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
  );
  m.castShadow = m.receiveShadow = true;
  w.scene.add(m);
  // Ferns at its foot.
  fern(ctx, x + size * 0.7, z - size * 0.4, 0.7);
  fern(ctx, x - size * 0.6, z + size * 0.5, 0.6);
}

// The snack hut: a thatched roof on bamboo posts over a counter with a sign, coconuts and a parrot perch.
function snackHut(ctx, f) {
  const { w } = ctx,
    g = w.group(f.x, 0, f.z, w.scene, Math.PI / 2),
    wood = woodMaterial(w, "#a5713f", 8);
  // (In the group the counter faces +z, towards the river.)
  for (const x of [-f.hz + 0.1, f.hz - 0.1])
    for (const z of [-f.hx + 0.1, f.hx - 0.1]) bambooPole(w, x, z, 2.5, g, 0.07);
  w.box(f.hz * 2, 1.0, 0.3, wood, 0, 0.5, f.hx - 0.2, 0.04, g);
  w.box(f.hz * 2 + 0.2, 0.08, 0.6, 0xc48a52, 0, 1.04, f.hx - 0.2, 0.02, g);
  const thatch = thatchTexture({ base: "#d0a258", seed: 11 });
  thatch.repeat.set(4, 1);
  w.textures.push(thatch);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(f.hx, f.hz) * 1.75, 1.3, 4, 1),
    new THREE.MeshStandardMaterial({ map: thatch, roughness: 1 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.05;
  roof.castShadow = true;
  g.add(roof);
  const sign = w.textPlane("SNACKS", 1.4, 0.4, "#ffd23f", "#7a3a1a", 0, 2.25, f.hx + 0.05, g, 56);
  void sign;
  for (let k = 0; k < 4; k++) w.ball(0.11, 0x6b4a2a, -0.6 + k * 0.32, 1.17, f.hx - 0.15, g);
  w.cyl(0.1, 0.12, 0.3, 0xf26b3a, 0.8, 1.22, f.hx - 0.25, g, 8);
}

// ---- fire, plants and birds -------------------------------------------------------------------------------------------

function torches(ctx) {
  const { w, venue, live } = ctx,
    room = venue.room,
    flame = flameTexture();
  w.textures.push(flame);
  // Bamboo torches round the deck's edge, by the gate and at both docks.
  const spots = [
    [room.minX + 0.5, -12],
    [room.minX + 0.5, 4],
    [room.maxX - 0.5, -13],
    [room.maxX - 0.5, 4.5],
    [-2.2, room.minZ + 0.6],
    [2.2, room.minZ + 0.6],
    [room.maxX - 0.5, 12.2],
  ];
  for (const key of ["board", "exit"]) {
    const d = venue.river.docks[key];
    for (const sd of [-1.5, 1.5]) {
      const p = venue.river.point(d.s + sd, -(venue.river.w + 1.6));
      spots.push([p.x, p.z]);
    }
  }
  for (const [x, z] of spots) {
    bambooPole(w, x, z, 1.9);
    w.cyl(0.13, 0.08, 0.2, 0x3a2614, x, 1.98, z, w.scene, 8);
    ctx.flames.push({ x, y: 2.35, z, size: 0.85 });
  }
  const sprites = ctx.flames.map((f, i) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flame,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    sprite.position.set(f.x, f.y, f.z);
    sprite.scale.set(0.42 * f.size, 0.78 * f.size, 1);
    live.add(sprite);
    return { sprite, f, phase: i * 1.7 };
  });
  w.updaters.push((time, dt, world) => {
    const calm = world.reducedMotion?.matches,
      light = world.incidentLight ?? 1;
    for (const s of sprites) {
      const flick = calm
        ? 1
        : 0.85 + 0.15 * Math.sin(time * 11 + s.phase) * Math.sin(time * 7.3 + s.phase * 2);
      s.sprite.scale.set(0.42 * s.f.size * flick, 0.78 * s.f.size * (0.9 + 0.2 * flick), 1);
      s.sprite.material.opacity = 0.75 + 0.25 * (1 - light);
    }
  });
}

// One fern: arching fronds of little leaves, swaying.
function fern(ctx, x, z, size = 1, y0 = 0) {
  const { rand, leaves } = ctx;
  const blade = new THREE.PlaneGeometry(0.16, 0.6, 1, 3);
  blade.translate(0, 0.3, 0);
  const n = 7 + Math.floor(rand() * 4);
  for (let k = 0; k < n; k++) {
    const g = placed(blade, {
      at: [x, y0, z],
      rot: [0.5 + rand() * 0.5, (k / n) * TAU + rand() * 0.3, 0],
      scale: [size * 1.6, size * (1.4 + rand() * 0.6), 1],
    });
    const pos = g.attributes.position,
      flex = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) flex[i] = Math.max(0, Math.min(1, (pos.getY(i) - y0) / (size * 0.9)));
    g.setAttribute("aFlex", new THREE.BufferAttribute(flex, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(pos.count).fill(rand() * TAU), 1));
    const tint = new THREE.Color(LEAF[Math.floor(rand() * LEAF.length)]);
    paint(g, (px, py) => tint.clone().lerp(new THREE.Color(0x9bd36a), Math.max(0, (py - y0) / size) * 0.35));
    leaves.push(g);
  }
  blade.dispose();
}

// A banana plant: a short trunk and big paddle leaves, arching out.
function banana(ctx, x, z, size = 1) {
  const { w, rand, leaves } = ctx;
  w.cyl(0.12 * size, 0.16 * size, 1.2 * size, 0x6f8a3a, x, 0.6 * size, z, w.scene, 7);
  const leaf = new THREE.PlaneGeometry(0.55, 1.8, 2, 6);
  leaf.translate(0, 0.9, 0);
  // Curl it: the tip droops.
  const pos = leaf.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, (y / 1.8) ** 2 * 0.7 + Math.abs(pos.getX(i)) * 0.25);
  }
  leaf.computeVertexNormals();
  const n = 6 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const g = placed(leaf, {
      at: [x, 1.1 * size, z],
      rot: [0.55 + rand() * 0.45, (k / n) * TAU + rand() * 0.4, 0],
      scale: size * (0.8 + rand() * 0.4),
    });
    const p = g.attributes.position,
      flex = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++)
      flex[i] = Math.max(0, Math.min(1, Math.hypot(p.getX(i) - x, p.getZ(i) - z) / (1.8 * size)));
    g.setAttribute("aFlex", new THREE.BufferAttribute(flex, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(p.count).fill(rand() * TAU), 1));
    paint(g, new THREE.Color(0x4f9f3a).lerp(new THREE.Color(0x8fcf5a), rand() * 0.5));
    leaves.push(g);
  }
  leaf.dispose();
}

// The jungle beyond the palisade: palms, banana plants, bushes with flowers, bamboo groves and ferns, thick and tall behind the
// river (the top of the picture), low along the near side (so nothing stands between the camera and the deck).
function jungle(ctx) {
  const { w, venue, rand } = ctx,
    room = venue.room;
  const r = venue.river;
  const outside = (minGap, maxGap, side) => {
    for (let k = 0; k < 20; k++) {
      const p = place(minGap, maxGap, side);
      // (Not in the river's way where it runs on behind the walls, nor on the cave or the temple.)
      const q = r.locate(p.x, p.z);
      if (q.dist > r.w + 3 || (q.s > 2 && q.s < r.length - 2 && Math.abs(q.d) > r.w + 3)) return p;
    }
    return { x: room.maxX + 30, z: 0 };
  };
  const place = (minGap, maxGap, side) => {
    // A point in the band `minGap`..`maxGap` metres outside a wall: "far" (+x), "near" (-x), "back" (-z) or "front" (+z).
    const g = minGap + rand() * (maxGap - minGap);
    if (side === "far") return { x: room.maxX + g, z: room.minZ - 6 + rand() * (room.maxZ - room.minZ + 12) };
    if (side === "near")
      return { x: room.minX - g, z: room.minZ - 6 + rand() * (room.maxZ - room.minZ + 12) };
    if (side === "back") return { x: room.minX - 4 + rand() * (room.maxX - room.minX + 8), z: room.minZ - g };
    return { x: room.minX - 4 + rand() * (room.maxX - room.minX + 8), z: room.maxZ + g };
  };
  // Palms.
  for (let k = 0; k < 34; k++) {
    const side = ["far", "far", "back", "front"][k % 4],
      p = outside(1.2, 14, side);
    swayPalm(ctx, p.x, p.z, 5 + rand() * 4.5, k * 1.37 + p.x);
  }
  // Banana plants and ferns along the palisade.
  for (let k = 0; k < 22; k++) {
    const side = ["far", "back", "front", "far"][k % 4],
      p = outside(0.8, 6, side);
    banana(ctx, p.x, p.z, 0.9 + rand() * 0.7);
  }
  for (let k = 0; k < 36; k++) {
    const p = outside(0.5, 7, ["far", "back", "front", "near", "near"][k % 5]);
    fern(ctx, p.x, p.z, 0.6 + rand() * 0.6, -0.02);
  }
  // Bushes: one instanced mesh of lumpy green balls, some with flowers.
  const bushes = [];
  for (let k = 0; k < 120; k++) {
    const side = ["far", "far", "back", "front", "near"][k % 5],
      p = outside(0.6, 18, side),
      low = side === "near";
    bushes.push({ ...p, size: low ? 0.45 + rand() * 0.35 : 0.8 + rand() * 1.4 });
  }
  const bushMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    bushes.length,
  );
  const dummy = new THREE.Object3D(),
    tone = new THREE.Color();
  bushes.forEach((b, i) => {
    dummy.position.set(b.x, b.size * 0.55, b.z);
    dummy.scale.set(b.size, b.size * 0.8, b.size);
    dummy.rotation.set(0, rand() * TAU, 0);
    dummy.updateMatrix();
    bushMesh.setMatrixAt(i, dummy.matrix);
    bushMesh.setColorAt(i, tone.set(LEAF[i % LEAF.length]).multiplyScalar(0.8 + rand() * 0.35));
  });
  bushMesh.castShadow = bushMesh.receiveShadow = true;
  w.scene.add(bushMesh);
  const flowers = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x220a00 }),
    160,
  );
  const petals = [0xff3b5c, 0xff8a1f, 0xffd23f, 0xff5fc4, 0xffffff];
  for (let i = 0; i < flowers.count; i++) {
    const b = bushes[i % bushes.length],
      a = rand() * TAU,
      up = 0.3 + rand() * 0.6;
    dummy.position.set(
      b.x + Math.cos(a) * b.size * 0.85 * Math.cos(up),
      b.size * 0.55 + Math.sin(up) * b.size * 0.75,
      b.z + Math.sin(a) * b.size * 0.85 * Math.cos(up),
    );
    dummy.scale.setScalar(0.8 + rand() * 0.7);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, tone.set(petals[i % petals.length]));
  }
  w.scene.add(flowers);
  // Bamboo groves behind the far wall and the back.
  const stems = [];
  for (let k = 0; k < 9; k++) {
    const c = outside(2, 9, ["far", "back", "front"][k % 3]);
    for (let j = 0; j < 9; j++)
      stems.push({ x: c.x + (rand() - 0.5) * 1.6, z: c.z + (rand() - 0.5) * 1.6, h: 4 + rand() * 4 });
  }
  const stemMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.07, 0.09, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    stems.length,
  );
  stems.forEach((s, i) => {
    dummy.position.set(s.x, s.h / 2, s.z);
    dummy.scale.set(1, s.h, 1);
    dummy.rotation.set((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);
    stemMesh.setColorAt(i, tone.set(0x8fb84a).multiplyScalar(0.8 + rand() * 0.3));
  });
  stemMesh.castShadow = true;
  w.scene.add(stemMesh);
  // Ferns tucked in the room's corners and by the cave and temple.
  for (const [x, z] of [
    [room.maxX - 0.6, room.minZ + 0.7],
    [room.minX + 0.7, room.maxZ - 0.6],
    [room.maxX - 0.7, room.maxZ - 0.7],
    [room.minX + 0.6, room.minZ + 0.6],
  ])
    fern(ctx, x, z, 0.75);
}

// Two parrots circling over the jungle, wings flapping (only in the picture).
function parrots(ctx) {
  const { w, live } = ctx,
    birds = [];
  for (const [color, wing, radius, alt, speed] of [
    [0xe8312a, 0x2a6be8, 15, 8.5, 0.32],
    [0x2fbf4a, 0xffd23f, 18, 10.5, -0.26],
    [0xffb000, 0x2a9be8, 21, 9.5, 0.22],
  ]) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), w.mat(color, { roughness: 0.5 }));
    body.scale.set(0.8, 0.8, 1.7);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.55), w.mat(wing));
    tail.position.set(0, 0, -0.5);
    g.add(tail);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), w.mat(0xf2e6c8));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.02, 0.38);
    g.add(beak);
    const wings = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.26), w.mat(wing));
      m.position.x = s * 0.32;
      pivot.add(m);
      g.add(pivot);
      return pivot;
    });
    live.add(g);
    birds.push({ g, wings, radius, alt, speed, phase: birds.length * 2.1 });
  }
  w.updaters.push((time, dt, world) => {
    const calm = world.reducedMotion?.matches;
    for (const b of birds) {
      const a = b.phase + time * b.speed,
        x = Math.cos(a) * b.radius + 6,
        z = Math.sin(a) * b.radius;
      b.g.position.set(x, b.alt + Math.sin(time * 0.6 + b.phase) * 1.2, z);
      b.g.rotation.set(0, -a + (b.speed > 0 ? 0 : Math.PI), (b.speed > 0 ? -1 : 1) * 0.3);
      const flap = calm ? 0.2 : Math.sin(time * 9 + b.phase) * 0.6;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
      b.g.visible = (world.incidentLight ?? 1) > 0.5;
    }
  });
}

// Every frond, leaf and fern in one swaying mesh.
function finishLeaves(ctx) {
  const { w, live, fronds, leaves } = ctx;
  const all = [...fronds, ...leaves];
  if (!all.length) return;
  const mesh = new THREE.Mesh(
    mergeGeos(all),
    wind(
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75 }),
      w.wind,
      {
        amp: 0.22,
        speed: 1.4,
      },
    ),
  );
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  live.add(mesh);
}

// ---- picking and the guidance highlight -----------------------------------------------------------------------------------

// The river is the one "lane": an invisible strip over the seen water for clicks (send the selected guest down the river), and
// a highlight of the same shape with a rim along both banks for the guidance (scene.mjs drives both like a lane's).
function pickVolume(ctx) {
  const { w, r } = ctx;
  const strip = ribbon(r, { s0: r.start + 0.4, s1: r.end - 0.4, d0: -r.w, d1: r.w, step: 0.5, across: 2 });
  const pick = new THREE.Mesh(strip, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  pick.position.y = -0.12;
  pick.userData = { kind: "lane", lane: 0 };
  w.scene.add(pick);
  w.clickables.push(pick);
  const glow = new THREE.Mesh(
    strip.clone(),
    new THREE.MeshBasicMaterial({
      color: 0xffe58b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.position.y = -0.17;
  glow.renderOrder = 3;
  w.scene.add(glow);
  w.riverHighlight = glow;
  const rim = [];
  for (let s = r.start + 0.4; s <= r.end - 0.4; s += 0.5) {
    const p = r.point(s, -r.w + 0.1);
    rim.push(new THREE.Vector3(p.x, -0.13, p.z));
  }
  for (let s = r.end - 0.4; s >= r.start + 0.4; s -= 0.5) {
    const p = r.point(s, r.w - 0.1);
    rim.push(new THREE.Vector3(p.x, -0.13, p.z));
  }
  w.riverRim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(rim),
    new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
  );
  w.scene.add(w.riverRim);
}

export { TUBE_COLORS };
void COLORS;
void woodTexture;
