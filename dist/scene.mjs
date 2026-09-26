import { waitingInWater } from "./rescue.mjs";
import { bumpLean } from "./deck-physics.mjs";
import { SANITATION, RESCUE, RING_MOUNTS } from "./spatial.mjs";
import { ARRIVAL, doorOpening } from "./spatial.mjs";
import { guidanceState, cuePulse } from "./guidance.mjs";
import * as THREE from "./assets/three.module.js";
import { RoundedBoxGeometry } from "./assets/RoundedBoxGeometry.js";
import { TYPES, LANES, STATIONS, loopPosition } from "./sim.mjs";
const colors = {
  teal: 0x118c94,
  navy: 0x174958,
  cream: 0xe5c58b,
  tile: 0xc69870,
  coral: 0xee8864,
  yellow: 0xf4c849,
  blue: 0x529fd5,
  wood: 0xd9a166,
  green: 0x6cb980,
};
const UP = new THREE.Vector3(0, 1, 0);
export class PoolWorld {
  constructor(container, onPick) {
    this.container = container;
    this.onPick = onPick;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x537e7b);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    container.appendChild(this.renderer.domElement);
    this.materials = new Map();
    this.geometries = new Map();
    this.clickables = [];
    this.people = new Map();
    this.drops = new Map();
    this.particles = [];
    this.flags = [];
    this.lockerDoors = [];
    this.bobs = [];
    this.labels = [];
    this.zoom = 1;
    this.target = new THREE.Vector3(-1.5, 0.45, -3.2);
    this.effectSeed = 719;
    this.handoffs = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = 0;
    this.scene.add(new THREE.HemisphereLight(0xc1d9dc, 0x76624c, 1.55));
    const sun = new THREE.DirectionalLight(0xffd5a0, 2.65);
    sun.position.set(-12, 27, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.far = 80;
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.00025;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7dbfc8, 0.85);
    rim.position.set(15, 15, -18);
    this.scene.add(rim);
    this.buildEnvironment();
    this.batchStatic();
    this.coach = this.character({ type: "coach", skin: 1, shape: 0.5 });
    this.scene.add(this.coach);
    this.coachHalo = this.ring(0.57, 0xffd54d);
    this.scene.add(this.coachHalo);
    this.actionHalo = this.ring(0.66, 0xffe484);
    this.scene.add(this.actionHalo);
    this.actionHalo.visible = false;
    this.selection = this.ring(0.62, 0xffda4f);
    this.scene.add(this.selection);
    this.selection.visible = false;
    this.laneHighlights = LANES.map((x) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 16),
        new THREE.MeshBasicMaterial({ color: 0xffe58b, transparent: true, opacity: 0, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, -0.17, 0);
      this.scene.add(m);
      return m;
    });
    this.buildGuidance();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInput();
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
  mesh(geo, color, x = 0, y = 0, z = 0, parent = this.scene, extra = {}) {
    const m = new THREE.Mesh(geo, this.mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(w, h, d, color, x, y, z, r = 0.07, parent = this.scene) {
    const key = [w, h, d, r].join(",");
    if (!this.geometries.has(key))
      this.geometries.set(
        key,
        r
          ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2))
          : new THREE.BoxGeometry(w, h, d),
      );
    return this.mesh(this.geometries.get(key), color, x, y, z, parent);
  }
  ball(r, color, x, y, z, parent = this.scene, scale = null) {
    const key = "sphere" + r;
    if (!this.geometries.has(key)) this.geometries.set(key, new THREE.SphereGeometry(r, 12, 8));
    const m = this.mesh(this.geometries.get(key), color, x, y, z, parent);
    if (scale) m.scale.set(...scale);
    return m;
  }
  cyl(r1, r2, h, color, x, y, z, parent = this.scene, segments = 12) {
    return this.mesh(new THREE.CylinderGeometry(r1, r2, h, segments), color, x, y, z, parent);
  }
  rod(a, b, r, color, parent = this.scene) {
    const aa = new THREE.Vector3(...a),
      bb = new THREE.Vector3(...b),
      v = bb.clone().sub(aa);
    const m = this.mesh(new THREE.CylinderGeometry(r, r, v.length(), 8), color, 0, 0, 0, parent);
    m.position.copy(aa.add(bb).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(UP, v.normalize());
    return m;
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
  buildEnvironment() {
    // Thick tabletop foundation and a tiled deck with a real recessed basin.
    this.box(30, 1.25, 30.2, 0x398d94, 0, -1.25, -1.6, 0.45);
    this.box(29.9, 0.21, 30.1, 0xb28363, 0, -0.59, -1.6, 0.2);
    this.box(9.7, 0.45, 30.2, colors.tile, -9.85, -0.25, -1.6, 0.14);
    this.box(9.7, 0.45, 30.2, colors.tile, 9.85, -0.25, -1.6, 0.14);
    this.box(10.1, 0.45, 5.2, colors.tile, 0, -0.25, 10.8, 0.09);
    this.box(10.1, 0.45, 8.4, colors.tile, 0, -0.25, -12.4, 0.09);
    this.box(10.05, 0.15, 16.7, 0x83cdd3, 0, -1.42, 0, 0.08);
    this.box(0.2, 1.2, 16.7, 0xaad9d6, -5, -0.85, 0, 0.02);
    this.box(0.2, 1.2, 16.7, 0xaad9d6, 5, -0.85, 0, 0.02);
    this.box(10.1, 1.2, 0.16, 0xb3e0d8, 0, -0.85, 8.3, 0.02);
    this.box(10.1, 1.2, 0.16, 0xb3e0d8, 0, -0.85, -8.3, 0.02);
    for (let x = -14; x <= 14; x++) {
      if (Math.abs(x) > 5.1) this.box(0.017, 0.012, 29.2, 0xa87c5d, x, -0.017, -1.6, 0);
      else {
        this.box(0.017, 0.012, 7.8, 0xa87c5d, x, -0.017, -12.5, 0);
        this.box(0.017, 0.012, 4.6, 0xa87c5d, x, -0.017, 10.9, 0);
      }
    }
    for (let z = -16; z <= 13; z++) {
      if (Math.abs(z) > 8.4) this.box(29, 0.012, 0.017, 0xa87c5d, 0, -0.016, z, 0);
      else {
        this.box(9.3, 0.012, 0.017, 0xa87c5d, -9.95, -0.016, z, 0);
        this.box(9.3, 0.012, 0.017, 0xa87c5d, 9.95, -0.016, z, 0);
      }
    }
    // Submerged tile grid and regulation T markings.
    for (let x = -4.8; x < 5; x += 0.8) this.box(0.015, 0.012, 16.4, 0x68b9c4, x, -1.331, 0, 0);
    for (let z = -8; z <= 8; z += 0.8) this.box(9.85, 0.012, 0.015, 0x68b9c4, 0, -1.33, z, 0);
    for (const x of LANES) {
      this.box(0.15, 0.016, 13.8, colors.navy, x, -1.31, 0, 0);
      for (const z of [-6.9, 6.9]) this.box(1.65, 0.019, 0.18, colors.navy, x, -1.3, z, 0);
      for (const z of [-8.18, 8.18]) {
        this.box(0.16, 0.72, 0.03, colors.navy, x, -0.91, z, 0);
        this.box(1.15, 0.16, 0.032, colors.navy, x, -0.74, z, 0);
      }
    }
    // Cream coping and the drainage channels.
    for (const x of [-5.2, 5.2]) {
      this.box(0.35, 0.18, 17.5, 0xdbc093, x, 0.02, 0, 0.05);
      this.box(0.2, 0.025, 17.3, 0x708f8e, x + (x > 0 ? 0.38 : -0.38), -0.001, 0, 0.01);
      for (let z = -8.4; z < 8.5; z += 0.24)
        this.box(0.2, 0.035, 0.06, 0xd3ded1, x + (x > 0 ? 0.38 : -0.38), 0.008, z, 0.008);
    }
    for (const z of [-8.6, 8.6]) this.box(10.7, 0.18, 0.38, 0xdbc093, 0, 0.02, z, 0.05);
    const waterGeo = new THREE.PlaneGeometry(9.9, 16.5, 36, 58);
    waterGeo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(
      waterGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uDirty: { value: 0 }, uBrown: { value: 0 } },
        vertexShader: `varying vec3 vP; uniform float uTime; void main(){vP=position; vec3 p=position;p.y+=sin(p.x*2.6+uTime)*cos(p.z*2.1+uTime*.7)*.023; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `varying vec3 vP;uniform float uTime;uniform float uDirty;uniform float uBrown;void main(){float a=sin(vP.x*5.+sin(vP.z*2.8+uTime*.7)+uTime);float b=cos(vP.z*5.4+sin(vP.x*3.-uTime*.6));float caustic=pow(max(0.,1.-abs(a+b)*1.8),12.);float ripple=pow(max(0.,sin(vP.x*2.5+vP.z*2.8+uTime*.8)),24.);vec3 color=mix(vec3(.12,.73,.80),vec3(.40,.61,.24),uDirty);color=mix(color,vec3(.38,.20,.07),uBrown*.88);color+=caustic*.12+ripple*.08;gl_FragColor=vec4(color,.46+uDirty*.24+uBrown*.2);}`,
      }),
    );
    this.water.position.y = -0.25;
    this.scene.add(this.water);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(3.18, 0.2, 16.5),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      m.position.set(LANES[i], -0.12, 0);
      m.userData = { kind: "lane", lane: i };
      this.scene.add(m);
      this.clickables.push(m);
    }
    // Alternating floats: blue and cream mid-pool, red at both turn zones.
    const floatGeo = new THREE.SphereGeometry(0.115, 8, 6);
    const count = 72;
    for (let j = 0; j < 4; j++) {
      const x = -4.8 + j * 3.2;
      this.rod([x, -0.19, -8.3], [x, -0.19, 8.3], 0.022, 0xd4e5d2);
      const buckets = [[], [], []];
      for (let k = 0; k < count; k++) {
        const z = -8.08 + k * (16.16 / (count - 1));
        buckets[Math.abs(z) > 5.8 ? 2 : k % 2].push(z);
      }
      buckets.forEach((arr, k) => {
        const mesh = new THREE.InstancedMesh(
          floatGeo,
          this.mat(k === 2 ? 0xed7556 : k === 0 ? 0xffe3a2 : 0x3593c1),
          arr.length,
        );
        const dummy = new THREE.Object3D();
        arr.forEach((z, n) => {
          dummy.position.set(x, -0.19, z);
          dummy.scale.set(1, 0.85, 1.25);
          dummy.updateMatrix();
          mesh.setMatrixAt(n, dummy.matrix);
        });
        mesh.castShadow = true;
        this.scene.add(mesh);
      });
    }
    // Starting blocks with tilted tops, grips and visible lane numbers.
    LANES.forEach((x, i) => {
      this.box(0.65, 0.85, 0.75, 0xd1ded3, x, 0.48, -9.15, 0.07);
      const top = this.box(1.18, 0.19, 1.1, colors.blue, x, 0.97, -9.13, 0.08);
      top.rotation.x = 0.12;
      this.box(0.18, 0.11, 0.88, 0xebc14e, x + 0.45, 1.09, -9.1, 0.02);
      this.rod([x - 0.38, 0.6, -8.85], [x + 0.38, 0.6, -8.85], 0.055, 0xdde8e0);
      const number = this.textPlane(
        String(i + 1),
        0.35,
        0.36,
        "#d1ded3",
        "#174958",
        x - 0.336,
        0.53,
        -9.15,
        this.scene,
        100,
      );
      number.rotation.y = -Math.PI / 2;
      const label = this.textPlane(
        "0" + (i + 1),
        1.2,
        0.75,
        "#e8eee3",
        "#267682",
        x,
        0.018,
        -10.75,
        this.scene,
        100,
      );
      label.rotation.x = -Math.PI / 2;
      label.rotation.z = -Math.PI / 2;
    });
    // Two sets of backstroke pennants suspended over the lanes.
    for (const z of [-5.7, 5.7]) {
      for (const x of [-6, 6]) {
        this.cyl(0.09, 0.13, 3.35, 0xf2f1dd, x, 1.68, z);
        this.cyl(0.25, 0.3, 0.1, colors.navy, x, 0.07, z);
        this.ball(0.14, colors.yellow, x, 3.4, z);
      }
      const points = [];
      for (let k = 0; k <= 30; k++) {
        const x = -6 + k * 0.4;
        points.push(new THREE.Vector3(x, 3.32 - 0.3 * (1 - (x / 6) ** 2), z));
      }
      this.scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: 0x275663 }),
        ),
      );
      for (let k = 0; k < 15; k++) {
        const x = -5.4 + k * 0.77,
          y = 3.32 - 0.3 * (1 - (x / 6) ** 2);
        const shape = new THREE.Shape();
        shape.moveTo(-0.29, 0);
        shape.lineTo(0.29, 0);
        shape.lineTo(0, -0.58);
        shape.closePath();
        const f = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshStandardMaterial({
            color: k % 3 === 0 ? colors.coral : k % 3 === 1 ? colors.cream : colors.teal,
            side: THREE.DoubleSide,
            roughness: 0.9,
          }),
        );
        f.position.set(x, y, z);
        f.rotation.y = Math.PI / 2 + 0.14;
        this.scene.add(f);
        this.flags.push(f);
      }
    }
    const rearStart = this.scene.children.length;
    // Rear cutaway wall, high daylight windows and the pool club signage.
    this.box(29.7, 5.9, 0.4, 0x82a79b, 0, 2.5, -13.15, 0.15);
    this.box(29.9, 1.25, 0.08, 0x53a6a4, 0, 0.6, -12.91, 0.02);
    for (let x = -14; x < 15; x += 0.75) this.box(0.016, 1.2, 0.03, 0x3a9297, x, 0.6, -12.85, 0);
    this.box(30, 0.15, 0.18, 0xd4b888, 0, 1.27, -12.86, 0.02);
    this.box(30, 0.35, 0.8, 0x268994, 0, 5.45, -13.05, 0.09);
    for (let j = 0; j < 5; j++) {
      const x = -10.4 + j * 5.2;
      this.box(4.6, 2.0, 0.11, 0x98cad1, x, 3.92, -12.87, 0.03);
      this.box(4.82, 0.14, 0.3, 0xfff9dc, x, 2.87, -12.72, 0.02);
      this.box(4.82, 0.14, 0.2, 0xf8f1d4, x, 4.98, -12.72, 0.02);
      for (const xx of [x - 2.28, x, x + 2.28]) this.box(0.1, 2.1, 0.24, 0xfff9dd, xx, 3.96, -12.69, 0.015);
      this.box(4.6, 0.07, 0.22, 0xfff9dd, x, 3.96, -12.68, 0.01);
      this.box(4.1, 0.02, 0.03, 0xe5f4db, x, 4.6, -12.66, 0);
    }
    this.box(5.3, 1.22, 0.22, 0xfff6d1, 0, 1.94, -12.76, 0.1);
    this.textPlane("POOL PANIC", 4.95, 0.74, "#fff6d1", "#167b84", 0, 2.04, -12.637, this.scene, 87);
    this.textPlane("SWIM CLUB · EST. 1986", 4.3, 0.23, "#fff6d1", "#558480", 0, 1.6, -12.63, this.scene, 30);
    // Open locker portals on opposite sides. Partitions expose colorful lockers inside.
    this.locker(-10.7, -10.8, "MEN", colors.teal);
    this.locker(10.7, -10.8, "WOMEN", colors.coral);
    // Office entrance and the bulletin board, each furnished rather than a flat sign.
    this.box(3.8, 2.2, 0.17, 0xc19858, 4.8, 1.72, -12.73, 0.07);
    this.box(3.6, 2, 0.07, 0x9e754e, 4.8, 1.72, -12.6, 0.025);
    this.textPlane("CLUB NEWS", 3.4, 0.35, "#f8e8b5", "#72563d", 4.8, 2.88, -12.61, this.scene, 45);
    const notices = [
      ["SWIM MEET", 0xfdf1c9],
      ["LOST GOGGLES", 0xdbebcf],
      ["AQUA CLUB", 0xf8d6ad],
      ["NO RUNNING", 0xdce8dd],
      ["OPEN 7–9", 0xfff8dc],
    ];
    notices.forEach(([s, color], i) => {
      const x = 3.55 + (i % 3) * 1.2,
        y = 2.05 - Math.floor(i / 3) * 0.8;
      const g = new THREE.Group();
      g.position.set(x, y, -12.51);
      g.rotation.z = i % 2 ? 0.08 : -0.07;
      this.scene.add(g);
      this.box(0.92, 0.66, 0.02, color, 0, 0, 0, 0.005, g);
      this.textPlane(s, 0.82, 0.17, "#" + color.toString(16), "#5c7268", 0, 0.13, 0.018, g, 31);
      for (let k = 0; k < 3; k++)
        this.box(0.56 - k * 0.06, 0.025, 0.012, 0x9aaf9b, 0, -0.05 - k * 0.08, 0.015, 0, g);
      this.ball(0.034, colors.coral, 0, 0.3, 0.03, g);
    });
    // Oversized pool clock and safety kit.
    const clock = this.cyl(0.61, 0.61, 0.12, colors.navy, -6, 2.08, -12.59);
    clock.rotation.x = Math.PI / 2;
    const face = this.cyl(0.53, 0.53, 0.14, 0xfff5d7, -6, 2.08, -12.48);
    face.rotation.x = Math.PI / 2;
    this.rod([-6, 2.08, -12.37], [-6, 2.45, -12.37], 0.03, colors.navy);
    this.rod([-6, 2.08, -12.34], [-5.72, 1.96, -12.34], 0.035, colors.coral);
    for (const object of this.scene.children.slice(rearStart)) object.position.z -= 3.2;
    this.buildOffice();
    // Low side walls keep the tabletop silhouette open.
    for (const x of [-14.8, 14.8]) {
      this.box(0.32, 1.1, 25.2, 0x447d7a, x, 0.5, 0, 0.11);
      this.box(0.52, 0.16, 25.5, 0xcda477, x, 1.09, 0, 0.07);
    }
    this.bench(-10.2, -0.9, Math.PI / 2);
    this.bench(10.3, -0.5, Math.PI / 2);
    this.bench(-9.8, 3.3, Math.PI / 2);
    // Rolled towels, bags and flip-flops on and around the benches.
    this.box(0.6, 0.35, 0.5, 0xf0b655, -9.9, 0.77, -1.4, 0.09);
    this.box(0.8, 0.25, 0.45, 0xafd2b1, -9.8, 0.8, 3.3, 0.07);
    this.box(0.45, 0.55, 0.5, 0x697ea6, 10.5, 0.3, -1.5, 0.12);
    this.rod([10.35, 0.52, -1.5], [10.35, 0.77, -1.5], 0.03, 0x274d63);
    for (let i = 0; i < 2; i++) this.box(0.2, 0.05, 0.45, colors.coral, -8.7 + i * 0.3, 0.055, 4.3, 0.04);
    this.plant(-13, 10.6, 0.85);
    // Equipment rack: exactly three pairs, updated from simulation inventory.
    const finsG = new THREE.Group();
    finsG.position.set(STATIONS.fins.x, 0, STATIONS.fins.z);
    finsG.rotation.y = -Math.PI / 2;
    this.scene.add(finsG);
    for (const x of [-0.85, 0.85]) {
      this.box(0.11, 1.72, 0.13, colors.navy, x, 0.86, 0, 0.035, finsG);
      this.box(0.5, 0.12, 0.85, colors.navy, x, 0.06, 0, 0.025, finsG);
    }
    this.box(1.85, 0.12, 0.2, colors.navy, 0, 1.65, 0, 0.025, finsG);
    this.box(1.7, 0.12, 0.8, 0xe8bb73, 0, 0.54, 0, 0.025, finsG);
    this.finPairs = [];
    for (let i = 0; i < 3; i++) {
      const g = this.finsObject();
      g.position.set(-0.57 + i * 0.57, 0.82, -0.05);
      g.rotation.x = -0.2;
      finsG.add(g);
      this.finPairs.push(g);
    }
    this.textPlane("FIN RENTAL", 1.72, 0.34, "#fff1ce", "#245c63", 0, 1.99, 0.04, finsG, 45);
    this.stationHit("fins", STATIONS.fins, 2.2, 2.3);
    this.labels.push({ text: "E · FIN RACK", x: STATIONS.fins.x, y: 2.55, z: STATIONS.fins.z });
    this.station("chlorine", colors.yellow, "WATER CARE");
    this.station("relief", 0xddf3d7, "FIRST AID");
    // Pool ladders with rails and submerged rungs.
    for (const [x, z] of [
      [-5, 5],
      [5, -4.1],
    ]) {
      for (const zz of [z - 0.45, z + 0.45]) {
        const points = [
          new THREE.Vector3(x, -0.95, zz),
          new THREE.Vector3(x, 0.4, zz),
          new THREE.Vector3(x + (x < 0 ? -0.45 : 0.45), 0.8, zz),
          new THREE.Vector3(x + (x < 0 ? -0.7 : 0.7), 0.3, zz),
          new THREE.Vector3(x + (x < 0 ? -0.7 : 0.7), 0.03, zz),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        this.mesh(new THREE.TubeGeometry(curve, 16, 0.047, 7, false), 0xdfe5d6);
      }
      for (const y of [-0.85, -0.45, -0.1]) this.rod([x, y, z - 0.45], [x, y, z + 0.45], 0.055, 0xe7e9d8);
    }
    // A lifeguard chair, lane etiquette signs, and a small drink fountain.
    const lg = new THREE.Group();
    lg.position.set(12.2, 0, -7.3);
    this.scene.add(lg);
    for (const x of [-0.48, 0.48])
      for (const z of [-0.4, 0.4]) this.rod([x, 0, z], [x * 0.8, 1.8, z * 0.7], 0.07, colors.navy, lg);
    this.box(1.1, 0.16, 0.9, 0xf0bc51, 0, 1.8, 0, 0.055, lg);
    this.box(1.1, 0.7, 0.12, 0xf0bc51, 0, 2.14, -0.39, 0.045, lg);
    for (let i = 0; i < 4; i++) this.box(0.85, 0.06, 0.16, 0xedddad, 0, 0.32 + i * 0.35, 0.51, 0.025, lg);
    this.box(0.9, 0.85, 0.78, 0x77afb4, -12.9, 0.45, 5.5, 0.12);
    this.box(1.04, 0.18, 0.92, 0xdae4d8, -12.9, 0.97, 5.5, 0.1);
    this.rod([-12.7, 1.03, 5.3], [-12.7, 1.22, 5.3], 0.055, colors.navy);
    this.textPlane(
      "NO RUNNING",
      2.8,
      0.47,
      "#e8eee3",
      "#be8363",
      0,
      0.025,
      12.45,
      this.scene,
      58,
    ).rotation.x = -Math.PI / 2;
    this.buildSanitation();
    this.buildRescue();
    // Continuous tiled surroundings replace the empty mint space around the room.
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#9a785d";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#a78060";
    ctx.fillRect(2, 2, 61, 61);
    ctx.fillRect(66, 66, 60, 60);
    ctx.fillStyle = "#a37b5d";
    ctx.fillRect(66, 2, 60, 61);
    ctx.fillRect(2, 66, 61, 60);
    const tiles = new THREE.CanvasTexture(canvas);
    tiles.colorSpace = THREE.SRGBColorSpace;
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(35, 35);
    tiles.anisotropy = 4;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ map: tiles, color: 0xbca58a, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.95;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }
  batchStatic() {
    // Bake fixed furniture into material batches; flags, water, inventory and agents stay live.
    this.scene.updateMatrixWorld(true);
    const live = new Set([
        ...this.flags,
        ...this.finPairs,
        ...this.lockerDoors.map((d) => d.hinge),
        this.sanitationGroup,
        ...this.ringModels,
      ]),
      batches = new Map();
    this.scene.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || !m.material.isMeshStandardMaterial) return;
      for (let p = m; p; p = p.parent) if (live.has(p)) return;
      const key = m.material.uuid + ":" + m.castShadow + ":" + m.receiveShadow;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(m);
    });
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
      let vertexCount = 0,
        indexCount = 0;
      for (const g of geometries) {
        vertexCount += g.attributes.position.count;
        indexCount += g.index?.count || g.attributes.position.count;
      }
      const positions = new Float32Array(vertexCount * 3),
        normals = new Float32Array(vertexCount * 3),
        uv = new Float32Array(vertexCount * 2),
        indices = new Uint32Array(indexCount);
      let v = 0,
        j = 0;
      for (const g of geometries) {
        const count = g.attributes.position.count;
        positions.set(g.attributes.position.array, v * 3);
        normals.set(g.attributes.normal.array, v * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, v * 2);
        if (g.index) {
          for (const index of g.index.array) indices[j++] = index + v;
        } else for (let i = 0; i < count; i++) indices[j++] = v + i;
        v += count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeBoundingSphere();
      const merged = new THREE.Mesh(geo, meshes[0].material);
      merged.castShadow = meshes[0].castShadow;
      merged.receiveShadow = meshes[0].receiveShadow;
      this.scene.add(merged);
      for (const m of meshes) m.removeFromParent();
    }
  }
  locker(x, z, name, color) {
    const side = Math.sign(x),
      g = new THREE.Group();
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.box(5.3, 3.2, 0.23, 0x82a79b, 0, 1.6, -2.3, 0.09, g);
    for (const xx of [-2.65, 2.65]) {
      if (Math.sign(xx) === side) this.box(0.2, 3.2, 2.7, 0x71978d, xx, 1.6, -1.06, 0.08, g);
      else {
        this.box(0.2, 3.2, 1.1, 0x71978d, xx, 1.6, -1.9, 0.06, g);
        this.box(0.24, 0.62, 1.55, color, xx, 2.9, -0.38, 0.05, g);
      }
    }
    this.box(5.5, 0.36, 0.6, color, 0, 3.25, 0.03, 0.07, g);
    for (const xx of [-2.17, 2.17]) this.box(0.52, 3.1, 0.48, color, xx, 1.55, 0.02, 0.05, g);
    this.textPlane(name, 4.6, 0.52, "#" + color.toString(16), "#f4dba5", 0, 3.3, 0.35, g, 72);
    for (let i = 0; i < 5; i++) {
      const xx = -1.92 + i * 0.95;
      this.box(0.84, 2.45, 0.26, i % 2 ? 0x639d99 : color, xx, 1.27, -2.09, 0.025, g);
      this.box(0.055, 0.22, 0.07, 0xdaba71, xx + 0.25, 1.33, -1.91, 0.018, g);
      for (let k = 0; k < 3; k++) this.box(0.42, 0.032, 0.02, 0x376f78, xx, 2.11 - k * 0.1, -1.937, 0, g);
    }
    this.box(3.7, 0.03, 1.5, 0xbf8954, 0, 0.025, -0.32, 0.09, g);
    for (let i = 0; i < 10; i++)
      this.box(0.04, 0.04, 1.4, 0x95653f, -1.67 + i * 0.37, 0.045, -0.32, 0.008, g);
    this.box(3.1, 0.15, 0.65, 0xc8945e, 0, 0.58, -1.17, 0.045, g);
    for (const xx of [-1.1, 1.1]) this.box(0.1, 0.5, 0.4, colors.navy, xx, 0.27, -1.17, 0.02, g);
    // A real hinged door on the pool-facing side, aligned with the emerging swimmer's route.
    const inner = -side * 2.65;
    for (const zz of [-1.13, 0.3]) this.box(0.3, 2.7, 0.13, colors.navy, inner, 1.35, zz, 0.03, g);
    const hinge = new THREE.Group();
    hinge.position.set(inner, 0, -1.08);
    g.add(hinge);
    this.box(0.13, 2.5, 1.34, color, 0, 1.28, 0.67, 0.065, hinge);
    this.box(0.16, 0.67, 0.58, 0x90c3bd, 0, 1.72, 0.69, 0.045, hinge);
    this.box(0.17, 0.12, 0.72, 0xd6bd89, 0, 0.55, 0.7, 0.025, hinge);
    this.ball(0.095, 0xe5be58, -side * 0.16, 1.13, 1.18, hinge);
    this.lockerDoors ??= [];
    this.lockerDoors.push({ side, hinge });
  }

  bench(x, z, angle = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    this.scene.add(g);
    for (const xx of [-1.32, 1.32]) {
      this.box(0.16, 0.55, 0.7, colors.navy, xx, 0.28, 0, 0.035, g);
      this.box(0.16, 1.12, 0.12, colors.navy, xx, 0.61, -0.32, 0.03, g);
    }
    for (let k = 0; k < 3; k++) this.box(3.3, 0.14, 0.21, colors.wood, 0, 0.61, -0.23 + k * 0.23, 0.035, g);
    for (let k = 0; k < 2; k++) this.box(3.3, 0.22, 0.11, 0xdeac72, 0, 0.95 + k * 0.25, -0.34, 0.035, g);
  }
  plant(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    this.scene.add(g);
    this.cyl(0.5, 0.35, 0.7, 0xdf9669, 0, 0.35, 0, g);
    this.cyl(0.43, 0.43, 0.06, 0x6e7451, 0, 0.71, 0, g);
    this.rod([0, 0.7, 0], [0.04, 2.25, 0], 0.07, 0x679271, g);
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7,
        leaf = this.ball(
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
  station(item, color, title) {
    const p = STATIONS[item],
      g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    if (item === "chlorine") g.rotation.y = -Math.PI / 2;
    this.scene.add(g);
    this.box(1.6, 1.12, 1.0, color, 0, 0.57, 0, 0.12, g);
    this.box(1.8, 0.16, 1.2, 0xffefd0, 0, 1.16, 0, 0.06, g);
    for (const x of [-0.39, 0.39]) this.box(0.65, 0.7, 0.035, 0xf2f0d3, x, 0.56, 0.52, 0.04, g);
    this.box(0.07, 0.2, 0.08, colors.navy, 0.1, 0.58, 0.56, 0.02, g);
    if (item === "chlorine") {
      this.cyl(0.26, 0.22, 0.52, 0xffe7aa, -0.42, 1.5, 0, g);
      this.cyl(0.27, 0.27, 0.08, colors.teal, -0.42, 1.78, 0, g);
      this.bucket(0.4, 1.37, 0, g);
      this.textPlane("Cl", 0.3, 0.28, "#ffe7aa", "#438b8a", -0.42, 1.5, 0.25, g, 80);
    } else {
      this.box(0.6, 0.68, 0.2, 0xffffe4, -0.35, 1.56, 0, 0.08, g);
      this.box(0.35, 0.1, 0.04, colors.coral, -0.35, 1.56, 0.12, 0.005, g);
      this.box(0.1, 0.35, 0.04, colors.coral, -0.35, 1.56, 0.125, 0.005, g);
      this.cyl(0.1, 0.12, 0.3, 0x64bcca, 0.43, 1.44, 0, g);
      this.cyl(0.08, 0.1, 0.14, 0xffffe5, 0.43, 1.65, 0, g);
    }
    this.textPlane(title, 1.8, 0.31, "#fff1ce", "#32656b", 0, 2.09, 0.03, g, 42);
    this.stationHit(item, p, 2, 2.4);
    this.labels.push({
      text: item === "chlorine" ? "E · CHLORINE" : "E · EYE RELIEF",
      x: p.x,
      y: 2.6,
      z: p.z,
    });
  }
  stationHit(item, p, w, h) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 1.8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    m.position.set(p.x, h / 2, p.z);
    if (item === "fins" || item === "chlorine") m.rotation.y = -Math.PI / 2;
    m.userData = { kind: "station", item };
    this.scene.add(m);
    this.clickables.push(m);
  }
  finsObject() {
    const g = new THREE.Group();
    for (const x of [-0.14, 0.14]) {
      const m = this.box(0.22, 0.51, 0.08, colors.yellow, x, 0, 0, 0.035, g);
      m.rotation.z = x > 0 ? -0.06 : 0.06;
      this.box(0.14, 0.16, 0.11, colors.teal, x, 0.15, 0.015, 0.03, g);
    }
    return g;
  }
  bucket(x, y, z, parent) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    this.cyl(0.28, 0.21, 0.38, colors.yellow, 0, 0, 0, g);
    this.cyl(0.24, 0.24, 0.025, 0xa5c8ad, 0, 0.198, 0, g);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 6, 16, Math.PI), this.mat(colors.navy));
    hoop.position.y = 0.15;
    g.add(hoop);
    return g;
  }
  character(p) {
    const g = new THREE.Group(),
      root = new THREE.Group();
    g.add(root);
    const isCoach = p.type === "coach",
      info = TYPES[p.type] || { color: "#f5c652" };
    const skins = [0xe6aa80, 0xf0c29b, 0xa76d51, 0xc78e65, 0x784e3f];
    const skin = p.queasy ? 0xc0c996 : skins[p.skin % 5];
    const suit = isCoach ? 0xf2bc40 : new THREE.Color(info.color);
    const body = this.ball(0.38, suit, 0, 0.76, 0, root, [1.08, 1.24, 0.8]);
    const head = this.ball(0.34, skin, 0, 1.42, 0, root, [1, 1.08, 0.96]);
    const cap = this.ball(0.343, isCoach ? colors.navy : suit, 0, 1.58, -0.028, root, [1, 0.64, 1]);
    if (isCoach) this.box(0.55, 0.06, 0.23, colors.navy, 0, 1.63, 0.26, 0.04, root);
    else {
      this.box(0.64, 0.12, 0.16, 0x194c61, 0, 1.47, 0.26, 0.05, root);
      for (const x of [-0.15, 0.15]) this.box(0.2, 0.092, 0.04, 0xbfe8db, x, 1.47, 0.355, 0.03, root);
    }
    for (const x of [-0.34, 0.34]) this.ball(0.077, skin, x, 1.43, 0, root);
    if (isCoach) {
      for (const x of [-0.105, 0.105]) this.ball(0.035, colors.navy, x, 1.45, 0.3, root);
      this.rod([-0.16, 1.1, 0.24], [0, 0.88, 0.31], 0.018, colors.navy, root);
      this.ball(0.055, 0xf7f6d9, 0, 0.88, 0.33, root);
    } else this.box(0.12, 0.035, 0.03, 0x9d5f48, 0, 1.3, 0.321, 0.01, root);
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.34, 1.01, 0);
      root.add(arm);
      this.ball(0.115, skin, side * 0.025, -0.23, 0, arm, [0.85, 2.5, 0.85]);
      this.ball(0.112, skin, side * 0.035, -0.46, 0, arm);
      arms.push(arm);
    }
    const legs = [];
    for (const x of [-0.17, 0.17]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.45, 0);
      root.add(leg);
      this.ball(0.12, isCoach ? colors.navy : skin, 0, -0.2, 0, leg, [1, 2.2, 1]);
      this.ball(0.135, isCoach ? 0xfff4d9 : skin, 0, -0.4, 0.07, leg, [0.9, 0.6, 1.45]);
      legs.push(leg);
    }
    const f = this.finsObject();
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
    hit.userData = { kind: "swimmer", id: p.id };
    g.add(hit);
    if (!isCoach) this.clickables.push(hit);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 18),
      new THREE.MeshBasicMaterial({ color: 0x316d72, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.035;
    g.add(shadow);
    const soreEyes = new THREE.Group();
    soreEyes.name = "sore-eyes";
    head.add(soreEyes);
    for (const x of [-0.13, 0.13]) this.ball(0.095, 0xff514d, x, 0.05, 0.39, soreEyes, [1, 0.62, 0.4]);
    soreEyes.visible = false;
    g.userData = {
      soreEyes,
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
      phase: p.phase || 0,
      carryKind: null,
    };
    return g;
  }
  lifeRingObject() {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.13, 10, 32), this.mat(0xf47742));
    g.add(torus);
    torus.castShadow = true;
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.137, 10, 6, 0.35), this.mat(0xfff4d9));
      band.rotation.z = (i * Math.PI) / 2 - 0.175;
      g.add(band);
    }
    return g;
  }
  buildOffice() {
    const g = new THREE.Group();
    g.position.set(14.3, 0, 9.5);
    g.rotation.y = -Math.PI / 2;
    this.scene.add(g);
    this.box(3.5, 3.1, 0.2, 0x277982, 0, 1.55, 0, 0.08, g);
    this.box(2.85, 2.35, 0.12, 0x8ac0bd, 0, 1.4, 0.15, 0.04, g);
    this.box(0.1, 2.4, 0.16, 0xf0e8c6, 0, 1.4, 0.24, 0.01, g);
    this.box(2.9, 0.1, 0.16, 0xf0e8c6, 0, 1.6, 0.24, 0.01, g);
    this.textPlane("MAIN OFFICE", 3.1, 0.43, "#fff1cd", "#296879", 0, 2.88, 0.18, g, 44);
    this.box(2.5, 0.85, 0.8, 0xb38a5d, 0, 0.47, 1.3, 0.08, g);
    this.box(2.7, 0.13, 0.94, 0xefd498, 0, 0.94, 1.3, 0.05, g);
    this.box(0.62, 0.42, 0.07, 0x295d68, -0.4, 1.24, 1.2, 0.04, g);
    this.box(0.25, 0.15, 0.1, 0x295d68, -0.4, 1.02, 1.2, 0.02, g);
    this.box(0.43, 0.06, 0.32, 0xf7f3dc, 0.7, 1.04, 1.5, 0.005, g);
  }
  buildRescue() {
    this.ringModels = [];
    this.ringHits = [];
    this.ringGlows = [];
    this.ringLights = [];
    for (const [id, p] of RING_MOUNTS.entries()) {
      const mount = new THREE.Group();
      mount.position.set(p.x, 0, p.z);
      mount.rotation.y = p.angle;
      this.scene.add(mount);
      this.box(1.65, 2.5, 0.13, 0x277982, 0, 1.3, -0.18, 0.09, mount);
      this.rod([0, 2.3, -0.12], [0, 2.3, 0.13], 0.055, colors.navy, mount);
      this.textPlane("LIFE RING", 1.65, 0.32, "#fff1ce", "#245c63", 0, 2.72, 0.04, mount, 45);
      const model = this.lifeRingObject();
      model.position.set(p.x, 1.65, p.z);
      model.rotation.y = p.angle;
      this.scene.add(model);
      this.ringModels.push(model);
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.userData = { kind: "lifering", ringId: id };
      this.scene.add(hit);
      this.clickables.push(hit);
      this.ringHits.push(hit);
      const glow = new THREE.Group();
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(1.05, 40),
        new THREE.MeshBasicMaterial({
          color: 0xffca49,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      );
      disk.rotation.x = -Math.PI / 2;
      glow.add(disk);
      glow.add(this.ring(1.15, 0xffed8d));
      glow.visible = false;
      this.scene.add(glow);
      this.ringGlows.push(glow);
      const light = new THREE.PointLight(0xffcf57, 0, 4, 2);
      this.scene.add(light);
      this.ringLights.push(light);
      this.labels.push({ text: "E · LIFE RING", ...p, y: 3.1, minLevel: 2 });
    }
    this.lifeRingModel = this.ringModels[0];
    this.lifeRingHit = this.ringHits[0];
  }
  syncRescue(sim, time) {
    for (const r of sim.lifeRings || []) {
      const g = this.ringModels[r.id],
        hit = this.ringHits[r.id],
        glow = this.ringGlows[r.id],
        light = this.ringLights[r.id];
      g.visible = r.state !== "coach";
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      const pulse = this.reducedMotion.matches ? 1 : 0.5 + 0.5 * Math.sin(time * 5);
      if (r.state === "wall") {
        g.position.set(r.mount.x, 1.65, r.mount.z);
        g.rotation.y = r.mount.angle;
        if (sim.rescue) g.scale.setScalar(1.04 + pulse * 0.08);
      } else if (r.state === "deck") {
        g.position.set(r.x, 0.17, r.z);
        g.rotation.x = -Math.PI / 2;
      } else if (r.state === "victim") {
        const p = sim.get(r.owner);
        if (p) {
          const y =
            p.exitPhase === "water" ? -0.1 : p.exitPhase === "climb" ? -0.1 + p.exitProgress * 0.9 : 0.8;
          g.position.set(p.x, y, p.z);
          g.rotation.x = -Math.PI / 2;
        }
      }
      hit.position.copy(g.position);
      if (r.state === "coach") hit.position.set(r.mount.x, 1.65, r.mount.z);
      hit.layers.mask = sim.level >= 2 && ["wall", "deck", "coach"].includes(r.state) ? 1 : 0;
      glow.visible = !!sim.rescue && ["wall", "deck"].includes(r.state);
      const a = r.state === "wall" ? r.mount.angle : 0;
      glow.position.set(r.x + Math.sin(a) * 0.55, 0.035, r.z + Math.cos(a) * 0.55);
      glow.scale.setScalar(0.93 + pulse * 0.16);
      glow.children[0].material.opacity = 0.22 + pulse * 0.24;
      light.position.set(glow.position.x, 0.65, glow.position.z);
      light.intensity = glow.visible ? 1.8 + pulse * 2 : 0;
    }
  }
  buildGuidance() {
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.guideAura = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.57, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffdf52,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    shell.position.y = 0.94;
    shell.scale.set(1, 1.8, 1);
    this.guideAura.add(shell);
    const halo = this.ring(0.76, 0xffdf52);
    halo.position.y = 0.07;
    this.guideAura.add(halo);
    this.guideAura.userData = { shell, halo };
    this.scene.add(this.guideAura);
    this.laneRims = LANES.map((x) => {
      const points = [
        [-1.43, -7.9],
        [1.43, -7.9],
        [1.43, 7.9],
        [-1.43, 7.9],
      ].map(([a, b]) => new THREE.Vector3(x + a, -0.13, b));
      const rim = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
      );
      this.scene.add(rim);
      return rim;
    });
    // Fixed, reusable speed streaks. No particle allocation in the dash loop.
    this.dashTrail = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.65 + i * 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffed92, transparent: true, opacity: 0.7, depthWrite: false }),
      );
      line.position.set(
        (i % 2 ? 1 : -1) * (0.25 + Math.floor(i / 2) * 0.18),
        0.3 + (i % 2) * 0.24,
        -0.9 - Math.floor(i / 2) * 0.2,
      );
      this.dashTrail.add(line);
    }
    this.scene.add(this.dashTrail);
  }
  addPerson(p) {
    const g = this.character(p);
    this.people.set(p.id, g);
    this.scene.add(g);
    return g;
  }
  removePerson(id) {
    const g = this.people.get(id);
    if (!g) return;
    this.clickables = this.clickables.filter((x) => x !== g.userData.hit);
    this.scene.remove(g);
    this.people.delete(id);
  }
  slipPose(u, remaining, duration) {
    if (!(remaining > 0)) return;
    const elapsed = 1 - Math.min(1, remaining / duration),
      smooth = (t) => {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
      };
    const down = this.reducedMotion.matches
      ? 1
      : elapsed < 0.22
        ? smooth(elapsed / 0.22)
        : elapsed > 0.58
          ? 1 - smooth((elapsed - 0.58) / 0.42)
          : 1;
    // Characters face local +Z: negative X rotation puts their back on the deck.
    u.root.rotation.set((-Math.PI / 2) * down, 0, 0);
    u.root.position.set(0, 0.37 * down, -0.12 * down);
    u.arms.forEach((a, i) => a.rotation.set(-1.15 * down, 0, (i ? -0.35 : 0.35) * down));
    u.legs.forEach((l) => (l.rotation.x = 0.24 * down));
  }
  sync(sim, time, dt = 0.016) {
    this.clock = time;
    for (const door of this.lockerDoors)
      door.hinge.rotation.y = door.side * 1.35 * doorOpening(sim.doors?.[door.side] || 0);
    const guide = guidanceState(sim),
      pulse = cuePulse(time, this.reducedMotion.matches);
    this.syncSanitation(sim, time);
    this.water.material.uniforms.uTime.value = time;
    this.water.material.uniforms.uDirty.value = sim.contamination / 100;
    this.water.material.uniforms.uBrown.value = sim.waterBrown || 0;
    this.flags.forEach((f, i) => {
      f.rotation.x = Math.sin(time * 1.4 + i * 0.5) * 0.06;
    });
    const active = new Set();
    for (const p of sim.people) {
      if (p.status === "gone") continue;
      active.add(p.id);
      const g = this.people.get(p.id) || this.addPerson(p);
      const u = g.userData;
      const swim =
        (p.status === "swim" && p.type !== "aqua") ||
        (p.status === "evacuating" && p.evacWater) ||
        (p.status === "exit" && p.exitPhase === "water");
      const walking =
        p.status === "enter" ||
        (p.status === "exit" && !["water", "climb"].includes(p.exitPhase)) ||
        (p.status === "evacuating" && !p.evacWater) ||
        (p.status === "arriving" && p.arrivalHold <= 0) ||
        (p.status === "recovering" && p.recoveryStage === "to-bench");
      g.position.set(p.x, swim ? -0.39 : p.status === "swim" ? -0.75 : 0, p.z);
      g.rotation.y = p.angle || 0;
      u.root.rotation.set(0, 0, 0);
      u.root.position.y = 0;
      u.legs.forEach((l) => (l.visible = true));
      u.f.visible = p.hasFins;
      u.hit.position.y = swim ? 0.25 : 0.9;
      u.shadow.visible = !swim && p.status !== "swim";
      if (swim) {
        u.root.rotation.x = Math.PI / 2;
        u.root.position.y = 0.27;
        u.root.scale.setScalar(0.85);
        u.root.position.z = -0.65;
        const tempo = p.status === "evacuating" ? 12 : p.problem ? 0 : p.actualSpeed * 3.2;
        u.arms.forEach((a, i) => {
          a.rotation.set(Math.sin(time * tempo + u.phase + i * Math.PI) * 1.4, 0, i === 0 ? -0.2 : 0.2);
        });
        u.legs.forEach((l, i) => {
          l.rotation.x = Math.sin(time * tempo * 1.4 + i * Math.PI) * 0.35;
        });
        if (p.h < 35) u.root.rotation.z = Math.sin(time * 10) * 0.06;
      } else {
        u.root.scale.setScalar(0.94 + (p.shape || 0) * 0.12);
        u.root.position.z = 0;
        const tempo = walking ? time * 9 : time * 2.2;
        const movement = walking ? 0.55 : p.type === "aqua" ? 0.8 : 0.09;
        u.arms.forEach((a, i) => {
          a.rotation.set(
            Math.sin(tempo + u.phase + i * Math.PI) * movement,
            0,
            p.type === "aqua" ? Math.sin(tempo) * 0.9 * (i ? 1 : -1) : 0,
          );
        });
        u.legs.forEach((l, i) => {
          l.rotation.x = walking ? Math.sin(tempo + i * Math.PI) * 0.52 : 0;
        });
        u.root.position.y = Math.sin(tempo * 2) * (walking ? 0.025 : 0.017);
        if (p.queasy) u.root.rotation.z = Math.sin(time * 2.6) * 0.085;
      }
      if (p.exitPhase === "climb" && p.status === "exit") {
        const t = p.exitProgress;
        g.position.y = -0.39 * (1 - t);
        u.root.rotation.x = (Math.PI / 2) * (1 - t);
        u.root.position.y = 0.27 * (1 - t);
        u.root.position.z = -0.65 * (1 - t);
        u.arms.forEach((a) => a.rotation.set(-1.5 * (1 - t), 0, 0));
        u.legs.forEach((l) => (l.rotation.x = -0.5 * Math.sin(t * Math.PI)));
      }
      u.soreEyes.visible = p.problem === "eyes";
      if (p.stomachWarning && !swim) {
        u.arms[0].rotation.x = -1.1;
        u.root.rotation.z = Math.sin(time * 4) * 0.08;
      }
      if (p.status === "panic" || (sim.cleanup && p.status === "queue")) {
        u.arms.forEach((a, i) => a.rotation.set(0, 0, i ? -2.7 : 2.7));
        u.root.position.y = this.reducedMotion.matches ? 0 : Math.abs(Math.sin(time * 8 + u.phase)) * 0.42;
        u.legs.forEach((l) => (l.rotation.x = -0.15));
      }
      if (!swim && p.status !== "swim") {
        const lean = bumpLean(p, this.reducedMotion.matches);
        u.root.rotation.x += lean.x;
        u.root.rotation.z += lean.z;
      }
      if (waitingInWater(sim, p) || (p.status === "exit" && p.rescueRecover && p.exitPhase === "water")) {
        const struggling = sim.rescue?.victim === p.id && p.problem === "cramp",
          motion = this.reducedMotion.matches ? 0 : 1;
        const wave = Math.sin(time * (struggling ? 8 : 3) + u.phase);
        g.position.y = -0.82;
        u.root.rotation.set(
          struggling ? wave * 0.09 * motion : 0,
          0,
          struggling ? Math.sin(time * 5 + u.phase) * 0.12 * motion : 0,
        );
        u.root.position.set(0, wave * (struggling ? 0.15 : 0.065) * motion, 0);
        u.root.scale.setScalar(1);
        u.shadow.visible = false;
        u.hit.position.y = 0.9;
        u.arms.forEach((a, i) => {
          const paddle = Math.sin(time * (struggling ? 10 : 3) + u.phase + i * Math.PI) * motion;
          a.rotation.set(
            struggling ? 0.25 + paddle * 0.5 : paddle * 0.08,
            0,
            p.rescueRecover ? (i ? -0.6 : 0.6) : (i ? -1 : 1) * (2.7 + paddle * (struggling ? 0.3 : 0.07)),
          );
        });
        u.legs.forEach((l) => {
          l.rotation.x = 0;
          l.visible = false;
        });
        u.f.visible = false;
      }
      if (p.status === "recovering" && p.recoveryStage === "resting") {
        g.position.y = 0.22;
        u.root.position.set(0, 0, 0);
        u.root.rotation.set(0, 0, 0);
        u.legs.forEach((l) => (l.rotation.x = -Math.PI / 2));
        u.arms.forEach((a) => a.rotation.set(-0.3, 0, 0));
      }
      if (!swim && p.status !== "swim") this.slipPose(u, p.slipTime, 0.65);
      if (p.status === "swim" && p.actualSpeed > 0.3 && Math.random() < 0.04)
        this.splash(p.x, -0.16, p.z, 2, true);
    }
    for (const id of this.people.keys()) if (!active.has(id)) this.removePerson(id);
    const c = sim.coach,
      cg = this.coach,
      cu = cg.userData;
    if (this.viewDirection && sim.status !== "ready") this.followCoach(c, dt);
    cg.position.set(c.x, c.y || 0, c.z);
    const angle = c.angle || 0;
    cg.rotation.y += Math.atan2(Math.sin(angle - cg.rotation.y), Math.cos(angle - cg.rotation.y)) * 0.3;
    const walking = Math.hypot(c.vx || 0, c.vz || 0) > 0.2,
      air = (c.y || 0) > 0.03;
    cu.root.position.z = 0;
    cu.carry.position.set(0.58, 0.9, 0.25);
    cu.carry.rotation.set(0, 0, 0);
    cu.arms.forEach((a) => (a.rotation.z = 0));
    cu.arms.forEach(
      (a, i) =>
        (a.rotation.x =
          c.carry && i === 1 ? -0.9 : air ? -0.5 : walking ? Math.sin(time * 12 + i * Math.PI) * 0.65 : 0),
    );
    cu.legs.forEach(
      (l, i) => (l.rotation.x = air ? -0.3 : walking ? Math.sin(time * 12 + i * Math.PI) * 0.65 : 0),
    );
    cu.root.position.y = walking && !air ? Math.abs(Math.sin(time * 12)) * 0.045 : 0;
    cu.root.rotation.z = 0;
    cu.root.rotation.x = c.dashTime > 0 && !this.reducedMotion.matches ? 0.25 : 0;
    this.dashTrail.visible = c.dashTime > 0 && sim.status === "playing" && !this.reducedMotion.matches;
    this.dashTrail.position.copy(cg.position);
    this.dashTrail.rotation.y = c.angle;
    const coachLean = bumpLean(c, this.reducedMotion.matches);
    cu.root.rotation.x += coachLean.x;
    cu.root.rotation.z += coachLean.z;
    const scaleY = c.landing ? 1 - 0.17 * (c.landing / 0.18) : air ? 1 + Math.max(0, c.vy || 0) * 0.017 : 1;
    cu.root.scale.set(1 / Math.sqrt(scaleY), scaleY, 1 / Math.sqrt(scaleY));
    cu.shadow.position.y = 0.03 - (c.y || 0);
    cu.shadow.scale.setScalar(1 + (c.y || 0) * 0.25);
    this.coachHalo.position.set(c.x, 0.034, c.z);
    this.coachHalo.scale.setScalar(c.dashTime > 0 ? 1.18 : 1);
    this.coachHalo.visible = sim.status !== "ready";
    const nearby = sim.nearestInteraction(),
      marker = nearby || c.goal;
    this.actionHalo.visible = !!marker && sim.status === "playing";
    if (marker) {
      this.actionHalo.position.set(marker.x, 0.055, marker.z);
      this.actionHalo.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    }
    cu.carry.visible = !!c.carry;
    cu.carry.scale.setScalar(1 + (c.feedback || 0) * 1.1);
    if (c.carry !== cu.carryKind) {
      cu.carry.clear();
      cu.carryKind = c.carry;
      if (c.carry === "fins") cu.carry.add(this.finsObject());
      else if (c.carry === "lifering") cu.carry.add(this.lifeRingObject());
      else if (c.carry === "skimmer") cu.carry.add(this.skimmerObject());
      else if (c.carry === "chlorine") this.bucket(0, 0, 0, cu.carry);
      else if (c.carry === "relief") {
        this.cyl(0.12, 0.12, 0.36, 0x78c7ce, 0, 0, 0, cu.carry);
        this.cyl(0.08, 0.11, 0.1, 0xf9f2cf, 0, 0.24, 0, cu.carry);
      } else if (c.carry === "goggles") {
        this.box(0.44, 0.12, 0.14, colors.navy, 0, 0, 0, 0.03, cu.carry);
        for (const x of [-0.12, 0.12]) this.box(0.15, 0.1, 0.03, 0xbfe8db, x, 0, 0.08, 0.02, cu.carry);
      }
    }
    if (c.carry === "lifering") {
      cu.carry.position.set(0, 1.02, 0.55);
      cu.arms.forEach((a) => a.rotation.set(-1.15, 0, 0));
    }
    if (c.swimming || c.waterTransition) {
      const transition = c.waterTransition;
      const prone = transition
        ? transition.kind === "dive"
          ? Math.min(1, transition.t * 2)
          : 1 - transition.t
        : 1;
      cu.root.rotation.set((Math.PI / 2) * prone, 0, 0);
      cu.root.position.set(0, 0.27 * prone, -0.65 * prone);
      cu.root.scale.setScalar(1);
      cu.shadow.visible = false;
      cu.arms.forEach((a, i) =>
        a.rotation.set(c.carry === "lifering" ? Math.PI : Math.sin(time * 9 + i * Math.PI) * 1.3, 0, 0),
      );
      cu.legs.forEach((l, i) => (l.rotation.x = Math.sin(time * 13 + i * Math.PI) * 0.24));
      if (c.carry === "lifering") cu.carry.position.set(0, 1.88, 0.05);
      this.coachHalo.visible = false;
      this.dashTrail.visible = false;
    } else cu.shadow.visible = true;
    if (!c.swimming && !c.waterTransition) this.slipPose(cu, c.slipTime, 0.7);
    this.syncRescue(sim, time);
    if (c.carry === "skimmer") {
      const waste = cu.carry.getObjectByName("caught-waste");
      if (waste) waste.visible = !!c.skimmerLoaded;
      cu.carry.visible = !(c.scoopTimer > 0);
    }
    for (let i = this.handoffs.length - 1; i >= 0; i--) {
      const f = this.handoffs[i];
      f.elapsed += dt;
      const t = Math.min(1, f.elapsed / 0.3);
      f.mesh.position.set(
        f.from.x + (f.to.x - f.from.x) * t,
        1.1 + Math.sin(t * Math.PI) * 0.75 - t * 0.65,
        f.from.z + (f.to.z - f.from.z) * t,
      );
      f.mesh.rotation.y = t * 3;
      if (t === 1) {
        f.mesh.removeFromParent();
        this.handoffs.splice(i, 1);
      }
    }

    this.finPairs.forEach((g, i) => (g.visible = i < sim.finsAvailable));
    const selected = sim.get(sim.selected);
    this.selection.visible = !!selected;
    if (selected) {
      this.selection.position.set(selected.x, selected.status === "swim" ? -0.11 : 0.035, selected.z);
      this.selection.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    }
    const focus = sim.get(guide.swimmerId);
    this.guideAura.visible = !!focus;
    if (focus) {
      this.guideAura.position.set(focus.x, 0, focus.z);
      this.guideAura.userData.shell.material.opacity = 0.16 + pulse * 0.24;
      this.guideAura.userData.halo.scale.setScalar(1 + pulse * 0.22);
      this.guideAura.userData.shell.scale.set(1 + pulse * 0.12, 1.8 + pulse * 0.12, 1 + pulse * 0.12);
    }
    this.laneHighlights.forEach((m, i) => {
      m.material.opacity = guide.lanes
        ? 0.14 + pulse * 0.19
        : sim.lanePeople(i).some((p) => p.h < 30)
          ? 0.07
          : 0;
      m.material.color.set(guide.lanes ? 0xffdf52 : 0xff5d31);
      this.laneRims[i].visible = guide.lanes;
      this.laneRims[i].material.opacity = 0.5 + pulse * 0.5;
    });
    const dropIds = new Set();
    for (const f of sim.clutter) {
      dropIds.add(f.id);
      if (!this.drops.has(f.id)) {
        const g = f.type === "fins" ? this.finsObject() : new THREE.Group();
        if (f.type === "goggles") {
          this.box(0.45, 0.1, 0.13, colors.navy, 0, 0, 0, 0.04, g);
          this.box(0.14, 0.11, 0.02, colors.blue, -0.12, 0, 0.08, 0.01, g);
          this.box(0.14, 0.11, 0.02, colors.blue, 0.12, 0, 0.08, 0.01, g);
        }
        g.position.set(f.x, 0.08, f.z);
        g.rotation.x = -Math.PI / 2;
        g.rotation.z = 0.5;
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.52, 6, 5),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.userData = { kind: "clutter", id: f.id };
        g.add(hit);
        g.userData.hit = hit;
        this.clickables.push(hit);
        this.scene.add(g);
        this.drops.set(f.id, g);
      }
    }
    for (const [id, g] of this.drops)
      if (!dropIds.has(id)) {
        this.scene.remove(g);
        this.clickables = this.clickables.filter((x) => x !== g.userData.hit);
        this.drops.delete(id);
      }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 5.6 * dt;
      p.mesh.scale.setScalar(Math.max(0, p.life * 1.8));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
  pooObject() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) this.ball(0.37 - i * 0.08, 0x986442, 0, 0.12 + i * 0.2, 0, g, [1, 0.7, 1]);
    this.ball(0.13, 0x986442, 0.06, 0.65, 0, g, [0.7, 1.4, 0.7]);
    for (const x of [-0.12, 0.12]) {
      this.ball(0.073, 0xfff2cc, x, 0.31, 0.265, g);
      this.ball(0.036, 0x23434a, x, 0.31, 0.33, g);
    }
    return g;
  }
  showIncident(x, z) {
    if (!this.incident) {
      this.incident = this.pooObject();
      this.scene.add(this.incident);
    }
    this.incident.visible = true;
    this.incident.position.set(x, 0, z);
  }
  skimmerObject() {
    const g = new THREE.Group();
    this.rod([0, 0, 0], [0, 0, 2.65], 0.045, 0xc0d6db, g);
    this.rod([0, 0, 0], [0, 0, 0.35], 0.073, 0xffce4e, g);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 7, 20), this.mat(0xffce4e));
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
    const waste = this.pooObject();
    waste.name = "caught-waste";
    waste.position.set(0, 0, 3.02);
    waste.scale.setScalar(0.7);
    waste.visible = false;
    g.add(waste);
    return g;
  }
  buildSanitation() {
    const g = new THREE.Group();
    this.sanitationGroup = g;
    this.scene.add(g);
    const r = SANITATION.rack,
      b = SANITATION.bin;
    this.box(0.16, 1.25, 3.9, 0x174752, -14.55, 1.75, r.z, 0.07, g);
    for (const z of [r.z - 1, r.z + 1]) this.rod([-14.4, 1.8, z], [-13.9, 1.8, z], 0.07, 0xe5ba57, g);
    this.skimmerRack = this.skimmerObject();
    this.skimmerRack.position.set(-14.0, 1.85, r.z - 1.5);
    g.add(this.skimmerRack);
    const title = this.textPlane("POOL SKIMMER", 2.7, 0.4, "#f6daa1", "#245762", -14.65, 2.65, r.z, g, 42);
    title.rotation.y = -Math.PI / 2;
    this.cyl(0.62, 0.52, 1.25, 0x204d59, b.x, 0.65, b.z, g);
    this.cyl(0.59, 0.59, 0.045, 0x102833, b.x, 1.29, b.z, g);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.07, 8, 22), this.mat(0xf2b44f));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(b.x, 1.32, b.z);
    g.add(rim);
    for (const z of [-0.3, 0.3]) this.box(0.03, 0.5, 0.14, 0xf0bd4d, b.x - 0.61, 0.74, b.z + z, 0.02, g);
    const label = this.textPlane("WASTE", 0.84, 0.35, "#204d59", "#ffdda1", b.x - 0.64, 0.83, b.z, g, 42);
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
      this.clickables.push(hit);
      this.labels.push({
        text: item === "skimmer" ? "E · POOL SKIMMER" : "E · WASTE BIN",
        ...point,
        y: 2.8,
        minLevel: 3,
      });
    }
    this.scoopCast = new THREE.Group();
    this.scene.add(this.scoopCast);
    this.scoopShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), this.mat(0xc3dde3));
    this.scoopCast.add(this.scoopShaft);
    this.scoopNet = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 22), this.mat(0xffd447));
    this.scoopNet.rotation.x = Math.PI / 2;
    this.scoopCast.add(this.scoopNet);
    this.scoopCast.visible = false;
  }
  syncSanitation(sim, time) {
    const q = sim.cleanup,
      c = sim.coach;
    this.sanitationGroup.visible = sim.level >= 3;
    this.skimmerRack.visible = c.carry !== "skimmer";
    if (q?.stage === "floating") {
      this.showIncident(q.x, q.z);
      this.incident.position.y = -0.15 + Math.sin(time * 3) * 0.065;
      this.incident.rotation.y = q.elapsed * 0.55;
    } else if (this.incident) this.incident.visible = false;
    this.scoopCast.visible = !!(c.scoopTimer > 0 && c.scoopTarget);
    if (this.scoopCast.visible) {
      const from = new THREE.Vector3(c.x, 1.05, c.z),
        progress = 1 - c.scoopTimer / 0.42,
        to = new THREE.Vector3(c.scoopTarget.x, -0.08 + Math.sin(progress * Math.PI) * 0.35, c.scoopTarget.z),
        delta = to.clone().sub(from);
      this.scoopShaft.position.copy(from).add(to).multiplyScalar(0.5);
      this.scoopShaft.scale.y = delta.length();
      this.scoopShaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      this.scoopNet.position.copy(to);
    }
  }

  splash(x, y, z, n = 9, quiet = false) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 180) break;
      const p = this.ball(quiet ? 0.055 : 0.09, 0xc4f7e8, x, y, z);
      p.castShadow = false;
      this.particles.push({
        mesh: p,
        life: 0.35 + Math.random() * 0.4,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.6,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 1.6,
        ),
      });
    }
  }
  confetti() {
    for (let i = 0; i < 70; i++) {
      const m = this.box(
        0.12,
        0.12,
        0.04,
        [colors.coral, colors.yellow, colors.teal, 0xffffff][i % 4],
        (Math.random() - 0.5) * 12,
        6 + Math.random() * 5,
        (Math.random() - 0.5) * 12,
        0.005,
      );
      this.particles.push({
        mesh: m,
        life: 2 + Math.random(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      });
    }
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.fov = 42;
    const reserve = w <= 620 ? (h <= 740 ? Math.max(220, 820 - h * 0.9) : 150) : h <= 540 ? 86 : 0;
    this.playHeight = Math.max(150, h - reserve);
    // Extend the camera below the play area: room scenery fills behind the touch HUD too.
    this.camera.setViewOffset(w, this.playHeight, 0, 0, w, h);
    // Frame for width instead of shrinking the entire room to fit inside a tabletop margin.
    this.viewDirection = new THREE.Vector3(-0.65, 0.76, 0).normalize();
    const distance = Math.max(
      20.5,
      Math.min(64, 30 / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect)),
    );

    this.cameraDistance = distance;
    this.placeCamera();
  }
  placeCamera() {
    this.camera.position
      .copy(this.target)
      .addScaledVector(this.viewDirection, this.cameraDistance / this.zoom);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);
  }
  cameraBounds() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight,
      portrait = w <= 620;
    return {
      left: portrait ? 24 : Math.min(255, w * 0.22),
      right: w - (portrait ? 24 : Math.min(245, w * 0.22)),
      top: portrait ? 151 : 105,
      bottom: portrait ? Math.max(300, h - 366) : h <= 540 ? h - 145 : h - 135,
    };
  }
  followCoach(c, dt) {
    const target = new THREE.Vector3(
      Math.max(-2.4, Math.min(2.4, c.x * 0.22)),
      0.45,
      Math.max(-1.5, Math.min(1.5, c.z * 0.13)) - 3.2,
    );
    this.target.lerp(target, 1 - Math.exp(-dt * 2.5));
    this.placeCamera();
    // Keep the close view, but pan far enough to retain the coach and nearby equipment.
    const points = [
      new THREE.Vector3(c.x, c.y + 0.1, c.z - 0.5),
      new THREE.Vector3(c.x, c.y + 2.15, c.z + 0.5),
    ];
    for (const p of [...Object.values(STATIONS), SANITATION.rack, SANITATION.bin])
      if (Math.hypot(c.x - p.x, c.z - p.z) < 3.3) {
        points.push(new THREE.Vector3(p.x, 0.1, p.z - 0.65), new THREE.Vector3(p.x, 2.7, p.z + 0.65));
      }
    const bounds = this.cameraBounds(),
      w = this.container.clientWidth,
      h = this.container.clientHeight,
      ray = new THREE.Raycaster(),
      plane = new THREE.Plane(),
      hit = new THREE.Vector3();
    for (let pass = 0; pass < 3; pass++)
      for (const p of points) {
        const screen = this.project(p.x, p.y, p.z),
          x = Math.max(bounds.left, Math.min(bounds.right, screen.x)),
          y = Math.max(bounds.top, Math.min(bounds.bottom, screen.y));
        if (Math.abs(x - screen.x) + Math.abs(y - screen.y) < 0.1) continue;
        ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, 1 - (y / h) * 2), this.camera);
        plane.set(new THREE.Vector3(0, 1, 0), -p.y);
        if (ray.ray.intersectPlane(plane, hit)) {
          this.target.x += p.x - hit.x;
          this.target.z += p.z - hit.z;
          this.placeCamera();
        }
      }
  }

  zoomBy(f) {
    this.zoom = Math.max(0.9, Math.min(1.3, this.zoom * f));
    this.resize();
  }
  resetView() {
    this.zoom = 1;
    this.resize();
  }
  handoff(from, to, item) {
    const mesh = item === "fins" ? this.finsObject() : new THREE.Group();
    if (item !== "fins") this.ball(0.15, item === "relief" ? 0x78c7ce : colors.navy, 0, 0, 0, mesh);
    this.scene.add(mesh);
    this.handoffs.push({ mesh, from, to, elapsed: 0 });
  }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.container.clientHeight,
      visible: v.z < 1,
    };
  }
  bindInput() {
    const canvas = this.renderer.domElement;
    let start = null;
    canvas.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!start || Math.hypot(start.x - e.clientX, start.y - e.clientY) > 10) return;
      const rect = canvas.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.clickables, false);
      if (hits[0]) this.onPick(hits[0].object.userData);
      start = null;
    });
    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      canvas.style.cursor = this.raycaster.intersectObjects(this.clickables, false).length
        ? "pointer"
        : "default";
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.035 : 0.966);
      },
      { passive: false },
    );
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
