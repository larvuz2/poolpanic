// The Look tuner's values put to work on the world, just before it is drawn (look-tuner.mjs, 3 November 2026). The lights, the
// exposure, the fog and the water are multiplied for the drawing and put back right after it, so whatever the venue sets them to
// each frame (a sliding hour, a storm, a blackout) stays the venue's and the tuner only leans on it. What lasts (the tone mapping, the
// shadows' kind and size, the textures' sharpness, the pixel ratio, the materials) is changed once, when its value changes, and the
// game's own look comes back when every knob is back at its default.
import { THREE } from "./kit.mjs";
import { LOOK_DEFAULTS, gradeFilter } from "../look-tuner.mjs";

const TONE = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  linear: THREE.LinearToneMapping,
};
const SHADOW = {
  pcfsoft: THREE.PCFSoftShadowMap,
  pcf: THREE.PCFShadowMap,
  vsm: THREE.VSMShadowMap,
  basic: THREE.BasicShadowMap,
};
const recompile = (scene) =>
  scene?.traverse((o) => {
    for (const m of [].concat(o.material || [])) m.needsUpdate = true;
  });

// What lasts: changed once when it changes.
function lasting(w, L) {
  const r = w.renderer,
    was = (w.lookLast ||= { ...LOOK_DEFAULTS, shadowSize: null });
  if (L.tone !== was.tone) r.toneMapping = TONE[L.tone] ?? THREE.ACESFilmicToneMapping;
  if (L.shadowType !== was.shadowType) {
    r.shadowMap.type = SHADOW[L.shadowType] ?? THREE.PCFSoftShadowMap;
    recompile(w.scene);
    recompile(w.coachCam?.scene);
    w.sun?.shadow.map?.dispose();
    if (w.sun) w.sun.shadow.map = null;
  }
  const size = L.shadowSize === "auto" ? globalThis.__poolGfx?.plan?.shadow || 2048 : Number(L.shadowSize);
  if (w.sun && size > 0 && w.sun.shadow.mapSize.x !== size) {
    w.sun.shadow.mapSize.set(size, size);
    w.sun.shadow.map?.dispose();
    w.sun.shadow.map = null;
  }
  if (L.aniso !== was.aniso) {
    w.lookAniso = L.aniso === "auto" ? null : Number(L.aniso);
    w.sharpenedAt = 0; // (sharpenTextures looks again at once)
  }
  if (L.scale !== was.scale) {
    w.lookScale = L.scale === "auto" ? null : Number(L.scale);
    w.resize();
  }
  // The colour grade and the vignette, on the drawing surface (CSS: the menu's stage is left alone, style.css).
  const grade = gradeFilter(L);
  if (grade !== w.lookGrade) {
    w.lookGrade = grade;
    r.domElement.style.filter = grade;
  }
  if (L.vignette !== was.vignette) {
    let v = w.lookVignette;
    if (!v && L.vignette > 0 && w.container) {
      v = w.lookVignette = document.createElement("div");
      v.className = "look-vignette";
      w.container.appendChild(v);
    }
    if (v) v.style.opacity = String(L.vignette);
  }
  w.lookLast = { ...L, shadowSize: size };
}

