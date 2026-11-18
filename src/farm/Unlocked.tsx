import { m, useAnimate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { farmSound } from '../audio/sound'
import { haptic } from '../lib/device'
import { art } from '../ui/art'
import { burst } from '../ui/burst'
import { registerCard } from '../ui/cardQueue'
import { DID, EASE, SPRING } from '../ui/motion'
import { unlockPic, whereOf } from './unlockArt'
import { unlockName, type UnlockId } from './unlocks'
import './Unlocked.css'

// "Unlocked!" — what a level opened (src/farm/unlocks.ts), after the level's show and its garment (./XpChip.tsx
// LevelUp): the lab's board "unlocks", C, made bigger at the user's word. A warm light comes up over the scene with a
// slow turning burst of rays, the berry ribbon "Unlocked!" unfurls under the level's star, and one card for each thing
// flies out of the level's star on the dashboard, turning from its back (the star on berry) to its face — its picture,
// its name and where it is found (Seeds, Mill, Shop, Decor) — landing a beat after the one before in a ring of light,
// each a note higher; confetti once the last is down. They hold a moment, bobbing, a shine running over each, then fly
// in an arc back into the star, which pops as each lands: the level's card keeps what comes next. A tap anywhere
// gathers them at once (a second tap ends it). Less motion: the cards are simply there, then fade.

/** A card's moments, in seconds: the light and the ribbon before the first card, between two cards, a card's flight
 *  and turn, all of them face up, and their flight home (a tap: quicker). */
const INTRO = 0.55
const GAP = 0.34
const LAND = 0.8
const HOLD = 2.8
const HOME = 0.85
const QUICK = 0.45

/** How many cards a row holds: upright, three at most (four: two and two); sideways, six. */
export const colsUpright = (n: number) => (n <= 3 ? n : Math.ceil(n / 2))
export const colsSideways = (n: number) => Math.min(n, 6)

/** A thing's face: its picture, its name and where it is found once open. */
export function UnlockFace({ id }: { id: UnlockId }) {
  return (
    <span className="unlock-face">
      <img className="art" src={unlockPic(id)} alt="" draggable={false} />
      <b>{unlockName(id)}</b>
      <small>{whereOf(id)}</small>
    </span>
  )
}

/** The cards a level will open, face up and a little fanned (the level card's "At level N"). */
export function UnlockRow({ ids }: { ids: UnlockId[] }) {
  const n = ids.length
  return (
    <span className="unlock-row" style={{ '--cols-up': Math.min(n, 4), '--cols-side': n } as CSSProperties} aria-label={`Opens: ${ids.map(unlockName).join(', ')}`}>
      {ids.map((id, k) => (
        <span key={id} className="unlock-card small" style={{ rotate: `${(k - (n - 1) / 2) * 3}deg` }} aria-hidden="true">
          <UnlockFace id={id} />
        </span>
      ))}
    </span>
  )
}

/** The middle of the level's star on the dashboard (where the cards come from and go back to); with no dashboard in
 *  view, the top of the screen. */
function starPoint() {
  const el = document.querySelector('.top-road .xp-star')
  if (el && el.getClientRects().length) {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, el }
  }
  return { x: innerWidth / 2, y: -40, el: null }
}

/** The card standing in a slot (beside the ring of light it lands in). */
const cardIn = (slot: Element) => slot.querySelector<HTMLElement>('.unlock-card')!

const middle = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** What one level opened, as the level's show asks for it once the show and its garment are over (./XpChip.tsx,
 *  LevelUp): one of the cards that open by themselves (src/ui/cardQueue.ts), so it comes when the queue opens it — one
 *  at a time, after the welcome back and the day's gift, a beat after the game is free — and only within the visit's
 *  budget. Past it the reveal is let go (`onDone` at once): what the level opened shows as itself, open, where it is
 *  found, and the level card goes on to the next. `onDone` once the cards are home, tapped away or let go. */
