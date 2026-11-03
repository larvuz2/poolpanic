// The Look tuner (dist/look-tuner.mjs, dist/scene/look.mjs; README "The Look tuner"): its knobs and what is saved, the layers (every
// venue, then a venue's own), the colour grade, the copied text, antialiasing read at launch; and on a world, the lights, exposure,
// fog and water leaned on for one drawing and put back after it, the materials scaled from their own values and back, the tone
// mapping and the shadows' kind. Dev mode only; nothing here touches the simulation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "./dist/assets/three.module.js";
import {
  KNOBS,
  KNOB,
  LOOK_DEFAULTS,
  LOOK_KEY,
  knobValue,
  normalizeLook,
  lookFor,
  lookDiff,
  gradeFilter,
  copyText,
  antialiasOff,
} from "./dist/look-tuner.mjs";
import { lookBefore } from "./dist/scene/look.mjs";

// 1) The knobs: each with a group and a label, a default inside its range or among its choices, and ids that are unique.
{
  assert.equal(new Set(KNOBS.map((k) => k.id)).size, KNOBS.length, "every knob its own id");
  assert.ok(KNOBS.length >= 30, "a lot of sliders");
  for (const k of KNOBS) {
    assert.ok(k.group && k.label, k.id);
    if (k.toggle) assert.equal(typeof k.def, "boolean", k.id);
    else if (k.choices)
      assert.ok(
        k.choices.some(([v]) => v === k.def),
        k.id,
      );
    else assert.ok(k.def >= k.min && k.def <= k.max && k.step > 0, k.id);
  }
  for (const g of ["Light", "Shadows", "Materials", "Textures", "Water", "Air", "Colour grade", "Resolution"])
    assert.ok(
      KNOBS.some((k) => k.group === g),
      "a group for " + g,
    );
  assert.ok(KNOB.aa.toggle && KNOB.aa.global, "antialiasing: one switch for every venue");
  assert.equal(knobValue("exposure", 9), KNOB.exposure.max, "a number kept in its range");
  assert.equal(knobValue("exposure", "x"), 1);
  assert.equal(knobValue("tone", "agx"), "agx");
  assert.equal(knobValue("tone", "nope"), "aces", "only one of its choices");
  assert.equal(knobValue("shadows", "yes"), true, "a switch is a switch");
}

// 2) What is saved: only what differs from the game's own look, each venue's over every venue's; antialiasing never a venue's.
{
  const look = normalizeLook({
    all: { saturation: 1.3, exposure: 1, bogus: 4 },
    venues: { club: { exposure: 1.2, aa: false }, kids: { exposure: 1 } },
    scope: "all",
    open: true,
  });
  assert.deepEqual(look.all, { saturation: 1.3 });
  assert.deepEqual(look.venues, { club: { exposure: 1.2 } });
  assert.equal(look.scope, "all");
  assert.equal(look.open, true);
  const club = lookFor(look, "club"),
    kids = lookFor(look, "kids");
  assert.equal(club.exposure, 1.2);
  assert.equal(club.saturation, 1.3, "every venue's under the venue's own");
  assert.equal(kids.exposure, 1, "another venue keeps the game's own");
  assert.equal(kids.saturation, 1.3);
  assert.deepEqual(lookDiff(club), { exposure: 1.2, saturation: 1.3 });
  assert.deepEqual(normalizeLook({}), { all: {}, venues: {}, scope: "venue", open: false });
  assert.equal(LOOK_KEY, "pool-panic.look.v1");
  const storage = (v) => ({ getItem: () => JSON.stringify(v) });
  assert.equal(antialiasOff(storage({ all: { aa: false } }), true), true);
  assert.equal(antialiasOff(storage({ all: { aa: false } }), false), false, "only in dev mode");
  assert.equal(antialiasOff(storage({}), true), false);
  const text = copyText(look, { id: "club", name: "Community Pool" });
  assert.match(text, /club: exposure=1\.2, saturation=1\.3/);
  assert.match(text, /all venues: saturation=1\.3/);
}

// 3) The colour grade: nothing at the defaults; a CSS filter otherwise.
{
  assert.equal(gradeFilter(LOOK_DEFAULTS), "");
  assert.equal(
    gradeFilter({ ...LOOK_DEFAULTS, saturation: 1.4, contrast: 1.1, tint: 0.2, hue: -10 }),
    "saturate(1.4) contrast(1.1) sepia(0.2) hue-rotate(-10deg)",
  );
}

