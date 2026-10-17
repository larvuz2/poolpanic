// The Rooftop Pool (17 October 2026): an infinity pool on the roof of a tower, 185 m above a city, at golden hour going to dusk
// (the creator: "it has to be epic… Marina Bay Sands… infinity pool… umbrellas and chairs… a DJ set on the far right… the
// buildings down below… very elegant"). The plan is roof-plan.mjs; the guests are rooftop.mjs; what they do on screen is
// roof-view.mjs; the city below is city.mjs.
//
// The deck is honey teak with pale travertine round the water. The pool runs the length of the roof, shallow, lined with a deep
// teal glass mosaic, its water dark and mirror-like, catching the sunset; along the far side its edge is a knife edge the water
// slides over into a catch gutter a step lower, and past the gutter there is only a frameless glass rail, and the city a long way
// down (the far third of the roof is cantilevered out over the street, a white slab with a bronze edge). Two bronze lift cores
// face each other from the ends; on the near side, cream sunbeds in pairs under cream parasols, white curtained cabanas for the
// VIPs, a lounge of sofas round a fire table, palms in planters and lanterns; the cocktail bar (a fluted teal counter with a
// marble top, a back bar of lit bottles, SKY BAR in neon) at the far left; the DJ on a lit riser behind a glossy booth at the far
// right, big speakers either side and an LED wall behind that pulses with the music and goes wild on the drop.
//
// Props are Tripo models (assets/props, roof props by prop-models.mjs), each with a stand-in until it loads. Nothing here moves
// the simulation.
import { THREE } from "./kit.mjs";
import { ROOF, ROOF_BEDS } from "../roof-plan.mjs";
import { rngOf } from "./geom.mjs";
import { glowTexture } from "./textures.mjs";
import {
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsTable,
} from "./props.mjs";
import { propModel } from "./prop-models.mjs";
import { buildCity, roofPicture, CITY } from "./city.mjs";
import { syncRoof, buildRoofCast } from "./roof-view.mjs";
import { doorOpening } from "../spatial.mjs";
import { danceAt } from "../dance.mjs";
import { nextDrop } from "../rooftop.mjs";

const TAU = Math.PI * 2;
export const ROOF_WATER = -0.08; // the pool's surface (the deck is at 0)
export const ROOF_FLOOR = -1.24; // the pool's floor
const GUTTER_WATER = -0.62,
  GUTTER_FLOOR = -0.82,
  SLAB = -1.7, // the underside of the roof slab
  EDGE = { x0: -15.1, x1: 4.95, z: 16.55 }, // the roof's outline
  TOWER = { x0: -14.2, x1: -1.0, z: 15.6 }, // the tower under it (the rest is cantilevered)
  BRONZE = 0x8a6a45,
  CREAM = 0xf3ead8,
  TEAK = 0xb07a48;

export function buildRooftop(w, venue) {
  const live = new THREE.Group();
  live.name = "roof-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, live, rand: rngOf(57), glow: glowTexture(128) };
  w.textures.push(ctx.glow);
  w.poolUniforms = { uTime: { value: 0 }, uCaustic: { value: 1 } };
  // The city is 185 m down and 2 km out: the camera sees that far here (scene.mjs puts it back for other venues).
  w.camera.far = 3200;
  w.camera.updateProjectionMatrix();
  deck(ctx);
  slabAndTower(ctx);
  basin(ctx);
  water(ctx);
  infinityEdge(ctx);
  rails(ctx);
  lifts(ctx);
  loungers(ctx);
  lounge(ctx);
  bar(ctx);
  djStage(ctx);
  greenery(ctx);
  festoons(ctx);
  station(w, "chlorine", venue.stations.chlorine, 0xf2e6c8, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xe5f2ea, "EYE CARE", -Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  treatsTable(w, venue.fixtures.treats);
  const city = buildCity(w);
  buildRoofCast(w, venue, ctx);
  w.updaters.push((time, dt, world, sim) => {
    city.update(time, dt);
    for (const f of ctx.beats || []) f(time, dt, sim);
    syncRoof(w, sim, time, dt, ctx);
  });
}

// ---- shapes -------------------------------------------------------------------------------------------------------------------

// A rectangle in the ground plane (the shape's y is the world's -z: `flat` lays it down), and a shape laid flat with world-metre UVs.
function rect(x0, z0, x1, z1) {
  const s = new THREE.Shape();
  s.moveTo(x0, -z0);
  s.lineTo(x1, -z0);
  s.lineTo(x1, -z1);
  s.lineTo(x0, -z1);
  s.closePath();
  return s;
}
function flat(shape, material, y = 0) {
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const m = new THREE.Mesh(geo, material);
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}
// A wall: a plane from (x0, z0) to (x1, z1), from y0 up to y1, facing `normal`'s side, UVs in metres.
function wall(material, x0, z0, x1, z1, y0, y1, flip = false) {
  const len = Math.hypot(x1 - x0, z1 - z0),
    geo = new THREE.PlaneGeometry(len, y1 - y0);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * (y1 - y0) + y0);
  const m = new THREE.Mesh(geo, material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0) + (flip ? Math.PI : 0);
  m.receiveShadow = true;
  return m;
}

// ---- the deck, the slab and the tower -------------------------------------------------------------------------------------------

