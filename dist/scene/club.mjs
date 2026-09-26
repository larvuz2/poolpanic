// Classic indoor community club: warm sand tiles, muted teal walls, lockers in the left wall, office in the
// upper-right corner. Layout matches the original prototype; materials and light are richer.
import { THREE, COLORS } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { subwayTexture, plasterTexture, beamTexture, gradientTexture } from "./textures.mjs";
import {
  bench,
  plant,
  fountain,
  lifeguardChair,
  station,
  finRack,
  lockerBay,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  treatsTable,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";

export function buildClub(w, venue) {
  buildDeck(w, venue, { base: "#c99a70", grout: "#a27a5a" });
  buildPool(w, venue);
  rearWall(w);
  lockerBay(w, venue, -10.7, "MEN", COLORS.teal);
  lockerBay(w, venue, 10.7, "WOMEN", COLORS.coral);
  office(w);
  // Low side walls keep the tabletop silhouette open.
  const plaster = plasterTexture({ seed: 41, strength: 0.09 });
  plaster.repeat.set(6, 1);
  w.textures.push(plaster);
  for (const x of [-14.8, 14.8]) {
    w.box(0.32, 1.1, 25.2, w.mat(0x447d7a, { map: plaster }), x, 0.5, 0, 0.11);
    w.box(0.52, 0.16, 25.5, 0xcda477, x, 1.09, 0, 0.07);
  }
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "plant") plant(w, f.x, f.z, f.scale || 1);
    if (f.kind === "fountain") fountain(w, f.x, f.z);
    if (f.kind === "chair") lifeguardChair(w, f.x, f.z);
  }
  // Rolled towels, bags and flip-flops on and around the benches.
  w.box(0.6, 0.35, 0.5, 0xf0b655, -9.9, 0.77, -1.4, 0.09);
  w.box(0.8, 0.25, 0.45, 0xafd2b1, -9.8, 0.8, 3.3, 0.07);
  w.box(0.45, 0.55, 0.5, 0x697ea6, 10.5, 0.3, -1.5, 0.12);
  w.rod([10.35, 0.52, -1.5], [10.35, 0.77, -1.5], 0.03, 0x274d63);
  for (let i = 0; i < 2; i++) w.box(0.2, 0.05, 0.45, COLORS.coral, -8.7 + i * 0.3, 0.055, 4.3, 0.04);
  finRack(w, venue.stations.fins);
  station(w, "chlorine", venue.stations.chlorine, COLORS.yellow, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xddf3d7, "FIRST AID");
  w.textPlane("NO RUNNING", 2.8, 0.47, "#e8eee3", "#be8363", 0, 0.025, 12.45, w.scene, 58).rotation.x =
    -Math.PI / 2;
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  treatsTable(w, venue.fixtures.treats);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  surroundings(w);
}

