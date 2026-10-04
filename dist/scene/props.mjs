// Furniture and equipment builders. Positions come from the venue so meshes, hit volumes and collision
// proxies agree. Each builder adds to the world scene and registers labels/clickables where needed.
import { THREE, COLORS } from "./kit.mjs";
import { woodTexture } from "./textures.mjs";
import { dressFish } from "./fish-model.mjs";

export function woodMaterial(w, base = "#d7a064", seed = 9) {
  const key = "wood:" + base + seed;
  if (!w.materials.has(key)) {
    const t = woodTexture({ base, seed });
    w.textures.push(t);
    w.materials.set(key, new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 0.66 }));
  }
  return w.materials.get(key);
}

export function bench(w, x, z, angle = 0) {
  const g = w.group(x, 0, z, w.scene, angle);
  const wood = woodMaterial(w);
  for (const xx of [-1.32, 1.32]) {
    w.box(0.16, 0.55, 0.7, COLORS.navy, xx, 0.28, 0, 0.035, g);
    w.box(0.16, 1.12, 0.12, COLORS.navy, xx, 0.61, -0.32, 0.03, g);
  }
  for (let k = 0; k < 3; k++) w.box(3.3, 0.14, 0.21, wood, 0, 0.61, -0.23 + k * 0.23, 0.035, g);
  for (let k = 0; k < 2; k++) w.box(3.3, 0.22, 0.11, wood, 0, 0.95 + k * 0.25, -0.34, 0.035, g);
  return g;
}

export function plant(w, x, z, scale = 1) {
  const g = w.group(x, 0, z);
  g.scale.setScalar(scale);
  w.cyl(0.5, 0.35, 0.7, 0xdf9669, 0, 0.35, 0, g);
  w.cyl(0.43, 0.43, 0.06, 0x6e7451, 0, 0.71, 0, g);
  w.rod([0, 0.7, 0], [0.04, 2.25, 0], 0.07, 0x679271, g);
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7,
      leaf = w.ball(
        0.43,
        i % 2 ? 0x64a36e : 0x85bb72,
        Math.cos(a) * 0.45,
        1.47 + i * 0.13,
        Math.sin(a) * 0.45,
        g,
        [0.44, 1.7, 0.8],
      );
    leaf.rotation.z = Math.sin(a) * 0.75;
    leaf.rotation.x = Math.cos(a) * 0.65;
  }
  return g;
}

export function palm(w, x, z, height = 4.2, seed = 0) {
  const g = w.group(x, 0, z);
  w.cyl(0.62, 0.5, 0.62, 0xd9906a, 0, 0.31, 0, g);
  w.cyl(0.54, 0.54, 0.05, 0x6f7d4a, 0, 0.63, 0, g);
  const lean = 0.22 + (seed % 3) * 0.06;
  let prev = [0, 0.6, 0];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6,
      next = [Math.sin(seed) * lean * t * t * 2, 0.6 + height * t, Math.cos(seed) * lean * t * t * 2];
    w.rod(prev, next, 0.13 - t * 0.03, i % 2 ? 0x9b7650 : 0x8a6644, g);
    prev = next;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7 + seed,
      frond = w.group(prev[0], prev[1], prev[2], g, a);
    const leaf = w.ball(0.32, i % 2 ? 0x4f9a5b : 0x68b267, 0, -0.18, 0.95, frond, [0.5, 0.16, 2.4]);
    leaf.rotation.x = 0.42;
  }
  for (let i = 0; i < 3; i++)
    w.ball(0.12, 0x7a5a36, Math.cos(i * 2.1) * 0.14, prev[1] - 0.14, Math.sin(i * 2.1) * 0.14, g);
  return g;
}

export function fountain(w, x, z) {
  w.box(0.9, 0.85, 0.78, 0x77afb4, x, 0.45, z, 0.12);
  w.box(1.04, 0.18, 0.92, 0xdae4d8, x, 0.97, z, 0.1);
  w.rod([x + 0.2, 1.03, z - 0.2], [x + 0.2, 1.22, z - 0.2], 0.055, COLORS.navy);
}

export function lifeguardChair(w, x, z, angle = 0) {
  const g = w.group(x, 0, z, w.scene, angle);
  for (const xx of [-0.48, 0.48])
    for (const zz of [-0.4, 0.4]) w.rod([xx, 0, zz], [xx * 0.8, 1.8, zz * 0.7], 0.07, COLORS.navy, g);
  w.box(1.1, 0.16, 0.9, 0xf0bc51, 0, 1.8, 0, 0.055, g);
  w.box(1.1, 0.7, 0.12, 0xf0bc51, 0, 2.14, -0.39, 0.045, g);
  for (let i = 0; i < 4; i++) w.box(0.85, 0.06, 0.16, 0xedddad, 0, 0.32 + i * 0.35, 0.51, 0.025, g);
  return g;
}

