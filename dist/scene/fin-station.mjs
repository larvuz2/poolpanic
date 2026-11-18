// The fin station (18 November 2026, the creator: "the fin station, it's different than the others… a rack where I don't even see
// the fins. The fins should always be on top of the station, like we have it on some other levels… we always can see the fins
// from a top-down view… they're always in the same place"). One station in every pool that hands out fins, the Community Pool's
// own: a low timber-topped table with a pair of fins lying in each of its three bays, seen from above. Its model is the
// Harbourside's rack made small (tools/venues/common/fin_station.py: one mesh per material class, the colours and the ambient
// occlusion in the vertex colours, the pairs Fins_1..3 their own nodes); each venue puts it where its plan says (spatial.mjs:
// by the pool's lower-left corner as the camera sees it), and a dressed venue lends it its own materials, so it takes the venue's
// light. It loads behind the menu; until it has (and with ?nomodels) the classic table of boxes stands in (props.mjs finRack).
import { THREE } from "./kit.mjs";

export const FIN_STATION_FILE = "models/fin-station.glb";
// (the model faces +z; turned a quarter it lies along the lanes' ends, its front to the deck behind it and its fins toward the
// camera, as the Community Pool's has stood since 28 October 2026)
export const FIN_STATION_ANGLE = Math.PI / 2;
// Its footprint, turned: what the plan's furniture holds (spatial.mjs, kind "rack").
export const FIN_STATION_SIZE = { hx: 0.48, hz: 1.03 };

let template = null,
  loading = null;
export function loadFinStation(base = new URL("../assets/", import.meta.url).href) {
  if (template || loading) return loading || Promise.resolve(template);
  if (typeof Image !== "function" || globalThis.__poolTuning?.has?.("nomodels")) return Promise.resolve(null);
  loading = (async () => {
    const { GLTFLoader } = await import("../assets/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(base + FIN_STATION_FILE);
    template = gltf.scene;
    return template;
  })().catch((error) => {
    console.warn("The fin station's model did not load; the classic one stands.", error);
    loading = null;
    return null;
  });
  return loading;
}
export const finStationReady = () => template;
// Used by the checks: the template from a parsed model, without fetching.
export function useFinStationTemplate(scene) {
  template = scene;
}

// The plain materials of a venue with no model of its own (its classes' roughness and metalness, as dressed.mjs's FLAT).
const FLAT = { matte: [0.82, 0], satin: [0.5, 0], gloss: [0.22, 0], metal: [0.32, 1] };
function plainMaterial(w, cls) {
  const cache = (w.finStationMaterials ||= new Map());
  if (!cache.has(cls)) {
    const [roughness, metalness] = FLAT[cls] || FLAT.satin;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness });
    m.name = "fin-station:" + cls;
    cache.set(cls, m);
  }
  return cache.get(cls);
}

// The station in the world `w` at `point` (the plan's stations.fins), its pairs the world's `finPairs` (hidden as they are taken).
// `material(cls)`: a dressed venue's own material for a class (dressModel's); plain ones otherwise. False when there is no model.
export function placeFinStation(w, point, { material = null } = {}) {
  if (!template) return false;
  const root = template.clone(true);
  root.name = "FinStation";
  root.position.set(point.x, 0, point.z);
  root.rotation.y = FIN_STATION_ANGLE;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const cls = (o.material?.name || "satin").replace(/^H_/, "");
    o.material = material ? material(cls) : plainMaterial(w, cls);
    o.castShadow = true;
    o.receiveShadow = true;
  });
  w.scene.add(root);
  (w.liveProps ||= []).push(root); // (its own few meshes: never batched with the classic props)
  w.finPairs = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  return root;
}
