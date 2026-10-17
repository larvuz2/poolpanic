// The cruise ship on screen (18 October 2026): "Panic of the Seas", a big white cruise ship at sea in the late afternoon, its pool
// deck seen from the stern looking forward. The sim's plan is cruise-plan.mjs; the roll is ship.mjs; nothing here moves the
// simulation.
//
// The whole ship rolls (`sim.ship.angle`): the world's scene is turned about the ship's centre line (x) while the sea, the sky and
// the horizon are turned back the other way, so on screen the deck tips left and right over a level sea (the Coach Cam rides with
// the ship: there the horizon tips). The deck is honey teak with black caulking between white-painted steel; the pool lies across
// it, its near half two lap lanes (a lane rope, lane lines on the floor, starting blocks), its far half free water past a rope of
// blue and white floats with a bench step along the far wall; the water sloshes up the low end as the ship rolls. Rows of navy
// sun loungers (they slide: their places come from the ship's state each frame), the Lido Bar under a striped awning with the
// bartender, a hot tub, the stairway lobbies at the left end, glass windscreens along both sides with the sea far below, the
// ship's white hull falling away with rows of balconies and orange lifeboats on their davits, and forward the superstructure: a
// giant outdoor screen showing a cartoon, the ship's name, the bridge, a mast with signal flags and a red funnel with its smoke.
// Steamer chairs and beach balls slide and roll about the deck too (on screen only).
import { THREE } from "./kit.mjs";
import { CRUISE, LOUNGERS, loungerSpot } from "../cruise-plan.mjs";
import { rngOf } from "./geom.mjs";
import { glowTexture } from "./textures.mjs";
import {
  station,
  finRack,
  bench,
  medkitCabinet,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsTable,
} from "./props.mjs";
import { propModel } from "./prop-models.mjs";
import { roofPicture } from "./city.mjs";
import { buildCast, syncCast } from "./roof-view.mjs";
import { doorOpening } from "../spatial.mjs";

const TAU = Math.PI * 2;
export const CRUISE_WATER = -0.15; // the pool's surface (the deck is at 0)
const LANE_FLOOR = -1.75,
  FREE_FLOOR = -1.24,
  BENCH = -0.62,
  SEA = -26, // the sea, far below the pool deck
  HULL = 16.45, // the ship's sides (±z)
  STERN = -15.6, // the deck's aft edge
  BOW = 17.6, // where the superstructure rises
  NAVY = 0x1d3557,
  WHITE = 0xf4f6f7,
  CHROME = 0xd9e1e6;
const P = CRUISE,
  F = CRUISE.free;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The floor under a guest standing in the free half (scene.mjs and roof-view.mjs ask): the bench step along the far wall, then the
// floor.
export const cruiseFloorAt = (x) => {
  const t = clamp((F.x1 - 0.42 - x) / 0.3, 0, 1);
  return BENCH + (FREE_FLOOR - BENCH) * t;
};

export function buildCruise(w, venue) {
  const live = new THREE.Group();
  live.name = "cruise-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, live, rand: rngOf(83), glow: glowTexture(128) };
  w.textures.push(ctx.glow);
  w.poolUniforms = { uTime: { value: 0 }, uCaustic: { value: 1 } };
  w.chillFloorAt = cruiseFloorAt;
  // The sea runs out to the horizon, 2 km away.
  w.camera.far = 3000;
  w.camera.updateProjectionMatrix();
  materials(ctx);
  ocean(ctx);
  hull(ctx);
  deck(ctx);
  basin(ctx);
  water(ctx);
  ropes(ctx);
  rails(ctx);
  superstructure(ctx);
  lobbies(ctx);
  loungers(ctx);
  bar(ctx);
  hotTub(ctx);
  decor(ctx);
  loose(ctx);
  station(w, "chlorine", venue.stations.chlorine, 0xe7f1f6, "WATER CARE", Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xe5f2ea, "EYE CARE", Math.PI);
  finRack(w, venue.stations.fins);
  bench(w, venue.rescue.bench.x, venue.rescue.bench.z - 0.6, Math.PI / 2);
  medkitCabinet(w, venue.fixtures.medkit);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  treatsTable(w, venue.fixtures.treats);
  ctx.barSpot = { x: P.bar.x + 0.75, z: P.bar.z };
  ctx.barAngle = -Math.PI / 2;
  buildCast(w, ctx);
  w.updaters.push((time, dt, world, sim) => syncCruise(w, sim, time, dt, ctx));
}

// ---- the materials and the pictures ------------------------------------------------------------------------------------

function picture(ctx, file, material, repeat, color, extra = {}) {
  roofPicture(ctx.w, file, (t) => ((material.map = t), (material.needsUpdate = true)), {
    repeat,
    color,
    dir: "cruise",
    ...extra,
  });
}
function materials(ctx) {
  ctx.teak = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66 });
  picture(ctx, "teak.jpg", ctx.teak, [1 / 2.4, 1 / 2.4], "#b98d5c");
  ctx.paint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05 });
  picture(ctx, "ship-paint.jpg", ctx.paint, [1 / 6, 1 / 6], "#f1f3f4");
  ctx.nonskid = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  picture(ctx, "nonskid.jpg", ctx.nonskid, [1 / 1.5, 1 / 1.5], "#a9bac5");
  ctx.tile = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.04 });
  picture(ctx, "pool-tile.jpg", ctx.tile, [1 / 1.8, 1 / 1.8], "#2f9fd6");
  ctx.white = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.35 });
  ctx.navy = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.45 });
  ctx.chrome = new THREE.MeshStandardMaterial({ color: CHROME, roughness: 0.18, metalness: 0.9 });
  ctx.glass = new THREE.MeshStandardMaterial({
    color: 0x9fd3e8,
    roughness: 0.05,
    metalness: 0.3,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  ctx.darkGlass = new THREE.MeshStandardMaterial({ color: 0x1e3a4f, roughness: 0.08, metalness: 0.6 });
}

// ---- shapes ------------------------------------------------------------------------------------------------------------------

// A flat rectangle at height y with UVs in metres.
function slab(material, x0, z0, x1, z1, y = 0, parent) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + (x0 + x1) / 2, pos.getZ(i) + (z0 + z1) / 2);
  const m = new THREE.Mesh(geo, material);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// A wall from (x0, z0) to (x1, z1), y0 up to y1, UVs in metres; it faces the side its winding puts it (flip turns it round).
function wall(material, x0, z0, x1, z1, y0, y1, parent, flip = false) {
  const len = Math.hypot(x1 - x0, z1 - z0),
    geo = new THREE.PlaneGeometry(len, y1 - y0);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * (y1 - y0) + y0);
  const m = new THREE.Mesh(geo, material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0) + (flip ? Math.PI : 0);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// A picture painted on a canvas (signs, the hull's balconies, the funnel's logo).
function canvasTexture(ctx, width, height, draw, repeat = null) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  ctx.w.textures.push(t);
  return t;
}
const hasCanvas = () => typeof document !== "undefined" && !!document.createElement;