function deck(ctx) {
  const { w } = ctx,
    P = { x0: -ROOF.halfX - 0.3, x1: ROOF.gutter.x1, z: ROOF.halfZ + 0.35 };
  const teak = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 });
  roofPicture(w, "teak.jpg", (t) => ((teak.map = t), (teak.needsUpdate = true)), {
    repeat: [1 / 2.6, 1 / 2.6],
    color: "#b3804f",
  });
  const stone = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  roofPicture(w, "stone.jpg", (t) => ((stone.map = t), (stone.needsUpdate = true)), {
    repeat: [1 / 2.2, 1 / 2.2],
    color: "#e6d9bf",
  });
  ctx.stone = stone;
  // Teak everywhere but a travertine surround: the walk along the near side, round both ends, and the lift lobbies.
  const surround = { x0: -5.45, x1: P.x1, z: P.z + 1.25 };
  const top = rect(EDGE.x0, -EDGE.z, EDGE.x1, EDGE.z);
  top.holes.push(rect(surround.x0, -surround.z, surround.x1, surround.z));
  for (const s of [-1, 1]) {
    const z0 = s * 13.4,
      z1 = s * EDGE.z;
    top.holes.push(rect(-9.2, Math.min(z0, z1), -3.2, Math.max(z0, z1)));
  }
  w.scene.add(flat(top, teak, 0));
  const ring = rect(surround.x0, -surround.z, surround.x1, surround.z);
  ring.holes.push(rect(P.x0, -P.z, P.x1, P.z));
  w.scene.add(flat(ring, stone, 0.002));
  for (const s of [-1, 1]) {
    const z0 = s * 13.4,
      z1 = s * EDGE.z;
    w.scene.add(flat(rect(-9.2, Math.min(z0, z1), -3.2, Math.max(z0, z1)), stone, 0.002));
  }
  // A thin bronze inlay where the teak meets the stone.
  for (const s of [-1, 1])
    w.box(
      surround.x1 - surround.x0,
      0.012,
      0.05,
      BRONZE,
      (surround.x0 + surround.x1) / 2,
      0.006,
      s * surround.z,
      0,
    );
  w.box(0.05, 0.012, surround.z * 2, BRONZE, surround.x0, 0.006, 0, 0);
}

// The roof slab's edges (white, with a bronze lip), its underside where it hangs out over the street, and the tower below it, a
// glass curtain wall of lit floors down to the ground.
function slabAndTower(ctx) {
  const { w } = ctx,
    white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 });
  const t = 0.3,
    h = -SLAB;
  w.box(t, h, EDGE.z * 2, white, EDGE.x1 - t / 2, SLAB / 2, 0, 0.02);
  w.box(t, h, EDGE.z * 2, white, EDGE.x0 + t / 2, SLAB / 2, 0, 0.02);
  for (const s of [-1, 1])
    w.box(EDGE.x1 - EDGE.x0, h, t, white, (EDGE.x0 + EDGE.x1) / 2, SLAB / 2, s * (EDGE.z - t / 2), 0.02);
  // The bronze lip along the top of the slab's edges.
  w.box(0.08, 0.1, EDGE.z * 2, BRONZE, EDGE.x1 + 0.02, -0.05, 0, 0.01);
  for (const s of [-1, 1])
    w.box(EDGE.x1 - EDGE.x0, 0.1, 0.08, BRONZE, (EDGE.x0 + EDGE.x1) / 2, -0.05, s * (EDGE.z + 0.02), 0.01);
  // The underside: white, with a row of downlights along the cantilever.
  const under = flat(rect(EDGE.x0, -EDGE.z, EDGE.x1, EDGE.z), white, SLAB);
  under.rotation.x = Math.PI;
  under.position.y = SLAB;
  w.scene.add(under);
  const lamps = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.16, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe2b0 }),
    48,
  );
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    m.setPosition(i % 2 ? 3.6 : 1.2, SLAB - 0.01, -15 + (i >> 1) * 1.3);
    lamps.setMatrixAt(i, m);
  }
  w.scene.add(lamps);
  // The tower: four walls of glass, floors of lit windows (facade-a.jpg laid on in metres), from the slab to the street.
  const glass = new THREE.MeshLambertMaterial({ color: 0xc8d2ea, emissive: 0xffffff, emissiveIntensity: 0 });
  roofPicture(
    w,
    "facade-a.jpg",
    (tex, real) => {
      glass.map = tex;
      glass.emissiveMap = tex;
      glass.emissiveIntensity = real ? 0.55 : 0;
      glass.needsUpdate = true;
    },
    { repeat: [1 / 14, 1 / 16], color: "#40455e" },
  );
  const T = TOWER,
    G = CITY.ground;
  w.scene.add(wall(glass, T.x0, -T.z, T.x0, T.z, G, SLAB, true));
  w.scene.add(wall(glass, T.x1, T.z, T.x1, -T.z, G, SLAB, true));
  w.scene.add(wall(glass, T.x0, T.z, T.x1, T.z, G, SLAB, false));
  w.scene.add(wall(glass, T.x1, -T.z, T.x0, -T.z, G, SLAB, false));
}

// ---- the pool --------------------------------------------------------------------------------------------------------------------

