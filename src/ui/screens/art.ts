// Generated artwork for content cards — the same picture in the panel (DOM canvas) and on the floating
// hologram cards (canvas texture). Deterministic: one `seed` always draws the same image. No three.js here,
// so the entry chunk can use it.

export function mulberry32(seed: number) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `#rrggbb` + alpha → css rgba() */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Draws one of four compositions (orbits, waves, skyline, rays) tinted with the accent colour. */
export function drawArt(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, accent: string) {
  const r = mulberry32(seed + 1)
  ctx.save()
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#0b1019')
  bg.addColorStop(1, '#141b29')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const gx = w * (0.2 + r() * 0.6)
  const gy = h * (0.15 + r() * 0.5)
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.7)
  glow.addColorStop(0, rgba(accent, 0.55))
  glow.addColorStop(0.45, rgba(accent, 0.12))
  glow.addColorStop(1, rgba(accent, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const kind = seed % 4
  ctx.lineCap = 'round'
  if (kind === 0) {
    // orbits: concentric circles around an off-centre point, with planets
    const cx = w * (0.55 + r() * 0.35)
    const cy = h * (0.3 + r() * 0.5)
    for (let i = 1; i <= 7; i++) {
      const rad = (Math.min(w, h) / 7) * i * 0.95
      ctx.strokeStyle = rgba(i % 3 === 0 ? '#ffffff' : accent, 0.5 - i * 0.05)
      ctx.lineWidth = Math.max(1, w / 400)
      ctx.beginPath()
      ctx.arc(cx, cy, rad, 0, Math.PI * 2)
      ctx.stroke()
      const a = r() * Math.PI * 2
      ctx.fillStyle = i % 2 ? accent : '#ffffff'
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, Math.max(2, w / 110) * (0.6 + r() * 0.8), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 1) {
    // waves: stacked translucent bands
    for (let i = 0; i < 7; i++) {
      const base = h * (0.35 + i * 0.1)
      const amp = h * (0.04 + r() * 0.08)
      const freq = 1 + r() * 2.5
      const phase = r() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += w / 48) ctx.lineTo(x, base + Math.sin((x / w) * Math.PI * freq + phase) * amp)
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fillStyle = rgba(accent, 0.07 + i * 0.035)
      ctx.fill()
      if (i === 2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'
        ctx.lineWidth = Math.max(1.5, w / 260)
        ctx.stroke()
      }
    }
  } else if (kind === 2) {
    // skyline: rounded columns on a baseline grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    for (let y = h * 0.2; y < h; y += h / 8) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    const n = 11
    const bw = (w / n) * 0.56
    for (let i = 0; i < n; i++) {
      const x = (w / n) * (i + 0.22)
      const bh = h * (0.18 + r() * 0.62)
      const g = ctx.createLinearGradient(0, h - bh, 0, h)
      g.addColorStop(0, rgba(accent, i % 4 === 1 ? 1 : 0.85))
      g.addColorStop(1, rgba(accent, 0.05))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(x, h - bh, bw, bh, bw / 2)
      ctx.fill()
    }
  } else {
    // rays: a fan of lines from a corner, crossed by one bright arc
    const ox = r() < 0.5 ? 0 : w
    const oy = h
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * (0.05 + (i / 26) * 0.9)
      ctx.strokeStyle = rgba(i % 5 === 0 ? '#ffffff' : accent, 0.12 + (i % 5 === 0 ? 0.3 : 0.12))
      ctx.lineWidth = Math.max(1, w / 500)
      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.lineTo(ox + Math.cos(a) * w * 1.5 * (ox ? -1 : 1), oy + Math.sin(a) * w * 1.5)
      ctx.stroke()
    }
    ctx.strokeStyle = rgba(accent, 0.95)
    ctx.lineWidth = Math.max(2, w / 150)
    ctx.beginPath()
    ctx.arc(ox, oy, Math.min(w, h) * (0.55 + r() * 0.3), 0, Math.PI * 2)
    ctx.stroke()
  }

  // soft vignette keeps whatever is printed on top legible
  const v = ctx.createLinearGradient(0, 0, 0, h)
  v.addColorStop(0, 'rgba(5,7,12,0)')
  v.addColorStop(1, 'rgba(5,7,12,0.55)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
