"""Makes a copy of the Godot test lighter for the web build (tools/web-export.sh runs it on the copy, never on godot/ itself).

- Textures: one desktop format (S3TC, not BPTC, and no ETC2/ASTC for phones: a browser that lacks S3TC gets them decompressed),
  the big tiling sets (tiles, plaster, timber, terrazzo, caustics, the water) at 512 px, the characters' skins compressed too.
- project.godot: no ETC2/ASTC import. export_presets.cfg's Web preset already asks for the desktop format only.
"""
import pathlib, re, sys

root = pathlib.Path(sys.argv[1])
TILING = re.compile(r"assets/textures/[a-z_]+_(albedo|normal|rough)\.png|assets/textures/(caustics|water_normal)\.png")
changed = 0
for imp in root.rglob("*.import"):
    if ".godot" in imp.parts:
        continue
    text = imp.read_text()
    if 'importer="texture"' not in text:
        continue
    rel = imp.relative_to(root).as_posix()[: -len(".import")]
    if rel.endswith(".svg"):
        continue  # the editor's icon
    limit = 512 if TILING.fullmatch(rel) else 2048

    def put(key, value):
        global text
        line = f"{key}={value}"
        text, n = re.subn(rf"^{re.escape(key)}=.*$", line, text, flags=re.M)
        if n == 0:
            text = text.replace("[params]\n", f"[params]\n\n{line}\n", 1)

    put("compress/mode", "2")
    put("compress/high_quality", "false")
    put("mipmaps/generate", "true")
    put("process/size_limit", str(limit))
    imp.write_text(text)
    changed += 1

proj = root / "project.godot"
p = proj.read_text()
p2 = p.replace("textures/vram_compression/import_etc2_astc=true", "textures/vram_compression/import_etc2_astc=false")
assert p2 != p, "project.godot: import_etc2_astc not found"
p2 = p2.replace('"compress/high_quality": true', '"compress/high_quality": false')
proj.write_text(p2)
print(f"web-textures: {changed} textures made lighter")
