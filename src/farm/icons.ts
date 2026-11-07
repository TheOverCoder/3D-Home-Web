import type { ProduceId } from './data'

// Little painted icons for the produce and for coins, drawn on canvases: the same picture in the 3D speech
// bubbles and in the panels, on every device (no reliance on an emoji font).

type Ctx = CanvasRenderingContext2D

function blob(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, shade = 'rgba(0,0,0,0.18)') {
  c.save()
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  c.fillStyle = fill
  c.fill()
  // a soft shadow on the lower right and a highlight on the upper left give it volume
  const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, rx * 0.1, x, y, Math.max(rx, ry) * 1.1)
  g.addColorStop(0, 'rgba(255,255,255,0.45)')
  g.addColorStop(0.45, 'rgba(255,255,255,0)')
  g.addColorStop(1, shade)
  c.fillStyle = g
  c.fill()
  c.restore()
}

function leaves(c: Ctx, x: number, y: number, s: number, color = '#4f8a3a', n = 5) {
  c.save()
  c.fillStyle = color
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55
    c.beginPath()
    c.ellipse(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35, s * 0.42, s * 0.13, a, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

/** Draws `id` centred on (x, y), about `s` pixels across. */
export function drawProduce(c: Ctx, id: ProduceId | 'coin', x: number, y: number, s: number) {
  const r = s / 2
  switch (id) {
    case 'tomato':
      blob(c, x, y + r * 0.08, r * 0.82, r * 0.72, '#d8342a')
      leaves(c, x, y - r * 0.6, r * 0.55, '#3f7a2c', 5)
      break
    case 'carrot': {
      c.save()
      c.translate(x, y)
      c.rotate(-0.55)
      c.beginPath()
      c.moveTo(-r * 0.32, -r * 0.45)
      c.quadraticCurveTo(0, -r * 0.62, r * 0.32, -r * 0.45)
      c.lineTo(0, r * 0.95)
      c.closePath()
      c.fillStyle = '#e8792a'
      c.fill()
      c.strokeStyle = 'rgba(120,50,10,0.35)'
      c.lineWidth = Math.max(1, s * 0.03)
      for (let i = 0; i < 3; i++) {
        c.beginPath()
        c.moveTo(-r * 0.2 + i * r * 0.04, -r * 0.1 + i * r * 0.28)
        c.lineTo(r * 0.12 - i * r * 0.02, -r * 0.08 + i * r * 0.28)
        c.stroke()
      }
      c.restore()
      leaves(c, x - r * 0.3, y - r * 0.55, r * 0.6, '#4f9a3a', 4)
      break
    }
    case 'lettuce':
      blob(c, x, y + r * 0.1, r * 0.85, r * 0.75, '#7cb84a')
      c.save()
      c.strokeStyle = 'rgba(40,90,30,0.45)'
      c.lineWidth = Math.max(1, s * 0.04)
      for (const k of [0.35, 0.6]) {
        c.beginPath()
        c.ellipse(x, y + r * 0.1, r * 0.85 * k, r * 0.75 * k, 0, Math.PI * 0.9, Math.PI * 2.1)
        c.stroke()
      }
      c.restore()
      blob(c, x, y + r * 0.05, r * 0.3, r * 0.26, '#b6dc7a', 'rgba(0,0,0,0.05)')
      break
    case 'strawberry': {
      c.save()
      c.beginPath()
      c.moveTo(x - r * 0.75, y - r * 0.35)
      c.quadraticCurveTo(x, y - r * 0.6, x + r * 0.75, y - r * 0.35)
      c.quadraticCurveTo(x + r * 0.55, y + r * 0.55, x, y + r * 0.9)
      c.quadraticCurveTo(x - r * 0.55, y + r * 0.55, x - r * 0.75, y - r * 0.35)
      c.fillStyle = '#d8213a'
      c.fill()
      c.fillStyle = '#f6d36b'
      for (let i = 0; i < 9; i++) {
        const px = x + (((i * 37) % 7) / 7 - 0.5) * r * 0.9
        const py = y + (((i * 53) % 5) / 5 - 0.2) * r * 0.9
        c.beginPath()
        c.ellipse(px, py, s * 0.022, s * 0.032, 0, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
      leaves(c, x, y - r * 0.45, r * 0.5, '#3f8a2c', 5)
      break
    }
    case 'corn':
      leaves(c, x, y + r * 0.3, r * 0.9, '#7fae3e', 3)
      blob(c, x, y, r * 0.42, r * 0.85, '#f0cf4a')
      c.save()
      c.fillStyle = 'rgba(160,110,20,0.35)'
      for (let row = -3; row <= 3; row++)
        for (let col = -1; col <= 1; col++) {
          c.beginPath()
          c.arc(x + col * r * 0.22, y + row * r * 0.2, s * 0.03, 0, Math.PI * 2)
          c.fill()
        }
      c.restore()
      break
    case 'pumpkin':
      blob(c, x - r * 0.35, y + r * 0.12, r * 0.45, r * 0.62, '#d9681a')
      blob(c, x + r * 0.35, y + r * 0.12, r * 0.45, r * 0.62, '#d9681a')
      blob(c, x, y + r * 0.12, r * 0.5, r * 0.68, '#ea7d24')
      c.fillStyle = '#5c6b2a'
      c.fillRect(x - r * 0.08, y - r * 0.72, r * 0.16, r * 0.3)
      break
    case 'lemon':
      blob(c, x, y, r * 0.85, r * 0.62, '#f2d43a')
      c.fillStyle = '#e8c52a'
      c.beginPath()
      c.ellipse(x + r * 0.85, y, r * 0.12, r * 0.09, 0, 0, Math.PI * 2)
      c.ellipse(x - r * 0.85, y, r * 0.12, r * 0.09, 0, 0, Math.PI * 2)
      c.fill()
      leaves(c, x - r * 0.1, y - r * 0.55, r * 0.45, '#3f7a2c', 2)
      break
    case 'egg':
      blob(c, x, y + r * 0.05, r * 0.62, r * 0.82, '#f1e3cc', 'rgba(90,60,30,0.22)')
      break
    case 'wheat': {
      c.save()
      c.strokeStyle = '#c9a44a'
      c.lineWidth = Math.max(1, s * 0.045)
      for (let i = -2; i <= 2; i++) {
        c.beginPath()
        c.moveTo(x + i * r * 0.08, y + r * 0.95)
        c.quadraticCurveTo(x + i * r * 0.12, y, x + i * r * 0.28, y - r * 0.35)
        c.stroke()
        c.fillStyle = '#e2bd5a'
        for (let g = 0; g < 4; g++) {
          c.beginPath()
          c.ellipse(x + i * r * 0.28 + i * g * r * 0.02, y - r * 0.38 - g * r * 0.13, s * 0.035, s * 0.06, i * 0.25, 0, Math.PI * 2)
          c.fill()
        }
      }
      c.fillStyle = '#a77d36'
      c.fillRect(x - r * 0.3, y + r * 0.25, r * 0.6, r * 0.14)
      c.restore()
      break
    }
    case 'sugarcane':
      c.save()
      for (const [dx, h, col] of [
        [-0.3, 1.0, '#8fb04a'],
        [0, 1.15, '#b7a24c'],
        [0.3, 0.95, '#9fae46'],
      ] as [number, number, string][]) {
        c.fillStyle = col
        c.fillRect(x + dx * r - s * 0.045, y + r * 0.95 - r * 1.8 * h, s * 0.09, r * 1.8 * h)
        c.fillStyle = 'rgba(60,70,20,0.45)'
        for (let k = 1; k < 4; k++) c.fillRect(x + dx * r - s * 0.05, y + r * 0.95 - r * 0.45 * k * h, s * 0.1, s * 0.02)
      }
      leaves(c, x, y - r * 0.8, r * 0.7, '#5f9035', 4)
      c.restore()
      break
    case 'milk':
      c.save()
      c.fillStyle = '#f4f6f8'
      c.beginPath()
      c.moveTo(x - r * 0.18, y - r * 0.85)
      c.lineTo(x + r * 0.18, y - r * 0.85)
      c.lineTo(x + r * 0.2, y - r * 0.55)
      c.quadraticCurveTo(x + r * 0.5, y - r * 0.35, x + r * 0.48, y)
      c.lineTo(x + r * 0.48, y + r * 0.85)
      c.lineTo(x - r * 0.48, y + r * 0.85)
      c.lineTo(x - r * 0.48, y)
      c.quadraticCurveTo(x - r * 0.5, y - r * 0.35, x - r * 0.2, y - r * 0.55)
      c.closePath()
      c.fill()
      c.strokeStyle = 'rgba(80,100,120,0.35)'
      c.lineWidth = Math.max(1, s * 0.03)
      c.stroke()
      c.fillStyle = '#3f7fbf'
      c.fillRect(x - r * 0.48, y + r * 0.05, r * 0.96, r * 0.35)
      c.fillStyle = '#c94f3d'
      c.fillRect(x - r * 0.2, y - r * 0.95, r * 0.4, r * 0.14)
      c.restore()
      break
    case 'wool': {
      // a fleece: a cloud of soft cream curls
      const puffs: [number, number, number][] = [
        [-0.42, 0.12, 0.42],
        [0.42, 0.12, 0.42],
        [-0.2, -0.22, 0.44],
        [0.22, -0.24, 0.42],
        [0, 0.22, 0.5],
        [-0.55, -0.12, 0.3],
        [0.56, -0.1, 0.3],
      ]
      for (const [dx, dy, k] of puffs) blob(c, x + dx * r, y + dy * r, r * k, r * k * 0.92, '#f4eedf', 'rgba(120,100,70,0.3)')
      c.save()
      c.strokeStyle = 'rgba(150,130,100,0.45)'
      c.lineWidth = Math.max(1, s * 0.025)
      for (const [dx, dy] of [
        [-0.3, 0.1],
        [0.15, -0.15],
        [0.3, 0.25],
        [-0.05, 0.35],
      ]) {
        c.beginPath()
        c.arc(x + dx * r, y + dy * r, r * 0.12, 0.3, Math.PI * 1.6)
        c.stroke()
      }
      c.restore()
      break
    }
    case 'cloth': {
      // a roll of woven cloth, a length of it unrolled in front
      c.save()
      const w = r * 1.5
      c.fillStyle = '#5b7fb8'
      c.fillRect(x - w / 2, y - r * 0.15, w, r * 0.95)
      c.fillStyle = 'rgba(255,255,255,0.35)'
      for (let k = 0; k < 4; k++) c.fillRect(x - w / 2, y - r * 0.05 + k * r * 0.22, w, r * 0.06)
      c.fillStyle = 'rgba(230,180,70,0.8)'
      for (let k = 0; k < 5; k++) c.fillRect(x - w / 2 + (k + 0.4) * (w / 5), y - r * 0.15, r * 0.05, r * 0.95)
      c.restore()
      blob(c, x, y - r * 0.38, w / 2 + r * 0.02, r * 0.36, '#4a6ea6', 'rgba(10,20,40,0.35)')
      c.save()
      c.fillStyle = '#3a5786'
      c.beginPath()
      c.ellipse(x + w / 2, y - r * 0.38, r * 0.12, r * 0.36, 0, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = 'rgba(255,255,255,0.4)'
      c.lineWidth = Math.max(1, s * 0.02)
      c.beginPath()
      c.ellipse(x + w / 2, y - r * 0.38, r * 0.06, r * 0.2, 0, 0, Math.PI * 2)
      c.stroke()
      c.restore()
      break
    }
    case 'sugar':
    case 'flour': {
      const sack = id === 'sugar' ? '#f2efe6' : '#e2d2b0'
      blob(c, x, y + r * 0.15, r * 0.7, r * 0.75, sack, 'rgba(90,70,40,0.25)')
      c.save()
      c.fillStyle = '#b89a6a'
      c.fillRect(x - r * 0.22, y - r * 0.72, r * 0.44, r * 0.18)
      c.fillStyle = id === 'sugar' ? '#3f7fbf' : '#a77d36'
      c.font = `800 ${Math.round(s * 0.26)}px Inter, system-ui, sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(id === 'sugar' ? 'S' : 'F', x, y + r * 0.2)
      c.restore()
      break
    }
    case 'lemon_cake':
    case 'strawberry_cake':
    case 'carrot_cake':
    case 'pumpkin_pie': {
      const top = { lemon_cake: '#f6e7a1', strawberry_cake: '#f4c6cf', carrot_cake: '#f3ede0', pumpkin_pie: '#d9782a' }[id]
      const dots = { lemon_cake: '#f2d43a', strawberry_cake: '#d8213a', carrot_cake: '#e8792a', pumpkin_pie: '#f3e6cf' }[id]
      const pie = id === 'pumpkin_pie'
      c.save()
      c.fillStyle = '#f4f1ea'
      c.beginPath()
      c.ellipse(x, y + r * 0.62, r * 0.95, r * 0.25, 0, 0, Math.PI * 2)
      c.fill()
      const h = pie ? r * 0.28 : r * 0.62
      c.fillStyle = '#d9a35e'
      c.fillRect(x - r * 0.75, y + r * 0.5 - h, r * 1.5, h)
      c.beginPath()
      c.ellipse(x, y + r * 0.5, r * 0.75, r * 0.2, 0, 0, Math.PI)
      c.fill()
      c.fillStyle = top
      c.beginPath()
      c.ellipse(x, y + r * 0.5 - h, r * 0.75, r * 0.22, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = dots
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        c.beginPath()
        c.arc(x + Math.cos(a) * r * 0.45, y + r * 0.5 - h + Math.sin(a) * r * 0.12, s * 0.045, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
      break
    }
    case 'coin':
      blob(c, x, y, r * 0.88, r * 0.88, '#e9b93c', 'rgba(110,70,0,0.35)')
      c.save()
      c.strokeStyle = 'rgba(140,90,10,0.55)'
      c.lineWidth = Math.max(1, s * 0.06)
      c.beginPath()
      c.arc(x, y, r * 0.6, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = 'rgba(140,90,10,0.6)'
      c.font = `700 ${Math.round(s * 0.5)}px Inter, system-ui, sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('¢', x, y + s * 0.02)
      c.restore()
      break
  }
}

const urls = new Map<string, string>()

/** The icon as an image URL for the HTML panels (painted once, then cached). */
export function iconUrl(id: ProduceId | 'coin', px = 64): string {
  const key = `${id}@${px}`
  let url = urls.get(key)
  if (!url) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = px
    drawProduce(canvas.getContext('2d')!, id, px / 2, px / 2, px * 0.86)
    url = canvas.toDataURL()
    urls.set(key, url)
  }
  return url
}
