class_name ClubScene
extends Node3D
## The Community Pool, dressed: the building from Blender (assets/venue/club_shell.glb), its materials, the water, the light and
## the air. The look is in godot/docs/look.md; the assets are made by godot/tools/blender/*.py.
##
## Late afternoon: a low golden sun from beyond the long wall of windows (+X), its light falling through the windows and the
## skylight across the hall and the pool, made visible by the warm, humid air (volumetric fog and the steam over the water), with
## global illumination (SDFGI) bouncing it off the tiles. F2 cycles the quality (High, Medium, Low) for weaker machines.

const SHELL := "res://assets/venue/club_shell.glb"
const TILES := preload("res://assets/shaders/tiles.gdshader")
const WATER := preload("res://assets/shaders/water.gdshader")
const WATER_Y := -0.25
const SUN_DIR := Vector3(-0.72, -0.62, -0.34)  # the way the sunlight travels

var env: Environment
var sun: DirectionalLight3D
var water_material: ShaderMaterial
var quality := 2  # 2 high, 1 medium, 0 low
var _materials := {}


func _ready() -> void:
	_environment()
	_sun()
	_shell()
	_mural()
	_placements()
	_lane_ropes()
	_pennant_lines()
	_water()
	_air()
	_reflections()
	set_quality(quality)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_F2:
		set_quality((quality + 2) % 3)
		print("Quality: ", ["Low", "Medium", "High"][quality])


## High: everything. Medium: no SDFGI or SSIL, lighter fog. Low: also no SSR, no volumetric fog, smaller shadows.
func set_quality(q: int) -> void:
	quality = q
	env.sdfgi_enabled = q >= 2
	env.ssil_enabled = q >= 2
	env.ssr_enabled = q >= 1
	env.volumetric_fog_enabled = q >= 1
	env.ssao_enabled = q >= 1
	sun.shadow_blur = 1.5 if q >= 1 else 1.0
	RenderingServer.directional_shadow_atlas_set_size(4096 if q >= 1 else 2048, true)
	RenderingServer.directional_soft_shadow_filter_set_quality(
		RenderingServer.SHADOW_QUALITY_SOFT_HIGH if q >= 2 else RenderingServer.SHADOW_QUALITY_SOFT_LOW
	)
	get_viewport().msaa_3d = Viewport.MSAA_4X if q >= 2 else Viewport.MSAA_2X if q == 1 else Viewport.MSAA_DISABLED
	get_viewport().screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED


func _environment() -> void:
	env = Environment.new()
	# the sky is only seen above the walls and through the windows; it also gives the ambient light and the reflections
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("#5d97c9")
	sky_mat.sky_horizon_color = Color("#f6d7a8")
	sky_mat.ground_horizon_color = Color("#d9b48c")
	sky_mat.ground_bottom_color = Color("#6f5a46")
	sky_mat.sun_angle_max = 12.0
	sky_mat.energy_multiplier = 1.0
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.8
	env.ambient_light_color = Color("#d3e3ea")
	env.ambient_light_sky_contribution = 0.55
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.92
	env.tonemap_white = 6.0
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 4
	env.sdfgi_min_cell_size = 0.12
	env.sdfgi_energy = 1.6
	env.sdfgi_bounce_feedback = 0.6
	env.ssao_radius = 1.1
	env.ssao_intensity = 1.8
	env.ssao_detail = 0.6
	env.ssil_radius = 4.0
	env.ssil_intensity = 0.8
	env.ssr_max_steps = 56
	env.ssr_fade_in = 0.1
	env.ssr_depth_tolerance = 0.25
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 1.1
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.volumetric_fog_density = 0.0045
	env.volumetric_fog_albedo = Color("#fff2df")
	env.volumetric_fog_emission = Color("#2a2f30")
	env.volumetric_fog_emission_energy = 0.15
	env.volumetric_fog_anisotropy = 0.62
	env.volumetric_fog_length = 70.0
	env.volumetric_fog_detail_spread = 1.6
	env.volumetric_fog_gi_inject = 0.6
	env.volumetric_fog_ambient_inject = 0.25
	env.volumetric_fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.12
	env.adjustment_saturation = 1.14
	var we := WorldEnvironment.new()
	we.environment = env
	var cam_attr := CameraAttributesPractical.new()
	cam_attr.auto_exposure_enabled = false
	we.camera_attributes = cam_attr
	add_child(we)