// The basin: a floor and walls of deep teal glass mosaic (pool-tile.jpg), a bench step along the near wall a guest steps down onto,
// a band of light under the water all round, and travertine coping on the near side and the ends (the far side is the knife edge).
function basin(ctx) {
  const { w } = ctx,
    hx = ROOF.halfX,
    hz = ROOF.halfZ;
  const tile = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
  roofPicture(w, "pool-tile.jpg", (t) => ((tile.map = t), (tile.needsUpdate = true)), {
    repeat: [1 / 1.6, 1 / 1.6],
    color: "#0f5a58",
  });
  ctx.tile = tile;
  const u = w.poolUniforms;
  tile.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uCaustic = u.uCaustic;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTileW;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvTileW = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vTileW;\nuniform float uTime;\nuniform float uCaustic;\n" + CAUSTIC,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float under = smoothstep(${(ROOF_WATER - 0.05).toFixed(3)}, ${(ROOF_WATER - 0.3).toFixed(3)}, vTileW.y);
        totalEmissiveRadiance += vec3(0.5, 0.95, 0.9) * caustic(vTileW.xz, uTime) * uCaustic * under * 0.32;`,
      );
  };
  tile.customProgramCacheKey = () => "roof-tile";
  w.scene.add(flat(rect(-hx, -hz, hx, hz), tile, ROOF_FLOOR));
  w.scene.add(wall(tile, -hx, -hz, -hx, hz, ROOF_FLOOR, 0, false));
  w.scene.add(wall(tile, hx, hz, hx, -hz, ROOF_FLOOR, ROOF_WATER, false));
  w.scene.add(wall(tile, -hx, hz, hx, hz, ROOF_FLOOR, 0, true));
  w.scene.add(wall(tile, -hx, -hz, hx, -hz, ROOF_FLOOR, 0, false));
  // The bench step along the near wall.
  const benchTop = flat(rect(-hx, -hz, -hx + 0.48, hz), tile, -0.62);
  w.scene.add(benchTop);
  w.scene.add(wall(tile, -hx + 0.48, -hz, -hx + 0.48, hz, ROOF_FLOOR, -0.62, true));
  // The band of light under the water, round the near side and the ends.
  const band = new THREE.MeshBasicMaterial({ color: 0x7ff0e6, transparent: true, opacity: 0.75 });
  ctx.poolBand = band;
  w.box(0.04, 0.05, hz * 2, band, -hx + 0.03, -0.38, 0, 0);
  for (const s of [-1, 1]) w.box(hx * 2, 0.05, 0.04, band, 0, -0.38, s * (hz - 0.03), 0);
  // Coping: travertine on the near side and the ends.
  w.box(0.32, 0.05, hz * 2 + 0.64, ctx.stone, -hx - 0.16, 0.02, 0, 0.01);
  for (const s of [-1, 1]) w.box(hx * 2 + 0.32, 0.05, 0.32, ctx.stone, -0.16, 0.02, s * (hz + 0.16), 0.01);
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

// The water: dark and glassy, deep teal over the mosaic, mirroring the sunset sky at a glancing angle, the low sun's glitter on
// it, rings spreading round everyone standing in it (`uRipples`, up to 16 guests: x, z, how much they stir, a phase), and brighter
// along the far side where it slides over the knife edge. The scene's usual uniforms make it cloudy, brown or yellow.
const MAX_RIPPLES = 16;
const WATER_VERTEX = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const WATER_FRAGMENT =
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
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uSplash;
varying vec3 vWorld;
float ripples(vec2 p, float t) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    if (r.z <= 0.0) continue;
    float d = distance(p, r.xy);
    h += sin(d * 9.0 - t * 3.2 + r.w) * exp(-d * 1.6) * r.z;
  }
  return h;
}
void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  float e = 0.06;
  float hc = ripples(p, t);
  float rx = (ripples(p + vec2(e, 0.0), t) - hc) / e;
  float rz = (ripples(p + vec2(0.0, e), t) - hc) / e;
  float gx = cos(p.x * 1.7 + t * 0.6) * cos(p.y * 1.3 + t * 0.4) * 0.025 + cos(p.x * 4.1 + p.y * 1.7 - t * 1.3) * 0.012;
  float gz = -sin(p.x * 1.7 + t * 0.6) * sin(p.y * 1.3 + t * 0.4) * 0.02 + cos(p.y * 3.7 - p.x * 1.3 + t * 1.1) * 0.01;
  vec3 N = normalize(vec3(-gx - rx * (0.035 + uSplash * 0.05), 1.0, -gz - rz * (0.035 + uSplash * 0.05)));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, R.y));
  vec3 color = mix(uShallow, uDeep, 0.72);
  color = mix(color, vec3(0.40, 0.61, 0.24), uDirty);
  color = mix(color, vec3(0.38, 0.20, 0.07), uBrown * 0.88);
  color = mix(color, vec3(0.93, 0.82, 0.18), uYellow * 0.7);
  float clean = 1.0 - uBrown * 0.8;
  color += vec3(0.6, 1.0, 0.95) * caustic(p * 0.8, t * 0.7) * 0.06 * clean * uLight;
  color = mix(color, sky * uLight, clamp(fres * 1.1, 0.0, 0.85) * clean);
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 320.0) * 2.2 + pow(max(dot(N, H), 0.0), 40.0) * 0.18;
  color += uGlint * glint * clean * uLight;
  // Along the knife edge the water thins and brightens as it slides over.
  float lip = smoothstep(${(ROOF.halfX - 0.35).toFixed(2)}, ${ROOF.halfX.toFixed(2)}, p.x);
  color = mix(color, uHorizon * 1.15 * uLight, lip * 0.45);
  color += vec3(0.25, 0.9, 0.85) * uGlow * 0.12;
  color *= mix(0.25, 1.0, uLight);
  float clear = uClarity * (1.0 - max(max(uDirty, uBrown), uYellow));
  float alpha = mix(0.86, 0.6, clear) + fres * 0.14 + uDirty * 0.2 + uBrown * 0.2;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}`;

function water(ctx) {
  const { w } = ctx,
    look = w.look.water,
    dome = w.look.roofSky || {};
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0));
  const geo = new THREE.PlaneGeometry(ROOF.halfX * 2 + 0.02, ROOF.halfZ * 2, 1, 1);
  geo.rotateX(-Math.PI / 2);
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
        uSun: { value: new THREE.Vector3(0.9, 0.25, 0.3) },
        uShallow: { value: new THREE.Vector3(...look.shallow) },
        uDeep: { value: new THREE.Vector3(...look.deep) },
        uSky: { value: new THREE.Vector3(...(look.sky || [1, 0.8, 0.6])) },
        uGlint: { value: new THREE.Vector3(...(look.glint || [1, 0.85, 0.6])) },
        uGlow: { value: look.glow || 0 },
        uClarity: { value: look.clarity || 0 },
        uZenith: { value: new THREE.Color(dome.zenith ?? 0x5b5fa8) },
        uHorizon: { value: new THREE.Color(dome.horizon ?? 0xffa978) },
        uRipples: { value: ripples },
        uSplash: { value: 0 },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    }),
  );
  w.water.position.set(0.01, ROOF_WATER, 0);
  w.water.renderOrder = 2;
  w.water.frustumCulled = false;
  w.scene.add(w.water);
  w.poolLamps = null;
  ctx.ripples = ripples;
}

