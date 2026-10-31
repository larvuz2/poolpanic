// Splash Park dressed for real (30 October 2026: the creator asked for "the same Harbourside treatment for the next venue! same
// details, amazing lighting, new props!… always considering performance and triangle count", Splash Park only: the Sunset Lagoon
// and the Grand Gala Arena share its floor plan and keep their own looks).
//
// Every asset is made by scripts in tools/venues/splash/ (Blender 4.5: the building, the pool's basin, the cabanas, the palms,
// the props; their textures with numpy, their signs with Pillow); export_three.py merges them into a few meshes and pack.sh packs
// them into dist/assets/splash/: one quantized GLB (one mesh per material class: the colours in the vertex colours, the baked
// ambient occlusion in their alpha), the tile sets, the sign and cut-out atlases (palm fronds and flowers, alpha-tested, their
// shadows dappled), the deck's paint and the deck's occlusion.
//
// What the game moves stays its own: the water, the lane ropes and pennants (pool.mjs), the trampoline's bed, the life rings, the
// fins (the model's Fins_1..3), the cabanas' doors (the model's Door_A/Door_B, swung by the game's door sync), the medical kit,
// the dog treats, the fish net, the torch, the fuse box, the mop, and every hit box and label (props.mjs, with their bodies left
// out where the model has its own).
//
// It loads behind the menu after the Harbourside (`loadSplashPark`, app.mjs); until it has, and with ?nomodels, Splash Park is the
// classic one (scene/resort.mjs). Its hours are the game's (day, sunset, night: the shift's lighting); `SPLASH_LOOKS` gives each its
// own light here (scene.mjs `withDome`). The lamps are no lights to pay for: the lanterns, the festoons and the windows glow, and
// their light falls on the deck and the walls in the venue's own shader (`uLamps`); by day slow cloud shadows drift over the park.
import { THREE } from "./kit.mjs";
import { CAUSTIC_GLSL, buildPool } from "./pool.mjs";
import {
  station,
  finRack,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  medkitCabinet,
  trampolineTower,
} from "./props.mjs";
import { kioskTreats, lawn } from "./resort.mjs";

const BASE = new URL("../assets/splash/", import.meta.url).href;
// (roughness of each tile set)
const TILE_ROUGH = {
  travertine: 0.62,
  glass_mosaic: 0.18,
  mosaic_band: 0.22,
  stucco: 0.88,
  teak: 0.5,
  hedge: 0.75,
  cobble: 0.85,
};
const FLAT = { matte: [0.82, 0], satin: [0.5, 0], gloss: [0.22, 0], metal: [0.32, 1], leaf: [0.6, 0] };
const WATER_Y = -0.25;
const MAX_LAMPS = 24;

// Each hour's light at Splash Park, over the game's own (scene.mjs LIGHTING.day/sunset/night): a strong warm sun by day and soft
// blue shade; a long low gold at sunset with the lamps coming on; a cool moon at night with every lamp lit. `lamps` lights the
// lanterns (0 by day), `clouds` the drifting shade.
export const SPLASH_LOOKS = {
  day: {
    exposure: 0.98,
    hemi: [0xd2ecff, 0xb8936a, 0.72],
    sun: [0xfff0d6, 3.25, [-21, 27, 13]],
    fill: [0xa9d8ea, 0.32, [14, 14, -16]],
    env: 0.55,
    envColors: ["#bfe3f5", "#eef1e6", "#c9a57d"],
    water: {
      shallow: [0.3, 0.84, 0.86],
      deep: [0.04, 0.5, 0.66],
      sky: [0.74, 0.92, 0.98],
      glint: [1, 0.96, 0.86],
      clarity: 0.45,
    },
    lamps: 0,
    clouds: 0.26,
  },
  sunset: {
    exposure: 1.0,
    hemi: [0xffcfae, 0x6e5560, 0.7],
    sun: [0xffa860, 3.4, [-27, 10.5, 15]],
    fill: [0x8f86d8, 0.42, [14, 12, -18]],
    env: 0.55,
    envColors: ["#f7b995", "#f3d7b8", "#8f6a58"],
    water: {
      shallow: [0.28, 0.76, 0.8],
      deep: [0.05, 0.42, 0.6],
      sky: [1, 0.72, 0.55],
      glint: [1, 0.78, 0.5],
      glow: 0.3,
      clarity: 0.35,
    },
    lamps: 0.55,
    clouds: 0,
  },
  night: {
    exposure: 1.06,
    hemi: [0x5f70b2, 0x2c283a, 0.62],
    sun: [0xa9bcff, 0.95, [-12, 24, 16]],
    fill: [0x4d6fc0, 0.3, [14, 14, -16]],
    env: 0.32,
    envColors: ["#27335a", "#3b4a73", "#2b2531"],
    water: {
      shallow: [0.16, 0.7, 0.86],
      deep: [0.03, 0.36, 0.62],
      sky: [0.24, 0.32, 0.56],
      glint: [0.8, 0.88, 1],
      glow: 1,
      clarity: 0.3,
    },
    lamps: 1,
    clouds: 0,
  },
};

