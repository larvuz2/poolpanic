// Tiled surfaces of the Community Pool, mapped in world space (no UVs needed): the deck, the walls, the pool's basin.
// - triplanar albedo, normal and roughness from one texture set, `world_scale` metres per repeat;
// - under the water (`caustics_on`): the dancing light of the ripples, two layers of the caustic web drifting across each other,
//   and the light fading with depth;
// - on the deck (`wet_on`): a wet, darker, glossier ring round the pool where swimmers climb out and splash.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rough_tex : hint_roughness_r, filter_linear_mipmap_anisotropic, repeat_enable;
uniform vec3 tint : source_color = vec3(1.0);
uniform float world_scale = 1.0;
uniform float normal_strength = 1.0;
uniform float roughness_scale = 1.0;
uniform float specular_amount = 0.5;
uniform vec3 offset = vec3(0.0);

uniform bool caustics_on = false;
uniform sampler2D caustics_tex : hint_default_black, filter_linear_mipmap, repeat_enable;
uniform float water_y = -0.25;
uniform float caustic_strength = 1.4;
uniform float caustic_scale = 0.32;
uniform vec3 deep_tint : source_color = vec3(0.55, 0.85, 0.88);

uniform bool wet_on = false;
uniform vec2 pool_half = vec2(5.0, 8.3);
uniform float wet_width = 1.6;
uniform sampler2D wet_noise : hint_default_white, filter_linear_mipmap, repeat_enable;

varying vec3 wpos;
varying vec3 wnorm;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

vec3 tri_weights(vec3 n) {
	vec3 w = pow(abs(n), vec3(6.0));
	return w / (w.x + w.y + w.z);
}

void fragment() {
	vec3 p = (wpos + offset) / world_scale;
	vec3 n = normalize(wnorm);
	vec3 w = tri_weights(n);
	vec2 uvx = p.zy, uvy = p.xz, uvz = p.xy;
	vec3 ax = texture(albedo_tex, uvx).rgb, ay = texture(albedo_tex, uvy).rgb, az = texture(albedo_tex, uvz).rgb;
	vec3 albedo = ax * w.x + ay * w.y + az * w.z;
	float rough = texture(rough_tex, uvx).r * w.x + texture(rough_tex, uvy).r * w.y + texture(rough_tex, uvz).r * w.z;
	// whiteout blend of the three tangent-space normals into a world normal
	vec3 tnx = texture(normal_tex, uvx).rgb * 2.0 - 1.0;
	vec3 tny = texture(normal_tex, uvy).rgb * 2.0 - 1.0;
	vec3 tnz = texture(normal_tex, uvz).rgb * 2.0 - 1.0;
	tnx.xy *= normal_strength; tny.xy *= normal_strength; tnz.xy *= normal_strength;
	vec3 sgn = sign(n);
	tnx.x *= sgn.x; tny.x *= sgn.y; tnz.x *= -sgn.z;
	vec3 nx = vec3(tnx.xy + n.zy, abs(tnx.z) * n.x);
	vec3 ny = vec3(tny.xy + n.xz, abs(tny.z) * n.y);
	vec3 nz = vec3(tnz.xy + n.xy, abs(tnz.z) * n.z);
	vec3 wn = normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);

	albedo *= tint;
	float spec = specular_amount;

	if (caustics_on) {
		float below = clamp((water_y - wpos.y) / 0.25, 0.0, 1.0);
		if (below > 0.0) {
			// project the web along the light's direction onto the surface, two layers drifting apart
			vec2 cp = (wpos.xz + wpos.y * vec2(0.55, 0.3)) * caustic_scale;
			float c1 = texture(caustics_tex, cp + vec2(TIME * 0.021, TIME * 0.013)).r;
			float c2 = texture(caustics_tex, cp * 1.31 + vec2(-TIME * 0.017, TIME * 0.019)).r;
			float c = min(c1, c2) * 1.6 + c1 * c2 * 0.6;
			float depth = clamp((water_y - wpos.y) / 1.8, 0.0, 1.0);
			albedo = mix(albedo, albedo * deep_tint, depth * 0.6 * below);
			albedo += albedo * c * caustic_strength * below * (1.0 - depth * 0.5);
		}
	}

	if (wet_on) {
		vec2 d2 = abs(wpos.xz) - pool_half;
		float dist = length(max(d2, 0.0)) + min(max(d2.x, d2.y), 0.0);
		float mask = 1.0 - smoothstep(0.2, wet_width, dist);
		float patch = texture(wet_noise, wpos.xz * 0.13).r;
		float wet = clamp(mask * smoothstep(0.35, 0.75, patch + mask * 0.35), 0.0, 1.0);
		albedo *= mix(1.0, 0.78, wet);
		rough = mix(rough, 0.08, wet);
		wn = normalize(mix(wn, n, wet * 0.8));
	}

	ALBEDO = albedo;
	ROUGHNESS = clamp(rough * roughness_scale, 0.02, 1.0);
	SPECULAR = spec;
	NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);
}
