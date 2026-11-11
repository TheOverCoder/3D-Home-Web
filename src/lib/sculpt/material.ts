import { DoubleSide, FrontSide, MeshStandardMaterial, ShaderChunk, Vector3, Vector4 } from 'three'
import { sculptSurfaceTexture, type SculptSurfaceKind } from '../proceduralTextures'
import type { V3 } from './core'

// One material for everything the kit makes. Colours come from the vertices, in two layers with a crisp edge
// between them (the pattern: see core.ts), and an instanced mesh's own colour (setColorAt) applies only as much as
// each vertex's tint mask says — so a herd shares one cow, each in her own coat, with eyes and hooves that stay as
// painted; a bed of tomatoes ripens from green to red while the calyx stays green.
//
// Fine surface detail costs no triangles: `detail` adds bumps finer than any vertex (wool, bark, bread crust,
// soil), from noise worked out per pixel on the part's own coordinates, so it moves with the part. Its settings
// are uniforms, so every detailed material shares one shader: a new kind of surface costs no compile at start-up.
// `setSculptDetail(false)` skips the noise everywhere at once (the lowest graphics tier, weak devices).
//
// A `surface` lays a pattern over the vertex colours — stone courses, bricks, boards, shingles, bark, clay — from a
// small texture of the pattern's relief (proceduralTextures.ts), projected onto the part from the three axes (so it
// needs no UVs and keeps its size in metres whatever the shape) and lit by its own relief. It shades the colours the
// vertices give (a red board wall, grey slates), fills the joints with mortar or shadow, and costs no vertex: a wall
// of a hundred bricks is one box. Courses run level on every wall and stack up it; `turn` stands them on end
// (vertical boards, a log lying down). The shape's `surface` amount (core.ts) keeps parts of it plain.

const cache = new Map<string, MeshStandardMaterial>()

/** One switch for every detailed material (a uniform they all share). */
const detailOn = { value: 1 }

/** Fine surface detail on or off, everywhere at once (no recompiling): off in the lowest graphics tier. The
 *  surface patterns stay (they are the look of a wall), only their relief goes. */
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
#if defined( SCULPT_DETAIL ) || defined( SCULPT_SURFACE )
vSculptPos = position;
#endif
#ifdef SCULPT_SURFACE
vSurfNormal = normal;
vSurfAmount = surface;
#endif
`
if (!COLOR_VERTEX.includes('instanceColor.rgb, tint')) console.warn('[sculpt] three changed its colour chunk: instance tints apply everywhere')

// A second instance colour, only in a material that asks for it (`tint2`): it applies where the `tint2` vertex mask
// says, as the first does where `tint` says — the eyes' colour on a head whose skin is the first. Other materials
// compile exactly as before: none of this is in their shader.
const TINT2_HEAD = '\nattribute float tint2;\nattribute vec3 instanceColor2;'
const TINT2_VERTEX = `
vColor.rgb *= mix( vec3( 1.0 ), instanceColor2, tint2 );
vColor2 *= mix( vec3( 1.0 ), instanceColor2, tint2 );
`

// the two layers meet where the pattern crosses 0.5: a smooth step one pixel wide, so the edge is sharp at any
// distance and never jagged
const COLOR_FRAGMENT = `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	float sculptEdge = fwidth( vPattern ) * 0.75 + 1e-4;
	diffuseColor *= vec4( mix( vColor.rgb, vColor2, smoothstep( 0.5 - sculptEdge, 0.5 + sculptEdge, vPattern ) ), vColor.a );
#endif
#if defined( SCULPT_DETAIL ) || defined( SCULPT_SURFACE )
	float sculptBump = 0.0; // the relief, in metres, for the normal below
#endif
#ifdef SCULPT_DETAIL
	// (a branch on a uniform: every pixel takes the same way, so it costs nothing when the detail is off)
	if ( sculptDetailOn > 0.5 ) {
		// two octaves of value noise on the part's own coordinates: lighter on the bumps, darker in the hollows. Each
		// octave fades out as it gets smaller than a pixel or two, so far away the surface is calm instead of sparkling.
		vec3 sculptP = vSculptPos * sculptDetail.x;
		float sculptPx = length( fwidth( sculptP ) );
		float sculptF1 = 1.0 - smoothstep( 0.3, 0.8, sculptPx );
		float sculptF2 = 1.0 - smoothstep( 0.3, 0.8, sculptPx * 2.17 );
		float sculptH = 0.5 + ( sculptNoise( sculptP ) - 0.5 ) * 0.62 * sculptF1 + ( sculptNoise( sculptP * 2.17 + 3.1 ) - 0.5 ) * 0.38 * sculptF2;
		diffuseColor.rgb *= mix( 1.0 - sculptDetail.z, 1.0 + sculptDetail.z * 0.3, sculptH );
		sculptBump += sculptH * sculptDetail.y;
	}