// ---- the sea and the sky ----------------------------------------------------------------------------------------------------

// The open sea, level however the ship rolls (`ctx.ocean` is turned back against the ship each frame): a deep blue plane far below
// with swell and the low sun's glitter, white water along the hull and the wake streaming aft, and the painted horizon all round.
const OCEAN_VERTEX = `
varying vec3 vWorld;
varying vec2 vLocal;
void main() {
  vLocal = position.xz;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const OCEAN_FRAGMENT = `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uHaze;
uniform float uLight;
varying vec3 vWorld;
varying vec2 vLocal;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float waves(vec2 p, float t) {
  float h = 0.0;
  h += sin(dot(p, vec2(0.021, 0.013)) + t * 0.9) * 0.9;
  h += sin(dot(p, vec2(-0.017, 0.029)) + t * 1.1) * 0.6;
  h += sin(dot(p, vec2(0.061, -0.043)) + t * 1.7) * 0.25;
  h += (noise(p * 0.09 + t * 0.12) - 0.5) * 0.8;
  h += (noise(p * 0.31 - t * 0.2) - 0.5) * 0.3;
  return h;
}
void main() {
  // (The ship steams ahead along +x: the water slides past aft.)
  vec2 p = vLocal + vec2(uTime * 7.0, 0.0);
  float t = uTime;
  float e = 0.6;
  float h = waves(p, t);
  vec3 N = normalize(vec3(-(waves(p + vec2(e, 0.0), t) - h) / e * 0.55, 1.0, -(waves(p + vec2(0.0, e), t) - h) / e * 0.55));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 color = mix(uDeep, uShallow, clamp(h * 0.25 + 0.35, 0.0, 1.0) * 0.5);
  color = mix(color, uSky, clamp(fres * 1.2, 0.0, 0.9));
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 220.0) * 2.4 + pow(max(dot(N, H), 0.0), 30.0) * 0.12;
  color += vec3(1.0, 0.86, 0.62) * glint;
  // White water: along the hull (both sides), the bow wave forward, and the wake streaming aft behind the stern.
  float side = abs(vLocal.y);
  float along = smoothstep(-40.0, -10.0, vLocal.x) * (1.0 - smoothstep(50.0, 70.0, vLocal.x));
  float hullFoam = (1.0 - smoothstep(${HULL.toFixed(1)}, ${(HULL + 6).toFixed(1)}, side)) * along;
  float wakeW = 12.0 + max(0.0, -vLocal.x - 16.0) * 0.18;
  float wake = (1.0 - smoothstep(wakeW * 0.4, wakeW, side)) * smoothstep(-15.0, -22.0, vLocal.x) * (1.0 - smoothstep(-260.0, -420.0, vLocal.x));
  float streak = smoothstep(0.45, 0.85, noise(vec2(p.x * 0.18, vLocal.y * 0.9)) * 0.7 + noise(p * 0.6) * 0.5);
  float foam = clamp(hullFoam * (0.4 + streak) + wake * streak * 0.85, 0.0, 1.0);
  color = mix(color, vec3(0.93, 0.97, 1.0), foam * 0.85);
  // Into the haze toward the horizon.
  float far = smoothstep(500.0, 1700.0, length(vLocal));
  color = mix(color, uHaze, far * 0.85);
  gl_FragColor = vec4(color * mix(0.3, 1.0, uLight), 1.0);
}`;
function ocean(ctx) {
  const { w } = ctx,
    look = w.look.cruiseSea || {};
  const group = new THREE.Group();
  group.name = "ocean";
  w.scene.add(group);
  w.liveProps.push(group);
  ctx.ocean = group;
  const geo = new THREE.CircleGeometry(1750, 96);
  geo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSun: { value: new THREE.Vector3(0.7, 0.32, 0.62) },
        uDeep: { value: new THREE.Color(look.deep ?? 0x0b3a63) },
        uShallow: { value: new THREE.Color(look.shallow ?? 0x1f6f9a) },
        uSky: { value: new THREE.Color(look.sky ?? 0x9cc6e6) },
        uHaze: { value: new THREE.Color(look.haze ?? 0xc3d7e4) },
        uLight: { value: 1 },
      },
      vertexShader: OCEAN_VERTEX,
      fragmentShader: OCEAN_FRAGMENT,
    }),
  );
  sea.position.y = SEA;
  sea.frustumCulled = false;
  sea.renderOrder = -40;
  group.add(sea);
  ctx.sea = sea;
  // The painted horizon all round: the open sea and the sky with the low sun (ocean-sky.jpg; its horizon at 55% down, laid at sea
  // level), not fogged.
  const pano = new THREE.ShaderMaterial({
    uniforms: { map: { value: null } },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture2D(map, vec2(vUv.x * 2.0, vUv.y)).rgb, 1.0); }`,
  });
  pano.visible = false;
  roofPicture(
    w,
    "ocean-sky.jpg",
    (t, real) => {
      pano.uniforms.map.value = t;
      pano.visible = real;
    },
    { dir: "cruise" },
  );
  const R = 1800,
    H = 900,
    panorama = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), pano);
  panorama.position.y = SEA + H / 2 - 0.45 * H;
  panorama.rotation.y = 0.9;
  panorama.renderOrder = -50;
  panorama.frustumCulled = false;
  group.add(panorama);
}

// ---- the hull --------------------------------------------------------------------------------------------------------------