export function Unlocked(props: { level: number; opens: UnlockId[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const done = useRef(props.onDone)
  useEffect(() => {
    done.current = props.onDone
  })
  // (shown once: then it shows until it is done, and is due no more)
  const shown = useRef(false)
  useEffect(
    () =>
      registerCard('unlocked', {
        due: () => !shown.current,
        open: () => {
          shown.current = true
          setOpen(true)
        },
        showing: () => shown.current,
        pass: () => done.current(),
      }),
    [],
  )
  return open ? <UnlockedShow {...props} /> : null
}

/** The reveal of what one level opened; `onDone` once the cards are home (or it was tapped away). */
function UnlockedShow({ level, opens, onDone }: { level: number; opens: UnlockId[]; onDone: () => void }) {
  const still = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const n = opens.length
  const stage = useRef<'deal' | 'home' | 'gone'>('deal')
  const timers = useRef<number[]>([])
  const running = useRef<AnimationPlaybackControls[]>([])
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  const later = (f: () => void, s: number) => timers.current.push(window.setTimeout(f, s * 1000))
  const run = (c: AnimationPlaybackControls) => running.current.push(c)

  const finish = () => {
    if (stage.current === 'gone') return
    stage.current = 'gone'
    done.current()
  }

  /** The cards fly home into the star (quick: tapped); tapped again on the way, it ends. */
  const home = (quick: boolean) => {
    if (stage.current !== 'deal') return finish()
    stage.current = 'home'
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    running.current.forEach((c) => c.stop())
    running.current = []
    const root = scope.current
    if (!root) return finish()
    const t = quick ? QUICK : HOME
    for (const sel of ['.unlocked-title', '.unlocked-light', '.unlocked-rays']) {
      const el = root.querySelector(sel)
      if (el) void animate(el, { opacity: 0 }, { duration: t * 0.8 })
    }
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.unlocked-slot'))
    if (still) {
      for (const slot of cards) void animate(cardIn(slot), { opacity: 0 }, { duration: 0.25 })
      later(finish, 0.3)
      return
    }
    const star = starPoint()
    cards.forEach((slot, k) => {
      const card = cardIn(slot)
      const at = middle(slot)
      const dx = star.x - at.x
      const dy = star.y - at.y
      const shown = Number(getComputedStyle(card).opacity) > 0.05
      if (!shown) return void animate(card, { opacity: 0 }, { duration: 0.1 })
      // an arc: out and up a little first, then into the star, smaller and smaller
      const delay = k * (quick ? 0.03 : 0.07)
      void animate(
        card,
        { x: [null, dx * 0.12, dx], y: [null, dy * 0.12 - 36, dy], scale: [null, 1.08, 0.12], rotate: [null, -8, 0] },
        { duration: t, delay, ease: [0.5, 0, 0.75, 1], times: [0, 0.3, 1] },
      )
      void animate(card, { opacity: [1, 1, 0.3] }, { duration: t, delay, times: [0, 0.8, 1] })
      if (star.el) later(() => void animate(star.el!, DID.keyframes, DID.options), delay + t * 0.95)
    })
    later(() => farmSound('surprise'), t * 0.9)
    later(finish, t + cards.length * (quick ? 0.03 : 0.07) + 0.05)
  }

  // the deal: the light and the ribbon, then each card out of the star, turning, landing in a ring of light
  useLayoutEffect(() => {
    const root = scope.current
    if (!root) return
    farmSound('garment')
    haptic('gift')
    const slots = Array.from(root.querySelectorAll<HTMLElement>('.unlocked-slot'))
    if (still) {
      for (const slot of slots) run(animate(cardIn(slot), { opacity: [0, 1] }, { duration: 0.3 }))
      later(() => home(false), INTRO + n * GAP + HOLD)
      return
    }
    const star = starPoint()
    slots.forEach((slot, k) => {
      const card = cardIn(slot)
      const ring = slot.querySelector('.unlocked-ring')
      const at = middle(slot)
      const tilt = (k - (n - 1) / 2) * 3
      const delay = INTRO + k * GAP
      run(animate(card, { x: [star.x - at.x, 0], y: [star.y - at.y, 0], scale: [0.15, 1], rotateY: [180, 0], rotate: [-30, tilt] }, { delay, type: 'spring', duration: LAND, bounce: 0.32 }))
      run(animate(card, { opacity: [0, 1] }, { delay, duration: 0.12 }))
      if (ring) run(animate(ring, { opacity: [0, 0.9, 0], scale: [0.5, 1.15, 1.7] }, { delay: delay + LAND * 0.55, duration: 0.6, ease: EASE.out }))
      later(() => farmSound('xp'), delay + LAND * 0.55)
    })
    const last = INTRO + (n - 1) * GAP + LAND * 0.6
    later(() => {
      const row = root.querySelector('.unlocked-row')
      if (row) burst(row, { count: 90, spread: 100, power: 38 })
      haptic('level')
    }, last)
    later(() => home(false), INTRO + (n - 1) * GAP + LAND + HOLD)
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
    // (once, as it opens: the cards are dealt from where they first stand)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const words = `Unlocked at level ${level}: ${opens.map(unlockName).join(', ')}`
  return createPortal(
    <div ref={scope} className="unlocked" role="status" aria-label={words} onPointerDown={() => home(true)}>
      <m.span className="unlocked-light" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }} />
      <div className="unlocked-stage">
        <span className="unlocked-rays" aria-hidden="true" />
        <m.div className="unlocked-title" initial={{ opacity: 0, scaleX: 0.15, y: -10 }} animate={{ opacity: 1, scaleX: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.08 }} aria-hidden="true">
          <span className="unlocked-star">
            <img src={art('glowing-star')} alt="" />
            <b>{level}</b>
          </span>
          <span className="unlocked-word">Unlocked!</span>
        </m.div>
        <div className="unlocked-row" style={{ '--cols-up': colsUpright(n), '--cols-side': colsSideways(n) } as CSSProperties} aria-hidden="true">
          {opens.map((id) => (
            <span key={id} className="unlocked-slot">
              <span className="unlocked-ring" />
              <span className="unlock-card" style={{ opacity: 0 }}>
                <span className="unlock-bob">
                  <span className="unlock-back">
                    <img src={art('glowing-star')} alt="" />
                  </span>
                  <UnlockFace id={id} />
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
