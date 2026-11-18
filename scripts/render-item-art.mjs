// Draws the farm's item pictures from the models (src/models/itemArt.ts) and saves them as WebP files in
// src/assets/items, the wardrobe's garments in src/assets/garments, the farm shop's decoration and fruit plants in
// src/assets/decor and the animals' tools' skins in src/assets/skins, which src/farm/icons.ts serves. Run it with
// the dev server up (npm run dev):
//
//   node scripts/render-item-art.mjs [http://localhost:5173/] [--shot page.png]
//
// It opens the site with ?items in Playwright's Chromium (PW_CHROMIUM_PATH if set), waits for every picture and
// writes them; --shot also saves a screenshot of the page, to look at them side by side.
//
//   node scripts/render-item-art.mjs [http://localhost:5173/] --people [--shot page.png]
//
// draws only the people's portraits instead (src/ui/Portrait.tsx): each person of the table with a body
// (src/data/people.ts) from their own model, head and shoulders, in the items' studio light, saved in
// src/assets/people/<id>.webp. The dev server's own modules draw them in the page (the people engine, and three.js as
// the dev server hands it to them: one copy), so they are the faces the game draws.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const shotAt = args.indexOf('--shot')
const shot = shotAt >= 0 ? args.splice(shotAt, 2)[1] : null
const peopleAt = args.indexOf('--people')
const peopleOnly = peopleAt >= 0 && !!args.splice(peopleAt, 1).length
const base = args[0] ?? 'http://localhost:5173/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/items')
const clothes = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/garments')
const decor = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/decor')
const skins = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/skins')
const portraits = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/people')

/** How big a portrait is saved (px square: three times the round portrait's 56 px, and room for a bigger one). */
const PORTRAIT = 192

/** Each person of the table with a body, drawn in the page from the dev server's modules: head and shoulders, from a
 *  little to their right and above (as the goods are seen), on a clear ground; WebP data URLs by id. */