func _sun() -> void:
	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_color = Color("#ffd29a")
	sun.light_energy = 3.2
	sun.light_angular_distance = 0.6
	sun.light_volumetric_fog_energy = 3.0
	sun.shadow_enabled = true
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.2
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 70.0
	sun.directional_shadow_blend_splits = true
	add_child(sun)
	sun.basis = Basis.looking_at(SUN_DIR.normalized(), Vector3.UP)
	var sky_fill := DirectionalLight3D.new()
	sky_fill.name = "SkyFill"
	sky_fill.light_color = Color("#d4e6f0")
	sky_fill.light_energy = 0.5
	sky_fill.light_volumetric_fog_energy = 0.0
	sky_fill.light_specular = 0.2
	add_child(sky_fill)
	sky_fill.basis = Basis.looking_at(Vector3(0.25, -1.0, 0.15).normalized(), Vector3.UP)


func _shell() -> void:
	var shell: Node3D = (load(SHELL) as PackedScene).instantiate()
	shell.name = "Shell"
	add_child(shell)
	_dress(shell)
	var garden: Node3D = (load("res://assets/venue/exterior.glb") as PackedScene).instantiate()
	garden.name = "Garden"
	add_child(garden)
	_dress(garden)


## Give an imported building or prop its finished look, by names set in Blender: GD_ materials become Godot's, ShadowOnly_ parts
## only cast shadows, Glass_ panes cast none, and every UnderwaterLight_ lens gets a light.
func _dress(root: Node) -> void:
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		var name := String(mi.name)
		if name.begins_with("ShadowOnly_"):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
			continue
		if name.begins_with("Glass_"):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		for i in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(i)
			if m and m.resource_name.begins_with("GD_"):
				mi.set_surface_override_material(i, material(m.resource_name.substr(3)))
		if name.begins_with("Light_"):
			var glow := OmniLight3D.new()
			glow.light_color = Color("#ffe2b0")
			glow.light_energy = 0.8
			glow.omni_range = 2.2
			glow.light_volumetric_fog_energy = 0.0
			mi.add_child(glow)
		if name.begins_with("UnderwaterLight_"):
			var light := OmniLight3D.new()
			light.light_color = Color("#fff0d2")
			light.light_energy = 1.6
			light.omni_range = 4.5
			light.light_volumetric_fog_energy = 0.0
			mi.add_child(light)
			var p := mi.global_position if mi.is_inside_tree() else mi.position
			light.position = Vector3(-signf(p.x) * 0.3, 0, 0)


## Every prop listed in data/placements/*.json (written with the Blender scripts): {"asset", "pos", "rot" (degrees), "scale"}.
func _placements() -> void:
	var root := Node3D.new()
	root.name = "Props"
	add_child(root)
	var dir := DirAccess.open("res://data/placements")
	if dir == null:
		return
	var files := Array(dir.get_files()).filter(func(f): return f.ends_with(".json"))
	files.sort()
	for f in files:
		var list: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/placements/" + f))
		if typeof(list) != TYPE_ARRAY:
			push_warning("Bad placements file " + f)
			continue
		for p in list:
			var path := "res://assets/venue/" + String(p.asset)
			if not ResourceLoader.exists(path):
				push_warning("Missing prop " + path)
				continue
			var node: Node3D = (load(path) as PackedScene).instantiate()
			node.position = Vector3(p.pos[0], p.pos[1], p.pos[2])
			node.rotation.y = deg_to_rad(float(p.get("rot", 0.0)))
			node.scale = Vector3.ONE * float(p.get("scale", 1.0))
			root.add_child(node)
			_dress(node)
	# the moving parts: the clocks' hands, the changing rooms' doors
	for hand in root.find_children("Hand*", "Node3D", true, false):
		_hands.append(hand)
	for door in root.find_children("Door", "Node3D", true, false):
		_doors.append(door)


