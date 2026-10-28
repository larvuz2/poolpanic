// The Community Pool dressed as the Harbourside Community Swim Club (28 October 2026: the creator asked for the Godot test's
// assets, the mosaic and all its decor here in the three.js game, with better light, "performance is key", this venue only).
//
// The building and its ~70 props were made in Blender for the Godot test (godot/tools/blender/, godot/docs/look.md);
// godot/tools/blender/three_club.py merges them into a few meshes for this game and three-club-pack.sh packs them into
// dist/assets/club/: one quantized GLB (~20 meshes, one per material class: the colours in the vertex colours, the baked ambient
// occlusion in their alpha), the tile sets, two sign atlases, the floor's paint, the mural and the floor's occlusion.
//
// What the game moves stays its own: the water, the lane ropes and pennants (pool.mjs), the life rings, the fins (the model's
// Fins_1..3 are the rack's pairs), the changing rooms' doors (the model's Door_Men/Door_Women, swung here), the skimmer, the
// fish net, the torch, the fuse box, the mop, and every hit box and label (props.mjs, with their stands left out).
//
// It loads behind the menu (`loadHarbourside`, app.mjs); until it has, and with ?nomodels, the Community Pool is the classic one
// (scene/club.mjs). The world builds it when the club's look is "harbour" (scene.mjs `defaultLighting`), which it is once loaded.
//
// The light (LIGHTING.harbour, scene.mjs): a low golden afternoon sun through the long window wall and the skylight (the roof is
// drawn only into the sun's shadow), a warm bounce in the ambient, soft shafts through the windows (`beams`), dust sparkling
// only inside them (`motes`), the lamps' glows (`glows`), caustics on everything under the water.
import { THREE } from "./kit.mjs";
import { CAUSTIC_GLSL, buildPool } from "./pool.mjs";
import {
  station,
  finRack,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  treatsTable,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";
import { doorOpening } from "../spatial.mjs";

const BASE = new URL("../assets/club/", import.meta.url).href;
export const HARBOUR_TILES = [
  "deck_tile",
  "pool_mosaic",
  "wall_sea",
  "wall_navy",
  "wall_cream",
  "plaster",
  "timber",
  "terrazzo",
];
// (roughness of each tile set: glazed tiles shine, plaster and timber less)
const TILE_ROUGH = {
  deck_tile: 0.62,
  pool_mosaic: 0.3,
  wall_sea: 0.24,
  wall_navy: 0.24,
  wall_cream: 0.26,
  plaster: 0.85,
  timber: 0.5,
  terrazzo: 0.35,
};
// the flat classes: roughness, metalness
const FLAT = { matte: [0.82, 0], satin: [0.5, 0], gloss: [0.22, 0], metal: [0.32, 1], leaf: [0.55, 0] };
const WATER_Y = -0.25;
// The window wall (+x) and the sun through it, as the Godot venue's (godot/scripts/club/club_scene.gd).
const WINDOWS = {
  x: 14.7,
  sill: 2.15,
  head: 8.35,
  centres: [-13.81, -8.93, -4.04, 0.84, 5.73, 10.62],
  width: 4,
};
export const HARBOUR_SUN = new THREE.Vector3(0.72, 0.62, 0.34).normalize(); // (toward the sun)

let ready = null,
  loading = null;
export const harbourReady = () => !!ready;
export const harbourModel = () => ready;

// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic pool stays).
export function loadHarbourside(base = BASE) {
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
    const [gltf, info, ...pictures] = await Promise.all([
      new GLTFLoader().loadAsync(base + "harbourside.glb"),
      fetch(base + "harbourside.json").then((r) => r.json()),
      ...HARBOUR_TILES.flatMap((t) => [picture(t), picture(t + "_n", { srgb: false })]),
      picture("atlas_signs"),
      picture("atlas_cut"),
      picture("floor_paint", { flip: true }),
      picture("mural", { flip: true }),
      picture("floor_ao", { srgb: false, flip: true }),
    ]);
    const textures = Object.fromEntries(pictures);
    for (const t of HARBOUR_TILES)
      for (const k of [t, t + "_n"]) textures[k].wrapS = textures[k].wrapT = THREE.RepeatWrapping;
    ready = { scene: gltf.scene, info, textures };
    return ready;
  })().catch((error) => {
    console.error("The Harbourside did not load; the classic Community Pool stays.", error);
    loading = null;
    return null;
  });
  return loading;
}
// (for the checks, which parse the model themselves and have no pictures)
export function primeHarbourside(model) {
  ready = model;
}