// The knife edge and the gutter: the water slides over the far wall's edge in a thin bright sheet into a channel a step lower,
// where it runs along, churning; the channel's outer wall carries the glass rail. Both sheets of water flow in their shaders.
const FLOW_FRAGMENT = `
uniform float uTime;
uniform float uLight;
uniform vec3 uColor;
uniform vec3 uFoam;
uniform float uSpeed;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 q = vec2(vUv.x * 60.0, vUv.y * 3.0 - uTime * uSpeed);
  float n = noise(q) * 0.6 + noise(q * 2.3 + 4.0) * 0.4;
  float streak = smoothstep(0.55, 0.95, n);
  vec3 c = mix(uColor, uFoam, streak * 0.55 + vUv.y * 0.15);
  gl_FragColor = vec4(c * mix(0.3, 1.0, uLight), 0.78 + streak * 0.2);
}`;
function infinityEdge(ctx) {
  const { w } = ctx,
    hz = ROOF.halfZ,
    hx = ROOF.halfX,
    flows = [];
  const flow = (speed, color, foam) => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uLight: { value: 1 },
        uColor: { value: new THREE.Color(color) },
        uFoam: { value: new THREE.Color(foam) },
        uSpeed: { value: speed },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: FLOW_FRAGMENT,
    });
    flows.push(material);
    return material;
  };
  // The knife edge: a slim dark-granite top on the far wall, flush with the water.
  w.box(0.3, 0.04, hz * 2, 0x2b3236, hx + 0.15, ROOF_WATER - 0.02, 0, 0.005);
  // The sheet sliding over it, down the outer face into the gutter.
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(hz * 2, ROOF_WATER - GUTTER_WATER),
    flow(1.6, 0x2a8c8e, 0xd8fff6),
  );
  sheet.rotation.y = Math.PI / 2;
  sheet.position.set(hx + 0.32, (ROOF_WATER + GUTTER_WATER) / 2, 0);
  w.scene.add(sheet);
  // The gutter: its floor and walls in dark stone, its water running along in a churn.
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2a2e, roughness: 0.4 });
  const g0 = ROOF.gutter.x0,
    g1 = ROOF.gutter.x1;
  w.scene.add(flat(rect(g0, -hz - 0.35, g1, hz + 0.35), dark, GUTTER_FLOOR));
  w.scene.add(wall(dark, g1, hz + 0.35, g1, -hz - 0.35, GUTTER_FLOOR, 0, false));
  w.scene.add(wall(dark, hx + 0.3, -hz - 0.35, hx + 0.3, hz + 0.35, GUTTER_FLOOR, ROOF_WATER - 0.04, false));
  for (const s of [-1, 1])
    w.scene.add(wall(dark, g0, s * (hz + 0.35), g1, s * (hz + 0.35), GUTTER_FLOOR, 0, s > 0));
  const run = new THREE.Mesh(
    new THREE.PlaneGeometry(hz * 2 + 0.7, g1 - hx - 0.3),
    flow(0.8, 0x1f6f74, 0x9fe8de),
  );
  run.rotation.x = -Math.PI / 2;
  run.rotation.z = Math.PI / 2;
  run.position.set((hx + 0.3 + g1) / 2, GUTTER_WATER, 0);
  w.scene.add(run);
  // The gutter's outer wall top, in travertine, the rail's base.
  w.box(0.3, 0.06, hz * 2 + 0.7, ctx.stone, g1 + 0.12, 0.0, 0, 0.01);
  ctx.flows = flows;
  (ctx.beats ||= []).push((time, dt, sim) => {
    const light = w.water.material.uniforms.uLight.value;
    for (const m of flows) {
      m.uniforms.uTime.value = time;
      m.uniforms.uLight.value = light;
    }
  });
}

// ---- the glass rails ---------------------------------------------------------------------------------------------------------

// Frameless glass along every edge of the roof (the far side past the gutter, the ends, the near side), a bronze cap on top and
// a slim post every two metres; the lift cores interrupt the ends.
function rails(ctx) {
  const { w } = ctx,
    glass = new THREE.MeshStandardMaterial({
      color: 0xd9f0f4,
      transparent: true,
      opacity: 0.16,
      roughness: 0.05,
      metalness: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    H = 1.1;
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0),
      a = Math.atan2(z1 - z0, x1 - x0);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, H), glass);
    pane.position.set((x0 + x1) / 2, H / 2 + 0.05, (z0 + z1) / 2);
    pane.rotation.y = -a;
    pane.renderOrder = 3;
    w.scene.add(pane);
    w.rod([x0, H + 0.06, z0], [x1, H + 0.06, z1], 0.035, BRONZE);
    for (let k = 0; k <= Math.floor(len / 2); k++) {
      const t = Math.min(1, (k * 2) / len);
      w.box(0.05, H, 0.05, BRONZE, x0 + (x1 - x0) * t, H / 2 + 0.05, z0 + (z1 - z0) * t, 0.01);
    }
  };
  const X = ROOF.rail;
  run(X, -EDGE.z + 0.1, X, EDGE.z - 0.1);
  run(EDGE.x0 + 0.1, -EDGE.z + 0.1, EDGE.x0 + 0.1, EDGE.z - 0.1);
  for (const s of [-1, 1]) {
    run(EDGE.x0 + 0.1, s * (EDGE.z - 0.1), -8.6, s * (EDGE.z - 0.1));
    run(-3.8, s * (EDGE.z - 0.1), X, s * (EDGE.z - 0.1));
  }
}

