extends Node3D
## The Godot test's one scene: the Community Pool (scripts/club/club_scene.gd), Coach Waters on WASD with the real game's movement,
## the guests' models waiting in the queue, and the real game's camera. No menu: it opens straight into the pool.
## Run with `-- --smoke` (godot/tools/check.sh) to walk the coach about by itself for a few seconds and quit: the headless check.
## `-- --shot=<png>` saves a picture after `--wait=<frames>` (90) and quits; `--cam=x,y,z,tx,ty,tz` looks from another place.

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
var shot_wait := 90
var fixed_cam := PackedFloat32Array()
var club: ClubScene
var _swimmers: Array[Node3D] = []
var _quality_arg := -1
var _shots: Array = []  # `--shots=<file>`: lines "<out.png> game" or "<out.png> x,y,z,tx,ty,tz", rendered in turn in one run


func _load_shots(path: String) -> void:
	for line in FileAccess.get_file_as_string(path).split("\n"):
		var parts := line.strip_edges().split(" ", false)
		if parts.size() >= 2:
			_shots.append(parts)
	if _shots.size() > 0:
		shot_path = _shots[0][0]
		_apply_shot_cam(_shots[0][1])


func _apply_shot_cam(spec: String) -> void:
	fixed_cam = PackedFloat32Array() if spec == "game" else PackedFloat32Array(Array(spec.split(",")).map(func(v): return float(v)))


func _ready() -> void:
	smoke = "--smoke" in OS.get_cmdline_user_args()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--shot="):
			shot_path = arg.substr(7)
		elif arg.begins_with("--wait="):
			shot_wait = int(arg.substr(7))
		elif arg.begins_with("--shots="):
			_load_shots(arg.substr(8))
		elif arg.begins_with("--quality="):
			_quality_arg = int(arg.substr(10))
		elif arg.begins_with("--cam="):
			fixed_cam = PackedFloat32Array(Array(arg.substr(6).split(",")).map(func(v): return float(v)))
	_setup_input()
	club = ClubScene.new()
	club.name = "Club"
	if _quality_arg >= 0:
		club.quality = _quality_arg
	add_child(club)
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
	# three swimmers doing lengths, to show the water (the game lays the upright Swim clip prone, as the three.js game does)
	var lanes := [[-3.2, -2.0, 0.0], [0.0, 3.5, PI], [3.2, -5.5, 0.0]]
	for k in lanes.size():
		var swimmer: Node3D = (load(CAST[(k + 2) % CAST.size()]) as PackedScene).instantiate()
		var holder := Node3D.new()
		holder.name = "Swimmer%d" % k
		holder.position = Vector3(lanes[k][0], -0.42, lanes[k][1])
		holder.rotation.y = lanes[k][2]
		add_child(holder)
		holder.add_child(swimmer)
		swimmer.rotation.x = PI / 2
		swimmer.position = Vector3(0, 0.0, -0.75)
		var sanim: AnimationPlayer = swimmer.find_child("AnimationPlayer", true, false)
		sanim.get_animation("Swim").loop_mode = Animation.LOOP_LINEAR
		sanim.play("Swim")
		sanim.seek(k * 0.3)
		_swimmers.append(holder)


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
	hud.visible = shot_path == ""  # (clean pictures)


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
	# the swimmers do their lengths, turning at each end
	for sw in _swimmers:
		var dir := 1.0 if is_zero_approx(sw.rotation.y) else -1.0
		sw.position.z += dir * 1.6 * dt
		if absf(sw.position.z) > 7.2:
			sw.position.z = signf(sw.position.z) * 7.2
			sw.rotation.y = PI if dir > 0 else 0.0
	target = target.lerp(_follow_target(), 1.0 - exp(-2.5 * dt))
	_place_camera()
	if shot_path != "":
		shot_frames += 1
		if shot_frames == shot_wait:
			get_viewport().get_texture().get_image().save_png(shot_path)
			print("SHOT saved ", shot_path)
			if _shots.size() > 1:
				_shots.pop_front()
				shot_path = _shots[0][0]
				_apply_shot_cam(_shots[0][1])
				shot_frames = 0
			else:
				get_tree().quit()
	hud.text = "POOL PANIC · Godot test · Community Pool\nWASD move · Space jump · Shift dash · K slip (test) · F2 quality\n%d fps" % Engine.get_frames_per_second()


## followCoach (scene.mjs:2089): the target leans a little toward the coach.
func _follow_target() -> Vector3:
	var f: Dictionary = GameData.venue().cameraFollow
	var p := coach.position
	return Vector3(clamp(p.x * float(f.kx), -float(f.maxX), float(f.maxX)), 0.45, clamp(p.z * 0.13, -1.5, 1.5) - 3.2)


## The camera stands back along (−0.65, 0.76, 0) from its target, about 22 m at 16:9 (scene.mjs:1977-2006).
func _place_camera() -> void:
	# the game's camera never draws the near wall it stands behind; a fixed (close-up) view does
	camera.cull_mask = 0xFFFFF if fixed_cam.size() == 6 else 0xFFFFF & ~ClubScene.NEAR_WALL_LAYER
	if fixed_cam.size() == 6:
		camera.position = Vector3(fixed_cam[0], fixed_cam[1], fixed_cam[2])
		camera.look_at(Vector3(fixed_cam[3], fixed_cam[4], fixed_cam[5]), Vector3.UP)
		return
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
