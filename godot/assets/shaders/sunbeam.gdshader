// The sun's shafts through the window wall, for the web build (the Compatibility renderer has no volumetric fog, which draws them
// in the desktop builds): each window pane's beam is a prism swept from the glass to the floor along the sunlight (club_scene.gd,
// _sunbeams), added softly onto the picture. Faces seen edge-on fade out, so no beam has a hard outline; it fades in from the
// glass and out before the floor, and drifting dust makes it shimmer.
shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

uniform vec3 color : source_color = vec3(1.0, 0.84, 0.6);
uniform float strength = 0.07;
uniform sampler2D dust_tex : hint_default_white, filter_linear_mipmap, repeat_enable;

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float facing = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float soft = smoothstep(0.05, 0.75, facing);
	float along = UV.y; // 0 at the glass, 1 on the floor
	float fade = smoothstep(0.0, 0.18, along) * (1.0 - smoothstep(0.55, 1.0, along));
	float dust = texture(dust_tex, wpos.xz * 0.11 + vec2(wpos.y * 0.07 + TIME * 0.006, TIME * 0.004)).r;
	ALBEDO = color * strength * soft * fade * mix(0.45, 1.35, dust);
}
