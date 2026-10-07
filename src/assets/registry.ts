// Discovers real assets at build time. Drop files in and they are picked up; leave them
// out and the scene falls back to its built-in placeholders.
//
//   src/assets/models/house.glb        whole house (visual; also the collider unless house-collision.glb exists)
//   src/assets/models/house-collision.glb  optional low-poly stand-in used only for physics (never rendered)
//   src/assets/models/character.glb    rigged humanoid (e.g. Quaternius Universal Base Character)
//   src/assets/models/animations.glb   animation clips on the same rig (e.g. Quaternius Universal Animation Library)
//   src/assets/models/props/<id>.glb   optional replacement for a placeholder prop (sofa, desk, ...)
//   src/assets/hdri/home.hdr|.exr      image-based lighting (any single .hdr/.exr works)

const urls = (glob: Record<string, string>) =>
  Object.fromEntries(Object.entries(glob).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]))

const modelFiles = urls(import.meta.glob<string>('./models/*.glb', { eager: true, query: '?url', import: 'default' }))
const propFiles = urls(import.meta.glob<string>('./models/props/*.glb', { eager: true, query: '?url', import: 'default' }))
const hdriFiles = urls(import.meta.glob<string>('./hdri/*.{hdr,exr}', { eager: true, query: '?url', import: 'default' }))

const hdriNames = Object.keys(hdriFiles).sort()

export const assets = {
  house: modelFiles['house'] as string | undefined,
  houseCollision: modelFiles['house-collision'] as string | undefined,
  character: modelFiles['character'] as string | undefined,
  animations: modelFiles['animations'] as string | undefined,
  props: propFiles as Record<string, string | undefined>,
  hdri: (hdriFiles['home'] ?? hdriFiles[hdriNames[0]]) as string | undefined,
}

export const assetStatus = {
  house: !!assets.house,
  character: !!assets.character,
  animations: !!assets.animations,
  hdri: !!assets.hdri,
  props: Object.keys(assets.props).length,
}

export const usingPlaceholders = !assetStatus.house || !assetStatus.character || !assetStatus.hdri
