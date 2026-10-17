// The city below the Rooftop Pool (17 October 2026): what the guests look down on past the infinity edge, at golden hour going to
// dusk. The roof is 185 m up. Down there: streets lit with lamps and moving traffic, blocks of towers (three facades generated for
// it, assets/rooftop/facade-*.jpg, their windows coming on), a downtown of taller towers straight ahead of the pool's edge, two
// supertall towers with blinking lights, a garden of glowing supertrees, a great observation wheel turning slowly, a bay with the
// sun's glitter on it and a lit bridge across, and beyond it all the painted skyline (assets/rooftop/skyline.jpg) to the hills.
//
// Cheap on purpose (it must run in a browser): the towers are three instanced meshes of boxes (one per facade, the facade laid on
// in world space), the traffic is scrolling dashes on ribbons, everything far is fogged into the haze. Presentation only.
import { THREE } from "./kit.mjs";
import { rngOf } from "./geom.mjs";

export const CITY = {
  ground: -185, // the street, m below the deck
  reach: 1700, // how far the modelled city goes
  bayX: 560, // the bay begins this far out past the far edge (+x)
  panorama: 1850,
};
const TAU = Math.PI * 2;

// A picture from assets/rooftop, loaded once; `apply(texture)` when it is in (a headless world keeps the stand-in colour).
const pictures = new Map();
export function roofPicture(
  w,
  file,
  apply,
  { repeat = [1, 1], wrap = THREE.RepeatWrapping, color = "#808080" } = {},
) {
  const dress = (t) => {
    t.wrapS = t.wrapT = wrap;
    t.repeat.set(...repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    w.textures.push(t);
    return t;
  };
  const c = new THREE.Color(color),
    stand = new THREE.DataTexture(
      new Uint8Array([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255]),
      1,
      1,
    );
  stand.needsUpdate = true;
  apply(dress(stand), false);
  if (typeof Image !== "function") return;
  if (!pictures.has(file))
    pictures.set(
      file,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = new URL("../assets/rooftop/" + file, import.meta.url).href;
      }).catch((error) => {
        console.warn("The picture " + file + " did not load; its stand-in stays.", error);
        pictures.delete(file);
        return null;
      }),
    );
  const scene = w.scene;
  pictures.get(file).then((image) => {
    if (!image || w.scene !== scene) return;
    const t = new THREE.Texture(image);
    t.needsUpdate = true;
    apply(dress(t), true);
  });
}