// Light on what lies under the water (caustics, like the classic basin's: pool.mjs), and on the deck its paint and its contact
// shadows: one addition to every material of the venue, so they all stay one program each.
function venueShader(material, w, { deck = false } = {}) {
  const u = w.poolUniforms,
    T = harbourModel().textures,
    P = harbourModel().info.paint;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uCaustic = u.uCaustic;
    if (deck) {
      shader.uniforms.uPaint = { value: T.floor_paint };
      shader.uniforms.uFloorAO = { value: T.floor_ao };
      shader.uniforms.uPaintRect = { value: new THREE.Vector3(P.x0, P.z0, P.span) };
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHarbour;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvHarbour = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    let fragment = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vHarbour;\nuniform float uTime;\nuniform float uCaustic;\n" +
        CAUSTIC_GLSL +
        (deck ? "\nuniform sampler2D uPaint;\nuniform sampler2D uFloorAO;\nuniform vec3 uPaintRect;" : ""),
    );
    if (deck)
      fragment = fragment
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          vec2 paintUv = vec2((vHarbour.x - uPaintRect.x) / uPaintRect.z, 1.0 - (vHarbour.z - uPaintRect.y) / uPaintRect.z);
          vec4 paint = texture2D(uPaint, paintUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb, paint.a);`,
        )
        .replace(
          "#include <aomap_fragment>",
          `#include <aomap_fragment>
          float floorAO = texture2D(uFloorAO, paintUv).r;
          reflectedLight.indirectDiffuse *= floorAO;
          reflectedLight.indirectSpecular *= floorAO;`,
        );
    else
      fragment = fragment.replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        #ifdef USE_COLOR_ALPHA
          reflectedLight.indirectDiffuse *= vColor.a;
          reflectedLight.indirectSpecular *= vColor.a;
        #endif`,
      );
    shader.fragmentShader = fragment.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float under = smoothstep(${(WATER_Y + 0.06).toFixed(2)}, ${(WATER_Y - 0.12).toFixed(2)}, vHarbour.y);
      totalEmissiveRadiance += vec3(0.55, 0.95, 0.95) * caustic(vHarbour.xz, uTime) * uCaustic * under * 0.8;`,
    );
  };
  material.customProgramCacheKey = () => "harbour" + (deck ? ":deck" : "");
  return material;
}

function makeMaterials(w) {
  const T = harbourModel().textures,
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
          roughness: TILE_ROUGH[set] ?? 0.5,
          vertexColors: true,
          envMapIntensity: 0.8,
        }),
        w,
        { deck: set === "deck_tile" },
      );
    } else if (base === "signs")
      m = venueShader(
        new THREE.MeshStandardMaterial({ map: T.atlas_signs, roughness: 0.62, vertexColors: true }),
        w,
      );
    else if (base === "cut")
      m = venueShader(
        new THREE.MeshStandardMaterial({
          map: T.atlas_cut,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          roughness: 0.75,
          vertexColors: true,
        }),
        w,
      );
    else if (base === "glow") m = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (base === "glass")
      m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
        roughness: 0.04,
        metalness: 0,
        depthWrite: false,
        envMapIntensity: 1.5,
      });
    else if (base === "shadow") m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
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
      );
    }
    m.name = "harbourside:" + cls;
    cache.set(cls, m);
    return m;
  };
}

// The Community Pool, Harbourside: the model and what the game needs round it. `w` is the PoolWorld being built.
export function buildHarbourside(w, venue) {
  const H = harbourModel(),
    info = H.info;
  // the water, the lane ropes and pennants and the lanes' pick volumes; the basin, blocks, ladders and posts are the model's
  buildPool(w, venue, w.look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    pennants: [0xef6a4c, 0xf3e6c9, 0x1d3557],
    ropes: [0xf4f1ea, 0x2f7fc4, 0xef6a4c],
  });
  w.water.material.uniforms.uSun.value.copy(HARBOUR_SUN);
  const root = H.scene.clone(true);
  root.name = "harbourside";
  w.scene.add(root);
  (w.liveProps ||= []).push(root); // (the model is batched already: never again by scene.mjs)
  const material = makeMaterials(w);
  const glass = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const cls = (o.material?.name || "satin").replace(/^H_/, "");
    o.material = material(cls);
    const base = cls.replace(/_n$/, "");
    o.castShadow = !cls.endsWith("_n") && !["glass", "glow", "signs", "cut", "nearwall"].includes(base);
    o.receiveShadow = !["glow", "shadow", "glass"].includes(base);
    if (base === "shadow") o.castShadow = true;
    if (base === "glass") glass.push(o);
  });
  w.windowGlass = glass; // (darkened in a storm: incident-view.mjs)
  // the mural on the far wall, its picture lights' wash painted in
  const M = info.mural;
  const mural = new THREE.Mesh(
    new THREE.PlaneGeometry(M.width, M.height),
    venueShader(new THREE.MeshStandardMaterial({ map: H.textures.mural, roughness: 0.85 }), w),
  );
  mural.position.set(...M.at);
  mural.receiveShadow = true;
  w.scene.add(mural);
  liveParts(w, venue, root, info);
  w.hall = coachView(root);
  beams(w);
  motes(w);
  glows(w, info.lights);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the doors, the clocks' hands.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  finRack(w, S.fins, { rack: false });
  w.finPairs = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", 0, { body: false });
  rescueStations(w, venue, { mounts: false });
  // the rings hang where the model's boards hold them (the nearest of its rings to each mount)
  const rings = info.anchors?.LifeRing || [];
  w.ringAt = venue.ringMounts.map((m) => {
    const near = rings
      .map(([x, y, z]) => ({ x, y, z, d: Math.hypot(x - m.x, z - m.z) }))
      .sort((a, b) => a.d - b.d)[0];
    return near && near.d < 0.8 ? near : null;
  });
  sanitationCorner(w, venue, { board: false, bin: false });
  fishNetHook(w, F.fishNet, { board: false });
  treatsTable(w, F.treats, { table: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  // the changing rooms' doors swing open into the hall as a guest comes or goes (sim.doors: -1 the men's, 1 the women's)
  const Y = new THREE.Vector3(0, 1, 0),
    Z = new THREE.Vector3(0, 0, 1),
    q = new THREE.Quaternion();
  const doors = [
    [root.getObjectByName("Door_Men"), -1],
    [root.getObjectByName("Door_Women"), 1],
  ]
    .filter(([d]) => d)
    .map(([node, side]) => ({ node, side, base: node.quaternion.clone() }));
  // the pace clock's and the wall clock's hands: the second hand sweeps once a minute, the minute hand once an hour
  const hands = [];
  root.traverse((o) => {
    if (/^Hand(Minute|Second)/.test(o.name) && !hands.some((h) => h.node === o))
      hands.push({ node: o, minute: o.name.includes("Minute"), base: o.quaternion.clone() });
  });
  w.updaters.push((time, dt, world, sim) => {
    for (const d of doors)
      d.node.quaternion
        .copy(d.base)
        .multiply(q.setFromAxisAngle(Y, -d.side * 1.4 * doorOpening(sim?.doors?.[d.side] || 0)));
    const t = performance.now() / 1000;
    for (const h of hands) {
      const turn = h.minute ? (t % 3600) / 3600 : (t % 60) / 60;
      h.node.quaternion.copy(h.base).multiply(q.setFromAxisAngle(Z, -Math.PI * 2 * turn));
    }
  });
}

// The Coach Cam sees the room from inside: the near wall it stands by (never drawn for the overview's camera, which looks
// over it), and the roof (drawn only into the sun's shadow from above) as a plaster ceiling with its skylight.
function coachView(root) {
  const near = root.getObjectByName("NearWall"),
    roof = root.getObjectByName("ShadowOnly");
  const roofMeshes = [];
  roof?.traverse((o) => o.isMesh && roofMeshes.push(o));
  const hidden = roofMeshes[0]?.material,
    ceiling = new THREE.MeshStandardMaterial({ color: 0xf0e2c6, roughness: 0.9 });
  return {
    setCoach(on) {
      if (near) near.visible = on;
      for (const m of roofMeshes) m.material = on ? ceiling : hidden;
    },
    update() {},
  };
}

// Soft shafts of sunlight through the window wall's panes, for every eye (the volumetric fog of the Godot venue, made cheap): a
// prism per pane column swept from the glass along the sunlight to the floor, added onto the picture; faces seen edge-on fade
// so no beam has an outline, each fades in from the glass and out before the floor, and slow dust makes it shimmer.
function beams(w) {
  const d = HARBOUR_SUN.clone().negate();
  const pos = [],
    along = [],
    normal = [];
  for (const zc of WINDOWS.centres)
    for (let col = 0; col < 4; col++) {
      const za = zc - WINDOWS.width / 2 + col + 0.05,
        zb = za + 0.9;
      const P = (y, z) => new THREE.Vector3(WINDOWS.x, y, z);
      const ta = P(WINDOWS.head, za),
        tb = P(WINDOWS.head, zb),
        la = P(WINDOWS.sill, za),
        lb = P(WINDOWS.sill, zb);
      for (const [p0, p1] of [
        [ta, tb],
        [la, lb],
        [ta, la],
        [tb, lb],
      ]) {
        const f0 = p0.clone().addScaledVector(d, p0.y / -d.y),
          f1 = p1.clone().addScaledVector(d, p1.y / -d.y);
        const n = p1.clone().sub(p0).cross(f0.clone().sub(p0)).normalize();
        for (const [v, a] of [
          [p0, 0],
          [p1, 0],
          [f1, 1],
          [p0, 0],
          [f1, 1],
          [f0, 1],
        ]) {
          pos.push(v.x, v.y, v.z);
          along.push(a);
          normal.push(n.x, n.y, n.z);
        }
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute("along", new THREE.Float32BufferAttribute(along, 1));
  const uniforms = {
    uTime: w.poolUniforms.uTime,
    uStrength: { value: 0.085 },
    uColor: { value: new THREE.Color(0xffd29a) },
  };
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float along;
        varying float vAlong;
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vAlong = along;
          vNormal = normalize(normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform float uStrength;
        uniform vec3 uColor;
        varying float vAlong;
        varying vec3 vNormal;
        varying vec3 vWorld;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec3 V = normalize(cameraPosition - vWorld);
          float facing = abs(dot(vNormal, V));
          float soft = smoothstep(0.05, 0.75, facing);
          float fade = smoothstep(0.0, 0.18, vAlong) * (1.0 - smoothstep(0.55, 1.0, vAlong));
          float dust = noise(vWorld.xz * 0.6 + vec2(vWorld.y * 0.3 + uTime * 0.05, uTime * 0.03));
          gl_FragColor = vec4(uColor * uStrength * soft * fade * mix(0.5, 1.35, dust), 1.0);
        }`,
    }),
  );
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  w.scene.add(mesh);
  w.lightShafts = [mesh];
  // (they go with the sun: a blackout's storm dims them, scene/incident-view.mjs)
  w.dimmers.push((k) => (uniforms.uStrength.value = 0.085 * Math.max(0, Math.min(1, k))));
}

