// The Mountain Hot Springs on screen (18 October 2026, the creator: "make an amazing environment… several hot springs… add some
// steam, lots of rocks and snow… it's icy on the deck… very, very AAA kind of environment"). A terrace of flagstones glazed with
// ice, trodden paths through the snow on it, four natural springs of milky turquoise water in rock basins, rimmed with flat stones
// and snow-capped boulders, steam rolling off them; a timber bathhouse with its 湯 curtain at the left end, stone lanterns glowing,
// a bamboo spout pouring into the far spring; a forest of snowy cedars round the far side and the right end, the mountains painted
// all round beyond it (mountains.jpg), and snow falling over everything, at the blue hour.
//
// Nothing here moves the simulation: the steam, the snowfall, the ripples and the spout only move in the picture. The guests in the
// water and the snow monkeys are scene/onsen-view.mjs's.
import { THREE } from "./kit.mjs";
import { SPRINGS, ONSEN, BOULDERS, springPoint, springSteps } from "../onsen-plan.mjs";
import { mergeGeos, paint, placed, rngOf } from "./geom.mjs";
import { roofPicture } from "./city.mjs";
import { propModel } from "./prop-models.mjs";
import {
  station,
  sanitationCorner,
  rescueStations,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsTable,
} from "./props.mjs";
import { buildOnsenCast } from "./onsen-view.mjs";

const TAU = Math.PI * 2;
export const ONSEN_WATER_Y = -0.15; // the springs' surface
const FLOOR_Y = -1.1; // the basins' floor
const SNOW = 0xe9eff8,
  ROCK = 0x6f6a66,
  ROCK_DARK = 0x4a4744,
  CEDAR = 0x2d4a3a;

export function buildOnsen(w, venue) {
  const live = new THREE.Group();
  live.name = "onsen-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, live, rand: rngOf(181) };
  w.poolUniforms = { uTime: { value: 0 }, uCaustic: { value: 1 } };
  w.camera.far = 400;
  w.camera.updateProjectionMatrix();
  materials(ctx);
  ground(ctx);
  terrace(ctx);
  basins(ctx);
  water(ctx);
  rimStones(ctx);
  boulders(ctx);
  bathhouse(ctx);
  lanterns(ctx);
  spout(ctx);
  forest(ctx);
  mountains(ctx);
  dressing(ctx);
  steam(ctx);
  snowfall(ctx);
  pickVolumes(ctx);
  buildOnsenCast(w, ctx);
}

// ---- the materials and the pictures ------------------------------------------------------------------------------------

function picture(ctx, file, material, repeat, color, key = "map") {
  roofPicture(ctx.w, file, (t) => ((material[key] = t), (material.needsUpdate = true)), {
    repeat,
    color,
    dir: "onsen",
  });
}
function materials(ctx) {
  // The flagstones under a glaze of ice: the stone's own picture, cooled, and a clear coat that catches the sky.
  ctx.ice = new THREE.MeshPhysicalMaterial({
    color: 0xb4c2d2,
    roughness: 0.45,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  picture(ctx, "stone-path.jpg", ctx.ice, [1 / 3.6, 1 / 3.6], "#8d8f93");
  ctx.snow = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.82 });
  picture(ctx, "snow.jpg", ctx.snow, [1 / 4, 1 / 4], "#eef3fa");
  ctx.rock = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  picture(ctx, "rock.jpg", ctx.rock, [1 / 1.6, 1 / 1.6], "#6c6863");
  ctx.floor = new THREE.MeshStandardMaterial({ color: 0x7fb0b3, roughness: 0.8 });
  picture(ctx, "pool-floor.jpg", ctx.floor, [1 / 1.4, 1 / 1.4], "#7fb0b3");
  ctx.wood = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  picture(ctx, "wood.jpg", ctx.wood, [1, 1], "#7a5236");
  ctx.stones = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, flatShading: true });
  ctx.slabs = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
  picture(ctx, "rock.jpg", ctx.slabs, [1 / 0.9, 1 / 0.9], "#ffffff");
  picture(ctx, "rock.jpg", ctx.stones, [1 / 1.2, 1 / 1.2], "#ffffff");
}

// ---- the ground --------------------------------------------------------------------------------------------------------

