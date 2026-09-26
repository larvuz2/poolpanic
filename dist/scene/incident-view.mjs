// Visuals for chaos incidents: visiting characters, loose animals, hazards, blackout lighting and stunts.
// Every method is a pure view of simulation state; cosmetic motion never feeds back into gameplay.
import { THREE, COLORS } from "./kit.mjs";
import { character } from "./actors.mjs";
import { fishObject, fishNetObject } from "./props.mjs";

export class IncidentView {
  constructor(w) {
    this.w = w;
    this.visitors = new Map();
    this.fish = fishObject(w, 1.45);
    this.fish.visible = false;
    w.scene.add(this.fish);
    this.fishShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 18),
      new THREE.MeshBasicMaterial({ color: 0x0b4f5a, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.fishShadow.rotation.x = -Math.PI / 2;
    this.fishShadow.scale.set(0.7, 1.4, 1);
    w.scene.add(this.fishShadow);
    this.lastDart = 0;
  }
  // Global light multipliers (1 = normal). Blackouts dim the water and caustics.
  lightLevel() {
    return { water: 1, caustic: 1 };
  }
  sync(sim, time, dt) {
    this.syncVisitors(sim, time);
    this.syncFish(sim, time);
    if (this.w.fishNetRack) this.w.fishNetRack.visible = sim.fishNet?.state !== "coach";
  }

  // ------------------------------------------------------------------------------------------------------
  syncVisitors(sim, time) {
    const alive = new Set();
    for (const v of sim.visitors || []) {
      alive.add(v.id);
      let g = this.visitors.get(v.id);
      if (!g) {
        g = character(this.w, v);
        this.visitors.set(v.id, g);
        this.w.scene.add(g);
      }
      if (v.kind === "kid") this.poseKid(sim, v, g, time);
    }
    for (const [id, g] of this.visitors)
      if (!alive.has(id)) {
        this.w.clickables = this.w.clickables.filter((x) => x !== g.userData.hit);
        g.removeFromParent();
        this.visitors.delete(id);
      }
  }
  poseKid(sim, v, g, time) {
    const u = g.userData,
      reduced = this.w.reducedMotion.matches;
    g.position.set(v.x, 0, v.z);
    g.rotation.set(0, v.angle || 0, 0);
    u.root.rotation.set(0, 0, 0);
    u.root.position.set(0, 0, 0);
    const walking =
      ["entering", "walking", "sulking", "happy", "leaving", "dodging"].includes(v.status) && v.hold <= 0;
    const tempo = time * (v.status === "happy" ? 13 : v.status === "dodging" ? 16 : 10);
    u.legs.forEach((l, i) => (l.rotation.x = walking ? Math.sin(tempo + i * Math.PI) * 0.6 : 0));
    u.root.position.y = walking ? Math.abs(Math.sin(tempo)) * 0.05 : 0;
    // Both arms hug the bucket while carrying the fish.
    u.arms.forEach((a, i) =>
      a.rotation.set(
        v.hasFish ? -1.25 : Math.sin(tempo + i * Math.PI) * 0.4,
        0,
        v.hasFish ? (i ? -0.35 : 0.35) : 0,
      ),
    );
    const bucket = u.kidBucket;
    bucket.visible = v.hasFish || v.status === "crying";
    bucket.rotation.set(0, 0, 0);
    const fish = bucket.getObjectByName("bucket-fish");
    fish.visible = v.hasFish;
    const tail = fish.getObjectByName("fish-tail");
    if (tail) tail.rotation.y = reduced ? 0 : Math.sin(time * 12) * 0.5;
    if (v.status === "dumping") {
      const t = 1 - Math.max(0, v.dumpTime) / 1;
      bucket.rotation.x = t * 1.9;
      u.root.rotation.x = t * 0.25;
    }
    if (v.status === "crying") {
      bucket.position.set(0.35, 0.18, 0.35);
      bucket.rotation.set(0, 0, 1.3);
      u.arms.forEach((a, i) => a.rotation.set(-2.2, 0, i ? 0.55 : -0.55));
      u.root.position.y = reduced ? 0 : Math.abs(Math.sin(time * 9)) * 0.03;
      u.root.rotation.z = reduced ? 0 : Math.sin(time * 14) * 0.04;
    } else bucket.position.set(0, 0.85, 0.42);
    if (v.status === "happy") {
      u.arms.forEach((a, i) => a.rotation.set(-1.25, 0, i ? -0.35 : 0.35));
      u.root.position.y += reduced ? 0 : Math.abs(Math.sin(time * 8)) * 0.18;
    }
    if (v.status === "sulking") u.root.rotation.x = 0.18;
  }

  syncFish(sim, time) {
    const f = sim.fish,
      w = this.w,
      reduced = w.reducedMotion.matches;
    const loose = f?.stage === "loose";
    this.fish.visible = loose;
    this.fishShadow.visible = loose;
    if (!loose) return;
    const leap = f.leap > 0 && !reduced ? Math.sin((1 - f.leap / 0.55) * Math.PI) : 0;
    this.fish.position.set(f.x, -0.32 + leap * 1.25 + (reduced ? 0 : Math.sin(time * 3) * 0.03), f.z);
    this.fish.rotation.set(-leap * 0.6, f.heading || 0, reduced ? 0 : Math.sin(time * 9) * 0.12);
    const body = this.fish.getObjectByName("fish-body"),
      tail = this.fish.getObjectByName("fish-tail");
    const speed = Math.hypot(f.vx, f.vz);
    if (tail) tail.rotation.y = reduced ? 0 : Math.sin(time * (8 + speed * 5)) * (0.35 + speed * 0.08);
    if (body) body.rotation.y = reduced ? 0 : Math.sin(time * (8 + speed * 5) + 1) * 0.08;
    this.fishShadow.position.set(f.x, -1.31, f.z);
    this.fishShadow.rotation.z = -(f.heading || 0);
    if (f.burst > 0 && time - this.lastDart > 0.25) {
      this.lastDart = time;
      w.splash(f.x, -0.15, f.z, 8);
    }
    if (leap > 0.9 && Math.random() < 0.2) w.splash(f.x, -0.1, f.z, 4, true);
  }

  // Swimmer poses owned by incidents (fleeing, leaping out of the pool).
  pose(sim, p, g, time) {
    const u = g.userData;
    if (p.status === "fleeing" && p.fleePhase === "leap") {
      const t = p.leapT || 0,
        arc = Math.sin(t * Math.PI);
      g.position.y = -0.39 * (1 - t) + arc * 1.1;
      u.root.rotation.set((Math.PI / 2) * (1 - t) - arc * 0.4, 0, 0);
      u.root.position.set(0, 0.27 * (1 - t), -0.65 * (1 - t));
      u.root.scale.setScalar(u.baseScale || 1);
      u.arms.forEach((a, i) => a.rotation.set(-2.6, 0, i ? -0.5 : 0.5));
      u.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * Math.PI * 2 + i) * 0.6));
      u.shadow.visible = false;
    }
  }
  poseCoach(sim, cu) {
    const c = sim.coach;
    if (c.carry === "fishnet") {
      const fish = cu.carry.getObjectByName("net-fish");
      if (fish) fish.visible = !!c.netLoaded;
      if (!c.swimming && !c.waterTransition) {
        cu.carry.position.set(0.45, 1.05, 0.1);
        cu.carry.rotation.set(-0.35, 0, 0);
        cu.arms[1].rotation.set(-0.8, 0, 0);
      }
    }
  }
  carryModel(kind) {
    if (kind === "fishnet") return fishNetObject(this.w);
    return null;
  }
}
