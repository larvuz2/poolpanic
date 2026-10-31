// The crowd made of real characters (31 October 2026, the creator: "the people on the benches need to be proxies for models … with
// very, very low triangles … all made from Meshy … generate five generic ones and then change some accessories and the color of the
// shirt … always optimized for performance"). Five Meshy spectators (a dad in a bucket hat, a mum with sunglasses on her head, a
// grandpa in a flat cap and braces, a teenager in a backwards cap, a super-fan in face paint and a bobble hat), rigged on Coach
// Waters' skeleton and baked in two still poses each, sitting and cheering, 700 triangles a pose (tools/blender/crowd_bake.py):
// dist/assets/crowd/. One atlas for all five, its alpha the white t-shirt, so every person's shirt takes its own colour; some
// wave a little flag, a few a foam finger. Drawn instanced: two meshes a spectator (one per pose) and the flags and fingers, a dozen
// draw calls for the whole hall. The same interface as the classic Crowd (scene/crowd.mjs): `update(time, cheer)`, `meshes`.
// It loads behind the menu (`loadCrowdModels`, app.mjs); until it has, and with ?nomodels, the classic crowd sits in the stands.
import { THREE } from "./kit.mjs";
import { rngOf } from "./geom.mjs";

const BASE = new URL("../assets/crowd/", import.meta.url).href;
let ready = null,
  loading = null;
export const crowdModelsReady = () => !!ready;
// (for the checks, which parse the model themselves: { scene, info, texture, mask })
export function primeCrowdModels(model) {
  ready = model ? prepare(model) : null;
}
export function loadCrowdModels(base = BASE) {
  if (ready) return Promise.resolve(ready);
  loading ||= (async () => {
    const { GLTFLoader } = await import("../assets/GLTFLoader.js");
    const loader = new THREE.TextureLoader();
    const [info, gltf, texture, mask] = await Promise.all([
      fetch(base + "crowd.json").then((r) => r.json()),
      new GLTFLoader().loadAsync(base + "crowd.glb"),
      loader.loadAsync(base + "crowd.webp"),
      loader.loadAsync(base + "crowd_mask.webp"),
    ]);
    texture.flipY = mask.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    ready = prepare({ scene: gltf.scene, info, texture, mask });
    return ready;
  })().catch((error) => {
    console.warn("The crowd's models did not load; the classic crowd stays.", error);
    loading = null;
    return null;
  });
  return loading;
}

// The packed file's positions are quantized (gltfpack): plain floats again before they are moved, for a few thousand vertices.
function floats(geometry) {
  const g = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const a = geometry.getAttribute(name);
    if (!a) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (geometry.index) g.setIndex(geometry.index.clone());
  return g;
}

function prepare({ scene, info, texture, mask }) {
  const geo = {};
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    // (the packed file names the node, the mesh under it is mesh_N)
    const name = /_(sit|cheer)$/.test(o.name) ? o.name : o.parent?.name;
    const g = floats(o.geometry);
    g.applyMatrix4(o.matrixWorld);
    geo[name] = g;
  });
  const people = info.people.filter((p) => geo[p.name + "_sit"] && geo[p.name + "_cheer"]);
  return { info, people, geo, texture, mask };
}

// The shirts' colours: club colours, mostly, and the odd fan who did not get the memo.
const SHIRTS = [
  0x1f5fd1, 0xe03a3a, 0xf4f8fb, 0x10284a, 0xe9b949, 0x2fb6e8, 0x2fae7a, 0xff8a3a, 0xb782db, 0x1f5fd1,
  0xe03a3a,
];
const FLAGS = [0x1f5fd1, 0xe03a3a, 0xe9b949, 0x10284a, 0x2fae7a];

// One material for every spectator: the atlas, the shirt (where the mask says) multiplied by the person's colour.
function crowdMaterial(texture, mask) {
  const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.shirtMask = { value: mask };
    shader.fragmentShader = "uniform sampler2D shirtMask;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "").replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
  vec4 crowdTexel = texture2D( map, vMapUv );
  #ifdef USE_COLOR
    diffuseColor.rgb *= mix( crowdTexel.rgb, crowdTexel.rgb * vColor * 1.15, texture2D( shirtMask, vMapUv ).r );
  #else
    diffuseColor.rgb *= crowdTexel.rgb;
  #endif
#endif`,
    );
  };
  m.customProgramCacheKey = () => "crowd-shirts";
  return m;
}