// World-space facades for instanced boxes: the picture laid on the walls by where they are (so a tall tower shows more floors,
// not a stretched picture), a dark roof on top, and the lit windows glowing as the light goes.
function facadeMaterial(w, file, tile, tint) {
  const material = new THREE.MeshLambertMaterial({ color: tint, emissive: 0xffffff, emissiveIntensity: 0 });
  const glow = { value: 0.55 };
  material.userData.glow = glow;
  roofPicture(
    w,
    file,
    (t) => {
      material.map = t;
      material.emissiveMap = t;
      material.emissiveIntensity = 1;
      material.needsUpdate = true;
    },
    { color: "#3a3f58" },
  );
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFacade;\nvarying float vRoof;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          mat4 fm = modelMatrix * instanceMatrix;
        #else
          mat4 fm = modelMatrix;
        #endif
        vec4 fw = fm * vec4(transformed, 1.0);
        vec3 fn = normalize(mat3(fm) * objectNormal);
        vRoof = step(0.5, fn.y);
        vFacade = (abs(fn.x) > abs(fn.z) ? vec2(fw.z, fw.y) : vec2(fw.x, fw.y)) / ${tile.toFixed(1)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vFacade;\nvarying float vRoof;\nuniform float uGlow;",
      )
      .replace(
        "#include <map_fragment>",
        `vec4 facadeC = texture2D(map, vFacade);
        diffuseColor.rgb *= mix(facadeC.rgb, vec3(0.16, 0.16, 0.2), vRoof);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `float lit = smoothstep(0.42, 0.75, max(facadeC.r, facadeC.g) - facadeC.b * 0.35);
        totalEmissiveRadiance = vec3(1.0, 0.78, 0.45) * lit * uGlow * (1.0 - vRoof);`,
      );
  };
  material.customProgramCacheKey = () => "roof-facade";
  return material;
}

// A canvas: the streets seen from high up, a grid of avenues with lamps, a block's worth (it repeats).
function streetTexture() {
  const size = 256,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  g.fillStyle = "#3a3a44";
  g.fillRect(0, 0, size, size);
  // blocks: pavement and little courtyards
  g.fillStyle = "#4a4852";
  g.fillRect(22, 22, size - 44, size - 44);
  g.fillStyle = "#3f5a44";
  g.fillRect(60, 60, 40, 30);
  g.fillRect(150, 140, 50, 40);
  // the avenue's lamps
  for (let i = 0; i < size; i += 16) {
    for (const [x, y] of [
      [i, 6],
      [6, i],
      [i, size - 8],
      [size - 8, i],
    ]) {
      g.fillStyle = "rgba(255,214,140,0.95)";
      g.fillRect(x, y, 3, 3);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  return t;
}

export function buildCity(w) {
  const group = new THREE.Group();
  group.name = "city";
  w.scene.add(group);
  const rand = rngOf(4242),
    G = CITY.ground,
    updates = [];
  // ---- the ground: streets and blocks, and the bay ----
  if (typeof document !== "undefined") {
    const streets = streetTexture();
    streets.wrapS = streets.wrapT = THREE.RepeatWrapping;
    streets.repeat.set(CITY.reach / 40, CITY.reach / 40);
    streets.colorSpace = THREE.SRGBColorSpace;
    w.textures.push(streets);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(CITY.reach, 64),
      new THREE.MeshLambertMaterial({
        map: streets,
        emissive: 0xffffff,
        emissiveMap: streets,
        emissiveIntensity: 0.35,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = G;
    group.add(ground);
  }
  // The bay: water from `bayX` out, warm with the sunset, the sun's glitter road on it.
  const bayMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNear: { value: new THREE.Color(0x2a3c66) },
      uFar: { value: new THREE.Color(0xf0a070) },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 1 },
      fogFar: { value: 2 },
    },
    fog: true,
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uNear; uniform vec3 uFar; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        float d = clamp((vW.x - ${CITY.bayX.toFixed(1)}) / 1100.0, 0.0, 1.0);
        vec3 c = mix(uNear, uFar, pow(d, 0.8));
        float road = exp(-pow(vW.z / (60.0 + d * 260.0), 2.0));
        float wave = sin(vW.x * 0.09 + uTime * 0.6 + sin(vW.z * 0.05)) * sin(vW.z * 0.13 - uTime * 0.4);
        c += vec3(1.0, 0.72, 0.4) * road * smoothstep(0.55, 1.0, wave) * 1.4;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(CITY.reach * 2, CITY.reach * 2), bayMat);
  bay.rotation.x = -Math.PI / 2;
  bay.position.set(CITY.bayX + CITY.reach, G + 0.4, 0);
  group.add(bay);
  updates.push((t) => (bayMat.uniforms.uTime.value = t));

  // ---- the towers: three facades, instanced ----
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const lists = [[], [], []];
  const place = (x, z, wdt, dep, h, kind) => lists[kind].push({ x, z, wdt, dep, h });
  // Blocks on a grid of 46 m (avenues between), out to the bay and all round; downtown (straight ahead, past the far edge) tall.
  for (let gx = -1500; gx < CITY.bayX - 30; gx += 46)
    for (let gz = -1500; gz <= 1500; gz += 46) {
      const r = Math.hypot(gx, gz);
      if (r > CITY.reach - 60 || r < 55) continue;
      // Downtown is straight ahead past the far edge, a few hundred metres out; round the tower itself the blocks are low, so
      // the view goes a long way down.
      const ahead = gx > 220 && gx < CITY.bayX && Math.abs(gz) < 520,
        n = 1 + Math.floor(rand() * (ahead ? 3 : 2));
      for (let k = 0; k < n; k++) {
        if (rand() < 0.12) continue;
        const wdt = 12 + rand() * 16,
          dep = 12 + rand() * 16,
          x = gx + (rand() - 0.5) * (36 - wdt),
          z = gz + (rand() - 0.5) * (36 - dep);
        const fall = Math.max(0, 1 - r / 1500),
          near = Math.min(1, Math.max(0, (r - 80) / 260)),
          tall = ahead ? 45 + rand() * 85 : 14 + rand() * (18 + 70 * fall * fall * near);
        place(x, z, wdt, dep, Math.min(tall, 130), Math.floor(rand() * 3));
      }
    }
  // The bay front's own row of glass towers.
  for (let z = -900; z <= 900; z += 70 + rand() * 40)
    place(CITY.bayX - 30 - rand() * 30, z, 22 + rand() * 12, 22 + rand() * 12, 60 + rand() * 90, 0);
  const tints = [0xd6dcef, 0xf0e2d0, 0xe8e2dc];
  ["facade-a.jpg", "facade-b.jpg", "facade-c.jpg"].forEach((file, kind) => {
    const list = lists[kind];
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(
      box,
      facadeMaterial(w, file, [26, 30, 22][kind], tints[kind]),
      list.length,
    );
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      p = new THREE.Vector3();
    list.forEach((b, i) => {
      m.compose(p.set(b.x, G, b.z), q, s.set(b.wdt, b.h, b.dep));
      mesh.setMatrixAt(i, m);
    });
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  // ---- landmarks ----
  const glow = (color, intensity = 1) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  // Two supertall towers, tapering, crowned, with red lights that blink.
  const blinkers = [];
  for (const [x, z, h] of [
    [340, 190, 236],
    [372, 236, 214],
  ]) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 15, h, 8, 1),
      facadeMaterial(w, "facade-a.jpg", 24, 0xdfe6ff),
    );
    tower.geometry.translate(0, h / 2, 0);
    tower.position.set(x, G, z);
    tower.rotation.y = Math.PI / 8;
    group.add(tower);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(9, 28, 8), glow(0xfff2cf, 0.95));
    crown.position.set(x, G + h + 14, z);
    group.add(crown);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 6), glow(0xd0d4dc));
    spire.position.set(x, G + h + 40, z);
    group.add(spire);
    const light = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), glow(0xff2020));
    light.position.set(x, G + h + 56, z);
    group.add(light);
    blinkers.push(light);
  }
  updates.push((t) => blinkers.forEach((b, i) => (b.visible = (t + i * 0.7) % 1.6 < 0.5)));
  // A garden of supertrees: funnels of steel, their canopies glowing violet and pink, a skyway between two.
  const trees = new THREE.Group();
  const canopies = [];
  for (let i = 0; i < 9; i++) {
    const h = 26 + rand() * 22,
      x = 250 + rand() * 90,
      z = -250 + rand() * 120;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 1.6, h, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: 0x5e4b5a, emissive: 0x3a1140, side: THREE.DoubleSide }),
    );
    trunk.position.set(x, G + h / 2, z);
    trees.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(9 + rand() * 3, 4, 3, 16, 1, true),
      glow(0xc04dff, 0.9),
    );
    canopy.material.side = THREE.DoubleSide;
    canopy.position.set(x, G + h, z);
    trees.add(canopy);
    canopies.push(canopy);
  }
  group.add(trees);
  updates.push((t) =>
    canopies.forEach((c, i) => c.material.color.setHSL((0.78 + 0.08 * Math.sin(t * 0.4 + i)) % 1, 0.9, 0.55)),
  );
  // The observation wheel by the bay: a rim of lights on spokes, capsules, an A-frame, turning very slowly.
  const wheel = new THREE.Group(),
    R = 46;
  wheel.position.set(CITY.bayX - 60, G + R + 14, -320);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.9, 6, 64), glow(0xbfe6ff, 0.9));
  wheel.add(rim);
  const spokes = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU,
      spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, R, 4), glow(0x8fa6c0, 0.7));
    spoke.position.set(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0);
    spoke.rotation.z = a - Math.PI / 2;
    spokes.add(spoke);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), glow(0xfff0c8, 0.95));
    pod.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    spokes.add(pod);
  }
  wheel.add(spokes);
  wheel.rotation.y = Math.PI / 2;
  group.add(wheel);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.4, R + 18, 6),
      new THREE.MeshLambertMaterial({ color: 0x8c8c9a }),
    );
    leg.position.set(CITY.bayX - 60 + s * 0, G + (R + 18) / 2, -320 + s * 14);
    leg.rotation.x = s * 0.28;
    group.add(leg);
  }
  updates.push((t, dt) => (spokes.rotation.z += dt * 0.025));
  // A bridge across the bay, its cables lit.
  const deckLen = 900,
    bridge = new THREE.Mesh(
      new THREE.BoxGeometry(14, 3, deckLen),
      new THREE.MeshLambertMaterial({ color: 0x6a6e7c }),
    );
  bridge.position.set(CITY.bayX + 420, G + 34, 260);
  group.add(bridge);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(1.4, 6, 4), glow(0xffd28a, 1), 60);
  for (let i = 0; i < 60; i++)
    lamps.setMatrixAt(
      i,
      new THREE.Matrix4().setPosition(
        CITY.bayX + 420 + (i % 2 ? 7 : -7),
        G + 37,
        260 - deckLen / 2 + (i >> 1) * 30,
      ),
    );
  lamps.frustumCulled = false;
  group.add(lamps);
  for (const z of [-180, 180]) {
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(6, 110, 6),
      new THREE.MeshLambertMaterial({ color: 0xdcdcdc }),
    );
    pylon.position.set(CITY.bayX + 420, G + 55, 260 + z);
    group.add(pylon);
  }

  // ---- the traffic: ribbons of headlights and tail lights scrolling along the avenues ----
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 8;
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, 256, 8);
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(Math.random() * 250);
      g.fillStyle = "rgba(255,240,210,1)";
      g.fillRect(x, 1, 4, 2);
      g.fillStyle = "rgba(255,60,40,1)";
      g.fillRect((x + 120) % 252, 5, 4, 2);
    }
    const lights = new THREE.CanvasTexture(canvas);
    lights.wrapS = THREE.RepeatWrapping;
    lights.colorSpace = THREE.SRGBColorSpace;
    w.textures.push(lights);
    const ribbons = [];
    const avenue = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0),
        t = lights.clone();
      t.needsUpdate = true;
      t.repeat.set(len / 60, 1);
      w.textures.push(t);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 7),
        new THREE.MeshBasicMaterial({
          map: t,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
      m.position.set((x0 + x1) / 2, G + 0.6, (z0 + z1) / 2);
      group.add(m);
      ribbons.push({ t, speed: 0.02 + Math.random() * 0.03 });
    };
    for (let z = -1012; z <= 1012; z += 184) avenue(-1400, z + 23, CITY.bayX - 40, z + 23);
    for (let x = -1380; x < CITY.bayX - 40; x += 184) avenue(x + 23, -1400, x + 23, 1400);
    updates.push((t, dt) => ribbons.forEach((r) => (r.t.offset.x -= dt * r.speed)));
  }

  // ---- the painted horizon: the skyline panorama all round, fading up into the sky ----
  const pano = new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, uFade: { value: 0.9 } },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vec2(vUv.x, mix(0.02, 0.62, vUv.y)));
        float a = 1.0 - smoothstep(0.55, 1.0, vUv.y);
        gl_FragColor = vec4(c.rgb, a);
      }`,
  });
  roofPicture(w, "skyline.jpg", (t, real) => {
    pano.uniforms.map.value = t;
    pano.visible = real;
  });
  const P = CITY.panorama,
    panorama = new THREE.Mesh(new THREE.CylinderGeometry(P, P, 1400, 64, 1, true), pano);
  panorama.position.y = G + 380;
  panorama.renderOrder = -50;
  panorama.frustumCulled = false;
  group.add(panorama);

  return {
    group,
    update(t, dt) {
      for (const u of updates) u(t, dt);
    },
    // How lit the windows are (0 by day, 1 at night): the look's glow.
    setGlow(k) {
      group.traverse((o) => {
        if (o.material?.userData?.glow) o.material.userData.glow.value = 0.25 + 0.75 * k;
      });
    },
  };
}
