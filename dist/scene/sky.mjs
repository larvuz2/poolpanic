// The world beyond an open-air venue, seen from the Coach Cam: a sky dome (sun, moon, stars), chunky toon clouds
// drifting on the wind, layered hills, a sea with the sun's glitter road, a lighthouse and boats, gulls, a hot-air
// balloon, night lanterns and fireflies. A storm turns the same sky dark and adds rain and lightning.
//
// Presentation only. Everything is driven by `look.dome` from daylight.mjs, so the sky, fog and light always agree.
// The overview camera never sees any of it (it looks steeply down), so the group is hidden there.
import { THREE } from "./kit.mjs";
import { mergeGeos, paint, placed, rngOf } from "./geom.mjs";
import { glowTexture } from "./textures.mjs";
import { skyDirection } from "./daylight.mjs";

const TAU = Math.PI * 2;
const DOME_RADIUS = 165;
const SEA_LEVEL = -2.45;

// What each open-air venue has on its horizon.
export const SCENERY = {
  park: {
    sea: true,
    shoreX: -40,
    hills: [80, 100, 124],
    palms: 46,
    lighthouse: [-84, 30],
    boats: 3,
    birds: 8,
    balloons: 1,
    lanterns: 22,
    fireflies: 70,
    seed: 5,
  },
  lagoon: {
    sea: true,
    shoreX: -38,
    hills: [84, 104, 126],
    palms: 60,
    lighthouse: [-86, -34],
    boats: 5,
    birds: 11,
    balloons: 2,
    lanterns: 30,
    fireflies: 90,
    seed: 23,
  },
};

const DOME_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const DOME_FRAG = `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uSunGlow;
uniform vec3 uMoonDir;
uniform float uMoon;
uniform float uStars;
uniform float uTime;
uniform float uFlash;
varying vec3 vDir;
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.34, h));
  col = mix(col, uZenith, smoothstep(0.22, 0.95, h));
  col = mix(uBelow, col, smoothstep(-0.05, 0.01, h));
  float above = smoothstep(-0.03, 0.02, h);
  // Sun: soft halo, a wide colour band low along the horizon, and a chunky disc.
  float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
  col += uSunColor * (exp(-ang * 3.0) * 0.3 + exp(-ang * 10.0) * 0.5) * uSunGlow * (0.25 + 0.75 * above);
  vec2 heading = normalize(d.xz + 1e-5);
  vec2 sflat = normalize(uSunDir.xz + 1e-5);
  float toward = max(dot(heading, sflat), 0.0);
  col += uSunColor * pow(toward, 5.0) * exp(-abs(h) * 7.0) * 0.32 * uSunGlow * above;
  float disc = (1.0 - smoothstep(uSunSize * 0.88, uSunSize, ang)) * above;
  float core = 1.0 - smoothstep(0.0, uSunSize * 0.9, ang);
  col = mix(col, uSunColor * 2.6 + vec3(0.42) + vec3(0.9) * core * core, disc * step(0.02, uSunGlow));
  // Moon: a full pale disc with a faint halo and a few darker seas.
  float mang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
  float mdisc = 1.0 - smoothstep(0.042, 0.048, mang);
  vec3 mcol = vec3(0.96, 0.95, 0.86) * (0.9 - 0.13 * smoothstep(0.3, 0.7, hash13(floor(d * 90.0))) * 0.6);
  col += vec3(0.5, 0.58, 0.85) * exp(-mang * 9.0) * 0.28 * uMoon * above;
  col = mix(col, mcol, mdisc * uMoon * above);
  // Stars: tiny twinkling points, fading toward the horizon.
  vec3 sp = d * 380.0;
  float r = hash13(floor(sp));
  float star = step(0.9986, r) * smoothstep(0.36, 0.0, length(fract(sp) - 0.5));
  float tw = 0.6 + 0.4 * sin(uTime * (1.4 + r * 6.0) + r * 40.0);
  col += vec3(1.0, 0.96, 0.9) * star * tw * uStars * smoothstep(0.03, 0.3, h) * 1.6;
  col += vec3(0.7, 0.78, 1.0) * uFlash * smoothstep(-0.1, 0.6, h) * 0.55;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CLOUD_VERT = `