function rearWall(w) {
  const z0 = -16.35;
  const plaster = plasterTexture({ seed: 12, strength: 0.08 });
  plaster.repeat.set(8, 2);
  w.textures.push(plaster);
  w.box(29.7, 5.9, 0.4, w.mat(0x82a79b, { map: plaster }), 0, 2.5, z0, 0.15);
  const tiles = subwayTexture({ base: "#4fa3a1" });
  tiles.repeat.set(30 / 2, 1.25 / 0.5);
  w.textures.push(tiles);
  w.box(29.9, 1.25, 0.08, w.mat(0xffffff, { map: tiles, roughness: 0.32 }), 0, 0.6, z0 + 0.24, 0.02);
  w.box(30, 0.15, 0.18, 0xd4b888, 0, 1.27, z0 + 0.29, 0.02);
  w.box(30, 0.35, 0.8, 0x268994, 0, 5.45, z0 + 0.1, 0.09);
  // High daylight windows: glowing sky glass and soft light shafts falling into the hall.
  const sky = gradientTexture([
    [0, "#bfe8f2"],
    [0.6, "#e9f6ee"],
    [1, "#fff5dc"],
  ]);
  w.textures.push(sky);
  w.windowGlass = [];
  const beam = beamTexture();
  w.textures.push(beam);
  w.lightShafts = [];
  for (let j = 0; j < 5; j++) {
    const x = -10.4 + j * 5.2;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.0, 0.11),
      new THREE.MeshBasicMaterial({ map: sky }),
    );
    glass.position.set(x, 3.92, z0 + 0.28);
    w.scene.add(glass);
    w.windowGlass.push(glass);
    w.box(4.82, 0.14, 0.3, 0xfff9dc, x, 2.87, z0 + 0.43, 0.02);
    w.box(4.82, 0.14, 0.2, 0xf8f1d4, x, 4.98, z0 + 0.43, 0.02);
    for (const xx of [x - 2.28, x, x + 2.28]) w.box(0.1, 2.1, 0.24, 0xfff9dd, xx, 3.96, z0 + 0.46, 0.015);
    w.box(4.6, 0.07, 0.22, 0xfff9dd, x, 3.96, z0 + 0.47, 0.01);
    const shaft = w.decal(beam, 4.2, 7.5, 0xfff0c8, 0.11, true);
    shaft.position.set(x + 0.3, 2.4, z0 + 3.4);
    shaft.rotation.set(-0.95, 0, 0.12);
    w.scene.add(shaft);
    w.lightShafts.push(shaft);
  }
  w.box(5.3, 1.22, 0.22, 0xfff6d1, 0, 1.94, z0 + 0.39, 0.1);
  w.textPlane("POOL PANIC", 4.95, 0.74, "#fff6d1", "#167b84", 0, 2.04, z0 + 0.513, w.scene, 87);
  w.textPlane("SWIM CLUB · EST. 1986", 4.3, 0.23, "#fff6d1", "#558480", 0, 1.6, z0 + 0.52, w.scene, 30);
  // Bulletin board beside the office entrance.
  w.box(3.8, 2.2, 0.17, 0xc19858, 4.8, 1.72, z0 + 0.42, 0.07);
  w.box(3.6, 2, 0.07, 0x9e754e, 4.8, 1.72, z0 + 0.55, 0.025);
  w.textPlane("CLUB NEWS", 3.4, 0.35, "#f8e8b5", "#72563d", 4.8, 2.88, z0 + 0.54, w.scene, 45);
  [
    ["SWIM MEET", 0xfdf1c9],
    ["LOST GOGGLES", 0xdbebcf],
    ["NO FISH!", 0xf8d6ad],
    ["NO DOGS", 0xdce8dd],
    ["OPEN 7–9", 0xfff8dc],
  ].forEach(([s, color], i) => {
    const g = w.group(3.55 + (i % 3) * 1.2, 2.05 - Math.floor(i / 3) * 0.8, z0 + 0.64);
    g.rotation.z = i % 2 ? 0.08 : -0.07;
    w.box(0.92, 0.66, 0.02, color, 0, 0, 0, 0.005, g);
    w.textPlane(s, 0.82, 0.17, "#" + color.toString(16), "#5c7268", 0, 0.13, 0.018, g, 31);
    for (let k = 0; k < 3; k++)
      w.box(0.56 - k * 0.06, 0.025, 0.012, 0x9aaf9b, 0, -0.05 - k * 0.08, 0.015, 0, g);
    w.ball(0.034, COLORS.coral, 0, 0.3, 0.03, g);
  });
  // Oversized pool clock.
  const clock = w.cyl(0.61, 0.61, 0.12, COLORS.navy, -6, 2.08, z0 + 0.56);
  clock.rotation.x = Math.PI / 2;
  const face = w.cyl(0.53, 0.53, 0.14, 0xfff5d7, -6, 2.08, z0 + 0.67);
  face.rotation.x = Math.PI / 2;
  w.rod([-6, 2.08, z0 + 0.78], [-6, 2.45, z0 + 0.78], 0.03, COLORS.navy);
  w.rod([-6, 2.08, z0 + 0.81], [-5.72, 1.96, z0 + 0.81], 0.035, COLORS.coral);
}

function office(w) {
  const g = w.group(14.3, 0, 9.5, w.scene, -Math.PI / 2);
  w.box(3.5, 3.1, 0.2, 0x277982, 0, 1.55, 0, 0.08, g);
  w.box(2.85, 2.35, 0.12, 0x8ac0bd, 0, 1.4, 0.15, 0.04, g);
  w.box(0.1, 2.4, 0.16, 0xf0e8c6, 0, 1.4, 0.24, 0.01, g);
  w.box(2.9, 0.1, 0.16, 0xf0e8c6, 0, 1.6, 0.24, 0.01, g);
  w.textPlane("MAIN OFFICE", 3.1, 0.43, "#fff1cd", "#296879", 0, 2.88, 0.18, g, 44);
  w.box(2.5, 0.85, 0.8, 0xb38a5d, 0, 0.47, 1.3, 0.08, g);
  w.box(2.7, 0.13, 0.94, 0xefd498, 0, 0.94, 1.3, 0.05, g);
  w.box(0.62, 0.42, 0.07, 0x295d68, -0.4, 1.24, 1.2, 0.04, g);
  w.box(0.25, 0.15, 0.1, 0x295d68, -0.4, 1.02, 1.2, 0.02, g);
  w.box(0.43, 0.06, 0.32, 0xf7f3dc, 0.7, 1.04, 1.5, 0.005, g);
}

// Continuous tiled surroundings behind the tabletop, fading into a soft haze.
function surroundings(w) {
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
  w.textures.push(tiles);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ map: tiles, color: 0xbca58a, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.95;
  floor.receiveShadow = true;
  w.scene.add(floor);
}
