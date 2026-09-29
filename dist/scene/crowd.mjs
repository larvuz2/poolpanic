// Spectators: chunky sphere-people in the same toy style as the swimmers, drawn as four instanced meshes for the
// whole crowd. They sway, bounce and, when the hall cheers, throw their arms up in a wave that rolls through the seats.
import { THREE } from "./kit.mjs";
import { rngOf } from "./geom.mjs";

const SKINS = [0xe6aa80, 0xf0c29b, 0xa76d51, 0xc78e65, 0x784e3f];
export const CROWD_COLORS = [0xee8864, 0xf4c849, 0x118c94, 0xfff6e4, 0xe0513f, 0x529fd5, 0x6cb980, 0xb782db];

export class Crowd {
  // `seats` are { x, y, z, ry } (y is where the feet are, ry the way they face). `phase` is where the wave starts.
  constructor(w, parent, seats, { seed = 1, colors = CROWD_COLORS, scale = 1, waveAxis = "z" } = {}) {
    this.seats = seats;
    this.scale = scale;
    this.waveAxis = waveAxis;
    const rand = rngOf(seed),
      n = seats.length;
    // Hundreds of them: about 300 triangles a person, which still reads as round from the deck.
    const bodyGeo = new THREE.SphereGeometry(0.34, 8, 6),
      headGeo = new THREE.SphereGeometry(0.235, 9, 7),
      armGeo = new THREE.CapsuleGeometry(0.075, 0.42, 1, 6).translate(0, -0.28, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    this.bodies = new THREE.InstancedMesh(bodyGeo, mat, n);
    this.heads = new THREE.InstancedMesh(headGeo, skin, n);
    this.arms = new THREE.InstancedMesh(armGeo, skin, n * 2);
    const color = new THREE.Color();
    this.people = seats.map((s, i) => {
      const suit = colors[Math.floor(rand() * colors.length)],
        tone = SKINS[Math.floor(rand() * SKINS.length)];
      this.bodies.setColorAt(i, color.set(suit));
      this.heads.setColorAt(i, color.set(tone));
      this.arms.setColorAt(i * 2, color.set(tone));
      this.arms.setColorAt(i * 2 + 1, color.set(tone));
      return {
        phase: rand() * 6.28,
        size: (0.9 + rand() * 0.24) * scale,
        lean: (rand() - 0.5) * 0.12,
        eager: 0.4 + rand() * 0.6,
      };
    });
    for (const m of [this.bodies, this.heads, this.arms]) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parent.add(m);
    }
    this.dummy = new THREE.Object3D();
    this.update(0, 0);
  }

  // `cheer` (0..1) is how excited the hall is: 0 sits and sways, 1 is on its feet with a wave.
  update(time, cheer = 0) {
    const d = this.dummy;
    const wavePos = time * 2.2;
    this.seats.forEach((s, i) => {
      const p = this.people[i],
        along = this.waveAxis === "x" ? s.x : s.z,
        wave = cheer * Math.max(0, Math.sin(along * 0.42 - wavePos * 2 + p.phase * 0.15)) * p.eager,
        bob =
          Math.sin(time * 2.4 + p.phase) * 0.018 +
          wave * 0.16 +
          cheer * Math.abs(Math.sin(time * 5 + p.phase)) * 0.05,
        k = p.size;
      d.rotation.set(0, s.ry, p.lean * (1 - cheer * 0.5));
      d.position.set(s.x, s.y + 0.66 * k + bob, s.z);
      d.scale.set(k, k * 1.12, k * 0.86);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      d.scale.setScalar(k);
      d.position.y = s.y + 1.4 * k + bob;
      d.updateMatrix();
      this.heads.setMatrixAt(i, d.matrix);
      // Arms: down by the sides at rest, straight up in the air during a cheer.
      for (const side of [-1, 1]) {
        const lift = Math.min(1, wave * 1.4 + cheer * 0.3 * Math.max(0, Math.sin(time * 6 + p.phase + side)));
        d.rotation.set(0, s.ry, 0);
        const cos = Math.cos(s.ry),
          sin = Math.sin(s.ry),
          ox = side * 0.4 * k;
        d.position.set(s.x + ox * cos, s.y + 1.02 * k + bob, s.z - ox * sin);
        d.rotation.set(-lift * 2.9, s.ry, side * (0.16 + lift * 0.28));
        d.rotation.order = "YXZ";
        d.scale.setScalar(k);
        d.updateMatrix();
        this.arms.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), d.matrix);
      }
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
  }
}

// One chunky person in the same toy style, with arms and head exposed for animation: a bartender, a band leader.
// Returns { group, arms: [left, right] (pivots at the shoulders), head, root }.
export function figure(w, parent, { suit = 0xee8864, skin = 0xf0c29b, hat = null, scale = 1 } = {}) {
  const group = new THREE.Group();
  parent.add(group);
  const root = new THREE.Group();
  group.add(root);
  root.scale.setScalar(scale);
  const suitMat = w.mat(suit, { roughness: 0.6 }),
    skinMat = w.mat(skin, { roughness: 0.6 });
  const body = w.ball(0.36, suitMat, 0, 0.78, 0, root, [1.05, 1.25, 0.85]);
  const head = w.ball(0.26, skinMat, 0, 1.5, 0, root);
  if (hat !== null) w.ball(0.27, w.mat(hat, { roughness: 0.5 }), 0, 1.66, -0.02, root, [1, 0.6, 1]);
  for (const x of [-0.09, 0.09]) w.ball(0.03, 0x1d2a30, x, 1.52, 0.23, root);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 1.08, 0);
    root.add(pivot);
    w.ball(0.09, skinMat, 0, -0.26, 0, pivot, [0.9, 2.6, 0.9]);
    w.ball(0.1, skinMat, 0, -0.52, 0, pivot);
    return pivot;
  });
  for (const x of [-0.16, 0.16]) w.ball(0.11, skinMat, x, 0.3, 0, root, [1, 2.4, 1]);
  void body;
  return { group, root, arms, head };
}