// ---- the lifts ------------------------------------------------------------------------------------------------------------------

// A bronze lift core at each end: a tall box clad in bronze fins, a brass portal round two brushed-steel doors that slide apart
// when a guest comes or goes (the sim's door timer), the lit car behind them, the floor shown above (57, the top), a canopy.
function lifts(ctx) {
  const { w } = ctx,
    door = ctx.venue.arrival,
    cladding = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.45, metalness: 0.6 }),
    steel = new THREE.MeshStandardMaterial({ color: 0xc9c6c0, roughness: 0.25, metalness: 0.9 }),
    leaves = [];
  for (const side of [-1, 1]) {
    const face = side * door.doorZ,
      x = door.doorX,
      depth = EDGE.z + 0.6 - door.doorZ,
      z = side * (door.doorZ + depth / 2);
    // The core: either side of the doorway, and over it.
    w.box(1.5, 3.4, depth, cladding, x - 1.55, 1.7, z, 0.04);
    w.box(1.5, 3.4, depth, cladding, x + 1.55, 1.7, z, 0.04);
    w.box(1.6, 0.95, depth, cladding, x, 2.93, z, 0.04);
    // Bronze fins up its face.
    for (const dx of [-2.1, -1.7, -1.3, -0.95, 0.95, 1.3, 1.7, 2.1])
      w.box(0.06, 3.3, 0.12, BRONZE, x + dx, 1.7, face - side * 0.04, 0.01);
    // The brass portal.
    w.box(1.72, 0.1, 0.16, 0xc8a24f, x, 2.45, face - side * 0.06, 0.01);
    for (const s of [-1, 1]) w.box(0.1, 2.45, 0.16, 0xc8a24f, x + s * 0.83, 1.22, face - side * 0.06, 0.01);
    // The car, lit, behind the doors.
    const car = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 2.35),
      new THREE.MeshBasicMaterial({ color: 0xffe2b4 }),
    );
    car.position.set(x, 1.2, face + side * 0.6);
    car.rotation.y = side > 0 ? Math.PI : 0;
    w.scene.add(car);
    // Two doors.
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.35, 0.05), steel);
      leaf.position.set(x + s * 0.39, 1.2, face + side * 0.05);
      leaf.castShadow = true;
      w.scene.add(leaf);
      leaves.push({ leaf, side, s, x });
    }
    // The floor above the doors: 57.
    const sign = w.textPlane(
      "▲ 57 · SKY POOL",
      1.6,
      0.26,
      "#1a120c",
      "#ffc46b",
      x,
      2.7,
      face - side * 0.12,
      w.scene,
      50,
    );
    sign.rotation.y = side > 0 ? Math.PI : 0;
    // A canopy over the lobby with a line of light under it.
    w.box(4.6, 0.12, 2.2, 0x2d241b, x, 3.45, side * (door.doorZ - 0.6), 0.03);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
    );
    strip.rotation.x = Math.PI / 2;
    strip.position.set(x, 3.385, side * (door.doorZ - 1.65));
    w.scene.add(strip);
  }
  (ctx.beats ||= []).push((time, dt, sim) => {
    for (const l of leaves) {
      const open = doorOpening(sim?.doors?.[l.side] || 0);
      l.leaf.position.x = l.x + l.s * (0.39 + open * 0.76);
    }
  });
}

// ---- the sunbeds, parasols, cabanas ------------------------------------------------------------------------------------------