// The ship's white sides falling away from the deck to the sea, with rows of balcony doors; a blue band at the waterline; the
// orange lifeboats on their davits a few decks down.
function hull(ctx) {
  const { w, live } = ctx;
  const sides = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  if (hasCanvas())
    sides.map = canvasTexture(
      ctx,
      512,
      256,
      (g, W, Hh) => {
        g.fillStyle = "#f3f5f6";
        g.fillRect(0, 0, W, Hh);
        // Two decks of balconies per tile: tinted doors, white dividers, glass rails.
        for (const y0 of [0, Hh / 2]) {
          for (let i = 0; i < 8; i++) {
            const x0 = (i * W) / 8;
            g.fillStyle = "#28465d";
            g.fillRect(x0 + 6, y0 + 18, W / 8 - 12, Hh / 2 - 46);
            g.fillStyle = "rgba(170,215,235,0.55)";
            g.fillRect(x0 + 6, y0 + Hh / 2 - 44, W / 8 - 12, 22);
            g.fillStyle = "#dfe5e8";
            g.fillRect(x0, y0 + 10, 5, Hh / 2 - 22);
          }
          g.fillStyle = "#e6eaec";
          g.fillRect(0, y0 + Hh / 2 - 22, W, 8);
        }
      },
      [6, 4],
    );
  for (const s of [-1, 1]) {
    // The side, from the deck's edge down to the sea (the balconies, then a blue band at the waterline).
    const m = wall(sides, STERN, s * HULL, BOW + 18, s * HULL, SEA - 2, -0.6, ctx.w.scene, s > 0);
    if (sides.map) {
      const uv = m.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 34, uv.getY(i) / 22);
    }
    w.box(BOW + 18 - STERN, 2.2, 0.2, NAVY, (STERN + BOW + 18) / 2, SEA + 0.6, s * (HULL + 0.05), 0);
    // The bulwark: the deck's own edge, a rounded white cap.
    w.box(BOW + 18 - STERN, 0.65, 0.4, ctx.paint, (STERN + BOW + 18) / 2, -0.3, s * (HULL - 0.15), 0.05);
    // The lifeboats on their davits, two decks down, along both sides.
    for (const x of [-10.5, -2.5, 5.5, 13.5]) {
      const boat = propModel("lifeboat", { height: 2.6 }, (st) => {
        w.box(2.9, 1.6, 8.0, 0xff6a1f, 0, 0.8, 0, 0.6, st);
        w.box(2.4, 0.9, 6.6, WHITE, 0, 1.9, 0, 0.4, st);
      });
      boat.position.set(x, -7.4, s * (HULL + 1.9));
      live.add(boat);
      for (const dx of [-3.1, 3.1]) {
        w.box(0.25, 3.4, 0.25, ctx.paint, x + dx, -6.4, s * (HULL + 0.4), 0.05);
        w.box(0.25, 0.25, 2.2, ctx.paint, x + dx, -4.8, s * (HULL + 1.3), 0.05);
      }
    }
  }
  // The stern: the deck's aft edge drops to a lower deck (the camera's side).
  w.box(0.4, 0.65, HULL * 2, ctx.paint, STERN - 0.2, -0.3, 0, 0.05);
  slab(ctx.teak, STERN - 7, -HULL, STERN - 0.4, HULL, -3.2, ctx.w.scene);
  wall(ctx.paint, STERN - 0.4, -HULL, STERN - 0.4, HULL, -3.2, -0.6, ctx.w.scene, true);
}

// ---- the deck ----------------------------------------------------------------------------------------------------------------

function deck(ctx) {
  const { w } = ctx,
    D = P.deck,
    s = w.scene;
  const px0 = -P.halfX - 0.3,
    px1 = F.x1 + 0.3,
    pz = P.halfZ + 0.3;
  // Teak round the pool (four slabs, so none lies under the water).
  slab(ctx.teak, STERN, -HULL, px0, HULL, 0, s);
  slab(ctx.teak, px1, -HULL, BOW, HULL, 0, s);
  slab(ctx.teak, px0, -HULL, px1, -pz, 0, s);
  slab(ctx.teak, px0, pz, px1, HULL, 0, s);
  // Blue-grey non-skid walks along the rails.
  for (const z of [-1, 1]) slab(ctx.nonskid, STERN, z < 0 ? -HULL : HULL - 0.75, BOW, z < 0 ? -HULL + 0.75 : HULL, 0.004, s);
  // The coping round the whole pool: white, with a navy inlay.
  const c = ctx.white;
  w.box(0.3, 0.06, pz * 2, c, px0 + 0.15, 0.03, 0, 0.01);
  w.box(0.3, 0.06, pz * 2, c, px1 - 0.15, 0.03, 0, 0.01);
  for (const z of [-1, 1]) w.box(px1 - px0, 0.06, 0.3, c, (px0 + px1) / 2, 0.03, z * (pz - 0.15), 0.01);
  for (const z of [-1, 1]) w.box(px1 - px0 - 0.6, 0.065, 0.05, ctx.navy, (px0 + px1) / 2, 0.035, z * (pz - 0.15), 0);
  // The deck's name, painted on the near walk: LIDO DECK 14.
  if (hasCanvas()) {
    const sign = new THREE.MeshBasicMaterial({
      map: canvasTexture(ctx, 512, 96, (g, W, H) => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = "rgba(29,53,87,0.82)";
        g.font = "bold 64px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("LIDO · DECK 14", W / 2, H / 2 + 4);
      }),
      transparent: true,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.0), sign);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.PI / 2;
    m.position.set(-4.65, 0.008, 11.8);
    s.add(m);
  }
}

// ---- the pool ----------------------------------------------------------------------------------------------------------------

const CAUSTIC = `
float causticLayer(vec2 p, float t) {
  float a = sin(p.x * 2.1 + sin(p.y * 1.3 + t * 0.8) * 1.4 + t * 0.6);
  float b = sin(p.y * 2.3 + sin(p.x * 1.7 - t * 0.7) * 1.3 - t * 0.5);
  return pow(max(0.0, 1.0 - abs(a + b) * 0.85), 6.0);
}
float caustic(vec2 p, float t) {
  return causticLayer(p * 1.25, t) * 0.75 + causticLayer(p * 2.2 + 3.1, t * 1.25) * 0.45;
}`;
function basin(ctx) {
  const { w } = ctx,
    s = w.scene,
    tile = ctx.tile,
    u = w.poolUniforms,
    hz = P.halfZ,
    x0 = -P.halfX,
    xr = P.halfX,
    x1 = F.x1;
  tile.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uCaustic = u.uCaustic;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTileW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvTileW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTileW;\nuniform float uTime;\nuniform float uCaustic;\n" + CAUSTIC)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.55, 0.95, 1.0) * caustic(vTileW.xz, uTime) * uCaustic * 0.3;`,
      );
  };
  tile.customProgramCacheKey = () => "cruise-tile";
  // The lane half: deep, with lane lines on the floor; the free half: shallower, a bench step along the far wall.
  slab(tile, x0, -hz, xr, hz, LANE_FLOOR, s);
  slab(tile, xr, -hz, x1, hz, FREE_FLOOR, s);
  wall(tile, xr, -hz, xr, hz, LANE_FLOOR, FREE_FLOOR, s, true);
  wall(tile, x0, -hz, x0, hz, LANE_FLOOR, 0, s, false);
  wall(tile, x1, hz, x1, -hz, FREE_FLOOR, 0, s, false);
  for (const z of [-1, 1]) {
    wall(tile, x0, z * hz, xr, z * hz, LANE_FLOOR, 0, s, z > 0);
    wall(tile, xr, z * hz, x1, z * hz, FREE_FLOOR, 0, s, z > 0);
  }
  slab(tile, x1 - 0.42, -hz, x1, hz, BENCH, s);
  wall(tile, x1 - 0.42, hz, x1 - 0.42, -hz, FREE_FLOOR, BENCH, s, true);
  // Lane lines: a dark blue stripe down each lane with a T at each end.
  const line = new THREE.MeshStandardMaterial({ color: 0x173d73, roughness: 0.4 });
  for (const x of P.lanes) {
    w.box(0.25, 0.012, hz * 2 - 2.4, line, x, LANE_FLOOR + 0.008, 0, 0);
    for (const z of [-1, 1]) w.box(1.0, 0.012, 0.25, line, x, LANE_FLOOR + 0.008, z * (hz - 1.2), 0);
  }
  // A band of light under the coping, all round.
  const band = new THREE.MeshBasicMaterial({ color: 0x8ff3ff, transparent: true, opacity: 0.7 });
  ctx.poolBand = band;
  w.box(0.04, 0.05, hz * 2, band, x0 + 0.03, -0.42, 0, 0);
  w.box(0.04, 0.05, hz * 2, band, x1 - 0.03, -0.42, 0, 0);
  for (const z of [-1, 1]) w.box(x1 - x0, 0.05, 0.04, band, (x0 + x1) / 2, -0.42, z * (hz - 0.03), 0);
  // Starting blocks at the left end of each lane; chrome ladders into the lanes on the near side and into the free half.
  for (const [i, x] of P.lanes.entries()) {
    w.box(0.62, 0.62, 0.56, ctx.white, x, 0.31, -9.15, 0.05);
    w.box(0.66, 0.06, 0.6, ctx.navy, x, 0.64, -9.17, 0.03);
    if (hasCanvas()) {
      const num = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({
          map: canvasTexture(ctx, 64, 64, (g) => {
            g.fillStyle = "#1d3557";
            g.fillRect(0, 0, 64, 64);
            g.fillStyle = "#ffffff";
            g.font = "bold 48px sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText(String(i + 1), 32, 35);
          }),
        }),
      );
      num.position.set(x, 0.34, -8.86);
      s.add(num);
    }
  }
  for (const [x, z, face] of [
    [-P.halfX + 0.3, -5.6, 1],
    [-P.halfX + 0.3, 5.6, 1],
    [F.x1 - 0.3, -5.6, -1],
    [F.x1 - 0.3, 5.6, -1],
  ])
    for (const dz of [-0.28, 0.28]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 12, Math.PI), ctx.chrome);
      rail.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
      rail.position.set(x - face * 0.12, 0.05, z + dz);
      s.add(rail);
    }
}

