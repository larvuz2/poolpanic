// The Wave Pool (17 October 2026): a retro-tropical surf park at the height of the day. A beach of golden sand runs down into the
// pool along the near side; the water is clear turquoise over the sand, a mosaic of aqua tiles further out and deep blue against
// the wave house, which fills the far side: a white stucco surf temple with five arched wave chambers at the waterline (the machine
// pushes every wave out of them, and they surge as it does), a terrace with a railing, a great painted mural of a curling wave
// above it, the WAVE POOL sign on its roof between two red-and-white lighthouse towers whose beacons turn and flash when a monster
// wave is coming, flags, and an LED board that says what the machine is doing. The waves themselves are the simulation's
// (waves.mjs): the water's surface is moved, every frame, by the crests the simulation has in the pool, so what is drawn is what
// hits the bathers; it shoals, steepens, breaks into white water and runs up the sand, and the bathers ride it (wave-view.mjs).
//
// Round it: a deck of cream coral stone, the lifeguard tower on the sand (a Tripo model with a life ring), beach umbrellas and deck
// chairs, towels, a sand castle and beach balls, the tube hut by the beach corner (its tubes are the ones the coach can hand out),
// the Surf Shack with surfboards (the dog treats are its), a surfboard rack by the gate, white stucco walls with coral caps and a
// surf gate, palms, and outside the walls the tropics. Pictures and models generated for it are in assets/wave and assets/props.
//
// Nothing here moves the simulation.
import { THREE, COLORS } from "./kit.mjs";
import { WAVE, depthAt, floorAt, waveBoard } from "../waves.mjs";
import { grassTexture, plasterTexture } from "./textures.mjs";
import { rngOf, garland, wind } from "./geom.mjs";
import { swayPalm, finishPalms } from "./lagoon.mjs";
import {
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
import { tubeObject } from "./river-view.mjs";
import { propModel } from "./prop-models.mjs";
import { syncLostTubes } from "./wave-view.mjs";

const TAU = Math.PI * 2;
const W = WAVE.water; // the water's surface at rest
const SAND_EDGE = -10.6; // where the sand meets the deck on the near side
const FAR = WAVE.halfX + 0.3; // the wave house's wall above the water
const ENDZ = WAVE.halfZ; // the pool's ends
const CORAL = 0xe2574a,
  CREAM = 0xfff1d8,
  STUCCO = 0xfaf3e6,
  TEAL = 0x1f9aa0,
  SEAFOAM = 0x8fd8c8,
  TEAK = 0xb57a43,
  SUN = 0xffc93c;
// The five wave chambers along the far wall (their middles along z) and how wide each is.
export const CHAMBERS = [-7.2, -3.6, 0, 3.6, 7.2];
const CHAMBER_W = 2.5;

export function buildWave(w, venue) {
  const live = new THREE.Group();
  live.name = "wave-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, live, rand: rngOf(97), fronds: [] };
  w.poolUniforms = { uTime: { value: 0 }, uCaustic: { value: 1 } };
  ground(ctx);
  deck(ctx);
  bed(ctx);
  basinWalls(ctx);
  water(ctx);
  waveHouse(ctx);
  walls(ctx);
  gate(ctx);
  beach(ctx);
  tubeHut(ctx);
  surfShack(ctx);
  surfRack(ctx);
  for (const f of venue.furniture) {
    if (f.kind === "palm") swayPalm(ctx, f.x, f.z, 4.9, f.x * 1.7 + f.z);
    if (f.kind === "umbrella") umbrella(ctx, f.x, f.z);
    if (f.kind === "deck-chair") deckChair(ctx, f.x, f.z, f.angle || 0);
    if (f.kind === "lifeguard-tower") lifeguardTower(ctx, f.x, f.z);
  }
  station(w, "chlorine", venue.stations.chlorine, COLORS.yellow, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xddf3d7, "EYE CARE", Math.PI);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  kioskTreats(w, venue.fixtures.treats);
  outside(ctx);
  finishPalms(ctx);
  pickVolume(ctx);
  // Live: the lost tubes riding in, and spray along a crest the moment it breaks (app.mjs calls `waveBreak` on the event).
  w.lostTubes = new Map();
  w.updaters.push((time, dt, world, sim) => syncLostTubes(w, sim, time));
  w.waveBreak = (e) => {
    const big = e.kind === "monster" ? 2.2 : e.kind === "big" ? 1.5 : 1;
    for (let z = -ENDZ + 0.8; z <= ENDZ - 0.8; z += 1.5 / big)
      w.splash(
        e.x - 0.25,
        W + (e.a || 0.3) * 0.8,
        z + (Math.random() - 0.5) * 0.8,
        Math.round(2 * big),
        true,
        0xf0ffff,
      );
  };
}

// ---- pictures ------------------------------------------------------------------------------------------------------------

// A picture from assets/wave: `apply(texture)` is called at once with a plain stand-in of `color`, and again with a fresh texture of
// the picture once it has loaded (a fresh one: an uploaded texture keeps its first size), so the scene never waits on it and a
// headless build keeps the stand-in. One request per file.
const pictures = new Map();
function photo(w, file, color, apply, { repeat = [1, 1], wrap = THREE.RepeatWrapping } = {}) {
  const dress = (t) => {
    t.wrapS = t.wrapT = wrap;
    t.repeat.set(...repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    w.textures.push(t);
    return t;
  };
  apply(dress(standIn(color)));
  if (typeof Image !== "function") return;
  if (!pictures.has(file))
    pictures.set(
      file,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = new URL("../assets/wave/" + file, import.meta.url).href;
      }).catch((error) => {
        console.warn("The picture " + file + " did not load; its stand-in stays.", error);
        pictures.delete(file);
        return null;
      }),
    );
  const scene = w.scene;
  pictures.get(file).then((image) => {
    if (!image || w.scene !== scene) return; // (a world built again since: not for it)
    const t = new THREE.Texture(image);
    t.needsUpdate = true;
    apply(dress(t));
  });
}
// A flat stand-in texture of one colour (until the picture comes).
function standIn(color) {
  const c = new THREE.Color(color);
  const t = new THREE.DataTexture(
    new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]),
    1,
    1,
  );
  t.needsUpdate = true;
  return t;
}

// ---- ground, deck, sand and the basin ------------------------------------------------------------------------------------