// A sunbed's stand-in until the model comes: a teak frame, a cream cushion and a raised back (head to -z in its own frame).
function sunbedStandIn(w) {
  return (g) => {
    w.box(0.78, 0.26, 2.0, TEAK, 0, 0.17, 0, 0.04, g);
    w.box(0.72, 0.1, 1.35, CREAM, 0, 0.35, 0.3, 0.05, g);
    const back = w.box(0.72, 0.1, 0.75, CREAM, 0, 0.55, -0.62, 0.05, g);
    back.rotation.x = -0.6;
  };
}
// A parasol furled for the evening (the sun is going down, and from above an open one would hide the sunbeds): a teak pole on a
// granite base, the cream canopy wrapped tight round it with a tie, a brass finial.
function furledParasol(w, x, z) {
  const g = w.group(x, 0, z);
  w.box(0.42, 0.07, 0.42, 0x3b3b3e, 0, 0.035, 0, 0.02, g);
  w.cyl(0.035, 0.035, 2.6, TEAK, 0, 1.3, 0, g, 8);
  w.cyl(0.03, 0.15, 0.9, CREAM, 0, 1.95, 0, g, 10);
  w.cyl(0.15, 0.06, 0.25, CREAM, 0, 2.52, 0, g, 10);
  w.cyl(0.155, 0.155, 0.05, 0x2c6f73, 0, 2.05, 0, g, 10);
  w.ball(0.05, 0xc8a24f, 0, 2.7, 0, g);
  return g;
}
function loungers(ctx) {
  const { w, venue } = ctx;
  ctx.beds = [];
  for (const b of ROOF_BEDS) {
    const g = b.cabana
      ? propModel("cabana", { height: 2.7 }, (s) => {
          w.box(2.0, 0.4, 2.0, CREAM, 0, 0.2, 0, 0.06, s);
          for (const [x, z] of [
            [-1.2, -1.2],
            [1.2, -1.2],
            [-1.2, 1.2],
            [1.2, 1.2],
          ])
            w.box(0.08, 2.6, 0.08, TEAK, x, 1.3, z, 0.01, s);
          w.box(2.6, 0.12, 2.6, 0xffffff, 0, 2.6, 0, 0.03, s);
        })
      : propModel("sunbed", { size: 2.0 }, sunbedStandIn(w));
    g.position.set(b.x, 0, b.z);
    g.rotation.y = Math.PI / 2; // (its head, -z in the file, to the near wall; its foot, +z, to the pool)
    w.scene.add(g);
    ctx.beds.push(g);
  }
  for (const f of venue.furniture) {
    if (f.kind === "parasol") furledParasol(w, f.x, f.z);
    else if (f.kind === "side-table") {
      const g = propModel("side-table", { height: 0.62 }, (s) => {
        w.cyl(0.24, 0.24, 0.03, 0xf4f1ea, 0, 0.6, 0, s, 16);
        w.cyl(0.03, 0.03, 0.58, 0xc8a24f, 0, 0.3, 0, s, 8);
      });
      g.position.set(f.x, 0, f.z);
      w.scene.add(g);
      const glow = w.decal(ctx.glow, 0.5, 0.5, 0xffc27a, 0.6, true);
      glow.position.set(f.x, 0.72, f.z);
      glow.rotation.x = -Math.PI / 2;
      w.scene.add(glow);
    }
  }
  // An ice bucket and a lantern by each cabana (the VIPs' corner).
  for (const b of ROOF_BEDS.filter((b) => b.cabana)) {
    const bucket = propModel("ice-bucket", { height: 0.9 });
    bucket.position.set(b.x + 1.25, 0, b.z + 1.75 * Math.sign(b.z));
    w.scene.add(bucket);
    lantern(ctx, b.x - 0.3, b.z + 1.75 * Math.sign(b.z));
  }
}
function lantern(ctx, x, z) {
  const { w } = ctx;
  const g = propModel("lantern", { height: 1.2 }, (s) => {
    w.box(0.36, 1.2, 0.36, 0xfff1d6, 0, 0.6, 0, 0.03, s);
  });
  g.position.set(x, 0, z);
  w.scene.add(g);
  const glow = w.decal(ctx.glow, 1.6, 1.6, 0xffb05a, 0.55, true);
  glow.position.set(x, 0.03, z);
  glow.rotation.x = -Math.PI / 2;
  w.scene.add(glow);
  const halo = w.decal(ctx.glow, 0.9, 1.3, 0xffd08a, 0.5, true);
  halo.position.set(x, 0.65, z);
  (ctx.halos ||= []).push(halo);
  w.scene.add(halo);
}

// The lounge in the middle of the back row: three sofas round a long fire table whose flames dance.
function lounge(ctx) {
  const { w } = ctx,
    L = ROOF.lounge;
  const sofa = (x, z, angle) => {
    const g = propModel("lounge-sofa", { size: 2.2 }, (s) => {
      w.box(2.1, 0.4, 0.8, TEAK, 0, 0.2, 0, 0.05, s);
      w.box(2.0, 0.18, 0.7, CREAM, 0, 0.47, 0.03, 0.06, s);
      w.box(2.0, 0.4, 0.18, CREAM, 0, 0.7, -0.3, 0.06, s);
    });
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    w.scene.add(g);
  };
  sofa(L.x, L.z - 1.35, 0);
  sofa(L.x, L.z + 1.35, Math.PI);
  sofa(L.x - 1.05, L.z, Math.PI / 2);
  // The fire table: dark stone, a bed of glass beads, flames.
  w.box(0.7, 0.42, 1.5, 0x3a3533, L.x + 0.1, 0.21, L.z, 0.04);
  w.box(0.5, 0.04, 1.2, 0x9fd6e6, L.x + 0.1, 0.43, L.z, 0.01);
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = w.decal(ctx.glow, 0.32, 0.6, 0xff9a3a, 0.9, true);
    f.position.set(L.x + 0.1, 0.62, L.z - 0.48 + i * 0.24);
    w.scene.add(f);
    flames.push(f);
  }
  const fireLight = new THREE.PointLight(0xff9a50, 6, 6, 1.8);
  fireLight.position.set(L.x + 0.1, 0.9, L.z);
  w.scene.add(fireLight);
  (ctx.beats ||= []).push((time) => {
    flames.forEach((f, i) => {
      const k = 0.75 + 0.25 * Math.sin(time * 9 + i * 1.7) * Math.sin(time * 5.3 + i);
      f.scale.set(1, k, 1);
      f.position.y = 0.45 + 0.17 * k;
      f.lookAt(w.camera.position.x, f.position.y, w.camera.position.z);
    });
    fireLight.intensity = 5 + Math.sin(time * 11) * 1.2;
  });
}

// ---- the bar -------------------------------------------------------------------------------------------------------------------

