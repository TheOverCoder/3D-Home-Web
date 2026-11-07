import type { Texture } from 'three'
import { profile } from './profile'

// Downloaded textures (and the ones inside models) come at whatever size their author picked: a 2k map is
// 16 MB of graphics memory with its mip chain. Phones get them scaled down to the profile's limit once, on the
// CPU, before the first upload; computers keep them as they are.

const scaled = new WeakMap<object, HTMLCanvasElement>()

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas

function sizeOf(image: unknown): { w: number; h: number } | null {
  if (!image || typeof image !== 'object') return null
  const i = image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
  const w = i.naturalWidth || i.width || 0
  const h = i.naturalHeight || i.height || 0
  return w && h ? { w, h } : null
}

/** Scales the texture's image down to `max` texels per side (keeping its aspect), at most once per image. */
export function fitTexture(texture: Texture, max = profile.maxTexture) {
  const image = texture.image as unknown
  const size = sizeOf(image)
  if (!size || Math.max(size.w, size.h) <= max) return
  let canvas = scaled.get(image as object)
  if (!canvas) {
    const k = max / Math.max(size.w, size.h)
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(size.w * k))
    canvas.height = Math.max(1, Math.round(size.h * k))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    try {
      ctx.drawImage(image as Drawable, 0, 0, canvas.width, canvas.height)
    } catch {
      return // not drawable (compressed or data texture): leave it
    }
    scaled.set(image as object, canvas)
  }
  texture.image = canvas
  texture.needsUpdate = true
}

const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'clearcoatNormalMap', 'sheenColorMap'] as const

/** Every texture of a loaded model, scaled to the profile's limit. */
export function fitModelTextures(root: { traverse: (fn: (o: unknown) => void) => void }) {
  if (profile.maxTexture >= 4096) return
  root.traverse((o) => {
    const mesh = o as { isMesh?: boolean; material?: unknown }
    if (!mesh.isMesh || !mesh.material) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of materials as Record<string, unknown>[]) {
      for (const slot of SLOTS) {
        const t = m[slot] as Texture | undefined
        if (t && (t as { isTexture?: boolean }).isTexture) fitTexture(t)
      }
    }
  })
}