var _hands: Array[Node3D] = []
var _doors: Array[Node3D] = []


## The mural: a painted harbour on the plaster between the pilasters (tools/blender/mural.py).
func _mural() -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2(15.2, 4.75)
	var m := StandardMaterial3D.new()
	m.albedo_texture = load("res://assets/textures/mural.png")
	m.roughness = 0.82
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	var mural := MeshInstance3D.new()
	mural.name = "Mural"
	mural.mesh = quad
	mural.material_override = m
	mural.position = Vector3(0, 4.78, -16.685)
	add_child(mural)


## The lane ropes: four lines of floats from end to end, white and blue with coral for the last five metres at each end, bobbing.
func _lane_ropes() -> void:
	var float_mesh := _first_mesh("res://assets/venue/props/lane_float.glb")
	if float_mesh == null:
		return
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode diffuse_burley;
void vertex() {
	float id = float(INSTANCE_ID);
	VERTEX.y += sin(TIME * 1.3 + id * 0.37) * 0.012 + sin(TIME * 0.7 + id * 0.11) * 0.008;
}
void fragment() {
	ALBEDO = COLOR.rgb;
	ROUGHNESS = 0.32;
	SPECULAR = 0.6;
}
"""
	var mat := ShaderMaterial.new()
	mat.shader = shader
	var spacing := 0.124
	var n := int(16.6 / spacing)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = float_mesh
	mm.instance_count = n * 4
	var white := Color("#f6f3ea")
	var blue := Color("#2f6fb5")
	var coral := Color("#ef6a4c")
	var i := 0
	for rx in [-4.8, -1.6, 1.6, 4.8]:
		for k in n:
			var z := -8.3 + spacing * 0.5 + k * spacing
			var sag := -0.03 * (1.0 - pow(z / 8.3, 2.0))
			mm.set_instance_transform(i, Transform3D(Basis(), Vector3(rx, WATER_Y + 0.045 + sag, z)))
			var c := coral if absf(z) > 3.3 else (blue if (k / 3) % 2 == 0 else white)
			mm.set_instance_color(i, c)
			i += 1
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "LaneRopes"
	mmi.multimesh = mm
	mmi.material_override = mat
	add_child(mmi)


## The backstroke flags: a line of pennants across the pool 5.7 m from each end, sagging between its posts, fluttering.
func _pennant_lines() -> void:
	var pen := _first_mesh("res://assets/venue/props/pennant.glb")
	if pen == null:
		return
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode cull_disabled, diffuse_burley;
void vertex() {
	float id = float(INSTANCE_ID);
	float sway = sin(TIME * 2.6 + id * 0.9) * 0.18 + sin(TIME * 4.1 + id * 1.7) * 0.06;
	VERTEX.z += sway * (-VERTEX.y);
}
void fragment() {
	ALBEDO = COLOR.rgb;
	ROUGHNESS = 0.7;
}
"""
	var mat := ShaderMaterial.new()
	mat.shader = shader
	var colours := [Color("#ef6a4c"), Color("#f4f1ea"), Color("#2f8c88"), Color("#f2b33d"), Color("#1d3557")]
	var per_line := 38
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = pen
	mm.instance_count = per_line * 2
	var i := 0
	var rope_mat := StandardMaterial3D.new()
	rope_mat.albedo_color = Color("#f4f1ea")
	rope_mat.roughness = 0.8
	for lz in [-5.7, 5.7]:
		var a := Vector3(-6.0, 3.32, lz)
		var b := Vector3(6.0, 3.32, lz)
		for k in per_line:
			var t := (k + 0.5) / per_line
			var p := a.lerp(b, t)
			p.y -= 0.32 * (1.0 - pow(2.0 * t - 1.0, 2.0))
			mm.set_instance_transform(i, Transform3D(Basis(), p))
			mm.set_instance_color(i, colours[k % colours.size()])
			i += 1
		# the line itself, in short straight pieces along the sag
		var segs := 16
		for k in segs:
			var t0 := float(k) / segs
			var t1 := float(k + 1) / segs
			var p0 := a.lerp(b, t0)
			var p1 := a.lerp(b, t1)
			p0.y -= 0.32 * (1.0 - pow(2.0 * t0 - 1.0, 2.0))
			p1.y -= 0.32 * (1.0 - pow(2.0 * t1 - 1.0, 2.0))
			var seg := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.006
			cyl.bottom_radius = 0.006
			cyl.height = p0.distance_to(p1)
			cyl.radial_segments = 6
			seg.mesh = cyl
			seg.material_override = rope_mat
			add_child(seg)
			seg.position = (p0 + p1) / 2
			seg.basis = Basis(Vector3.UP.cross((p1 - p0).normalized()).normalized(), Vector3.UP.angle_to((p1 - p0).normalized())) if Vector3.UP.cross((p1 - p0)).length() > 0.0001 else Basis()
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "Pennants"
	mmi.multimesh = mm
	mmi.material_override = mat
	add_child(mmi)


