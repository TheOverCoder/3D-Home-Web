import { Color, DoubleSide, FrontSide, MeshStandardMaterial, ShaderChunk, Vector3, Vector4, type WebGLProgramParametersWithUniforms } from 'three'
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

/** How brightly every glowing part glows now (a uniform they all share): 0 by day, up to 1 at night. */
const glowLevel = { value: 0 }

/** Fine surface detail on or off, everywhere at once (no recompiling): off in the lowest graphics tier. The
 *  surface patterns stay (they are the look of a wall), only their relief goes. */
export function setSculptDetail(on: boolean) {
  detailOn.value = on ? 1 : 0
}

/** How brightly the glowing parts glow (`glow` in their material: a lamp's glass), everywhere at once and without
 *  recompiling: 0 by day (the glass as painted), 1 at night (each glows its own colour, as bright as its `glow`). */
export function setSculptGlow(level: number) {
  glowLevel.value = Math.max(0, level)
}

/** How brightly the glowing parts glow now (see `setSculptGlow`). */
export const sculptGlow = () => glowLevel.value

// ───────────────────────────── the season ─────────────────────────────
//
// The farm's year on what is there (update-v1/missions/10-seasons-weather.md, F4): no geometry, no draw and no compile
// more, only uniforms every seasonal material shares. Snow lies on what faces the sky (unevenly, in the kit's way: by a
// noise on where it is in the world), never under a roof (`setSculptShelters`: the house's and the walk-ins' rooms);
// the leaves (`foliage`: the trees' crowns, the hedge, the bushes) turn to the season's colour, tree by tree by a hash of
// where each stands, some further than others; the lawn takes the season's colour. Which materials it reaches: the
// kit's with a `surface` (what is built: roofs, walls' tops, boards, stone, bark) or marked `foliage`, and the plain ones
// `seasonal` is given (the lawns, the hedge, the bushes, the fences, the countryside's fields). What lives and moves —
// animals, people, crops — and what is swept (the beds' soil, the paths, the lanes) has none. Spring is nothing at all:
// every amount 0 and the lawn's colour white, each behind a branch on a uniform, so every pixel is today's. The sun's
// map is depth only: kept as it was.

/** The most rooms with a roof the shader takes (src/lib/world.ts, `shelters`: the farm's walk-in rooms, the house). */
export const MOST_SHELTERS = 8

/** A room with a roof over it: no snow on what is in it (the floor, a table, a shelf), up to `top` (the roof's). */
export interface SculptShelter {
  x0: number
  x1: number
  z0: number
  z1: number
  top: number
}

/** What the season's chunk reads, shared by every seasonal material. */
const seasonUniforms = {
  /** snow on what faces the sky (0 none: spring, summer, autumn) */
  seasonCover: { value: 0 },
  /** the colour the leaves turn to (linear) and how far (0: as they are) */
  seasonFoliage: { value: new Vector4(1, 1, 1, 0) },
  /** the colour the trees that turn furthest go to (autumn's reds) */
  seasonFar: { value: new Vector3(1, 1, 1) },
  /** the lawn's colour, multiplying its own (white: as it is) */
  seasonGrass: { value: new Vector3(1, 1, 1) },
  /** the rooms with a roof: x0, z0, x1, z1 each, and their roofs' heights */
  seasonShelter: { value: Array.from({ length: MOST_SHELTERS }, () => new Vector4()) },
  seasonShelterTop: { value: Array.from({ length: MOST_SHELTERS }, () => 0) },
  seasonShelters: { value: 0 },
}

/** The rooms with a roof as uniforms, the same objects every seasonal material reads: for another shader that ends at
 *  them (the rain and snow: src/fx/quarks.ts, `weatherFx`), set with `setSculptShelters`. */
export const shelterUniforms = {
  seasonShelter: seasonUniforms.seasonShelter,
  seasonShelterTop: seasonUniforms.seasonShelterTop,
  seasonShelters: seasonUniforms.seasonShelters,
}

/** The season as the materials take it: snow on what faces the sky (0–1), the leaves' colour, the colour the furthest
 *  turned go to and how far they turn (0–1), and the lawn's colour (CSS colours; white leaves it as it is). */
export interface SculptSeason {
  cover: number
  foliage: { color: string; far: string; amount: number }
  grass: string
}

const linear = new Map<string, Color>()
/** A CSS colour in the shader's (linear) colours, parsed once. */
function lin(css: string): Color {
  let c = linear.get(css)
  if (!c) linear.set(css, (c = new Color(css)))
  return c
}

