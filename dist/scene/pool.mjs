// Shared basin builder: mosaic basin with animated caustics, coping, lane ropes, starting blocks, pennants,
// ladders, the water surface and lane pick volumes. Every dimension derives from the venue's lane count.
import { THREE, COLORS } from "./kit.mjs";
import { mosaicTexture, tileTextures, paverTextures, plasterTexture } from "./textures.mjs";

const CAUSTIC_GLSL = `
float causticLayer(vec2 p, float t) {
  float a = sin(p.x * 2.1 + sin(p.y * 1.3 + t * 0.8) * 1.4 + t * 0.6);
  float b = sin(p.y * 2.3 + sin(p.x * 1.7 - t * 0.7) * 1.3 - t * 0.5);
  return pow(max(0.0, 1.0 - abs(a + b) * 0.85), 6.0);
}
float caustic(vec2 p, float t) {
  return causticLayer(p * 1.25, t) * 0.75 + causticLayer(p * 2.2 + 3.1, t * 1.25) * 0.45;
}`;

// Adds animated underwater caustics to a lit material without losing shadows or lighting.
export function withCaustics(material, uniforms, strength = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCaustic = uniforms.uCaustic;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCausticPos;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvCausticPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vCausticPos;\nuniform float uTime;\nuniform float uCaustic;\n" +
          CAUSTIC_GLSL,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.55, 0.95, 0.95) * caustic(vCausticPos.xz, uTime) * uCaustic * ${strength.toFixed(2)};`,
      );
  };
  material.customProgramCacheKey = () => "caustics" + strength;
  return material;
}

const WATER_VERTEX = `
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  p.y += sin(p.x * 2.6 + uTime) * cos(p.z * 2.1 + uTime * 0.7) * 0.022 + sin(p.x * 0.8 - p.z * 1.2 + uTime * 1.3) * 0.012;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const WATER_FRAGMENT =
  CAUSTIC_GLSL +
  `
uniform float uTime;
uniform float uDirty;
uniform float uBrown;
uniform float uLight;
uniform float uHalfX;
uniform float uHalfZ;
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  // Analytic ripple normal from two travelling wave trains.
  float gx = cos(p.x * 2.6 + t) * cos(p.y * 2.1 + t * 0.7) * 0.057 + cos(p.x * 0.8 - p.y * 1.2 + t * 1.3) * 0.0096
    + cos(p.x * 5.1 + p.y * 1.7 - t * 1.9) * 0.018;
  float gz = -sin(p.x * 2.6 + t) * sin(p.y * 2.1 + t * 0.7) * 0.046 - cos(p.x * 0.8 - p.y * 1.2 + t * 1.3) * 0.0144
    + cos(p.y * 4.7 - p.x * 1.3 + t * 1.6) * 0.017;
  vec3 N = normalize(vec3(-gx * 5.0, 1.0, -gz * 5.0));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float edge = min(uHalfX - abs(p.x), uHalfZ - abs(p.y));
  float deep = smoothstep(0.1, 2.8, edge);
  vec3 color = mix(uShallow, uDeep, deep);
  color = mix(color, vec3(0.40, 0.61, 0.24), uDirty);
  color = mix(color, vec3(0.38, 0.20, 0.07), uBrown * 0.88);
  vec3 H = normalize(normalize(uSun) + V);
  float glint = pow(max(dot(N, H), 0.0), 220.0) * 1.6;
  float sparkle = pow(max(0.0, sin(p.x * 3.3 + t * 1.1) * sin(p.y * 2.9 - t * 0.9)), 18.0) * 0.18;
  float lines = caustic(p * 0.9, t * 0.8);
  color += vec3(0.8, 1.0, 0.98) * lines * 0.16 * (1.0 - uBrown * 0.8) * uLight;
  color += vec3(1.0, 0.96, 0.86) * (glint + sparkle) * (1.0 - uBrown) * uLight;
  color = mix(color, vec3(0.7, 0.93, 0.95) * uLight, fres * 0.22);
  float wall = 1.0 - smoothstep(0.0, 0.22, edge);
  color += vec3(0.75, 1.0, 1.0) * wall * 0.06 * uLight;
  color *= mix(0.22, 1.0, uLight);
  gl_FragColor = vec4(color, 0.5 + fres * 0.2 + uDirty * 0.22 + uBrown * 0.2 + wall * 0.08);
}`;