varying vec3 vN;
varying vec3 vW;
varying float vShade;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vShade = color.r;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const CLOUD_FRAG = `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uHaze;
uniform vec3 uSunDir;
uniform float uSunAmt;
uniform float uFlash;
varying vec3 vN;
varying vec3 vW;
varying float vShade;
void main() {
  vec3 n = normalize(vN);
  float sunl = dot(n, uSunDir) * 0.5 + 0.5;
  float skyl = n.y * 0.5 + 0.5;
  float l = mix(skyl, sunl, 0.5 * uSunAmt) * 0.6 + vShade * 0.34 + 0.14;
  float band = smoothstep(0.34, 0.46, l) * 0.62 + smoothstep(0.58, 0.72, l) * 0.38;
  vec3 col = mix(uBottom, uTop, band);
  col += vec3(0.6, 0.66, 0.9) * uFlash * 0.7;
  float e = normalize(vW - cameraPosition).y;
  col = mix(col, uHaze, 0.7 * smoothstep(0.3, 0.0, e));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SEA_VERT = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const SEA_FRAG = `
uniform vec3 uNear;
uniform vec3 uDeep;
uniform vec3 uFog;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGlint;
uniform float uFogNear;
uniform float uFogFar;
uniform float uShore;
uniform float uTime;
uniform float uStorm;
varying vec3 vWorld;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float away = clamp((uShore - vWorld.x) / 110.0, 0.0, 1.0);
  vec3 col = mix(uNear, uDeep, pow(away, 0.6));
  vec2 p = vWorld.xz * 0.42;
  float gx = cos(p.x * 1.7 + uTime * 0.7) * 0.5 + cos(p.y * 2.3 - uTime * 0.55 + p.x * 0.6) * 0.5 + cos(p.x * 4.1 + p.y * 3.3 + uTime * 1.3) * 0.25;
  float gz = cos(p.y * 1.9 - uTime * 0.6) * 0.5 + cos(p.x * 2.7 + uTime * 0.5 - p.y * 0.7) * 0.5 + cos(p.y * 4.3 - p.x * 2.9 - uTime * 1.1) * 0.25;
  vec3 N = normalize(vec3(gx * 0.11, 1.0, gz * 0.11));
  vec3 R = reflect(-V, N);
  float glitter = pow(max(dot(R, normalize(uSunDir)), 0.0), 90.0);
  col += uSunColor * glitter * 2.6 * uGlint;
  col += uSunColor * pow(max(dot(R, normalize(uSunDir)), 0.0), 12.0) * 0.16 * uGlint;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col = mix(col, uFog, fres * 0.55);
  // Foam lines rolling toward the beach.
  float shore = uShore - vWorld.x;
  float lines = smoothstep(0.78, 1.0, sin(shore * 0.55 - uTime * 0.9 + gx * 0.4)) * smoothstep(34.0, 0.0, shore) * 0.55;
  float edge = smoothstep(2.5, 0.0, shore) * 0.85;
  col = mix(col, vec3(0.96, 0.98, 0.95), clamp(lines + edge, 0.0, 1.0) * (1.0 - uStorm * 0.4));
  float f = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const RAIN_VERT = `
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
attribute float aEnd;
varying float vAlpha;
void main() {
  vec3 s = position;
  float fall = fract(s.y - uTime * (0.85 + s.x * 0.35));
  vec3 p = uCenter + vec3((s.x - 0.5) * uBox.x, (fall - 0.5) * uBox.y + uBox.y * 0.5, (s.z - 0.5) * uBox.z);
  p.y += aEnd * 0.85;
  p.x += aEnd * 0.16;
  vAlpha = (0.25 + 0.75 * (1.0 - aEnd)) * smoothstep(0.0, 0.08, fall) * smoothstep(1.0, 0.9, fall);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = `
