// What a 3D scene holds, counted for the crash log: nodes, meshes, skinned meshes and their bones, lights, and a rough count of the
// memory that geometry, textures and shadow maps take on the GPU. The numbers move with the shift (people come and go, models arrive);
// a count that only climbs from shift to shift is a leak, and a device that runs out of GPU memory is the likeliest reason for a page
// that dies without an error. Only reads the scene: no THREE import, so a check can feed it plain objects.

const TEXTURES = [
  "map",
  "normalMap",
  "bumpMap",
  "roughnessMap",
  "metalnessMap",
  "emissiveMap",
  "alphaMap",
  "aoMap",
  "lightMap",
];
const MB = 1048576;

// The bytes a texture takes once uploaded: four bytes a pixel, a third more for its mipmaps.
function textureBytes(t) {
  const image = t.image || {},
    w = image.width || image.videoWidth || 0,
    h = image.height || image.videoHeight || 0;
  return w * h * 4 * (t.generateMipmaps === false || t.isCompressedTexture ? 1 : 1.34);
}

export function footprint(...roots) {
  const geometries = new Set(),
    textures = new Set();
  const out = { nodes: 0, meshes: 0, skinned: 0, bones: 0, lights: 0, shadows: 0, instances: 0 };
  let geometryBytes = 0,
    textureBytesTotal = 0,
    shadowBytes = 0;
  for (const root of roots) {
    root?.traverse?.((o) => {
      out.nodes++;
      if (o.isBone) out.bones++;
      if (o.isLight && o.visible !== false) {
        out.lights++;
        if (o.castShadow && o.shadow?.mapSize) {
          out.shadows++;
          // A point light's shadow is a cube: six faces.
          shadowBytes += o.shadow.mapSize.x * o.shadow.mapSize.y * 4 * (o.isPointLight ? 6 : 1);
        }
      }
      if (o.isInstancedMesh) out.instances += o.count || 0;
      if (!(o.isMesh || o.isPoints || o.isLine)) return;
      out.meshes++;
      if (o.isSkinnedMesh) out.skinned++;
      const g = o.geometry;
      if (g && !geometries.has(g)) {
        geometries.add(g);
        for (const a of Object.values(g.attributes || {})) geometryBytes += a.array?.byteLength || 0;
        geometryBytes += g.index?.array?.byteLength || 0;
      }
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
        for (const key of TEXTURES) {
          const t = m[key];
          if (t && !textures.has(t)) {
            textures.add(t);
            textureBytesTotal += textureBytes(t);
          }
        }
    });
  }
  return {
    ...out,
    geometries: geometries.size,
    textures: textures.size,
    geoMB: Math.round(geometryBytes / MB),
    texMB: Math.round(textureBytesTotal / MB),
    shadowMB: Math.round(shadowBytes / MB),
  };
}