export function buildPool(w, venue, { shallow = [0.2, 0.8, 0.84], deep = [0.09, 0.69, 0.79] } = {}) {
  const lanes = venue.lanes,
    P = venue.pool,
    halfX = P.halfX,
    halfZ = P.halfZ,
    width = halfX * 2;
  w.poolUniforms = { uTime: { value: 0 }, uCaustic: { value: 1 } };
  // Basin floor and walls in a caustic-lit mosaic.
  const floorTex = mosaicTexture({ seed: 3, base: "#5cc2cb", grout: "#bfe9e6" });
  floorTex.repeat.set(width / 2, (halfZ * 2) / 2);
  w.textures.push(floorTex);
  const floorMat = withCaustics(
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, roughness: 0.55, envMapIntensity: 0.4 }),
    w.poolUniforms,
    1.7,
  );
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, 0.15, halfZ * 2 + 0.4), floorMat);
  floor.position.set(0, -1.42, 0);
  floor.receiveShadow = true;
  w.scene.add(floor);
  const wallTex = mosaicTexture({ seed: 17, base: "#72cdd2", grout: "#cdeeea" });
  wallTex.repeat.set(4, 0.6);
  w.textures.push(wallTex);
  const wallMat = withCaustics(
    new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.5, envMapIntensity: 0.4 }),
    w.poolUniforms,
    0.8,
  );
  for (const x of [-halfX, halfX]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, halfZ * 2 + 0.4), wallMat);
    m.position.set(x, -0.85, 0);
    m.receiveShadow = true;
    w.scene.add(m);
  }
  for (const z of [-halfZ, halfZ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 1.2, 0.16), wallMat);
    m.position.set(0, -0.85, z);
    m.receiveShadow = true;
    w.scene.add(m);
  }
  // Classic dark waterline band just under the coping.
  const band = w.mat(0x2d7f8c, { roughness: 0.35 });
  for (const x of [-halfX + 0.11, halfX - 0.11]) w.box(0.03, 0.16, halfZ * 2, band, x, -0.36, 0, 0);
  for (const z of [-halfZ + 0.09, halfZ - 0.09]) w.box(width - 0.2, 0.16, 0.03, band, 0, -0.36, z, 0);
  // Regulation lane lines, T ends and wall targets.
  for (const x of lanes) {
    w.box(0.15, 0.016, 13.8, COLORS.navy, x, -1.33, 0, 0);
    for (const z of [-6.9, 6.9]) w.box(1.65, 0.019, 0.18, COLORS.navy, x, -1.325, z, 0);
    for (const z of [-halfZ + 0.12, halfZ - 0.12]) {
      w.box(0.16, 0.72, 0.03, COLORS.navy, x, -0.91, z, 0);
      w.box(1.15, 0.16, 0.032, COLORS.navy, x, -0.74, z, 0);
    }
  }
  // Rounded stone coping and drainage channels.
  const stone = plasterTexture({ seed: 31, strength: 0.12 });
  stone.repeat.set(3, 3);
  w.textures.push(stone);
  const coping = w.mat(0xdcc394, { map: stone, roughness: 0.62 });
  for (const x of [-halfX - 0.2, halfX + 0.2]) {
    w.box(0.35, 0.18, halfZ * 2 + 0.9, coping, x, 0.02, 0, 0.05);
    const gutter = x + (x > 0 ? 0.38 : -0.38);
    w.box(0.2, 0.025, halfZ * 2 + 0.7, 0x5f7f7f, gutter, -0.001, 0, 0.01);
    for (let z = -halfZ - 0.1; z < halfZ + 0.2; z += 0.24)
      w.box(0.2, 0.035, 0.06, 0xd3ded1, gutter, 0.008, z, 0.008);
  }
  for (const z of [-halfZ - 0.3, halfZ + 0.3]) w.box(width + 0.7, 0.18, 0.38, coping, 0, 0.02, z, 0.05);
  // Water surface.
  const waterGeo = new THREE.PlaneGeometry(width - 0.1, halfZ * 2 - 0.1, Math.round(width * 3.6), 58);
  waterGeo.rotateX(-Math.PI / 2);
  w.water = new THREE.Mesh(
    waterGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDirty: { value: 0 },
        uBrown: { value: 0 },
        uLight: { value: 1 },
        uHalfX: { value: halfX },
        uHalfZ: { value: halfZ },
        uSun: { value: new THREE.Vector3(-0.35, 0.9, 0.3) },
        uShallow: { value: new THREE.Vector3(...shallow) },
        uDeep: { value: new THREE.Vector3(...deep) },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    }),
  );
  w.water.position.y = -0.25;
  w.water.renderOrder = 2;
  w.scene.add(w.water);
  // Invisible lane volumes for click assignment.
  lanes.forEach((x, i) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(3.18, 0.2, 16.5),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    m.position.set(x, -0.12, 0);
    m.userData = { kind: "lane", lane: i };
    w.scene.add(m);
    w.clickables.push(m);
  });
  // Lane ropes: blue and cream mid-pool, red within the turn zones.
  const floatGeo = new THREE.SphereGeometry(0.115, 8, 6);
  const count = 72;
  for (let j = 0; j <= lanes.length; j++) {
    const x = -halfX + 0.2 + j * 3.2;
    w.rod([x, -0.19, -halfZ], [x, -0.19, halfZ], 0.022, 0xd4e5d2);
    const buckets = [[], [], []];
    for (let k = 0; k < count; k++) {
      const z = -8.08 + k * (16.16 / (count - 1));
      buckets[Math.abs(z) > 5.8 ? 2 : k % 2].push(z);
    }
    buckets.forEach((arr, k) => {
      const mesh = new THREE.InstancedMesh(
        floatGeo,
        w.mat(k === 2 ? 0xed7556 : k === 0 ? 0xffe3a2 : 0x3593c1, { roughness: 0.4 }),
        arr.length,
      );
      const dummy = new THREE.Object3D();
      arr.forEach((z, n) => {
        dummy.position.set(x, -0.19, z);
        dummy.scale.set(1, 0.85, 1.25);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
      });
      mesh.castShadow = true;
      w.scene.add(mesh);
    });
  }
  // Starting blocks with tilted tops, grips and visible lane numbers.
  lanes.forEach((x, i) => {
    w.box(0.65, 0.85, 0.75, 0xd1ded3, x, 0.48, -9.15, 0.07);
    const top = w.box(1.18, 0.19, 1.1, w.mat(COLORS.blue, { roughness: 0.45 }), x, 0.97, -9.13, 0.08);
    top.rotation.x = 0.12;
    w.box(0.18, 0.11, 0.88, 0xebc14e, x + 0.45, 1.09, -9.1, 0.02);
    w.rod([x - 0.38, 0.6, -8.85], [x + 0.38, 0.6, -8.85], 0.055, 0xdde8e0);
    const number = w.textPlane(
      String(i + 1),
      0.35,
      0.36,
      "#d1ded3",
      "#174958",
      x - 0.336,
      0.53,
      -9.15,
      w.scene,
      100,
    );
    number.rotation.y = -Math.PI / 2;
    const label = w.textPlane("0" + (i + 1), 1.2, 0.75, "#e8eee3", "#267682", x, 0.018, -10.75, w.scene, 100);
    label.rotation.x = -Math.PI / 2;
    label.rotation.z = -Math.PI / 2;
  });
  // Backstroke pennants strung across the lanes near both ends.
  const postX = halfX + 1;
  for (const z of [-5.7, 5.7]) {
    for (const x of [-postX, postX]) {
      w.cyl(0.09, 0.13, 3.35, 0xf2f1dd, x, 1.68, z);
      w.cyl(0.25, 0.3, 0.1, COLORS.navy, x, 0.07, z);
      w.ball(0.14, COLORS.yellow, x, 3.4, z);
    }
    const sag = (x) => 3.32 - 0.3 * (1 - (x / postX) ** 2);
    const points = [];
    for (let k = 0; k <= 30; k++) {
      const x = -postX + (k * postX * 2) / 30;
      points.push(new THREE.Vector3(x, sag(x), z));
    }
    w.scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x275663 }),
      ),
    );
    const flags = Math.round((postX * 2 - 1.2) / 0.77);
    for (let k = 0; k < flags; k++) {
      const x = -postX + 0.6 + k * 0.77,
        y = sag(x);
      const shape = new THREE.Shape();
      shape.moveTo(-0.29, 0);
      shape.lineTo(0.29, 0);
      shape.lineTo(0, -0.58);
      shape.closePath();
      const f = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({
          color: k % 3 === 0 ? COLORS.coral : k % 3 === 1 ? COLORS.cream : COLORS.teal,
          side: THREE.DoubleSide,
          roughness: 0.9,
        }),
      );
      f.position.set(x, y, z);
      f.rotation.y = Math.PI / 2 + 0.14;
      w.scene.add(f);
      w.flags.push(f);
    }
  }
  // Pool ladders with rails and submerged rungs.
  for (const [x, z] of [
    [-halfX, 5],
    [halfX, -4.1],
  ]) {
    const out = x < 0 ? -1 : 1;
    for (const zz of [z - 0.45, z + 0.45]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -0.95, zz),
        new THREE.Vector3(x, 0.4, zz),
        new THREE.Vector3(x + out * 0.45, 0.8, zz),
        new THREE.Vector3(x + out * 0.7, 0.3, zz),
        new THREE.Vector3(x + out * 0.7, 0.03, zz),
      ]);
      w.mesh(
        new THREE.TubeGeometry(curve, 16, 0.047, 7, false),
        w.mat(0xe4e9dc, { roughness: 0.25, metalness: 0.35 }),
      );
    }
    for (const y of [-0.85, -0.45, -0.1]) w.rod([x, y, z - 0.45], [x, y, z + 0.45], 0.055, 0xe7e9d8);
  }
}