uniform float uAmount;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha * uAmount * 0.55);
}`;

function lightenedColor(c, f) {
  return c.clone().lerp(new THREE.Color(1, 1, 1), f);
}

// A fluffy cumulus: a row of flattened blobs with a flat base, shaded by height in the vertex colour.
function cloudGeometry(seed, size) {
  const rand = rngOf(seed),
    blobs = 5 + Math.floor(rand() * 4),
    length = 1.5 + rand() * 1.1,
    parts = [];
  for (let i = 0; i < blobs; i++) {
    const t = blobs === 1 ? 0.5 : i / (blobs - 1),
      mid = 1 - Math.abs(t - 0.5) * 2,
      r = (0.5 + 0.5 * mid) * (0.72 + rand() * 0.55) * size,
      g = new THREE.SphereGeometry(r, 11, 8);
    parts.push(
      placed(g, {
        at: [(t - 0.5) * length * size * 2.1, r * 0.42 + rand() * size * 0.22, (rand() - 0.5) * size * 0.9],
        scale: [1, 0.74, 0.96],
      }),
    );
    g.dispose();
  }
  const geo = mergeGeos(parts);
  const pos = geo.attributes.position,
    nrm = geo.attributes.normal;
  let top = 0;
  for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0.22 * size) {
      pos.setY(i, 0.22 * size);
      nrm.setXYZ(i, nrm.getX(i) * 0.3, -0.95, nrm.getZ(i) * 0.3);
    }
  }
  paint(geo, (x, y) =>
    new THREE.Color().setScalar(Math.max(0, Math.min(1, (y - 0.22 * size) / (top - 0.22 * size)))),
  );
  geo.computeBoundingSphere();
  return geo;
}

function hillGeometry(radius, seed, { height = [6, 18], width = 22, base = -3 } = {}) {
  const rand = rngOf(seed),
    segments = 140,
    phase = Array.from({ length: 6 }, () => rand() * TAU),
    position = [],
    color = [],
    index = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * TAU;
    let h =
      0.5 +
      0.22 * Math.sin(a * 3 + phase[0]) +
      0.16 * Math.sin(a * 7 + phase[1]) +
      0.1 * Math.sin(a * 13 + phase[2]) +
      0.06 * Math.sin(a * 23 + phase[3]);
    h = Math.max(0.05, Math.min(1, h));
    const top = base + height[0] + (height[1] - height[0]) * h,
      inner = radius,
      outer = radius + width;
    position.push(
      Math.cos(a) * inner,
      base,
      Math.sin(a) * inner,
      Math.cos(a) * outer,
      top,
      Math.sin(a) * outer,
    );
    color.push(0.62, 0.62, 0.62, 1, 1, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  g.setIndex(index);
  return g;
}

// A tall palm silhouette: a curved trunk and a fan of drooping fronds (one merged geometry).
function palmGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 5.2, 6, 1);
  parts.push(placed(trunk, { at: [0, 2.6, 0], rot: [0, 0, 0.1] }));
  trunk.dispose();
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.ConeGeometry(0.42, 3.2, 4, 1);
    frond.translate(0, 1.6, 0);
    parts.push(
      placed(frond, {
        at: [0.5, 5.15, 0],
        rot: [0, (i / 7) * TAU, 1.25 + (i % 2) * 0.16],
        scale: [1, 1, 0.34],
      }),
    );
    frond.dispose();
  }
  return mergeGeos(parts);
}

export class Sky {
  constructor(w, scenery = {}) {
    this.w = w;
    this.conf = { ...SCENERY.park, ...scenery };
    this.rand = rngOf(this.conf.seed);
    this.group = new THREE.Group();
    this.group.name = "sky";
    w.scene.add(this.group);
    this.time = 0;
    this.storm = 0;
    this.flash = 0;
    this.nextStrike = 4;
    this.night = 0;
    this.buildDome();
    this.buildHills();
    if (this.conf.sea) this.buildSea();
    this.buildClouds();
    this.buildBirds();
    this.buildBalloons();
    this.buildNightLife();
    this.buildRain();
    this.buildBolt();
  }

  // ---- build ---------------------------------------------------------------------------------------------
  buildDome() {
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBelow: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunSize: { value: 0.06 },
      uSunGlow: { value: 1 },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoon: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(DOME_RADIUS, 40, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: DOME_VERT,
        fragmentShader: DOME_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);
  }

  buildHills() {
    const rings = this.conf.hills,
      heights = [
        [7, 20],
        [10, 30],
        [14, 42],
      ];
    this.hills = rings.map((radius, i) => {
      const mesh = new THREE.Mesh(
        hillGeometry(radius, this.conf.seed * 11 + i * 7, {
          height: heights[i] || heights[2],
          width: 26 + i * 10,
        }),
        new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      );
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });
    // Palms standing on the nearest ridge.
    const count = this.conf.palms;
    if (count) {
      const geo = palmGeometry();
      this.palmMaterial = new THREE.MeshBasicMaterial({ color: 0x214a3a });
      const palms = new THREE.InstancedMesh(geo, this.palmMaterial, count),
        dummy = new THREE.Object3D(),
        rand = rngOf(this.conf.seed * 3);
      for (let i = 0; i < count; i++) {
        const a = rand() * TAU,
          r = this.conf.hills[0] + 8 + rand() * 18,
          s = 1.6 + rand() * 1.5;
        dummy.position.set(Math.cos(a) * r, -3 + 6 + rand() * 6, Math.sin(a) * r);
        dummy.rotation.set(0, rand() * TAU, (rand() - 0.5) * 0.18);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        palms.setMatrixAt(i, dummy.matrix);
      }
      palms.frustumCulled = false;
      this.group.add(palms);
    }
  }

  buildSea() {
    const c = this.conf;
    this.seaUniforms = {
      uNear: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uGlint: { value: 1 },
      uFogNear: { value: 55 },
      uFogFar: { value: 135 },
      uShore: { value: c.shoreX - 4 },
      uTime: { value: 0 },
      uStorm: { value: 0 },
    };
    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 760, 1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: this.seaUniforms,
        vertexShader: SEA_VERT,
        fragmentShader: SEA_FRAG,
      }),
    );
    this.sea.position.set(c.shoreX - 4 - 350, SEA_LEVEL, 0);
    this.group.add(this.sea);
    // A gentle ramp of sand from the lawn down into the water.
    this.beach = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: 0xf1d9a5, side: THREE.DoubleSide }),
    );
    const x0 = c.shoreX + 3.4,
      x1 = c.shoreX - 4;
    this.beach.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          x0,
          -1.94,
          -400,
          x0,
          -1.94,
          400,
          x1,
          SEA_LEVEL,
          400,
          x0,
          -1.94,
          -400,
          x1,
          SEA_LEVEL,
          400,
          x1,
          SEA_LEVEL,
          -400,
        ],
        3,
      ),
    );
    this.group.add(this.beach);
    this.buildLighthouse();
    this.buildBoats();
  }

  buildLighthouse() {
    const [x, z] = this.conf.lighthouse || [];
    if (x === undefined) return;
    const g = new THREE.Group();
    g.position.set(x, SEA_LEVEL, z);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(9, 0),
      new THREE.MeshBasicMaterial({ color: 0x5b6470 }),
    );
    rock.scale.set(1.3, 0.7, 1.1);
    rock.position.y = 0.5;
    g.add(rock);
    // Five hard-edged stripes, red and white, from the rock to the gallery.
    for (let i = 0; i < 5; i++) {
      const r0 = 3.1 - (i * 1.1) / 5,
        r1 = 3.1 - ((i + 1) * 1.1) / 5;
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(r1, r0, 4.4, 12),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xfff4e6 : 0xe0513f }),
      );
      stripe.position.y = 2.2 + i * 4.4 + 2;
      g.add(stripe);
    }
    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.7, 12),
      new THREE.MeshBasicMaterial({ color: 0x2b3a4a }),
    );
    gallery.position.y = 24.6;
    g.add(gallery);
    this.lampMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10), this.lampMaterial);
    lamp.position.y = 26.5;
    g.add(lamp);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 2.4, 10),
      new THREE.MeshBasicMaterial({ color: 0xe0513f }),
    );
    roof.position.y = 29;
    g.add(roof);
    // The beam: two crossed additive quads sweeping round.
    const glow = glowTexture(64);
    this.w.textures.push(glow);
    this.beam = new THREE.Group();
    this.beam.position.y = 26.5;
    const beamMat = new THREE.MeshBasicMaterial({
      map: glow,
      color: 0xfff1b8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const s of [1, -1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(90, 6), beamMat);
      b.position.x = s * 46;
      this.beam.add(b);
    }
    g.add(this.beam);
    this.beamMaterial = beamMat;
    g.traverse((o) => (o.frustumCulled = false));
    this.group.add(g);
    this.lighthouse = g;
  }

  buildBoats() {
    this.boats = [];
    const rand = rngOf(this.conf.seed * 5),
      hull = new THREE.MeshBasicMaterial({ color: 0xf6ead2 }),
      sails = [0xffffff, 0xf8d977, 0xee8864, 0xfff4e6];
    for (let i = 0; i < this.conf.boats; i++) {
      const g = new THREE.Group();
      const h = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.3), hull);
      g.add(h);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 5.2, 5),
        new THREE.MeshBasicMaterial({ color: 0x8a6a4a }),
      );
      mast.position.y = 3;
      g.add(mast);
      const sail = new THREE.Mesh(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0.1, 5.4, 0),
          new THREE.Vector3(0.1, 0.9, 0),
          new THREE.Vector3(2.3, 0.9, 0),
        ]),
        new THREE.MeshBasicMaterial({ color: sails[i % sails.length], side: THREE.DoubleSide }),
      );
      g.add(sail);
      g.userData = {
        x: -(this.conf.shoreX * -1 + 22 + rand() * 60),
        z: (rand() - 0.5) * 150,
        phase: rand() * TAU,
        speed: 0.5 + rand() * 0.6,
        heading: rand() * TAU,
      };
      this.group.add(g);
      this.boats.push(g);
    }
  }

  buildClouds() {
    const materialUniforms = {
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uHaze: { value: new THREE.Color() },
      uSunDir: this.uniforms.uSunDir,
      uSunAmt: { value: 1 },
      uFlash: this.uniforms.uFlash,
    };
    this.cloudUniforms = materialUniforms;
    const material = new THREE.ShaderMaterial({
      uniforms: materialUniforms,
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      vertexColors: true,
    });
    this.cloudMaterial = material;
    const shapes = [0, 1, 2, 3].map((i) => cloudGeometry(this.conf.seed * 13 + i * 29, 5.6));
    this.clouds = [];
    const rand = rngOf(this.conf.seed * 17),
      make = (extra) => {
        const mesh = new THREE.Mesh(shapes[Math.floor(rand() * shapes.length)], material);
        const elevation = (extra ? 10 + rand() * 26 : 6 + rand() * 32) * (Math.PI / 180),
          distance = 82 + rand() * 66,
          azimuth = rand() * TAU,
          range = distance * Math.cos(elevation);
        mesh.userData = {
          extra,
          x: Math.cos(azimuth) * range,
          z: Math.sin(azimuth) * range,
          y: Math.min(74, distance * Math.sin(elevation)),
          size: (extra ? 1.15 : 0.8) * (0.75 + rand() * 0.6) * (distance / 100 + 0.3),
          bob: rand() * TAU,
          speed: 0.7 + rand() * 0.7,
        };
        mesh.frustumCulled = false;
        mesh.rotation.y = rand() * 0.6 - 0.3;
        this.group.add(mesh);
        this.clouds.push(mesh);
      };
    for (let i = 0; i < 15; i++) make(false);
    for (let i = 0; i < 9; i++) make(true);
  }

  buildBirds() {
    this.birds = [];
    const rand = rngOf(this.conf.seed * 19);
    // A gull's wing: a broad inner panel, then a swept tip past the elbow.
    const wingGeo = new THREE.BufferGeometry().setFromPoints(
      [
        [0, 0, 0.3],
        [0.72, 0.24, 0.14],
        [0.7, 0.22, -0.24],
        [0, 0, 0.3],
        [0.7, 0.22, -0.24],
        [0, 0, -0.32],
        [0.72, 0.24, 0.14],
        [1.65, -0.06, -0.12],
        [0.7, 0.22, -0.24],
      ].map((p) => new THREE.Vector3(...p)),
    );
    this.birdMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const bodyGeo = new THREE.SphereGeometry(0.28, 8, 6);
    for (let i = 0; i < this.conf.birds; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, this.birdMaterial);
      body.scale.set(0.8, 0.7, 2.3);
      g.add(body);
      const wings = [1, -1].map((s) => {
        const pivot = new THREE.Group();
        const m = new THREE.Mesh(wingGeo, this.birdMaterial);
        m.scale.x = s;
        pivot.add(m);
        g.add(pivot);
        return pivot;
      });
      g.userData = {
        wings,
        radius: 22 + rand() * 46,
        alt: 9 + rand() * 22,
        angle: rand() * TAU,
        speed: (0.09 + rand() * 0.07) * (rand() < 0.5 ? 1 : -1),
        flap: 5 + rand() * 3,
        phase: rand() * TAU,
        flock: i % 3,
      };
      g.scale.setScalar(1.3);
      this.group.add(g);
      this.birds.push(g);
    }
  }

  buildBalloons() {
    this.balloons = [];
    const stripes = [0xe0513f, 0xfff4e6, 0xf4c849, 0x2f9aa0];
    for (let i = 0; i < this.conf.balloons; i++) {
      const g = new THREE.Group();
      const env = new THREE.SphereGeometry(4.2, 16, 12);
      env.scale(1, 1.2, 1);
      paint(
        env,
        (x, y, z) =>
          new THREE.Color(stripes[(Math.floor(((Math.atan2(z, x) + Math.PI) / TAU) * 12) + i) % 4]),
      );
      const bag = new THREE.Mesh(env, new THREE.MeshBasicMaterial({ vertexColors: true }));
      bag.position.y = 7.5;
      g.add(bag);
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(2.0, 1.1, 1.3, 12),
        new THREE.MeshBasicMaterial({ color: 0x8a5a3a }),
      );
      skirt.position.y = 1.9;
      g.add(skirt);
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.1, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xb98450 }),
      );
      basket.position.y = 0.3;
      g.add(basket);
      g.userData = {
        angle: (i * 2.4 + 0.15) % TAU,
        radius: 88 + i * 16,
        alt: 25 + i * 9,
        speed: 0.0042 + i * 0.0016,
        phase: i * 1.7,
      };
      g.scale.setScalar(1.35);
      g.traverse((o) => (o.frustumCulled = false));
      this.group.add(g);
      this.balloons.push(g);
    }
  }

  // Sky lanterns and fireflies for the evening.
  buildNightLife() {
    const glow = glowTexture(64);
    this.w.textures.push(glow);
    this.glowMap = glow;
    const rand = rngOf(this.conf.seed * 23);
    this.lanterns = [];
    const lanternGeo = new THREE.CylinderGeometry(0.42, 0.34, 0.75, 8);
    this.lanternMaterial = new THREE.MeshBasicMaterial({ color: 0xffc46a });
    this.lanternHalo = new THREE.SpriteMaterial({
      map: glow,
      color: 0xffa64a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < this.conf.lanterns; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(lanternGeo, this.lanternMaterial));
      const halo = new THREE.Sprite(this.lanternHalo);
      halo.scale.setScalar(3.4);
      g.add(halo);
      const range = 24 + rand() * 60,
        a = rand() * TAU;
      g.userData = {
        x: Math.cos(a) * range,
        z: Math.sin(a) * range,
        y: 3 + rand() * 46,
        rise: 0.5 + rand() * 0.7,
        sway: rand() * TAU,
      };
      g.frustumCulled = false;
      this.group.add(g);
      this.lanterns.push(g);
    }
    const n = this.conf.fireflies,
      positions = new Float32Array(n * 3),
      seeds = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU,
        r = 14 + rand() * 30;
      positions.set([Math.cos(a) * r, -1.2 + rand() * 3.4, Math.sin(a) * r], i * 3);
      seeds.push(rand() * TAU);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.fireflyMaterial = new THREE.PointsMaterial({
      map: glow,
      color: 0xd8ff7a,
      size: 0.75,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMaterial);
    this.fireflies.frustumCulled = false;
    this.fireflyBase = positions.slice();
    this.fireflySeeds = seeds;
    this.group.add(this.fireflies);
  }

  buildRain() {
    const n = 1100,
      position = new Float32Array(n * 2 * 3),
      end = new Float32Array(n * 2),
      rand = rngOf(77);
    for (let i = 0; i < n; i++) {
      const x = rand(),
        y = rand(),
        z = rand();
      position.set([x, y, z, x, y, z], i * 6);
      end[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    this.rainUniforms = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(30, 22, 30) },
      uAmount: { value: 0 },
      uColor: { value: new THREE.Color(0xcfe0f0) },
    };
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.rainUniforms,
        vertexShader: RAIN_VERT,
        fragmentShader: RAIN_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    // Rain is part of the venue's weather, not the horizon: the overview sees it too.
    this.w.scene.add(this.rain);
  }

  buildBolt() {
    this.boltPoints = new Float32Array(2 * 14 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.boltPoints, 3));
    this.boltMaterial = new THREE.LineBasicMaterial({
      color: 0xe9f0ff,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.bolt = new THREE.LineSegments(geo, this.boltMaterial);
    this.bolt.frustumCulled = false;
    this.group.add(this.bolt);
  }

  // A jagged bolt from the clouds to the ground at a random bearing in the distance.
  strike(rand = Math.random) {
    const a = rand() * TAU,
      r = 70 + rand() * 60;
    let x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      y = 58 + rand() * 12;
    const steps = 14,
      p = this.boltPoints;
    let k = 0;
    for (let i = 0; i < steps; i++) {
      const nx = x + (rand() - 0.5) * 9,
        nz = z + (rand() - 0.5) * 9,
        ny = y - (60 / steps) * (0.7 + rand() * 0.6);
      p.set([x, y, z, nx, ny, nz], k);
      k += 6;
      x = nx;
      z = nz;
      y = ny;
    }
    this.bolt.geometry.attributes.position.needsUpdate = true;
    this.flash = 1;
    this.boltLife = 0.22;
    this.struck = true;
  }

  // True once per lightning strike, so the app can play the thunder.
  consumeStrike() {
    const struck = !!this.struck;
    this.struck = false;
    return struck;
  }

  // ---- per frame -----------------------------------------------------------------------------------------
  setVisible(on) {
    this.group.visible = on;
  }
  // `look` is a daylight look; `storm` (0..1) drives weather; `focus` is where the rain falls in the overview.
  update(time, dt, look, { camera, coach = true, storm = 0, focus, reduced = false } = {}) {
    this.time = time;
    this.storm = storm;
    const d = look.dome,
      u = this.uniforms;
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (storm > 0.5 && !reduced) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strike();
        this.nextStrike = 4 + Math.random() * 6;
      }
    }
    const boltAlpha = this.boltLife > 0 ? Math.min(1, this.boltLife * 8) * (0.6 + 0.4 * Math.random()) : 0;
    this.boltLife = Math.max(0, (this.boltLife || 0) - dt);
    this.boltMaterial.opacity = boltAlpha;
    this.bolt.visible = boltAlpha > 0;
    // Rain follows the view: around the coach's eyes, or over the deck in the overview.
    const rain = this.rainUniforms;
    rain.uAmount.value = Math.max(0, (storm - 0.28) / 0.72);
    this.rain.visible = rain.uAmount.value > 0.01;
    if (this.rain.visible) {
      rain.uTime.value = time * 0.55;
      if (coach && camera) {
        rain.uCenter.value.set(camera.position.x, camera.position.y - 6, camera.position.z);
        rain.uBox.value.set(34, 22, 34);
      } else {
        rain.uCenter.value.set(-1, -1, 0);
        rain.uBox.value.set(46, 30, 46);
      }
    }
    if (!this.group.visible) return;
    if (camera) this.dome.position.copy(camera.position);
    u.uZenith.value.copy(d.zenith);
    u.uMid.value.copy(d.mid);
    u.uHorizon.value.copy(d.fog);
    u.uBelow.value.copy(d.fog);
    u.uSunDir.value.copy(d.sunDir);
    u.uSunColor.value.copy(d.sunColor);
    u.uSunSize.value = d.sunSize;
    u.uSunGlow.value = d.sunGlow;
    u.uMoonDir.value.copy(d.moonDir);
    u.uMoon.value = d.moon;
    u.uStars.value = d.stars;
    u.uTime.value = time;
    u.uFlash.value = this.flash * 0.9;
    this.night = Math.max(0, Math.min(1, (look.glow - 0.3) / 0.7));
    // Clouds: colours, drift and the storm's extra weather.
    const cu = this.cloudUniforms;
    cu.uTop.value.copy(d.cloudTop);
    cu.uBottom.value.copy(d.cloudBottom);
    cu.uHaze.value.copy(d.fog);
    cu.uSunAmt.value = d.sunGlow > 0.05 ? 1 : 0;
    const wind = reduced ? 0 : 1.7;
    for (const c of this.clouds) {
      const s = c.userData;
      if (!reduced) {
        s.x += wind * s.speed * dt;
        s.z += wind * 0.55 * s.speed * dt;
      }
      // Wrap around a big square, shrinking to nothing near the far edge so no cloud ever pops.
      if (s.x > 175) s.x -= 350;
      if (s.z > 175) s.z -= 350;
      const edge = Math.max(Math.abs(s.x), Math.abs(s.z)),
        fade = Math.max(0, Math.min(1, (176 - edge) / 26)),
        weather = s.extra ? storm : 1,
        grow = 1 + storm * 0.45 * (s.extra ? 0.4 : 1);
      c.visible = weather > 0.02 && fade > 0.02;
      c.scale.setScalar(s.size * fade * weather * grow);
      c.position.set(s.x, s.y * (1 - storm * 0.28) + Math.sin(time * 0.05 + s.bob) * 1.4, s.z);
    }
    this.animateBirds(time, look, storm);
    this.animateBalloons(time, d);
    this.animateSea(time, look, storm);
    this.animateNight(time, look);
    // Hills tint with the hour.
    for (let i = 0; i < this.hills.length; i++)
      this.hills[i].material.color.copy(d.hills[Math.min(i, d.hills.length - 1)]);
    this.palmMaterial?.color.copy(d.hills[0]).multiplyScalar(0.55);
  }

  animateBirds(time, look, storm) {
    const dark = look.dome.sunGlow > 0.6 || look.glow > 0.3,
      night = this.night;
    this.birdMaterial.color.set(dark ? 0x3a3f5c : 0xffffff);
    const show = storm < 0.5 && night < 0.85;
    for (const b of this.birds) {
      b.visible = show;
      if (!show) continue;
      const u = b.userData,
        a = u.angle + time * u.speed;
      const x = Math.cos(a) * u.radius,
        z = Math.sin(a) * u.radius,
        y = u.alt + Math.sin(time * 0.7 + u.phase) * 1.6;
      b.position.set(x, y, z);
      b.rotation.y = -a + (u.speed > 0 ? 0 : Math.PI);
      b.rotation.z = (u.speed > 0 ? -1 : 1) * 0.28;
      const flap = Math.sin(time * u.flap + u.phase) * (0.45 + 0.15 * Math.sin(time * 0.4 + u.phase));
      u.wings[0].rotation.z = flap;
      u.wings[1].rotation.z = -flap;
    }
  }

  animateBalloons(time, d) {
    for (const g of this.balloons) {
      const u = g.userData,
        a = u.angle + time * u.speed;
      g.position.set(
        Math.cos(a) * u.radius,
        u.alt + Math.sin(time * 0.15 + u.phase) * 2.2,
        Math.sin(a) * u.radius,
      );
      g.rotation.y = time * 0.05 + u.phase;
      g.visible = this.storm < 0.4;
    }
  }

  animateSea(time, look, storm) {
    if (!this.sea) return;
    const s = this.seaUniforms,
      d = look.dome;
    s.uNear.value.copy(d.sea[0]);
    s.uDeep.value.copy(d.sea[1]);
    s.uFog.value.copy(d.fog);
    s.uFogNear.value = look.fog[1];
    s.uFogFar.value = look.fog[2];
    s.uTime.value = time;
    s.uStorm.value = storm;
    // The glitter road runs under the sun, and after dark under the moon.
    const sunUp = d.sunDir.y > -0.04;
    s.uSunDir.value.copy(sunUp ? d.sunDir : d.moonDir);
    s.uSunColor.value.copy(sunUp ? d.sunColor : new THREE.Color(0xdfe8ff));
    s.uGlint.value = (sunUp ? Math.max(0.15, d.sunGlow) : d.moon * 0.5) * (1 - storm);
    for (const b of this.boats) {
      const u = b.userData;
      b.position.set(
        u.x + Math.sin(time * 0.05 * u.speed + u.phase) * 6,
        SEA_LEVEL + 0.3 + Math.sin(time * 1.1 + u.phase) * 0.18,
        u.z + time * 0.02 * u.speed,
      );
      b.rotation.set(Math.sin(time * 0.9 + u.phase) * 0.06, u.heading, Math.cos(time * 0.8 + u.phase) * 0.05);
    }
    if (this.lighthouse) {
      const lit = Math.max(0, Math.min(1, (look.glow - 0.15) / 0.5));
      this.lampMaterial.color.set(lit > 0.1 ? 0xfff1b8 : 0xd8d2b8);
      this.beamMaterial.opacity = lit * 0.75;
      this.beam.rotation.y = time * 0.9;
    }
  }

  animateNight(time, look) {
    const night = this.night;
    const lit = night > 0.05 && this.storm < 0.7;
    this.lanternHalo.opacity = lit ? 0.55 * night : 0;
    this.lanternMaterial.color.set(lit ? 0xffc46a : 0x3a3548);
    for (const g of this.lanterns) {
      const u = g.userData;
      g.visible = lit;
      if (!lit) continue;
      const y = ((u.y + time * u.rise) % 52) + 2;
      g.position.set(u.x + Math.sin(time * 0.3 + u.sway) * 2.5, y, u.z + Math.cos(time * 0.27 + u.sway) * 2);
    }
    this.fireflyMaterial.opacity = lit ? 0.9 * night : 0;
    this.fireflies.visible = lit;
    if (lit) {
      const p = this.fireflies.geometry.attributes.position,
        base = this.fireflyBase;
      for (let i = 0; i < this.fireflySeeds.length; i++) {
        const s = this.fireflySeeds[i];
        p.setXYZ(
          i,
          base[i * 3] + Math.sin(time * 0.4 + s) * 2.2,
          base[i * 3 + 1] + Math.sin(time * 0.9 + s * 2) * 0.7,
          base[i * 3 + 2] + Math.cos(time * 0.35 + s) * 2.2,
        );
      }
      p.needsUpdate = true;
      this.fireflyMaterial.size = 0.7 + 0.15 * Math.sin(time * 2.1);
    }
  }
}

export { skyDirection, lightenedColor };
