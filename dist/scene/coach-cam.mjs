// Coach Cam: a physical first-person view. The camera sits at the coach's eyes and the coach's own body is
// hidden. Two cartoon forearms and whatever the coach is carrying are drawn in a second pass with their own,
// narrower field of view, so the hands read clearly without stretching the pool. The hands hang off springs
// behind the camera: they trail turns, bounce with each step, drop on jumps, squash on landings, reach for
// whatever the coach grabs and flail on a slip, while the camera itself only bobs gently.
// Pure view code: it reads simulation state and never changes it (the app mirrors `yaw` into the coach).
import { THREE } from "./kit.mjs";
import { fishObject } from "./props.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;

export const COACH_CAM = {
  hfov: 92, // horizontal field of view in degrees at 16:9; the wheel adjusts it within `hfovRange`
  hfovRange: [80, 105],
  vfov: [50, 78], // vertical limits so phones and ultrawide screens stay comfortable
  viewmodelFov: 56, // the hands' own vertical field of view
  eye: 1.52, // eye height above the coach's feet
  swimEye: 0.4, // above the swimming coach's origin (just clear of the water)
  kneel: 0.62, // how far the eyes drop while bandaging someone on the deck
  pitch: [-80 * DEG, 80 * DEG],
  startPitch: -9 * DEG,
  sensitivity: 0.0023, // radians per mouse pixel
  touchSensitivity: 0.0045,
  keyTurn: 2.4, // radians per second with ← / →
  bob: 0.016, // walking head bob in metres; hands move 2–4× more
  runBob: 0.03,
  landing: 0.9, // downward velocity kick on landing (≈ 3 cm dip)
};

// Hand rest positions in view space (camera at the origin looking down −Z): low in the frame, the centre of
// the screen left clear.
const REST = [new THREE.Vector3(-0.25, -0.235, -0.62), new THREE.Vector3(0.25, -0.225, -0.61)];
const ELBOW = [new THREE.Vector3(-0.4, -0.62, -0.2), new THREE.Vector3(0.4, -0.62, -0.2)];

// How each item sits in the hands. `grip` is the item's hand (or the midpoint of two hands) in view space;
// `offset`/`rot`/`scale` place the model relative to the grip; `hang` lets it swing like a pendulum.
const HOLDS = {
  fins: { grip: [0.25, -0.3, -0.6], offset: [0, -0.1, 0], rot: [0.25, 0.5, 0.15], scale: 0.55, hang: 0.6 },
  chlorine: {
    grip: [0.26, -0.17, -0.62],
    offset: [0, -0.13, 0],
    rot: [0.1, 0.35, 0],
    scale: 0.5,
    hang: 1,
    heavy: true,
  },
  relief: { grip: [0.23, -0.26, -0.6], offset: [0, 0.05, 0], rot: [0.25, 0, -0.1], scale: 0.36 },
  goggles: { grip: [0.2, -0.26, -0.58], offset: [0, 0.04, -0.02], rot: [0.45, 0, 0.1], scale: 0.55 },
  treats: { grip: [0.25, -0.25, -0.62], offset: [0, 0.06, 0], rot: [0.1, -0.3, 0], scale: 0.32 },
  medkit: {
    grip: [0.26, -0.17, -0.6],
    offset: [0, -0.1, 0],
    rot: [0.05, -0.3, 0],
    scale: 0.46,
    hang: 0.8,
    heavy: true,
  },
  flashlight: { grip: [0.2, -0.24, -0.62], offset: [0, 0.02, -0.05], rot: [0.08, Math.PI, 0], scale: 0.6 },
  lifering: { grip: [0, -0.36, -0.74], offset: [0, 0.02, 0], rot: [0.5, 0, 0], scale: 0.4, two: 0.21 },
  skimmer: {
    grip: [0.08, -0.26, -0.62],
    offset: [0, 0, 0.1],
    rot: [-0.14, Math.PI, 0],
    scale: 0.62,
    pole: true,
  },
  fishnet: {
    grip: [0.08, -0.26, -0.62],
    offset: [0, 0, 0.05],
    rot: [-0.12, 0, 0],
    scale: 0.62,
    pole: true,
    // With the fish in the net, the hoop comes right up to the coach's face.
    loaded: { offset: [0, 0.05, 0.95], rot: [0.16, 0, 0], scale: 0.7 },
  },
};