// The tropics outside the walls: grass, with a hole where the room is.
function ground(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    tex = grassTexture({ base: "#5f9a45", seed: 9 });
  tex.repeat.set(1 / 3, 1 / 3);
  w.textures.push(tex);
  const shape = rect(-160, -160, 160, 160);
  shape.holes.push(rect(room.minX, room.minZ, room.maxX, room.maxZ));
  const m = flat(shape, new THREE.MeshStandardMaterial({ map: tex, color: 0xc8e2a0, roughness: 1 }));
  m.position.y = -0.03;
  w.scene.add(m);
}
// A rectangle as a shape in the ground plane (the shape's y is the world's -z: `flat` turns it down).
function rect(x0, z0, x1, z1) {
  const s = new THREE.Shape();
  s.moveTo(x0, -z0);
  s.lineTo(x1, -z0);
  s.lineTo(x1, -z1);
  s.lineTo(x0, -z1);
  s.closePath();
  return s;
}
function flat(shape, material) {
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

// The deck: cream coral stone (assets/wave/coral-stone.jpg) everywhere but the sand and the water.
function deck(ctx) {
  const { w, venue } = ctx,
    room = venue.room;
  const material = new THREE.MeshStandardMaterial({ roughness: 0.86, color: 0xffffff });
  photo(w, "coral-stone.jpg", "#ecdcbf", (t) => (material.map = t), { repeat: [1 / 2.4, 1 / 2.0] });
  const shape = rect(room.minX, room.minZ, room.maxX, room.maxZ);
  shape.holes.push(rect(SAND_EDGE, -ENDZ - 0.35, FAR, ENDZ + 0.35));
  const top = flat(shape, material);
  top.position.y = -0.012;
  w.scene.add(top);
  w.deckTop = top;
  // A teak boardwalk edge between the sand and the stone, and the coping round the pool's two ends.
  const teak = woodMaterial(w, "#b9824a", 21);
  w.box(0.42, 0.08, ENDZ * 2 + 0.7, teak, SAND_EDGE - 0.21, 0.03, 0, 0.02);
  for (const s of [-1, 1]) {
    w.box(FAR - SAND_EDGE, 0.1, 0.4, 0xf3ead8, (FAR + SAND_EDGE) / 2, 0.04, s * (ENDZ + 0.17), 0.04);
    // A coral line on the coping, a hint of the beach club's stripes.
    w.box(FAR + WAVE.halfX, 0.012, 0.06, CORAL, (FAR - WAVE.halfX) / 2, 0.095, s * (ENDZ + 0.02), 0);
  }
}

// The pool's bed and the beach in one: sand from the deck down under the water to a metre's depth, then aqua mosaic tiles
// (assets/wave/floor.jpg) to the deep end, the two blended along a wavy line; wet sand darker; caustics under the water.
function bed(ctx) {
  const { w } = ctx,
    x0 = SAND_EDGE,
    x1 = WAVE.halfX,
    z0 = -ENDZ - 0.35,
    z1 = ENDZ + 0.35;
  const xs = [];
  for (let x = x0; x < -WAVE.halfX - 0.01; x += 0.25) xs.push(x);
  for (let x = -WAVE.halfX; x < x1; x += 0.2) xs.push(x);
  xs.push(x1);
  const nz = 24,
    positions = [],
    uvs = [],
    index = [];
  for (const x of xs)
    for (let j = 0; j <= nz; j++) {
      const z = z0 + ((z1 - z0) * j) / nz;
      positions.push(x, floorAt(x), z);
      uvs.push(x, z);
    }
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j,
        b = a + nz + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    sand = { value: null };
  photo(w, "floor.jpg", "#bfe9e6", (t) => (material.map = t), { repeat: [1 / 1.9, 1 / 1.9] });
  photo(w, "sand.jpg", "#e2bf74", (t) => (sand.value = t));
  const u = w.poolUniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSand = sand;
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uCaustic = u.uCaustic;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBed;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvBed = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vBed;\nuniform sampler2D uSand;\nuniform float uTime;\nuniform float uCaustic;\n" +
          CAUSTIC,
      )
      .replace(
        "#include <map_fragment>",
        `vec4 tileC = texture2D(map, vMapUv);
        vec4 sandC = texture2D(uSand, vBed.xz * 0.36);
        float edge = vBed.x + sin(vBed.z * 1.3) * 0.22 + sin(vBed.z * 0.37 + 1.0) * 0.4;
        float k = smoothstep(-3.5, -2.6, edge);
        vec4 bedC = mix(sandC, tileC, k);
        float wet = 1.0 - smoothstep(${(W - 0.02).toFixed(3)}, ${(W + 0.12).toFixed(3)}, vBed.y);
        bedC.rgb *= mix(1.0, 0.8, wet * (1.0 - k));
        diffuseColor *= bedC;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float under = smoothstep(${(W - 0.05).toFixed(3)}, ${(W - 0.4).toFixed(3)}, vBed.y);
        totalEmissiveRadiance += vec3(0.55, 0.95, 0.95) * caustic(vBed.xz, uTime) * uCaustic * under * 0.55;`,
      );
  };
  material.customProgramCacheKey = () => "wave-bed";
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  w.scene.add(m);
}

const CAUSTIC = `
float causticLayer(vec2 p, float t) {
  float a = sin(p.x * 2.1 + sin(p.y * 1.3 + t * 0.8) * 1.4 + t * 0.6);
  float b = sin(p.y * 2.3 + sin(p.x * 1.7 - t * 0.7) * 1.3 - t * 0.5);
  return pow(max(0.0, 1.0 - abs(a + b) * 0.85), 6.0);
}
float caustic(vec2 p, float t) {
  return causticLayer(p * 1.25, t) * 0.75 + causticLayer(p * 2.2 + 3.1, t * 1.25) * 0.45;
}`;