let ready = null,
  loading = null;
export const splashReady = () => !!ready;
export const splashModel = () => ready;

// Fetch the model and its pictures once (about 4 MB); resolves to null when they cannot be had (the classic Splash Park stays).
export function loadSplashPark(base = BASE) {
  if (ready) return Promise.resolve(ready);
  loading ||= (async () => {
    const { GLTFLoader } = await import("../assets/GLTFLoader.js");
    const loader = new THREE.TextureLoader();
    const picture = (name, { srgb = true, flip = false } = {}) =>
      loader.loadAsync(base + name + ".webp").then((t) => {
        t.flipY = flip;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        return [name, t];
      });
    const info = await fetch(base + "splash.json").then((r) => r.json());
    const tiles = Object.keys(info.tiles || {});
    const [gltf, ...pictures] = await Promise.all([
      new GLTFLoader().loadAsync(base + "splash.glb"),
      ...tiles.flatMap((t) => [picture(t), picture(t + "_n", { srgb: false })]),
      ...Object.keys(info.atlases || {}).map((a) => picture(a)),
      picture("floor_paint", { flip: true }),
      picture("floor_ao", { srgb: false, flip: true }),
    ]);
    const textures = Object.fromEntries(pictures);
    for (const t of tiles)
      for (const k of [t, t + "_n"]) textures[k].wrapS = textures[k].wrapT = THREE.RepeatWrapping;
    ready = { scene: gltf.scene, info, textures };
    return ready;
  })().catch((error) => {
    console.error("Splash Park's model did not load; the classic Splash Park stays.", error);
    loading = null;
    return null;
  });
  return loading;
}
// (for the checks, which parse the model themselves and have no pictures)
export function primeSplashPark(model) {
  ready = model;
}
// The pictures a model of this venue loads (splash.json): the checks count them.
export const splashPictures = (info) => [
  ...Object.keys(info.tiles || {}).flatMap((t) => [t, t + "_n"]),
  ...Object.keys(info.atlases || {}),
  "floor_paint",
  "floor_ao",
];

