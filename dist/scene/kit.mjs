// Shared low-poly building blocks. Geometries and materials are cached per world build so static batching
// stays effective and a venue switch can dispose everything it created.
import * as THREE from "../assets/three.module.js";
import { RoundedBoxGeometry } from "../assets/RoundedBoxGeometry.js";

export { THREE };
export const UP = new THREE.Vector3(0, 1, 0);
export const COLORS = {
  teal: 0x118c94,
  navy: 0x174958,
  cream: 0xe5c58b,
  tile: 0xc69870,
  coral: 0xee8864,
  yellow: 0xf4c849,
  blue: 0x529fd5,
  wood: 0xd9a166,
  green: 0x6cb980,
  red: 0xe0513f,
  white: 0xfff6e4,
};

export class SceneKit {
  resetKit() {
    this.materials = new Map();
    this.geometries = new Map();
    this.textures = [];
  }
  mat(color, extra = {}) {
    const key = JSON.stringify([color, extra]);
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extra }),
      );
    return this.materials.get(key);
  }
  geo(key, make) {
    if (!this.geometries.has(key)) this.geometries.set(key, make());
    return this.geometries.get(key);
  }
  mesh(geo, color, x = 0, y = 0, z = 0, parent = this.scene, extra = {}) {
    const m = new THREE.Mesh(geo, color?.isMaterial ? color : this.mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(w, h, d, color, x, y, z, r = 0.07, parent = this.scene) {
    const geometry = this.geo("box:" + [w, h, d, r].join(","), () =>
      r
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2))
        : new THREE.BoxGeometry(w, h, d),
    );
    return this.mesh(geometry, color, x, y, z, parent);
  }
  ball(r, color, x, y, z, parent = this.scene, scale = null) {
    const m = this.mesh(
      this.geo("sphere:" + r, () => new THREE.SphereGeometry(r, 12, 8)),
      color,
      x,
      y,
      z,
      parent,
    );
    if (scale) m.scale.set(...scale);
    return m;
  }
  cyl(r1, r2, h, color, x, y, z, parent = this.scene, segments = 12) {
    const geometry = this.geo(
      "cyl:" + [r1, r2, h, segments].join(","),
      () => new THREE.CylinderGeometry(r1, r2, h, segments),
    );
    return this.mesh(geometry, color, x, y, z, parent);
  }
  rod(a, b, r, color, parent = this.scene) {
    const aa = new THREE.Vector3(...a),
      bb = new THREE.Vector3(...b),
      v = bb.clone().sub(aa),
      length = v.length();
    const geometry = this.geo(
      "rod:" + r + ":" + length.toFixed(3),
      () => new THREE.CylinderGeometry(r, r, length, 8),
    );
    const m = this.mesh(geometry, color, 0, 0, 0, parent);
    m.position.copy(aa.add(bb).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(UP, v.normalize());
    return m;
  }
  torus(r, tube, color, parent = this.scene, arc = Math.PI * 2, radial = 8, tubular = 22) {
    const geometry = this.geo(
      "torus:" + [r, tube, arc, radial, tubular].join(","),
      () => new THREE.TorusGeometry(r, tube, radial, tubular, arc),
    );
    return this.mesh(geometry, color, 0, 0, 0, parent);
  }
  group(x = 0, y = 0, z = 0, parent = this.scene, rotationY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotationY;
    parent.add(g);
    return g;
  }
  textPlane(text, w, h, bg, fg, x, y, z, parent = this.scene, font = 70) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(256, w * 100);
    canvas.height = Math.max(128, h * 120);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fg;
    ctx.font = "900 " + font + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.9);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures?.push(texture);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  ring(r, color) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.055, 40),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  // Soft, unlit decal used for glows, blob shadows and light shafts.
  decal(texture, w, h, color, opacity, additive = false) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
}

// Free GPU resources of a retired world build.
export function disposeScene(scene) {
  const seen = new Set();
  scene.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const key of ["map", "bumpMap", "roughnessMap", "emissiveMap", "alphaMap"])
        if (m[key] && !seen.has(m[key])) {
          seen.add(m[key]);
          m[key].dispose();
        }
      m.dispose();
    }
  });
}