export function lifeguardTower(w, x, z) {
  const g = w.group(x, 0, z, w.scene, Math.PI / 2);
  for (const xx of [-0.6, 0.6])
    for (const zz of [-0.55, 0.55]) w.rod([xx, 0, zz], [xx * 0.75, 2.4, zz * 0.7], 0.08, 0xf4f1e2, g);
  w.box(1.3, 0.16, 1.1, 0xe0513f, 0, 2.4, 0, 0.06, g);
  w.box(1.3, 0.9, 0.12, 0xe0513f, 0, 2.86, -0.5, 0.05, g);
  w.cyl(0.05, 0.05, 1.7, 0xf4f1e2, 0.55, 3.25, -0.5, g);
  const flag = w.box(0.5, 0.32, 0.03, 0xf4c849, 0.82, 3.9, -0.5, 0.01, g);
  flag.castShadow = false;
  for (let i = 0; i < 6; i++) w.box(0.9, 0.06, 0.16, 0xf4f1e2, 0, 0.3 + i * 0.36, 0.6, 0.025, g);
  const parasol = stripedCone(w, 1.05, 0.34, 8, 0xe0513f, 0xfff4dc);
  parasol.position.y = 3.95;
  g.add(parasol);
  w.cyl(0.03, 0.03, 1.2, 0xf4f1e2, 0, 3.3, 0, g);
  return g;
}

// Water care / first aid style station. Chlorine is rotated to face the long side.
export function station(w, item, point, color, title, angle = 0) {
  const g = w.group(point.x, 0, point.z, w.scene, angle);
  w.box(1.6, 1.12, 1.0, color, 0, 0.57, 0, 0.12, g);
  w.box(1.8, 0.16, 1.2, 0xffefd0, 0, 1.16, 0, 0.06, g);
  for (const x of [-0.39, 0.39]) w.box(0.65, 0.7, 0.035, 0xf2f0d3, x, 0.56, 0.52, 0.04, g);
  w.box(0.07, 0.2, 0.08, COLORS.navy, 0.1, 0.58, 0.56, 0.02, g);
  if (item === "chlorine") {
    w.cyl(0.26, 0.22, 0.52, 0xffe7aa, -0.42, 1.5, 0, g);
    w.cyl(0.27, 0.27, 0.08, COLORS.teal, -0.42, 1.78, 0, g);
    bucket(w, 0.4, 1.37, 0, g);
    w.textPlane("Cl", 0.3, 0.28, "#ffe7aa", "#438b8a", -0.42, 1.5, 0.25, g, 80);
  } else {
    w.box(0.6, 0.68, 0.2, 0xffffe4, -0.35, 1.56, 0, 0.08, g);
    w.box(0.35, 0.1, 0.04, COLORS.coral, -0.35, 1.56, 0.12, 0.005, g);
    w.box(0.1, 0.35, 0.04, COLORS.coral, -0.35, 1.56, 0.125, 0.005, g);
    w.cyl(0.1, 0.12, 0.3, 0x64bcca, 0.43, 1.44, 0, g);
    w.cyl(0.08, 0.1, 0.14, 0xffffe5, 0.43, 1.65, 0, g);
  }
  w.textPlane(title, 1.8, 0.31, "#fff1ce", "#32656b", 0, 2.09, 0.03, g, 42);
  stationHit(w, { kind: "station", item }, point, 2, 2.4, angle);
  w.labels.push({
    text: item === "chlorine" ? "E · CHLORINE" : "E · EYE RELIEF",
    x: point.x,
    y: 2.6,
    z: point.z,
  });
  return g;
}

export function stationHit(w, data, p, width, height, angle = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 1.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  m.position.set(p.x, height / 2, p.z);
  m.rotation.y = angle;
  m.userData = data;
  w.scene.add(m);
  w.clickables.push(m);
  return m;
}

export function finRack(w, point) {
  const g = w.group(point.x, 0, point.z, w.scene, -Math.PI / 2);
  for (const x of [-0.85, 0.85]) {
    w.box(0.11, 1.72, 0.13, COLORS.navy, x, 0.86, 0, 0.035, g);
    w.box(0.5, 0.12, 0.85, COLORS.navy, x, 0.06, 0, 0.025, g);
  }
  w.box(1.85, 0.12, 0.2, COLORS.navy, 0, 1.65, 0, 0.025, g);
  w.box(1.7, 0.12, 0.8, 0xe8bb73, 0, 0.54, 0, 0.025, g);
  w.finPairs = [];
  for (let i = 0; i < 3; i++) {
    const pair = finsObject(w);
    pair.position.set(-0.57 + i * 0.57, 0.82, -0.05);
    pair.rotation.x = -0.2;
    g.add(pair);
    w.finPairs.push(pair);
  }
  w.textPlane("FIN RENTAL", 1.72, 0.34, "#fff1ce", "#245c63", 0, 1.99, 0.04, g, 45);
  stationHit(w, { kind: "station", item: "fins" }, point, 2.2, 2.3, -Math.PI / 2);
  w.labels.push({ text: "E · FIN RACK", x: point.x, y: 2.55, z: point.z });
}