// The water: bright turquoise over the blue mosaic, sparkling, rings round everyone in it, and sloshing: the surface tips against
// the roll and stands up at the low end (`uSlosh`, m at the +z end, from the ship's state).
const MAX_RIPPLES = 16;
const WATER_VERTEX = `
uniform float uSlosh;
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  float k = p.z / ${P.halfZ.toFixed(2)};
  p.y += uSlosh * k + sin(k * 3.14159 * 1.5 + uTime * 2.2) * abs(uSlosh) * 0.12;
  vec4 world = modelMatrix * vec4(p, 1.0);
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
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uSlosh;
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
  float slope = uSlosh / ${P.halfZ.toFixed(2)};
  float gx = cos(p.x * 1.9 + t * 0.7) * cos(p.y * 1.4 + t * 0.5) * 0.03 + cos(p.x * 4.3 + p.y * 1.9 - t * 1.4) * 0.014;
  float gz = -sin(p.x * 1.9 + t * 0.7) * sin(p.y * 1.4 + t * 0.5) * 0.024 + cos(p.y * 3.9 - p.x * 1.2 + t * 1.2) * 0.012 + slope * 2.5;
  vec3 N = normalize(vec3(-gx - rx * 0.04, 1.0, -gz - rz * 0.04));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  // Deeper over the lanes (x below the rope), lighter over the free half.
  float lanes = 1.0 - smoothstep(${(P.halfX - 0.4).toFixed(2)}, ${(P.halfX + 0.4).toFixed(2)}, p.x);
  vec3 color = mix(uShallow, uDeep, 0.35 + lanes * 0.4);
  color = mix(color, vec3(0.40, 0.61, 0.24), uDirty);
  color = mix(color, vec3(0.38, 0.20, 0.07), uBrown * 0.88);
  color = mix(color, vec3(0.93, 0.82, 0.18), uYellow * 0.7);
  float clean = 1.0 - uBrown * 0.8;
  color += vec3(0.7, 1.0, 1.0) * caustic(p * 0.8, t * 0.7) * 0.08 * clean * uLight;
  color = mix(color, uSky * uLight, clamp(fres * 0.9, 0.0, 0.7) * clean);
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 300.0) * 2.0 + pow(max(dot(N, H), 0.0), 40.0) * 0.15;
  color += uGlint * glint * clean * uLight;
  // White froth where the water stands up against the low end.
  float edge = smoothstep(${(P.halfZ - 1.4).toFixed(2)}, ${P.halfZ.toFixed(2)}, p.y * sign(uSlosh)) * smoothstep(0.12, 0.4, abs(uSlosh));
  color = mix(color, vec3(0.95, 1.0, 1.0) * uLight, edge * 0.6);
  color += vec3(0.3, 0.9, 1.0) * uGlow * 0.1;
  color *= mix(0.25, 1.0, uLight);
  float clear = uClarity * (1.0 - max(max(uDirty, uBrown), uYellow));
  float alpha = mix(0.82, 0.55, clear) + fres * 0.14 + uDirty * 0.2 + uBrown * 0.2;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}`;
function water(ctx) {
  const { w } = ctx,
    look = w.look.water;
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0));
  const x0 = -P.halfX,
    x1 = F.x1;
  const geo = new THREE.PlaneGeometry(x1 - x0, P.halfZ * 2, 4, 40);
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
        uSun: { value: new THREE.Vector3(0.7, 0.5, 0.6) },
        uShallow: { value: new THREE.Vector3(...look.shallow) },
        uDeep: { value: new THREE.Vector3(...look.deep) },
        uSky: { value: new THREE.Vector3(...(look.sky || [0.8, 0.9, 1])) },
        uGlint: { value: new THREE.Vector3(...(look.glint || [1, 0.9, 0.7])) },
        uGlow: { value: look.glow || 0 },
        uClarity: { value: look.clarity || 0 },
        uRipples: { value: ripples },
        uSlosh: { value: 0 },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    }),
  );
  w.water.position.set((x0 + x1) / 2, CRUISE_WATER, 0);
  w.water.renderOrder = 2;
  w.water.frustumCulled = false;
  w.scene.add(w.water);
  w.poolLamps = null;
  ctx.ripples = ripples;
}

// The rope of floats between the lanes and the free half (blue and white), and the lane rope between the two lanes (red, white and
// blue). Instanced floats, riding the slosh.
function ropes(ctx) {
  const { w, live } = ctx,
    n = Math.round((P.halfZ * 2) / 0.32),
    geo = new THREE.CylinderGeometry(0.075, 0.075, 0.24, 10);
  geo.rotateX(Math.PI / 2);
  ctx.ropes = [];
  for (const [x, colors] of [
    [P.halfX, [0x1f5fbf, 0xffffff]],
    [0, [0xd8312f, 0xffffff, 0x1f5fbf]],
  ]) {
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4 }), n);
    const m = new THREE.Matrix4(),
      c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const z = -P.halfZ + 0.16 + i * 0.32;
      m.makeTranslation(x, CRUISE_WATER + 0.02, z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHex(colors[Math.floor(i / 3) % colors.length]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    live.add(mesh);
    ctx.ropes.push({ mesh, x, n });
    // The rope's hooks in the end walls.
    for (const s of [-1, 1]) w.box(0.12, 0.1, 0.12, ctx.chrome, x, -0.05, s * (P.halfZ - 0.05), 0.02);
  }
}

