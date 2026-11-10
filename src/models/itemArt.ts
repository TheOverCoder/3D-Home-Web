import { Box3, DirectionalLight, HemisphereLight, NeutralToneMapping, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { ProduceId } from '../farm/data'
import { GOODS } from './goods'
import { structureParts } from './structures'

// The pictures of the farm's goods, drawn from their models (src/models/goods.ts) in one still studio: soft light
// from above, a warm key from the upper left, a cool rim from behind, a room's reflections on the glossy ones, a
// view from the front left and a little above. Each is cropped to fill its square (the interface puts the same
// soft shadow under it as under every picture: .art in styles.css). `scripts/render-item-art.mjs` draws them all
// (open the site with ?items to see them) and saves them as WebP files in src/assets/items, which
// src/farm/icons.ts serves.

interface Item {
  /** where it is seen from: degrees round from the front (negative: from the left) and up */
  az?: number
  el?: number
}

/** How each good is seen (from the front left and a little above, unless said here). */
const VIEWS: Partial<Record<ProduceId, Item>> = {
  lettuce: { el: 30 },
  tomato: { el: 22 },
  wheat: { el: 10 },
  sugarcane: { el: 18 },
  milk: { el: 16 },
  sugar: { el: 34 },
  flour: { el: 22 },
  cloth: { el: 30 },
  lemon_cake: { el: 30 },
  strawberry_cake: { el: 30 },
  carrot_cake: { el: 30 },
  pumpkin_pie: { el: 44 },
}

export const ITEM_IDS = Object.keys(GOODS) as ProduceId[]

let studio: { renderer: WebGLRenderer; scene: Scene; camera: PerspectiveCamera } | null = null

function getStudio(px: number) {
  if (!studio) {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = SRGBColorSpace
    // the neutral curve keeps the colours as painted (a strawberry stays strawberry red, a lemon lemon yellow)
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1
    const scene = new Scene()
    scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.45
    scene.add(new HemisphereLight(0xfff6e6, 0x8a6a4a, 1.0))
    const key = new DirectionalLight(0xfff1dc, 2.4)
    key.position.set(-1.2, 2.4, 1.6)
    const rim = new DirectionalLight(0xd6e6ff, 1.4)
    rim.position.set(1.5, 1.0, -1.8)
    scene.add(key, rim)
    studio = { renderer, scene, camera: new PerspectiveCamera(24, 1, 0.01, 50) }
  }
  studio.renderer.setSize(px, px, false)
  return studio
}

/** One good's picture, `size` pixels square, as a WebP data URL: drawn at three times the size, cropped to the
 *  thing itself and scaled down into the square with a little room round it. */
export function renderItemArt(id: ProduceId, size = 256): string {
  const S = size * 3
  const { renderer, scene, camera } = getStudio(S)
  const def = VIEWS[id] ?? {}
  const item = structureParts(GOODS[id](), `item-${id}`)
  scene.add(item.group)
  item.group.updateMatrixWorld(true)
  const box = new Box3().setFromObject(item.group)
  const centre = box.getCenter(new Vector3())
  const radius = box.getSize(new Vector3()).length() / 2
  const az = ((def.az ?? -30) * Math.PI) / 180
  const el = ((def.el ?? 24) * Math.PI) / 180
  const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.05
  camera.position.copy(centre).addScaledVector(dir, dist)
  camera.near = dist / 20
  camera.far = dist * 4
  camera.updateProjectionMatrix()
  camera.lookAt(centre)
  renderer.render(scene, camera)
  scene.remove(item.group)
  item.dispose()

  // the thing's own bounds in the picture
  const full = document.createElement('canvas')
  full.width = full.height = S
  const f = full.getContext('2d', { willReadFrequently: true })!
  f.drawImage(renderer.domElement, 0, 0)
  const { data } = f.getImageData(0, 0, S, S)
  let x0 = S
  let y0 = S
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (data[(y * S + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  const out = document.createElement('canvas')
  out.width = out.height = size
  if (x1 < 0) return out.toDataURL('image/webp', 0.86)
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const ctx = out.getContext('2d')!
  const k = (size * 0.9) / Math.max(w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(full, x0, y0, w, h, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k)
  return out.toDataURL('image/webp', 0.86)
}