// A little flag on a stick (its pole in the hand) and a foam finger, made here: a few triangles each.
function flagGeometry() {
  const pole = new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4).translate(0, 0.2, 0);
  const cloth = new THREE.PlaneGeometry(0.26, 0.17).translate(0.13, 0.36, 0);
  return [pole, cloth];
}
function fingerGeometry() {
  const hand = new THREE.BoxGeometry(0.16, 0.14, 0.06).translate(0, 0.06, 0);
  const finger = new THREE.BoxGeometry(0.05, 0.22, 0.05).translate(0.02, 0.24, 0);
  return [hand, finger];
}
function merged(parts) {
  // (two simple pieces: positions and normals only, indexed)
  const pos = [],
    nor = [],
    idx = [];
  let base = 0;
  for (const p of parts) {
    const g = p;
    const P = g.attributes.position,
      N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
    }
    const I = g.index;
    for (let i = 0; i < I.count; i++) idx.push(base + I.getX(i));
    base += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const FORWARD = 0.37; // metres from the classic crowd's spot to where the feet go, sitting on the seat (scene/aquatic.mjs stands)

export class ModelCrowd {
  // `seats` are { x, y, z, ry } (y is where the feet are, ry the way they face), as for the classic Crowd.
  constructor(w, parent, seats, { seed = 1, scale = 1, waveAxis = "z" } = {}) {
    const M = ready;
    this.seats = seats;
    this.waveAxis = waveAxis;
    const rand = rngOf(seed + 101),
      material = crowdMaterial(M.texture, M.mask),
      kinds = M.people.length;
    const counts = new Array(kinds).fill(0);
    this.people = seats.map(() => {
      const kind = Math.floor(rand() * kinds);
      const prop = rand();
      return {
        kind,
        slot: counts[kind]++,
        shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)],
        phase: rand() * 6.28,
        size: (0.93 + rand() * 0.12) * scale,
        turn: (rand() - 0.5) * 0.5,
        eager: 0.4 + rand() * 0.6,
        holds: prop < 0.3 ? "flag" : prop < 0.4 ? "finger" : null,
        flag: FLAGS[Math.floor(rand() * FLAGS.length)],
        pose: -1,
      };
    });
    const color = new THREE.Color();
    this.meshes = [];
    this.bodies = M.people.map((p, k) => {
      const make = (pose) => {
        const m = new THREE.InstancedMesh(M.geo[p.name + "_" + pose], material, Math.max(1, counts[k]));
        m.count = counts[k];
        m.name = "crowd-" + p.name + "-" + pose;
        this.meshes.push(m);
        return m;
      };
      return { sit: make("sit"), cheer: make("cheer"), hand: p.handR };
    });
    for (const [i, p] of this.people.entries()) {
      const b = this.bodies[p.kind];
      for (const pose of ["sit", "cheer"]) b[pose].setColorAt(p.slot, color.set(p.shirt));
      void i;
    }
    // what they hold: a flag in the club's colours, a foam finger
    const holders = (what) => this.people.filter((p) => p.holds === what);
    this.held = [];
    for (const [what, parts, colorOf] of [
      ["flag", flagGeometry(), (p) => p.flag],
      ["finger", fingerGeometry(), () => 0xff7a1a],
    ]) {
      const who = holders(what);
      if (!who.length) continue;
      const mesh = new THREE.InstancedMesh(
        merged(parts),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }),
        who.length,
      );
      mesh.name = "crowd-" + what;
      who.forEach((p, j) => {
        p.heldSlot = j;
        p.heldMesh = mesh;
        mesh.setColorAt(j, color.set(colorOf(p)));
      });
      this.meshes.push(mesh);
      this.held.push(mesh);
    }
    for (const m of this.meshes) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parent.add(m);
    }
    this.dummy = new THREE.Object3D();
    this.hand = new THREE.Vector3();
    this.update(0, 0);
  }

  // `cheer` (0..1) is how excited the hall is: 0 sits and sways, 1 is up with a wave rolling through the seats.
  update(time, cheer = 0) {
    const d = this.dummy,
      wavePos = time * 2.2;
    this.seats.forEach((s, i) => {
      const p = this.people[i],
        b = this.bodies[p.kind],
        along = this.waveAxis === "x" ? s.x : s.z,
        wave = cheer * Math.max(0, Math.sin(along * 0.42 - wavePos * 2 + p.phase * 0.15)) * p.eager,
        up = wave * 1.4 + cheer * 0.3 * Math.max(0, Math.sin(time * 6 + p.phase)) > 0.5,
        bob =
          Math.sin(time * 2.4 + p.phase) * 0.012 +
          (up ? 0.05 + 0.04 * Math.abs(Math.sin(time * 9 + p.phase)) : 0),
        k = p.size,
        pose = up ? "cheer" : "sit";
      // (the classic crowd's spot is a little behind the seat: these sit on its pan, their backs to its back)
      d.position.set(s.x + Math.sin(s.ry) * FORWARD, s.y + bob, s.z + Math.cos(s.ry) * FORWARD);
      d.rotation.set(0, s.ry + p.turn * (up ? 0.3 : 1) + Math.sin(time * 0.4 + p.phase) * 0.08, 0);
      d.scale.setScalar(k);
      d.updateMatrix();
      b[pose].setMatrixAt(p.slot, d.matrix);
      if (p.pose !== (up ? 1 : 0)) {
        b[up ? "sit" : "cheer"].setMatrixAt(p.slot, HIDDEN);
        p.pose = up ? 1 : 0;
      }
      if (p.heldMesh) {
        // in the right hand, waved about in a cheer
        const h = b.hand[pose];
        this.hand.set(h[0], h[1], h[2]).applyMatrix4(d.matrix);
        d.position.copy(this.hand);
        d.rotation.set(0, d.rotation.y, up ? Math.sin(time * 8 + p.phase) * 0.5 : 0.25);
        d.scale.setScalar(up ? k : k * 0.8);
        d.updateMatrix();
        p.heldMesh.setMatrixAt(p.heldSlot, d.matrix);
      }
    });
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
