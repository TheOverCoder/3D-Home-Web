import './reward.css'

// A number popping up where something was paid (update-v1/missions/05-world-feel.md, change 2): "+120" with a coin over
// the buyer, the till, the manager or the contractor, sized and held by the reward's tier (src/fx/reward.ts, SHOW), gone
// in about 700 ms. Only for the eye (aria-hidden): the toast keeps the words. On the page (the Web Animations API, only
// transform and opacity), never in the 3D scene; the caller asks only with motion on.

/** Up it pops (ms), and from it fades as it rises on (ms): the tier's hold is between. */
const RISE = 220
const FADE = 380
/** How far it rises (CSS px) before it holds, and on as it fades. */
const UP = 34
const ON = 16

/** Pops `text` (with `pic` before it) up from the screen point (x, y), `scale` times the small tier's size, held
 *  `holdMs` at the top; whether it was shown. */
export function popNumber(x: number, y: number, text: string, o: { scale?: number; holdMs?: number; pic?: string } = {}): boolean {
  if (typeof document === 'undefined' || typeof document.body.animate !== 'function') return false
  const scale = o.scale ?? 1
  const hold = o.holdMs ?? 60
  const el = document.createElement('div')
  el.className = 'pop-num'
  el.setAttribute('aria-hidden', 'true')
  if (o.pic) {
    const img = document.createElement('img')
    img.src = o.pic
    img.alt = ''
    img.draggable = false
    el.appendChild(img)
  }
  el.appendChild(document.createTextNode(text))
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  document.body.appendChild(el)
  const total = RISE + hold + FADE
  const at = (ms: number) => ms / total
  const move = (up: number, s: number) => `translate(-50%, -50%) translateY(${-up}px) scale(${s})`
  const run = el.animate(
    [
      { transform: move(0, 0.5 * scale), opacity: 0 },
      { transform: move(UP + 4, 1.12 * scale), opacity: 1, offset: at(RISE * 0.65) },
      { transform: move(UP, scale), opacity: 1, offset: at(RISE) },
      { transform: move(UP + 2, scale), opacity: 1, offset: at(RISE + hold) },
      { transform: move(UP + ON, 0.96 * scale), opacity: 0 },
    ],
    { duration: total, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'both' },
  )
  const done = () => el.remove()
  run.onfinish = done
  run.oncancel = done
  return true
}