// Deck slab around the basin with a single world-UV textured top surface (pool cut out).
export function buildDeck(
  w,
  venue,
  { base, grout, pavers = false, slab = 0x398d94, rim = 0xb28363, side = COLORS.tile },
) {
  const room = venue.room,
    P = venue.pool,
    halfX = P.halfX,
    halfZ = P.halfZ;
  const cx = (room.minX + room.maxX) / 2,
    cz = (room.minZ + room.maxZ) / 2,
    rw = room.maxX - room.minX,
    rd = room.maxZ - room.minZ;
  // Tabletop foundation.
  w.box(rw + 0.6, 1.25, rd, slab, cx, -1.25, cz, 0.45);
  w.box(rw + 0.5, 0.21, rd - 0.1, rim, cx, -0.59, cz, 0.2);
  // Solid slabs with tile-coloured sides.
  w.box(-halfX - room.minX, 0.45, rd, side, (room.minX - halfX) / 2, -0.25, cz, 0.14);
  w.box(room.maxX - halfX, 0.45, rd, side, (room.maxX + halfX) / 2, -0.25, cz, 0.14);
  w.box(halfX * 2 + 0.1, 0.45, room.maxZ - halfZ, side, 0, -0.25, (room.maxZ + halfZ) / 2, 0.09);
  w.box(halfX * 2 + 0.1, 0.45, -halfZ - room.minZ, side, 0, -0.25, (room.minZ - halfZ) / 2, 0.09);
  // Textured top: a shape with the basin as a hole, UVs in world units.
  const tex = pavers ? paverTextures({ base, grout }) : tileTextures({ base, grout, seed: 7 });
  const scale = 1 / 4;
  for (const t of [tex.map, tex.bump]) {
    t.repeat.set(scale, scale);
    w.textures.push(t);
  }
  // Shape Y holds -worldZ so rotating by -90° about X yields an upward-facing surface at world (x, z).
  const shape = new THREE.Shape();
  shape.moveTo(room.minX, -room.maxZ);
  shape.lineTo(room.maxX, -room.maxZ);
  shape.lineTo(room.maxX, -room.minZ);
  shape.lineTo(room.minX, -room.minZ);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-halfX, -halfZ);
  hole.lineTo(-halfX, halfZ);
  hole.lineTo(halfX, halfZ);
  hole.lineTo(halfX, -halfZ);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const top = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 1.4,
      roughness: 0.74,
      color: 0xffffff,
    }),
  );
  top.position.y = -0.018;
  top.receiveShadow = true;
  w.scene.add(top);
  w.deckTop = top;
  return top;
}