// ---- the rails ------------------------------------------------------------------------------------------------------------------

// Glass windscreens along both sides and across the stern: frameless panels on chrome posts with a teak handrail.
function rails(ctx) {
  const { w } = ctx,
    s = w.scene,
    y0 = 0.05,
    y1 = 1.15;
  for (const side of [-1, 1]) {
    const z = side * (HULL - 0.3);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(BOW - STERN, y1 - y0), ctx.glass);
    glass.position.set((STERN + BOW) / 2, (y0 + y1) / 2, z);
    s.add(glass);
    w.box(BOW - STERN, 0.08, 0.14, ctx.teak, (STERN + BOW) / 2, y1 + 0.04, z, 0.03);
    for (let x = STERN + 0.2; x <= BOW; x += 2.4) w.box(0.06, y1, 0.06, ctx.chrome, x, y1 / 2, z, 0.02);
  }
  const x = STERN + 0.3;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(HULL * 2 - 0.6, y1 - y0), ctx.glass);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(x, (y0 + y1) / 2, 0);
  s.add(glass);
  w.box(0.14, 0.08, HULL * 2 - 0.6, ctx.teak, x, y1 + 0.04, 0, 0.03);
}

// ---- the superstructure ----------------------------------------------------------------------------------------------------

// Forward of the deck: tiers of white with bands of blue glass, the giant outdoor screen, the ship's name, the bridge across the
// top with its wings, a mast dressed with signal flags, and the funnel (red, white band, black top) with its smoke.
function superstructure(ctx) {
  const { w, live } = ctx,
    s = w.scene;
  const tiers = [
    [BOW, 0, 4.4, 15.6],
    [BOW + 1.2, 4.4, 8.8, 15.0],
    [BOW + 2.6, 8.8, 13.2, 14.2],
  ];
  for (const [x, y0, y1, hz] of tiers) {
    w.box(18, y1 - y0, hz * 2, ctx.paint, x + 9, (y0 + y1) / 2, 0, 0.1);
    // A band of blue glass along the face, a white sill under it.
    w.box(0.08, (y1 - y0) * 0.5, hz * 2 - 1.2, ctx.darkGlass, x - 0.02, y0 + (y1 - y0) * 0.55, 0, 0);
    w.box(0.3, 0.12, hz * 2, ctx.white, x - 0.1, y0 + (y1 - y0) * 0.27, 0, 0.03);
  }
  // The café's glass front at deck level, with doors.
  for (let z = -14; z <= 14; z += 2)
    w.box(0.08, 3.6, 0.06, ctx.chrome, BOW - 0.05, 1.8, z, 0);
  // The giant screen (16:9), on the second tier's face, the movie playing.
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  roofPicture(w, "movie.jpg", (t) => ((screenMat.map = t), (screenMat.needsUpdate = true)), {
    dir: "cruise",
    color: "#e9a07a",
    wrap: THREE.ClampToEdgeWrapping,
  });
  const sw = 12.8,
    sh = 7.2;
  w.box(0.4, sh + 0.5, sw + 0.5, 0x15181c, BOW + 0.9, 4.6 + sh / 2, 0, 0.08);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(BOW + 0.68, 4.6 + sh / 2, 0);
  live.add(screen);
  ctx.screen = screenMat;
  // The ship's name across the third tier.
  if (hasCanvas()) {
    const name = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 1.6),
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: canvasTexture(ctx, 1024, 102, (g, W, H) => {
          g.clearRect(0, 0, W, H);
          g.fillStyle = "#1d3557";
          g.font = "bold 78px Georgia, serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("PANIC OF THE SEAS", W / 2, H / 2 + 4);
        }),
      }),
    );
    name.rotation.y = -Math.PI / 2;
    name.position.set(BOW + 2.5, 12.15, 0);
    s.add(name);
  }
  // The bridge across the top, its wings out past the sides, dark windows all round.
  const bx = BOW + 6;
  w.box(7, 3, 36, ctx.paint, bx + 3.5, 14.7, 0, 0.1);
  w.box(0.1, 1.3, 35, ctx.darkGlass, bx - 0.02, 15.0, 0, 0);
  w.box(7.2, 0.25, 36.4, NAVY, bx + 3.5, 16.3, 0, 0.05);
  // The mast with its radar, and the signal flags strung from it down to the deck's forward corners.
  const mx = bx + 4;
  w.cyl(0.18, 0.28, 12, ctx.white, mx, 22.2, 0);
  w.box(0.2, 0.2, 5, ctx.white, mx, 25.5, 0, 0.03);
  w.ball(1.2, ctx.white, mx, 29.2, 0);
  const radar = w.box(0.25, 0.25, 3.4, 0x31363b, mx, 27, 0, 0.03);
  ctx.radar = radar;
  live.add(radar);
  const flags = new THREE.Group();
  live.add(flags);
  ctx.flagLines = [];
  const colors = [0xd8312f, 0xffd23f, 0x1f5fbf, 0xffffff, 0x2a9d48, 0xf47c20, 0x111111];
  for (const side of [-1, 1]) {
    const a = new THREE.Vector3(mx, 28, side * 0.2),
      b = new THREE.Vector3(BOW - 0.6, 4.2, side * 14.8),
      n = 26;
    for (let i = 1; i < n; i++) {
      const t = i / n,
        p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 2.4;
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.7),
        new THREE.MeshStandardMaterial({ color: colors[(i + side) % colors.length], side: THREE.DoubleSide, roughness: 0.8 }),
      );
      flag.position.copy(p);
      flag.position.y -= 0.35;
      flag.rotation.y = Math.PI / 2 + side * 0.4;
      flags.add(flag);
      ctx.flagLines.push({ flag, base: flag.rotation.y, phase: i * 0.7 + side });
    }
  }
  // The funnel: an oval stack raked back, red with a white band and a black top, our wave on its sides.
  const fx = bx + 9;
  const funnelGeo = new THREE.CylinderGeometry(2.0, 2.5, 8.5, 32);
  funnelGeo.scale(1.45, 1, 1);
  const red = new THREE.MeshStandardMaterial({ color: 0xc8202e, roughness: 0.45 });
  const funnel = new THREE.Mesh(funnelGeo, red);
  funnel.position.set(fx, 20.4, 0);
  funnel.rotation.z = 0.12;
  s.add(funnel);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.18, 1.3, 32), ctx.white);
  band.scale.set(1.45, 1, 1);
  band.position.set(fx - 0.25, 19.2, 0);
  band.rotation.z = 0.12;
  s.add(band);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.02, 0.9, 32), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 }));
  cap.scale.set(1.45, 1, 1);
  cap.position.set(fx + 0.5, 24.45, 0);
  cap.rotation.z = 0.12;
  s.add(cap);
  ctx.funnelTop = new THREE.Vector3(fx + 0.6, 25.2, 0);
  // Smoke: soft puffs drifting aft from the funnel.
  const smokeMat = new THREE.SpriteMaterial({ map: ctx.glow, color: 0xd9dde2, transparent: true, opacity: 0.4, depthWrite: false });
  ctx.smoke = Array.from({ length: 14 }, (_, i) => {
    const sp = new THREE.Sprite(smokeMat.clone());
    sp.userData.t = i / 14;
    live.add(sp);
    return sp;
  });
}