// The snowfield all round, out to the forest and beyond, with drifts banked against the terrace's edges.
function ground(ctx) {
  const { w, rand } = ctx;
  // (Holed where the terrace is: the springs' basins go down through it.)
  const D = ONSEN.deck,
    parts = [],
    outer = new THREE.Shape();
  outer.moveTo(-130, 130);
  outer.lineTo(130, 130);
  outer.lineTo(130, -130);
  outer.lineTo(-130, -130);
  outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(D.minX + 0.05, -D.minZ - 0.05);
  hole.lineTo(D.minX + 0.05, -D.maxZ + 0.05);
  hole.lineTo(D.maxX - 0.05, -D.maxZ + 0.05);
  hole.lineTo(D.maxX - 0.05, -D.minZ - 0.05);
  hole.closePath();
  outer.holes.push(hole);
  const fieldGeo = new THREE.ShapeGeometry(outer);
  fieldGeo.rotateX(-Math.PI / 2);
  const field = new THREE.Mesh(fieldGeo, ctx.snow);
  field.position.y = -0.01;
  field.receiveShadow = true;
  w.scene.add(field);
  // Drifts: long low mounds of snow along the terrace's sides (not across the bathhouse door).
  const drift = (x, z, sx, sy, sz, rot = 0) => {
    const g = new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2);
    parts.push(placed(g, { at: [x, -0.05, z], rot: [0, rot, 0], scale: [sx, sy, sz] }));
    g.dispose();
  };
  for (let z = D.minZ + 1; z < D.maxZ; z += 2.6 + rand() * 1.5)
    drift(D.maxX + 1.4 + rand() * 0.8, z, 1.6 + rand(), 0.5 + rand() * 0.4, 1.8 + rand());
  for (let x = D.minX + 2; x < D.maxX; x += 2.6 + rand() * 1.5)
    drift(x, D.maxZ + 1.3 + rand() * 0.8, 1.8 + rand(), 0.45 + rand() * 0.35, 1.5 + rand());
  for (let z = D.minZ + 1; z < D.maxZ; z += 3 + rand() * 1.5)
    drift(D.minX - 1.6 - rand() * 0.8, z, 1.4 + rand(), 0.35 + rand() * 0.3, 1.6 + rand());
  for (const x of [-12, -8.5, 7.5, 11.5]) drift(x, D.minZ - 1.4, 1.8, 0.45, 1.2);
  const m = new THREE.Mesh(mergeGeos(parts, ["position", "normal", "uv"]), ctx.snow);
  m.receiveShadow = true;
  w.scene.add(m);
}

// The outline of spring `s` at normalized radius `r`, as points in the deck's plane.
function outline(s, r = 1, n = 64) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(springPoint(s, (i / n) * TAU, r));
  return out;
}