// 4) On a world: leaned on for the drawing, put back after it.
{
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 20, 80);
  scene.environmentIntensity = 0.8;
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5),
    fill = new THREE.DirectionalLight(0xffffff, 0.5);
  const textured = new THREE.MeshStandardMaterial({
    map: new THREE.Texture(),
    roughness: 0.6,
    metalness: 0.2,
  });
  textured.color.setRGB(0.5, 0.5, 0.5);
  const plain = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  plain.color.setRGB(0.4, 0.4, 0.4);
  scene.add(
    sun,
    hemi,
    fill,
    new THREE.Mesh(new THREE.BoxGeometry(), textured),
    new THREE.Mesh(new THREE.BoxGeometry(), plain),
  );
  let resized = 0;
  const w = {
    scene,
    sun,
    hemi,
    fill,
    renderer: {
      toneMappingExposure: 1.1,
      toneMapping: THREE.ACESFilmicToneMapping,
      shadowMap: { type: THREE.PCFSoftShadowMap },
      domElement: { style: {} },
    },
    water: { material: { uniforms: { uLight: { value: 1 } } } },
    poolUniforms: { uCaustic: { value: 0.5 } },
    resize: () => resized++,
  };
  // the game's own look: nothing to put back, nothing changed
  assert.equal(lookBefore(w, LOOK_DEFAULTS), null);
  assert.equal(w.renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(textured.roughness, 0.6);
  const L = {
    ...LOOK_DEFAULTS,
    exposure: 1.5,
    sun: 2,
    sky: 0.5,
    env: 2,
    fogDistance: 2,
    caustics: 3,
    tone: "agx",
    shadowType: "vsm",
    shadowSize: "1024",
    shadows: false,
    albedo: 1.5,
    rough: 0.5,
    scale: "1.25",
    saturation: 1.2,
  };
  const undo = lookBefore(w, L);
  assert.ok(Math.abs(w.renderer.toneMappingExposure - 1.65) < 1e-9);
  assert.equal(sun.intensity, 4);
  assert.equal(hemi.intensity, 0.75);
  assert.equal(scene.environmentIntensity, 1.6);
  assert.equal(scene.fog.far, 160);
  assert.equal(w.poolUniforms.uCaustic.value, 1.5);
  assert.equal(sun.castShadow, false);
  assert.equal(w.renderer.toneMapping, THREE.AgXToneMapping);
  assert.equal(w.renderer.shadowMap.type, THREE.VSMShadowMap);
  assert.equal(sun.shadow.mapSize.x, 1024);
  assert.equal(w.lookScale, 1.25);
  assert.equal(resized, 1, "the drawing resized to the new pixel ratio");
  assert.equal(w.renderer.domElement.style.filter, "saturate(1.2)");
  assert.ok(Math.abs(textured.color.r - 0.75) < 1e-6, "a textured surface brightened");
  assert.equal(plain.color.r, 0.4, "an untextured one (a flash, a marker) left alone");
  assert.equal(textured.roughness, 0.3);
  undo();
  assert.equal(w.renderer.toneMappingExposure, 1.1, "the frame's own exposure back after the drawing");
  assert.equal(sun.intensity, 2);
  assert.equal(hemi.intensity, 1.5);
  assert.equal(scene.environmentIntensity, 0.8);
  assert.equal(scene.fog.far, 80);
  assert.equal(w.poolUniforms.uCaustic.value, 0.5);
  assert.equal(sun.castShadow, true);
  // back to the game's own look: what lasts goes back too
  w.lookMaterialAt = 0;
  lookBefore(w, { ...LOOK_DEFAULTS });
  assert.equal(w.renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(w.renderer.shadowMap.type, THREE.PCFSoftShadowMap);
  assert.equal(w.lookScale, null);
  assert.equal(w.renderer.domElement.style.filter, "");
  assert.ok(Math.abs(textured.color.r - 0.5) < 1e-6, "the material's own colour back");
  assert.equal(textured.roughness, 0.6);
}

// 5) Wired in: the world draws through it, the app gives it the tuner's values in dev mode only, F9 and Settings open it, its
//    antialiasing is read before the drawing surface is made, and its freeze holds the shift.
{
  const scene = readFileSync("dist/scene.mjs", "utf8"),
    app = readFileSync("dist/app.mjs", "utf8"),
    html = readFileSync("dist/index.html", "utf8"),
    css = readFileSync("dist/style.css", "utf8");
  assert.match(scene, /const undo = lookBefore\(this, this\.lookSource\?\.\(this\.venue\?\.id\)\);/);
  assert.match(scene, /undo\?\.\(\);/);
  assert.match(
    app,
    /world\.lookSource = \(id\) => \(devMode\(\) && !testing \? lookTuner\.values\(id\) : LOOK_DEFAULTS\);/,
  );
  assert.match(app, /e\.key === "F9" && devMode\(\)/);
  assert.match(app, /\.\.\.\(lookNoAA \? \["noaa"\] : \[\]\)/);
  assert.match(app, /accumulator = lookFreeze \? 0 :/);
  assert.match(html, /id="set-look"/);
  assert.match(
    css,
    /body\.menu #world canvas \{\s*filter: none !important;/,
    "the grade never on the menu's stage",
  );
}

console.log(
  `Look tuner checks passed: ${KNOBS.length} knobs in ${new Set(KNOBS.map((k) => k.group)).size} groups, each venue's own over every venue's, only what differs saved, the colour grade, the copied settings, antialiasing read at launch in dev mode only; on a world the lights, exposure, fog and water leaned on for the drawing and put back, the textured materials scaled and restored, the tone mapping, shadows and pixel ratio back with the defaults; and the game wired to it.`,
);