// The materials: their own values kept the first time they are changed, and the knobs' multiples of them put on when the knobs
// change or the venue is built again (looked over twice a second, so models that arrive later are met too).
const MATERIAL_KNOBS = ["albedo", "rough", "metal", "normal", "ao", "glow"];
function materials(w, L) {
  const key = MATERIAL_KNOBS.map((k) => L[k]).join(",");
  const now = performance.now();
  if (key === w.lookMaterialKey && now - (w.lookMaterialAt || 0) < 500) return;
  const plain = key === MATERIAL_KNOBS.map((k) => LOOK_DEFAULTS[k]).join(",");
  if (plain && !w.lookTouched) return; // (the game's own materials, never changed: nothing to do)
  w.lookMaterialKey = key;
  w.lookMaterialAt = now;
  const visit = (o) => {
    for (const m of [].concat(o.material || [])) {
      if (!m.isMeshStandardMaterial || m.userData.lookKey === key) continue;
      if (plain && !m.userData.lookBase) continue; // (never changed: nothing to put back)
      const base = (m.userData.lookBase ||= {
        // (the colour only where there is a texture: the surfaces' pictures, not the game's flashes and markers)
        color: m.map ? m.color.clone() : null,
        roughness: m.roughness,
        metalness: m.metalness,
        normalScale: m.normalScale?.clone(),
        aoMapIntensity: m.aoMapIntensity,
        emissiveIntensity: m.emissiveIntensity,
      });
      if (base.color) m.color.copy(base.color).multiplyScalar(L.albedo);
      m.roughness = Math.min(1, base.roughness * L.rough);
      m.metalness = Math.min(1, base.metalness * L.metal);
      if (base.normalScale) m.normalScale.copy(base.normalScale).multiplyScalar(L.normal);
      m.aoMapIntensity = base.aoMapIntensity * L.ao;
      m.emissiveIntensity = base.emissiveIntensity * L.glow;
      m.userData.lookKey = key;
    }
  };
  w.scene.traverse(visit);
  w.coachCam?.scene?.traverse(visit);
  w.lookTouched = !plain;
}
const FRAME_KNOBS = [
  "exposure",
  "sky",
  "fill",
  "env",
  "sun",
  "warmth",
  "sunHeight",
  "shadows",
  "shadowStrength",
  "shadowBlur",
  "fog",
  "fogDistance",
  "waterLight",
  "caustics",
];

// Before the drawing: returns what puts the frame's own values back after it (null when there is nothing to put back).
export function lookBefore(w, L) {
  if (!w.renderer || !L) return null;
  if (L !== w.lookValues) {
    w.lookValues = L;
    lasting(w, L);
  }
  materials(w, L);
  if (FRAME_KNOBS.every((k) => L[k] === LOOK_DEFAULTS[k])) return null;
  const r = w.renderer,
    sun = w.sun,
    fog = w.scene.fog,
    water = w.water?.material?.uniforms,
    pool = w.poolUniforms;
  const saved = {
    exposure: r.toneMappingExposure,
    hemi: w.hemi?.intensity,
    sun: sun?.intensity,
    fill: w.fill?.intensity,
    env: w.scene.environmentIntensity,
    sunColor: sun?.color.clone(),
    sunY: sun?.position.y,
    cast: sun?.castShadow,
    strength: sun?.shadow.intensity,
    radius: sun?.shadow.radius,
    fogNear: fog?.near,
    fogFar: fog?.far,
    waterLight: water?.uLight?.value,
    caustic: pool?.uCaustic?.value,
  };
  r.toneMappingExposure *= L.exposure;
  if (w.hemi) w.hemi.intensity *= L.sky;
  if (w.fill) w.fill.intensity *= L.fill;
  w.scene.environmentIntensity *= L.env;
  if (sun) {
    sun.intensity *= L.sun;
    if (L.warmth) sun.color.multiply(new THREE.Color(1 + 0.2 * L.warmth, 1, 1 - 0.35 * L.warmth));
    sun.position.y *= L.sunHeight;
    sun.castShadow = sun.castShadow && L.shadows;
    sun.shadow.intensity = L.shadowStrength;
    sun.shadow.radius = L.shadowBlur;
  }
  if (fog) {
    // (no fog: pushed out past everything, which keeps the materials' programs as they are)
    fog.near = L.fog ? fog.near * L.fogDistance : 1e5;
    fog.far = L.fog ? fog.far * L.fogDistance : 1e5 + 1;
  }
  if (water?.uLight) water.uLight.value *= L.waterLight;
  if (pool?.uCaustic) pool.uCaustic.value *= L.caustics;
  return () => {
    r.toneMappingExposure = saved.exposure;
    if (w.hemi) w.hemi.intensity = saved.hemi;
    if (w.fill) w.fill.intensity = saved.fill;
    w.scene.environmentIntensity = saved.env;
    if (sun) {
      sun.intensity = saved.sun;
      sun.color.copy(saved.sunColor);
      sun.position.y = saved.sunY;
      sun.castShadow = saved.cast;
      sun.shadow.intensity = saved.strength;
      sun.shadow.radius = saved.radius;
    }
    if (fog) {
      fog.near = saved.fogNear;
      fog.far = saved.fogFar;
    }
    if (water?.uLight) water.uLight.value = saved.waterLight;
    if (pool?.uCaustic) pool.uCaustic.value = saved.caustic;
  };
}
