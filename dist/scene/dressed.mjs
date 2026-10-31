// A venue dressed for real from its own model (the Harbourside's way, made general for Splash Park and the venues after it, 31
// October 2026): the model's loading, its materials (one per class the exporter made: tools/venues/common/export_three.py), the lamps
// that need no lights, the glows, and the painted horizon round the venue. Each venue's module (scene/splashpark.mjs,
// scene/kidspool.mjs) brings its own light at each hour and the game's live parts round the model.
//
// The venue's shader: caustics on whatever lies under the water; on the deck its paint and its contact shadows (elsewhere the vertex
// colours' alpha, on the ambient light only); the lamps' light on everything near them after dusk (`uLamps`, the 24 strongest of
// the model's Light_* places); by day the shade of slow clouds over the sun's light.
import { THREE } from "./kit.mjs";
import { CAUSTIC_GLSL } from "./pool.mjs";

// (roughness of each tile set any dressed venue uses)
const TILE_ROUGH = {
  travertine: 0.62,
  glass_mosaic: 0.18,
  mosaic_band: 0.22,
  stucco: 0.88,
  teak: 0.5,
  hedge: 0.75,
  cobble: 0.85,
  pine: 0.8,
  conifer: 0.8,
  groundcover: 0.95,
  rubber: 0.9,
  boards: 0.6,
  canopy: 0.8,
  boardwalk: 0.72,
  thatch: 0.95,
  weave: 0.8,
  sand: 1.0,
  glassfloor: 0.16,
  quilt: 0.85,
  acoustic: 0.9,
  grille: 0.9,
  mirrortile: 0.1,
  terrazzo: 0.3,
  deck: 0.5,
  rubberfloor: 0.75,
  panel: 0.8,
  seats: 0.35,
  concrete: 0.85,
  walltile: 0.2,
};
const FLAT = { matte: [0.82, 0], satin: [0.5, 0], gloss: [0.22, 0], metal: [0.32, 1], leaf: [0.6, 0] };
const WATER_Y = -0.25;
const MAX_LAMPS = 24;

// A dressed venue's model: `dir` under dist/assets/, `file` the GLB's and the JSON's name, `horizon` its painted horizon's ring
// (radius, copies round the ring, the picture's height over width, its foot, its turn; `arc` [start, length] in radians for a
// ring that only goes part of the way round, the copies then spread over the arc) when it has one.
export function dressedVenue({ dir, file, label, horizon = null }) {
  const BASE = new URL(`../assets/${dir}/`, import.meta.url).href;
  let ready = null,
    loading = null;
  const pictures = (info) => [
    ...Object.keys(info.tiles || {}).flatMap((t) => [t, t + "_n"]),
    ...Object.keys(info.atlases || {}),
    "floor_paint",
    "floor_ao",
    ...(horizon ? ["horizon"] : []),
  ];
  return {
    horizon,
    pictures,
    ready: () => !!ready,
    model: () => ready,
    // (for the checks, which parse the model themselves and have no pictures)
    prime(model) {
      ready = model && { horizon, ...model };
    },
    // Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic venue stays).
    load(base = BASE) {
      if (ready) return Promise.resolve(ready);
      loading ||= (async () => {
        const { GLTFLoader } = await import("../assets/GLTFLoader.js");
        const loader = new THREE.TextureLoader();
        const flipped = new Set(["floor_paint", "floor_ao", "horizon"]),
          raw = (name) => name.endsWith("_n") || name === "floor_ao";
        const picture = (name) =>
          loader.loadAsync(base + name + ".webp").then((t) => {
            t.flipY = flipped.has(name);
            t.colorSpace = raw(name) ? THREE.NoColorSpace : THREE.SRGBColorSpace;
            t.anisotropy = 4;
            return [name, t];
          });
        const info = await fetch(base + file + ".json").then((r) => r.json());
        const [gltf, ...loaded] = await Promise.all([
          new GLTFLoader().loadAsync(base + file + ".glb"),
          ...pictures(info).map(picture),
        ]);
        const textures = Object.fromEntries(loaded);
        for (const t of Object.keys(info.tiles || {}))
          for (const k of [t, t + "_n"]) textures[k].wrapS = textures[k].wrapT = THREE.RepeatWrapping;
        if (horizon) {
          // (the horizon goes round several times, every other copy mirrored, so each seam meets itself)
          textures.horizon.wrapS = THREE.MirroredRepeatWrapping;
          textures.horizon.repeat.x = horizon.copies;
        }
        ready = { scene: gltf.scene, info, textures, horizon };
        return ready;
      })().catch((error) => {
        console.error(label + "'s model did not load; the classic one stays.", error);
        loading = null;
        return null;
      });
      return loading;
    },
  };
}