// The terrace: flagstones glazed with ice, holed where the springs are; on top of it the snow, lying thick at the edges and round
// the boulders, thin on the paths the guests have trodden from the bathhouse to every spring's steps (a painted mask).
function terrace(ctx) {
  const { w } = ctx,
    D = ONSEN.deck;
  const shape = new THREE.Shape();
  shape.moveTo(D.minX, -D.minZ);
  shape.lineTo(D.maxX, -D.minZ);
  shape.lineTo(D.maxX, -D.maxZ);
  shape.lineTo(D.minX, -D.maxZ);
  shape.closePath();
  for (const s of SPRINGS) {
    const hole = new THREE.Path(),
      pts = outline(s, 1);
    hole.moveTo(pts[0].x, -pts[0].z);
    for (const p of pts.slice(1)) hole.lineTo(p.x, -p.z);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ShapeGeometry(shape, 6);
  geo.rotateX(-Math.PI / 2);
  // (Shape space (x, -z) turned down onto the ground: the uvs are metres.)
  const deck = new THREE.Mesh(geo, ctx.ice);
  deck.receiveShadow = true;
  w.scene.add(deck);
  // The snow lying on it.
  const mask = snowMask(ctx);
  if (!mask) return;
  const cover = new THREE.MeshStandardMaterial({
    color: SNOW,
    roughness: 0.85,
    transparent: true,
    alphaMap: mask,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  picture(ctx, "snow.jpg", cover, [1 / 3, 1 / 3], "#eef3fa");
  const g2 = geo.clone();
  // The mask spans the deck: its own uv channel, 0 to 1 over the terrace.
  const pos = g2.attributes.position,
    uv1 = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv1[i * 2] = (pos.getX(i) - D.minX) / (D.maxX - D.minX);
    uv1[i * 2 + 1] = 1 - (pos.getZ(i) - D.minZ) / (D.maxZ - D.minZ);
  }
  g2.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
  mask.channel = 1;
  const snow = new THREE.Mesh(g2, cover);
  snow.position.y = 0.006;
  snow.receiveShadow = true;
  snow.renderOrder = 1;
  w.scene.add(snow);
}
// Where the snow lies on the terrace: white all over, rubbed away along the paths (from the bathhouse door down the middle, and
// out to each spring's steps and round its rim), thicker in the corners and round the boulders.
function snowMask(ctx) {
  if (typeof document === "undefined") return null;
  const D = ONSEN.deck,
    W = 512,
    H = Math.round((W * (D.maxZ - D.minZ)) / (D.maxX - D.minX)),
    c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d"),
    rand = rngOf(77),
    px = (wx) => ((wx - D.minX) / (D.maxX - D.minX)) * W,
    pz = (wz) => ((wz - D.minZ) / (D.maxZ - D.minZ)) * H,
    k = W / (D.maxX - D.minX);
  x.fillStyle = "rgb(70,70,70)";
  x.fillRect(0, 0, W, H);
  // Soft blobs of deeper snow.
  for (let i = 0; i < 160; i++) {
    const cx = rand() * W,
      cy = rand() * H,
      r = (0.6 + rand() * 1.8) * k;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Deep at the edges.
  const edge = 1.6 * k;
  for (const [x0, y0, x1, y1] of [
    [0, 0, edge, 0],
    [W, 0, W - edge, 0],
    [0, H, 0, H - edge],
  ]) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
  // Round the boulders, drifted.
  for (const b of BOULDERS) {
    const cx = px(b.x),
      cy = pz(b.z),
      r = (b.r + 0.9) * k;
    const g = x.createRadialGradient(cx, cy, b.r * k * 0.8, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // The trodden paths: dark (bare, icy stone).
  x.globalCompositeOperation = "destination-out";
  x.lineCap = "round";
  x.lineJoin = "round";
  const path = (pts, width, alpha) => {
    x.strokeStyle = "rgba(0,0,0," + alpha + ")";
    x.lineWidth = width * k;
    x.beginPath();
    pts.forEach((p, i) => (i ? x.lineTo(px(p.x), pz(p.z)) : x.moveTo(px(p.x), pz(p.z))));
    x.stroke();
  };
  const door = { x: 0.6, z: D.minZ };
  path([door, { x: 0.6, z: -8 }, { x: 0.4, z: 4 }, { x: 0, z: 11 }], 2.2, 0.75);
  path(
    [
      { x: -12, z: -11 },
      { x: 12, z: -11 },
    ],
    1.6,
    0.6,
  );
  for (const s of SPRINGS) {
    const steps = springSteps(s).deck;
    path([{ x: 0.6, z: Math.max(-11, Math.min(6, steps.z)) }, steps], 1.4, 0.7);
    const ring = outline(s, 1 + 0.55 / s.r, 40);
    path([...ring, ring[0]], 1.1, 0.55);
  }
  x.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  ctx.w.textures.push(t);
  return t;
}

// ---- the springs --------------------------------------------------------------------------------------------------------

// Each spring's basin: rough rock walls going down from its edge to a sandy floor, the floor's tiles of pale stone under the water.
function basins(ctx) {
  const { w } = ctx,
    walls = [],
    floors = [];
  for (const s of SPRINGS) {
    const n = 64,
      rings = [
        [1.0, 0.02],
        [0.98, -0.3],
        [0.9, -0.75],
        [0.8, FLOOR_Y],
      ],
      pos = [],
      uv = [],
      idx = [];
    for (let j = 0; j < rings.length; j++)
      for (let i = 0; i <= n; i++) {
        const th = (i / n) * TAU,
          wob = j > 0 && j < rings.length - 1 ? 1 + Math.sin(th * 7 + j * 2 + s.id) * 0.03 : 1,
          p = springPoint(s, th, rings[j][0] * wob);
        pos.push(p.x, rings[j][1], p.z);
        uv.push((i / n) * s.r * TAU * 0.5, rings[j][1]);
      }
    for (let j = 0; j < rings.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i,
          b = a + n + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    walls.push(g);
    // The floor.
    const shape = new THREE.Shape(),
      pts = outline(s, 0.8, 48);
    shape.moveTo(pts[0].x, -pts[0].z);
    for (const p of pts.slice(1)) shape.lineTo(p.x, -p.z);
    const f = new THREE.ShapeGeometry(shape);
    f.rotateX(-Math.PI / 2);
    f.translate(0, FLOOR_Y, 0);
    floors.push(f);
  }
  const wall = new THREE.Mesh(mergeGeos(walls, ["position", "normal", "uv"]), ctx.rock);
  wall.material.side = THREE.DoubleSide;
  wall.receiveShadow = true;
  w.scene.add(wall);
  const floor = new THREE.Mesh(mergeGeos(floors, ["position", "normal", "uv"]), ctx.floor);
  floor.receiveShadow = true;
  w.scene.add(floor);
}

// The water: one mesh for the four springs, a shader of its own. Milky turquoise (the minerals), darker and clearer toward the
// middle, ripples from the spout and the bathers, the sky's light glancing off it, and a warm glow from below at dusk. The game's
// water uniforms drive it as they drive a pool (cloudy, brown, yellow, dark in a blackout).
function water(ctx) {
  const { w } = ctx,
    look = w.look.water,
    parts = [];
  for (const s of SPRINGS) {
    const n = 64,
      rings = 10,
      pos = [],
      rho = [],
      idx = [];
    pos.push(s.x, 0, s.z);
    rho.push(0, s.id);
    for (let j = 1; j <= rings; j++)
      for (let i = 0; i < n; i++) {
        const r = j / rings,
          p = springPoint(s, (i / n) * TAU, r * 0.998);
        pos.push(p.x, 0, p.z);
        rho.push(r, s.id);
      }
    for (let i = 0; i < n; i++) idx.push(0, 1 + ((i + 1) % n), 1 + i);
    for (let j = 1; j < rings; j++)
      for (let i = 0; i < n; i++) {
        const a = 1 + (j - 1) * n + i,
          b = 1 + (j - 1) * n + ((i + 1) % n),
          c = a + n,
          d = b + n;
        idx.push(a, b, c, b, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSpring", new THREE.Float32BufferAttribute(rho, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(g);
  }
  const geo = mergeGeos(parts, ["position", "normal", "aSpring"]);
  w.water = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDirty: { value: 0 },
        uBrown: { value: 0 },
        uYellow: { value: 0 },
        uLight: { value: 1 },
        uSun: { value: new THREE.Vector3(-0.35, 0.9, 0.3) },
        uShallow: { value: new THREE.Vector3(...look.shallow) },
        uDeep: { value: new THREE.Vector3(...look.deep) },
        uSky: { value: new THREE.Vector3(...(look.sky || [0.8, 0.9, 1])) },
        uGlint: { value: new THREE.Vector3(...(look.glint || [1, 0.9, 0.75])) },
        uGlow: { value: look.glow || 0 },
        uClarity: { value: look.clarity || 0 },
        uSpout: { value: new THREE.Vector2(SPOUT.x, SPOUT.z) },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    }),
  );
  w.water.position.y = ONSEN_WATER_Y;
  w.water.renderOrder = 2;
  w.water.frustumCulled = false;
  w.scene.add(w.water);
  w.poolLamps = null;
}
// Where the bamboo spout's water falls in (spring 3).
const SPOUT = (() => {
  const s = SPRINGS[2],
    p = springPoint(s, 0.15, 0.82);
  return { x: p.x, z: p.z };
})();
const WATER_VERTEX = `
attribute vec2 aSpring;
uniform float uTime;
varying vec3 vWorld;
varying vec2 vSpring;
void main() {
  vec3 p = position;
  p.y += sin(p.x * 2.1 + uTime * 0.9) * cos(p.z * 1.7 + uTime * 0.7) * 0.012 * aSpring.x;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vSpring = aSpring;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const WATER_FRAGMENT = `
uniform float uTime;
uniform float uDirty;
uniform float uBrown;
uniform float uYellow;
uniform float uLight;
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uGlint;
uniform float uGlow;
uniform float uClarity;
uniform vec2 uSpout;
varying vec3 vWorld;
varying vec2 vSpring;
void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  float r = vSpring.x;
  // Slow swells, and rings spreading from where the spout pours in.
  float sd = length(p - uSpout);
  float ring = sin(sd * 9.0 - t * 4.0) * exp(-sd * 0.9) * 0.08;
  float gx = cos(p.x * 2.3 + p.y * 0.8 + t * 0.5) * 0.04 + cos(p.x * 5.1 - p.y * 2.0 + t * 1.1) * 0.015 + ring * (p.x - uSpout.x) / (sd + 0.1);
  float gz = sin(p.y * 2.0 + p.x * 0.6 + t * 0.6) * 0.035 + cos(p.y * 4.3 + p.x * 1.4 - t) * 0.012 + ring * (p.y - uSpout.y) / (sd + 0.1);
  vec3 N = normalize(vec3(-gx * 4.0, 1.0, -gz * 4.0));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float deep = smoothstep(0.15, 0.85, 1.0 - r);
  vec3 color = mix(uShallow, uDeep, deep * 0.8);
  // The milky minerals: a soft pale cloud that drifts.
  float cloud = 0.5 + 0.5 * sin(p.x * 1.3 + t * 0.15) * sin(p.y * 1.1 - t * 0.12);
  color = mix(color, vec3(0.78, 0.92, 0.9), cloud * 0.18);
  // Foamy at the rim where the water laps the stones.
  float lap = smoothstep(0.86, 1.0, r) * (0.55 + 0.45 * sin(atan(p.y, p.x) * 23.0 + t * 1.3 + vSpring.y * 2.0));
  color = mix(color, vec3(0.40, 0.61, 0.24), uDirty);
  color = mix(color, vec3(0.38, 0.20, 0.07), uBrown * 0.88);
  color = mix(color, vec3(0.93, 0.82, 0.18), uYellow * 0.7);
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 160.0) * 1.2;
  float clean = 1.0 - uBrown * 0.8;
  color += vec3(0.92, 1.0, 1.0) * lap * 0.25 * clean * uLight;
  color += uGlint * glint * (1.0 - uBrown) * uLight;
  color = mix(color, uSky * uLight, fres * 0.35);
  // The warmth: a glow from the depths at the blue hour.
  color += vec3(0.25, 0.75, 0.8) * uGlow * 0.22 * deep;
  color *= mix(0.22, 1.0, uLight);
  float clear = uClarity * (1.0 - max(max(uDirty, uBrown), uYellow));
  float alpha = (0.86 + fres * 0.12 + lap * 0.1 + uDirty * 0.1) * (1.0 - clear * 0.3);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.97));
}`;

// The flat rim stones round every spring (walkable), a few of them capped with snow, and the steps: wide flat stones going down
// into the water.
function rimStones(ctx) {
  const { w, rand } = ctx,
    parts = [],
    grey = new THREE.Color(ROCK),
    snow = new THREE.Color(SNOW);
  for (const s of SPRINGS) {
    const steps = springSteps(s);
    const around = Math.round((s.r * TAU) / 0.55);
    for (let i = 0; i < around; i++) {
      const th = (i / around) * TAU + rand() * 0.05,
        out = 0.32 + rand() * 0.22,
        p = springPoint(s, th, 1 + out / s.r),
        size = 0.36 + rand() * 0.18;
      const g = new THREE.SphereGeometry(size, 10, 6),
        pos = g.attributes.position,
        lump = rand() * 10;
      for (let k = 0; k < pos.count; k++) {
        const vx = pos.getX(k),
          vz = pos.getZ(k),
          j = 0.9 + 0.1 * Math.sin(vx * 9 + lump) * Math.cos(vz * 7 + lump);
        pos.setXYZ(k, vx * j * 1.25, pos.getY(k) * 0.24, vz * j);
      }
      g.computeVertexNormals();
      const tint = grey.clone().multiplyScalar(1.05 + rand() * 0.45),
        capped = rand() < 0.3;
      paint(g, (x, y) => (capped && y > size * 0.14 ? snow : tint));
      parts.push(placed(g, { at: [p.x, 0.02, p.z], rot: [0, rand() * TAU, 0] }));
      g.dispose();
    }
    // The steps: two wide flat stones, one on the rim and one a step down in the water.
    for (const [r, y] of [
      [1 + 0.15 / s.r, 0.03],
      [1 - 0.35 / s.r, -0.42],
    ]) {
      const p = springPoint(s, s.entry, r),
        g = new THREE.CylinderGeometry(0.62, 0.68, 0.16, 9);
      paint(g, () => grey.clone().multiplyScalar(0.9));
      parts.push(placed(g, { at: [p.x, y, p.z], rot: [0, steps.angle, 0], scale: [1, 1, 0.8] }));
      g.dispose();
    }
  }
  const m = new THREE.Mesh(mergeGeos(parts, ["position", "normal", "color", "uv"]), ctx.slabs);
  m.castShadow = m.receiveShadow = true;
  w.scene.add(m);
}

// The boulders (onsen-plan.mjs BOULDERS, which the walks go round): big lumps of dark rock, their tops under a cap of snow.
function boulders(ctx) {
  const { w, rand } = ctx,
    parts = [],
    snow = new THREE.Color(SNOW);
  const lump = (x, z, size, squash = 0.8, cap = 0.45, y = -0.1) => {
    const g = new THREE.IcosahedronGeometry(size, 2),
      pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const vx = pos.getX(k),
        vy = pos.getY(k),
        vz = pos.getZ(k),
        j = 0.82 + 0.18 * Math.sin(vx * 5.3 + vz * 3.1) * Math.cos(vy * 4.7) + rand() * 0.08;
      pos.setXYZ(k, vx * j, vy * j * squash, vz * j);
    }
    g.computeVertexNormals();
    const rock = new THREE.Color(rand() < 0.5 ? ROCK : ROCK_DARK).multiplyScalar(0.85 + rand() * 0.3);
    const n = g.attributes.normal;
    paint(g, (vx, vy, vz, i) => (vy > size * squash * (1 - cap) && n.getY(i) > 0.35 ? snow : rock));
    parts.push(placed(g, { at: [x, y, z], rot: [0, rand() * TAU, 0] }));
    g.dispose();
  };
  for (const b of BOULDERS) lump(b.x, b.z, b.r * 1.05, 0.8);
  // More out in the snow beyond the terrace, and round the forest's edge.
  const D = ONSEN.deck;
  for (let i = 0; i < 26; i++) {
    const side = i % 3,
      t = rand();
    const x =
        side === 0
          ? D.maxX + 2 + rand() * 6
          : side === 1
            ? D.minX + t * (D.maxX - D.minX)
            : D.minX - 2 - rand() * 3,
      z =
        side === 0
          ? D.minZ + t * (D.maxZ - D.minZ)
          : side === 1
            ? D.maxZ + 2 + rand() * 6
            : D.minZ + t * 12 + 14;
    lump(x, z, 0.6 + rand() * 1.1, 0.7, 0.55);
  }
  const m = new THREE.Mesh(mergeGeos(parts, ["position", "normal", "color", "uv"]), ctx.stones);
  m.castShadow = m.receiveShadow = true;
  w.scene.add(m);
}

// ---- the buildings and the lights ---------------------------------------------------------------------------------------

// The bathhouse at the left end (its door onto the terrace), its windows glowing warm, a 湯 curtain in the door, a lamp over it.
function bathhouse(ctx) {
  const { w, live } = ctx,
    B = ONSEN.bathhouse;
  const house = propModel("bathhouse", { size: 9.6 }, (g) => {
    w.box(B.hx * 2, 3.2, B.hz * 2, 0x6b4a32, 0, 1.6, 0, 0.05, g);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(B.hx * 1.5, 1.6, 4, 1),
      new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6 }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.55);
    roof.position.y = 4;
    g.add(roof);
  });
  house.position.set(B.x, 0, B.z - 0.3);
  w.scene.add(house);
  // The curtain in the door.
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2c3c78, roughness: 0.9, side: THREE.DoubleSide });
  picture(ctx, "noren.jpg", cloth, [1, 1], "#2c3c78");
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1, 6, 1), cloth);
  noren.position.set(0.62, 1.95, ONSEN.deck.minZ - 0.2);
  live.add(noren);
  ctx.noren = noren;
  // Warm windows and a lamp at the door.
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.85 });
  for (const x of [-3.0, -1.6, 2.6, 3.9]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), glow);
    win.position.set(x, 1.7, ONSEN.deck.minZ - 0.12);
    w.scene.add(win);
  }
  const lamp = new THREE.PointLight(0xffb066, 6, 9, 1.6);
  lamp.position.set(0.6, 2.7, ONSEN.deck.minZ + 0.6);
  w.scene.add(lamp);
  // (The bathhouse's lights are electric: a blackout puts them out. The lanterns burn on.)
  w.dimmers.push((k) => {
    const on = Math.max(0.05, Math.min(1, k));
    lamp.intensity = 6 * on;
    glow.color.setRGB(1 * on, 0.76 * on, 0.48 * on);
  });
}
// The stone lanterns (the venue's furniture), each with a warm flame in its fire box and a little pool of light round it.
function lanterns(ctx) {
  const { w, venue, live } = ctx;
  const flame = new THREE.MeshBasicMaterial({ color: 0xffb35a });
  ctx.flames = [];
  let lights = 0;
  for (const f of venue.furniture.filter((f) => f.kind === "lantern")) {
    const g = propModel("stone-lantern", { height: 1.6 }, (s) => {
      w.cyl(0.18, 0.28, 0.7, 0x8e8c86, 0, 0.35, 0, s);
      w.box(0.5, 0.36, 0.5, 0x9a978f, 0, 0.84, 0, 0.04, s);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.36, 4),
        new THREE.MeshStandardMaterial({ color: 0x8a8780 }),
      );
      cap.rotation.y = Math.PI / 4;
      cap.position.y = 1.2;
      s.add(cap);
      w.cyl(0.42, 0.46, 0.08, 0xf4f8ff, 0, 1.1, 0, s);
    });
    g.position.set(f.x, 0, f.z);
    w.scene.add(g);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), flame);
    fire.position.set(f.x, 0.84, f.z);
    live.add(fire);
    ctx.flames.push(fire);
    if (lights++ < 3) {
      const light = new THREE.PointLight(0xffa25a, 3.2, 6.5, 1.8);
      light.position.set(f.x, 1.0, f.z);
      w.scene.add(light);
    }
  }
}
// The bamboo spout at the far spring: a pipe of bamboo on a stone, pouring a thread of hot water into it, splashing.
function spout(ctx) {
  const { w, venue, live } = ctx,
    f = venue.furniture.find((q) => q.kind === "bamboo-spout");
  if (!f) return;
  const angle = Math.atan2(SPOUT.z - f.z, SPOUT.x - f.x);
  const g = propModel("bamboo-spout", { size: 1.2 }, (s) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x9fa84a, roughness: 0.5 }),
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.y = 0.38;
    s.add(pipe);
    w.box(0.5, 0.3, 0.4, 0x77736c, -0.4, 0.15, 0, 0.06, s);
  });
  // (The model pours from its +x end: turned to face the spring.)
  g.position.set(f.x, 0, f.z);
  g.rotation.y = -angle;
  w.scene.add(g);
  const mouth = { x: f.x + Math.cos(angle) * 0.6, z: f.z + Math.sin(angle) * 0.6 };
  // The falling thread of water: a thin bent ribbon from the mouth down to the surface.
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(mouth.x, 0.38, mouth.z),
    new THREE.Vector3(mouth.x + Math.cos(angle) * 0.5, 0.36, mouth.z + Math.sin(angle) * 0.5),
    new THREE.Vector3(SPOUT.x, ONSEN_WATER_Y, SPOUT.z),
  );
  const stream = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, 0.025, 6),
    new THREE.MeshStandardMaterial({
      color: 0xdff7f4,
      transparent: true,
      opacity: 0.65,
      roughness: 0.05,
      emissive: 0x28403f,
    }),
  );
  live.add(stream);
  ctx.stream = stream;
}

// ---- the forest and the mountains ----------------------------------------------------------------------------------------

// Snowy cedars round the far side and the right end of the terrace (where the monkeys come from), a few in front of the left end
// past the bathhouse, and a dark wall of them further out; none on the near side, where the camera looks from.
function forest(ctx) {
  const { w, rand } = ctx,
    D = ONSEN.deck,
    spots = [];
  for (let z = D.minZ - 4; z < D.maxZ + 8; z += 2.4 + rand() * 1.4)
    spots.push([D.maxX + 3 + rand() * 4, z, 0.9 + rand() * 0.5]);
  for (let x = D.minX - 3; x < D.maxX + 4; x += 2.6 + rand() * 1.5)
    spots.push([x, D.maxZ + 3 + rand() * 4, 0.9 + rand() * 0.5]);
  for (let z = D.minZ - 6; z < D.minZ - 3; z += 3)
    for (const x of [-11, -15, 9, 14]) spots.push([x + rand(), z, 0.8]);
  for (const [x, z, k] of spots) {
    const g = propModel("snowy-cedar", { height: 6 * k }, (s) => standInCedar(w, s, 6 * k));
    g.position.set(x, -0.05, z);
    g.rotation.y = rand() * TAU;
    w.scene.add(g);
  }
  // Further out: a dark ring of simple snow-dusted firs (cheap cones, one mesh).
  const parts = [],
    green = new THREE.Color(CEDAR),
    snow = new THREE.Color(0xe6eef8);
  for (let i = 0; i < 160; i++) {
    const a = rand() * TAU,
      r = 30 + rand() * 30,
      x = Math.cos(a) * r * 1.2 + 4,
      z = Math.sin(a) * r;
    if (x < -24 && Math.abs(z) < 30) continue; // (behind the camera)
    const h = 6 + rand() * 7;
    for (let tier = 0; tier < 3; tier++) {
      const g = new THREE.ConeGeometry(h * (0.32 - tier * 0.07), h * 0.45, 7);
      paint(g, (vx, vy) => (vy > h * 0.08 ? snow : green));
      parts.push(placed(g, { at: [x, h * (0.3 + tier * 0.22), z] }));
      g.dispose();
    }
  }
  const m = new THREE.Mesh(
    mergeGeos(parts, ["position", "normal", "color"]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
  );
  w.scene.add(m);
}
function standInCedar(w, s, h) {
  const mat = new THREE.MeshStandardMaterial({ color: CEDAR, roughness: 0.9, flatShading: true }),
    cap = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.9 });
  for (let tier = 0; tier < 3; tier++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * (0.26 - tier * 0.06), h * 0.42, 8), mat);
    cone.position.y = h * (0.32 + tier * 0.2);
    s.add(cone);
    const top = new THREE.Mesh(new THREE.ConeGeometry(h * (0.2 - tier * 0.05), h * 0.16, 8), cap);
    top.position.y = h * (0.47 + tier * 0.2);
    s.add(top);
  }
}
// The painted mountains all round (mountains.jpg wraps: its misty valley at about half its height, set at eye level), unfogged.
function mountains(ctx) {
  const { w } = ctx;
  const pano = new THREE.ShaderMaterial({
    uniforms: { map: { value: null } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0); }`,
  });
  pano.visible = false;
  roofPicture(
    w,
    "mountains.jpg",
    (t, real) => {
      pano.uniforms.map.value = t;
      pano.visible = real;
    },
    { dir: "onsen", wrap: THREE.ClampToEdgeWrapping },
  );
  const R = 240,
    H = 240;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), pano);
  m.position.y = H / 2 - 0.55 * H;
  m.rotation.y = Math.PI * 0.5;
  m.renderOrder = -50;
  m.frustumCulled = false;
  w.scene.add(m);
}