// One addition to every lit material of the venue: caustics on what lies under the water; on the deck its paint and its contact
// shadows (elsewhere the vertex colours' alpha, on the ambient light only); the lamps' light on everything near them after dusk;
// by day the shade of slow clouds over the sun's light.
function venueShader(material, w, U, { deck = false } = {}) {
  const u = w.poolUniforms,
    T = splashModel().textures,
    P = splashModel().info.paint;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uCaustic = u.uCaustic;
    shader.uniforms.uLamps = U.lamps;
    shader.uniforms.uLampCount = U.lampCount;
    shader.uniforms.uLampColor = U.lampColor;
    shader.uniforms.uNight = U.night;
    shader.uniforms.uClouds = U.clouds;
    if (deck) {
      shader.uniforms.uPaint = { value: T.floor_paint };
      shader.uniforms.uFloorAO = { value: T.floor_ao };
      shader.uniforms.uPaintRect = { value: new THREE.Vector3(P.x0, P.z0, P.span) };
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSplash;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvSplash = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    let fragment = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vSplash;
      uniform float uTime;
      uniform float uCaustic;
      uniform vec4 uLamps[${MAX_LAMPS}];
      uniform int uLampCount;
      uniform vec3 uLampColor;
      uniform float uNight;
      uniform float uClouds;
      ${CAUSTIC_GLSL}
      float cloudHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cloudNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(cloudHash(i), cloudHash(i + vec2(1, 0)), f.x), mix(cloudHash(i + vec2(0, 1)), cloudHash(i + vec2(1, 1)), f.x), f.y);
      }
      ${deck ? "uniform sampler2D uPaint;\nuniform sampler2D uFloorAO;\nuniform vec3 uPaintRect;" : ""}`,
    );
    if (deck)
      fragment = fragment
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          vec2 paintUv = vec2((vSplash.x - uPaintRect.x) / uPaintRect.z, 1.0 - (vSplash.z - uPaintRect.y) / uPaintRect.z);
          vec4 paint = texture2D(uPaint, paintUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb, paint.a);`,
        )
        .replace(
          "#include <aomap_fragment>",
          `#include <aomap_fragment>
          float floorAO = texture2D(uFloorAO, paintUv).r;
          reflectedLight.indirectDiffuse *= floorAO;
          reflectedLight.indirectSpecular *= floorAO;
          float contact = floorAO;
          ${LIGHT_BLOCK}`,
        );
    else
      fragment = fragment.replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        float contact = 1.0;
        #ifdef USE_COLOR_ALPHA
          reflectedLight.indirectDiffuse *= vColor.a;
          reflectedLight.indirectSpecular *= vColor.a;
          contact = vColor.a;
        #endif
        ${LIGHT_BLOCK}`,
      );
    shader.fragmentShader = fragment.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float under = 1.0 - smoothstep(${(WATER_Y - 0.12).toFixed(2)}, ${(WATER_Y + 0.06).toFixed(2)}, vSplash.y);
      totalEmissiveRadiance += vec3(0.55, 0.95, 0.95) * caustic(vSplash.xz, uTime) * uCaustic * under * 0.8;`,
    );
  };
  material.customProgramCacheKey = () => "splash" + (deck ? ":deck" : "");
  return material;
}

// (after the lights are summed: the clouds shade the sun's share, the lamps add their own)
const LIGHT_BLOCK = `
      if (uClouds > 0.0) {
        vec2 cp = vSplash.xz * 0.045 + vec2(uTime * 0.012, uTime * 0.005);
        float cloud = cloudNoise(cp) * 0.65 + cloudNoise(cp * 2.3 + 7.1) * 0.35;
        float shade = 1.0 - uClouds * smoothstep(0.42, 0.72, cloud);
        reflectedLight.directDiffuse *= shade;
        reflectedLight.directSpecular *= shade;
      }
      if (uNight > 0.0) {
        vec3 worldNormal = normalize(inverseTransformDirection(normal, viewMatrix));
        vec3 lampLight = vec3(0.0);
        for (int i = 0; i < ${MAX_LAMPS}; i++) {
          if (i >= uLampCount) break;
          vec3 d = uLamps[i].xyz - vSplash;
          float dist2 = dot(d, d);
          float fall = uLamps[i].w / (1.0 + dist2 * 0.9) * smoothstep(42.0, 4.0, dist2);
          float facing = clamp(dot(worldNormal, normalize(d)) * 0.8 + 0.2, 0.0, 1.0);
          lampLight += fall * facing;
        }
        reflectedLight.directDiffuse += diffuseColor.rgb * uLampColor * lampLight * uNight * (0.55 + 0.45 * contact);
      }`;

