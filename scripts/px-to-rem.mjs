// The interface's lengths in rem, not px, so one root size scales it all (Settings → Picture → Interface size:
// src/ui/uiSize.ts sets `--ui`, src/styles.css's `html { font-size }` is 16 px × it). Turns every px length of the CSS
// files given (or every one under src/) into the same length in rem at 16 px a rem — exact, as n / 16 always ends — so
// at the default size not a pixel changes. The conditions of @media and @container keep their px (they measure the
// screen, which no setting scales), and so does the one rule the scale is made of. src/styles.units.test.ts keeps it so.
//
//   node scripts/px-to-rem.mjs [file.css …]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Every .css file under a directory. */
function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? cssFiles(p) : name.endsWith('.css') ? [p] : []
  })
}

/** A length of n px in rem: n / 16, with no trailing zeros ("0rem" for none: a bare 0 is no length inside a calc()). */
export function toRem(px) {
  const rem = px / 16
  if (rem === 0) return '0rem'
  return `${Number(rem.toFixed(6))}rem`
}

const LENGTH = /(?<![\w.#-])(-?(?:\d+\.?\d*|\.\d+))px\b/g

/** A line with its px lengths in rem: an @media or @container line keeps the px of its condition (up to its first "{"),
 *  and the root size's own rule keeps its 16 px. */
export function convertLine(line) {
  if (/^\s*html\s*\{[^}]*font-size/.test(line)) return line
  const at = line.match(/^(\s*@(?:media|container)\b[^{]*)(\{?.*)$/)
  if (at) return at[1] + at[2].replace(LENGTH, (_, n) => toRem(parseFloat(n)))
  return line.replace(LENGTH, (_, n) => toRem(parseFloat(n)))
}

/** A whole stylesheet converted (a multi-line @media prelude has no px in this game's CSS; its lines go as any). */
export const convert = (css) => css.split('\n').map(convertLine).join('\n')

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : cssFiles(join(ROOT, 'src'))
  let changed = 0
  for (const f of files) {
    const before = readFileSync(f, 'utf8')
    const after = convert(before)
    if (after !== before) {
      writeFileSync(f, after)
      changed++
    }
  }
  console.log(`${changed} of ${files.length} stylesheets in rem`)
}
