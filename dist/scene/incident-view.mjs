// Visuals for chaos incidents: visiting characters, loose animals, hazards, blackout lighting and stunts.
// Every method is a pure view of simulation state; cosmetic motion never feeds back into gameplay.
import { THREE, COLORS } from "./kit.mjs";
import { character, dogObject } from "./actors.mjs";
import { CARL_TUNING } from "../incidents/carl.mjs";
import { guidanceState } from "../guidance.mjs";
import {
  fishObject,
  fishNetObject,
  finsObject,
  treatsObject,
  flashlightObject,
  medkitObject,
} from "./props.mjs";

const hash = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

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
    this.puddles = new Map();
    this.puddleMat = new THREE.MeshStandardMaterial({
      color: 0x8fd8e6,
      transparent: true,
      opacity: 0.55,
      roughness: 0.04,
      metalness: 0.2,
      depthWrite: false,
    });
    // Blackout rig: flashlight cone on the coach, flicker state and lightning.
    this.flashlight = new THREE.SpotLight(0xfff1c8, 0, 16, 0.55, 0.45, 1.2);
    this.flashlight.target = new THREE.Object3D();
    w.scene.add(this.flashlight, this.flashlight.target);
    this.flash = 0;
    this.nextLightning = 3;
    this.light = 1;
    // Door beacons shown while leading the dog out.
    this.doorBeacons = [-1, 1].map((side) => {
      const m = w.decal(w.glowMap, 2.4, 2.4, 0x9dff9a, 0, true);
      m.rotation.x = -Math.PI / 2;
      m.position.set(side * w.venue.arrival.outsideX, 0.05, w.venue.arrival.doorZ);
      w.scene.add(m);
      return m;
    });
    this.waveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.1, 48),
      new THREE.MeshBasicMaterial({
        color: 0xe6fffa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.waveRing.rotation.x = -Math.PI / 2;
    this.waveRing.position.y = -0.2;
    w.scene.add(this.waveRing);
    this.wave = null;
    this.dizzy = new Map();
    this.dizzyGeo = new THREE.OctahedronGeometry(0.075, 0);
    this.dizzyMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    if (w.venue.trampoline) this.buildSplashZone(w.venue.trampoline);
  }
  // Orange-and-white floats and a landing target mark the part of the lane the trampoline lands in.
  buildSplashZone(tr) {
    const w = this.w,
      x = w.venue.lanes[tr.lane],
      group = new THREE.Group();
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, tr.zone * 2),
      new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.07, depthWrite: false }),
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(x, -0.16, tr.landZ);
    group.add(zone);
    const geo = new THREE.SphereGeometry(0.13, 10, 8),
      zs = [];
    for (let z = tr.landZ - tr.zone; z <= tr.landZ + tr.zone + 1e-6; z += 0.4) zs.push(z);
    [0xff6a2b, 0xfff4e6].forEach((color, k) => {
      const list = zs.filter((_, i) => i % 2 === k),
        mesh = new THREE.InstancedMesh(geo, w.mat(color, { roughness: 0.35 }), list.length * 2),
        dummy = new THREE.Object3D();
      let n = 0;
      for (const side of [-1, 1])
        for (const z of list) {
          dummy.position.set(x + side * 1.6, -0.18, z);
          dummy.scale.set(1.05, 0.95, 1.3);
          dummy.updateMatrix();
          mesh.setMatrixAt(n++, dummy.matrix);
        }
      mesh.castShadow = true;
      group.add(mesh);
    });
    const target = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.92, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    target.rotation.x = -Math.PI / 2;
    target.position.set(x, -0.155, tr.landZ);
    group.add(target);
    w.scene.add(group);
    // Glowing spot at the foot of the stairs while a daredevil is selected.
    const cue = w.decal(w.glowMap, 2.6, 2.6, 0xffd24d, 0, true);
    cue.rotation.x = -Math.PI / 2;
    cue.position.set(tr.stairBottomX, 0.05, tr.z);
    w.scene.add(cue);
    this.splashZone = { zone, target, cue };
  }
  // Light multipliers for this frame (1 = normal). Blackouts dim everything; the flicker stutters.
  lightLevel(sim, time) {
    const o = sim.outage;
    let k = 1;
    if (o?.stage === "flicker") {
      const beat = Math.floor(time * 11);
      k = hash(beat) < 0.3 + (1 - o.t / 7) * 0.4 ? 0.28 + hash(beat + 7) * 0.3 : 1;
    } else if (o?.stage === "dark") k = 0.1;
    else if (o?.stage === "restored") k = Math.min(1, 0.1 + (1.2 - o.t) * 1.5);
    if (this.flash > 0) k = Math.max(k, 1.6 * this.flash);
    this.light = k;
    return { water: Math.max(0.18, Math.min(1, k)), caustic: Math.max(0.12, Math.min(1, k)) };
  }
  sync(sim, time, dt) {
    const w = this.w;
    this.syncVisitors(sim, time, dt);
    this.syncFish(sim, time);
    this.syncPuddles(sim);
    this.syncOutage(sim, time, dt);
    this.syncSplashZone(sim, time);
    this.syncDizzy(sim, time);
    if (w.fishNetRack) w.fishNetRack.visible = sim.fishNet?.state !== "coach";
    if (w.flashlightRack) w.flashlightRack.visible = sim.flashlight?.state !== "coach";
    if (w.medkitRack) w.medkitRack.visible = sim.coach.carry !== "medkit";
    const leading = sim.dog?.stage === "following";
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    for (const b of this.doorBeacons) b.material.opacity = leading ? 0.35 + pulse * 0.35 : 0;
    if (this.wave) {
      this.wave.t += dt;
      const t = this.wave.t / 1.4;
      this.waveRing.visible = t < 1;
      this.waveRing.position.set(this.wave.x, -0.2, this.wave.z);
      this.waveRing.scale.setScalar(1 + t * 5.5);
      this.waveRing.material.opacity = (1 - t) * 0.55;
      if (t >= 1) this.wave = null;
    } else this.waveRing.visible = false;
  }
  syncSplashZone(sim, time) {
    const z = this.splashZone;
    if (!z) return;
    const j = sim.get(sim.jumper),
      armed = !!j && ["waiting", "climbing", "boarding", "bouncing", "flying"].includes(j.jumpStage),
      urgent = armed && (j.jumpStage !== "waiting" || j.jumpPatience < 5),
      pulse = this.w.reducedMotion.matches ? 0.5 : 0.5 + 0.5 * Math.sin(time * (urgent ? 11 : 5));
    z.zone.material.opacity = armed ? 0.14 + pulse * (urgent ? 0.26 : 0.14) : 0.07;
    z.target.material.opacity = armed ? 0.35 + pulse * 0.45 : 0.18;
    z.target.material.color.set(urgent ? 0xff5a2b : 0xffffff);
    z.target.scale.setScalar(armed ? 1 + pulse * 0.14 : 1);
    if (this.w.trampolineBed && j?.jumpStage !== "bouncing") this.w.trampolineBed.position.y = 0;
    z.cue.material.opacity = guidanceState(sim).trampoline ? 0.35 + pulse * 0.45 : 0;
  }
  // Little stars circling the heads of swimmers hurt in a trampoline crash.
  syncDizzy(sim, time) {
    const alive = new Set(),
      head = new THREE.Vector3(),
      reduced = this.w.reducedMotion.matches;
    for (const p of sim.people) {
      if (p.problem !== "injured" || !["swim", "injured", "exit"].includes(p.status)) continue;
      const g = this.w.people.get(p.id);
      if (!g) continue;
      alive.add(p.id);
      let stars = this.dizzy.get(p.id);
      if (!stars) {
        stars = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(this.dizzyGeo, this.dizzyMat);
          const a = (i / 3) * Math.PI * 2;
          m.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
          stars.add(m);
        }
        this.w.scene.add(stars);
        this.dizzy.set(p.id, stars);
      }
      g.userData.head.getWorldPosition(head);
      stars.position.set(head.x, head.y + 0.42, head.z);
      stars.rotation.y = reduced ? 0 : time * 3.4;
      stars.children.forEach((m, i) => (m.position.y = reduced ? 0 : Math.sin(time * 5 + i * 2) * 0.05));
    }
    for (const [id, stars] of this.dizzy)
      if (!alive.has(id)) {
        stars.removeFromParent();
        this.dizzy.delete(id);
      }
  }
  // Big expanding ring on the water (cannonball).
  ripple(x, z) {
    this.wave = { x, z, t: 0 };
  }
  // Lightning during blackouts; returns true once per strike so the app can play thunder.
  consumeLightning() {
    const struck = this.struck;
    this.struck = false;
    return struck;
  }

  // ------------------------------------------------------------------------------------------------------
  syncVisitors(sim, time) {
    const alive = new Set();
    for (const v of sim.visitors || []) {
      alive.add(v.id);
      let g = this.visitors.get(v.id);
      if (!g) {
        g = v.kind === "dog" ? dogObject(this.w) : character(this.w, v);
        // Clicking a visitor walks the coach over (or acts, when already in reach).
        g.userData.hit.userData = { kind: "visitor", id: v.id };
        if (!this.w.clickables.includes(g.userData.hit)) this.w.clickables.push(g.userData.hit);
        this.visitors.set(v.id, g);
        this.w.scene.add(g);
      }
      if (v.kind === "kid") this.poseKid(sim, v, g, time);
      else if (v.kind === "dog") this.poseDog(sim, v, g, time);
      else if (v.kind === "carl") this.poseCarl(sim, v, g, time);
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

  poseDog(sim, v, g, time) {
    const u = g.userData,
      w = this.w,
      d = sim.dog,
      reduced = w.reducedMotion.matches;
    const inWater = ["swim", "paddle"].includes(v.status);
    const moving =
      ["entering", "zoom", "carry", "steal", "bowl", "to-edge", "following", "leaving"].includes(v.status) &&
      (v.path?.length || 0) > 0;
    let y = 0;
    if (v.status === "leap") y = Math.sin(v.leapT * Math.PI) * 0.9 - 0.55 * v.leapT;
    else if (v.status === "climb") y = Math.sin(v.leapT * Math.PI) * 0.6 - 0.55 * (1 - v.leapT);
    else if (inWater) y = -0.55;
    else if (!w.venue.isDeck(v.x, v.z, sim.level, 0.05)) y = reduced ? 0 : 0.5; // hop over furniture
    g.position.set(v.x, y, v.z);
    g.rotation.set(0, v.angle || 0, 0);
    const tempo = time * (moving ? 19 : 7);
    u.root.rotation.set(0, 0, 0);
    u.root.position.set(0, moving && !reduced ? Math.abs(Math.sin(tempo)) * 0.08 : 0, 0);
    u.legs.forEach((l, i) => {
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      l.rotation.x = moving || inWater ? Math.sin(tempo + phase) * (inWater ? 0.7 : 0.85) : 0;
    });
    u.tail.rotation.z = reduced ? 0 : Math.sin(time * (v.status === "following" ? 24 : 13)) * 0.65;
    u.head.rotation.set(v.status === "sniff" ? 0.5 + Math.sin(time * 9) * 0.1 : moving ? -0.1 : 0, 0, 0);
    u.tongue.visible = moving || v.status === "following" || v.status === "sniff";
    u.ears.forEach((e, i) => (e.rotation.x = moving && !reduced ? Math.sin(tempo * 0.5 + i) * 0.4 - 0.3 : 0));
    if (v.status === "shake" && !reduced) {
      u.root.rotation.z = Math.sin(time * 42) * 0.38;
      if (Math.random() < 0.6) w.splash(v.x, 0.6, v.z, 2, true);
    }
    if (v.status === "following" && !moving) {
      u.root.rotation.x = -0.35;
      u.legs[0].rotation.x = u.legs[2].rotation.x = -1.1;
    }
    if (inWater && !reduced && Math.random() < 0.15) w.splash(v.x, -0.15, v.z, 2, true);
    u.shadow.visible = !inWater && y < 0.1;
    const carry = d?.carry?.type || null;
    if (u.carryKind !== carry) {
      u.mouth.clear();
      u.carryKind = carry;
      if (carry === "fins") {
        const f = finsObject(w);
        f.scale.setScalar(0.7);
        f.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        u.mouth.add(f);
      } else if (carry === "goggles") {
        w.box(0.4, 0.1, 0.12, COLORS.navy, 0, 0, 0, 0.03, u.mouth);
        for (const x of [-0.11, 0.11]) w.box(0.13, 0.09, 0.03, 0xbfe8db, x, 0, 0.07, 0.02, u.mouth);
      }
    }
  }
  poseCarl(sim, v, g, time) {
    const u = g.userData,
      reduced = this.w.reducedMotion.matches;
    g.position.set(v.x, 0, v.z);
    g.rotation.set(0, v.angle || 0, 0);
    u.root.rotation.set(0, 0, 0);
    u.root.position.set(0, 0, 0);
    u.shadow.visible = true;
    const running =
      ["walking", "running", "charge", "carded", "leaving"].includes(v.status) ||
      (v.status === "entering" && v.hold <= 0);
    const tempo = time * (v.status === "charge" ? 21 : v.status === "running" ? 15 : 10);
    u.legs.forEach((l, i) => l.rotation.set(running ? Math.sin(tempo + i * Math.PI) * 0.75 : 0, 0, 0));
    u.arms.forEach((a, i) => a.rotation.set(running ? Math.sin(tempo + (i + 1) * Math.PI) * 0.85 : 0, 0, 0));
    if (running && !reduced) u.root.position.y = Math.abs(Math.sin(tempo)) * 0.07;
    switch (v.status) {
      case "windup": {
        u.root.position.y = -0.08;
        u.arms.forEach((a, i) => a.rotation.set(0.6, 0, (i ? -1 : 1) * 1.25));
        u.legs.forEach((l, i) => (l.rotation.x = reduced ? 0 : Math.sin(time * 14 + i * Math.PI) * 0.45));
        break;
      }
      case "charge":
        u.root.rotation.x = 0.35;
        break;
      case "flying": {
        const t = 1 - v.timer / CARL_TUNING.flight;
        g.position.y = Math.sin(t * Math.PI) * 2.6 - t * 0.5;
        u.root.rotation.x = reduced ? 0.6 : t * Math.PI * 1.15;
        u.root.position.y = 0.55;
        u.legs.forEach((l) => l.rotation.set(-2.15, 0, 0));
        u.arms.forEach((a, i) => a.rotation.set(-1.7, 0, i ? 0.55 : -0.55));
        u.shadow.visible = false;
        break;
      }
      case "floating": {
        g.position.y = -0.46 + (reduced ? 0 : Math.sin(time * 3) * 0.05);
        u.root.rotation.x = -Math.PI / 2;
        u.root.position.set(0, 0.2, 0.5);
        u.arms.forEach((a, i) =>
          a.rotation.set(0, 0, (i ? -1 : 1) * (1.35 + (reduced ? 0 : Math.sin(time * 5 + i) * 0.15))),
        );
        u.legs.forEach((l, i) => (l.rotation.z = i ? -0.45 : 0.45));
        u.shadow.visible = false;
        break;
      }
      case "swimming": {
        g.position.y = -0.39;
        u.root.rotation.x = Math.PI / 2;
        u.root.position.set(0, 0.27, -0.65);
        u.arms.forEach((a, i) => a.rotation.set(Math.sin(time * 9 + i * Math.PI) * 1.4, 0, 0));
        u.shadow.visible = false;
        break;
      }
      case "climbing": {
        const t = 1 - v.timer / CARL_TUNING.climb;
        g.position.y = -0.39 * (1 - t);
        u.root.rotation.x = (Math.PI / 2) * (1 - t);
        u.root.position.set(0, 0.27 * (1 - t), -0.65 * (1 - t));
        u.arms.forEach((a) => a.rotation.set(-1.5 * (1 - t), 0, 0));
        break;
      }
      case "carded":
        u.root.rotation.x = 0.22;
        break;
      case "waiting":
        u.arms.forEach((a, i) => a.rotation.set(-1.2, 0, i ? 0.9 : -0.9));
        u.legs[0].rotation.x = reduced ? 0 : Math.max(0, Math.sin(time * 9)) * -0.25;
        break;
    }
  }
  syncPuddles(sim) {
    const w = this.w,
      alive = new Set();
    this.puddleGeo ||= new THREE.CircleGeometry(1, 28);
    for (const h of sim.hazards || []) {
      if (h.kind !== "puddle") continue;
      alive.add(h.id);
      let m = this.puddles.get(h.id);
      if (!m) {
        m = new THREE.Mesh(this.puddleGeo, this.puddleMat);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = h.id;
        m.receiveShadow = true;
        w.scene.add(m);
        this.puddles.set(h.id, m);
      }
      const k = Math.min(1, h.life / 3 + 0.4);
      m.position.set(h.x, 0.014, h.z);
      m.scale.set(h.r * k, h.r * k * 0.78, 1);
    }
    for (const [id, m] of this.puddles)
      if (!alive.has(id)) {
        m.removeFromParent();
        this.puddles.delete(id);
      }
  }
  syncOutage(sim, time, dt) {
    const w = this.w,
      o = sim.outage,
      k = this.light,
      base = w.baseLight;
    w.hemi.intensity = base.hemi * Math.min(1.35, k);
    w.sun.intensity = base.sun * Math.min(1.35, k);
    w.fill.intensity = base.fill * Math.min(1.35, k);
    w.scene.environmentIntensity = base.env * Math.max(0.12, Math.min(1, k));
    const dark = o?.stage === "dark";
    w.emergency.intensity = dark ? 0.36 + 0.08 * Math.sin(time * 3) : 0;
    this.flash = Math.max(0, this.flash - dt * 4);
    if (dark && !w.reducedMotion.matches) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.flash = 1;
        this.struck = true;
        this.nextLightning = 4 + hash(time) * 5;
      }
    }
    const stormy = o && o.stage !== "restored";
    for (const glass of w.windowGlass || [])
      glass.material.color.setScalar(stormy ? Math.min(1, 0.22 + this.flash) : 1);
    if (w.poolLamps)
      w.poolLamps.material.color.copy(w.poolLamps.base).multiplyScalar(Math.max(0.06, Math.min(1, k)));
    if (w.stringLights)
      w.stringLights.visible = w.lightingName !== "day" && !(dark || (o?.stage === "flicker" && k < 0.9));
    const c = sim.coach,
      on = c.carry === "flashlight" && k < 0.95;
    this.flashlight.intensity = on ? 70 : 0;
    if (on) {
      const fx = Math.sin(c.angle || 0),
        fz = Math.cos(c.angle || 0);
      this.flashlight.position.set(c.x + fx * 0.4, (c.y || 0) + 1.3, c.z + fz * 0.4);
      this.flashlight.target.position.set(c.x + fx * 4.5, 0, c.z + fz * 4.5);
      this.flashlight.target.updateMatrixWorld();
    }
    if (w.fuseSparks) {
      const beat = Math.floor(time * 14);
      w.fuseSparks.material.opacity = stormy ? hash(beat) * 0.95 : 0;
      w.fuseLight.intensity = stormy ? hash(beat + 3) * 4 : 0;
    }
    if (w.fuseLever)
      w.fuseLever.rotation.z = dark
        ? 2.5
        : c.busy?.kind === "breaker"
          ? 2.5 * (1 - c.busy.t / c.busy.duration)
          : 0;
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

  // Swimmer poses owned by incidents (fleeing, trampoline stunts, crash victims lying on the deck).
  pose(sim, p, g, time) {
    const u = g.userData;
    u.shadow.scale.set(1, 1, 1);
    u.shadow.position.z = 0;
    if (p.status === "trampoline") this.poseJumper(sim, p, g, time);
    else if (p.status === "injured") this.poseInjured(sim, p, g, time);
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
  poseJumper(sim, p, g, time) {
    const u = g.userData,
      tr = sim.venue.trampoline,
      stage = p.jumpStage,
      motion = this.w.reducedMotion.matches ? 0 : 1;
    if (!tr || !stage || stage === "toStairs") return;
    const y = p.y || 0,
      { arms, legs } = u;
    g.position.y = y;
    u.shadow.visible = y < 0.05;
    u.hit.position.y = 0.9;
    if (stage === "waiting") {
      // Warming up at the foot of the stairs; frantic once patience runs low.
      const urgent = p.jumpPatience < 5,
        hop = Math.abs(Math.sin(time * (urgent ? 11 : 6))) * motion;
      u.root.position.y = hop * (urgent ? 0.13 : 0.05);
      arms.forEach((a, i) =>
        a.rotation.set(
          urgent
            ? -2.8 + Math.sin(time * 12 + i * Math.PI) * 0.35 * motion
            : -((time * 7 + i * Math.PI) % (Math.PI * 2)) * motion - 0.2,
          0,
          i ? -0.18 : 0.18,
        ),
      );
      legs.forEach(
        (l, i) =>
          (l.rotation.x = urgent ? Math.max(0, Math.sin(time * 11 + i * Math.PI)) * -0.4 * motion : 0),
      );
    } else if (stage === "climbing") {
      const k = time * 9 * motion;
      u.root.rotation.x = 0.18;
      u.root.position.y = Math.abs(Math.sin(k)) * 0.05;
      legs.forEach((l, i) => (l.rotation.x = Math.sin(k + i * Math.PI) * 0.55 - 0.25));
      arms.forEach((a, i) => a.rotation.set(-0.9 + Math.sin(k + i * Math.PI) * 0.35, 0, 0));
    } else if (stage === "boarding") {
      const k = time * 9 * motion;
      legs.forEach((l, i) => (l.rotation.x = Math.sin(k + i * Math.PI) * 0.5));
      arms.forEach((a, i) => a.rotation.set(-1.45, 0, i ? -1.1 : 1.1));
    } else if (stage === "bouncing") {
      // The bed sags under each landing; arms swing overhead at the top of every bounce.
      const squat = Math.max(0, 1 - (y - tr.bedY) / 0.35),
        sag = squat * 0.22;
      g.position.y = y - sag;
      u.root.position.y = -squat * 0.1;
      legs.forEach((l) => (l.rotation.x = -squat * 0.5));
      arms.forEach((a, i) => a.rotation.set(squat > 0.3 ? 0.45 : -2.9, 0, i ? -0.25 : 0.25));
      if (this.w.trampolineBed) this.w.trampolineBed.position.y = -sag;
    } else if (stage === "flying") {
      // One and a half front flips around the hips, tucked in the middle, stretched into the dive.
      const t = p.jumpT || 0,
        e = t * t * (3 - 2 * t),
        theta = Math.PI * 3 * e,
        h = 0.85,
        tuck = Math.sin(Math.min(1, Math.max(0, (t - 0.12) / 0.7)) * Math.PI);
      u.root.rotation.x = theta;
      u.root.position.set(0, h * (1 - Math.cos(theta)), -h * Math.sin(theta));
      legs.forEach((l) => (l.rotation.x = -1.9 * tuck));
      arms.forEach((a, i) => a.rotation.set(-2.9 + tuck * 1.7, 0, (i ? -0.3 : 0.3) * (1 - tuck)));
    }
  }
  // Crash victims lie on their backs until the medical kit arrives, then sit up while being bandaged.
  poseInjured(sim, p, g, time) {
    const u = g.userData,
      motion = this.w.reducedMotion.matches ? 0 : 1,
      b = sim.coach.busy,
      sit = p.healing && b?.kind === "heal" ? Math.min(1, b.t / b.duration) : 0,
      theta = -Math.PI / 2 + sit * 1.1,
      h = 0.45;
    g.position.y = 0;
    if (p.path?.length) {
      // Limping clear of the edge, one hand on the sore head.
      const k = time * 6 * motion;
      u.root.rotation.set(0.14, 0, Math.sin(k) * 0.12);
      u.legs.forEach((l, i) => (l.rotation.x = Math.sin(k + i * Math.PI) * 0.35));
      u.arms[0].rotation.set(-2.5, 0, 0.55);
      u.arms[1].rotation.set(0.2, 0, -0.25);
      return;
    }
    u.root.rotation.set(theta, 0, Math.sin(time * 1.7 + u.phase) * 0.05 * motion * (1 - sit));
    u.root.position.set(0, h * (1 - Math.cos(theta)) - 0.15, -h * Math.sin(theta));
    u.legs.forEach(
      (l, i) =>
        (l.rotation.x = -Math.PI / 2 - theta + (i ? Math.sin(time * 3 + u.phase) * 0.12 * motion : 0)),
    );
    u.arms[0].rotation.set(sit ? -0.3 : 0.1, 0, sit ? 0.2 : 0.85);
    u.arms[1].rotation.set(
      sit ? -0.3 : -1.6 + Math.sin(time * 2.4 + u.phase) * 0.45 * motion,
      0,
      sit ? -0.2 : -0.3,
    );
    u.shadow.scale.set(1.1, 2.2, 1);
    u.shadow.position.z = -0.25;
    u.hit.position.y = 0.35;
  }
  poseCoach(sim, cu, time) {
    const c = sim.coach;
    if (c.carry === "flashlight" && !c.swimming) {
      cu.carry.position.set(0.28, 1.2, 0.42);
      cu.arms[1].rotation.set(-1.35, 0, 0);
    }
    if (c.busy) {
      const heal = c.busy.kind === "heal";
      cu.arms.forEach((a, i) => a.rotation.set(-1.35 + Math.sin(time * 14 + i * Math.PI) * 0.3, 0, 0));
      if (heal) {
        cu.root.position.y = -0.22;
        cu.legs.forEach((l, i) => (l.rotation.x = i ? -1.3 : 0.2));
      }
    }
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
    if (kind === "treats") return treatsObject(this.w);
    if (kind === "medkit") return medkitObject(this.w);
    if (kind === "flashlight") {
      const g = flashlightObject(this.w);
      const glow = this.w.decal(this.w.glowMap, 0.9, 0.9, 0xfff1b0, 0.7, true);
      glow.position.z = 0.4;
      g.add(glow);
      return g;
    }
    return null;
  }
}
