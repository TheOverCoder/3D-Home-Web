import confetti from 'canvas-confetti'

// A burst of confetti in the game's colours (canvas-confetti): for a moment worth celebrating — a level reached, a goal
// done — once per screen, never for every press. From a point on the screen or from the middle of an element. Nothing
// for whoever prefers less motion.

const TOKENS = ['--sun', '--xp', '--leaf', '--berry', '--paper']

export function burst(at: Element | { x: number; y: number }, o: { count?: number; spread?: number; power?: number; up?: boolean } = {}) {
  if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const p = at instanceof Element ? middle(at) : at
  const css = getComputedStyle(document.documentElement)
  const colors = TOKENS.map((t) => css.getPropertyValue(t).trim()).filter(Boolean)
  void confetti({
    origin: { x: p.x / innerWidth, y: p.y / innerHeight },
    particleCount: o.count ?? 60,
    spread: o.spread ?? 70,
    startVelocity: o.power ?? 32,
    angle: o.up === false ? 270 : 90,
    gravity: 1.1,
    ticks: 150,
    scalar: 0.9,
    colors,
    zIndex: 1000,
    disableForReducedMotion: true,
  })
}

function middle(el: Element) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
