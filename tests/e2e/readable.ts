import type { Page } from '@playwright/test'

// What can be read and pressed on a phone (update-v1/missions/07-interface.md, F5; DECISIONS.md 17): measured in the
// page, on what is on the screen now, inside the elements named. Each problem found is a `Finding` of one check:
//   tiny      text under 13 px (nothing a player sees is smaller)
//   words     words under 15 px; a chip's or a count's (`.tag`, `.count`, a badge, a ribbon) may be 13 to 14 px
//   target    something to press whose real hit area (what `elementFromPoint` finds on a 44 px box round its middle,
//             48 px on a touch screen) is smaller
//   contrast  words on a solid surface under 4.5:1 (3:1 for large text: 24 px, or 18.7 px bold), opacity counted (a
//             disabled button's words are not held to it, as in WCAG; something only not open yet is)
//   outside   the panel not wholly inside the screen
//   goodpic   a good's picture outside a button that is not a GoodPic (it says where the good is made)
//   loops     animations that never end, at rest, where more than one runs (the top asks for one thing at a time)
// Used by 39-panels; 22-xp's top, 07-phone and the first session's hints can measure with it too.

export type Check = 'tiny' | 'words' | 'target' | 'contrast' | 'outside' | 'goodpic' | 'loops'
export const CHECKS: Check[] = ['tiny', 'words', 'target', 'contrast', 'outside', 'goodpic', 'loops']

export interface Finding {
  check: Check
  /** what it is, in a few words: the element's tag and classes, and its text */
  what: string
  /** what was measured (a size, a ratio, a box) */
  got: string
}

export interface Measure {
  /** the elements to look inside (every one on the screen) */
  roots: string[]
  /** what must stand wholly on the screen (a panel's sheet: every one there is) */
  inside?: string
  /** count the animations that never end inside the roots (at rest: at most one) */
  loops?: boolean
  /** the goods' ids (src/farm/data.ts, PRODUCE): an <img> of one of them is a good's picture */
  goods?: string[]
}