/** The season on every seasonal material at once, with no recompiling (each frame: src/scene/Lighting.tsx, DayLight). */
export function setSculptSeason(s: SculptSeason) {
  const u = seasonUniforms
  u.seasonCover.value = Math.min(1, Math.max(0, s.cover || 0))
  const f = lin(s.foliage.color)
  u.seasonFoliage.value.set(f.r, f.g, f.b, Math.min(1, Math.max(0, s.foliage.amount || 0)))
  const far = lin(s.foliage.far)
  u.seasonFar.value.set(far.r, far.g, far.b)
  const g = lin(s.grass)
  u.seasonGrass.value.set(g.r, g.g, g.b)
}

/** The rooms with a roof on the map in the scene (src/lib/world.ts, `shelters`): no snow lies in them. At most
 *  MOST_SHELTERS; the rest are left out. */
export function setSculptShelters(list: readonly SculptShelter[]) {
  const u = seasonUniforms
  const n = Math.min(MOST_SHELTERS, list.length)
  for (let i = 0; i < MOST_SHELTERS; i++) {
    const s = list[i]
    if (i < n) {
      u.seasonShelter.value[i].set(s.x0, s.z0, s.x1, s.z1)
      u.seasonShelterTop.value[i] = s.top
    } else {
      u.seasonShelter.value[i].set(0, 0, 0, 0)
      u.seasonShelterTop.value[i] = 0
    }
  }
  u.seasonShelters.value = n
}

/** The season's uniforms as they stand now (for the tests). */
export const sculptSeason = () => ({
  cover: seasonUniforms.seasonCover.value,
  foliage: seasonUniforms.seasonFoliage.value.toArray(),
  far: seasonUniforms.seasonFar.value.toArray(),
  grass: seasonUniforms.seasonGrass.value.toArray(),
  shelters: seasonUniforms.seasonShelters.value,
})

// a hash and a value noise in the world's metres (the leaves' turn tree by tree, the snow's patches)
const SEASON_NOISE = `
float seasonHash( vec2 p ) {
	p = fract( p * vec2( 0.1031, 0.1030 ) );
	p += dot( p, p.yx + 33.33 );
	return fract( ( p.x + p.y ) * p.x );
}
float seasonNoise( vec2 x ) {
	vec2 i = floor( x );
	vec2 f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( seasonHash( i ), seasonHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( seasonHash( i + vec2( 0.0, 1.0 ) ), seasonHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`

const SEASON_HEAD = `
#ifdef SCULPT_SEASON
uniform float seasonCover;
uniform vec4 seasonFoliage;
uniform vec3 seasonFar;
uniform vec3 seasonGrass;
uniform vec4 seasonShelter[ ${MOST_SHELTERS} ];
uniform float seasonShelterTop[ ${MOST_SHELTERS} ];
uniform int seasonShelters;
#ifdef SEASON_LEAF
varying vec2 vLeaf;
#endif
${SEASON_NOISE}
#endif
`

// each tree's own turn: a hash of where it stands (its model's or its instance's place; a crown made where it stands
// carries its tree's place, and whether it keeps its green, in `leafAt`), and how much of the season it keeps out
const SEASON_VERTEX_HEAD = `
#ifdef SEASON_LEAF
varying vec2 vLeaf;
#ifdef SEASON_LEAF_AT
attribute vec3 leafAt;
#endif
${SEASON_NOISE}
#endif
`
const SEASON_VERTEX = `
#ifdef SEASON_LEAF
	{
		vec4 leafPlace = vec4( 0.0, 0.0, 0.0, 1.0 );
		float leafStay = 0.0;
		#ifdef SEASON_LEAF_AT
		leafPlace.xz = leafAt.xy;
		leafStay = leafAt.z;
		#endif
		#ifdef USE_INSTANCING
		leafPlace = instanceMatrix * leafPlace;
		#endif
		leafPlace = modelMatrix * leafPlace;
		vLeaf = vec2( seasonHash( floor( leafPlace.xz * 4.0 ) ), leafStay );
	}
#endif
`