// The basin's walls: the two ends (following the floor down from the coping) and the far wall below the wave house, tiled, with
// a teal-and-coral band at the waterline.
function basinWalls(ctx) {
  const { w } = ctx;
  const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.85, color: 0xe6fbff });
  photo(w, "floor.jpg", "#bfe9e6", (t) => (tileMat.map = t), { repeat: [1 / 1.9, 1 / 1.9] });
  // Ends: a strip from the coping down to the floor, all along the pool (and the sand).
  for (const s of [-1, 1]) {
    const positions = [],
      uvs = [],
      index = [];
    const xs = [];
    for (let x = SAND_EDGE; x <= WAVE.halfX + 0.001; x += 0.25) xs.push(Math.min(x, WAVE.halfX));
    xs.forEach((x, i) => {
      const y = floorAt(x);
      positions.push(x, 0.0, s * ENDZ, x, y - 0.02, s * ENDZ);
      uvs.push(x, 0, x, y);
      if (i) {
        const a = (i - 1) * 2;
        index.push(
          ...(s > 0 ? [a, a + 1, a + 2, a + 2, a + 1, a + 3] : [a, a + 2, a + 1, a + 2, a + 3, a + 1]),
        );
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, tileMat);
    m.receiveShadow = true;
    w.scene.add(m);
    // The waterline band: teal tiles with a coral stripe.
    w.box(WAVE.halfX * 2 + 0.3, 0.16, 0.02, TEAL, 0, W + 0.12, s * (ENDZ - 0.012), 0);
    w.box(WAVE.halfX * 2 + 0.3, 0.035, 0.022, CORAL, 0, W + 0.215, s * (ENDZ - 0.013), 0);
  }
}

// ---- the water -------------------------------------------------------------------------------------------------------------

// The surface: a fine grid over the whole basin and up the sand, moved in the vertex shader by the crests the simulation has in the
// pool (`uWaves`, up to eight: x, height, broken, foam), with the same profile as waves.mjs `waveProfile`, so a bather riding at
// `surfaceAt` sits on it. The colour follows the real depth over the floor (`floorAt`), clear over the sand; foam on breaking
// crests, white water behind them and a lacy line where the water meets the sand.
const MAX_WAVES = 8;
const GLSL_FLOOR = `
float depthAt(float x) {
  if (x <= ${(-WAVE.halfX).toFixed(3)}) return 0.0;
  if (x <= ${WAVE.shelf.toFixed(3)}) return (x + ${WAVE.halfX.toFixed(3)}) / ${(WAVE.shelf + WAVE.halfX).toFixed(3)} * ${WAVE.shelfDepth.toFixed(3)};
  return ${WAVE.shelfDepth.toFixed(3)} + (x - ${WAVE.shelf.toFixed(3)}) / ${(WAVE.halfX - WAVE.shelf).toFixed(3)} * ${(WAVE.deep - WAVE.shelfDepth).toFixed(3)};
}
float floorAt(float x) {
  if (x <= ${(-WAVE.halfX).toFixed(3)}) return min(0.0, ${W.toFixed(3)} + (${(-WAVE.halfX).toFixed(3)} - x) / ${(-WAVE.halfX - WAVE.sandTop).toFixed(3)} * ${(-W).toFixed(3)});
  return ${W.toFixed(3)} - depthAt(x);
}`;
const GLSL_WAVES = `
uniform vec4 uWaves[${MAX_WAVES}];
uniform float uCount;
uniform float uTime;
float profile(vec4 wv, float x) {
  float u = x - wv.x;
  float front = wv.z > 0.5 ? 0.32 : 0.55;
  float s = u < 0.0 ? exp(-(u / front) * (u / front)) : exp(-(u / 1.5) * (u / 1.5)) - 0.22 * exp(-((u - 2.4) / 1.1) * ((u - 2.4) / 1.1));
  return wv.y * s;
}
float ripple(vec2 p) {
  return sin(p.x * 1.9 + uTime * 1.3) * cos(p.y * 1.6 + uTime * 0.9) * 0.012
    + sin(p.x * 0.7 - p.y * 1.1 + uTime * 0.8) * 0.01
    + sin(p.y * 3.1 + p.x * 0.4 - uTime * 1.7) * 0.004;
}
float surface(vec2 p) {
  float h = ripple(p);
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (float(i) >= uCount) break;
    vec4 wv = uWaves[i];
    // (the crest bends a little along the pool: never straight as a ruler)
    h += profile(wv, p.x + 0.07 * sin(p.y * 0.42 + wv.x * 0.6));
  }
  return h;
}
// How white the water is at p: a breaking crest's face, the white water rolling behind it, a whitecap on a wave about to break.
float foamAt(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (float(i) >= uCount) break;
    vec4 wv = uWaves[i];
    float u = p.x + 0.07 * sin(p.y * 0.42 + wv.x * 0.6) - wv.x;
    if (wv.z > 0.5) {
      f += wv.w * exp(-((u + 0.05) / 0.35) * ((u + 0.05) / 0.35));
      f += wv.w * 0.75 * (u > 0.0 ? exp(-u / 1.4) : 0.0) * smoothstep(-0.2, 0.25, u);
      f += (1.0 - wv.w) * 0.35 * exp(-(u / 0.6) * (u / 0.6)) * step(0.02, wv.y);
    } else {
      float steep = clamp((wv.y / ${WAVE.show.toFixed(2)} / max(0.12, depthAt(wv.x)) - 0.36) * 9.0, 0.0, 1.0);
      f += steep * exp(-((u - 0.05) / 0.22) * ((u - 0.05) / 0.22));
    }
  }
  return f;
}`;
const WATER_VERTEX =
  GLSL_FLOOR +
  GLSL_WAVES +
  `
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFoam;
void main() {
  vec4 base = modelMatrix * vec4(position, 1.0);
  vec2 p = base.xz;
  float h = surface(p);
  float e = 0.09;
  float dx = (surface(p + vec2(e, 0.0)) - surface(p - vec2(e, 0.0))) / (2.0 * e);
  float dz = (surface(p + vec2(0.0, e)) - surface(p - vec2(0.0, e))) / (2.0 * e);
  vNormalW = normalize(vec3(-dx, 1.0, -dz));
  vFoam = foamAt(p);
  vec4 world = base;
  world.y += h;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const WATER_FRAGMENT =
  GLSL_FLOOR +
  CAUSTIC +
  `
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
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFoam;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  float depth = vWorld.y - floorAt(p.x);
  if (depth < -0.005) discard; // (under the sand: the shoreline is where the water meets it)
  // Small ripples on top of the swell's own normal.
  float gx = cos(p.x * 2.6 + t) * cos(p.y * 2.1 + t * 0.7) * 0.05 + cos(p.x * 5.1 + p.y * 1.7 - t * 1.9) * 0.018;
  float gz = -sin(p.x * 2.6 + t) * sin(p.y * 2.1 + t * 0.7) * 0.04 + cos(p.y * 4.7 - p.x * 1.3 + t * 1.6) * 0.017;
  vec3 N = normalize(vNormalW + vec3(-gx * 2.2, 0.0, -gz * 2.2));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float deep = smoothstep(0.05, 2.1, depth);
  // Over the sand the shallows are greener and brighter; over the tiles the blue deepens.
  float overSand = 1.0 - smoothstep(-3.4, -2.4, p.x);
  vec3 shallow = mix(uShallow, uShallow * vec3(1.02, 1.04, 0.86) + vec3(0.05, 0.04, 0.0), overSand);
  vec3 color = mix(shallow, uDeep, deep);
  // A wave's face is darker and bluer where the light shines through it.
  color = mix(color, color * vec3(0.7, 0.92, 1.05), clamp(-N.x * 1.8, 0.0, 0.5));
  color = mix(color, vec3(0.40, 0.61, 0.24), uDirty);
  color = mix(color, vec3(0.38, 0.20, 0.07), uBrown * 0.88);
  color = mix(color, vec3(0.93, 0.82, 0.18), uYellow * 0.7);
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 240.0) * 1.7;
  float sparkle = pow(max(0.0, sin(p.x * 3.3 + t * 1.1) * sin(p.y * 2.9 - t * 0.9)), 18.0) * 0.2;
  float lines = caustic(p * 0.9, t * 0.8);
  float clean = 1.0 - uBrown * 0.8;
  color += vec3(0.8, 1.0, 0.98) * lines * 0.1 * clean * uLight * (1.0 - deep * 0.6);
  color += uGlint * (glint + sparkle) * (1.0 - uBrown) * uLight;
  color = mix(color, uSky * uLight, fres * 0.28);
  // Foam: the crests' and the white water's, broken up by noise and drifting, and the lacy line on the sand.
  float n1 = vnoise(p * vec2(1.7, 2.6) + vec2(t * 0.35, t * 0.12));
  float n2 = vnoise(p * vec2(4.3, 5.9) - vec2(t * 0.6, 0.0));
  float lace = 1.0 - smoothstep(0.0, 0.07 + 0.05 * n1, depth);
  float foamMask = smoothstep(0.32, 0.78, vFoam * (0.55 + 0.75 * n1) + n2 * 0.18) + lace * smoothstep(0.35, 0.7, n2 + 0.25);
  foamMask = clamp(foamMask, 0.0, 1.0);
  color = mix(color, vec3(0.97, 1.0, 0.99), foamMask * 0.9 * clean);
  color += vec3(0.3, 0.85, 1.0) * uGlow * 0.15 * deep;
  color *= mix(0.22, 1.0, uLight);
  float clear = uClarity * (1.0 - max(max(uDirty, uBrown), uYellow));
  float alpha = mix(0.3, 0.9, smoothstep(0.02, 1.7, depth)) + fres * 0.12 + uDirty * 0.25 + uBrown * 0.2;
  alpha = mix(alpha, 0.98, foamMask * 0.8);
  alpha *= 1.0 - clear * 0.35 * (1.0 - foamMask);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * smoothstep(-0.005, 0.02, depth));
}`;

function water(ctx) {
  const { w } = ctx,
    look = w.look.water,
    x0 = WAVE.sandTop - 0.2,
    x1 = WAVE.halfX,
    length = x1 - x0,
    width = ENDZ * 2;
  // (Fine along the waves' travel, where the crests are sharp; coarser along the pool.)
  const geo = new THREE.PlaneGeometry(length, width, Math.round(length / 0.12), Math.round(width / 0.3));
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, 0);
  const waves = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4(0, 0, 0, 0));
  w.water = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWaves: { value: waves },
        uCount: { value: 0 },
        uDirty: { value: 0 },
        uBrown: { value: 0 },
        uYellow: { value: 0 },
        uLight: { value: 1 },
        uSun: { value: new THREE.Vector3(-0.35, 0.9, 0.3) },
        uShallow: { value: new THREE.Vector3(...look.shallow) },
        uDeep: { value: new THREE.Vector3(...look.deep) },
        uSky: { value: new THREE.Vector3(...(look.sky || [0.7, 0.93, 0.95])) },
        uGlint: { value: new THREE.Vector3(...(look.glint || [1, 0.96, 0.86])) },
        uGlow: { value: look.glow || 0 },
        uClarity: { value: look.clarity || 0 },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    }),
  );
  w.water.position.y = W;
  w.water.renderOrder = 2;
  w.water.frustumCulled = false;
  w.scene.add(w.water);
  w.poolLamps = null;
  // Every frame: the simulation's crests into the shader.
  w.updaters.push((time, dt, world, sim) => {
    const list = sim?.waves?.list || [],
      u = w.water.material.uniforms;
    let n = 0;
    for (const wave of list) {
      if (n >= MAX_WAVES) break;
      waves[n++].set(wave.x, wave.a * WAVE.show, wave.broken ? 1 : 0, wave.foam || 0);
    }
    u.uCount.value = n;
  });
}

// ---- the wave house ------------------------------------------------------------------------------------------------------------

// The far side: the wall with the five chambers at the waterline, the stucco block over them with its terrace, the mural, the
// roof sign between the lighthouse towers, the LED board and the flags.
function waveHouse(ctx) {
  const { w, live } = ctx;
  const stucco = plasterTexture({ seed: 31, strength: 0.05 });
  w.textures.push(stucco);
  const white = new THREE.MeshStandardMaterial({ map: stucco, color: STUCCO, roughness: 0.92 });
  const front = FAR,
    back = 14.9,
    halfZ = 10.4;
  // The wall over the chambers, from below the water up to the terrace: pieces between the arches.
  const top = 2.7;
  const edges = [-halfZ, ...CHAMBERS.flatMap((z) => [z - CHAMBER_W / 2, z + CHAMBER_W / 2]), halfZ];
  for (let i = 0; i < edges.length; i += 2) {
    const z0 = edges[i],
      z1 = edges[i + 1];
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.9, top + 2.5, z1 - z0), white);
    piece.position.set(front + 0.45, (top - 2.5) / 2, (z0 + z1) / 2);
    piece.castShadow = piece.receiveShadow = true;
    w.scene.add(piece);
  }
  // Each chamber: an arch over the opening, a dark mouth, a grille, a coral keystone and the water surging in it.
  ctx.surges = [];
  for (const z of CHAMBERS) {
    const archTop = 1.45;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, top - archTop, CHAMBER_W), white);
    lintel.position.set(front + 0.45, archTop + (top - archTop) / 2, z);
    lintel.castShadow = lintel.receiveShadow = true;
    w.scene.add(lintel);
    // The round of the arch: a half disc cut out of the lintel's underside, drawn as a ring of white.
    const arch = new THREE.Mesh(
      new THREE.RingGeometry(CHAMBER_W / 2 - 0.02, CHAMBER_W / 2 + 0.28, 24, 1, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: STUCCO, roughness: 0.9, side: THREE.DoubleSide }),
    );
    arch.rotation.y = -Math.PI / 2;
    arch.position.set(front - 0.005, archTop - CHAMBER_W / 2 + 0.1, z);
    w.scene.add(arch);
    w.box(0.12, 0.42, 0.32, CORAL, front - 0.02, archTop + 0.2, z, 0.03);
    // The mouth: deep blue-black, going back into the building.
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(CHAMBER_W, archTop + 2.4),
      new THREE.MeshBasicMaterial({ color: 0x062430 }),
    );
    mouth.rotation.y = -Math.PI / 2;
    mouth.position.set(front + 0.6, (archTop - 2.4) / 2 - 0.1, z);
    w.scene.add(mouth);
    // The grille: vertical bars in the opening, above and below the water.
    for (let k = -4; k <= 4; k++)
      w.box(
        0.06,
        archTop + 2.2,
        0.07,
        0x2b4f5c,
        front + 0.15,
        (archTop - 2.2) / 2 - 0.05,
        z + k * 0.27,
        0.01,
      );
    w.box(0.08, 0.08, CHAMBER_W, 0x2b4f5c, front + 0.15, archTop - 0.05, z, 0.01);
    // The water inside the chamber: rises and falls as each wave is pushed out (live, see the updater).
    const surge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, CHAMBER_W - 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1d7f99, roughness: 0.2, transparent: true, opacity: 0.85 }),
    );
    surge.rotation.x = -Math.PI / 2;
    surge.position.set(front + 0.4, W, z);
    live.add(surge);
    ctx.surges.push(surge);
  }
  // The block over the chambers: the terrace's floor, its front a coral band with a row of portholes, the railing.
  const block = new THREE.Mesh(new THREE.BoxGeometry(back - front - 0.9, top, halfZ * 2), white);
  block.position.set((front + 0.9 + back) / 2, top / 2, 0);
  block.castShadow = block.receiveShadow = true;
  w.scene.add(block);
  w.box(0.12, 0.34, halfZ * 2, CORAL, front - 0.03, top - 0.2, 0, 0.02);
  w.box(1.2, 0.12, halfZ * 2 + 0.2, CREAM, front + 0.5, top + 0.04, 0, 0.03);
  for (let z = -halfZ + 0.6; z <= halfZ - 0.5; z += 0.9)
    w.cyl(0.03, 0.03, 0.9, 0xffffff, front + 0.05, top + 0.5, z, w.scene, 6);
  w.box(0.09, 0.07, halfZ * 2, 0xffffff, front + 0.05, top + 0.96, 0, 0.03);
  w.box(0.06, 0.05, halfZ * 2, TEAL, front + 0.05, top + 0.6, 0, 0.02);
  // The upper storey, set back: the mural (assets/wave/mural.jpg) on its face, framed in teal, with a striped awning over the terrace.
  const upFront = front + 1.6,
    upTop = 8.6,
    muralH = upTop - top - 0.6,
    muralW = Math.min(halfZ * 2 - 1.6, muralH * 2);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(back - upFront, upTop - top, halfZ * 2 - 1.2), white);
  upper.position.set((upFront + back) / 2, (top + upTop) / 2, 0);
  upper.castShadow = upper.receiveShadow = true;
  w.scene.add(upper);
  const mural = new THREE.Mesh(
    new THREE.PlaneGeometry(muralW, muralH),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }),
  );
  photo(w, "mural.jpg", "#3fb5b0", (t) => (mural.material.map = t), { wrap: THREE.ClampToEdgeWrapping });
  mural.rotation.y = -Math.PI / 2;
  mural.position.set(upFront - 0.012, top + 0.3 + muralH / 2, 0);
  mural.receiveShadow = true;
  w.scene.add(mural);
  for (const [dz, dy, len, horiz] of [
    [0, top + 0.3, muralW + 0.3, true],
    [0, top + 0.3 + muralH, muralW + 0.3, true],
    [-muralW / 2, top + 0.3 + muralH / 2, muralH, false],
    [muralW / 2, top + 0.3 + muralH / 2, muralH, false],
  ])
    w.box(0.1, horiz ? 0.16 : len, horiz ? len : 0.16, TEAL, upFront - 0.04, dy, dz, 0.03);
  awning(ctx, front + 0.2, upFront, top + 2.3, halfZ * 2 - 1.4);
  // The roof: a cornice, the sign, the flags.
  w.box(back - upFront + 0.4, 0.3, halfZ * 2 - 0.8, CREAM, (upFront + back) / 2, upTop + 0.15, 0, 0.06);
  w.box(0.1, 0.18, halfZ * 2 - 0.8, CORAL, upFront - 0.2, upTop + 0.08, 0, 0.02);
  roofSign(ctx, upFront + 0.6, upTop + 0.3);
  ledBoard(ctx, front - 0.07, top - 0.95);
  for (const s of [-1, 1]) lighthouse(ctx, front + 1.6, s * (halfZ + 0.35));
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.55, 6, 1);
  flagGeo.translate(0.45, 0, 0);
  ctx.flags = [];
  for (let k = 0; k < 7; k++) {
    const z = -6.6 + k * 2.2;
    w.cyl(0.04, 0.05, 2.4, 0xe9e9e9, upFront + 1.6, upTop + 1.35, z, w.scene, 6);
    const flag = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({ color: [CORAL, TEAL, SUN, CREAM][k % 4], side: THREE.DoubleSide }),
    );
    flag.position.set(upFront + 1.6, upTop + 2.3, z);
    flag.rotation.y = Math.PI / 2 + 0.6;
    live.add(flag);
    ctx.flags.push(flag);
  }
  // Live: the chambers surge as each wave is launched (and ease back), the flags flap.
  let lastLaunched = -1;
  const pulse = new Float32Array(CHAMBERS.length);
  w.updaters.push((time, dt, world, sim) => {
    const machine = sim?.waves;
    if (machine && machine.launched !== lastLaunched) {
      if (lastLaunched >= 0) for (let i = 0; i < pulse.length; i++) pulse[i] = 1;
      lastLaunched = machine.launched;
    }
    ctx.surges.forEach((s, i) => {
      pulse[i] = Math.max(0, pulse[i] - dt * 1.2);
      const k = pulse[i];
      s.position.y = W + Math.sin(k * Math.PI) * 0.55 + Math.sin(time * 1.3 + i) * 0.03;
    });
    ctx.flags.forEach((f, i) => {
      f.rotation.y = Math.PI / 2 + 0.6 + Math.sin(time * 2.3 + i * 0.7) * 0.18;
    });
  });
}

// Coral-and-cream striped awning over the terrace.
function awning(ctx, x0, x1, y, length) {
  const { w } = ctx;
  const n = Math.round(length / 0.8);
  for (let i = 0; i < n; i++) {
    const z = -length / 2 + (i + 0.5) * (length / n),
      m = new THREE.Mesh(
        new THREE.PlaneGeometry(x1 - x0 + 0.3, length / n),
        w.mat(i % 2 ? CREAM : CORAL, { side: THREE.DoubleSide, roughness: 0.8 }),
      );
    m.rotation.x = -Math.PI / 2;
    m.rotation.y = 0;
    m.position.set((x0 + x1) / 2, y, z);
    m.rotation.z = 0;
    // slope it down towards the pool
    m.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -0.32);
    m.castShadow = true;
    w.scene.add(m);
  }
  for (let z = -length / 2; z <= length / 2 + 0.01; z += length / 6)
    w.cyl(0.035, 0.035, y - 2.7, 0xffffff, x0 + 0.05, 2.7 + (y - 2.7) / 2 - 0.15, z, w.scene, 6);
}

// The sign on the roof: WAVE POOL in big retro letters on a coral board edged with light bulbs, SURF'S UP! under it.
function roofSign(ctx, x, y) {
  const { w, live } = ctx;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const g = w.group(x, y, 0);
  w.box(0.25, 2.1, 9.4, CORAL, 0, 1.05, 0, 0.12, g);
  w.box(0.3, 0.12, 9.6, CREAM, 0, 0.04, 0, 0.04, g);
  for (const s of [-1, 1]) w.box(0.2, 1.6, 0.2, 0x8a5a33, 0.35, 0.8, s * 3.6, 0.03, g);
  if (canvas) {
    canvas.width = 1024;
    canvas.height = 240;
    const c = canvas.getContext("2d");
    c.fillStyle = "#e2574a";
    c.fillRect(0, 0, 1024, 240);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "900 150px 'Barlow Condensed', Arial Black, Arial";
    c.lineWidth = 16;
    c.strokeStyle = "#174958";
    c.strokeText("WAVE POOL", 512, 100);
    c.fillStyle = "#ffc93c";
    c.fillText("WAVE POOL", 512, 100);
    c.font = "800 50px 'Barlow Condensed', Arial";
    c.fillStyle = "#fff1d8";
    c.fillText("~  SURF'S UP!  ~", 512, 200);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    w.textures.push(t);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 2.06), new THREE.MeshBasicMaterial({ map: t }));
    face.rotation.y = -Math.PI / 2;
    face.position.set(-0.135, 1.05, 0);
    g.add(face);
  }
  // Bulbs round the board, chasing.
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.06, 8, 6);
  for (let i = 0; i < 44; i++) {
    const t = i / 44,
      per = 2 * (9.2 + 2.0);
    let d = t * per,
      z,
      yy;
    if (d < 9.2) {
      z = -4.6 + d;
      yy = 2.05;
    } else if ((d -= 9.2) < 2.0) {
      z = 4.6;
      yy = 2.05 - d;
    } else if ((d -= 2.0) < 9.2) {
      z = 4.6 - d;
      yy = 0.05;
    } else {
      z = -4.6;
      yy = 0.05 + (d - 9.2);
    }
    const b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    b.position.set(x - 0.16, y + yy, z);
    live.add(b);
    bulbs.push(b);
  }
  w.updaters.push((time) => {
    bulbs.forEach((b, i) =>
      b.material.color.setHex((Math.floor(time * 6) + i) % 4 === 0 ? 0xffffff : 0xffc35a),
    );
  });
}

// The LED board on the terrace's front: what the machine is doing, in amber dots (waves.mjs `waveBoard`), red when a monster is on
// its way. Redrawn only when the words change.
function ledBoard(ctx, x, y) {
  const { w } = ctx;
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext("2d");
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(t);
  w.box(0.16, 0.86, 4.6, 0x1b2b33, x + 0.06, y, 0, 0.05);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.74), new THREE.MeshBasicMaterial({ map: t }));
  face.rotation.y = -Math.PI / 2;
  face.position.set(x - 0.03, y, 0);
  w.scene.add(face);
  let said = "";
  const draw = (text, color) => {
    c.fillStyle = "#0c1418";
    c.fillRect(0, 0, 512, 96);
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "800 64px 'Barlow Condensed', Arial";
    c.fillText(text, 256, 52);
    // the dots of an LED board
    c.fillStyle = "rgba(12,20,24,0.55)";
    for (let i = 0; i < 512; i += 6) c.fillRect(i, 0, 2, 96);
    for (let j = 0; j < 96; j += 6) c.fillRect(0, j, 512, 2);
    t.needsUpdate = true;
  };
  draw("WAVE POOL", "#ffc35a");
  w.updaters.push((time, dt, world, sim) => {
    const b = waveBoard(sim?.waves);
    if (!b) return;
    const secs = b.seconds !== undefined ? " " + Math.max(0, Math.ceil(b.seconds)) : "";
    const text =
      b.state === "halted"
        ? "WAVES STOPPED"
        : b.state === "stopped"
          ? "WAVES OFF"
          : b.text + (b.state === "running" ? "" : secs);
    const color =
      b.state === "monster"
        ? Math.floor(time * 4) % 2
          ? "#ff4b3a"
          : "#ffd0c8"
        : b.state === "running"
          ? "#7dffb4"
          : "#ffc35a";
    if (text + color !== said) {
      said = text + color;
      draw(text, color);
    }
  });
}

// A red-and-white striped lighthouse tower at each end of the wave house, a lantern on top whose beacon turns and flashes red when a
// monster wave is coming (and amber with the horn).
function lighthouse(ctx, x, z) {
  const { w, live } = ctx;
  const g = w.group(x, 0, z);
  const bands = 7,
    height = 9.2;
  for (let i = 0; i < bands; i++) {
    const r0 = 1.25 - (i / bands) * 0.35,
      r1 = 1.25 - ((i + 1) / bands) * 0.35,
      h = height / bands;
    w.cyl(r1, r0, h, i % 2 ? CREAM : CORAL, 0, h * (i + 0.5), 0, g, 20);
  }
  w.cyl(1.15, 1.15, 0.18, 0x2b4f5c, 0, height + 0.09, 0, g, 20);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    w.cyl(0.025, 0.025, 0.5, 0xffffff, Math.cos(a) * 1.05, height + 0.43, Math.sin(a) * 1.05, g, 5);
  }
  w.cyl(0.62, 0.62, 0.9, 0xd8f4ff, 0, height + 0.65, 0, g, 16).material = new THREE.MeshStandardMaterial({
    color: 0xd8f4ff,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
  });
  const cap = w.cyl(0.05, 0.75, 0.6, CORAL, 0, height + 1.4, 0, g, 16);
  cap.castShadow = true;
  w.ball(0.12, 0xffd34d, 0, height + 1.75, 0, g);
  // A horn speaker on the lantern gallery, facing the pool.
  const horn = w.cyl(0.08, 0.32, 0.5, 0x9aa6ab, -1.0, height - 0.3, 0, g, 10);
  horn.rotation.z = Math.PI / 2;
  // The beacon: a lamp and a soft cone of light that turns.
  const beacon = new THREE.Group();
  beacon.position.set(x, height + 0.65, z);
  live.add(beacon);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  );
  beacon.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 7, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd0a0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  beam.geometry.translate(0, -3.5, 0);
  beam.rotation.z = Math.PI / 2;
  beacon.add(beam);
  w.updaters.push((time, dt, world, sim) => {
    const st = sim?.waves;
    const alarm = st?.monster !== null && st?.monster !== undefined,
      horn = st?.state === "horn";
    beacon.rotation.y += dt * (alarm ? 6 : horn ? 3 : 0.6);
    const on = alarm ? 0.55 : horn ? 0.3 : 0;
    beam.material.opacity += (on - beam.material.opacity) * Math.min(1, dt * 6);
    const color = alarm ? (Math.floor(time * 5) % 2 ? 0xff3b2a : 0xffb0a0) : horn ? 0xffc35a : 0xffe9a0;
    lamp.material.color.setHex(color);
    beam.material.color.setHex(alarm ? 0xff5a40 : 0xffd0a0);
  });
}

// ---- the walls, the gate ---------------------------------------------------------------------------------------------------

// White stucco walls with coral caps round the deck; low on the near side so the camera sees in; the far side is the wave house.
function walls(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    door = venue.arrival,
    half = door.doorX * 2 + 0.02;
  const wall = (x0, z0, x1, z1, h) => {
    const len = Math.hypot(x1 - x0, z1 - z0),
      along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    w.box(along ? len : 0.3, h, along ? 0.3 : len, STUCCO, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0.05);
    w.box(
      along ? len + 0.1 : 0.42,
      0.1,
      along ? 0.42 : len + 0.1,
      CORAL,
      (x0 + x1) / 2,
      h + 0.05,
      (z0 + z1) / 2,
      0.03,
    );
  };
  // The near side (screen bottom): low.
  wall(room.minX + 0.15, room.minZ, room.minX + 0.15, room.maxZ, 0.55);
  // The gate's wall (left), either side of the gate.
  wall(room.minX, room.minZ + 0.15, -half - 0.4, room.minZ + 0.15, 1.3);
  wall(half + 0.4, room.minZ + 0.15, room.maxX, room.minZ + 0.15, 1.3);
  // The right end.
  wall(room.minX, room.maxZ - 0.15, room.maxX, room.maxZ - 0.15, 1.3);
}

// The surf gate: two pillars with surfboards standing against them, a thatched arch with SURF GATE, and two slatted leaves that
// swing open (scene.mjs drives `lockerDoors`).
function gate(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    door = venue.arrival,
    half = door.doorX * 2 + 0.02,
    z = room.minZ + 0.05;
  for (const s of [-1, 1]) {
    const x = s * (half + 0.25);
    w.box(0.5, 3.0, 0.5, STUCCO, x, 1.5, z, 0.06);
    w.box(0.6, 0.12, 0.6, CORAL, x, 3.06, z, 0.03);
    w.ball(0.2, SUN, x, 3.3, z);
  }
  w.box(half * 2 + 1.1, 0.7, 0.18, TEAL, 0, 3.4, z + 0.05, 0.08);
  w.textPlane("SURF GATE", half * 2 + 0.9, 0.55, "#1f9aa0", "#fff1d8", 0, 3.4, z + 0.16, w.scene, 60);
  const wood = woodMaterial(w, "#c9935a", 13);
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * half, 0, z + 0.06);
    w.scene.add(hinge);
    for (let i = 0; i < 5; i++) {
      const x = -side * (0.14 + i * ((half - 0.22) / 4));
      w.box(0.16, 1.4, 0.05, wood, x, 0.8, 0.02, 0.02, hinge);
    }
    w.box(half - 0.05, 0.08, 0.07, CORAL, (-side * half) / 2, 1.42, 0.05, 0.02, hinge);
    w.lockerDoors.push({ side, hinge });
  }
}

// ---- the beach --------------------------------------------------------------------------------------------------------------

// Towels where the bathers rest (venue.rescue and the towel spots, wave-pool.mjs), a sand castle, beach balls, starfish and shells,
// and a string of pennants from the lifeguard tower to the wave house's ends.
function beach(ctx) {
  const { w, venue, rand } = ctx;
  const towelColors = [
    [CORAL, CREAM],
    [TEAL, 0xffffff],
    [SUN, CORAL],
    [0x6b8cff, 0xffffff],
    [SEAFOAM, TEAL],
  ];
  // Towels along the top of the beach (the resting spots): striped rectangles.
  const towelAt = [-6.8, -4.4, 2.6, 4.8, 7.0];
  towelAt.forEach((z, i) => {
    const g = w.group(-9.75, 0.012, z, w.scene, (rand() - 0.5) * 0.3);
    const [a, b] = towelColors[i % towelColors.length];
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.5), w.mat(k % 2 ? b : a, { roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(-0.36 + k * 0.18, 0, 0);
      m.receiveShadow = true;
      g.add(m);
    }
  });
  // A sand castle with a tiny flag, by the corner.
  const castle = w.group(-9.9, 0, -8.9);
  const sand = 0xe0c07c;
  w.cyl(0.42, 0.5, 0.32, sand, 0, 0.16, 0, castle, 10);
  for (const [dx, dz] of [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ]) {
    w.cyl(0.13, 0.15, 0.5, sand, dx, 0.25, dz, castle, 8);
    w.cyl(0.02, 0.14, 0.12, sand, dx, 0.56, dz, castle, 8);
  }
  w.cyl(0.18, 0.22, 0.55, sand, 0, 0.55, 0, castle, 8);
  w.rod([0, 0.8, 0], [0, 1.15, 0], 0.01, 0x8a5a33, castle);
  w.box(0.16, 0.1, 0.01, CORAL, 0.08, 1.1, 0, 0, castle);
  w.cyl(0.08, 0.06, 0.18, SUN, 0.5, 0.09, 0.4, castle, 8); // a bucket
  // Beach balls.
  for (const [x, z] of [
    [-10.2, -1.4],
    [-12.4, 8.6],
  ])
    beachBall(w, x, z);
  // Starfish and shells on the sand.
  for (let i = 0; i < 14; i++) {
    const x = -8.4 - rand() * 2,
      z = (rand() - 0.5) * 18;
    if (Math.abs(z - 2) < 1.5) continue;
    if (i % 3 === 0) starfish(w, x, z, rand() * TAU);
    else w.ball(0.05 + rand() * 0.03, i % 2 ? 0xfff0e0 : 0xf6c6b0, x, 0.02, z, w.scene, [1, 0.45, 1.2]);
  }
  // Pennants from the lifeguard tower's roof out to the walls.
  const tower = venue.furniture.find((f) => f.kind === "lifeguard-tower");
  if (tower)
    for (const to of [
      [-14.8, 2.6, -9.6],
      [-14.8, 2.6, 9.6],
    ]) {
      const { flags, line } = garland([tower.x - 0.2, 3.7, tower.z], to, {
        count: 12,
        size: 0.42,
        sag: 0.5,
        colors: [CORAL, SUN, TEAL, CREAM],
        seed: to[2] > 0 ? 3 : 5,
      });
      const m = new THREE.Mesh(
        flags,
        wind(
          new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }),
          w.wind,
          {
            amp: 0.12,
            speed: 2.6,
          },
        ),
      );
      m.castShadow = true;
      ctx.live.add(m);
      ctx.live.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(line),
          new THREE.LineBasicMaterial({ color: 0xfff6e4 }),
        ),
      );
    }
}
function beachBall(w, x, z) {
  const ball = w.group(x, 0.3, z);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8, (i * Math.PI) / 3, Math.PI / 3),
      w.mat([CORAL, 0xfff4dc, 0x3593c1, 0xfff4dc, SUN, 0xfff4dc][i], { roughness: 0.4 }),
    );
    seg.castShadow = true;
    ball.add(seg);
  }
}
function starfish(w, x, z, turn) {
  const g = w.group(x, 0.025, z, w.scene, turn);
  for (let k = 0; k < 5; k++) {
    const arm = w.box(0.06, 0.03, 0.22, 0xf08a5d, 0, 0, 0.11, 0.015, g);
    arm.position.set(Math.sin((k / 5) * TAU) * 0.1, 0, Math.cos((k / 5) * TAU) * 0.1);
    arm.rotation.y = (k / 5) * TAU;
  }
}

// The lifeguard tower: the Tripo model (assets/props), a simple tower of posts and a hut until it loads.
function lifeguardTower(ctx, x, z) {
  const { w } = ctx;
  const g = propModel("lifeguard-tower", { height: 3.9 }, (stand) => {
    for (const [dx, dz] of [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ])
      w.box(0.12, 2.2, 0.12, TEAK, dx, 1.1, dz, 0.02, stand);
    w.box(1.4, 0.9, 1.4, 0xffffff, 0, 2.65, 0, 0.06, stand);
    w.box(1.6, 0.12, 1.6, CORAL, 0, 3.15, 0, 0.04, stand);
  });
  g.position.set(x, 0, z);
  // (The model's front, with its red cross, to the pool.)
  g.rotation.y = Math.PI / 2;
  w.scene.add(g);
}
function umbrella(ctx, x, z) {
  const { w } = ctx;
  const g = propModel("beach-umbrella", { height: 2.5 }, (stand) => {
    w.cyl(0.03, 0.03, 2.2, 0xffffff, 0, 1.1, 0, stand, 6);
    w.cyl(0.02, 1.1, 0.45, CORAL, 0, 2.2, 0, stand, 12);
  });
  g.position.set(x, 0, z);
  g.rotation.y = x + z;
  w.scene.add(g);
}
function deckChair(ctx, x, z, angle) {
  const { w } = ctx;
  const g = propModel("deck-chair", { height: 0.95 }, (stand) => {
    w.box(0.6, 0.06, 1.0, TEAK, 0, 0.35, 0, 0.02, stand);
    w.box(0.6, 0.6, 0.06, CORAL, 0, 0.62, -0.42, 0.02, stand).rotation.x = -0.4;
  });
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  w.scene.add(g);
}

// The tube hut by the beach corner: a little cabana with a thatched roof and a TUBES sign, the tubes stacked in front of it (one shown
// for each tube in the hut: `finPairs`).
function tubeHut(ctx) {
  const { w, venue } = ctx,
    p = venue.stations.fins,
    f = venue.furniture.find((x) => x.kind === "tube-hut") || { hx: 0.75, hz: 1.05 },
    g = w.group(p.x, 0, p.z),
    count = venue.tubes ?? 5,
    wood = woodMaterial(w, "#a8743f", 7);
  for (const [dx, dz] of [
    [-f.hx, -f.hz],
    [f.hx, -f.hz],
    [-f.hx, f.hz],
    [f.hx, f.hz],
  ])
    w.box(0.12, 2.3, 0.12, wood, dx, 1.15, dz, 0.02, g);
  w.box(f.hx * 2 + 0.2, 0.12, f.hz * 2 + 0.2, wood, 0, 0.06, 0, 0.02, g);
  // A striped canopy.
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(f.hx * 2 + 0.6, (f.hz * 2 + 0.6) / 6),
      w.mat(i % 2 ? CREAM : TEAL, { side: THREE.DoubleSide, roughness: 0.8 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 2.32, -f.hz - 0.3 + ((i + 0.5) * (f.hz * 2 + 0.6)) / 6);
    m.castShadow = true;
    g.add(m);
  }
  w.finPairs = [];
  for (let i = 0; i < count; i++) {
    const tube = tubeObject(w, i, 0.8);
    tube.position.set(0.15, 0.2 + i * 0.25, ((i % 2) - 0.5) * 0.12);
    g.add(tube);
    w.finPairs.push(tube);
  }
  const sign = w.textPlane("TUBES", 1.3, 0.4, "#1f9aa0", "#ffc93c", f.hx + 0.08, 1.85, 0, g, 56);
  sign.rotation.y = Math.PI / 2;
  stationHit(w, { kind: "station", item: "fins" }, p, 2.4, 2.4, Math.PI / 2);
  w.labels.push({ text: "E · TUBE HUT", x: p.x, y: 2.8, z: p.z });
}

// The Surf Shack at the right end of the beach: a counter under a thatched roof, SURF SHACK on a board, surfboards against it.
function surfShack(ctx) {
  const { w, venue } = ctx,
    f = venue.furniture.find((x) => x.kind === "surf-shack");
  if (!f) return;
  const g = w.group(f.x, 0, f.z),
    wood = woodMaterial(w, "#b9824a", 17);
  w.box(f.hx * 2, 1.05, f.hz * 2, wood, 0, 0.52, 0, 0.05, g);
  w.box(f.hx * 2 + 0.2, 0.1, f.hz * 2 + 0.25, CREAM, 0, 1.08, 0, 0.03, g);
  for (const [dx, dz] of [
    [-f.hx, -f.hz],
    [f.hx, -f.hz],
    [-f.hx, f.hz],
    [f.hx, f.hz],
  ])
    w.box(0.1, 2.4, 0.1, wood, dx, 1.2, dz, 0.02, g);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.hypot(f.hx, f.hz) + 0.6, 1.0, 4, 1),
    w.mat(0xd2a25c, { roughness: 1 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.85;
  roof.castShadow = true;
  g.add(roof);
  const sign = w.textPlane("SURF SHACK", 2.2, 0.42, "#e2574a", "#fff1d8", f.hx + 0.06, 1.95, 0, g, 56);
  sign.rotation.y = Math.PI / 2;
  // Two surfboards leaning on its side.
  for (const [dz, turn] of [
    [-f.hz - 0.25, 0.25],
    [-f.hz - 0.55, -0.15],
  ]) {
    const b = propModel("surfboard", { height: 2.0 }, (stand) =>
      w.box(0.5, 2.0, 0.08, CORAL, 0, 1.0, 0, 0.2, stand),
    );
    b.position.set(0.3, 0, dz);
    b.rotation.set(0, turn, 0.12);
    g.add(b);
  }
}

// A rack of surfboards standing by the gate.
function surfRack(ctx) {
  const { w, venue } = ctx,
    f = venue.furniture.find((x) => x.kind === "surf-rack");
  if (!f) return;
  const g = w.group(f.x, 0, f.z),
    wood = woodMaterial(w, "#8f5e33", 5);
  w.box(f.hx * 2, 0.12, 0.5, wood, 0, 0.3, 0, 0.03, g);
  w.box(f.hx * 2, 0.08, 0.08, wood, 0, 1.25, 0.18, 0.02, g);
  for (const dx of [-f.hx, f.hx]) w.box(0.1, 1.3, 0.1, wood, dx, 0.65, 0.18, 0.02, g);
  for (let i = 0; i < 4; i++) {
    const b = propModel("surfboard", { height: 1.95 }, (stand) =>
      w.box(0.5, 1.95, 0.08, [CORAL, TEAL, SUN, CREAM][i], 0, 0.98, 0, 0.2, stand),
    );
    b.position.set(-f.hx + 0.35 + i * ((f.hx * 2 - 0.7) / 3), 0.05, -0.02);
    b.rotation.set(-0.12, Math.PI / 2 + (i - 1.5) * 0.08, 0);
    g.add(b);
  }
}

// ---- outside the walls ------------------------------------------------------------------------------------------------------

function outside(ctx) {
  const { venue, rand } = ctx,
    room = venue.room;
  // Palms along the walls, outside, and a few clumps of bushes.
  for (let i = 0; i < 9; i++)
    swayPalm(ctx, room.minX - 2.5 - rand() * 3, -14 + i * 3.4, 5 + rand() * 1.5, i * 2.1);
  for (let i = 0; i < 6; i++)
    swayPalm(ctx, -12 + i * 5, room.maxZ + 2.5 + rand() * 2, 5 + rand(), i * 3.3 + 1);
  for (let i = 0; i < 6; i++)
    swayPalm(ctx, -12 + i * 5.2, room.minZ - 2.5 - rand() * 2, 5 + rand(), i * 1.7 + 2);
  for (let i = 0; i < 5; i++)
    swayPalm(ctx, room.maxX + 1.5 + rand() * 3, -12 + i * 6, 6 + rand() * 1.5, i * 2.9);
}

// ---- picking ---------------------------------------------------------------------------------------------------------------------

// The water is the one "lane": an invisible plane for clicks, and a highlight with a rim for the guidance (scene.mjs drives them
// as `riverHighlight` and `riverRim`, as for the Lazy River's water).
function pickVolume(ctx) {
  const { w } = ctx,
    sizeX = WAVE.halfX * 2,
    sizeZ = ENDZ * 2;
  const pick = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeX, sizeZ),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  );
  pick.rotation.x = -Math.PI / 2;
  pick.position.set(0, -0.12, 0);
  pick.userData = { kind: "lane", lane: 0 };
  w.scene.add(pick);
  w.clickables.push(pick);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeX - 0.2, sizeZ - 0.2),
    new THREE.MeshBasicMaterial({ color: 0xffe58b, transparent: true, opacity: 0, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, -0.17, 0);
  glow.renderOrder = 3;
  w.scene.add(glow);
  w.riverHighlight = glow;
  const x = WAVE.halfX - 0.1,
    z = ENDZ - 0.1;
  w.riverRim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      [
        [-x, -z],
        [x, -z],
        [x, z],
        [-x, z],
      ].map(([a, b]) => new THREE.Vector3(a, -0.13, b)),
    ),
    new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
  );
  w.scene.add(w.riverRim);
}

export { depthAt };
