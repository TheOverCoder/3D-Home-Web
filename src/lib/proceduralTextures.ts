import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { FloorKind } from '../data/layout'

// Stand-in surface textures drawn on a canvas. Real PBR sets (e.g. Poly Haven) replace these later.

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!] as const
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number) {
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

function drawWood(ctx: CanvasRenderingContext2D, size: number) {
  const planks = 6
  const h = size / planks
  for (let i = 0; i < planks; i++) {
    const tone = 150 + Math.random() * 60
    ctx.fillStyle = `rgb(${tone},${tone * 0.8},${tone * 0.6})`
    ctx.fillRect(0, i * h, size, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, i * h, size, h)
    ctx.strokeStyle = 'rgba(60,35,15,0.12)'
    ctx.lineWidth = 1
    for (let g = 0; g < 14; g++) {
      const y = i * h + Math.random() * h
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(size * 0.3, y + 4, size * 0.7, y - 4, size, y)
      ctx.stroke()
    }
    const cut = Math.random() * size
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.moveTo(cut, i * h)
    ctx.lineTo(cut, (i + 1) * h)
    ctx.stroke()
  }
}

function drawTile(ctx: CanvasRenderingContext2D, size: number) {
  const n = 4
  const s = size / n
  ctx.fillStyle = '#9a9d9b'
  ctx.fillRect(0, 0, size, size)
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const t = 225 + Math.random() * 20
      ctx.fillStyle = `rgb(${t},${t},${t - 2})`
      ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6)
    }
  }
}

function drawCarpet(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = 'rgb(190,190,190)'
  ctx.fillRect(0, 0, size, size)
}

const cache = new Map<FloorKind, CanvasTexture>()

export function floorTexture(kind: FloorKind, repeatX: number, repeatY: number) {
  const key = kind
  let tex = cache.get(key)
  if (!tex) {
    const size = 512
    const [c, ctx] = canvas(size)
    if (kind === 'wood') drawWood(ctx, size)
    else if (kind === 'tile') drawTile(ctx, size)
    else drawCarpet(ctx, size)
    noise(ctx, size, kind === 'carpet' ? 46 : 16)
    tex = new CanvasTexture(c)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    cache.set(key, tex)
  }
  const out = tex.clone()
  out.needsUpdate = true
  out.repeat.set(repeatX, repeatY)
  return out
}
