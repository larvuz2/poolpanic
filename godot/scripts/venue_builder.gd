class_name VenueBuilder
## A plain block-out of the Community Pool from the exported layout (godot/data/club-venue.json): the deck, the basin and its water,
## the lane ropes, the starting blocks, the back wall, the low side walls, and a coloured box for every piece of furniture and every
## station. It is the starting point, in the real positions and colours (godot/docs/venue.md), not the look: making it look like
## Pool Panic is the test's job.

const DECK_Y := -0.018
const WATER_Y := -0.25
const FLOOR_Y := -1.42


static func build(parent: Node3D) -> void:
	var v := GameData.venue()
	var pool: Dictionary = v.pool
	var deck: Dictionary = v.deck
	var hx: float = pool.halfX  # the basin's half width (5.0)
	var hz := 8.3  # its half length (spatial.mjs poolGeometry)
	var tile := _mat(Color("#c99a70"), 0.74)

	# The deck: four slabs round the basin (its top at DECK_Y), so the hole is the pool.
	var x0: float = deck.minX
	var x1: float = deck.maxX
	var z0: float = deck.minZ
	var z1: float = deck.maxZ
	var th := 0.4
	_box(parent, Vector3((x0 + x1) / 2, DECK_Y - th / 2, (z0 - hz) / 2), Vector3(x1 - x0, th, -hz - z0), tile)
	_box(parent, Vector3((x0 + x1) / 2, DECK_Y - th / 2, (hz + z1) / 2), Vector3(x1 - x0, th, z1 - hz), tile)
	_box(parent, Vector3((x0 - hx) / 2, DECK_Y - th / 2, 0), Vector3(-hx - x0, th, 2 * hz), tile)
	_box(parent, Vector3((hx + x1) / 2, DECK_Y - th / 2, 0), Vector3(x1 - hx, th, 2 * hz), tile)

	# The coping round the basin, 0.35 m wide.
	var coping := _mat(Color("#dcc394"), 0.6)
	_box(parent, Vector3(0, DECK_Y + 0.01, -hz - 0.175), Vector3(2 * hx + 0.7, 0.04, 0.35), coping)
	_box(parent, Vector3(0, DECK_Y + 0.01, hz + 0.175), Vector3(2 * hx + 0.7, 0.04, 0.35), coping)
	_box(parent, Vector3(-hx - 0.175, DECK_Y + 0.01, 0), Vector3(0.35, 0.04, 2 * hz), coping)
	_box(parent, Vector3(hx + 0.175, DECK_Y + 0.01, 0), Vector3(0.35, 0.04, 2 * hz), coping)

	# The basin: a tiled floor and walls, and the water's surface.
	var basin := _mat(Color("#5cc2cb"), 0.5)
	var depth := DECK_Y - FLOOR_Y
	_box(parent, Vector3(0, FLOOR_Y - 0.05, 0), Vector3(2 * hx, 0.1, 2 * hz), basin)
	var wall := _mat(Color("#72cdd2"), 0.5)
	_box(parent, Vector3(0, FLOOR_Y + depth / 2, -hz - 0.05), Vector3(2 * hx, depth, 0.1), wall)
	_box(parent, Vector3(0, FLOOR_Y + depth / 2, hz + 0.05), Vector3(2 * hx, depth, 0.1), wall)
	_box(parent, Vector3(-hx - 0.05, FLOOR_Y + depth / 2, 0), Vector3(0.1, depth, 2 * hz), wall)
	_box(parent, Vector3(hx + 0.05, FLOOR_Y + depth / 2, 0), Vector3(0.1, depth, 2 * hz), wall)
	var water := StandardMaterial3D.new()
	water.albedo_color = Color("#17b0c9", 0.55)
	water.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	water.roughness = 0.08
	water.metallic_specular = 0.8
	var surface := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(2 * hx, 2 * hz)
	surface.mesh = plane
	surface.material_override = water
	surface.position.y = WATER_Y
	surface.name = "Water"
	parent.add_child(surface)

	# The lane ropes (x = ±1.6, ±4.8 for three lanes), cream with red ends.
	var lanes: Array = v.lanes
	for i in lanes.size() + 1:
		var x: float = -hx + 0.2 + i * 3.2
		var rope := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.115
		cyl.bottom_radius = 0.115
		cyl.height = 2 * hz
		rope.mesh = cyl
		rope.material_override = _mat(Color("#ffe3a2"), 0.5)
		rope.rotation.x = PI / 2
		rope.position = Vector3(x, -0.19, 0)
		parent.add_child(rope)

	# The starting blocks at the locker end (z −9.15).
	for x in lanes:
		_box(parent, Vector3(x, 0.25, -9.15), Vector3(1.2, 0.5, 1.12), _mat(Color("#529fd5"), 0.5))

	# The back wall, the low side walls.
	var room: Dictionary = v.room
	_box(parent, Vector3(0, 2.95, -16.35), Vector3(29.7, 5.9, 0.3), _mat(Color("#82a79b"), 0.9))
	_box(parent, Vector3(0, 0.62, -16.18), Vector3(29.7, 1.25, 0.1), _mat(Color("#4fa3a1"), 0.6))
	for side in [-1, 1]:
		_box(parent, Vector3(side * 14.8, 0.55, (room.minZ + room.maxZ) / 2), Vector3(0.3, 1.1, room.maxZ - room.minZ), _mat(Color("#447d7a"), 0.9))

	# Furniture and stations, as coloured boxes at their real places and sizes.
	for f in v.furniture:
		var h := 0.9 if f.kind != "plant" else 1.4
		var b := _box(parent, Vector3(f.x, h / 2, f.z), Vector3(2 * f.hx, h, 2 * f.hz), _mat(_kind_colour(f.kind), 0.8))
		b.name = "Furniture_%s" % f.kind
	var stations: Dictionary = v.stations
	var colours := {"fins": Color("#3593c1"), "chlorine": Color("#f4c849"), "relief": Color("#ddf3d7")}
	for key in stations:
		var s := _box(parent, GameData.at(stations[key], 0.5), Vector3(1.6, 1.0, 1.12), _mat(colours.get(key, Color.WHITE), 0.7))
		s.name = "Station_%s" % key
	for ring in v.ringMounts:
		var r := _box(parent, GameData.at(ring, 1.3), Vector3(1.0, 1.0, 0.1), _mat(Color("#f47742"), 0.6))
		r.rotation.y = float(ring.angle)
		r.name = "LifeRing"
	_box(parent, GameData.at(v.fixtures.mop, 0.25), Vector3(0.6, 0.5, 0.6), _mat(Color("#e7a83a"), 0.6)).name = "MopBucket"


static func _kind_colour(kind: String) -> Color:
	match kind:
		"bench":
			return Color("#b28363")
		"plant":
			return Color("#5a9a5a")
		"lifeguard":
			return Color("#f0bc51")
		_:
			return Color("#9fb3ad")


static func _mat(colour: Color, roughness: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = colour
	m.roughness = roughness
	return m


static func _box(parent: Node3D, centre: Vector3, size: Vector3, mat: Material) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	m.mesh = box
	m.material_override = mat
	m.position = centre
	parent.add_child(m)
	return m
