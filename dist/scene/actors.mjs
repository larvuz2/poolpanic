// Character and creature models. Poses are driven by the world sync from simulation state; models only
// expose named parts (root, arms, legs, head…) in userData.
import { THREE, COLORS } from "./kit.mjs";
import { TYPES } from "../sim.mjs";
import { finsObject, bucket, fishObject } from "./props.mjs";

const SKINS = [0xe6aa80, 0xf0c29b, 0xa76d51, 0xc78e65, 0x784e3f];
const VISITOR_LOOKS = {
  coach: { suit: 0xf2bc40 },
  kid: { suit: 0x7cc46a, scale: 0.64 },
  carl: { suit: 0xd9534a, scale: 1.14 },
};

export function character(w, p) {
  const g = new THREE.Group(),
    root = new THREE.Group();
  g.add(root);
  const isCoach = p.type === "coach",
    isKid = p.type === "kid",
    isCarl = p.type === "carl" || !!p.carl,
    isDaredevil = p.type === "daredevil",
    isVip = !!p.vip;
  const info = TYPES[p.type] || VISITOR_LOOKS[p.type] || { color: "#f5c652" };
  const skin = p.queasy ? 0xc0c996 : SKINS[(p.skin || 0) % 5];
  const suit = isCoach
    ? 0xf2bc40
    : isKid
      ? 0x7cc46a
      : isCarl && !TYPES[p.type]
        ? 0xd9534a
        : isVip
          ? 0xf2b632
          : new THREE.Color(info.color);
  const suitMat = w.mat(suit, { roughness: 0.55 });
  const bodyScale = isCarl ? [1.42, 1.22, 1.3] : [1.08, 1.24, 0.8];
  const body = w.ball(0.38, suitMat, 0, 0.76, 0, root, bodyScale);
  if (isCarl) {
    w.ball(0.36, skin, 0, 0.9, 0.2, root, [1.25, 1.05, 0.95]);
    // Leopard speedo.
    w.ball(0.33, 0xf0a13a, 0, 0.5, 0.02, root, [1.35, 0.55, 1.1]);
    for (const [x, y, z] of [
      [-0.2, 0.52, 0.34],
      [0.12, 0.47, 0.35],
      [0.28, 0.55, 0.22],
      [-0.33, 0.49, 0.16],
    ])
      w.ball(0.045, 0x4a2f1e, x, y, z, root);
  }
  const head = w.ball(
    0.34,
    skin,
    0,
    isCarl ? 1.5 : 1.42,
    0,
    root,
    isKid ? [1.12, 1.16, 1.08] : [1, 1.08, 0.96],
  );
  const capColor = isCoach ? COLORS.navy : isKid ? 0xe0513f : isCarl ? skin : suit;
  const cap = w.ball(
    0.343,
    w.mat(capColor, { roughness: isCarl ? 0.78 : 0.4 }),
    0,
    head.position.y + 0.16,
    -0.028,
    root,
    [1, 0.64, 1],
  );
  if (isCoach) w.box(0.55, 0.06, 0.23, COLORS.navy, 0, 1.63, 0.26, 0.04, root);
  else if (isKid) w.box(0.5, 0.06, 0.26, 0xe0513f, 0, 1.64, -0.3, 0.04, root);
  else if (!isCarl) {
    w.box(0.64, 0.12, 0.16, 0x194c61, 0, 1.47, 0.26, 0.05, root);
    for (const x of [-0.15, 0.15]) w.box(0.2, 0.092, 0.04, 0xbfe8db, x, 1.47, 0.355, 0.03, root);
  }
  if (isVip) {
    // A golden crown and a crimson sash: you cannot miss a VIP.
    const gold = w.mat(0xf6c445, { roughness: 0.3, metalness: 0.5 });
    w.cyl(0.24, 0.26, 0.1, gold, 0, head.position.y + 0.33, 0, root, 12);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      w.cyl(0, 0.06, 0.17, gold, Math.cos(a) * 0.19, head.position.y + 0.46, Math.sin(a) * 0.19, root, 6);
    }
    w.ball(0.05, 0xe0513f, 0, head.position.y + 0.42, 0.26, root);
    const sash = w.box(0.13, 0.98, 0.07, 0xc23a4a, 0.05, 0.82, 0.31, 0.02, root);
    sash.rotation.z = -0.62;
  }
  if (isDaredevil) {
    const star = w.ball(0.09, COLORS.yellow, 0, 1.72, 0.12, root, [1, 1, 0.4]);
    star.castShadow = false;
    const cape = w.box(0.62, 0.72, 0.04, 0xe0513f, 0, 0.92, -0.33, 0.03, root);
    cape.rotation.x = 0.16;
  }
  for (const x of [-0.34, 0.34]) w.ball(0.077, skin, x, head.position.y + 0.01, 0, root);
  if (isCoach) {
    for (const x of [-0.105, 0.105]) w.ball(0.035, COLORS.navy, x, 1.45, 0.3, root);
    w.rod([-0.16, 1.1, 0.24], [0, 0.88, 0.31], 0.018, COLORS.navy, root);
    w.ball(0.055, 0xf7f6d9, 0, 0.88, 0.33, root);
  } else if (isCarl) {
    for (const x of [-0.1, 0.1]) w.ball(0.034, 0x1d2a30, x, 1.56, 0.31, root);
    w.box(0.36, 0.07, 0.07, 0x4a2f1e, 0, 1.43, 0.33, 0.03, root);
  } else w.box(0.12, 0.035, 0.03, 0x9d5f48, 0, 1.3, 0.321, 0.01, root);
  if (isKid) for (const x of [-0.11, 0.11]) w.ball(0.045, 0x1d2a30, x, 1.46, 0.33, root);
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * (isCarl ? 0.5 : 0.34), 1.01, 0);
    root.add(arm);
    w.ball(0.115, skin, side * 0.025, -0.23, 0, arm, [0.85, 2.5, 0.85]);
    w.ball(0.112, skin, side * 0.035, -0.46, 0, arm);
    arms.push(arm);
  }
  const legs = [];
  for (const x of isCarl ? [-0.22, 0.22] : [-0.17, 0.17]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.45, 0);
    root.add(leg);
    w.ball(0.12, isCoach ? COLORS.navy : isKid ? 0x2c6f9a : skin, 0, -0.2, 0, leg, [1, 2.2, 1]);
    w.ball(0.135, isCoach ? 0xfff4d9 : skin, 0, -0.4, 0.07, leg, [0.9, 0.6, 1.45]);
    legs.push(leg);
  }
  const f = finsObject(w);
  f.rotation.x = Math.PI / 2;
  f.position.set(0, 0.015, 0.24);
  f.visible = false;
  root.add(f);
  const carry = new THREE.Group();
  carry.position.set(0.58, 0.9, 0.25);
  root.add(carry);
  carry.visible = false;
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.9;
  hit.userData = { kind: p.visitor ? "visitor" : "swimmer", id: p.id };
  g.add(hit);
  if (!isCoach) w.clickables.push(hit);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 18),
    new THREE.MeshBasicMaterial({ color: 0x2a5d62, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  g.add(shadow);
  const soreEyes = new THREE.Group();
  soreEyes.name = "sore-eyes";
  head.add(soreEyes);
  for (const x of [-0.13, 0.13]) w.ball(0.095, 0xff514d, x, 0.05, 0.39, soreEyes, [1, 0.62, 0.4]);
  soreEyes.visible = false;
  const bandage = new THREE.Group();
  bandage.name = "bandage";
  head.add(bandage);
  const wrap = w.torus(0.345, 0.05, 0xfffdf4, bandage, Math.PI * 2, 6, 20);
  wrap.rotation.x = Math.PI / 2 - 0.25;
  wrap.position.y = 0.06;
  w.box(0.16, 0.05, 0.03, 0xe0513f, 0.12, 0.2, 0.3, 0.01, bandage);
  w.box(0.05, 0.16, 0.03, 0xe0513f, 0.12, 0.2, 0.301, 0.01, bandage);
  bandage.visible = false;
  let kidBucket = null;
  if (isKid) {
    kidBucket = new THREE.Group();
    kidBucket.position.set(0, 0.85, 0.42);
    root.add(kidBucket);
    bucket(w, 0, 0, 0, kidBucket, 0x3593c1);
    const fish = fishObject(w, 0.85);
    fish.name = "bucket-fish";
    fish.position.set(0, 0.5, 0.02);
    fish.rotation.x = -Math.PI / 2 + 0.3;
    kidBucket.add(fish);
  }
  root.scale.setScalar(VISITOR_LOOKS[p.type]?.scale || 1);
  g.userData = {
    soreEyes,
    bandage,
    root,
    arms,
    legs,
    body,
    head,
    cap,
    f,
    hit,
    carry,
    shadow,
    kidBucket,
    baseScale: VISITOR_LOOKS[p.type]?.scale || (isCarl ? 1.08 : 1),
    phase: p.phase || 0,
    carryKind: null,
  };
  if (isCarl && TYPES[p.type]) g.userData.baseScale = 1.08;
  return g;
}

export function dogObject(w) {
  const g = new THREE.Group(),
    root = new THREE.Group();
  g.add(root);
  const fur = w.mat(0xd99a4e, { roughness: 0.85 }),
    cream = w.mat(0xf5dfb6, { roughness: 0.85 }),
    dark = 0x2b2320;
  const body = w.ball(0.34, fur, 0, 0.55, 0, root, [0.88, 0.82, 1.55]);
  w.ball(0.28, cream, 0, 0.5, 0.34, root, [0.85, 0.9, 0.8]);
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.56);
  root.add(head);
  w.ball(0.25, fur, 0, 0, 0, head);
  w.ball(0.13, cream, 0, -0.07, 0.2, head, [0.9, 0.75, 1.25]);
  w.ball(0.055, dark, 0, -0.03, 0.34, head);
  for (const x of [-0.1, 0.1]) {
    w.ball(0.045, 0xffffff, x, 0.07, 0.19, head);
    w.ball(0.025, dark, x * 1.1, 0.075, 0.225, head);
  }
  const ears = [];
  for (const x of [-0.2, 0.2]) {
    const ear = w.ball(0.1, 0xa8682e, x, -0.02, -0.02, head, [0.5, 1.45, 0.85]);
    ear.rotation.z = x > 0 ? -0.35 : 0.35;
    ears.push(ear);
  }
  const tongue = w.box(0.08, 0.02, 0.13, 0xf07c8c, 0, -0.16, 0.26, 0.01, head);
  const collar = w.torus(0.19, 0.035, 0xe0513f, root, Math.PI * 2, 6, 16);
  collar.position.set(0, 0.74, 0.44);
  collar.rotation.x = Math.PI / 2 - 0.5;
  w.ball(0.045, COLORS.yellow, 0, 0.62, 0.58, root);
  const tail = new THREE.Group();
  tail.position.set(0, 0.7, -0.5);
  root.add(tail);
  w.ball(0.07, fur, 0, 0.14, -0.06, tail, [0.8, 2.3, 0.8]).rotation.x = -0.5;
  const legs = [];
  for (const x of [-0.17, 0.17])
    for (const z of [-0.3, 0.32]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.42, z);
      root.add(leg);
      w.ball(0.08, fur, 0, -0.17, 0, leg, [1, 2.4, 1]);
      w.ball(0.085, cream, 0, -0.37, 0.03, leg, [1, 0.6, 1.3]);
      legs.push(leg);
    }
  const mouth = new THREE.Group();
  mouth.position.set(0, 0.72, 0.9);
  root.add(mouth);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 18),
    new THREE.MeshBasicMaterial({ color: 0x2a5d62, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  shadow.scale.set(0.8, 1.3, 1);
  g.add(shadow);
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.6;
  g.add(hit);
  g.userData = { root, body, head, ears, tongue, tail, legs, mouth, shadow, hit, carryKind: null };
  return g;
}