// Dust and droplets drifting on the window side, sparkling only where a shaft of sun crosses them.
function motes(w) {
  const count = 360,
    pos = new Float32Array(count * 3),
    seed = new Float32Array(count);
  let s = 7;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    pos.set([3 + rand() * 11.5, 0.4 + rand() * 7.6, -16 + rand() * 29], i * 3);
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: w.poolUniforms.uTime,
    uSun: { value: HARBOUR_SUN },
    uLight: { value: 1 },
    uScale: { value: 1 },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float seed;
        uniform float uTime;
        uniform vec3 uSun;
        uniform float uScale;
        varying float vLit;
        const float centres[6] = float[6](${WINDOWS.centres.map((c) => c.toFixed(2)).join(", ")});
        void main() {
          vec3 p = position;
          float t = uTime * (0.05 + seed * 0.05) + seed * 40.0;
          p += vec3(sin(t * 1.3) * 0.5, sin(t * 0.7 + seed * 6.0) * 0.35, cos(t) * 0.6);
          // lit when the line toward the sun leaves through a window pane
          float k = (${WINDOWS.x.toFixed(2)} - p.x) / max(uSun.x, 0.01);
          vec3 h = p + uSun * k;
          float lit = 0.0;
          for (int i = 0; i < 6; i++)
            lit = max(lit, step(abs(h.z - centres[i]), ${(WINDOWS.width / 2 - 0.05).toFixed(2)}));
          lit *= step(${WINDOWS.sill.toFixed(2)}, h.y) * step(h.y, ${WINDOWS.head.toFixed(2)});
          vLit = lit * (0.6 + 0.4 * sin(uTime * (1.5 + seed * 3.0) + seed * 20.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.2 + seed * 2.4) * uScale * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uLight;
        varying float vLit;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c));
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * vLit * 0.55 * uLight, 1.0);
        }`,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 4;
  w.scene.add(points);
  w.dimmers.push((k) => (uniforms.uLight.value = Math.max(0, Math.min(1, k))));
  w.harbourMotes = uniforms;
}

// The lamps' glows (the café's bulbs, the changing rooms' bulkheads, the desk lamp, the picture lights, the vending machine, the
// underwater lights): one cloud of soft points, no light of their own to pay for. They die with the power.
const GLOW = {
  CafeBulb: [0xffd9a0, 0.9],
  Bulkhead: [0xfff0d0, 1.0],
  DeskLamp: [0xffe0a8, 0.8],
  Strip: [0xffd6a0, 1.3],
  VendGlow: [0xffb8a0, 1.5],
  Underwater: [0xbff4ff, 1.4],
};
function glows(w, lights = []) {
  const pos = [],
    color = [],
    size = [];
  for (const l of lights) {
    const [c, s] = GLOW[l.kind] || [0xffe2b0, 0.8];
    pos.push(...l.at);
    const k = new THREE.Color(c);
    color.push(k.r, k.g, k.b);
    size.push(s);
  }
  if (!pos.length) return;
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
          gl_FragColor = vec4(vColor * a * 0.55 * uLight, 1.0);
        }`,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 4;
  w.scene.add(points);
  w.dimmers.push((k, dark) => (uniforms.uLight.value = dark ? 0.05 : Math.max(0.05, Math.min(1, k))));
}
