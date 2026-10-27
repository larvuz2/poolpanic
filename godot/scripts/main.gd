extends Node3D
## The Godot test's one scene: the Community Pool blocked out from the exported layout, Coach Waters on WASD with the real game's
## movement, the guests' models waiting in the queue, and the real game's camera. No menu: it opens straight into the pool.
## Run with `-- --smoke` (godot/tools/check.sh) to walk the coach about by itself for a few seconds and quit: the headless check.

const CAST := [
	"res://assets/characters/swimmer-boy.glb",
	"res://assets/characters/swimmer-woman.glb",
	"res://assets/characters/swimmer-tall-man.glb",
	"res://assets/characters/swimmer-tall-woman.glb",
	"res://assets/characters/swimmer-heavy-man.glb",
	"res://assets/characters/marco.glb",
]

var coach: Coach
var camera: Camera3D
var target := Vector3.ZERO
var hud: Label
var smoke := false
var smoke_time := 0.0
var smoke_start := Vector3.ZERO
var smoke_clips := {}  # the clips seen while the smoke run walks him about
var shot_path := ""  # `-- --shot=<file.png>`: save one picture after a moment and quit (needs a display, not --headless)
var shot_frames := 0


func _ready() -> void:
	smoke = "--smoke" in OS.get_cmdline_user_args()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--shot="):
			shot_path = arg.substr(7)
	_setup_input()
	_setup_world()
	VenueBuilder.build(self)
	coach = Coach.new()
	coach.name = "Coach"
	var start: Dictionary = GameData.venue().coachStart
	coach.position = GameData.at(start)
	add_child(coach)
	smoke_start = coach.position
	_place_cast()
	camera = Camera3D.new()
	camera.fov = 42.0  # vertical, as three.js's
	camera.near = 0.1
	camera.far = 180.0
	add_child(camera)
	target = _follow_target()
	_place_camera()
	_setup_hud()


func _setup_input() -> void:
	var keys := {
		"move_up": [KEY_W, KEY_UP],
		"move_down": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT],
		"move_right": [KEY_D, KEY_RIGHT],
		"jump": [KEY_SPACE],
		"dash": [KEY_SHIFT],
		"slip_test": [KEY_K],
	}
	for action in keys:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		for key in keys[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			InputMap.action_add_event(action, ev)


## The "indoor" lighting preset (scene.mjs:64-75): godot/docs/venue.md. Three.js's intensities do not map one to one onto Godot's,
## so these are a first guess to tune by eye against godot/reference/.
func _setup_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#537e7b")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#cfe3e0").lerp(Color("#80654d"), 0.35)
	env.ambient_light_energy = 0.5
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.95
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color("#537e7b")
	env.fog_depth_begin = 50.0
	env.fog_depth_end = 125.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#ffd6a0")
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	add_child(sun)
	sun.look_at_from_position(Vector3(-12, 27, 10), Vector3.ZERO)
	var fill := DirectionalLight3D.new()
	fill.light_color = Color("#8fc3cb")
	fill.light_energy = 0.3
	add_child(fill)
	fill.look_at_from_position(Vector3(15, 15, -18), Vector3.ZERO)


## The guests' models standing in the queue's slots on their waiting clip, to show they import and play.
func _place_cast() -> void:
	var slots: Array = GameData.venue().queueSlots["-1"] + GameData.venue().queueSlots["1"]
	for i in CAST.size():
		var guest: Node3D = (load(CAST[i]) as PackedScene).instantiate()
		guest.position = GameData.at(slots[i])
		guest.rotation.y = 0.0  # facing the pool (+Z)
		add_child(guest)
		var anim: AnimationPlayer = guest.find_child("AnimationPlayer", true, false)
		var clip := "WaitWatch" if anim.has_animation("WaitWatch") else "IdleScan"
		anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
		anim.play(clip)
		anim.seek(randf() * 2.0)


func _setup_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Label.new()
	hud.position = Vector2(16, 12)
	hud.add_theme_font_override("font", load("res://assets/fonts/barlow-condensed-700.woff2"))
	hud.add_theme_font_size_override("font_size", 22)
	hud.add_theme_color_override("font_color", Color.WHITE)
	hud.add_theme_color_override("font_outline_color", Color("#123c40"))
	hud.add_theme_constant_override("outline_size", 6)
	layer.add_child(hud)


func _physics_process(dt: float) -> void:
	# The camera looks across the pool: screen up is +X and screen right is +Z (spatial.mjs screenMovement).
	var v := Input.get_vector("move_left", "move_right", "move_down", "move_up")
	if smoke:
		smoke_time += dt
		v = Vector2(1, 0) if smoke_time < 1.0 else Vector2(0, -1) if smoke_time < 2.0 else Vector2.ZERO
		if smoke_time > 1.4 and smoke_time < 1.45:
			coach.jump()
		if coach.anim:
			smoke_clips[coach.anim.current_animation] = true
		if smoke_time > 3.0:
			_finish_smoke()
	coach.input = Vector2(v.y, v.x).limit_length(1.0)
	if Input.is_action_just_pressed("jump"):
		coach.jump()
	if Input.is_action_just_pressed("dash"):
		coach.dash()
	if Input.is_action_just_pressed("slip_test"):
		coach.slip(1.3)


func _process(dt: float) -> void:
	target = target.lerp(_follow_target(), 1.0 - exp(-2.5 * dt))
	_place_camera()
	if shot_path != "":
		shot_frames += 1
		if shot_frames == 90:
			get_viewport().get_texture().get_image().save_png(shot_path)
			print("SHOT saved ", shot_path)
			get_tree().quit()
	hud.text = "POOL PANIC · Godot test · Community Pool\nWASD move · Space jump · Shift dash · K slip (test)\n%d fps" % Engine.get_frames_per_second()


## followCoach (scene.mjs:2089): the target leans a little toward the coach.
func _follow_target() -> Vector3:
	var f: Dictionary = GameData.venue().cameraFollow
	var p := coach.position
	return Vector3(clamp(p.x * float(f.kx), -float(f.maxX), float(f.maxX)), 0.45, clamp(p.z * 0.13, -1.5, 1.5) - 3.2)


## The camera stands back along (−0.65, 0.76, 0) from its target, about 22 m at 16:9 (scene.mjs:1977-2006).
func _place_camera() -> void:
	var size := get_viewport().get_visible_rect().size
	var aspect := size.x / maxf(1.0, size.y)
	var dist := maxf(20.5, minf(64.0, 30.0 / (2.0 * tan(deg_to_rad(21.0)) * aspect)))
	var dir := Vector3(-0.65, 0.76, 0).normalized()
	camera.position = target + dir * dist
	camera.look_at(target, Vector3.UP)


func _finish_smoke() -> void:
	var moved := coach.position.distance_to(smoke_start)
	var anim := coach.anim
	var ok := moved > 3.0 and anim != null and smoke_clips.has("Run") and smoke_clips.has("IdleScan") and anim.has_animation("SwimRing")
	print("SMOKE coach moved %.2f m to (%.2f, %.2f), clips seen %s, %s" % [moved, coach.position.x, coach.position.z, smoke_clips.keys(), "OK" if ok else "FAILED"])
	get_tree().quit(0 if ok else 1)