// Put the model into the world `w` with its materials, its lamps and glows and its horizon, lit as `look` says (`lamps`: how lit the
// lanterns are, 0 by day; `clouds`: the drifting shade; `horizon`: its tint). `deckSet` is the tile set the deck's paint lies on.
// `hour`: the venue's light slides with the game's hour (the Sunset Lagoon's golden hour into dusk, and its storms): the lamps
// follow the hour's glow and the horizon takes the hour's light, every frame, instead of `look`'s fixed values.
// Returns the model's root (the venue's module wires the game's live parts to it).
export function dressModel(w, model, { look, name, deckSet, hour = false }) {
  const info = model.info;
  const U = {
    lamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) },
    lampCount: { value: 0 },
    lampColor: { value: new THREE.Color(look.lampColor ?? 0xffc477) },
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
  const root = model.scene.clone(true);
  root.name = name;
  w.scene.add(root);
  (w.liveProps ||= []).push(root); // (the model is batched already: never again by scene.mjs)
  const material = makeMaterials(w, U, model, deckSet);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const cls = (o.material?.name || "satin").replace(/^H_/, "");
    o.material = material(cls);
    const base = cls.replace(/_n$/, "");
    o.castShadow = !cls.endsWith("_n") && !["glass", "lamp", "nightglow", "signs"].includes(base);
    o.receiveShadow = !["nightglow", "glass", "lamp"].includes(base);
  });
  const ring = horizonRing(w, model, look, name);
  const glow = glows(w, info.lights, name);
  // the hour's lamps: the shader's pools of light, the lanterns' glass, the windows, the glows; all die with the power
  const setLamps = (k) => {
    U.night.value = k;
    for (const m of U.lampMaterials) m.emissiveIntensity = 1.6 * k;
    for (const m of U.glowMaterials) m.color.setScalar(0.85 * k);
    if (glow) glow.uniforms.uLight.value = k;
  };
  w.stringLights = glow?.points || null;
  if (!hour) {
    setLamps(look.lamps || 0);
    w.dimmers.push((k, dark) => setLamps(dark ? 0 : (look.lamps || 0) * Math.max(0, Math.min(1, k))));
    // (festoons and glows hide in a power cut by the game's own rule for string lights: incident-view.mjs)
    if (w.stringLights) w.stringLights.visible = (look.lamps || 0) > 0;
    return root;
  }
  // Following the hour: the lamps come on as the glow of dusk rises (none in the full sun, all lit by dusk), the power cut's
  // dimmer over them; the horizon takes the hour's light (bright and warm at golden hour, dim and blue at dusk, grey in a storm).
  let power = 1,
    key = null;
  const tint = new THREE.Color(),
    sky = new THREE.Color();
  w.dimmers.push((k, dark) => (power = dark ? 0 : Math.max(0, Math.min(1, k))));
  w.updaters.push((time, dt, world) => {
    const L = world.look || look,
      lit = hourLamps(world.ambience?.glow ?? L.glow ?? 0);
    const k = lit * power;
    const next = Math.round(k * 200) + ":" + (L.t ?? "") + ":" + Math.round((L.storm || 0) * 100);
    if (next === key) return;
    key = next;
    setLamps(k);
    if (w.stringLights) w.stringLights.visible = k > 0.02;
    if (ring) ring.material.color.copy(horizonLight(L, tint, sky));
  });
  return root;
}

// How lit the lamps are for the hour's glow (dayLook: 0 at noon, 0.05 at golden hour, 0.2 at sunset, 0.7 at dusk, 1 at night).
export const hourLamps = (glow) => Math.max(0, Math.min(1, (glow - 0.06) / 0.4));
// The painted horizon's tint for a look: the hour's horizon colour over white, as bright as the hour's sun and sky light.
export function horizonLight(look, out = new THREE.Color(), tmp = new THREE.Color()) {
  const hz = look.dome?.horizon ?? look.fog?.[0] ?? 0xffffff;
  out.setRGB(1, 1, 1).lerp(tmp.set(hz), 0.42);
  const light = Math.max(
    0.28,
    Math.min(1.05, 0.3 + 0.18 * (look.sun?.[1] ?? 2.5) + 0.12 * (look.hemi?.[2] ?? 1)),
  );
  return out.multiplyScalar(light);
}

// The life rings hang where the model's boards hold them: the nearest of its LifeRing places to each mount.
export function ringsFromModel(venue, info) {
  const rings = info.anchors?.LifeRing || [];
  return venue.ringMounts.map((m) => {
    const near = rings
      .map(([x, y, z]) => ({ x, y, z, d: Math.hypot(x - m.x, z - m.z) }))
      .sort((a, b) => a.d - b.d)[0];
    return near && near.d < 0.8 ? near : null;
  });
}