function makeMaterials(w, U) {
  const T = splashModel().textures,
    cache = new Map();
  return (cls) => {
    if (cache.has(cls)) return cache.get(cls);
    const base = cls.replace(/_n$/, "");
    let m;
    if (base.startsWith("tile_")) {
      const set = base.slice(5);
      m = venueShader(
        new THREE.MeshStandardMaterial({
          map: T[set],
          normalMap: T[set + "_n"],
          normalScale: new THREE.Vector2(0.7, -0.7),
          roughness: TILE_ROUGH[set] ?? 0.6,
          vertexColors: true,
          envMapIntensity: 0.8,
        }),
        w,
        U,
        { deck: set === "travertine" },
      );
    } else if (base === "signs")
      m = venueShader(
        new THREE.MeshStandardMaterial({ map: T.atlas_signs, roughness: 0.6, vertexColors: true }),
        w,
        U,
      );
    else if (base === "cut")
      m = venueShader(
        new THREE.MeshStandardMaterial({
          map: T.atlas_cut,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          roughness: 0.7,
          vertexColors: true,
        }),
        w,
        U,
      );
    else if (base === "lamp") {
      // lantern glass and bulbs: pale glass by day, glowing in their own colour once the lamps are lit
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: 0xffffff });
      m.color.setScalar(0.85);
      m.emissiveIntensity = 0;
      U.lampMaterials.push(m);
    } else if (base === "nightglow") {
      // lit windows and halos: nothing by day, added onto the picture after dusk
      m = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      m.color.setScalar(0);
      U.glowMaterials.push(m);
    } else if (base === "glass")
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
        roughness: 0.04,
        metalness: 0,
        depthWrite: false,
        envMapIntensity: 1.5,
      });
    else {
      const [roughness, metalness] = FLAT[base] || FLAT.satin;
      m = venueShader(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness,
          metalness,
          side: base === "leaf" ? THREE.DoubleSide : THREE.FrontSide,
        }),
        w,
        U,
      );
    }
    m.name = "splash:" + cls;
    cache.set(cls, m);
    return m;
  };
}

