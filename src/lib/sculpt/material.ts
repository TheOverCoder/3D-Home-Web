import { DoubleSide, FrontSide, MeshStandardMaterial, ShaderChunk, Vector3 } from 'three'

// One material for everything the kit makes. Colours come from the vertices, in two layers with a crisp edge
// between them (the pattern: see core.ts), and an instanced mesh's own colour (setColorAt) applies only as much as
// each vertex's tint mask says — so a herd shares one cow, each in her own coat, with eyes and hooves that stay as
// painted; a bed of tomatoes ripens from green to red while the calyx stays green.
//
// Fine surface detail costs no triangles: `detail` adds bumps finer than any vertex (wool, bark, bread crust,
// soil), from noise worked out per pixel on the part's own coordinates, so it moves with the part. Its settings
// are uniforms, so every detailed material shares one shader: a new kind of surface costs no compile at start-up.
// `setSculptDetail(false)` skips the noise everywhere at once (the lowest graphics tier, weak devices).

const cache = new Map<string, MeshStandardMaterial>()

/** One switch for every detailed material (a uniform they all share). */
const detailOn = { value: 1 }

/** Fine surface detail on or off, everywhere at once (no recompiling): off in the lowest graphics tier. */
export function setSculptDetail(on: boolean) {
  detailOn.value = on ? 1 : 0
}

// three's colour chunk, with the instance colour weighted by the tint mask, and the pattern layer passed on
const COLOR_VERTEX =
  ShaderChunk.color_vertex.replace('vColor.rgb *= instanceColor.rgb;', 'vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, tint );') +
  `
vColor2 = color2;
#ifdef USE_INSTANCING_COLOR
	vColor2 *= mix( vec3( 1.0 ), instanceColor.rgb, tint );
#endif
vPattern = pattern;
`
if (!COLOR_VERTEX.includes('instanceColor.rgb, tint')) console.warn('[sculpt] three changed its colour chunk: instance tints apply everywhere')

// the two layers meet where the pattern crosses 0.5: a smooth step one pixel wide, so the edge is sharp at any
// distance and never jagged
const COLOR_FRAGMENT = `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	float sculptEdge = fwidth( vPattern ) * 0.75 + 1e-4;
	diffuseColor *= vec4( mix( vColor.rgb, vColor2, smoothstep( 0.5 - sculptEdge, 0.5 + sculptEdge, vPattern ) ), vColor.a );
#endif
#ifdef SCULPT_DETAIL
	float sculptH = 0.5;
	// (a branch on a uniform: every pixel takes the same way, so it costs nothing when the detail is off)
	if ( sculptDetailOn > 0.5 ) {
		// two octaves of value noise on the part's own coordinates: lighter on the bumps, darker in the hollows. Each
		// octave fades out as it gets smaller than a pixel or two, so far away the surface is calm instead of sparkling.
		vec3 sculptP = vSculptPos * sculptDetail.x;
		float sculptPx = length( fwidth( sculptP ) );
		float sculptF1 = 1.0 - smoothstep( 0.3, 0.8, sculptPx );
		float sculptF2 = 1.0 - smoothstep( 0.3, 0.8, sculptPx * 2.17 );
		sculptH = 0.5 + ( sculptNoise( sculptP ) - 0.5 ) * 0.62 * sculptF1 + ( sculptNoise( sculptP * 2.17 + 3.1 ) - 0.5 ) * 0.38 * sculptF2;
		diffuseColor.rgb *= mix( 1.0 - sculptDetail.z, 1.0 + sculptDetail.z * 0.3, sculptH );
	}
#endif
`

// the bumps tilt the normal along the slope of the noise on screen (as a bump map does)
const DETAIL_NORMAL = `
#ifdef SCULPT_DETAIL
	if ( sculptDetailOn > 0.5 ) {
		vec3 sigmaX = dFdx( - vViewPosition );
		vec3 sigmaY = dFdy( - vViewPosition );
		vec3 r1 = cross( sigmaY, normal );
		vec3 r2 = cross( normal, sigmaX );
		float det = dot( sigmaX, r1 ) * faceDirection;
		vec2 dH = vec2( dFdx( sculptH ), dFdy( sculptH ) ) * sculptDetail.y;
		vec3 grad = sign( det ) * ( dH.x * r1 + dH.y * r2 );
		normal = normalize( abs( det ) * normal - grad );
	}
#endif
`

const NOISE = `
#ifdef SCULPT_DETAIL
varying vec3 vSculptPos;
uniform vec3 sculptDetail; // bumps to the metre, bump depth, shade in the hollows
uniform float sculptDetailOn; // 1: drawn, 0: skipped (see setSculptDetail)
float sculptHash( vec3 p ) {
	p = fract( p * 0.3183099 + 0.1 );
	p *= 17.0;
	return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float sculptNoise( vec3 x ) {
	vec3 i = floor( x );
	vec3 f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix(
		mix( mix( sculptHash( i ), sculptHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( sculptHash( i + vec3( 0, 1, 0 ) ), sculptHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( sculptHash( i + vec3( 0, 0, 1 ) ), sculptHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( sculptHash( i + vec3( 0, 1, 1 ) ), sculptHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
		f.z
	);
}
#endif
`

export interface SculptMaterialOptions {
  roughness?: number
  /** leaves and other thin, open shapes are seen from both sides */
  doubleSided?: boolean
  /** a little sheen of its own (fruit, feathers): lower roughness reads as gloss */
  metalness?: number
  /** fine bumps: `scale` how many to the metre, `bump` how deep they look, `shade` how much darker the hollows */
  detail?: { scale: number; bump: number; shade: number }
  /** thin leaves: both sides take the light as the upper side does (light shows through a leaf, so its underside
   *  is never black) — use with doubleSided */
  leaf?: boolean
}

export function sculptMaterial(o: SculptMaterialOptions = {}): MeshStandardMaterial {
  const d = o.detail
  const key = `${o.roughness ?? 0.8}|${o.doubleSided ? 2 : 1}|${o.metalness ?? 0}|${d ? `${d.scale},${d.bump},${d.shade}` : ''}|${o.leaf ? 1 : 0}`
  let m = cache.get(key)
  if (m) return m
  m = new MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0, side: o.doubleSided ? DoubleSide : FrontSide })
  const defines: Record<string, string> = {}
  if (d) defines.SCULPT_DETAIL = ''
  if (o.leaf) defines.SCULPT_LEAF = ''
  if (Object.keys(defines).length) m.defines = defines
  const detail = d ? new Vector3(d.scale, d.bump, d.shade) : null
  m.onBeforeCompile = (shader) => {
    if (detail) {
      shader.uniforms.sculptDetail = { value: detail }
      shader.uniforms.sculptDetailOn = detailOn
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tint;\nattribute vec3 color2;\nattribute float pattern;\nvarying vec3 vColor2;\nvarying float vPattern;\n#ifdef SCULPT_DETAIL\nvarying vec3 vSculptPos;\n#endif')
      .replace('#include <color_vertex>', COLOR_VERTEX + '\n#ifdef SCULPT_DETAIL\nvSculptPos = position;\n#endif\n')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vColor2;\nvarying float vPattern;\n' + NOISE)
      .replace('#include <color_fragment>', COLOR_FRAGMENT)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + DETAIL_NORMAL)
      // a leaf's underside is lit like its upper side (three turned its normal round for the back face)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef SCULPT_LEAF\nnormal *= faceDirection;\n#endif')
  }
  m.customProgramCacheKey = () => 'sculpt-v3'
  cache.set(key, m)
  return m
}