export function finsObject(w) {
  const g = new THREE.Group();
  for (const x of [-0.14, 0.14]) {
    const m = w.box(0.22, 0.51, 0.08, w.mat(COLORS.yellow, { roughness: 0.5 }), x, 0, 0, 0.035, g);
    m.rotation.z = x > 0 ? -0.06 : 0.06;
    w.box(0.14, 0.16, 0.11, COLORS.teal, x, 0.15, 0.015, 0.03, g);
  }
  return g;
}

export function bucket(w, x, y, z, parent, color = COLORS.yellow) {
  const g = w.group(x, y, z, parent);
  w.cyl(0.28, 0.21, 0.38, color, 0, 0, 0, g);
  w.cyl(0.24, 0.24, 0.025, 0xa5c8ad, 0, 0.198, 0, g);
  const hoop = w.torus(0.25, 0.025, COLORS.navy, g, Math.PI, 6, 16);
  hoop.position.y = 0.15;
  return g;
}

// Locker/cabana bay embedded in the left wall with a real hinged door facing the pool.
export function lockerBay(w, venue, x, name, color, style = "club") {
  const side = Math.sign(x),
    g = w.group(x, 0, -14);
  const wall = style === "arena" ? 0x2b3f66 : style === "resort" ? 0xf1e4c8 : 0x82a79b,
    inner = style === "arena" ? 0x22345a : style === "resort" ? 0xe7d3b0 : 0x71978d;
  w.box(5.3, 3.2, 0.23, wall, 0, 1.6, -2.3, 0.09, g);
  for (const xx of [-2.65, 2.65]) {
    if (Math.sign(xx) === side) w.box(0.2, 3.2, 2.7, inner, xx, 1.6, -1.06, 0.08, g);
    else {
      w.box(0.2, 3.2, 1.1, inner, xx, 1.6, -1.9, 0.06, g);
      w.box(0.24, 0.62, 1.55, color, xx, 2.9, -0.38, 0.05, g);
    }
  }
  w.box(5.5, 0.36, 0.6, color, 0, 3.25, 0.03, 0.07, g);
  if (style !== "club") {
    // Striped cabana awning.
    for (let i = 0; i < 9; i++)
      w.box(0.62, 0.08, 1.2, i % 2 ? 0xfff4dc : color, -2.48 + i * 0.62, 3.5, 0.45, 0.02, g).rotation.x =
        -0.28;
  }
  for (const xx of [-2.17, 2.17]) w.box(0.52, 3.1, 0.48, color, xx, 1.55, 0.02, 0.05, g);
  w.textPlane(name, 4.6, 0.52, "#" + color.toString(16).padStart(6, "0"), "#fff3d6", 0, 3.3, 0.35, g, 72);
  for (let i = 0; i < 5; i++) {
    const xx = -1.92 + i * 0.95;
    w.box(0.84, 2.45, 0.26, i % 2 ? 0x639d99 : color, xx, 1.27, -2.09, 0.025, g);
    w.box(0.055, 0.22, 0.07, 0xdaba71, xx + 0.25, 1.33, -1.91, 0.018, g);
    for (let k = 0; k < 3; k++) w.box(0.42, 0.032, 0.02, 0x376f78, xx, 2.11 - k * 0.1, -1.937, 0, g);
  }
  w.box(3.7, 0.03, 1.5, 0xbf8954, 0, 0.025, -0.32, 0.09, g);
  for (let i = 0; i < 10; i++) w.box(0.04, 0.04, 1.4, 0x95653f, -1.67 + i * 0.37, 0.045, -0.32, 0.008, g);
  w.box(3.1, 0.15, 0.65, woodMaterial(w), 0, 0.58, -1.17, 0.045, g);
  for (const xx of [-1.1, 1.1]) w.box(0.1, 0.5, 0.4, COLORS.navy, xx, 0.27, -1.17, 0.02, g);
  const doorX = -side * 2.65;
  for (const zz of [-1.13, 0.3]) w.box(0.3, 2.7, 0.13, COLORS.navy, doorX, 1.35, zz, 0.03, g);
  const hinge = new THREE.Group();
  hinge.position.set(doorX, 0, -1.08);
  g.add(hinge);
  w.box(0.13, 2.5, 1.34, color, 0, 1.28, 0.67, 0.065, hinge);
  w.box(0.16, 0.67, 0.58, 0x90c3bd, 0, 1.72, 0.69, 0.045, hinge);
  w.box(0.17, 0.12, 0.72, 0xd6bd89, 0, 0.55, 0.7, 0.025, hinge);
  w.ball(0.095, 0xe5be58, -side * 0.16, 1.13, 1.18, hinge);
  w.lockerDoors.push({ side, hinge });
  return g;
}