async function drawPortraits(page, size) {
  return page.evaluate(async (size) => {
    // three.js as the dev server hands it to the game's modules (its URL in one of theirs): the people engine's copy
    const served = await (await fetch('/src/models/itemArt.ts')).text()
    const from = (re, what) => {
      const m = served.match(re)
      if (!m) throw new Error(`the dev server's ${what} was not found in itemArt.ts`)
      return m[1]
    }
    const THREE = await import(from(/from\s*["']([^"']*\/three(?:\.js|\.module\.js)[^"']*)["']/, 'three.js'))
    const { RoomEnvironment } = await import(from(/from\s*["']([^"']*RoomEnvironment[^"']*)["']/, 'RoomEnvironment'))
    const { PERSON, PersonRig, personParts } = await import('/src/models/person.ts')
    const { PERSON_IDS, personById, personLook } = await import('/src/data/people.ts')
    // the items' studio (src/models/itemArt.ts): soft light from above, a warm key from the upper left, a cool rim
    const S = size * 3
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(S, S, false)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    const scene = new THREE.Scene()
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.45
    scene.add(new THREE.HemisphereLight(0xfff6e6, 0x8a6a4a, 1.0))
    const key = new THREE.DirectionalLight(0xfff1dc, 2.4)
    key.position.set(-1.2, 2.4, 1.6)
    const rim = new THREE.DirectionalLight(0xd6e6ff, 1.4)
    rim.position.set(1.5, 1.0, -1.8)
    scene.add(key, rim)
    const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 20)
    const out = {}
    for (const id of PERSON_IDS) {
      const look = personLook(id)
      if (!look) continue
      // standing, arms down, no basket (it would show at the edge), looking at you
      const parts = personParts(1)
      const rig = new PersonRig({ ...look, basket: false })
      parts.begin()
      rig.write(parts)
      parts.end()
      scene.add(parts.group)
      // the head's middle, and a frame from the shoulders to over a hat: 0.47 of their height, the head a little high in it
      const h = look.height ?? 1
      const middle = new THREE.Vector3(0, (PERSON.hipsY + PERSON.headY) * h - 0.075 * h, 0)
      const az = (-14 * Math.PI) / 180
      const el = (5 * Math.PI) / 180
      const dist = (0.235 * h) / Math.tan((camera.fov * Math.PI) / 360)
      camera.position.set(middle.x + Math.sin(az) * Math.cos(el) * dist, middle.y + Math.sin(el) * dist, middle.z + Math.cos(az) * Math.cos(el) * dist)
      camera.lookAt(middle)
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
      scene.remove(parts.group)
      parts.dispose()
      // (the page is the icon, an SVG document: an HTML canvas is asked for by its namespace)
      const small = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
      small.width = small.height = size
      const ctx = small.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(renderer.domElement, 0, 0, size, size)
      out[personById(id).pic.replace(/^people\//, '')] = small.toDataURL('image/webp', 0.88)
    }
    renderer.dispose()
    return out
  }, size)
}

/** The people's portraits, drawn in `page` and saved (and a sheet of them for --shot). */
async function savePortraits(page) {
  // a page of the dev server's own (its icon: nothing of the game starts), whose modules draw the portraits
  await page.goto(new URL('favicon.svg', base).href)
  const drawn = await drawPortraits(page, PORTRAIT)
  await mkdir(portraits, { recursive: true })
  for (const [id, url] of Object.entries(drawn)) {
    const [head, data] = url.split(',')
    if (!head.includes('image/webp')) throw new Error(`${id}: the browser did not make a WebP (${head})`)
    const bytes = Buffer.from(data, 'base64')
    await writeFile(join(portraits, `${id}.webp`), bytes)
    console.log(`people/${id}.webp  ${(bytes.length / 1024).toFixed(1)} KB`)
  }
  if (shot) {
    await page.goto('about:blank')
    const round = 'border-radius:50%;background:radial-gradient(circle at 50% 30%,#fff,#ead9bd 70%)'
    await page.setContent(
      `<body style="margin:0;padding:16px;background:#f3ead8;display:flex;flex-wrap:wrap;gap:16px">${Object.values(drawn)
        .map((u) => `<img src="${u}" width="${PORTRAIT}" height="${PORTRAIT}" style="${round}">`)
        .join('')}</body>`,
    )
    await page.waitForTimeout(300)
    await page.screenshot({ path: shot, fullPage: true })
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
if (peopleOnly) {
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1100 } })
    page.on('pageerror', (e) => console.error('[page]', e.message))
    await savePortraits(page)
  } finally {
    await browser.close()
  }
  process.exit(0)
}
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } })
  page.on('pageerror', (e) => console.error('[page]', e.message))
  await page.goto(new URL('?items', base).href)
  await page.waitForFunction(() => window.__itemArt, null, { timeout: 120_000 })
  const { items, garments, shop, skin } = await page.evaluate(() => ({ items: window.__itemArt, garments: window.__garmentArt, shop: window.__shopArt, skin: window.__skinArt }))
  for (const [dir, pictures] of [
    [out, items],
    [clothes, garments],
    [decor, shop],
    [skins, skin],
  ]) {
    await mkdir(dir, { recursive: true })
    let total = 0
    for (const [id, url] of Object.entries(pictures)) {
      const [head, data] = url.split(',')
      if (!head.includes('image/webp')) throw new Error(`${id}: the browser did not make a WebP (${head})`)
      const bytes = Buffer.from(data, 'base64')
      total += bytes.length
      await writeFile(join(dir, `${id}.webp`), bytes)
      if (dir === out) console.log(`${id}.webp  ${(bytes.length / 1024).toFixed(1)} KB`)
    }
    if (dir === clothes) console.log(`${Object.keys(pictures).length} garments, ${(total / 1024).toFixed(0)} KB`)
    if (dir === decor) console.log(`${Object.keys(pictures).length} kinds of the farm shop, ${(total / 1024).toFixed(0)} KB`)
    if (dir === skins) console.log(`${Object.keys(pictures).length} skins of the animals' tools, ${(total / 1024).toFixed(0)} KB`)
  }
  if (shot) {
    await page.waitForTimeout(300)
    await page.screenshot({ path: shot, fullPage: true })
  }
} finally {
  await browser.close()
}