// in the world: where the pixel is and which way it faces (the view matrix is a turn and a move: its transpose turns
// back). Leaves first (their colour, then the snow over it), then the lawn's colour, then the snow
const SEASON_FRAGMENT = `
#ifdef SCULPT_SEASON
	{
		vec3 seasonAt = cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz;
		#ifdef SEASON_FOLIAGE
		if ( seasonFoliage.a > 0.0 ) {
			#ifdef SEASON_LEAF
			vec2 leaf = vLeaf;
			#else
			vec2 leaf = vec2( seasonNoise( seasonAt.xz * 0.35 ), 0.0 );
			#endif
			// the season's colour at the leaves' own light and shade (as bright as they were: a mid green becomes it)
			float lum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
			vec3 turned = mix( seasonFoliage.rgb, seasonFar, smoothstep( 0.45, 1.0, leaf.x ) ) * ( lum / 0.18 );
			diffuseColor.rgb = mix( diffuseColor.rgb, turned, min( 1.0, seasonFoliage.a * mix( 0.6, 1.35, leaf.x ) ) * ( 1.0 - leaf.y ) );
		}
		#endif
		#ifdef SEASON_GRASS
		diffuseColor.rgb *= seasonGrass;
		#endif
		#ifndef SEASON_BARE
		if ( seasonCover > 0.0 ) {
			float up = ( vec4( normal, 0.0 ) * viewMatrix ).y;
			float patches = seasonNoise( seasonAt.xz * 0.9 ) * 0.65 + seasonNoise( seasonAt.xz * 3.7 + 7.0 ) * 0.35;
			#ifdef SEASON_FOLIAGE
			// a cap on the top of a crown or a hedge, the sides as they are
			float lie = smoothstep( 0.5, 0.8, up + ( patches - 0.5 ) * 0.4 );
			#else
			float lie = smoothstep( 0.25, 0.55, up + ( patches - 0.5 ) * 0.4 );
			#endif
			// none under a roof (the roof's own top, a few centimetres up, keeps its snow)
			for ( int i = 0; i < ${MOST_SHELTERS}; i ++ ) {
				if ( i >= seasonShelters ) break;
				vec4 r = seasonShelter[ i ];
				if ( seasonAt.y < seasonShelterTop[ i ] - 0.05 && seasonAt.x > r.x && seasonAt.x < r.z && seasonAt.z > r.y && seasonAt.z < r.w ) lie = 0.0;
			}
			float snow = lie * min( 1.0, seasonCover * mix( 0.9, 1.25, patches ) );
			diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.82, 0.86, 0.92 ), snow );
			roughnessFactor = mix( roughnessFactor, 0.85, snow );
		}
		#endif
	}
#endif
`

/** The season's chunk into a shader (a sculpt material's, or a plain one's: `seasonal`): its uniforms, and its colours
 *  after the normal is known. */
function addSeason(shader: WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, seasonUniforms)
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + SEASON_VERTEX_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SEASON_VERTEX)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + SEASON_HEAD)
    .replace('#include <lights_physical_fragment>', SEASON_FRAGMENT + '#include <lights_physical_fragment>')
}

/** What the season does to a plain material (`seasonal`): snow on what faces the sky (unless `cover` is false), the
 *  leaves' colour (`foliage`: the hedge, the bushes) and the lawn's (`grass`). */
export interface SeasonalOptions {
  cover?: boolean
  foliage?: boolean
  grass?: boolean
}

/** A plain material (the lawns, the hedge, the bushes, the fences, the fields) given the season's chunk, as the kit's
 *  are: its own colours as they are in spring. Returns the material. A copy of it has the chunk too (a static batch
 *  draws its merged meshes with copies of their materials: src/lib/batch.ts). */
export function seasonal<M extends MeshStandardMaterial>(m: M, o: SeasonalOptions = {}): M {
  const defines: Record<string, string> = { ...m.defines, SCULPT_SEASON: '' }
  if (o.foliage) defines.SEASON_FOLIAGE = ''
  if (o.grass) defines.SEASON_GRASS = ''
  if (o.cover === false) defines.SEASON_BARE = ''
  m.defines = defines
  m.onBeforeCompile = addSeason
  m.customProgramCacheKey = () => 'seasonal-v1'
  // (three's own copy keeps neither the defines nor the chunk)
  const copy = Object.getPrototypeOf(m).clone as () => M
  m.clone = () => seasonal(copy.call(m), o)
  m.needsUpdate = true
  return m
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

// the relief tilts the normal along its slope (as a bump map does). The slope is measured on the triangle itself (its
// own facing, from how the surface moves across the screen), then laid across the drawn normal. Measured against the
// drawn normal instead, it grows as one over the cosine between the two: where a model's normals are bent far from its
// triangles (a crown lit as one ball, a smooth normal round a sharp rim like a pine tier's), the relief tipped the
// normal right over, away from every light, and the dark rims came out as black specks in a line.
const BUMP_NORMAL = `
#if defined( SCULPT_DETAIL ) || defined( SCULPT_SURFACE )
	if ( sculptDetailOn > 0.5 ) {
		vec3 sigmaX = dFdx( - vViewPosition );
		vec3 sigmaY = dFdy( - vViewPosition );
		vec2 dH = vec2( dFdx( sculptBump ), dFdy( sculptBump ) );
		// the triangle's facing, and the area of a pixel on it
		vec3 facing = cross( sigmaX, sigmaY );
		float area = max( length( facing ), 1e-20 );
		facing /= area;
		// the slope along the triangle, then only its part across the drawn normal
		vec3 grad = ( dH.x * cross( sigmaY, facing ) + dH.y * cross( facing, sigmaX ) ) / area;
		grad -= dot( grad, normal ) * normal;
		normal = normalize( normal - faceDirection * grad );
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

// a glowing part: its own colour as light, at the shared level (by day 0, nothing added)
const GLOW_HEAD = `
#ifdef SCULPT_GLOW
uniform float sculptGlowLevel;
uniform float sculptGlow;
#endif
`
const GLOW_FRAGMENT = `
#ifdef SCULPT_GLOW
	totalEmissiveRadiance += diffuseColor.rgb * sculptGlow * sculptGlowLevel;
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
  /** a part that gives light (a lamp's glass): it glows its own colour (the vertex colours, as an instance's tints them)
   *  this many times over, at the level `setSculptGlow` sets for all of them (0 by day: only the colour shows) */
  glow?: number
  /** leaves (a tree's crown): the season turns them, tree by tree by a hash of where each stands — its model's place
   *  (`true`: a crown put where it stands, a crowd's by its instance), or the place each vertex carries in its
   *  `leafAt` attribute (`'placed'`: crowns made where they stand, in the world's coordinates: src/models/trees.ts,
   *  placeBigTree) — and snow caps them. (A `surface` takes the snow too: what is built.) */
  foliage?: boolean | 'placed'
}