function springVector(state, target, k, damping, dt) {
  // Semi-implicit Euler in small steps: stable at any frame rate.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))),
    h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v.x += ((target.x - state.p.x) * k - state.v.x * damping) * h;
    state.v.y += ((target.y - state.p.y) * k - state.v.y * damping) * h;
    state.v.z += ((target.z - state.p.z) * k - state.v.z * damping) * h;
    state.p.addScaledVector(state.v, h);
  }
}
function springNumber(state, target, k, damping, dt) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))),
    h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += ((target - state.x) * k - state.v * damping) * h;
    state.x += state.v * h;
  }
}
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export class CoachCam {
  constructor(w) {
    this.w = w;
    this.yaw = Math.PI / 2;
    this.pitch = COACH_CAM.startPitch;
    this.hfov = COACH_CAM.hfov;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(COACH_CAM.viewmodelFov, 1, 0.01, 12);
    this.hemi = new THREE.HemisphereLight(0xfff4e6, 0x7a6450, 1.25);
    this.key = new THREE.DirectionalLight(0xfff0d8, 1.9);
    this.key.position.set(0.9, 1.5, 0.35);
    this.torch = new THREE.PointLight(0xfff1c8, 0, 1.6, 1.5);
    this.scene.add(this.hemi, this.key, this.torch);
    this.arms = [this.buildArm(-1), this.buildArm(1)];
    this.item = new THREE.Group();
    this.scene.add(this.item);
    this.card = w.box(0.12, 0.17, 0.012, 0xe23b2e, 0, 0.1, 0, 0.01, this.arms[1].hand);
    this.card.visible = false;
    this.hands = REST.map((p) => ({ p: p.clone(), v: new THREE.Vector3() }));
    this.swing = { p: new THREE.Vector3(), v: new THREE.Vector3() }; // held item pendulum
    this.trophy = { p: new THREE.Vector3(), v: new THREE.Vector3() }; // item offset (eases between holds)
    this.sway = { p: new THREE.Vector3(), v: new THREE.Vector3() }; // turn/jump lag of both hands
    this.bob = { phase: 0, amount: { x: 0, v: 0 } };
    this.land = { x: 0, v: 0 };
    this.tilt = { x: 0, v: 0 }; // pitch kick (slips)
    this.roll = { x: 0, v: 0 };
    this.crouch = { x: 0, v: 0 };
    this.fovKick = { x: 0, v: 0 };
    this.reachT = 1;
    this.reachTo = new THREE.Vector3(0.1, -0.16, -0.95);
    this.cardT = 0;
    this.flail = 0;
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    this.lastLanding = 0;
    this.lastSlip = 0;
    this.itemKind = undefined;
    this.shake = new THREE.Vector3();
    // Ways of drawing the hands that the crash hunt compares (tuning.mjs): how they crashed an iPad's Safari is
    // still being narrowed down.
    this.tune = w.tune;
    this.inline = null;
    this.order = 0;
    if (this.tune?.has("handsnotorch")) this.torch.removeFromParent();
    if (this.tune?.has("handsbasic")) this.plain(this.scene);
    if (this.tune?.has("handsnodepth")) this.unsorted(this.scene);
    if (this.tune?.has("handsinline")) this.attachInline();
  }
  // ?handsbasic: flat unlit colours instead of lit materials.
  plain(root) {
    root.traverse((o) => {
      if (!o.isMesh || o.material.isMeshBasicMaterial) return;
      o.material = new THREE.MeshBasicMaterial({
        color: o.material.color?.clone() ?? 0xffffff,
        wireframe: !!o.material.wireframe,
        transparent: !!o.material.transparent,
        opacity: o.material.opacity ?? 1,
      });
    });
  }
  // ?handsnodepth: no depth clear before the hands, so they cannot depth-test against the room (a different
  // projection). They get materials of their own that ignore depth, drawn in a fixed order instead.
  unsorted(root) {
    root.traverse((o) => {
      if (!o.isMesh || o.userData.unsorted) return;
      o.userData.unsorted = true;
      o.material = o.material.clone();
      o.material.depthTest = false;
      o.material.depthWrite = false;
      o.renderOrder = 1000 + this.order++;
    });
  }
  // ?handsinline: the hands become children of the room's own camera and are drawn in the room's own pass: the
  // same picture as the second pass (see fitInline), but no second render, no depth clear and no lights of their own.
  attachInline() {
    const w = this.w;
    this.inline = new THREE.Group();
    this.inline.name = "hands-inline";
    for (const child of [...this.scene.children]) if (!child.isLight) this.inline.add(child);
    this.inline.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
    for (const old of [...w.camera.children]) if (old.name === "hands-inline") w.camera.remove(old);
    w.camera.add(this.inline);
    if (w.camera.parent !== w.scene) w.scene.add(w.camera);
  }
  // The room's camera has its own field of view and the hands a narrower one of their own. Scaling the hands by s
  // about the camera keeps the picture and pulls them 1/s nearer, so nothing in the room can poke through them; the
  // extra factor on x and y turns the room camera's field of view into the hands' own.
  fitInline() {
    const main = Math.tan((this.w.camera.fov * DEG) / 2),
      own = Math.tan((this.camera.fov * DEG) / 2),
      s = 0.4,
      k = main / own;
    this.inline.scale.set(s * k, s * k, s);
  }

  // ------------------------------------------------------------------------------------------------------
  // Look controls.
  reset(sim) {
    const c = sim.coach;
    // Face the middle of the pool from wherever the coach starts.
    this.yaw = Math.atan2(-c.x, -c.z * 0.25);
    this.pitch = COACH_CAM.startPitch;
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    for (const [i, h] of this.hands.entries()) {
      h.p.copy(REST[i]);
      h.v.set(0, 0, 0);
    }
  }
  look(dx, dy, sensitivity = COACH_CAM.sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch - dy * sensitivity, COACH_CAM.pitch[0], COACH_CAM.pitch[1]);
  }
  turn(axis, dt) {
    if (axis) this.yaw -= axis * COACH_CAM.keyTurn * dt;
  }
  adjustFov(delta) {
    this.hfov = clamp(this.hfov + delta, COACH_CAM.hfovRange[0], COACH_CAM.hfovRange[1]);
  }
  // Movement input (x = strafe right, z = back) turned into world X/Z for the current view.
  movement(x, z) {
    const s = Math.sin(this.yaw),
      c = Math.cos(this.yaw);
    return { x: s * -z - c * x, z: c * -z + s * x };
  }
  verticalFov(aspect) {
    const v = 2 * Math.atan(Math.tan((this.hfov * DEG) / 2) / aspect);
    return clamp(v / DEG, COACH_CAM.vfov[0], COACH_CAM.vfov[1]);
  }

  // ------------------------------------------------------------------------------------------------------
  // Model: yellow forearm sleeve, navy cuff, bare wrist and a chunky hand.
  buildArm(side) {
    const w = this.w,
      skin = w.mat(0xf0c29b, { roughness: 0.62 }),
      sleeve = w.mat(0xf2bc40, { roughness: 0.58 }),
      navy = w.mat(0x173f4f, { roughness: 0.5 });
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 1, 14).rotateX(Math.PI / 2), sleeve);
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.057, 0.057, 0.045, 14).rotateX(Math.PI / 2),
      navy,
    );
    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.041, 0.046, 0.07, 12).rotateX(Math.PI / 2),
      skin,
    );
    // A chunky cartoon hand: rounded palm, four curled fingers and a thumb. Local −Z points along the
    // fingers, +Y is the back of the hand.
    const hand = new THREE.Group();
    const palm = w.box(0.1, 0.042, 0.104, skin, 0, 0, 0, 0.02, hand);
    const fingers = [-0.034, -0.0115, 0.0115, 0.034].map((x, i) => {
      const f = w.box(0.021, 0.028, 0.07, skin, x, -0.006, -0.078 + Math.abs(i - 1.5) * 0.006, 0.0105, hand);
      f.rotation.x = -0.42;
      return f;
    });
    const thumb = w.box(0.026, 0.028, 0.058, skin, -side * 0.058, -0.01, -0.018, 0.012, hand);
    thumb.rotation.set(-0.2, side * 0.62, -side * 0.25);
    this.scene.add(fore, cuff, wrist, hand);
    for (const m of [fore, cuff, wrist, palm, thumb, ...fingers]) {
      m.frustumCulled = false;
      m.castShadow = false;
    }
    return { side, fore, cuff, wrist, hand };
  }
  // Place a forearm between its (off-screen) elbow and the hand.
  placeArm(arm, elbow, handPos, handRot) {
    const dir = new THREE.Vector3().subVectors(handPos, elbow),
      length = dir.length();
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    // Yellow track-jacket sleeve right up to a navy cuff at the wrist, then a short bare wrist.
    const wristPoint = handPos.clone().addScaledVector(dir, -0.045);
    const sleeveEnd = handPos.clone().addScaledVector(dir, -0.085);
    const sleeveLength = Math.max(0.05, length - 0.095);
    arm.fore.position.copy(elbow).addScaledVector(dir, sleeveLength / 2);
    arm.fore.quaternion.copy(q);
    arm.fore.scale.set(1, 1, sleeveLength);
    arm.cuff.position.copy(sleeveEnd);
    arm.cuff.quaternion.copy(q);
    arm.wrist.position.copy(wristPoint);
    arm.wrist.quaternion.copy(q);
    arm.hand.position.copy(handPos);
    arm.hand.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(handRot));
  }

  // ------------------------------------------------------------------------------------------------------
  // Events from the game: reaches, red cards, landings and slips.
  react(type, data = {}) {
    if (["pickup", "handoff", "helped", "healed", "scooped", "waste-bin", "prevented"].includes(type)) {
      this.reachT = 0;
      this.reachTo.copy(this.toView(data.to || data, 0.6) || new THREE.Vector3(0.08, -0.14, -0.92));
    } else if (type === "red-card") {
      this.cardT = 0.9;
      this.reachT = 0.35;
    } else if (type === "jump") this.sway.v.y -= 0.9;
    else if (type === "coach-slip") this.flail = 0.75;
  }
  // A world point as a clamped reach target in view space, or null when it is behind the coach.
  toView(point, height) {
    const cam = this.w.camera;
    if (!point || !Number.isFinite(point.x) || !cam) return null;
    const local = new THREE.Vector3(point.x, height, point.z).applyMatrix4(cam.matrixWorldInverse);
    if (local.z > -0.2) return null;
    local.normalize().multiplyScalar(0.92);
    local.x = clamp(local.x, -0.2, 0.34);
    local.y = clamp(local.y, -0.3, 0.05);
    return local;
  }

  // ------------------------------------------------------------------------------------------------------
  // Per-frame: move the world camera to the coach's eyes and pose the hands.
  update(sim, time, dt) {
    const w = this.w,
      c = sim.coach,
      cam = w.camera,
      reduced = w.reducedMotion.matches,
      motion = reduced ? 0 : 1;
    dt = Math.min(dt, 0.1);
    const speed = c.swimming ? 0 : Math.hypot(c.vx || 0, c.vz || 0),
      dash = c.dashTime > 0,
      air = (c.y || 0) > 0.03 && !c.swimming && !c.waterTransition;
    // Head bob follows the footsteps; calmer than the hands.
    this.bob.phase += speed * dt * 2.6;
    springNumber(this.bob.amount, air ? 0 : clamp(speed / 5, 0, 1), 40, 12, dt);
    const amp = (dash ? COACH_CAM.runBob : COACH_CAM.bob) * this.bob.amount.x * motion;
    const bobY = Math.abs(Math.sin(this.bob.phase)) * amp,
      bobX = Math.sin(this.bob.phase) * amp * 0.55;
    if (c.landing > this.lastLanding + 0.05 && !c.swimming) {
      this.land.v -= COACH_CAM.landing * motion;
      this.sway.v.y -= 1.4 * motion;
    }
    this.lastLanding = c.landing;
    springNumber(this.land, 0, 150, 15, dt);
    // Slips tip the view back toward the sky for a moment.
    if (c.slipTime > 0 && this.lastSlip === 0) this.react("coach-slip");
    this.lastSlip = c.slipTime;
    springNumber(this.tilt, c.slipTime > 0 ? 0.42 * motion : 0, 60, 11, dt);
    springNumber(this.roll, c.slipTime > 0 ? 0.12 * motion : 0, 60, 11, dt);
    const healing = c.busy?.kind === "heal";
    springNumber(this.crouch, healing ? COACH_CAM.kneel : 0, 50, 13, dt);
    springNumber(this.fovKick, dash ? 5 * motion : 0, 60, 12, dt);
    // Eye position: standing, swimming, or somewhere along a dive / climb.
    const q = c.waterTransition,
      prone = c.swimming ? 1 : q ? (q.kind === "dive" ? Math.min(1, q.t * 1.6) : 1 - q.t) : 0;
    const eye = COACH_CAM.eye + (COACH_CAM.swimEye - COACH_CAM.eye) * prone;
    const waterBob = c.swimming ? Math.sin(time * 2.4) * 0.025 * motion : 0;
    const fx = Math.sin(this.yaw),
      fz = Math.cos(this.yaw);
    w.shake = w.shake || 0;
    const shake = w.shake > 0 && !reduced ? w.shake * 0.12 : 0;
    this.shake.set(
      Math.sin(time * 61) * shake,
      Math.sin(time * 47) * shake * 0.6,
      Math.cos(time * 53) * shake,
    );
    cam.position.set(
      c.x + fx * 0.12 - fz * bobX + this.shake.x,
      (c.y || 0) + eye + bobY + this.land.x - this.crouch.x + waterBob + this.shake.y,
      c.z + fz * 0.12 + fx * bobX + this.shake.z,
    );
    cam.rotation.set(this.pitch + this.tilt.x, this.yaw + Math.PI, this.roll.x, "YXZ");
    const fov = this.verticalFov(cam.aspect) + this.fovKick.x;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld(true);
    this.poseHands(sim, time, dt, { speed, dash, air, motion, healing });
    this.lighting(sim, time);
  }

  poseHands(sim, time, dt, { speed, dash, air, motion, healing }) {
    const c = sim.coach,
      kind = c.carry,
      hold = HOLDS[kind];
    // Turning and looking leave the hands behind for a beat.
    const dyaw = Math.atan2(Math.sin(this.yaw - this.lastYaw), Math.cos(this.yaw - this.lastYaw)),
      dpitch = this.pitch - this.lastPitch;
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    // The camera turns at once; the hands keep part of their place in the world and spring after it.
    const lag = 0.45 * motion;
    for (const h of this.hands) {
      h.p.x += clamp(dyaw, -0.5, 0.5) * Math.abs(h.p.z) * lag;
      h.p.y -= clamp(dpitch, -0.5, 0.5) * Math.abs(h.p.z) * lag;
    }
    const vy = c.vy || 0;
    const airOffset = air ? (vy > 0 ? -0.07 : 0.05) : 0;
    springVector(this.sway, new THREE.Vector3(0, airOffset * motion, 0), 70, 9, dt);
    this.sway.p.clampLength(0, 0.22);

    const walk = clamp(speed / 5, 0, 1.3) * motion,
      step = this.bob.phase,
      breathe = Math.sin(time * 1.6) * 0.006 * motion;
    const targets = REST.map((p) => p.clone());
    // Relaxed: wrists bent so the fingers point forward and a little inward, backs of the hands up.
    const rots = [new THREE.Euler(-0.72, -0.32, 0.38), new THREE.Euler(-0.72, 0.32, -0.38)];
    // Walking: hands swing opposite to each other and bounce 2–4× more than the camera.
    for (const [i, t] of targets.entries()) {
      const s = i ? 1 : -1;
      t.z += Math.sin(step + (i ? 0 : Math.PI)) * 0.035 * walk * (dash ? 1.6 : 1);
      t.y += Math.abs(Math.sin(step)) * 0.03 * walk * (dash ? 1.7 : 1) + breathe;
      t.x += s * 0.012 * walk;
    }
    if (dash)
      for (const t of targets) {
        t.y += 0.03 * motion;
        t.z += 0.05;
      }
    // Carried items: one hand holds it, or both for rings and poles.
    if (hold) {
      const grip = vec(hold.grip);
      if (hold.heavy) grip.y -= 0.03;
      if (hold.two) {
        targets[0].set(grip.x - hold.two, grip.y + 0.02, grip.z + 0.06);
        targets[1].set(grip.x + hold.two, grip.y + 0.02, grip.z + 0.06);
        rots[0].set(0.1, 0.9, 1.2);
        rots[1].set(0.1, -0.9, -1.2);
      } else if (hold.pole) {
        targets[1].set(grip.x + 0.16, grip.y - 0.04, grip.z + 0.1);
        targets[0].set(grip.x - 0.12, grip.y + 0.03, grip.z - 0.12);
        rots[0].set(0.2, 0.2, 1.3);
        rots[1].set(0.2, -0.2, -1.3);
      } else {
        targets[1].copy(grip);
        rots[1].set(-0.2, -0.1, -0.9);
      }
      for (const t of targets) t.y += Math.abs(Math.sin(step)) * 0.02 * walk;
    }
    // Contextual poses.
    const busy = c.busy;
    if (healing) {
      // Kneeling and bandaging: both hands low and busy.
      const t = time * 7;
      targets[0].set(-0.1 + Math.sin(t) * 0.04, -0.24, -0.52);
      targets[1].set(0.1 + Math.cos(t) * 0.05, -0.2 + Math.sin(t) * 0.03, -0.5);
    } else if (busy?.kind === "breaker") {
      targets[1].set(0.1, -0.04 + Math.sin(time * 11) * 0.05, -0.64);
      rots[1].set(0.9, 0, -0.3);
    }
    if (c.swimming) {
      // Breaststroke, or one-handed while the other hand holds the ring or net.
      const t = time * 3.4,
        s = Math.sin(t),
        k = Math.cos(t);
      const stroke = (side) =>
        new THREE.Vector3(
          side * (0.13 + Math.max(0, -k) * 0.32),
          -0.2 - Math.max(0, s) * 0.12,
          -0.72 + (1 - k) * 0.18,
        );
      targets[0].copy(stroke(-1));
      targets[1].copy(stroke(1));
      rots[0].set(0.3, 0.3, 1.3);
      rots[1].set(0.3, -0.3, -1.3);
      if (hold) {
        // Swimming one-handed: the item stays low so the coach can still see where they are going.
        targets[1].set(0.22, -0.3, -0.8);
        if (hold.two) targets[0].set(-0.22, -0.3, -0.8);
      }
    } else if (c.waterTransition?.kind === "dive") {
      targets[0].set(-0.06, -0.08, -0.8);
      targets[1].set(0.06, -0.08, -0.8);
    } else if (c.waterTransition) {
      targets[0].set(-0.26, -0.3, -0.5);
      targets[1].set(0.26, -0.3, -0.5);
    }
    // Reaching for something just grabbed or handed over.
    if (this.reachT < 1) {
      this.reachT = Math.min(1, this.reachT + dt / 0.38);
      const k = Math.sin(this.reachT * Math.PI);
      targets[1].lerp(this.reachTo, k * (hold && !hold.pole && !hold.two ? 0.6 : 0.9));
    }
    if (this.cardT > 0) {
      this.cardT = Math.max(0, this.cardT - dt);
      targets[1].set(0.2, -0.02, -0.62);
      rots[1].set(0.1, -0.2, -0.1);
    }
    this.card.visible = this.cardT > 0;
    // Slips: both hands fly up into view.
    if (this.flail > 0) {
      this.flail = Math.max(0, this.flail - dt);
      const f = Math.min(1, this.flail * 3) * motion;
      targets[0].lerp(new THREE.Vector3(-0.3 + Math.sin(time * 23) * 0.05, -0.02, -0.52), f);
      targets[1].lerp(new THREE.Vector3(0.3 + Math.cos(time * 21) * 0.05, 0.0, -0.52), f);
      rots[0].set(-1.1, 0.4, 0.2);
      rots[1].set(-1.1, -0.4, -0.2);
    }
    // Springs: the hands settle 100–200 ms after the camera does.
    const stiffness = hold?.heavy ? 90 : 160,
      damping = hold?.heavy ? 12 : 17;
    for (const [i, h] of this.hands.entries()) {
      const target = targets[i].add(this.sway.p);
      springVector(h, target, stiffness, damping, dt);
      this.placeArm(
        this.arms[i],
        ELBOW[i].clone().add(this.sway.p.clone().multiplyScalar(0.5)),
        h.p,
        rots[i],
      );
    }
    this.poseItem(sim, time, dt, hold, motion);
  }

  poseItem(sim, time, dt, hold, motion) {
    const c = sim.coach,
      kind = c.carry;
    if (kind !== this.itemKind) {
      this.item.clear();
      this.itemKind = kind;
      const model = kind === "fishnet" ? this.fishNetView() : kind ? this.w.carryObject(kind) : null;
      if (model) {
        model.traverse((m) => {
          if (m.isMesh) {
            m.castShadow = false;
            m.frustumCulled = false;
          }
        });
        if (this.tune?.has("handsbasic")) this.plain(model);
        if (this.tune?.has("handsnodepth")) this.unsorted(model);
        if (this.inline)
          model.traverse((m) => {
            if (m.isMesh) m.receiveShadow = false;
          });
        this.item.add(model);
      }
    }
    this.item.visible = !!hold && this.item.children.length > 0;
    if (!this.item.visible) return;
    const net = this.item.getObjectByName("net-fish");
    if (net) {
      net.visible = !!c.netLoaded;
      if (c.netLoaded) net.rotation.z = Math.sin(time * 13) * 0.5 * motion;
    }
    const waste = this.item.getObjectByName("caught-waste");
    if (waste) waste.visible = !!c.skimmerLoaded;
    // Grip point: the holding hand, or between both hands.
    const [left, right] = this.hands.map((h) => h.p);
    const grip = hold.two || hold.pole ? left.clone().add(right).multiplyScalar(0.5) : right.clone();
    // A pendulum swing for dangling things, driven by the hands' own motion.
    const handV = this.hands[1].v;
    const swingTarget = new THREE.Vector3(-handV.z * 0.25, 0, handV.x * 0.9).multiplyScalar(
      (hold.hang || 0.25) * motion,
    );
    springVector(this.swing, swingTarget, 45, 6, dt);
    this.swing.p.clampLength(0, 0.6);
    const place = kind === "fishnet" && c.netLoaded ? { ...hold, ...hold.loaded } : hold;
    springVector(this.trophy, new THREE.Vector3(...place.offset), 30, 9, dt);
    this.item.position.set(grip.x + this.trophy.p.x, grip.y + this.trophy.p.y, grip.z + this.trophy.p.z);
    this.item.rotation.set(place.rot[0] + this.swing.p.x, place.rot[1], place.rot[2] + this.swing.p.z);
    this.item.scale.setScalar(place.scale * (1 + (c.feedback || 0) * 0.6));
  }
  // The net as seen from behind it: pole running away from the coach, hoop flat, bag hanging below.
  fishNetView() {
    const w = this.w,
      g = new THREE.Group();
    w.rod([0, 0, 0.4], [0, 0, -1.55], 0.032, 0x8b6b45, g);
    w.rod([0, 0, 0.4], [0, 0, 0.05], 0.047, 0x2f7b86, g);
    const hoop = w.torus(0.36, 0.032, 0x2f9a63, g, Math.PI * 2, 7, 24);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(0, 0, -1.92);
    const bag = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.62, 10, 3, true),
      new THREE.MeshBasicMaterial({ color: 0xc9eadb, wireframe: true, transparent: true, opacity: 0.75 }),
    );
    bag.rotation.x = Math.PI;
    bag.position.set(0, -0.31, -1.92);
    g.add(bag);
    const fish = fishObject(w, 0.95);
    fish.name = "net-fish";
    fish.position.set(0, -0.12, -1.92);
    fish.rotation.y = Math.PI / 2;
    fish.visible = false;
    g.add(fish);
    return g;
  }

  // The hands share the pool's light: dim in a blackout, lit by the flashlight they hold.
  lighting(sim, time) {
    const w = this.w,
      k = clamp(w.incidentView?.light ?? 1, 0.08, 1.2),
      look = w.look;
    this.hemi.color.set(look.hemi[0]);
    this.hemi.groundColor.set(look.hemi[1]);
    this.hemi.intensity = 0.45 + look.hemi[2] * 0.55 * k;
    this.key.color.set(look.sun[0]);
    this.key.intensity = look.sun[1] * 0.75 * k;
    if (this.tune?.has("handsnoenv")) this.scene.environment = null;
    else {
      this.scene.environment = w.scene.environment;
      this.scene.environmentIntensity = look.env * 0.6 * k;
    }
    if (this.inline) this.fitInline();
    const torch = sim.coach.carry === "flashlight";
    this.torch.intensity = torch ? 2.2 : 0;
    if (torch) this.torch.position.copy(this.hands[1].p).add(new THREE.Vector3(0, 0.08, -0.12));
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
  render(renderer) {
    if (this.inline) return; // drawn with the room
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    if (!this.tune?.has("handsnodepth")) renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
  // What the crosshair is on: the first clickable along the view centre, at any distance (like a click in the
  // overview), so the queue and far gear can be picked from anywhere on deck.
  centerTarget(raycaster, clickables) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.w.camera);
    const hit = raycaster.intersectObjects(clickables, false)[0];
    return hit ? hit.object.userData : null;
  }
}