// ---- the dressing and the stations ---------------------------------------------------------------------------------------

function dressing(ctx) {
  const { w, venue } = ctx;
  for (const f of venue.furniture) {
    if (f.kind === "bench") {
      const g = propModel("onsen-bench", { size: 1.6 }, (s) => {
        w.box(1.6, 0.08, 0.5, 0x8a5a36, 0, 0.42, 0, 0.02, s);
        for (const x of [-0.65, 0.65]) w.box(0.1, 0.4, 0.4, 0x6b4a32, x, 0.2, 0, 0.02, s);
      });
      g.position.set(f.x, 0, f.z);
      g.rotation.y = f.angle || 0;
      w.scene.add(g);
    }
    if (f.kind === "towel-rack") {
      const g = propModel("towel-cart", { height: 1.2 }, (s) =>
        w.box(1.2, 1.0, 0.6, 0xc8b49a, 0, 0.5, 0, 0.04, s),
      );
      g.position.set(f.x, 0, f.z);
      g.rotation.y = Math.PI / 2;
      w.scene.add(g);
    }
  }
  station(w, "chlorine", venue.stations.chlorine, 0x8fb6c4, "MINERALS", Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xcfe0e8, "EYE CARE", Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  treatsTable(w, venue.fixtures.treats);
  // Wooden buckets and the 湯 sign by the bathhouse; a stack of buckets by each spring's steps.
  const sign = propModel("yu-sign", { height: 1.8 }, (s) => {
    w.box(0.08, 1.8, 0.08, 0x6b4a32, 0, 0.9, 0, 0.01, s);
    w.box(0.5, 0.6, 0.05, 0xd9c19a, 0, 0.95, 0.05, 0.01, s);
  });
  sign.position.set(-2.6, 0, ONSEN.deck.minZ + 1.2);
  w.scene.add(sign);
  for (const s of SPRINGS) {
    const steps = springSteps(s),
      side = { x: Math.cos(s.entry + Math.PI / 2), z: Math.sin(s.entry + Math.PI / 2) };
    const b = propModel("onsen-bucket", { height: 0.25 }, (q) =>
      w.cyl(0.16, 0.13, 0.25, 0xb0844e, 0, 0.125, 0, q),
    );
    b.position.set(steps.deck.x + side.x * 0.95, 0.02, steps.deck.z + side.z * 0.95);
    w.scene.add(b);
  }
}

// ---- the steam and the snow ---------------------------------------------------------------------------------------------

// Steam rolling off the hot water: soft puffs that rise from all over each spring, swell, drift with the breeze and fade, many at
// a time. One set of points, moved on the GPU.
function steam(ctx) {
  const { w, live, rand } = ctx,
    per = 46,
    pos = [],
    seed = [];
  for (const s of SPRINGS)
    for (let i = 0; i < per; i++) {
      const p = springPoint(s, rand() * TAU, Math.sqrt(rand()) * 0.9);
      pos.push(p.x, ONSEN_WATER_Y, p.z);
      seed.push(rand(), rand(), s.r);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 300 },
      uLight: { value: 1 },
      uColor: { value: new THREE.Color(0xf2f6fb) },
    },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        float life = 5.0 + aSeed.y * 3.0;
        float t = fract(uTime / life + aSeed.x);
        vec3 p = position;
        p.y += t * (1.8 + aSeed.y * 1.4);
        p.x += t * t * 1.4 + sin(uTime * 0.6 + aSeed.x * 20.0) * 0.25 * t;
        p.z += sin(uTime * 0.4 + aSeed.y * 30.0) * 0.4 * t;
        vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.45, 1.0, t)) * 0.42;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // (Close to the eye the puffs thin out, so a close look is not a fog.)
        vAlpha *= smoothstep(2.5, 7.0, -mv.z);
        gl_PointSize = min(220.0, (1.0 + t * 2.8) * uScale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uLight;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(uColor * mix(0.35, 1.0, uLight), a * a * vAlpha);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  live.add(points);
  ctx.steam = points;
}
// Snow falling over the terrace: flakes drifting down and sideways, wrapping round, on the GPU.
function snowfall(ctx) {
  const { w, live, rand } = ctx,
    n = 1800,
    pos = [],
    seed = [];
  for (let i = 0; i < n; i++) {
    pos.push(-22 + rand() * 46, rand() * 14, -24 + rand() * 46);
    seed.push(rand(), rand());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `
      attribute vec2 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        float fall = 0.7 + aSeed.x * 0.6;
        p.y = mod(p.y - uTime * fall, 14.0) - 0.2;
        p.x += sin(uTime * (0.4 + aSeed.y) + aSeed.x * 40.0) * 0.6 + uTime * 0.25;
        p.x = mod(p.x + 22.0, 46.0) - 22.0;
        p.z += cos(uTime * (0.3 + aSeed.x) + aSeed.y * 50.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.05 + aSeed.y * 0.05) * uScale / -mv.z;
        vA = 0.55 + aSeed.x * 0.4;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.15, d) * vA);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  live.add(points);
  ctx.snowfall = points;
  // The moving parts, every frame (the picture only).
  w.updaters.push((time, dt, world, sim) => {
    const h = world.renderer?.domElement?.height || 900,
      scale = h * 0.55,
      light = world.incidentLight ?? 1;
    ctx.steam.material.uniforms.uTime.value = time;
    ctx.steam.material.uniforms.uScale.value = scale;
    ctx.steam.material.uniforms.uLight.value = light;
    points.material.uniforms.uTime.value = time;
    points.material.uniforms.uScale.value = scale;
    for (const [i, f] of (ctx.flames || []).entries())
      f.scale.setScalar(1 + Math.sin(time * 11 + i * 1.7) * 0.12 + Math.sin(time * 23 + i) * 0.06);
    if (ctx.noren) ctx.noren.rotation.x = Math.sin(time * 1.3) * 0.05;
    void sim;
  });
}

// ---- picking: the springs are the lanes -----------------------------------------------------------------------------------

// Each spring: an invisible disc to click (SPRING k), a highlight in its shape and a rim line for the guidance (scene.mjs drives
// them as `springHighlights` and `springRims`).
function pickVolumes(ctx) {
  const { w } = ctx;
  w.springHighlights = [];
  w.springRims = [];
  for (const s of SPRINGS) {
    const shape = new THREE.Shape(),
      pts = outline(s, 0.97, 48);
    shape.moveTo(pts[0].x, -pts[0].z);
    for (const p of pts.slice(1)) shape.lineTo(p.x, -p.z);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const pick = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    pick.position.y = ONSEN_WATER_Y + 0.03;
    pick.userData = { kind: "lane", lane: s.id };
    w.scene.add(pick);
    w.clickables.push(pick);
    const glow = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xffe58b, transparent: true, opacity: 0, depthWrite: false }),
    );
    glow.position.y = ONSEN_WATER_Y + 0.02;
    glow.renderOrder = 3;
    w.scene.add(glow);
    w.springHighlights.push(glow);
    const rim = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        outline(s, 1.0, 64).map((p) => new THREE.Vector3(p.x, 0.05, p.z)),
      ),
      new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
    );
    w.scene.add(rim);
    w.springRims.push(rim);
  }
}
