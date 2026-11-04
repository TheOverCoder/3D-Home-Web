// The in-world wall screens, drawn with the 2D canvas API into a 1024×576 texture.
// Two cached layers (background, content) are painted once; a frame only composites them and paints
// the few moving parts (clock, bar fill, shimmer, call-to-action pulse), so the active screen stays cheap.
import type { ScreenDef } from '../../data/screens'
import { rgba } from '../../ui/screens/art'
import { FONT_FAMILY } from './fonts'

export const SCREEN_W = 1024
export const SCREEN_H = 576
const M = 64 // outer margin
const PANEL = { x: 604, y: 124, w: 356, h: 344 }
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT_FAMILY}`
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function layer() {
  const canvas = document.createElement('canvas')
  canvas.width = SCREEN_W
  canvas.height = SCREEN_H
  return { canvas, ctx: canvas.getContext('2d')! }
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing is widely supported now; older engines simply ignore it
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else line = next
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1]
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) last = last.slice(0, -1)
    lines[maxLines - 1] = last.replace(/[\s,.;:–—-]+$/, '') + '…'
  }
  return lines
}

function paintBackground(ctx: CanvasRenderingContext2D, def: ScreenDef) {
  const bg = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
  bg.addColorStop(0, '#0b111c')
  bg.addColorStop(1, '#05070c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  const glow = ctx.createRadialGradient(SCREEN_W * 0.9, -40, 0, SCREEN_W * 0.9, -40, 640)
  glow.addColorStop(0, rgba(def.accent, 0.34))
  glow.addColorStop(0.5, rgba(def.accent, 0.08))
  glow.addColorStop(1, rgba(def.accent, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  const low = ctx.createRadialGradient(80, SCREEN_H + 60, 0, 80, SCREEN_H + 60, 520)
  low.addColorStop(0, rgba(def.accent, 0.1))
  low.addColorStop(1, rgba(def.accent, 0))
  ctx.fillStyle = low
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  // fine dot grid, like a display's sub-structure
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  for (let y = 20; y < SCREEN_H; y += 28) for (let x = 20; x < SCREEN_W; x += 28) ctx.fillRect(x, y, 2, 2)

  // glass panel for the data
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 22)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(M, 100, SCREEN_W - M * 2, 2)
}

function paintContent(ctx: CanvasRenderingContext2D, def: ScreenDef) {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H)
  ctx.textBaseline = 'alphabetic'

  // header: room name
  ctx.fillStyle = def.accent
  ctx.beginPath()
  ctx.arc(M + 6, 64, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#aab5c8'
  ctx.font = font(600, 21)
  spaced(ctx, 5)
  ctx.fillText(def.subtitle.toUpperCase(), M + 26, 72)
  spaced(ctx, 0)

  // title + tagline
  ctx.fillStyle = '#ffffff'
  ctx.font = font(700, 108)
  spaced(ctx, -3)
  ctx.fillText(def.title, M - 6, 226)
  spaced(ctx, 0)
  ctx.fillStyle = '#b9c2d0'
  ctx.font = font(400, 27)
  wrap(ctx, def.tagline, 500, 3).forEach((l, i) => ctx.fillText(l, M, 278 + i * 36))

  // three headline stats
  const stats = def.stats.slice(0, 3)
  const col = 170
  stats.forEach((s, i) => {
    const x = M + i * col
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(x - 18, 392, 2, 78)
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = font(700, 54)
    spaced(ctx, -1)
    ctx.fillText(s.value, x, 440)
    spaced(ctx, 0)
    ctx.fillStyle = '#8f9aae'
    ctx.font = font(500, 17)
    wrap(ctx, s.label, col - 24, 2).forEach((l, j) => ctx.fillText(l, x, 468 + j * 21))
  })

  // panel heading + bar labels (the bars themselves are painted per frame)
  ctx.fillStyle = '#8f9aae'
  ctx.font = font(600, 15)
  spaced(ctx, 3.5)
  ctx.fillText('AT A GLANCE', PANEL.x + 28, PANEL.y + 44)
  spaced(ctx, 0)
  rows(def).forEach(({ y, bar }) => {
    ctx.fillStyle = '#e3e8f0'
    ctx.font = font(500, 21)
    ctx.fillText(bar.label, PANEL.x + 28, y)
    ctx.fillStyle = def.accent
    ctx.font = font(600, 21)
    const pct = `${Math.round(bar.value * 100)}%`
    ctx.fillText(pct, PANEL.x + PANEL.w - 28 - ctx.measureText(pct).width, y)
  })

  // footer: the sections waiting inside
  ctx.font = font(500, 18)
  let x = M
  for (const t of def.tabs) {
    const w = ctx.measureText(t.label).width + 32
    if (x + w > 650) break
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x, 504, w, 38, 19)
    ctx.stroke()
    ctx.fillStyle = '#c9d1de'
    ctx.fillText(t.label, x + 16, 529)
    x += w + 10
  }
}

function rows(def: ScreenDef) {
  const bars = def.bars.slice(0, 5)
  const top = PANEL.y + 96
  const step = Math.min(64, (PANEL.h - 120) / Math.max(1, bars.length))
  return bars.map((bar, i) => ({ bar, y: top + i * step }))
}

export interface WallScreen {
  canvas: HTMLCanvasElement
  /** Repaints the cached layers (after fonts load). */
  invalidate: () => void
  /** Paints a frame. `boot` 0→1 plays the power-on reveal; `active` shows the live parts. */
  draw: (t: number, boot: number, active: boolean) => void
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

export function createWallScreen(def: ScreenDef): WallScreen {
  const out = layer()
  const bg = layer()
  const content = layer()
  let painted = false
  const paint = () => {
    paintBackground(bg.ctx, def)
    paintContent(content.ctx, def)
    painted = true
  }

  const draw = (t: number, boot: number, active: boolean) => {
    if (!painted) paint()
    const ctx = out.ctx
    ctx.globalAlpha = 1
    ctx.drawImage(bg.canvas, 0, 0)
    const e = ease(boot / 0.9)
    ctx.globalAlpha = e
    ctx.drawImage(content.canvas, 0, 14 * (1 - e))
    ctx.globalAlpha = 1

    // live clock (top right) — only on the active screen, so idle screens never need repainting
    if (active) {
      const now = new Date()
      const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      ctx.font = font(600, 22)
      ctx.fillStyle = '#e6ebf3'
      const cw = ctx.measureText(clock).width
      ctx.fillText(clock, SCREEN_W - M - cw, 72)
      ctx.fillStyle = rgba(def.accent, 0.55 + 0.45 * Math.sin(t * 3))
      ctx.beginPath()
      ctx.arc(SCREEN_W - M - cw - 18, 64, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // bars grow in after the content, then a slow shimmer runs across them
    const grow = ease((boot - 0.25) / 1.1)
    const tx = PANEL.x + 28
    const tw = PANEL.w - 56
    rows(def).forEach(({ y, bar }, i) => {
      const by = y + 14
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.roundRect(tx, by, tw, 8, 4)
      ctx.fill()
      const w = Math.max(8, tw * bar.value * ease(grow * 1.15 - i * 0.08))
      const g = ctx.createLinearGradient(tx, 0, tx + w, 0)
      g.addColorStop(0, rgba(def.accent, 0.45))
      g.addColorStop(1, def.accent)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(tx, by, w, 8, 4)
      ctx.fill()
    })
    if (active && boot > 1.4) {
      const p = ((t * 0.28) % 1.6) - 0.3 // sweep, then a pause
      if (p > 0 && p < 1) {
        const sx = PANEL.x + PANEL.w * p
        const s = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0)
        s.addColorStop(0, 'rgba(255,255,255,0)')
        s.addColorStop(0.5, 'rgba(255,255,255,0.07)')
        s.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = s
        ctx.beginPath()
        ctx.roundRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 22)
        ctx.fill()
      }
    }

    // call to action (bottom right)
    const label = active ? (coarse ? 'Tap the prompt to open' : 'Press E to open') : 'Walk up to explore'
    ctx.font = font(600, 19)
    const lw = ctx.measureText(label).width
    const pw = lw + (active && !coarse ? 76 : 44)
    const px = SCREEN_W - M - pw
    const py = 502
    if (active) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6)
      ctx.fillStyle = rgba(def.accent, 0.1 + 0.14 * pulse)
      ctx.beginPath()
      ctx.roundRect(px - 8, py - 8, pw + 16, 58, 29)
      ctx.fill()
      ctx.fillStyle = def.accent
      ctx.beginPath()
      ctx.roundRect(px, py, pw, 42, 21)
      ctx.fill()
      let x = px + 22
      if (!coarse) {
        ctx.fillStyle = 'rgba(8,10,16,0.85)'
        ctx.beginPath()
        ctx.roundRect(x - 6, py + 8, 30, 26, 6)
        ctx.fill()
        ctx.fillStyle = def.accent
        ctx.font = font(700, 16)
        ctx.fillText('E', x + 3.5, py + 27)
        x += 36
      }
      ctx.fillStyle = '#0a0d14'
      ctx.font = font(600, 19)
      ctx.fillText(label, x, py + 28)
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(px, py, pw, 42, 21)
      ctx.stroke()
      ctx.fillStyle = '#9aa5b8'
      ctx.fillText(label, px + 22, py + 28)
    }
  }

  return { canvas: out.canvas, invalidate: () => (painted = false), draw }
}