func _first_mesh(path: String) -> Mesh:
	if not ResourceLoader.exists(path):
		return null
	var scene: Node = (load(path) as PackedScene).instantiate()
	var found := scene.find_children("*", "MeshInstance3D", true, false)
	var mesh: Mesh = (found[0] as MeshInstance3D).mesh if found.size() > 0 else null
	scene.free()
	return mesh


func material(key: String) -> Material:
	if _materials.has(key):
		return _materials[key]
	var m: Material
	match key:
		"deck":
			m = _tiles("deck_tile", 1.8, {"wet_on": true, "normal_strength": 1.2, "specular_amount": 0.45, "tint": Color("#fff4e4")})
		"pool_tile":
			m = _tiles("pool_mosaic", 1.0, {"caustics_on": true, "normal_strength": 0.9, "specular_amount": 0.6, "caustic_strength": 0.9})
		"waterline":
			m = _tiles("wall_navy", 0.3, {"caustics_on": true, "specular_amount": 0.6})
		"deck_band":
			m = _tiles("wall_sea", 0.45, {"normal_strength": 1.0})
		"wall_sea", "wall_navy", "wall_cream":
			m = _tiles(key, 0.6, {"specular_amount": 0.6})
		"plaster":
			m = _tiles("plaster", 2.0, {"specular_amount": 0.25})
		"timber":
			m = _tiles("timber", 1.0, {"specular_amount": 0.4})
		"foliage", "foliage_shrub":
			var f := ShaderMaterial.new()
			f.shader = preload("res://assets/shaders/foliage.gdshader")
			if key == "foliage_shrub":
				f.set_shader_parameter("colour", Color("#3f7a45"))
				f.set_shader_parameter("sway", 0.03)
				f.set_shader_parameter("sway_from", 0.0)
			m = f
		"terrazzo":
			m = _tiles("terrazzo", 1.0, {"specular_amount": 0.55})
		"mosaic_navy", "mosaic_cream", "mosaic_coral", "mosaic_sea", "mosaic_mustard":
			var tints := {"navy": "#30507e", "cream": "#fff4dc", "coral": "#ff8a6c", "sea": "#4fb6aa", "mustard": "#ffc456"}
			m = _tiles("pool_mosaic", 0.45, {"tint": Color(tints[key.substr(7)]), "specular_amount": 0.6})
		_:
			push_warning("No Godot material for GD_" + key)
			m = StandardMaterial3D.new()
	_materials[key] = m
	return m