// The cocktail bar at the far left end: the counter (bar-counter, its customer side to the pool), stools at its ends, a back bar
// against the end wall with lit shelves of bottles and SKY BAR in warm neon, a row of margaritas on the counter (the trays the coach
// takes), and the bartender behind it (roof-view.mjs).
function bar(ctx) {
  const { w } = ctx,
    B = ROOF.bar;
  const counter = propModel("bar-counter", { size: 3.5 }, (s) => {
    w.box(3.5, 1.05, 0.9, 0x1f5a5c, 0, 0.53, 0, 0.04, s);
    w.box(3.6, 0.06, 1.0, 0xf6f4ef, 0, 1.08, 0, 0.02, s);
  });
  counter.position.set(B.x, 0, B.z);
  w.scene.add(counter);
  for (const dx of [-1.55, 1.55]) {
    const stool = propModel("bar-stool", { height: 0.8 }, (s) => {
      w.cyl(0.2, 0.2, 0.08, CREAM, 0, 0.78, 0, s, 12);
      w.cyl(0.03, 0.03, 0.74, 0xc8a24f, 0, 0.38, 0, s, 6);
    });
    stool.position.set(B.x + dx, 0, B.z + 0.85);
    w.scene.add(stool);
  }
  // The margaritas waiting on the counter.
  for (let i = 0; i < 3; i++) {
    const glass = propModel("margarita", { height: 0.18 }, (s) => {
      w.cyl(0.07, 0.02, 0.1, 0xe8f2b0, 0, 0.13, 0, s, 10);
    });
    glass.position.set(B.x - 0.3 + i * 0.3, 1.1, B.z + 0.25);
    w.scene.add(glass);
  }
  // The back bar: dark wood, three lit shelves of bottles, mirror glow, the neon.
  const back = { x: B.x, z: -15.05 };
  w.box(4.2, 2.6, 0.4, 0x2a1d14, back.x, 1.3, back.z, 0.03);
  const shelfGlow = new THREE.MeshBasicMaterial({ color: 0xffcf8a });
  const bottles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.3, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1 }),
    60,
  );
  const colors = [0x3e8f4a, 0xb8732f, 0xe8e2c4, 0x7a2034, 0x2f5f9e, 0xd9a83a],
    c = new THREE.Color();
  for (let row = 0; row < 3; row++) {
    w.box(3.8, 0.03, 0.04, shelfGlow, back.x, 0.95 + row * 0.55, back.z + 0.2, 0);
    for (let i = 0; i < 20; i++) {
      const k = row * 20 + i;
      bottles.setMatrixAt(
        k,
        new THREE.Matrix4().setPosition(back.x - 1.75 + i * 0.185, 1.12 + row * 0.55, back.z + 0.25),
      );
      bottles.setColorAt(k, c.set(colors[(i * 7 + row * 3) % colors.length]));
    }
  }
  w.scene.add(bottles);
  const neon = w.textPlane(
    "SKY BAR",
    2.6,
    0.55,
    "#1a0f0a",
    "#ffb35c",
    back.x,
    2.95,
    back.z + 0.21,
    w.scene,
    120,
  );
  neon.material.color.setScalar(1.35);
  const bloom = w.decal(ctx.glow, 4.2, 1.6, 0xffa24a, 0.35, true);
  bloom.position.set(back.x, 2.95, back.z + 0.25);
  w.scene.add(bloom);
  ctx.barSpot = { x: B.x, z: B.z - 0.75 };
}

// ---- the DJ ---------------------------------------------------------------------------------------------------------------------

