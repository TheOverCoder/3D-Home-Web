// The design lab's build (dist-lab, from `vite build --config vite.lab.config.ts`) made ready to publish as a link of
// its own: its page as the link's main page takes it — without the document's own <html>, <head> and <body>, which the
// link's host puts round it — and the list of its other files (frame.html, scripts, styles, fonts, pictures).
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '../dist-lab')
const page = await readFile(join(dist, 'index.html'), 'utf8')
const head = page.match(/<head>([\s\S]*)<\/head>/)?.[1] ?? ''
const body = page.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? ''
const keep = head
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !/<meta (charset|name="viewport")/.test(l))
await writeFile(join(dist, 'index.html'), [...keep, body.trim()].join('\n') + '\n')

const files = []
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p)
    else if (e.name !== 'index.html' && e.name !== 'files.json') files.push(relative(dist, p))
  }
}
await walk(dist)
await writeFile(
  join(dist, 'files.json'),
  JSON.stringify(
    files.sort((a, b) => a.localeCompare(b)),
    null,
    1,
  ),
)
console.log(`dist-lab: index.html and ${files.length} files`)