#endif
#ifdef SCULPT_SURFACE
	float sculptJointAmt = 0.0;
	{
		// the three projections, weighted by how squarely the surface faces each axis (sharply: a wall takes its own)
		vec3 sn = normalize( vSurfNormal );
		vec3 sw = pow( abs( sn ), vec3( 8.0 ) );
		sw /= sw.x + sw.y + sw.z + 1e-6;
		vec3 sp = vSculptPos * sculptSurf.x;
		// walls: across the wall, then up it; a top or a roof: across, then down the slope (on either side of a ridge)
		vec2 uvX = vec2( sn.x >= 0.0 ? - sp.z : sp.z, sp.y );
		vec2 uvZ = vec2( sn.z >= 0.0 ? sp.x : - sp.x, sp.y );
		vec2 uvY = vec2( sp.x, sn.z >= 0.0 ? sp.z : - sp.z );
		if ( sculptSurf.w > 0.5 ) {
			uvX = uvX.yx;
			uvZ = uvZ.yx;
		}
		vec3 st = vec3( 0.0 );
		if ( sw.x > 0.01 ) st += texture2D( sculptSurfMap, uvX ).rgb * sw.x;
		if ( sw.y > 0.01 ) st += texture2D( sculptSurfMap, uvY ).rgb * sw.y;
		if ( sw.z > 0.01 ) st += texture2D( sculptSurfMap, uvZ ).rgb * sw.z;
		st /= max( 1e-3, ( sw.x > 0.01 ? sw.x : 0.0 ) + ( sw.y > 0.01 ? sw.y : 0.0 ) + ( sw.z > 0.01 ? sw.z : 0.0 ) );
		float sa = clamp( vSurfAmount, 0.0, 1.0 );
		// red: the tone (stone to stone, board to board, and the grain); green: the relief; blue: the joints
		diffuseColor.rgb *= 1.0 + ( st.r - 0.5 ) * 2.0 * sculptSurfTone * sa;
		sculptJointAmt = st.b * sa;
		diffuseColor.rgb = mix( diffuseColor.rgb, mix( diffuseColor.rgb * 0.45, sculptJoint.rgb, sculptJoint.a ), sculptJointAmt );
		if ( sculptDetailOn > 0.5 ) sculptBump += st.g * sculptSurf.z * sa;
	}
#endif
`

// the relief tilts the normal along its slope on screen (as a bump map does)
const BUMP_NORMAL = `
#if defined( SCULPT_DETAIL ) || defined( SCULPT_SURFACE )
	if ( sculptDetailOn > 0.5 ) {
		vec3 sigmaX = dFdx( - vViewPosition );
		vec3 sigmaY = dFdy( - vViewPosition );
		vec3 r1 = cross( sigmaY, normal );
		vec3 r2 = cross( normal, sigmaX );
		float det = dot( sigmaX, r1 ) * faceDirection;
		vec2 dH = vec2( dFdx( sculptBump ), dFdy( sculptBump ) );
		vec3 grad = sign( det ) * ( dH.x * r1 + dH.y * r2 );
		normal = normalize( abs( det ) * normal - grad );
	}
#endif
`

const NOISE = `
#if defined( SCULPT_DETAIL ) || defined( SCULPT_SURFACE )
varying vec3 vSculptPos;
uniform float sculptDetailOn; // 1: drawn, 0: skipped (see setSculptDetail)
#endif
#ifdef SCULPT_SURFACE
varying vec3 vSurfNormal;
varying float vSurfAmount;
uniform sampler2D sculptSurfMap;
uniform vec4 sculptSurf; // tiles to the metre, -, relief depth (metres), turned
uniform float sculptSurfTone;
uniform vec4 sculptJoint; // the joints' colour, and whether there is one (else a darker shade)
#endif
#ifdef SCULPT_DETAIL
uniform vec3 sculptDetail; // bumps to the metre, bump depth, shade in the hollows
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

/** How deep each pattern's relief is (metres), before `bump`. */
const RELIEF: Record<SculptSurfaceKind, number> = { stone: 0.012, brick: 0.007, boards: 0.004, shingle: 0.01, bark: 0.012, clay: 0.006 }