export function lifeRingObject(w) {
  const g = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(0.49, 0.13, 10, 32),
    w.mat(0xf47742, { roughness: 0.5 }),
  );
  g.add(torus);
  torus.castShadow = true;
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.137, 10, 6, 0.35),
      w.mat(0xfff4d9, { roughness: 0.5 }),
    );
    band.rotation.z = (i * Math.PI) / 2 - 0.175;
    g.add(band);
  }
  return g;
}

// Wall mounts for the three life rings, with rescue-only floor glows and warm local lights.
export function rescueStations(w, venue) {
  w.ringModels = [];
  w.ringHits = [];
  w.ringGlows = [];
  w.ringLights = [];
  const glowMap = w.glowMap;
  for (const [id, p] of venue.ringMounts.entries()) {
    const mount = w.group(p.x, 0, p.z, w.scene, p.angle);
    w.box(1.65, 2.5, 0.13, 0x277982, 0, 1.3, -0.18, 0.09, mount);
    w.rod([0, 2.3, -0.12], [0, 2.3, 0.13], 0.055, COLORS.navy, mount);
    w.textPlane("LIFE RING", 1.65, 0.32, "#fff1ce", "#245c63", 0, 2.72, 0.04, mount, 45);
    const model = lifeRingObject(w);
    model.position.set(p.x, 1.65, p.z);
    model.rotation.y = p.angle;
    w.scene.add(model);
    w.ringModels.push(model);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.userData = { kind: "lifering", ringId: id };
    w.scene.add(hit);
    w.clickables.push(hit);
    w.ringHits.push(hit);
    const glow = new THREE.Group();
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffca49,
        map: glowMap,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    disk.rotation.x = -Math.PI / 2;
    glow.add(disk);
    glow.add(w.ring(1.15, 0xffed8d));
    glow.visible = false;
    w.scene.add(glow);
    w.ringGlows.push(glow);
    const light = new THREE.PointLight(0xffcf57, 0, 4, 2);
    w.scene.add(light);
    w.ringLights.push(light);
    w.labels.push({ text: "E · LIFE RING", ...p, y: 3.1, minLevel: 2 });
  }
  w.lifeRingModel = w.ringModels[0];
  w.lifeRingHit = w.ringHits[0];
}

export function skimmerObject(w) {
  const g = new THREE.Group();
  w.rod([0, 0, 0], [0, 0, 2.65], 0.045, 0xc0d6db, g);
  w.rod([0, 0, 0], [0, 0, 0.35], 0.073, 0xffce4e, g);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 7, 20), w.mat(0xffce4e));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0, 3.02);
  g.add(rim);
  const net = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 10, 7),
    new THREE.MeshBasicMaterial({ color: 0x94ced5, wireframe: true, transparent: true, opacity: 0.65 }),
  );
  net.scale.y = 0.4;
  net.position.set(0, -0.1, 3.02);
  g.add(net);
  const waste = pooObject(w);
  waste.name = "caught-waste";
  waste.position.set(0, 0, 3.02);
  waste.scale.setScalar(0.7);
  waste.visible = false;
  g.add(waste);
  return g;
}

export function pooObject(w) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) w.ball(0.37 - i * 0.08, 0x986442, 0, 0.12 + i * 0.2, 0, g, [1, 0.7, 1]);
  w.ball(0.13, 0x986442, 0.06, 0.65, 0, g, [0.7, 1.4, 0.7]);
  for (const x of [-0.12, 0.12]) {
    w.ball(0.073, 0xfff2cc, x, 0.31, 0.265, g);
    w.ball(0.036, 0x23434a, x, 0.31, 0.33, g);
  }
  return g;
}

