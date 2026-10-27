// The garden's palms and shrubs: two-sided leaves that sway in the sea breeze. The sway is in the vertex shader, so the shadows
// the fronds throw through the windows onto the deck move with them.
shader_type spatial;
render_mode cull_disabled, diffuse_burley;

uniform vec3 colour : source_color = vec3(0.31, 0.56, 0.29);
uniform vec3 colour_tip : source_color = vec3(0.55, 0.7, 0.32);
uniform float sway = 0.12;
uniform float sway_from = 5.0; // height (m) below which nothing moves

varying float h;

void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	h = w.y;
	float k = max(0.0, w.y - sway_from);
	float gust = sin(TIME * 0.45 + w.z * 0.05) * 0.5 + 0.5;
	vec3 off = vec3(
		sin(TIME * 1.3 + w.x * 0.4 + w.z * 0.3) * 0.6 + sin(TIME * 2.9 + w.z * 1.1) * 0.25,
		sin(TIME * 2.1 + w.x * 0.7) * 0.15,
		cos(TIME * 1.1 + w.z * 0.5) * 0.5
	) * sway * k * (0.6 + gust * 0.8);
	VERTEX += (inverse(MODEL_MATRIX) * vec4(off, 0.0)).xyz;
}

void fragment() {
	float t = clamp((h - sway_from) / 4.0, 0.0, 1.0);
	ALBEDO = mix(colour, colour_tip, t * 0.6);
	ROUGHNESS = 0.6;
	BACKLIGHT = vec3(0.35, 0.45, 0.2);
}