export interface SculptSurface {
  /** the pattern: coursed stone, brick in running bond, boards, shingles, bark, hand-laid clay */
  kind: SculptSurfaceKind
  /** the metres one tile of the pattern spans: stone has 3 courses to a tile, brick 12 (4 bricks a row), boards 4,
   *  shingles 6 rows, so `size` sets their height (stone courses of 18 cm: size 0.54). A course starts at 0. */
  size: number
  /** the colour in the joints (mortar); none: a darker shade of the surface (the gaps between boards, shingles) */
  joint?: V3
  /** how much the tone varies from stone to stone, board to board (0..1, default 0.5) */
  tone?: number
  /** how deep the relief looks (default 1) */
  bump?: number
  /** a quarter turn on the walls: boards on end, courses up the wall, a log's bark along it when it lies down */
  turn?: boolean
}

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
  /** a pattern over the vertex colours: stone, brick, boards, shingles, bark, clay (see above) */
  surface?: SculptSurface
  /** a second instance colour (a crowd's `put` gives it: Parts), applied where the geometry's `tint2` attribute (0..1
   *  per vertex) says: the eyes on a head, the head's skin being the first colour. Off: the material is as before. */
  tint2?: boolean
}

export function sculptMaterial(o: SculptMaterialOptions = {}): MeshStandardMaterial {
  const d = o.detail
  const sf = o.surface
  const key = `${o.roughness ?? 0.8}|${o.doubleSided ? 2 : 1}|${o.metalness ?? 0}|${d ? `${d.scale},${d.bump},${d.shade}` : ''}|${o.leaf ? 1 : 0}|${sf ? `${sf.kind},${sf.size},${sf.joint ? sf.joint.join(',') : ''},${sf.tone ?? ''},${sf.bump ?? ''},${sf.turn ? 1 : 0}` : ''}${o.tint2 ? '|tint2' : ''}`
  let m = cache.get(key)
  if (m) return m
  m = new MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0, side: o.doubleSided ? DoubleSide : FrontSide })
  const defines: Record<string, string> = {}
  if (d) defines.SCULPT_DETAIL = ''
  if (sf) defines.SCULPT_SURFACE = ''
  if (o.leaf) defines.SCULPT_LEAF = ''
  // (a define of its own: the shader's cache key is the same for every sculpt material but for its defines)
  if (o.tint2) defines.SCULPT_TINT2 = ''
  if (Object.keys(defines).length) m.defines = defines
  const detail = d ? new Vector3(d.scale, d.bump, d.shade) : null
  const surface = sf
    ? {
        map: sculptSurfaceTexture(sf.kind),
        params: new Vector4(1 / sf.size, 0, RELIEF[sf.kind] * (sf.bump ?? 1), sf.turn ? 1 : 0),
        tone: sf.tone ?? 0.5,
        joint: sf.joint ? new Vector4(sf.joint[0], sf.joint[1], sf.joint[2], 1) : new Vector4(0, 0, 0, 0),
      }
    : null
  m.onBeforeCompile = (shader) => {
    if (detail || surface) shader.uniforms.sculptDetailOn = detailOn
    if (detail) shader.uniforms.sculptDetail = { value: detail }
    if (surface) {
      shader.uniforms.sculptSurfMap = { value: surface.map }
      shader.uniforms.sculptSurf = { value: surface.params }
      shader.uniforms.sculptSurfTone = { value: surface.tone }
      shader.uniforms.sculptJoint = { value: surface.joint }
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float tint;\nattribute vec3 color2;\nattribute float pattern;\nvarying vec3 vColor2;\nvarying float vPattern;\n#if defined( SCULPT_DETAIL ) || defined( SCULPT_SURFACE )\nvarying vec3 vSculptPos;\n#endif\n#ifdef SCULPT_SURFACE\nattribute float surface;\nvarying vec3 vSurfNormal;\nvarying float vSurfAmount;\n#endif' +
          (o.tint2 ? TINT2_HEAD : ''),
      )
      .replace('#include <color_vertex>', COLOR_VERTEX + (o.tint2 ? TINT2_VERTEX : ''))
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vColor2;\nvarying float vPattern;\n' + NOISE)
      .replace('#include <color_fragment>', COLOR_FRAGMENT)
      // the joints are a little rougher than the stones and boards
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef SCULPT_SURFACE\nroughnessFactor = min( 1.0, roughnessFactor + sculptJointAmt * 0.12 );\n#endif')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BUMP_NORMAL)
      // a leaf's underside is lit like its upper side (three turned its normal round for the back face)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef SCULPT_LEAF\nnormal *= faceDirection;\n#endif')
  }
  m.customProgramCacheKey = () => 'sculpt-v4'
  cache.set(key, m)
  return m
}
