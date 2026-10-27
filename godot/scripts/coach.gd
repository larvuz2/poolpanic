class_name Coach
extends Node3D
## Coach Waters: the same movement as the three.js game (dist/coach.mjs updateCoach, COACH_TUNING) and the same clip rules
## (dist/scene/coach-model.mjs CoachRig.update). godot/docs/coach.md has every number and where it comes from.
##
## The node sits at the coach's place on the deck and turns by `angle` (0 faces +Z, like the real game). Under it, `root` takes the
## lean, the squash and stretch and the slip, and under that the model.

const MODEL := "res://assets/characters/coach-waters.glb"
const LOOPED := ["Run", "Walk", "IdleScan", "Swim", "SwimRing", "Haul", "Massage", "FreakOut"]
const FAST_FADE := ["Run", "Swim", "SwimRing", "Startle"]

var T: Dictionary  # COACH_TUNING
var velocity := Vector3.ZERO  # x, z on the deck; y is the jump's vertical speed
var angle := PI / 2  # (the real game starts him facing +X)
var input := Vector2.ZERO  # x = toward +X (screen up), y = toward +Z (screen right)
var jump_buffer := 0.0
var landing := 0.0
var dash_time := 0.0
var dash_cooldown := 0.0
var dash_dir := Vector2.ZERO
var slip_time := 0.0
var slip_length := 1.3

var root: Node3D
var model: Node3D
var anim: AnimationPlayer
var _clip := ""
var _rate := 1.0
var _moving := false
var _idle_for := 0.0
var _scratch_at := 10.0


func _ready() -> void:
	T = GameData.tuning().get("coach", {})
	root = Node3D.new()
	root.name = "Root"
	add_child(root)
	var scene: PackedScene = load(MODEL)
	model = scene.instantiate()
	root.add_child(model)
	anim = model.find_child("AnimationPlayer", true, false)
	for clip in LOOPED:
		if anim and anim.has_animation(clip):
			anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	_scratch_at = randf_range(7.0, 13.0)
	_play("IdleScan", 0.0)


func jump() -> void:
	jump_buffer = 0.12


func dash() -> void:
	if dash_cooldown > 0.0 or slip_time > 0.0:
		return
	dash_dir = input.normalized() if input.length() > 0.0 else Vector2(sin(angle), cos(angle))
	dash_time = float(T.dashDuration)
	dash_cooldown = float(T.dashCooldown)


func slip(seconds := 1.3) -> void:
	slip_time = seconds
	slip_length = seconds
	velocity.x *= 0.2
	velocity.z *= 0.2


func _physics_process(dt: float) -> void:
	landing = max(0.0, landing - dt)
	slip_time = max(0.0, slip_time - dt)
	dash_cooldown = max(0.0, dash_cooldown - dt)
	if jump_buffer > 0.0 and position.y == 0.0 and slip_time == 0.0:
		velocity.y = float(T.jumpSpeed)
		jump_buffer = 0.0
	jump_buffer = max(0.0, jump_buffer - dt)

	# Accelerate toward the wanted velocity, at most `acceleration` (pushing) or `braking` (let go) m/s² (coach.mjs:185-198).
	var moving := slip_time == 0.0
	var pushing := input.length() > 0.0
	var accel := float(T.acceleration) if pushing else float(T.braking)
	var speed := float(T.speed)
	var want := input * speed if moving else Vector2.ZERO
	var v := Vector2(velocity.x, velocity.z)
	var d := want - v
	if dash_time > 0.0 and moving:
		v = dash_dir * float(T.dashSpeed)
	else:
		v += d * min(1.0, accel * dt / max(0.000001, d.length()))
	dash_time = max(0.0, dash_time - dt) if moving else 0.0

	# Slide along what is in the way, one axis at a time, in slices no longer than 12 cm (coach.mjs:205-212).
	var slices: int = max(1, ceili(max(abs(v.x), abs(v.y)) * dt / 0.12))
	for i in slices:
		var x := position.x + v.x * dt / slices
		if GameData.is_deck(x, position.z):
			position.x = x
		else:
			v.x = 0.0
		var z := position.z + v.y * dt / slices
		if GameData.is_deck(position.x, z):
			position.z = z
		else:
			v.y = 0.0
	velocity.x = v.x
	velocity.z = v.y
	if v.length() > 0.12:
		angle = atan2(v.x, v.y)

	# The jump: straight up and down under gravity, with a squash on landing (coach.mjs:236-246).
	if position.y > 0.0 or velocity.y > 0.0:
		velocity.y -= float(T.gravity) * dt
		position.y = max(0.0, position.y + velocity.y * dt)
		if position.y == 0.0 and velocity.y < 0.0:
			velocity.y = 0.0
			landing = 0.18


func _process(dt: float) -> void:
	# Turn by 30% of the way each frame, the short way round (scene.mjs:1520).
	rotation.y += wrapf(angle - rotation.y, -PI, PI) * 0.3
	_pose_root()
	_update_clip(dt)


func _pose_root() -> void:
	var lean := 0.25 if dash_time > 0.0 else 0.0
	var sy := 1.0
	if position.y > 0.0:
		sy = 1.0 + max(0.0, velocity.y) * 0.017
	elif landing > 0.0:
		sy = 1.0 - 0.17 * (landing / 0.18)
	var sxz := 1.0 / sqrt(sy)
	root.scale = Vector3(sxz, sy, sxz)
	# The slip: on his back, eased in over the first 22% and out over the last 42% (scene.mjs:953-973).
	var down := 0.0
	if slip_time > 0.0:
		var t := 1.0 - slip_time / slip_length
		down = smoothstep(0.0, 0.22, t) * (1.0 - smoothstep(0.58, 1.0, t))
	root.rotation.x = lean - PI / 2 * down
	root.position = Vector3(0, 0.37 * down, -0.12 * down)


func _update_clip(dt: float) -> void:
	if anim == null:
		return
	var speed := Vector2(velocity.x, velocity.z).length()
	# Moving starts above 0.9 m/s and stops under 0.35 (coach-model.mjs:186).
	_moving = speed > 0.35 if _moving else speed > 0.9
	var clip := "IdleScan"
	var target := 1.0
	if _moving:
		clip = "Run"
		target = clamp(speed / 3.85, 0.6, 2.1)
		_idle_for = 0.0
	else:
		_idle_for += dt
		if _idle_for > _scratch_at and slip_time == 0.0:
			clip = "IdleScratch"
			var length := anim.get_animation("IdleScratch").length
			if _idle_for > _scratch_at + length - 0.35:
				_idle_for = 0.0
				_scratch_at = randf_range(7.0, 13.0)
				clip = "IdleScan"
	if clip != _clip:
		_play(clip, 0.12 if clip in FAST_FADE else 0.22)
	_rate += (target - _rate) * min(1.0, dt * 14.0)
	anim.speed_scale = _rate if clip == "Run" else 1.0


func _play(clip: String, fade: float) -> void:
	_clip = clip
	if anim and anim.has_animation(clip):
		anim.play(clip, fade)
