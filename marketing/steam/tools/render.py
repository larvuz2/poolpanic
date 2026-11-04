import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
# stop on the first frame of the first action (rest/idle), whole body
scn = bpy.context.scene
objs = [o for o in scn.objects if o.type == "MESH"]
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
ctr = (mn + mx) / 2; h = (mx - mn).length
for i, (ang, name) in enumerate([(-30, "a"), (20, "b")]):
    cam = bpy.data.objects.new("cam" + name, bpy.data.cameras.new("c" + name)); scn.collection.objects.link(cam)
    r = h * 1.25; a = math.radians(ang)
    cam.location = ctr + Vector((math.sin(a) * r, -math.cos(a) * r, h * 0.12))
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    scn.camera = cam
    for L, e, rot in [("key", 4, (50, 0, -35)), ("fill", 1.6, (60, 0, 50)), ("rim", 2.5, (120, 0, 180))]:
        if not bpy.data.objects.get(L):
            l = bpy.data.objects.new(L, bpy.data.lights.new(L, "SUN")); l.data.energy = e; l.rotation_euler = [math.radians(v) for v in rot]; scn.collection.objects.link(l)
    w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8; scn.world = w
    scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    scn.render.resolution_x = 900; scn.render.resolution_y = 1100
    scn.render.film_transparent = False
    scn.view_settings.view_transform = "Standard"
    scn.render.filepath = out + "-" + name + ".png"
    bpy.ops.render.render(write_still=True)
