// Discovers real assets at build time. Drop files in and they are picked up; leave them
// out and the scene falls back to its built-in placeholders.
//
//   src/assets/models/house.glb        whole house (visual; also the collider unless house-collision.glb exists)
//   src/assets/models/house-collision.glb  optional low-poly stand-in used only for physics (never rendered)
//   src/assets/models/character.glb    rigged humanoid (e.g. Quaternius Universal Base Character)
//   src/assets/models/animations.glb   animation clips on the same rig (e.g. Quaternius Universal Animation Library)
//   src/assets/models/props/<id>.glb   optional replacement for a placeholder prop (sofa, desk, ...)
//   src/assets/hdri/home.jpg|.hdr|.exr  image-based lighting: a JPEG with a gain map is taken first (a fraction of the
//                                       size: scripts/hdr-to-gainmap.mjs makes one and keeps the .hdr in hdri/raw)
//   src/assets/textures/<surface>/*.jpg real PBR maps replacing a generated surface: wood, tile, carpet, plaster, fabric,
//                                       grass, veneer, leather, brushed, stone, paint. File names: *diff*|*color*|*albedo*,
//                                       *nor*, *rough* (Poly Haven / ambientCG names work as downloaded)

const urls = (glob: Record<string, string>) =>
  Object.fromEntries(Object.entries(glob).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]))

const modelFiles = urls(import.meta.glob<string>('./models/*.glb', { eager: true, query: '?url', import: 'default' }))
const propFiles = urls(import.meta.glob<string>('./models/props/*.glb', { eager: true, query: '?url', import: 'default' }))
// a JPEG with a gain map before an .hdr or .exr of the same name
const hdriFiles = {
  ...urls(import.meta.glob<string>('./hdri/*.{hdr,exr}', { eager: true, query: '?url', import: 'default' })),
  ...urls(import.meta.glob<string>('./hdri/*.jpg', { eager: true, query: '?url', import: 'default' })),
}

const textureFiles = import.meta.glob<string>('./textures/*/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' })

export interface TextureSet {
  map?: string
  normalMap?: string
  roughnessMap?: string
}

/** `textures/<surface>/` folders → URLs per slot. Colour wins over the generic names; `nor_dx` (DirectX normals) is skipped. */
export const textureSets: Record<string, TextureSet> = {}
for (const [path, url] of Object.entries(textureFiles)) {
  const [, , surfaceName, file] = path.split('/')
  const tokens = file.toLowerCase().replace(/\.[^.]+$/, '').split(/[_\-\s]+/) // asset ids may contain "arm", "metal"…: match whole tokens only
  const has = (...names: string[]) => names.some((n) => tokens.includes(n))
  const set = (textureSets[surfaceName] ??= {})
  if (has('dx', 'disp', 'displacement', 'bump', 'ao', 'arm', 'metal', 'metallic', 'spec')) continue
  if (has('rough', 'roughness')) set.roughnessMap = url
  else if (has('nor', 'normal')) set.normalMap = url
  else if (has('diff', 'diffuse', 'color', 'colour', 'albedo', 'base', 'basecolor')) set.map = url
}

const hdriNames = Object.keys(hdriFiles).sort()
const hdriExt = Object.fromEntries(Object.keys(import.meta.glob(['./hdri/*.{hdr,exr}', './hdri/*.jpg'])).map((p) => [p.split('/').pop()!.replace(/\.[^.]+$/, ''), p.split('.').pop()!]))

// an inlined (data:) HDRI has no file extension for the loader to read: label it the way drei expects
function tagHdr(name: string | undefined, url: string | undefined) {
  if (!url?.startsWith('data:') || !name) return url
  const ext = hdriExt[name]
  return `data:${ext === 'jpg' ? 'image/jpeg' : ext === 'exr' ? 'application/exr' : 'application/hdr'};base64,${url.slice(url.indexOf(',') + 1)}`
}
const hdriName = hdriFiles['home'] ? 'home' : hdriNames[0]

export const assets = {
  house: modelFiles['house'] as string | undefined,
  houseCollision: modelFiles['house-collision'] as string | undefined,
  character: modelFiles['character'] as string | undefined,
  animations: modelFiles['animations'] as string | undefined,
  props: propFiles as Record<string, string | undefined>,
  hdri: tagHdr(hdriName, hdriFiles[hdriName]),
}

export const assetStatus = {
  textures: Object.keys(textureSets).length,
  house: !!assets.house,
  character: !!assets.character,
  animations: !!assets.animations,
  hdri: !!assets.hdri,
  props: Object.keys(assets.props).length,
}

export const usingPlaceholders = !assetStatus.house || !assetStatus.character || !assetStatus.hdri
