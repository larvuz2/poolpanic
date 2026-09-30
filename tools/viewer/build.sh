#!/usr/bin/env bash
# Assemble the viewer the way it is published: one flat folder (.build/) with the page, the script, the character
# manifest, the models and three.js. three.module.js is the game's own copy (dist/assets), so the viewer runs the same
# renderer; the three add-ons in vendor/ are three r170's, with their imports pointed at the files next to them.
# The artifact host does not serve .glb files, so each model goes out as base64 text (models/x.glb.b64.txt) and the
# built characters.json points at those; the viewer decodes them.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/.build"
rm -rf "$out"
mkdir -p "$out/models"
cp "$here/index.html" "$here/viewer.js" "$out/"
for glb in "$here"/models/*.glb; do
  base64 -w0 "$glb" > "$out/models/$(basename "$glb").b64.txt"
done
node -e '
  const fs = require("fs");
  const [src, dst] = process.argv.slice(1);
  const text = (f) => f.replace(/\.glb$/, ".glb.b64.txt");
  const manifest = JSON.parse(fs.readFileSync(src, "utf8"));
  for (const c of manifest.characters) {
    c.file = text(c.file);
    if (c.clipFiles) c.clipFiles = c.clipFiles.map(text);
  }
  fs.writeFileSync(dst, JSON.stringify(manifest, null, 2) + "\n");
' "$here/characters.json" "$out/characters.json"
cp "$here/../../dist/assets/three.module.js" "$out/three.module.js"
for name in GLTFLoader OrbitControls BufferGeometryUtils; do
  sed -e "s#from 'three'#from './three.module.js'#" \
      -e "s#'../utils/BufferGeometryUtils.js'#'./BufferGeometryUtils.js'#" \
      "$here/vendor/$name.js" > "$out/$name.js"
done
echo "built $out"
(cd "$out" && find . -type f | sort | sed 's#^\./#  #')