// ---- the stairway lobbies --------------------------------------------------------------------------------------------------

// Two glass deckhouses at the left end where the guests come up from below, each with a sliding glass door on its inner side.
function lobbies(ctx) {
  const { w, venue, live } = ctx,
    a = venue.arrival;
  ctx.doors = [];
  for (const side of [-1, 1]) {
    const x0 = side * 9.6,
      x1 = side * 13.6,
      z0 = -15.4,
      z1 = -13.3,
      cx = (x0 + x1) / 2;
    // Glass box on a white frame, a white roof with a navy fascia.
    w.box(4.0, 0.25, 2.1, ctx.paint, cx, 3.0, (z0 + z1) / 2, 0.06);
    w.box(4.1, 0.12, 2.2, ctx.navy, cx, 2.84, (z0 + z1) / 2, 0.02);
    for (const [x, z] of [
      [x0, z0],
      [x0, z1],
      [x1, z0],
      [x1, z1],
    ])
      w.box(0.12, 2.9, 0.12, ctx.white, x, 1.45, z, 0.02);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.8), ctx.glass);
    glass.position.set(cx, 1.4, z1);
    w.scene.add(glass);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.8), ctx.glass);
    back.rotation.y = Math.PI / 2;
    back.position.set(x1, 1.4, (z0 + z1) / 2);
    w.scene.add(back);
    // The stairs inside, going down.
    for (let i = 0; i < 5; i++) w.box(1.6, 0.12, 0.3, ctx.teak, cx + side * 0.6, -i * 0.28, z0 + 0.4 + i * 0.3, 0.01);
    // A sign: STAIRS.
    if (hasCanvas()) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.36),
        new THREE.MeshBasicMaterial({
          map: canvasTexture(ctx, 256, 58, (g, W, H) => {
            g.fillStyle = "#1d3557";
            g.fillRect(0, 0, W, H);
            g.fillStyle = "#ffffff";
            g.font = "bold 34px sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText("⇩ STAIRS", W / 2, H / 2 + 2);
          }),
        }),
      );
      sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      sign.position.set(x0 + side * -0.02, 2.55, a.doorZ);
      w.scene.add(sign);
    }
    // The sliding door: a glass leaf that slides back along z.
    const leaf = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), ctx.glass);
    pane.rotation.y = Math.PI / 2;
    leaf.add(pane);
    w.box(0.06, 2.3, 0.06, ctx.chrome, 0, 0, -0.57, 0, leaf);
    w.box(0.06, 2.3, 0.06, ctx.chrome, 0, 0, 0.57, 0, leaf);
    leaf.position.set(x0, 1.15, a.doorZ);
    live.add(leaf);
    ctx.doors.push({ side, leaf, z: a.doorZ });
  }
}

// ---- the loungers -------------------------------------------------------------------------------------------------------------

// Every lounger (the ship's state says where each is), with a rolled towel when free, a spread one under a guest, a crumpled one
// and an empty glass when messy; furled navy umbrellas in deck sockets between the pairs (they never slide).
function loungers(ctx) {
  const { w, live } = ctx,
    towel = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
    stripe = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.95 });
  ctx.loungers = LOUNGERS.map((l) => {
    const spot = loungerSpot(null, l.id);
    const g = new THREE.Group();
    g.position.set(spot.x, 0, spot.z);
    live.add(g);
    const model = propModel("cruise-lounger", { height: 0.85 }, (st) => {
      w.box(0.72, 0.12, 1.9, WHITE, 0, 0.38, 0.05, 0.04, st);
      w.box(0.72, 0.08, 0.7, NAVY, 0, 0.62, -0.7, 0.03, st).rotation.x = -0.7;
    });
    // (The file lies along z, its back at -z: turned so its foot points the way its guest looks.)
    model.rotation.y = spot.angle;
    g.add(model);
    const rolled = new THREE.Group();
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12), towel);
    r.rotation.x = Math.PI / 2;
    rolled.add(r);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.08, 12), stripe);
    b.rotation.x = Math.PI / 2;
    rolled.add(b);
    rolled.position.set(Math.sin(spot.angle) * 0.75, 0.48, 0);
    g.add(rolled);
    const spread = new THREE.Group();
    w.box(0.6, 0.02, 1.7, towel, 0, 0.47, 0, 0.01, spread);
    w.box(0.6, 0.022, 0.12, stripe, 0, 0.475, 0.6, 0, spread);
    spread.rotation.y = spot.angle;
    g.add(spread);
    const crumpled = new THREE.Group();
    w.ball(0.2, towel, Math.sin(spot.angle) * 0.2, 0.52, 0.05, crumpled, [1.4, 0.45, 1.1]);
    const empty = propModel("margarita", { height: 0.16 });
    empty.position.set(Math.sin(spot.angle) * 0.6, 0.44, 0.15);
    empty.rotation.z = 1.4;
    crumpled.add(empty);
    g.add(crumpled);
    return { g, rolled, spread, crumpled, x: spot.x, vz: 0 };
  });
  // Furled umbrellas between the pairs, on the head side.
  for (const row of P.rows)
    for (let i = 0; i < row.homes.length; i += 2) {
      const z = (row.homes[i] + row.homes[i + 1]) / 2,
        x = row.x - row.facing * 1.15;
      const u = new THREE.Group();
      w.cyl(0.035, 0.035, 2.4, 0xb5874f, 0, 1.2, 0, u, 6);
      w.cyl(0.02, 0.17, 1.35, NAVY, 0, 1.75, 0, u, 10);
      w.cyl(0.16, 0.16, 0.06, ctx.white, 0, 0.03, 0, u, 12);
      u.position.set(x, 0, z);
      ctx.w.scene.add(u);
    }
}

// ---- the Lido Bar, the hot tub and the rest ---------------------------------------------------------------------------------

