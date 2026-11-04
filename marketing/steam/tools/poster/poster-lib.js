// The cast poster: every character's real model, loaded straight from its file, placed by hand on a venue's deck and frozen
// in one frame of a clip (a clip may come from another file: every biped shares Coach Waters' skeleton), a coach's face set to
// one of the game's expressions. Expects CAST (the list), C = [x, z] (the group's middle), A (the way they face, radians:
// 0 faces +z) and FLOOR (optional fixed floor height). Local x runs to the camera's right, local z toward the camera.
const THREE = await import('/assets/three.module.js');
const { GLTFLoader } = await import('/assets/GLTFLoader.js');
const { clone } = await import('/assets/SkeletonUtils.js');
const { CoachFace } = await import('/scene/coach-face.mjs');
const loader = new GLTFLoader();
const files = new Map();
const load = (f) => {
  if (!files.has(f)) files.set(f, loader.loadAsync(f.startsWith('/') ? f : '/assets/' + f));
  return files.get(f);
};
// Clear the game's own people and coaches.
s.people.length = 0;
s.visitors.length = 0;
for (const c of s.coaches || [s.coach]) { c.x = 400; c.z = 400; }
await new Promise((r) => setTimeout(r, 1200));
for (const g of w.coachGroups || []) g.visible = false;
for (const g of w.people?.values?.() || []) g.visible = false;
for (const h of [w.coachHalo, w.actionHalo, w.dashTrail]) if (h) h.traverse((o) => { if (o.material) o.material.visible = false; });

