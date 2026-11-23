import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// @ts-expect-error a plain .mjs script, its two functions used as they are
import { convertLine, toRem } from '../scripts/px-to-rem.mjs'

// The interface's lengths are rem (src/styles.css: one root size, `--ui`, scales them all — Settings → Picture →
// Interface size). A px length outside the screen's own conditions (@media, @container) would not scale with it:
// this names each one, by file and line (scripts/px-to-rem.mjs turns them into rem, exactly).

const src = fileURLToPath(new URL('.', import.meta.url))
const css = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? css(p) : name.endsWith('.css') ? [p] : []
  })

describe("the interface's lengths", () => {
  it('are rem everywhere but the screen’s own conditions and the root size', () => {
    const found: string[] = []
    for (const file of css(src))
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (convertLine(line) !== line) found.push(`${file.slice(src.length)}:${i + 1}: ${line.trim().slice(0, 100)}`)
        })
    expect(found, 'px that would not scale with the interface size: `node scripts/px-to-rem.mjs <file>`').toEqual([])
  })

  it('turns px into the same length in rem, at 16 px a rem', () => {
    expect(toRem(16)).toBe('1rem')
    expect(toRem(13.5)).toBe('0.84375rem')
    expect(toRem(0)).toBe('0rem')
    expect(convertLine('@media (max-width: 600px) { .b { padding: 8px; } }')).toBe('@media (max-width: 600px) { .b { padding: 0.5rem; } }')
    expect(convertLine('  font: 600 15px/1.35 var(--font-text);')).toBe('  font: 600 0.9375rem/1.35 var(--font-text);')
  })
})