function bar(ctx) {
  const { w, live } = ctx,
    B = P.bar;
  const kiosk = propModel("pool-bar", { height: 2.8 }, (st) => {
    w.box(3.0, 1.15, 3.0, WHITE, 0, 0.58, 0, 0.05, st);
    w.box(3.2, 0.08, 3.2, 0xb5874f, 0, 1.18, 0, 0.02, st);
    w.box(3.4, 0.2, 3.4, NAVY, 0, 2.7, 0, 0.05, st);
  });
  // (Its serving side, +z in the file, to the pool.)
  kiosk.rotation.y = -Math.PI / 2;
  kiosk.position.set(B.x, 0, B.z);
  live.add(kiosk);
  for (const dz of [-1.25, 1.25]) {
    const stool = propModel("bar-stool", { height: 0.8 }, (st) => w.cyl(0.2, 0.2, 0.75, 0xb5874f, 0, 0.38, 0, st));
    stool.position.set(B.x - B.hx - 0.35, 0, B.z + dz);
    live.add(stool);
  }
  for (const dz of [-0.7, -0.3, 0.6]) {
    const glass = propModel("margarita", { height: 0.18 }, (st) => w.cyl(0.07, 0.02, 0.12, 0xe8f2b0, 0, 0.1, 0, st, 10));
    glass.position.set(B.x - 1.42, 1.18, B.z + dz);
    live.add(glass);
  }
}
function hotTub(ctx) {
  const { w, live } = ctx;
  for (const t of P.tubs) {
    w.cyl(t.r, t.r + 0.05, 0.55, ctx.teak, t.x, 0.27, t.z, w.scene, 32);
    w.cyl(t.r + 0.06, t.r + 0.06, 0.06, ctx.white, t.x, 0.56, t.z, w.scene, 32);
    const tub = new THREE.Mesh(
      new THREE.CircleGeometry(t.r - 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x7fe3f0, roughness: 0.1, metalness: 0.2, emissive: 0x1b8ea3, emissiveIntensity: 0.35 }),
    );
    tub.rotation.x = -Math.PI / 2;
    tub.position.set(t.x, 0.5, t.z);
    live.add(tub);
    ctx.tubWater = tub;
    // Bubbles.
    const bubbles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
      40,
    );
    bubbles.frustumCulled = false;
    live.add(bubbles);
    ctx.bubbles = { mesh: bubbles, t };
  }
}
function decor(ctx) {
  const { w, venue, live } = ctx;
  const put = (name, fit, x, z, angle, fallback) => {
    const g = propModel(name, fit, fallback);
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    live.add(g);
    return g;
  };
  for (const f of venue.furniture) {
    if (f.kind === "ship-bell") {
      ctx.bell = put("ship-bell", { height: 1.6 }, f.x, f.z, Math.PI, (st) => {
        w.cyl(0.05, 0.05, 1.4, WHITE, 0, 0.7, 0, st, 8);
        w.cyl(0.08, 0.2, 0.3, 0xc99a3a, 0, 1.25, 0.25, st, 12);
      });
    } else if (f.kind === "lifejacket-box")
      put("lifejacket-box", { height: 0.84 }, f.x, f.z, f.z > 0 ? Math.PI : 0, (st) =>
        w.box(1.3, 0.8, 0.8, WHITE, 0, 0.4, 0, 0.06, st),
      );
    else if (f.kind === "towel-cart")
      put("towel-cart", { height: 1.05 }, f.x, f.z, Math.PI / 2, (st) => w.box(1.2, 1.0, 0.6, CHROME, 0, 0.5, 0, 0.03, st));
    else if (f.kind === "palm")
      put("palm-planter", { height: 3.6 }, f.x, f.z, f.x + f.z, (st) => {
        w.box(0.9, 0.9, 0.9, WHITE, 0, 0.45, 0, 0.04, st);
        w.ball(0.7, 0x4f8a3a, 0, 3.0, 0, st, [1.4, 0.4, 1.4]);
      });
  }
  // Two open umbrellas over the deck chairs by the bell, and a few potted plants by the lobbies.
  for (const [x, z] of [
    [3.4, 13.4],
    [7.4, 12.2],
  ])
    put("deck-umbrella", { height: 2.6 }, x, z, 0.3, (st) => w.cyl(0.02, 1.2, 0.5, NAVY, 0, 2.3, 0, st, 10));
  for (const x of [-8.2, 8.2]) put("potted-plant", { height: 1.3 }, x, -15.0, 0, (st) => w.ball(0.4, 0x2e6f5e, 0, 0.6, 0, st));
}

// Things that slide and roll about the deck as the ship rolls (on screen only): steamer chairs and beach balls, and a ball afloat
// in the free half.
function loose(ctx) {
  const { w, live } = ctx;
  ctx.loose = [];
  for (const [x, z, a, lo, hi] of [
    [3.0, 11.6, 0.1, 9.4, 15.2],
    [4.6, 12.4, -0.2, 9.4, 15.2],
    [6.2, 11.4, 0.25, 9.4, 15.2],
    [8.0, 13.6, -0.1, 9.4, 15.2],
    [5.6, -12.6, 2.9, -15.2, -9.4],
    [7.6, -11.8, 3.3, -15.2, -9.4],
  ]) {
    const g = propModel("steamer-chair", { height: 1.0 }, (st) => {
      w.box(0.6, 0.12, 1.4, 0xb5874f, 0, 0.35, 0, 0.03, st);
      w.box(0.55, 0.06, 1.3, NAVY, 0, 0.44, 0, 0.02, st);
    });
    g.position.set(x, 0, z);
    g.rotation.y = a;
    live.add(g);
    ctx.loose.push({ g, z, vz: 0, lo, hi, rub: 0.08, kind: "chair", spin: 0 });
  }
  const ballMat = (i) =>
    new THREE.MeshStandardMaterial({ color: [0xd8312f, 0xffd23f, 0x1f8fd8][i % 3], roughness: 0.4 });
  for (const [i, x, z, lo, hi] of [
    [0, -6.0, 10.8, 9.2, 15.2],
    [1, 2.2, -12.2, -15.2, -9.5],
  ]) {
    const b = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), ballMat(i));
    b.add(s);
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.252, 16, 12, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
    );
    b.add(white);
    b.position.set(x, 0.25, z);
    live.add(b);
    ctx.loose.push({ g: b, z, vz: 0, lo, hi, rub: 0.012, kind: "ball", spin: 0 });
  }
  const afloat = new THREE.Group();
  afloat.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), ballMat(1)));
  afloat.position.set(7.0, CRUISE_WATER + 0.12, 2.0);
  live.add(afloat);
  ctx.afloat = { g: afloat, z: 2.0, vz: 0 };
}

// ---- every frame ----------------------------------------------------------------------------------------------------------------