// Skimmer hooks on the near wall and the waste bin (level 3+).
export function sanitationCorner(w, venue) {
  const g = new THREE.Group();
  w.sanitationGroup = g;
  w.scene.add(g);
  const r = venue.sanitation.rack,
    b = venue.sanitation.bin,
    wallX = venue.deck.minX - 0.45;
  w.box(0.16, 1.25, 3.9, 0x174752, wallX, 1.75, r.z, 0.07, g);
  for (const z of [r.z - 1, r.z + 1])
    w.rod([wallX + 0.15, 1.8, z], [wallX + 0.65, 1.8, z], 0.07, 0xe5ba57, g);
  w.skimmerRack = skimmerObject(w);
  w.skimmerRack.position.set(wallX + 0.55, 1.85, r.z - 1.5);
  g.add(w.skimmerRack);
  const title = w.textPlane("POOL SKIMMER", 2.7, 0.4, "#f6daa1", "#245762", wallX - 0.1, 2.65, r.z, g, 42);
  title.rotation.y = -Math.PI / 2;
  w.cyl(0.62, 0.52, 1.25, 0x204d59, b.x, 0.65, b.z, g);
  w.cyl(0.59, 0.59, 0.045, 0x102833, b.x, 1.29, b.z, g);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.07, 8, 22), w.mat(0xf2b44f));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(b.x, 1.32, b.z);
  g.add(rim);
  for (const z of [-0.3, 0.3]) w.box(0.03, 0.5, 0.14, 0xf0bd4d, b.x - 0.61, 0.74, b.z + z, 0.02, g);
  const label = w.textPlane("WASTE", 0.84, 0.35, "#204d59", "#ffdda1", b.x - 0.64, 0.83, b.z, g, 42);
  label.rotation.y = -Math.PI / 2;
  for (const [item, point] of [
    ["skimmer", r],
    ["waste-bin", b],
  ]) {
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 2, 1.3),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(point.x, 1, point.z);
    hit.userData = { kind: "sanitation", item };
    g.add(hit);
    w.clickables.push(hit);
    w.labels.push({
      text: item === "skimmer" ? "E · POOL SKIMMER" : "E · WASTE BIN",
      ...point,
      y: 2.8,
      minLevel: 3,
    });
  }
  w.scoopCast = new THREE.Group();
  w.scene.add(w.scoopCast);
  w.scoopShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), w.mat(0xc3dde3));
  w.scoopCast.add(w.scoopShaft);
  w.scoopNet = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 22), w.mat(0xffd447));
  w.scoopNet.rotation.x = Math.PI / 2;
  w.scoopCast.add(w.scoopNet);
  w.scoopCast.visible = false;
}

// ---------------------------------------------------------------------------------------------------------
// Incident fixtures. Each registers a label that only shows while its incident needs it.

export function fishNetObject(w) {
  const g = new THREE.Group();
  w.rod([0, 0, -0.4], [0, 0, 1.9], 0.042, 0x8b6b45, g);
  w.rod([0, 0, -0.4], [0, 0, -0.05], 0.06, 0x2f7b86, g);
  const hoop = w.torus(0.42, 0.04, 0x2f9a63, g, Math.PI * 2, 7, 22);
  hoop.rotation.y = Math.PI / 2;
  hoop.position.set(0, 0, 2.3);
  const bag = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 0.75, 10, 3, true),
    new THREE.MeshBasicMaterial({ color: 0xc9eadb, wireframe: true, transparent: true, opacity: 0.75 }),
  );
  bag.rotation.x = Math.PI;
  bag.position.set(0, -0.36, 2.3);
  g.add(bag);
  const caught = fishObject(w, 0.62);
  caught.name = "net-fish";
  caught.position.set(0, -0.3, 2.3);
  caught.rotation.x = -0.5;
  caught.visible = false;
  g.add(caught);
  return g;
}

export function fishObject(w, scale = 1) {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  body.name = "fish-body";
  const koi = w.mat(0xf2803a, { roughness: 0.35 });
  w.ball(0.34, koi, 0, 0, 0, body, [0.6, 0.72, 1.45]);
  w.ball(0.3, 0xfff1d8, 0, -0.1, 0.06, body, [0.5, 0.45, 1.2]);
  for (const [x, z] of [
    [0.05, 0.12],
    [-0.08, -0.14],
    [0.02, -0.28],
  ])
    w.ball(0.07, 0xfff6e8, x, 0.2, z, body, [1, 0.5, 1.3]);
  for (const x of [-0.14, 0.14]) {
    w.ball(0.065, 0xffffff, x, 0.08, 0.34, body);
    w.ball(0.034, 0x1b2b30, x * 1.18, 0.09, 0.39, body);
  }
  w.ball(0.07, 0xff8f9a, 0, -0.04, 0.5, body, [1.4, 0.8, 0.7]);
  const tail = new THREE.Group();
  tail.name = "fish-tail";
  tail.position.set(0, 0, -0.44);
  body.add(tail);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.34, -0.42);
  shape.lineTo(0.02, -0.26);
  shape.lineTo(0.34, -0.42);
  shape.closePath();
  const fin = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: 0xf49a52, side: THREE.DoubleSide, roughness: 0.4 }),
  );
  fin.rotation.x = Math.PI / 2;
  fin.rotation.y = Math.PI / 2;
  fin.castShadow = true;
  tail.add(fin);
  const dorsal = w.box(0.04, 0.2, 0.34, 0xf49a52, 0, 0.3, -0.02, 0.02, body);
  dorsal.rotation.x = -0.3;
  g.scale.setScalar(scale);
  dressFish(g); // (the model, when it is loaded: scene/fish-model.mjs; this koi stays under it)
  return g;
}