// One addition to every lit material of the venue: caustics on what lies under the water; on the deck its paint and its contact
// shadows (elsewhere the vertex colours' alpha, on the ambient light only); the lamps' light on everything near them after dusk;
// by day the shade of slow clouds over the sun's light.
function venueShader(material, w, U, model, { deck = false } = {}) {
  const u = w.poolUniforms,
    T = model.textures,
    P = model.info.paint;
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
      .replace("#include <common>", "#include <common>\nvarying vec3 vDressed;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvDressed = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    let fragment = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vDressed;
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
          vec2 paintUv = vec2((vDressed.x - uPaintRect.x) / uPaintRect.z, 1.0 - (vDressed.z - uPaintRect.y) / uPaintRect.z);
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
      float under = 1.0 - smoothstep(${(WATER_Y - 0.12).toFixed(2)}, ${(WATER_Y + 0.06).toFixed(2)}, vDressed.y);
      totalEmissiveRadiance += vec3(0.55, 0.95, 0.95) * caustic(vDressed.xz, uTime) * uCaustic * under * 0.8;`,
    );
  };
  material.customProgramCacheKey = () => "dressed" + (deck ? ":deck" : "");
  return material;
}

// (after the lights are summed: the clouds shade the sun's share, the lamps add their own)
const LIGHT_BLOCK = `
      if (uClouds > 0.0) {
        vec2 cp = vDressed.xz * 0.045 + vec2(uTime * 0.012, uTime * 0.005);
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
          vec3 d = uLamps[i].xyz - vDressed;
          float dist2 = dot(d, d);
          float fall = uLamps[i].w / (1.0 + dist2 * 0.9) * smoothstep(42.0, 4.0, dist2);
          float facing = clamp(dot(worldNormal, normalize(d)) * 0.8 + 0.2, 0.0, 1.0);
          lampLight += fall * facing;
        }
        reflectedLight.directDiffuse += diffuseColor.rgb * uLampColor * lampLight * uNight * (0.55 + 0.45 * contact);
      }`;

function makeMaterials(w, U, model, deckSet) {
  const T = model.textures,
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
        model,
        { deck: set === deckSet },
      );
    } else if (base === "signs")
      m = venueShader(
        new THREE.MeshStandardMaterial({ map: T.atlas_signs, roughness: 0.6, vertexColors: true }),
        w,
        U,
        model,
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
        model,
      );
    else if (base === "lamp") {
      // lantern glass and bulbs: pale glass by day, glowing in their own colour once the lamps are lit
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: 0xffffff });
      m.color.setScalar(0.85);
      m.emissiveIntensity = 0;
      // (the glow takes each lamp's own colour, its vertex colour: warm lanterns, pink and cyan neon)
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;",
        );
      };
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
        model,
      );
    }
    m.name = "dressed:" + cls;
    cache.set(cls, m);
    return m;
  };
}

// The painted horizon on a ring round the venue beyond its trees, tinted by the hour and never fogged, the sky dome and its clouds
// over it. One draw call; nothing in the play sees it.
function horizonRing(w, model, look, name) {
  const map = model.textures.horizon,
    H = model.horizon;
  if (!map || !H) return null;
  const [start, arc] = H.arc || [0, Math.PI * 2];
  const height = ((arc * H.radius) / H.copies) * H.aspect;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(
      H.radius,
      H.radius,
      height,
      Math.ceil((128 * arc) / (Math.PI * 2)),
      1,
      true,
      start,
      arc,
    ),
    new THREE.MeshBasicMaterial({
      map,
      color: look.horizon ?? 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
    }),
  );
  ring.name = name + "-horizon";
  ring.position.y = H.base + height / 2;
  ring.rotation.y = H.turn || 0;
  ring.renderOrder = -10; // (first of the see-through things: everything nearer is drawn over it)
  w.scene.add(ring);
  w.dressedHorizon = ring;
  return ring;
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
  Paper: { color: 0xffa060, size: 1.2, light: 1.0 },
  Sconce: { color: 0xffc86a, size: 0.9, light: 1.0 },
  Uplight: { color: 0xff6ad8, size: 0.8, light: 1.3 },
  Torchiere: { color: 0xffd8a0, size: 1.3, light: 1.4 },
  Bonfire: { color: 0xff8a30, size: 5.0, light: 2.6 },
  // (the Aquatic Centre: the spots over the timing board, the CHANGING boxes; its hall lamps are the Coach Cam's ceiling's, no glow)
  Spot: { color: 0xf4f8ff, size: 0.7, light: 1.0 },
  Sign: { color: 0xbfe6ff, size: 0.6, light: 0.6 },
  HallLamp: { color: 0xf2f8ff, size: 0, light: 0 },
  default: { color: 0xffe2b0, size: 0.8, light: 0.8 },
};
function glows(w, lights = [], name = "dressed") {
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
  points.name = name + "-glows";
  points.frustumCulled = false;
  points.renderOrder = 4;
  w.scene.add(points);
  return { points, uniforms };
}