function syncCruise(w, sim, time, dt, ctx) {
  const S = sim?.ship,
    angle = S?.angle || 0,
    motion = w.reducedMotion?.matches ? 0 : 1;
  // The roll: the ship turns about its centre line; the sea and the sky are turned back, so they stay level.
  w.scene.rotation.x = angle;
  w.scene.updateMatrix();
  w.scene.matrixWorld.copy(w.scene.matrix);
  ctx.ocean.rotation.x = -angle;
  if (w.sky?.group) {
    if (w.sky.group.parent !== ctx.ocean) ctx.ocean.add(w.sky.group);
  }
  const light = w.water?.material.uniforms.uLight.value ?? 1;
  ctx.sea.material.uniforms.uTime.value = time;
  ctx.sea.material.uniforms.uLight.value = light;
  // The pool's water: the slosh, and the rings round everyone in it.
  if (w.water) {
    w.water.material.uniforms.uSlosh.value = (S?.slosh || 0) * 1.6;
    const ripples = ctx.ripples,
      stirring = (sim?.people || [])
        .filter((p) => p.status === "swim" || p.status === "fell-in" || (p.status === "exit" && p.exitPhase === "water"))
        .map((p) => ({ p, k: 0.3 + Math.min(1, (p.actualSpeed || 0) * 1.2) + (p.status === "fell-in" ? 1 : 0) }))
        .sort((a, b) => b.k - a.k);
    for (let i = 0; i < ripples.length; i++) {
      const s = stirring[i];
      if (s) ripples[i].set(s.p.x, s.p.z, s.k, (s.p.id || 0) * 1.7);
      else ripples[i].set(0, 0, 0, 0);
    }
  }
  // The ropes ride the slosh.
  const slosh = (S?.slosh || 0) * 1.6;
  for (const r of ctx.ropes || []) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < r.n; i++) {
      const z = -P.halfZ + 0.16 + i * 0.32;
      m.makeTranslation(r.x, CRUISE_WATER + 0.02 + slosh * (z / P.halfZ) + Math.sin(time * 1.6 + i * 0.5) * 0.015 * motion, z);
      r.mesh.setMatrixAt(i, m);
    }
    r.mesh.instanceMatrix.needsUpdate = true;
  }
  // The loungers where the ship has slid them, and their towels.
  const beds = sim?.roof?.beds;
  ctx.loungers.forEach((l, id) => {
    const z = S?.loungers?.[id]?.z ?? LOUNGERS[id].home;
    // (A little shudder while one slides.)
    const sliding = Math.abs(S?.loungers?.[id]?.vz || 0) > 0.1;
    l.g.position.set(l.x, sliding ? Math.abs(Math.sin(time * 40 + id)) * 0.015 * motion : 0, z);
    const bed = beds?.[id];
    l.rolled.visible = !!bed && !bed.guest && !bed.messy;
    l.spread.visible = !!bed?.guest && sim.get(bed.guest)?.status === "lounge";
    l.crumpled.visible = !!bed?.messy;
  });
  // The stairway doors slide open as a guest comes or goes.
  for (const d of ctx.doors || []) {
    const open = doorOpening(sim?.doors?.[d.side] || 0);
    d.leaf.position.z = d.z - open * 1.15;
  }
  // The flags flutter, the radar turns, the smoke drifts aft, the bell swings when it rings.
  for (const f of ctx.flagLines || []) f.flag.rotation.y = f.base + Math.sin(time * 6 + f.phase) * 0.35 * motion;
  if (ctx.radar) ctx.radar.rotation.y = time * 1.4 * motion;
  for (const sp of ctx.smoke || []) {
    const t = (sp.userData.t + time * 0.06) % 1;
    sp.position.set(ctx.funnelTop.x - t * 22, ctx.funnelTop.y + t * 6 + Math.sin(t * 9) * 0.5, Math.sin(t * 5 + sp.userData.t * 9) * 1.5);
    sp.scale.setScalar(2 + t * 7);
    sp.material.opacity = 0.42 * (1 - t) * light;
  }
  if (ctx.bell) {
    if (S?.phase === "warn") ctx.bellSwing = 1;
    ctx.bellSwing = Math.max(0, (ctx.bellSwing || 0) - dt * 0.5);
    ctx.bell.rotation.z = Math.sin(time * 9) * 0.25 * ctx.bellSwing * motion;
  }
  // The screen glows; the hot tub bubbles.
  if (ctx.bubbles) {
    const { mesh, t } = ctx.bubbles,
      m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4,
        r = ((i * 0.37) % 1) * (t.r - 0.25),
        k = (time * 0.9 + i * 0.13) % 1;
      m.makeTranslation(t.x + Math.cos(a + time * 0.3) * r, 0.5 + k * 0.08 * motion, t.z + Math.sin(a + time * 0.3) * r);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  // Loose things slide (and the balls roll) downhill, on screen only.
  const g = 9.8,
    sin = Math.sin(angle),
    cos = Math.cos(angle);
  for (const o of ctx.loose || []) {
    const pull = g * sin * (o.kind === "ball" ? 0.7 : 0.55),
      rub = g * cos * o.rub;
    if (Math.abs(pull) > rub || Math.abs(o.vz) > 0.02) {
      const dir = o.vz ? Math.sign(o.vz) : Math.sign(pull);
      o.vz += (pull - dir * rub) * dt;
      if (o.vz && Math.sign(o.vz) !== dir && Math.abs(pull) <= rub) o.vz = 0;
    }
    o.vz *= o.kind === "ball" ? 0.995 : 1;
    o.z += o.vz * dt;
    if (o.z < o.lo) (o.z = o.lo), (o.vz = o.kind === "ball" ? -o.vz * 0.4 : 0);
    if (o.z > o.hi) (o.z = o.hi), (o.vz = o.kind === "ball" ? -o.vz * 0.4 : 0);
    o.g.position.z = o.z;
    if (o.kind === "ball") o.g.rotation.x += (o.vz * dt) / 0.25;
  }
  if (ctx.afloat) {
    const a = ctx.afloat;
    a.vz += (sin * 2.2 - a.vz * 0.6) * dt;
    a.z = clamp(a.z + a.vz * dt, -P.halfZ + 0.5, P.halfZ - 0.5);
    a.g.position.set(7.0 + Math.sin(time * 0.3) * 1.2, CRUISE_WATER + 0.12 + slosh * (a.z / P.halfZ) + Math.sin(time * 2) * 0.03, a.z);
  }
  syncCast(w, sim, time, dt, ctx);
}

// A guest who slid into the pool (ship.mjs `fell-in`): treading water by the end wall, soaked, both arms waving for the coach,
// splashing. True when it has posed them.
export function cruisePose(w, sim, p, g, time, dt) {
  if (p.status !== "fell-in") return false;
  const u = g.userData,
    motion = w.reducedMotion?.matches ? 0 : 1;
  u.root.position.set(0, 0, 0);
  u.root.rotation.set(0, 0, 0);
  u.root.scale.setScalar(u.baseScale || 1);
  u.puppet.arms = u.puppet.legs = false;
  u.f.visible = false;
  u.shadow.visible = false;
  const lanes = p.x < P.halfX;
  g.position.set(p.x, (lanes ? -1.15 : -0.95) + Math.sin(time * 5 + (u.phase || 0)) * 0.06 * motion, p.z);
  g.rotation.set(0, p.z < 0 ? Math.PI : 0, 0);
  u.hit.position.y = 1.3;
  if (motion && Math.random() < dt * 6) w.splash(p.x, CRUISE_WATER + 0.05, p.z, 2, true, 0xe8ffff);
  try {
    u.rig?.update(dt, { speed: 0, panic: true, puppet: u.puppet, classic: u });
  } catch (error) {
    console.error(error);
  }
  return true;
}