export function fishNetHook(w, p) {
  const g = w.group(p.x, 0, p.z, w.scene, p.angle);
  w.box(1.4, 2.8, 0.13, 0x2c6f5c, 0, 1.45, -0.18, 0.09, g);
  for (const y of [1.25, 2.35]) w.rod([0, y, -0.12], [0, y, 0.16], 0.05, 0xe5ba57, g);
  w.textPlane("FISH NET", 1.4, 0.32, "#e9f7d6", "#245c4a", 0, 3.05, 0.04, g, 45);
  w.fishNetRack = fishNetObject(w);
  w.fishNetRack.position.set(p.x + Math.sin(p.angle) * 0.2, 0.55, p.z + Math.cos(p.angle) * 0.2);
  w.fishNetRack.rotation.set(-Math.PI / 2, 0, 0);
  w.fishNetRack.rotation.y = p.angle;
  w.scene.add(w.fishNetRack);
  const point = { x: p.x + Math.sin(p.angle) * 0.9, z: p.z + Math.cos(p.angle) * 0.9 };
  stationHit(w, { kind: "fixture", item: "fishNet" }, point, 1.6, 2.6, p.angle);
  w.labels.push({ text: "E · FISH NET", x: point.x, y: 3.4, z: point.z, when: (s) => !!s.fish });
}

export function treatsObject(w) {
  const g = new THREE.Group();
  w.box(0.36, 0.42, 0.24, 0xc58a54, 0, 0, 0, 0.04, g);
  w.box(0.37, 0.06, 0.25, 0xe7c08c, 0, 0.2, 0, 0.02, g);
  bone(w, 0, 0.3, 0, g, 0.7);
  return g;
}

export function bone(w, x, y, z, parent, s = 1) {
  const g = w.group(x, y, z, parent);
  g.scale.setScalar(s);
  w.rod([-0.18, 0, 0], [0.18, 0, 0], 0.05, 0xfff3dc, g);
  for (const xx of [-0.2, 0.2]) for (const zz of [-0.045, 0.045]) w.ball(0.065, 0xfff3dc, xx, 0, zz, g);
  return g;
}

export function treatsTable(w, p) {
  const g = w.group(p.x, 0, p.z);
  w.cyl(0.36, 0.36, 0.08, 0xf4f1e2, 0, 0.78, 0, g, 18);
  w.cyl(0.05, 0.08, 0.76, COLORS.navy, 0, 0.38, 0, g, 8);
  w.cyl(0.26, 0.3, 0.05, COLORS.navy, 0, 0.03, 0, g, 12);
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.38, 14),
    new THREE.MeshStandardMaterial({ color: 0xcdeef0, transparent: true, opacity: 0.45, roughness: 0.1 }),
  );
  jar.position.set(0, 1.01, 0);
  g.add(jar);
  w.cyl(0.21, 0.21, 0.06, COLORS.coral, 0, 1.22, 0, g);
  for (let i = 0; i < 4; i++)
    bone(w, Math.cos(i * 1.7) * 0.07, 0.9 + i * 0.07, Math.sin(i * 1.7) * 0.07, g, 0.45).rotation.y = i;
  w.textPlane("DOG TREATS", 0.9, 0.2, "#fff1ce", "#8a5a2e", 0, 1.45, 0, g, 38).rotation.y = -Math.PI / 2;
  stationHit(w, { kind: "fixture", item: "treats" }, p, 1.2, 1.6);
  w.labels.push({
    text: "E · DOG TREATS",
    x: p.x,
    y: 2.1,
    z: p.z,
    when: (s) => !!s.dog && s.dog.stage !== "gone",
  });
}

export function flashlightObject(w) {
  const g = new THREE.Group();
  w.cyl(0.07, 0.07, 0.42, 0xf4c849, 0, 0, 0, g, 10).rotation.x = Math.PI / 2;
  w.cyl(0.12, 0.08, 0.14, 0x2c4f59, 0, 0, 0.27, g, 12).rotation.x = Math.PI / 2;
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8 }),
  );
  lens.position.z = 0.345;
  lens.name = "lens";
  g.add(lens);
  return g;
}

export function flashlightHolder(w, p) {
  const g = w.group(p.x, 0, p.z);
  w.cyl(0.06, 0.06, 1.1, COLORS.navy, 0, 0.55, 0, g, 8);
  w.box(0.4, 0.12, 0.3, COLORS.navy, 0, 1.1, 0, 0.03, g);
  w.flashlightRack = flashlightObject(w);
  w.flashlightRack.position.set(p.x, 1.24, p.z);
  w.flashlightRack.rotation.y = -Math.PI / 2;
  w.scene.add(w.flashlightRack);
  stationHit(w, { kind: "fixture", item: "flashlight" }, p, 1, 1.8);
  w.labels.push({
    text: "E · FLASHLIGHT",
    x: p.x,
    y: 2,
    z: p.z,
    when: (s) => !!s.outage && s.outage.stage !== "done",
  });
}