// Clear what stands between the camera and the cast (the starting blocks, the bunting): any mesh wholly inside a CLEAR box.
const hidden = [];
if (typeof CLEAR !== 'undefined') {
  const bb = new THREE.Box3();
  w.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    try { bb.setFromObject(o); } catch (e) { return; }
    if (bb.isEmpty()) return;
    for (const [x0, x1, y0, y1, z0, z1, top = -9] of CLEAR)
      if (bb.min.x >= x0 && bb.max.x <= x1 && bb.min.y >= y0 && bb.max.y <= y1 && bb.min.z >= z0 && bb.max.z <= z1 && bb.max.y >= top) {
        o.visible = false; hidden.push(o.name || o.geometry?.type || '?'); break;
      }
  });
}
// Cut away what is inside a CUT box from the venue's own meshes (one box: what a merged model holds, like the starting blocks).
// Before cutting: where the starting blocks stand (runs of tall hits along the strip), and the floor beside each, to patch the
// hole a cut block leaves (the floor has none under it).
const patches = [];
if (typeof CUT !== 'undefined' && CUT) {
  const [x0, x1, , , z0, z1] = CUT;
  const zm = (z0 + z1) / 2, rr = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const meshes = [];
  w.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.visible) meshes.push(o); });
  const hitAt = (x, z = zm) => { rr.set(new THREE.Vector3(x, 3.2, z), down); return rr.intersectObjects(meshes, false).filter((h) => h.point.y < 1.3)[0]; };
  let run = null;
  for (let x = x0; x <= x1; x += 0.04) {
    const h = hitAt(x), tall = h && h.point.y > 0.3;
    if (tall && !run) run = { a: x };
    if (!tall && run) { run.b = x; patches.push(run); run = null; }
  }
  for (const p of patches) {
    // the floor beside it, not a drain's metal: a few samples across the footprint, the first that is a floor
    const samples = [];
    for (const z of [-9.2, -9.45, -9.05, -8.95]) for (const x of [p.b + 0.2, p.a - 0.2, p.b + 0.4]) { const g = hitAt(x, z); if (g && g.point.y < 0.06) samples.push(g); }
    const g = samples.find((h) => !/metal|grate|drain|wall/i.test([].concat(h.object.material)[0]?.name || '')) || samples[0];
    p.mat = g ? [].concat(g.object.material)[0] : null;
    p.y = g ? g.point.y : 0;
    // the floor's colour there: the texture (an atlas, so never mapped whole) read at the hit's uv, times the material's colour
    p.color = new THREE.Color(1, 1, 1);
    try {
      const img = p.mat?.map?.image;
      if (img && g.uv) {
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const u = g.uv.clone(); p.mat.map.transformUv(u);
        const px = Math.floor(u.x * (img.width - 1)), py = Math.floor(u.y * (img.height - 1));
        const d = cx.getImageData(Math.max(0, px - 2), Math.max(0, py - 2), 5, 5).data;
        let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        p.color.setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
      }
    } catch (e) { p.err = String(e).slice(0, 80); }
    if (p.mat?.color) p.color.multiply(p.mat.color);
  }
}
if (typeof CUT !== 'undefined' && CUT) {
  const [x0, x1, y0, y1, z0, z1] = CUT;
  const planes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), x0), new THREE.Plane(new THREE.Vector3(1, 0, 0), -x1),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), y0), new THREE.Plane(new THREE.Vector3(0, 1, 0), -y1),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), z0), new THREE.Plane(new THREE.Vector3(0, 0, 1), -z1),
  ];
  (w.renderer || w.r).localClippingEnabled = true;
  w.scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of [].concat(o.material)) { m.clippingPlanes = planes; m.clipIntersection = true; m.needsUpdate = true; }
  });
}
for (const p of patches) {
  if (!p.mat || p.b - p.a > 2.5) continue;
  const m = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.mat.roughness ?? 0.8, metalness: 0 });
  const z0 = -8.64, z1 = -9.6; // the blocks and their trims
  const geo = new THREE.PlaneGeometry(p.b - p.a + 0.1, Math.abs(z1 - z0));
  const q = new THREE.Mesh(geo, m);
  q.rotation.x = -Math.PI / 2;
  q.position.set((p.a + p.b) / 2, p.y + 0.002, (z0 + z1) / 2);
  q.receiveShadow = true;
  w.scene.add(q);
}
const root = new THREE.Group();
root.name = 'poster-cast';
w.scene.add(root);
const f = [Math.sin(A), Math.cos(A)], r = [Math.cos(A), -Math.sin(A)];
const at = (lx, lz) => [C[0] + r[0] * lx + f[0] * lz, C[1] + r[1] * lx + f[1] * lz];
const ray = new THREE.Raycaster();
const floorMeshes = [];
w.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.visible) floorMeshes.push(o); });
// what stands in a region (to find what to clear)
const probe = [];
if (typeof PROBE !== 'undefined') {
  const bb = new THREE.Box3();
  w.scene.traverse((o) => {
    if (!o.isMesh) return;
    try { bb.setFromObject(o); } catch (e) { return; }
    const [x0, x1, y0, y1, z0, z1] = PROBE;
    if (bb.max.x < x0 || bb.min.x > x1 || bb.max.y < y0 || bb.min.y > y1 || bb.max.z < z0 || bb.min.z > z1) return;
    const sz = bb.getSize(new THREE.Vector3());
    if (sz.x > 60 || sz.z > 60) return;
    probe.push([o.name || o.type, (o.isInstancedMesh ? 'inst' + o.count : '') + ':' + [].concat(o.material).map((m) => m.type + '/' + m.name + '/' + (m.clippingPlanes ? m.clippingPlanes.length : 0)).join('|'), ...[bb.min.x, bb.max.x, bb.min.y, bb.max.y, bb.min.z, bb.max.z].map((v) => +v.toFixed(2))]);
  });
}
const floorAt = (x, z) => {
  if (typeof FLOOR === 'number') return FLOOR;
  ray.set(new THREE.Vector3(x, 3.2, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObjects(floorMeshes, false)
    .filter((h) => h.object.isMesh && h.object.visible && h.face && h.face.normal.y > 0.5 && h.point.y < 1.2 && h.point.y > -0.5);
  return hits.length ? hits[0].point.y : 0;
};
const report = [];
const floors = [];
if (typeof FLOORPROBE !== 'undefined') for (const x of FLOORPROBE.xs) for (let z = FLOORPROBE.z0; z >= FLOORPROBE.z1; z -= 0.15) {
  ray.set(new THREE.Vector3(x, 3.2, z), new THREE.Vector3(0, -1, 0));
  const h = ray.intersectObjects(floorMeshes, false).filter((h) => h.face && h.face.normal.y > 0.5 && h.point.y < 1.2)[0];
  floors.push([x, +z.toFixed(2), h ? +h.point.y.toFixed(3) : null, h ? (h.object.name || h.object.type).slice(0, 18) : '']);
}
await Promise.all(CAST.map((c) => load(c.f)).concat(CAST.filter((c) => c.src).map((c) => load(c.src))));
let chairT = null;
if (CAST.some((c) => c.chair)) chairT = await load('props/wheelchair.glb');
for (const c of CAST) {
  const g = await load(c.f);
  const model = clone(g.scene);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const holder = new THREE.Group();
  holder.add(model);
  root.add(holder);
  const [x, z] = at(c.x, c.z);
  holder.position.set(x, 0, z);
  holder.rotation.y = A + (c.turn || 0);
  if (c.s) holder.scale.setScalar(c.s);
  if (c.rx) model.rotation.x = c.rx;
  if (c.rz) model.rotation.z = c.rz;
  // the pose
  const src = c.src ? await load(c.src) : g;
  const clip = src.animations.find((a) => a.name === c.clip) || g.animations.find((a) => a.name === c.clip);
  const mixer = new THREE.AnimationMixer(model);
  if (clip) {
    const act = mixer.clipAction(clip);
    act.play();
    act.time = (c.t || 0) * clip.duration;
    mixer.update(0);
  }
  model.updateMatrixWorld(true);
  // the face
  let face = null;
  if (c.face) {
    face = new CoachFace(model, () => 0.5);
    if (face.ok) { face.set(c.face, true); face.update(0, { still: true }); if (c.gaze) { face.gaze = c.gaze; face.apply(0, true); } }
  }
  // stand on the floor (the lowest point of the posed mesh), or float `y` above it
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const fy = floorAt(x, z);
  holder.position.y = (c.ground === false ? fy - (box.min.y - holder.position.y) * 0 : fy - box.min.y) + (c.y || 0);
  if (c.ground === false) holder.position.y = fy + (c.y || 0);
  // a wheelchair under a sitting senior
  if (c.chair && chairT) {
    const ch = chairT.scene.clone(true);
    const b = new THREE.Box3().setFromObject(ch), size = b.getSize(new THREE.Vector3()), k = 0.94 / size.y;
    const cen = b.getCenter(new THREE.Vector3());
    const inner = new THREE.Group();
    ch.position.set(-cen.x, -b.min.y, -cen.z);
    inner.add(ch);
    inner.scale.setScalar(k);
    inner.rotation.y = -Math.PI / 2;
    const outer = new THREE.Group();
    outer.add(inner);
    const ang = A + (c.turn || 0);
    outer.position.set(x - Math.sin(ang) * 0.16, fy + (c.y || 0), z - Math.cos(ang) * 0.16);
    outer.rotation.y = ang;
    outer.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    root.add(outer);
  }
  const hb = new THREE.Box3().setFromObject(model, true);
  report.push([c.id || c.f, +x.toFixed(2), +z.toFixed(2), +hb.min.y.toFixed(2), +hb.max.y.toFixed(2), clip ? c.clip : 'NO CLIP ' + c.clip, face ? face.ok : '-']);
}
// A studio of their own (the stacked posters): the venue unseen (the camera sees layer 1 only, where the cast and its own
// lights are), a gradient behind them.
if (typeof STUDIO !== 'undefined' && STUDIO) {
  const L = (o) => { o.layers.set(1); root.add(o); return o; };
  L(new THREE.HemisphereLight(0xf4f8ff, 0xffe2c4, STUDIO.hemi ?? 1.4));
  const key = L(new THREE.DirectionalLight(0xfff3e2, STUDIO.key ?? 2.6));
  const [cx, cz] = C;
  key.position.set(cx - 5, 9, cz + 9);
  key.target.position.set(cx, 1.8, cz);
  root.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -3, near: 1, far: 40 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const fill = L(new THREE.DirectionalLight(0xdbe9ff, STUDIO.fill ?? 0.9));
  fill.position.set(cx + 6, 3, cz + 8); fill.target.position.set(cx, 1.5, cz); root.add(fill.target);
  const rim = L(new THREE.DirectionalLight(0xbfe6ff, STUDIO.rim ?? 1.6));
  rim.position.set(cx + 2, 6, cz - 10); rim.target.position.set(cx, 1.5, cz); root.add(rim.target);
  root.traverse((o) => o.layers.set(1));
  w.camera.layers.set(1);
  // the background: a vertical gradient or a glow from the middle
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const g = cv.getContext('2d');
  let grad;
  if (STUDIO.bg === 'radial') {
    grad = g.createRadialGradient(512, 600, 40, 512, 560, 760);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.35, '#e6f6ff'); grad.addColorStop(0.7, '#3fb4ff'); grad.addColorStop(1, '#0a5fd8');
  } else {
    grad = g.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#0657d6'); grad.addColorStop(0.45, '#19a8f8'); grad.addColorStop(0.8, '#bfe8ff'); grad.addColorStop(1, '#ffffff');
  }
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  Object.defineProperty(w.scene, 'background', { get: () => tex, set: () => {}, configurable: true });
  Object.defineProperty(w.scene, 'fog', { get: () => null, set: () => {}, configurable: true });
}
await new Promise((r) => setTimeout(r, 800));
return { patches: patches.map((p) => [+p.a.toFixed(2), +p.b.toFixed(2), +p.y.toFixed(3), p.mat?.name || '?', '#' + p.color?.getHexString(), p.err || '']), floors, probe: probe.slice(0, 40), report, hidden: hidden.length, hiddenNames: [...new Set(hidden)].slice(0, 12) };
