// Geometry helpers for the environment builders (sky, hall, arena): merging, vertex colours, seeded randomness,
// and cloth (pennants, bunting, banners) whose wind flutter is done on the GPU so hundreds of flags cost nothing.
import { THREE } from "./kit.mjs";

export function rngOf(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Merge geometries into one non-indexed geometry. Attributes missing from a part are filled (white colour, zero
// everything else), so tinted and untinted parts can be mixed.
export function mergeGeos(list, names = ["position", "normal", "color", "uv", "aFlex", "aPhase"]) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = parts.find((g) => g.attributes[name])?.attributes[name].itemSize;
    if (!size) continue;
    const array = new Float32Array(total * size);
    if (name === "color") array.fill(1);
    let offset = 0;
    for (const g of parts) {
      const a = g.attributes[name];
      if (a) array.set(a.array, offset);
      offset += g.attributes.position.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  out.computeBoundingSphere();
  for (const g of parts) if (!list.includes(g)) g.dispose();
  return out;
}

// Paint a geometry: a single colour, or a function (x, y, z) → Color for a vertical gradient and the like.
export function paint(geometry, color) {
  const pos = geometry.attributes.position,
    array = new Float32Array(pos.count * 3),
    c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (typeof color === "function") c.copy(color(pos.getX(i), pos.getY(i), pos.getZ(i), i));
    else c.set(color);
    array.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(array, 3));
  return geometry;
}

// Copy of a geometry moved by a matrix (position, rotation Euler [x, y, z], uniform or per-axis scale).
export function placed(geometry, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, "YXZ")),
    new THREE.Vector3(...s),
  );
  return geometry.clone().applyMatrix4(m);
}

// Cloth. Every vertex carries `aFlex` (how far it is from where the cloth is fastened: 0 stays put, 1 flutters
// most) and `aPhase` (so neighbouring flags do not move in step). The vertex shader in `wind()` reads both.
function cloth(vertices, indices, normal, phase, uvs = null) {
  const g = new THREE.BufferGeometry(),
    n = vertices.length;
  const position = new Float32Array(n * 3),
    flex = new Float32Array(n),
    ph = new Float32Array(n),
    nrm = new Float32Array(n * 3);
  vertices.forEach(([x, y, z, f], i) => {
    position.set([x, y, z], i * 3);
    flex[i] = f;
    ph[i] = phase;
    nrm.set(normal, i * 3);
  });
  if (uvs) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs.flat()), 2));
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("aFlex", new THREE.BufferAttribute(flex, 1));
  g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
  g.setIndex(indices);
  return g;
}

// A rectangular flag or banner in the XY plane, fastened along one edge, facing +Z. `edge` picks the fastened
// edge: "left" (flag on a pole), "top" (banner hung from a beam). `notch` cuts a swallow-tail into the free end.
export function flagGeo(
  width,
  height,
  { edge = "left", notch = 0, cols = 7, rows = 1, phase = 0, cell = null } = {},
) {
  const vertices = [],
    uvs = [],
    indices = [];
  const along = edge === "top" ? rows : cols,
    across = edge === "top" ? cols : rows;
  for (let j = 0; j <= across; j++)
    for (let i = 0; i <= along; i++) {
      const u = i / along,
        v = j / across;
      let x, y, f, fu, fv;
      if (edge === "top") {
        x = (v - 0.5) * width;
        y = -u * height;
        f = u;
        fu = v;
        fv = u;
        if (notch && u > 0.75) y += Math.max(0, 1 - Math.abs(v - 0.5) * 2) * notch * ((u - 0.75) / 0.25);
      } else {
        x = u * width;
        y = (0.5 - v) * height;
        f = u;
        fu = u;
        fv = v;
        if (notch && u > 0.7) x -= Math.max(0, 1 - Math.abs(v - 0.5) * 2) * notch * ((u - 0.7) / 0.3);
      }
      vertices.push([x, y, 0, f]);
      uvs.push(cell ? [(cell[0] + fu) / cell[2], 1 - (cell[1] + fv) / cell[3]] : [fu, 1 - fv]);
    }
  for (let j = 0; j < across; j++)
    for (let i = 0; i < along; i++) {
      const a = j * (along + 1) + i,
        b = a + 1,
        c = a + along + 1,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  return cloth(vertices, indices, [0, 0, 1], phase, uvs);
}

// One bunting triangle hanging from a string along +X, pointing down, facing +Z.
export function triangleGeo(width, height, phase = 0) {
  const vertices = [],
    indices = [],
    rows = 3;
  for (let r = 0; r <= rows; r++) {
    const u = r / rows,
      half = (width / 2) * (1 - u);
    vertices.push([-half, -u * height, 0, u]);
    if (half > 1e-6) vertices.push([half, -u * height, 0, u]);
  }
  // Rows 0..2 have two vertices each, the tip is the last single vertex.
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2,
      b = a + 1,
      c = a + 2,
      d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const last = (rows - 1) * 2;
  indices.push(last, last + 2, last + 1);
  return cloth(vertices, indices, [0, 0, 1], phase);
}

// Bunting between two points: triangles hanging from a sagging string. Returns the coloured cloth geometry and the
// polyline of the string. Flags face across the string (horizontally perpendicular to it).
export function garland(from, to, { count = 14, size = 0.55, sag = 0.9, colors, seed = 1, drop = 1.15 }) {
  const rand = rngOf(seed),
    a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    dir = b.clone().sub(a),
    horizontal = new THREE.Vector3(dir.x, 0, dir.z).normalize(),
    yaw = Math.atan2(horizontal.x, horizontal.z) - Math.PI / 2;
  const at = (t) =>
    a
      .clone()
      .lerp(b, t)
      .add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const pieces = [],
    line = [];
  for (let i = 0; i <= 24; i++) line.push(at(i / 24));
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count,
      p = at(t),
      g = triangleGeo(size, size * drop, rand() * 6.28);
    tint.set(colors[i % colors.length]);
    paint(g, tint);
    pieces.push(placed(g, { at: [p.x, p.y, p.z], rot: [0, yaw, 0] }));
  }
  return { flags: mergeGeos(pieces), line };
}

// Shared wind for every cloth material of a world: one `uTime` and one `uAmp` uniform.
export function windUniforms() {
  return { uWindTime: { value: 0 }, uWindAmp: { value: 1 } };
}
// Patches a standard material so vertices with `aFlex` ripple along their normal.
export function wind(material, uniforms, { amp = 0.16, speed = 2.4 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = uniforms.uWindTime;
    shader.uniforms.uWindAmp = uniforms.uWindAmp;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aFlex;\nattribute float aPhase;\nuniform float uWindTime;\nuniform float uWindAmp;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float ripple = sin(uWindTime * ${speed.toFixed(2)} + aPhase + aFlex * 5.0) + 0.45 * sin(uWindTime * ${(speed * 2.3).toFixed(2)} + aPhase * 1.7 + aFlex * 9.0);
        transformed += normalize(normal) * ripple * aFlex * uWindAmp * ${amp.toFixed(3)};
        transformed.y -= abs(ripple) * aFlex * aFlex * uWindAmp * ${(amp * 0.25).toFixed(3)};`,
      );
  };
  material.customProgramCacheKey = () => "wind" + amp + speed;
  return material;
}
