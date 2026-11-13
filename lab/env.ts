import { DEVICES, type DeviceId } from './devices'

// A lab frame's settings, read from its address and applied before anything of the game loads (frame.tsx imports this
// first):
//   ?device=upright|sideways|small|tablet|desktop|real  the screen the frame stands for. Its safe areas are given to the
//        game's CSS in place of env(safe-area-inset-*) (a frame has none of its own) and its notch and home bar drawn
//        over it. `real` is a phone trying a design full screen: its own screen, its own fingers.
//   ?touch=0     a mouse, not a finger. Otherwise every device but the desktop is a touch screen: the game's
//        (pointer: coarse) rules and checks hold, and on a computer the pointer is a fingertip, 44 px across, so a
//        target too small for a finger shows.
//   ?touches=1   each touch marked on the screen while it lasts, as a phone's screen recording does.
//   ?speed=0.25  everything that moves, slower: CSS, Web Animations, Motion, timers.
//   ?motion=reduce  as someone who prefers less motion sees it (prefers-reduced-motion, in the CSS and in checks).
//   ?hold=1      nothing shown until window.__labGo() (scripts/lab-film.mjs films an opening from its first frame).

const q = new URLSearchParams(location.search)
const named = q.get('device') ?? 'upright'
const device: DeviceId | 'real' = named === 'real' || named in DEVICES ? (named as DeviceId | 'real') : 'upright'
const spec = device === 'real' ? null : DEVICES[device]

export const env = {
  device,
  touch: device !== 'real' && q.get('touch') !== '0' && (spec?.touch ?? true),
  touches: q.get('touches') === '1',
  speed: Math.min(4, Math.max(0.05, Number(q.get('speed')) || 1)),
  hold: q.get('hold') === '1',
  reduced: q.get('motion') === 'reduce',
}

const root = document.documentElement
root.dataset.labDevice = device

// --- slower time: every clock the page reads, and every animation the document runs
if (env.speed !== 1) {
  const k = env.speed
  const realNow = performance.now.bind(performance)
  const t0 = realNow()
  const now = () => t0 + (realNow() - t0) * k
  performance.now = now
  const realDate = Date.now
  const d0 = realDate()
  Date.now = () => d0 + (realDate() - d0) * k
  const realRaf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => realRaf(() => cb(now()))
  const realTimeout = window.setTimeout.bind(window)
  const realInterval = window.setInterval.bind(window)
  window.setTimeout = ((fn: TimerHandler, ms = 0, ...rest: unknown[]) => realTimeout(fn, ms / k, ...rest)) as typeof window.setTimeout
  window.setInterval = ((fn: TimerHandler, ms = 0, ...rest: unknown[]) => realInterval(fn, ms / k, ...rest)) as typeof window.setInterval
  const slow = () => {
    for (const a of document.getAnimations()) if (a.playbackRate !== k) a.playbackRate = k
    realRaf(slow)
  }
  realRaf(slow)
}

// --- the device's screen: its safe areas and its touch, in the game's CSS
const SAFE = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(,[^)]*)?\)/g
const toVars = (css: string) => css.replace(SAFE, (_, side: string, fallback?: string) => `var(--lab-safe-${side}${fallback ?? ', 0px'})`)
const COARSE = /\((any-)?pointer:\s*coarse\)|\((any-)?hover:\s*none\)/g
const FINE = /\((any-)?pointer:\s*fine\)|\((any-)?hover:\s*hover\)/g
const REDUCE = /\(prefers-reduced-motion(:\s*reduce)?\)/g
const NO_PREFERENCE = /\(prefers-reduced-motion:\s*no-preference\)/g
const YES = '(min-width: 0px)'
const NO = '(max-width: 0px)'
/** a media query as the frame's screen answers it: a finger, less motion */
const asScreen = (media: string) => {
  let m = media
  if (env.touch) m = m.replace(COARSE, YES).replace(FINE, NO)
  if (env.reduced) m = m.replace(REDUCE, YES).replace(NO_PREFERENCE, NO)
  return m
}

if (spec) for (const side of ['top', 'right', 'bottom', 'left'] as const) root.style.setProperty(`--lab-safe-${side}`, `${spec.safe[side]}px`)

// a computer's mouse, seen before the touch screen is put in its place
const realFine = window.matchMedia('(pointer: fine)').matches

if (env.touch || env.reduced) {
  const realMatch = window.matchMedia.bind(window)
  window.matchMedia = (media: string) => realMatch(asScreen(media))
}

