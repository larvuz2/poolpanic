// The wet spots and the mop on screen (incidents/wet.mjs). The mop's yellow bucket stands at `venue.fixtures.mop` in every pool,
// with the mop in it while it is not in the coach's hands; a wet spot is a glossy blue patch on the deck with a rim of light that
// breathes so it is seen, and it goes the moment it is mopped.
import { THREE } from "./kit.mjs";
import { propModel } from "./prop-models.mjs";
import { stationHit } from "./props.mjs";

const BUCKET = 0xf2c230,
  HANDLE = 0xc98a3c,
  STRANDS = 0xf4f1e6;

// The mop: a wooden handle and a head of white strands, 1.5 m. The Tripo model replaces the stand-in when it has loaded.
export function mopObject(w) {
  return propModel("mop", { height: 1.5 }, (g) => {
    w.cyl(0.025, 0.025, 1.3, HANDLE, 0, 0.85, 0, g, 8);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      w.cyl(0.03, 0.02, 0.26, STRANDS, Math.sin(a) * 0.09, 0.13, Math.cos(a) * 0.09, g, 5);
    }
    w.cyl(0.06, 0.06, 0.08, 0x6f6f6f, 0, 0.27, 0, g, 10);
  });
}

export function buildMopStation(w, venue) {
  const p = venue.fixtures.mop;
  if (!p) return;
  const g = w.group(p.x, 0, p.z, w.scene, p.angle || 0);
  (w.liveProps ||= []).push(g); // (its stand-ins give way to the models when they load: never baked into a batch)
  g.add(
    propModel("mop-bucket", { height: 0.72 }, (b) => {
      w.cyl(0.3, 0.25, 0.55, BUCKET, 0, 0.32, 0, b, 16);
      w.cyl(0.24, 0.24, 0.02, 0x7fc4e8, 0, 0.56, 0, b, 16);
      for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) w.ball(0.05, 0x2b5fd0, x, 0.05, z, b);
    }),
  );
  // The mop in its bucket (hidden while the coach has it).
  const mop = mopObject(w);
  mop.position.set(0.08, 0.2, 0);
  mop.rotation.z = -0.18;
  g.add(mop);
  w.mopRack = mop;
  stationHit(w, { kind: "fixture", item: "mop" }, p, 1.1, 1.8);
  w.labels.push({
    text: "E · MOP",
    x: p.x,
    y: 2,
    z: p.z,
    when: (s) => (s.wetSpots?.length || 0) > 0 && s.coach.carry !== "mop",
  });
}

// Every frame: a patch for each wet spot (made when it appears, gone when it is mopped), the mop in its bucket or not.
export function syncWetSpots(w, sim, time) {
  if (w.mopRack) w.mopRack.visible = sim.mopState?.state !== "coach";
  const spots = sim.wetSpots || [],
    meshes = (w.wetMeshes ||= new Map()),
    alive = new Set();
  if (!w.wetMats) {
    w.wetMats = {
      pool: new THREE.MeshStandardMaterial({
        color: 0x3f9fe8,
        transparent: true,
        opacity: 0.62,
        roughness: 0.02,
        metalness: 0.35,
        depthWrite: false,
      }),
      rim: new THREE.MeshBasicMaterial({
        color: 0xbfe9ff,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    };
    w.wetGeo = { disc: new THREE.CircleGeometry(1, 30), rim: new THREE.RingGeometry(0.92, 1.06, 36) };
  }
  const calm = w.reducedMotion?.matches;
  w.wetMats.rim.opacity = calm ? 0.55 : 0.4 + 0.3 * Math.sin(time * 4);
  for (const s of spots) {
    alive.add(s.id);
    let m = meshes.get(s.id);
    if (!m) {
      m = new THREE.Group();
      const disc = new THREE.Mesh(w.wetGeo.disc, w.wetMats.pool),
        rim = new THREE.Mesh(w.wetGeo.rim, w.wetMats.rim);
      for (const part of [disc, rim]) part.rotation.x = -Math.PI / 2;
      disc.receiveShadow = true;
      rim.position.y = 0.002;
      m.add(disc, rim);
      m.rotation.y = s.id * 1.7;
      w.scene.add(m);
      meshes.set(s.id, m);
    }
    // A fresh spot spreads out in its first half second.
    const grow = Math.min(1, (sim.time - (s.born ?? sim.time)) / 0.5 + 0.35);
    m.position.set(s.x, 0.016, s.z);
    m.scale.set(s.r * grow, 1, s.r * grow * 0.82);
  }
  for (const [id, m] of meshes)
    if (!alive.has(id)) {
      m.removeFromParent();
      meshes.delete(id);
    }
}