// The DJ's stage at the far right end: a lit riser, the booth (dj-booth: its front to the pool), a speaker either side, and behind
// it an LED wall that plays bars of light to the music, counts down to the drop and flashes white on it. The DJ is roof-view's.
function djStage(ctx) {
  const { w, venue } = ctx,
    D = ROOF.dj;
  // The riser, its edge lit.
  w.box(3.6, 0.25, 1.4, 0x141418, D.x, 0.125, 14.75, 0.03);
  const edge = new THREE.MeshBasicMaterial({ color: 0xff3fb4 });
  w.box(3.6, 0.04, 0.04, edge, D.x, 0.23, 14.05, 0);
  const booth = propModel("dj-booth", { size: 2.0 }, (s) => {
    w.box(2.2, 1.1, 0.8, 0x111114, 0, 0.55, 0, 0.04, s);
    w.box(2.0, 0.05, 0.02, 0xff3fb4, 0, 0.6, 0.41, 0, s);
  });
  booth.position.set(D.x, 0, D.z);
  booth.rotation.y = Math.PI; // (its front, +z in the file, to the pool)
  w.scene.add(booth);
  for (const f of venue.furniture.filter((f) => f.kind === "speaker")) {
    const sp = propModel("speaker", { height: 2.3 }, (s) => {
      w.box(0.4, 1.2, 0.4, 0x111111, 0, 1.6, 0, 0.03, s);
      w.cyl(0.02, 0.02, 1.0, 0x333333, 0, 0.5, 0, s, 6);
    });
    sp.position.set(f.x, 0, f.z);
    sp.rotation.y = Math.atan2(0 - f.x, 0 - f.z);
    w.scene.add(sp);
  }
  // The LED wall: 24 columns of light over a dark panel, driven by the beat.
  const cols = 24,
    rows = 10,
    screen = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.17, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      cols * rows,
    );
  const W0 = D.x - 2.3,
    Y0 = 0.75;
  w.box(4.9, 2.6, 0.2, 0x08080c, D.x, 0.5 + 1.3, 15.62, 0.02);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const m = new THREE.Matrix4().makeRotationY(Math.PI);
      m.setPosition(W0 + i * 0.198, Y0 + j * 0.22, 15.5);
      screen.setMatrixAt(i * rows + j, m);
    }
  screen.frustumCulled = false;
  w.scene.add(screen);
  const djLight = new THREE.PointLight(0xff4fc0, 8, 9, 1.6);
  djLight.position.set(D.x, 2.6, 13.4);
  w.scene.add(djLight);
  // Two beams sweeping up into the dusk from the stage, wilder on the drop.
  const beams = [];
  for (const dx of [-1.7, 1.7]) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.9, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8fd0ff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.geometry.translate(0, 7, 0);
    beam.position.set(D.x + dx, 0.3, 15.1);
    w.scene.add(beam);
    beams.push(beam);
  }
  const color = new THREE.Color();
  (ctx.beats ||= []).push((time, dt, sim) => {
    const d = danceAt(sim?.time || 0),
      R = sim?.roof,
      hype = R ? R.hype : 0,
      at = sim ? nextDrop(sim) : null,
      building = !!R?.warned && at != null,
      left = building ? Math.max(0, at - sim.time) : 0,
      dark = sim?.outage?.stage === "dark" ? 0.15 : 1,
      pulse = Math.exp(-d.phase * 5);
    for (let i = 0; i < cols; i++) {
      const level = building
        ? (1 - left / 8) * rows * (0.6 + 0.4 * pulse)
        : (0.35 + 0.5 * Math.abs(Math.sin(i * 0.7 + d.beats * 1.3)) + 0.3 * pulse) *
          rows *
          (hype > 0 ? 1.2 : 0.8);
      for (let j = 0; j < rows; j++) {
        const on = j < level;
        if (hype > 0) color.setHSL((i / cols + time * 0.5) % 1, 1, on ? 0.6 : 0.08);
        else if (building) color.setHSL(0.92, 1, on ? 0.55 : 0.06);
        else color.setHSL((0.55 + j * 0.03 + d.bar * 0.11) % 1, 0.9, on ? 0.5 : 0.05);
        screen.setColorAt(i * rows + j, color.multiplyScalar(dark));
      }
    }
    screen.instanceColor.needsUpdate = true;
    edge.color.setHSL((0.88 + d.bar * 0.07) % 1, 1, 0.5 * (0.6 + 0.4 * pulse) * dark);
    djLight.intensity = (hype > 0 ? 16 : 6 + 4 * pulse) * dark;
    djLight.color.setHSL(hype > 0 ? (time * 0.6) % 1 : 0.9, 1, 0.6);
    beams.forEach((b, k) => {
      const sweep = hype > 0 ? 1.4 : 0.6;
      b.rotation.z = Math.sin(time * (hype > 0 ? 2.2 : 0.7) + k * Math.PI) * 0.5 * sweep;
      b.rotation.x = -0.35 + Math.cos(time * 0.9 + k) * 0.2;
      b.material.opacity = (hype > 0 ? 0.32 : 0.14) * dark;
      b.material.color.setHSL(hype > 0 ? (time * 0.4 + k * 0.5) % 1 : 0.58, 0.9, 0.65);
    });
  });
  ctx.djSpot = { x: D.x, z: 14.35 };
}

// ---- palms, plants, the strings of lights -------------------------------------------------------------------------------------

function greenery(ctx) {
  const { w, venue } = ctx;
  for (const f of venue.furniture.filter((f) => f.kind === "palm")) {
    const g = propModel("palm-planter", { height: 3.6 }, (s) => {
      w.box(0.9, 0.9, 0.9, 0xe7e2d8, 0, 0.45, 0, 0.04, s);
      w.cyl(0.08, 0.12, 2.6, 0x8a6a45, 0, 2.1, 0, s, 6);
      w.ball(0.7, 0x4f8a3a, 0, 3.3, 0, s, [1.4, 0.4, 1.4]);
    });
    g.position.set(f.x, 0, f.z);
    g.rotation.y = f.x * 1.7 + f.z;
    w.scene.add(g);
  }
  // Potted birds of paradise either side of each lift and at the bar's end.
  for (const s of [-1, 1])
    for (const dx of [-2.75, 2.75]) {
      const g = propModel("potted-plant", { height: 1.4 }, (st) => w.ball(0.45, 0x2e6f5e, 0, 0.6, 0, st));
      g.position.set(ctx.venue.arrival.doorX + dx, 0, s * 14.9);
      w.scene.add(g);
    }
  for (const [x, z] of [
    [-12.9, -1.9],
    [-12.9, 1.9],
    [-6.9, -12.3],
    [-6.9, 12.3],
  ])
    lantern(ctx, x, z);
}

// Strings of warm bulbs hung from parasol to parasol along both rows, sagging a little, glowing more as the light goes.
function festoons(ctx) {
  const { w, venue } = ctx,
    parasols = venue.furniture.filter((f) => f.kind === "parasol"),
    rows = [ROOF.rowA, ROOF.rowB].map((x) =>
      parasols.filter((p) => Math.abs(p.x - (x - ROOF.bed.hx - 0.22)) < 0.01).sort((a, b) => a.z - b.z),
    );
  const points = [];
  for (const row of rows)
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i],
        b = row[i + 1],
        n = Math.max(6, Math.round(Math.abs(b.z - a.z) / 0.55));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        points.push([a.x, 2.45 - Math.sin(t * Math.PI) * 0.45, a.z + (b.z - a.z) * t]);
      }
    }
  if (!points.length) return;
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.05, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd79a }),
    points.length,
  );
  points.forEach(([x, y, z], i) => bulbs.setMatrixAt(i, new THREE.Matrix4().setPosition(x, y, z)));
  w.scene.add(bulbs);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0, z0] = points[i],
      [x1, y1, z1] = points[i + 1];
    if (Math.abs(z1 - z0) < 1) w.rod([x0, y0 + 0.04, z0], [x1, y1 + 0.04, z1], 0.006, 0x2a2a2a);
  }
}
