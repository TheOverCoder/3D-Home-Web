// Fetches interface pictures from Microsoft's Fluent Emoji 3D (MIT, credited in src/data/credits.ts) into src/assets/art
// as the 128 px WebP the game serves (src/ui/art.ts): each named by its Fluent folder, saved under its kebab-case id.
// The PNG is drawn into a canvas in Playwright's Chromium (PW_CHROMIUM_PATH if set) and encoded there: no page of the
// game, no image library. Run it with the network up:
//
//   node scripts/fetch-art.mjs "Cherry blossom" "Snowflake" …
//
// Then add each id to `ArtId` in src/ui/art.ts and a row to src/data/credits.ts.

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const FLUENT = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'
const SIZE = 128
const QUALITY = 0.9

const names = process.argv.slice(2)
if (!names.length) {
  console.error('Name the Fluent folders to fetch, e.g. "Snowflake".')
  process.exit(2)
}

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
try {
  const page = await browser.newPage()
  for (const name of names) {
    const file = `${name.toLowerCase().replace(/ /g, '_')}_3d.png`
    const url = `${FLUENT}/${encodeURIComponent(name)}/3D/${file}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${name}: ${res.status} at ${url}`)
    const png = Buffer.from(await res.arrayBuffer()).toString('base64')
    const webp = await page.evaluate(
      async ({ png, size, quality }) => {
        const img = new Image()
        img.src = `data:image/png;base64,${png}`
        await img.decode()
        const c = Object.assign(document.createElement('canvas'), { width: size, height: size })
        const g = c.getContext('2d')
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, 0, 0, size, size)
        return c.toDataURL('image/webp', quality)
      },
      { png, size: SIZE, quality: QUALITY },
    )
    if (!webp.startsWith('data:image/webp')) throw new Error(`${name}: the browser did not make a WebP`)
    const id = name.toLowerCase().replace(/ /g, '-')
    writeFileSync(new URL(`../src/assets/art/${id}.webp`, import.meta.url), Buffer.from(webp.split(',')[1], 'base64'))
    console.log(`${id}.webp`)
  }
} finally {
  await browser.close()
}
