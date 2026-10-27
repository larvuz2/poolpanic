// The pool's water: the hero of the scene.
// - the floor seen through it, bent by the ripples (refraction from the screen) and coloured by how much water the light crosses
//   (the depth behind the surface): clear aqua at the edges and over the shallow end, deep teal over the deep end;
// - two drifting layers of ripples, a slow swell, sharp highlights of the sun and the windows (reflection probe and sky);
// - foam where anything breaks the surface (swimmers, the walls), from the depth buffer, and a lacy foam line along the walls;
// - `clouding` (0..1): the water turning milky as the chlorine runs low, for the game's water care.
shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, diffuse_burley, specular_schlick_ggx;

uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform sampler2D foam_tex : hint_default_white, filter_linear_mipmap, repeat_enable;

uniform vec3 shallow_color : source_color = vec3(0.42, 0.86, 0.86);
uniform vec3 deep_color : source_color = vec3(0.04, 0.42, 0.52);
uniform vec3 cloud_color : source_color = vec3(0.72, 0.82, 0.74);
uniform float absorption = 0.42;
uniform float refraction = 0.035;
uniform float ripple_scale = 0.32;
uniform float ripple_strength = 0.55;
uniform float clouding : hint_range(0.0, 1.0) = 0.0;
uniform vec2 pool_half = vec2(5.0, 8.3);

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float swell = sin(wpos.x * 0.8 + TIME * 0.9) * 0.006 + sin(wpos.z * 1.1 - TIME * 0.7) * 0.005
		+ sin((wpos.x + wpos.z) * 2.3 + TIME * 1.7) * 0.0025;
	VERTEX.y += swell;
}

float linear_depth(vec2 uv, mat4 inv_proj) {
	float d = texture(depth_tex, uv).r;
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, d, 1.0);
	return -v.z / v.w;
}

void fragment() {
	vec2 uv1 = wpos.xz * ripple_scale + vec2(TIME * 0.031, TIME * 0.017);
	vec2 uv2 = wpos.xz * ripple_scale * 1.73 + vec2(-TIME * 0.023, TIME * 0.029);
	vec3 n1 = texture(normal_tex, uv1).rgb * 2.0 - 1.0;
	vec3 n2 = texture(normal_tex, uv2).rgb * 2.0 - 1.0;
	vec3 tn = normalize(vec3(n1.xy + n2.xy, n1.z * n2.z));
	tn.xy *= ripple_strength;
	tn = normalize(tn);
	// the surface is flat: tangent +x, binormal +z in world space
	vec3 wn = normalize(vec3(tn.x, tn.z, -tn.y));
	NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);

	float surf = -VERTEX.z;
	vec2 offs = tn.xy * refraction;
	vec2 suv = SCREEN_UV + offs;
	float scene = linear_depth(suv, INV_PROJECTION_MATRIX);
	if (scene < surf) { // the bent ray landed on something in front of the water: look straight through instead
		suv = SCREEN_UV;
		scene = linear_depth(suv, INV_PROJECTION_MATRIX);
	}
	float thick = max(scene - surf, 0.0);
	float straight = max(linear_depth(SCREEN_UV, INV_PROJECTION_MATRIX) - surf, 0.0);

	vec3 behind = textureLod(screen_tex, suv, 0.0).rgb;
	float t = 1.0 - exp(-thick * absorption);
	vec3 water = mix(shallow_color, deep_color, t);
	vec3 seen = behind * mix(vec3(1.0), shallow_color, 0.65) * (1.0 - t * 0.75) + water * t * 0.4;
	seen = mix(seen, cloud_color * 0.75, clouding * 0.85);

	// foam: where the water is very thin in front of something (a swimmer, the wall), and a lacy line along the walls
	vec2 d2 = abs(wpos.xz) - pool_half;
	float edge = -max(d2.x, d2.y);
	float lace = texture(foam_tex, wpos.xz * 0.6 + vec2(TIME * 0.02, -TIME * 0.015)).r;
	float foam = (1.0 - smoothstep(0.0, 0.12, straight)) * 0.9 + (1.0 - smoothstep(0.0, 0.22, edge)) * smoothstep(0.55, 0.85, lace) * 0.6;
	foam = clamp(foam, 0.0, 1.0);

	float fres = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), 4.0);
	ALBEDO = mix(water * 0.25, vec3(0.95), foam);
	EMISSION = seen * (1.0 - fres * 0.6) * (1.0 - foam);
	ROUGHNESS = mix(0.035, 0.6, max(foam, clouding * 0.5));
	SPECULAR = 0.6;
	METALLIC = 0.0;
	ALPHA = 1.0;
}
