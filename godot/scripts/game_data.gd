class_name GameData
## The numbers exported from the three.js game (godot/tools/export-data.mjs writes godot/data/*.json). Read them from here so the
## Godot test and the real game agree; re-run the exporter when the real game changes.

static var _cache := {}


static func load_json(name: String) -> Dictionary:
	if _cache.has(name):
		return _cache[name]
	var path := "res://data/%s.json" % name
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		push_error("Missing %s (run node godot/tools/export-data.mjs from the repo root)" % path)
		return {}
	var data: Variant = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		push_error("Bad JSON in %s" % path)
		return {}
	_cache[name] = data
	return data


static func venue() -> Dictionary:
	return load_json("club-venue")


static func tuning() -> Dictionary:
	return load_json("tuning")


static func shift() -> Dictionary:
	return load_json("club-shift")


## Whether the coach may stand at (x, z): the deck's walkable cells, exported from the real game's isDeck (its radius counted).
static func is_deck(x: float, z: float) -> bool:
	var g: Dictionary = venue().get("walkGrid", {})
	if g.is_empty():
		return true
	var cell: float = g.cell
	var col := int(round((x - float(g.minX)) / cell))
	var row := int(round((z - float(g.minZ)) / cell))
	var rows: Array = g.rows
	if row < 0 or row >= rows.size():
		return false
	var line: String = rows[row]
	if col < 0 or col >= line.length():
		return false
	return line[col] == "1"


## A 2D point {x, z} of the JSON as a Vector3 on the deck.
static func at(p: Dictionary, y := 0.0) -> Vector3:
	return Vector3(float(p.x), y, float(p.z))
