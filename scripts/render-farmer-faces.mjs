// Draws the farmer's faces, one for each of his moods (src/farm/firstSteps.ts, Mood), and saves them as WebP files in
// src/assets/art (farmer-<mood>.webp), which src/ui/art.ts serves to his portrait in the first steps' hint
// (src/farm/FarmerFace.tsx). Each is Fluent Emoji 3D's farmer (MIT, credited in src/data/credits.ts) with one of its
// smileys for his face, the way Fluent's own cowboy-hat face is drawn: his body, collar and pitchfork, the smiley over
// where his head was, then his hat's front over the smiley's brow. Run it with the network up (it fetches the Fluent
// pictures from GitHub):
//
//   node scripts/render-farmer-faces.mjs
//
// It composes them in Playwright's Chromium (PW_CHROMIUM_PATH if set): a canvas, no page of the game.
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const out = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/art')
const FLUENT = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'

/** Each mood's face: the Fluent smiley that says it (the folder's name in Fluent's repository). */
const FACES = {
  cheerful: 'Grinning face with big eyes',
  proud: 'Beaming face with smiling eyes',
  excited: 'Star-struck',
  curious: 'Thinking face',
  encouraging: 'Smiling face with smiling eyes',
  surprised: 'Face with open mouth',
  laughing: 'Grinning squinting face',
  winking: 'Winking face',
  pleading: 'Pleading face',
  sighing: 'Face exhaling',
}

/** Where the smiley goes on the farmer (his picture is 256 px; every smiley is a 224 px ball in the middle of its own
 *  256): its middle and size, a little bigger than his head so it covers his ears; and the square kept round him (his
 *  hat, his face, his collar), drawn at `size` px — the hint shows it 56 px across, three times that on a sharp phone. */
const PLACE = { cx: 127, cy: 100, d: 104 }
const CROP = { x: 50, y: 14, w: 154 }
const SIZE = 160
const QUALITY = 0.82

async function fetchPng(path) {
  const url = `${FLUENT}/${path.split('/').map(encodeURIComponent).join('/')}`
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url)
    if (r.ok) return `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
    // GitHub's raw files answer a quick run of requests with 429 now and then: wait and ask again
    if (attempt >= 4 || r.status !== 429) throw new Error(`${path}: ${r.status}`)
    await new Promise((ok) => setTimeout(ok, 3000 * attempt))
  }
}

const slug = (name) => name.toLowerCase().replaceAll(' ', '_')
const farmer = await fetchPng('Farmer/Default/3D/farmer_3d_default.png')
const faces = {}
for (const [mood, name] of Object.entries(FACES)) faces[mood] = await fetchPng(`${name}/3D/${slug(name)}_3d.png`)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage()
  const made = await page.evaluate(
    async ({ farmer, faces, place, crop, size, quality }) => {
      const load = (src) =>
        new Promise((ok, no) => {
          const i = new Image()
          i.onload = () => ok(i)
          i.onerror = () => no(new Error('a picture did not load'))
          i.src = src
        })
      const N = 256
      const canvas = (w = N, h = N) => Object.assign(document.createElement('canvas'), { width: w, height: h })
      const ramp = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)))

      const body = await load(farmer)
      const src = canvas()
      const sx = src.getContext('2d', { willReadFrequently: true })
      sx.drawImage(body, 0, 0)
      const px = sx.getImageData(0, 0, N, N).data

      // his skin, round his head: orange-yellow, saturated and bright (the hat is a dull dark brown, the collar green,
      // the fork lilac), soft at its edges so the cut follows them
      const skin = new Float32Array(N * N)
      for (let y = 41; y < 162; y++)
        for (let x = 67; x < 188; x++) {
          const i = y * N + x
          const r = px[i * 4] / 255
          const g = px[i * 4 + 1] / 255
          const b = px[i * 4 + 2] / 255
          const max = Math.max(r, g, b)
          const d = max - Math.min(r, g, b)
          let h = 0
          if (d > 1e-6) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
          h = (h * 60 + 360) % 360
          const s = max > 0 ? d / max : 0
          skin[i] = ramp(h, 18, 26) * (1 - ramp(h, 52, 60)) * ramp(s, 0.5, 0.66) * ramp(max, 0.55, 0.7)
        }
      // his eyes, brows and mouth are holes in the skin: whatever the outside cannot reach without crossing skin
      const reached = new Uint8Array(N * N)
      const todo = [0]
      reached[0] = 1
      while (todo.length) {
        const i = todo.pop()
        const x = i % N
        const y = (i - x) / N
        for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1])
          if (j >= 0 && !reached[j] && skin[j] <= 0.45) {
            reached[j] = 1
            todo.push(j)
          }
      }
      for (let i = 0; i < N * N; i++) if (!reached[i] && skin[i] <= 0.45) skin[i] = 1

      // the layers: his body with his head cut out; brown hair behind the smiley where his ears were (the smiley is
      // round, his head was not); his hat's front (above his brow) and the fork, over the smiley
      const layer = (keep) => {
        const data = new Uint8ClampedArray(px)
        for (let i = 0; i < N * N; i++) data[i * 4 + 3] = Math.round(data[i * 4 + 3] * (1 - skin[i]) * keep(i % N, (i - (i % N)) / N))
        const c = canvas()
        c.getContext('2d').putImageData(new ImageData(data, N, N), 0, 0)
        return c
      }
      const cut = layer(() => 1)
      const front = layer((x, y) => (y < 64 || (x > 176 && y > 80) ? 1 : 0))
      const hair = canvas()
      const hx = hair.getContext('2d', { willReadFrequently: true })
      hx.fillStyle = '#7a5034'
      hx.beginPath()
      hx.ellipse(place.cx, 85, 50, 33, 0, 0, Math.PI * 2)
      hx.fill()
      const hd = hx.getImageData(0, 0, N, N)
      for (let i = 0; i < N * N; i++) hd.data[i * 4 + 3] = Math.round(hd.data[i * 4 + 3] * skin[i])
      hx.putImageData(hd, 0, 0)

      const made = {}
      const k = place.d / 224
      for (const [mood, face] of Object.entries(faces)) {
        const smiley = await load(face)
        const c = canvas(size, size)
        const o = c.getContext('2d')
        o.imageSmoothingQuality = 'high'
        const s = size / crop.w
        o.setTransform(s, 0, 0, s, -crop.x * s, -crop.y * s)
        o.drawImage(cut, 0, 0)
        o.drawImage(hair, 0, 0)
        o.drawImage(smiley, place.cx - 128 * k, place.cy - 128 * k, 256 * k, 256 * k)
        o.drawImage(front, 0, 0)
        made[mood] = c.toDataURL('image/webp', quality)
      }
      return made
    },
    { farmer, faces, place: PLACE, crop: CROP, size: SIZE, quality: QUALITY },
  )
  let total = 0
  for (const [mood, url] of Object.entries(made)) {
    const [head, data] = url.split(',')
    if (!head.includes('image/webp')) throw new Error(`${mood}: the browser did not make a WebP (${head})`)
    const bytes = Buffer.from(data, 'base64')
    total += bytes.length
    await writeFile(join(out, `farmer-${mood}.webp`), bytes)
    console.log(`farmer-${mood}.webp  ${(bytes.length / 1024).toFixed(1)} KB`)
  }
  console.log(`${Object.keys(made).length} faces, ${(total / 1024).toFixed(0)} KB`)
} finally {
  await browser.close()
}