// Splash Park, the model and what the game needs round it. `w` is the PoolWorld being built.
export function buildSplashPark(w, venue, lighting) {
  const S = splashModel(),
    info = S.info,
    look = { ...SPLASH_LOOKS.day, ...(SPLASH_LOOKS[lighting] || {}) };
  // the water, the lane ropes and pennants and the lanes' pick volumes; the basin, blocks, ladders and posts are the model's
  buildPool(w, venue, w.look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    pennants: [0xe0513f, 0xfff4dc, 0x2f9aa0],
    ropes: [0xfff4dc, 0x2f7fc4, 0xe0513f],
  });
  w.water.material.uniforms.uSun.value.set(...(w.look.sun?.[2] || [-16, 30, 6])).normalize();
  // the lamps (the model's Light_* places, the strongest kinds first) as the shader's pools of light
  const U = {
    lamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) },
    lampCount: { value: 0 },
    lampColor: { value: new THREE.Color(0xffc477) },
    night: { value: look.lamps || 0 },
    clouds: { value: look.clouds || 0 },
    lampMaterials: [],
    glowMaterials: [],
  };
  const lamps = (info.lights || [])
    .map((l) => ({ ...l, ...(LAMP[l.kind] || LAMP.default) }))
    .filter((l) => l.light > 0)
    .sort((a, b) => b.light - a.light)
    .slice(0, MAX_LAMPS);
  lamps.forEach((l, i) => U.lamps.value[i].set(l.at[0], l.at[1], l.at[2], l.light));
  U.lampCount.value = lamps.length;
  const root = S.scene.clone(true);
  root.name = "splashpark";
  w.scene.add(root);
  (w.liveProps ||= []).push(root); // (the model is batched already: never again by scene.mjs)
  const material = makeMaterials(w, U);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const cls = (o.material?.name || "satin").replace(/^H_/, "");
    o.material = material(cls);
    const base = cls.replace(/_n$/, "");
    o.castShadow = !cls.endsWith("_n") && !["glass", "lamp", "nightglow", "signs"].includes(base);
    o.receiveShadow = !["nightglow", "glass", "lamp"].includes(base);
    if (base === "cut") o.customDepthMaterial = undefined; // (three.js gives an alpha-tested caster its own depth material)
  });
  liveParts(w, venue, root, info);
  lawn(w, venue, { palms: false });
  const glow = glows(w, info.lights);
  // the hour's lamps: the shader's pools of light, the lanterns' glass, the windows, the glows; all die with the power
  const setLamps = (k) => {
    U.night.value = k;
    for (const m of U.lampMaterials) m.emissiveIntensity = 1.6 * k;
    for (const m of U.glowMaterials) m.color.setScalar(0.85 * k);
    if (glow) glow.uniforms.uLight.value = k;
  };
  setLamps(look.lamps || 0);
  w.dimmers.push((k, dark) => setLamps(dark ? 0 : (look.lamps || 0) * Math.max(0, Math.min(1, k))));
  // (the festoons hide in a power cut by the game's own rule for string lights: incident-view.mjs)
  w.stringLights = glow?.points || null;
  if (w.stringLights) w.stringLights.visible = (look.lamps || 0) > 0;
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the doors, the trampoline's bed, the
// medical kit, the treats on the snack bar's counter.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  // (the model's rack and pairs; a model without them has the classic rack)
  finRack(w, S.fins, { rack: fins.length !== 3 });
  if (fins.length === 3) w.finPairs = fins;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", -Math.PI / 2, { body: false });
  rescueStations(w, venue, { mounts: false });
  const rings = info.anchors?.LifeRing || [];
  w.ringAt = venue.ringMounts.map((m) => {
    const near = rings
      .map(([x, y, z]) => ({ x, y, z, d: Math.hypot(x - m.x, z - m.z) }))
      .sort((a, b) => a.d - b.d)[0];
    return near && near.d < 0.8 ? near : null;
  });
  sanitationCorner(w, venue, { board: false, bin: false });
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  medkitCabinet(w, F.medkit, { cabinet: false });
  kioskTreats(w, F.treats);
  if (venue.trampoline) trampolineTower(w, venue.trampoline, { structure: false });
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}

// The lamps by kind: the size of their glow (points), its colour, and how much light each pours on what is near it after dusk.
const LAMP = {
  Lantern: { color: 0xffd08a, size: 1.0, light: 1.3 },
  PierLantern: { color: 0xffd08a, size: 0.9, light: 1.1 },
  Festoon: { color: 0xffe0a0, size: 0.45, light: 0 },
  FestoonPool: { color: 0xffe0a0, size: 0, light: 0.9 },
  Bollard: { color: 0xffe2b0, size: 0.6, light: 0.8 },
  Torch: { color: 0xffa040, size: 1.4, light: 1.6 },
  Kiosk: { color: 0xffd8a0, size: 0.9, light: 1.2 },
  Underwater: { color: 0xbff4ff, size: 1.3, light: 0 },
  default: { color: 0xffe2b0, size: 0.8, light: 0.8 },
};
function glows(w, lights = []) {
  const pos = [],
    color = [],
    size = [];
  for (const l of lights) {
    const k = LAMP[l.kind] || LAMP.default;
    if (!k.size) continue;
    pos.push(...l.at);
    const c = new THREE.Color(k.color);
    color.push(c.r, c.g, c.b);
    size.push(k.size);
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  geo.setAttribute("size", new THREE.Float32BufferAttribute(size, 1));
  const uniforms = { uMap: { value: w.glowMap }, uLight: { value: 1 } };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 260.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uLight;
        varying vec3 vColor;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a;
          gl_FragColor = vec4(vColor * a * 0.6 * uLight, 1.0);
        }`,
    }),
  );
  points.name = "splash-glows";
  points.frustumCulled = false;
  points.renderOrder = 4;
  w.scene.add(points);
  return { points, uniforms };
}