func _tiles(tex: String, scale: float, opts := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = TILES
	m.set_shader_parameter("albedo_tex", load("res://assets/textures/%s_albedo.png" % tex))
	m.set_shader_parameter("normal_tex", load("res://assets/textures/%s_normal.png" % tex))
	m.set_shader_parameter("rough_tex", load("res://assets/textures/%s_rough.png" % tex))
	m.set_shader_parameter("world_scale", scale)
	m.set_shader_parameter("caustics_tex", load("res://assets/textures/caustics.png"))
	m.set_shader_parameter("water_y", WATER_Y)
	m.set_shader_parameter("wet_noise", _noise(0.9, 3))
	for k in opts:
		m.set_shader_parameter(k, opts[k])
	return m


func _noise(freq: float, octaves: int, cellular := false) -> NoiseTexture2D:
	var fn := FastNoiseLite.new()
	fn.noise_type = FastNoiseLite.TYPE_CELLULAR if cellular else FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	fn.frequency = freq / 64.0
	fn.fractal_octaves = octaves
	var t := NoiseTexture2D.new()
	t.width = 256
	t.height = 256
	t.seamless = true
	t.noise = fn
	t.generate_mipmaps = true
	return t


func _water() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2(10.0, 16.6)
	plane.subdivide_width = 40
	plane.subdivide_depth = 66
	var water := MeshInstance3D.new()
	water.name = "Water"
	water.mesh = plane
	water.position.y = WATER_Y
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	water_material = ShaderMaterial.new()
	water_material.shader = WATER
	water_material.set_shader_parameter("normal_tex", load("res://assets/textures/water_normal.png"))
	water_material.set_shader_parameter("foam_tex", _noise(4.0, 2, true))
	water.material_override = water_material
	add_child(water)


## The air: the hall's humidity is the global volumetric fog; over the warm water a denser, low layer of steam.
func _air() -> void:
	var steam := FogVolume.new()
	steam.name = "Steam"
	steam.size = Vector3(11.0, 1.6, 17.6)
	steam.position = Vector3(0, 0.45, 0)
	steam.shape = RenderingServer.FOG_VOLUME_SHAPE_BOX
	var fm := FogMaterial.new()
	fm.density = 0.012
	fm.albedo = Color("#f4fbfa")
	fm.height_falloff = 1.6
	fm.edge_fade = 0.35
	var n3 := NoiseTexture3D.new()
	var fn := FastNoiseLite.new()
	fn.frequency = 0.035
	fn.fractal_octaves = 3
	n3.noise = fn
	n3.width = 64
	n3.height = 32
	n3.depth = 64
	n3.seamless = true
	fm.density_texture = n3
	steam.material = fm
	add_child(steam)
	# along the window wall the sun's shafts cross warm, humid air: a denser layer there, fading toward the pool
	var haze := FogVolume.new()
	haze.name = "WindowHaze"
	haze.size = Vector3(9.0, 9.4, 31.0)
	haze.position = Vector3(10.6, 4.7, -1.6)
	var hm := FogMaterial.new()
	hm.density = 0.018
	hm.albedo = Color("#fff4e2")
	hm.edge_fade = 0.6
	hm.height_falloff = 0.08
	haze.material = hm
	add_child(haze)


func _reflections() -> void:
	var probe := ReflectionProbe.new()
	probe.name = "HallProbe"
	probe.size = Vector3(29.4, 10.0, 30.2)
	probe.position = Vector3(0, 4.6, -1.6)
	probe.origin_offset = Vector3(0, -2.6, 0)
	probe.box_projection = true
	probe.enable_shadows = true
	probe.update_mode = ReflectionProbe.UPDATE_ONCE
	probe.intensity = 0.9
	add_child(probe)


func _process(_dt: float) -> void:
	# the pace clock: the second hand sweeps once a minute, the minute hand once an hour
	var t := Time.get_ticks_msec() / 1000.0
	for hand in _hands:
		var minute := String(hand.name).contains("Minute")
		hand.rotation.z = -TAU * (fmod(t, 3600.0) / 3600.0 if minute else fmod(t, 60.0) / 60.0)
	# now and then someone comes out of a changing room: the door swings open into the hall and eases shut
	for i in _doors.size():
		var door := _doors[i]
		var cycle := fmod(t + i * 7.3, 14.0)
		var open := smoothstep(0.0, 0.5, cycle) * (1.0 - smoothstep(2.4, 3.6, cycle))
		var sgn := -1.0 if door.global_position.x > 0.0 else 1.0
		door.rotation.y = sgn * open * deg_to_rad(80.0)
	# the steam drifts: its noise slides slowly across the pool
	var steam := get_node_or_null("Steam") as FogVolume
	if steam:
		steam.position.x = sin(Time.get_ticks_msec() * 0.00005) * 0.4