/** Measures what is on the screen now. */
export function readable(page: Page, m: Measure): Promise<Finding[]> {
  return page.evaluate((m) => {
    const out: { check: string; what: string; got: string }[] = []
    const onScreen = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s)).filter((e) => e.getClientRects().length > 0)
    const roots = m.roots.flatMap(onScreen)
    const name = (e: Element) => {
      const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
      const text = (e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28)
      return `${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`
    }
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      for (let a: Element | null = e; a; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05 || a.getAttribute('aria-hidden') === 'true') return false
      }
      return true
    }
    const all = [...new Set(roots.flatMap((r) => [r, ...Array.from(r.querySelectorAll<HTMLElement>('*'))]))]

    // ── colours: any CSS colour, read back through a canvas as sRGB (premultiplied: [r, g, b, a], 0..1) ──
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    ctx.canvas.width = ctx.canvas.height = 1
    const rgba = (c: string): number[] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      const k = a / 255
      return [(r / 255) * k, (g / 255) * k, (b / 255) * k, k]
    }
    const over = (top: number[], under: number[]) => top.map((v, i) => v + under[i] * (1 - top[3]))
    /** The colour the screen shows at `e` (its own background and every one behind it, each group's opacity), with
     *  `ink` painted last inside `e`: null where it is not one solid colour (a picture or a gradient, or the scene). */
    const flat = (e: Element, ink?: number[]) => {
      let acc = ink ?? [0, 0, 0, 0]
      for (let a: Element | null = e; a; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if (cs.backgroundImage !== 'none') return null
        acc = over(acc, rgba(cs.backgroundColor)).map((v) => v * Number(cs.opacity))
      }
      return acc[3] > 0.99 ? acc : null
    }
    const lum = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    // ── text: its size, and its contrast where it stands on one colour ──
    const CHIP = '.tag, .count, .chip, .ribbon, .lock-tag, .item-pic, [class*="badge"], [class*="count"]'
    for (const e of all) {
      const text = Array.from(e.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim()
      if (!text || !shown(e)) continue
      const cs = getComputedStyle(e)
      const px = parseFloat(cs.fontSize)
      const words = /\p{L}{3,}/u.test(text)
      if (px < 12.95) out.push({ check: 'tiny', what: name(e), got: `${px} px` })
      else if (words && px < 14.95 && !e.closest(CHIP)) out.push({ check: 'words', what: name(e), got: `${px} px` })
      // (a word drawn with a line or a shadow round it stands on that, not on the surface; a button that cannot be
      // pressed is not held to it, as WCAG holds none: neither is measured)
      if (!words || cs.textShadow !== 'none' || parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) > 0 || e.closest(':disabled')) continue
      const bg = flat(e)
      const fg = flat(e, rgba(cs.color))
      if (!bg || !fg) continue
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
      const ratio = (hi + 0.05) / (lo + 0.05)
      const large = px >= 23.95 || (px >= 18.6 && Number(cs.fontWeight) >= 700)
      if (ratio < (large ? 3 : 4.5)) out.push({ check: 'contrast', what: name(e), got: `${ratio.toFixed(2)}:1` })
    }

    // ── targets: what a finger finds on a box of 44 px (48 on a touch screen) round each one's middle ──
    const size = matchMedia('(pointer: coarse)').matches ? 48 : 44
    const TARGET =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="slider"], [role="checkbox"], [role="radio"], [role="menuitem"]'
    for (const e of all) {
      if (!e.matches(TARGET) || !shown(e) || getComputedStyle(e).pointerEvents === 'none') continue
      const r = e.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const hits = (px: number, py: number) => {
        if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) return true
        const at = document.elementFromPoint(px, py)
        return !!at && (at === e || e.contains(at))
      }
      // (one hidden under something else, or scrolled out of its list, is not a target now)
      if (!hits(x, y)) continue
      // inside its own box it is the target (what overlaps it is another matter); beyond it, only what grows its hit area
      // (padding, an ::after) answers for it
      const reach = (px: number, py: number) => (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) || hits(px, py)
      const d = size / 2 - 1
      if (![reach(x - d, y), reach(x + d, y), reach(x, y - d), reach(x, y + d)].every(Boolean)) out.push({ check: 'target', what: name(e), got: `${Math.round(r.width)}×${Math.round(r.height)}` })
    }

    // ── the panel on the screen ──
    for (const p of m.inside ? onScreen(m.inside) : []) {
      const r = p.getBoundingClientRect()
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
        out.push({ check: 'outside', what: name(p), got: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} of ${innerWidth}×${innerHeight}` })
    }

    // ── a good's picture says where it is made (GoodPic), unless it is inside a button ──
    if (m.goods?.length) {
      const good = new RegExp(`/(${m.goods.join('|')})(-[\\w-]{8})?\\.webp$`)
      for (const e of all)
        if (e instanceof HTMLImageElement && good.test(new URL(e.src, location.href).pathname) && shown(e) && !e.closest('button, .good-pic'))
          out.push({ check: 'goodpic', what: name(e.parentElement ?? e), got: e.src.split('/').pop()! })
    }

    // ── the loops that run at rest ──
    if (m.loops) {
      const loops = document.getAnimations().filter((a) => {
        const t = (a.effect as KeyframeEffect | null)?.target
        return a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity && !!t && roots.some((r) => r.contains(t))
      })
      // (each one a finding, so a third is seen where two were)
      if (loops.length > 1) for (const a of loops) out.push({ check: 'loops', what: (a as CSSAnimation).animationName ?? name((a.effect as KeyframeEffect).target!), got: `one of ${loops.length}` })
    }
    return out
  }, m) as Promise<Finding[]>
}

/** How many findings of each check. */
export const counts = (f: Finding[]) => Object.fromEntries(CHECKS.map((c) => [c, f.filter((x) => x.check === c).length])) as Record<Check, number>