/** The material for these options, one shared by every part that asks for the same (made once). */
export function sculptMaterial(o: SculptMaterialOptions = {}): MeshStandardMaterial {
  const d = o.detail
  const sf = o.surface
  const key = `${o.roughness ?? 0.8}|${o.doubleSided ? 2 : 1}|${o.metalness ?? 0}|${d ? `${d.scale},${d.bump},${d.shade}` : ''}|${o.leaf ? 1 : 0}|${sf ? `${sf.kind},${sf.size},${sf.joint ? sf.joint.join(',') : ''},${sf.tone ?? ''},${sf.bump ?? ''},${sf.turn ? 1 : 0}` : ''}${o.tint2 ? '|tint2' : ''}${o.glow ? `|glow${o.glow}` : ''}${o.foliage ? `|foliage${o.foliage}` : ''}`
  let m = cache.get(key)
  if (m) return m
  m = ownSculptMaterial(o)
  cache.set(key, m)
  return m
}

/** A material of its own for these options, shared with nothing (the same shader as the shared one): for the pieces
 *  of one big thing, each drawn in its own place in the drawing order (three draws materials in the order they were
 *  made: src/farm/landGeometry.ts). Whoever makes it disposes of it. */
export function ownSculptMaterial(o: SculptMaterialOptions = {}): MeshStandardMaterial {
  const d = o.detail
  const sf = o.surface
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0, side: o.doubleSided ? DoubleSide : FrontSide })
  const defines: Record<string, string> = {}
  if (d) defines.SCULPT_DETAIL = ''
  if (sf) defines.SCULPT_SURFACE = ''
  if (o.leaf) defines.SCULPT_LEAF = ''
  // (a define of its own: the shader's cache key is the same for every sculpt material but for its defines)
  if (o.tint2) defines.SCULPT_TINT2 = ''
  if (o.glow) defines.SCULPT_GLOW = ''
  // the season (above): on what is built and on leaves
  const season = !!(sf || o.foliage)
  if (season) defines.SCULPT_SEASON = ''
  if (o.foliage) defines.SEASON_FOLIAGE = defines.SEASON_LEAF = ''
  if (o.foliage === 'placed') defines.SEASON_LEAF_AT = ''
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
    if (o.glow) {
      shader.uniforms.sculptGlowLevel = glowLevel
      shader.uniforms.sculptGlow = { value: o.glow }
    }
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
      .replace('#include <common>', '#include <common>\nvarying vec3 vColor2;\nvarying float vPattern;\n' + NOISE + (o.glow ? GLOW_HEAD : ''))
      .replace('#include <color_fragment>', COLOR_FRAGMENT)
      // the joints are a little rougher than the stones and boards
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef SCULPT_SURFACE\nroughnessFactor = min( 1.0, roughnessFactor + sculptJointAmt * 0.12 );\n#endif')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BUMP_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (o.glow ? GLOW_FRAGMENT : ''))
      // a leaf's underside is lit like its upper side (three turned its normal round for the back face)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef SCULPT_LEAF\nnormal *= faceDirection;\n#endif')
    if (season) addSeason(shader)
  }
  m.customProgramCacheKey = () => 'sculpt-v5'
  return m
}