function fixRules(rules: CSSRuleList) {
  for (const r of Array.from(rules)) {
    if ((env.touch || env.reduced) && r instanceof CSSMediaRule) {
      const was = r.media.mediaText
      const now = asScreen(was)
      if (now !== was) r.media.mediaText = now
    }
    if (spec && r instanceof CSSStyleRule && r.style.cssText.includes('env(')) r.style.cssText = toVars(r.style.cssText)
    const inner = (r as CSSGroupingRule).cssRules
    if (inner?.length) fixRules(inner)
  }
}
const fixed = new WeakSet<CSSStyleSheet>()
function fixSheets() {
  for (const s of Array.from(document.styleSheets)) {
    if (fixed.has(s)) continue
    try {
      fixRules(s.cssRules)
      fixed.add(s)
    } catch {
      // not loaded yet (a <link> fixes itself on load), or from another origin
    }
  }
}
function fixInline(el: Element) {
  const style = el.getAttribute('style')
  if (spec && style?.includes('env(')) el.setAttribute('style', toVars(style))
}

if (env.touch || env.reduced || spec) {
  fixSheets()
  new MutationObserver((changes) => {
    let sheets = false
    for (const c of changes) {
      if (c.type === 'attributes') fixInline(c.target as Element)
      for (const n of Array.from(c.addedNodes)) {
        if (n instanceof HTMLLinkElement) n.addEventListener('load', fixSheets)
        if (n instanceof HTMLStyleElement || n instanceof HTMLLinkElement || c.target instanceof HTMLStyleElement) sheets = true
        if (n instanceof Element) {
          fixInline(n)
          for (const e of Array.from(n.querySelectorAll('[style]'))) fixInline(e)
        }
      }
      if (c.type === 'characterData') sheets = true
    }
    if (sheets) fixSheets()
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] })
  for (const l of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) l.addEventListener('load', fixSheets)
  addEventListener('load', fixSheets)
}

// --- the device's notch and home bar, drawn over everything (they are not the design's)
if (spec && device !== 'desktop') {
  const chrome = document.createElement('div')
  chrome.className = `lab-chrome lab-chrome-${device}`
  chrome.setAttribute('aria-hidden', 'true')
  chrome.innerHTML = '<i class="lab-notch"></i><i class="lab-home"></i>'
  document.body.append(chrome)
}

// --- a fingertip for a pointer, and the marks of touches
const mouse = env.touch && realFine
if (mouse || env.touches) {
  const layer = document.createElement('div')
  layer.className = 'lab-touches'
  layer.setAttribute('aria-hidden', 'true')
  document.body.append(layer)
  const tip = mouse ? document.createElement('i') : null
  if (tip) {
    tip.className = 'lab-tip'
    layer.append(tip)
    root.classList.add('lab-finger')
  }
  const marks = new Map<number, HTMLElement>()
  const place = (el: HTMLElement, e: PointerEvent) => {
    el.style.left = `${e.clientX}px`
    el.style.top = `${e.clientY}px`
  }
  addEventListener(
    'pointermove',
    (e) => {
      if (tip) {
        place(tip, e)
        tip.classList.add('on')
      }
      const m = marks.get(e.pointerId)
      if (m) place(m, e)
    },
    { capture: true, passive: true },
  )
  addEventListener(
    'pointerdown',
    (e) => {
      if (tip) {
        place(tip, e)
        tip.classList.add('on', 'down')
      }
      if (!env.touches) return
      const m = document.createElement('i')
      m.className = 'lab-mark'
      m.dataset.born = String(performance.now())
      place(m, e)
      layer.append(m)
      marks.set(e.pointerId, m)
    },
    { capture: true, passive: true },
  )
  const lift = (e: PointerEvent) => {
    tip?.classList.remove('down')
    const m = marks.get(e.pointerId)
    if (!m) return
    marks.delete(e.pointerId)
    // a tap is seen for a moment at least, however quick the finger
    const left = Math.max(0, 140 - (performance.now() - Number(m.dataset.born)))
    window.setTimeout(() => m.classList.add('up'), left)
    window.setTimeout(() => m.remove(), left + 450)
  }
  addEventListener('pointerup', lift, { capture: true, passive: true })
  addEventListener('pointercancel', lift, { capture: true, passive: true })
  document.documentElement.addEventListener('mouseleave', () => tip?.classList.remove('on'))
}