export function fuseBox(w, p) {
  const g = w.group(p.x, 0, p.z, w.scene, p.angle);
  w.box(1.2, 1.5, 0.3, 0x8fa3a8, 0, 1.55, -0.12, 0.05, g);
  w.box(1.08, 1.36, 0.06, 0x6f848a, 0, 1.55, 0.05, 0.03, g);
  w.textPlane("⚡ FUSES", 0.9, 0.24, "#f4c849", "#1d3a42", 0, 2.02, 0.09, g, 40);
  w.fuseLever = new THREE.Group();
  w.fuseLever.position.set(0, 1.35, 0.1);
  g.add(w.fuseLever);
  w.box(0.12, 0.42, 0.08, 0xe0513f, 0, 0.18, 0.02, 0.03, w.fuseLever);
  w.ball(0.08, 0x1d3a42, 0, 0.4, 0.03, w.fuseLever);
  const sparks = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({
      map: w.glowMap,
      color: 0xffe066,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sparks.position.set(0, 1.9, 0.2);
  g.add(sparks);
  w.fuseSparks = sparks;
  w.fuseLight = new THREE.PointLight(0xffd35a, 0, 5, 2);
  w.fuseLight.position.set(p.x + Math.sin(p.angle) * 0.8, 1.8, p.z + Math.cos(p.angle) * 0.8);
  w.scene.add(w.fuseLight);
  const point = { x: p.x + Math.sin(p.angle) * 0.85, z: p.z + Math.cos(p.angle) * 0.85 };
  stationHit(w, { kind: "fixture", item: "fuseBox" }, point, 1.4, 2.4, p.angle);
  w.labels.push({
    text: "E · FUSE BOX",
    x: point.x,
    y: 2.8,
    z: point.z,
    when: (s) => !!s.outage && s.outage.stage !== "done",
  });
}

export function medkitObject(w) {
  const g = new THREE.Group();
  w.box(0.52, 0.36, 0.24, 0xe0513f, 0, 0, 0, 0.06, g);
  w.box(0.26, 0.08, 0.02, 0xffffff, 0, 0, 0.125, 0.01, g);
  w.box(0.08, 0.26, 0.02, 0xffffff, 0, 0, 0.126, 0.01, g);
  w.rod([-0.12, 0.2, 0], [0.12, 0.2, 0], 0.025, 0x1d3a42, g);
  return g;
}

export function medkitCabinet(w, p) {
  const g = w.group(p.x - 0.5, 0, p.z, w.scene, Math.PI / 2);
  w.box(1.5, 2.1, 0.5, 0xfff6ea, 0, 1.05, 0, 0.08, g);
  w.box(0.52, 0.16, 0.04, 0xe0513f, 0, 1.75, 0.27, 0.01, g);
  w.box(0.16, 0.52, 0.04, 0xe0513f, 0, 1.75, 0.271, 0.01, g);
  w.textPlane("MEDIC", 1.2, 0.26, "#fff6ea", "#c2412f", 0, 1.3, 0.26, g, 44);
  w.medkitRack = medkitObject(w);
  w.medkitRack.position.set(p.x - 0.1, 0.95, p.z);
  w.medkitRack.rotation.y = Math.PI / 2;
  w.scene.add(w.medkitRack);
  stationHit(w, { kind: "fixture", item: "medkit" }, p, 1.4, 2.2, Math.PI / 2);
  w.labels.push({
    text: "E · MEDICAL KIT",
    x: p.x,
    y: 2.6,
    z: p.z,
    when: (s) => s.people.some((q) => q.status === "injured"),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Resort pieces.

export function lounger(w, x, z, angle = 0, color = 0x2f9aa0) {
  const g = w.group(x, 0, z, w.scene, angle);
  for (const xx of [-0.35, 0.35])
    for (const zz of [-0.9, 0.9]) w.cyl(0.04, 0.04, 0.36, 0xf4f1e2, xx, 0.18, zz, g, 6);
  w.box(0.86, 0.1, 2.0, 0xf4f1e2, 0, 0.38, 0, 0.04, g);
  w.box(0.78, 0.08, 1.3, color, 0, 0.47, 0.3, 0.04, g);
  const back = w.box(0.78, 0.08, 0.75, color, 0, 0.72, -0.72, 0.04, g);
  back.rotation.x = -0.75;
  w.box(0.5, 0.12, 0.26, 0xfff6ea, 0, 0.55, -0.55, 0.06, g).rotation.x = -0.6;
  return g;
}

// Cone with alternating coloured panels (parasols, awnings).
export function stripedCone(w, radius, height, segments, colorA, colorB) {
  const key = "stripes:" + [radius, height, segments, colorA, colorB].join(",");
  const geometry = w.geo(key, () => {
    const geo = new THREE.ConeGeometry(radius, height, segments, 1, true).toNonIndexed();
    const pos = geo.attributes.position,
      a = new THREE.Color(colorA),
      b = new THREE.Color(colorB),
      colors = [];
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
        cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const seg = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * segments) % segments;
      const c = seg % 2 ? a : b;
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  });
  const m = new THREE.Mesh(
    geometry,
    w.mat(0xffffff, { vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function umbrella(w, x, z, color = 0xe0513f) {
  const g = w.group(x, 0, z);
  w.cyl(0.05, 0.05, 2.6, 0xf4f1e2, 0, 1.3, 0, g, 8);
  w.cyl(0.35, 0.4, 0.12, 0xb9a282, 0, 0.06, 0, g, 12);
  const canopy = stripedCone(w, 1.55, 0.5, 10, color, 0xfff4dc);
  canopy.position.y = 2.55;
  g.add(canopy);
  w.ball(0.07, color, 0, 2.82, 0, g);
  return g;
}

export function kiosk(w, x, z) {
  const g = w.group(x, 0, z, w.scene, -Math.PI / 2);
  w.box(2.4, 1.15, 2.0, 0xf1e4c8, 0, 0.58, 0, 0.1, g);
  w.box(2.6, 0.12, 2.2, 0xd6a45c, 0, 1.2, 0, 0.05, g);
  for (const xx of [-1.15, 1.15]) w.cyl(0.06, 0.06, 1.3, 0xf4f1e2, xx, 1.85, 0.95, g, 8);
  for (let i = 0; i < 7; i++) {
    const s = w.box(0.4, 0.08, 1.45, i % 2 ? 0xfff4dc : 0x2f9aa0, -1.2 + i * 0.4, 2.55, 0.35, 0.02, g);
    s.rotation.x = -0.35;
  }
  w.textPlane("SNACKS", 1.6, 0.34, "#d6a45c", "#fff4dc", 0, 0.8, 1.01, g, 50);
  for (let i = 0; i < 3; i++)
    w.cyl(0.08, 0.08, 0.2, [0xe0513f, 0xf4c849, 0x6cb980][i], -0.5 + i * 0.5, 1.36, 0.2, g, 8);
  return g;
}

// Trampoline tower: platform with rails, stairs down the back, and a launch bed overhanging the far deck.
export function trampolineTower(w, t, theme = {}) {
  const g = w.group(t.x, 0, t.z);
  const H = t.bedY - 0.22;
  const white = theme.white ?? 0xf4f1e2,
    blue = theme.blue ?? 0x2f86b8;
  for (const xx of [-0.85, 0.85])
    for (const zz of [-0.95, 0.95]) w.cyl(0.09, 0.11, H, white, xx, H / 2, zz, g, 8);
  w.box(1.9, 0.18, 2.1, blue, 0, H, 0, 0.06, g);
  for (const zz of [-1.02, 1.02]) {
    w.rod([-0.9, H + 0.05, zz], [-0.9, H + 1.0, zz], 0.035, white, g);
    w.rod([0.9, H + 0.05, zz], [0.9, H + 1.0, zz], 0.035, white, g);
    w.rod([-0.9, H + 1.0, zz], [0.9, H + 1.0, zz], 0.035, white, g);
  }
  for (const yy of [0.8, 1.6]) w.rod([-0.85, yy, -0.95], [0.85, yy, 0.95], 0.03, white, g);
  // Stairs down toward +X.
  const steps = 8,
    run = t.stairBottomX - (t.x + 0.95);
  for (let i = 0; i < steps; i++) {
    const f = (i + 0.5) / steps;
    w.box(run / steps + 0.06, 0.1, 1.0, theme.steps ?? 0xe7d3b0, 0.95 + run * (1 - f), H * f, 0, 0.02, g);
  }
  for (const zz of [-0.55, 0.55]) {
    w.rod([0.95, H + 0.9, zz], [0.95 + run, 0.9, zz], 0.035, white, g);
    w.rod([0.95 + run, 0, zz], [0.95 + run, 0.9, zz], 0.035, white, g);
  }
  // Launch arm and trampoline bed.
  const armX = t.bedX - t.x;
  w.box(Math.abs(armX) + 0.2, 0.14, 0.5, blue, armX / 2 - 0.1, H + 0.06, 0, 0.04, g);
  const bed = w.group(armX, t.bedY - 0.1, 0, g);
  w.torus(0.82, 0.07, blue, bed, Math.PI * 2, 8, 28).rotation.x = Math.PI / 2;
  const mat = new THREE.Mesh(new THREE.CircleGeometry(0.72, 28), w.mat(0x243a44, { roughness: 0.9 }));
  mat.rotation.x = -Math.PI / 2;
  mat.name = "bed-mat";
  bed.add(mat);
  w.trampolineBed = mat;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    w.rod(
      [Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72],
      [Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8],
      0.02,
      0xc9d6da,
      bed,
    );
  }
  const sign = w.textPlane(
    "SPLASH ZONE · LANE " + (t.lane + 1),
    2.1,
    0.34,
    "#e0513f",
    "#fff4dc",
    0.2,
    H + 1.35,
    0,
    g,
    40,
  );
  sign.rotation.y = -Math.PI / 2;
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 3.6, 2.4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(t.x - 0.6, 1.8, t.z);
  hit.userData = { kind: "trampoline" };
  w.scene.add(hit);
  w.clickables.push(hit);
  w.labels.push({ text: "🤸 TRAMPOLINE", x: t.x, y: H + 2.1, z: t.z });
  return g;
}
