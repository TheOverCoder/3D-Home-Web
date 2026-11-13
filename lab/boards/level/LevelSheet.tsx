import { AnimatePresence, animate, m, useMotionValue, useTransform, type PanInfo, type Variants } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Check } from '../../../src/ui/glyphs'
import { CountUp, PRESS, SPRING } from '../../../src/ui/motion'
import { art } from '../../../src/ui/art'
import { Coins } from '../../../src/ui/Shell'
import './LevelSheet.css'

// What the three new looks of the level's card (A, B, C) share: the sheet and how it moves — in on the sheet's spring
// from the bottom (upright) or the right (sideways), its blocks after it one by one, out the same way, and a swipe of
// a finger down (sideways: to the right) to close it — and the Claim row, which sinks under the finger and turns into
// what was claimed. Each look puts its own blocks in it, under a class of its own (.v-level-a …).

const SIDEWAYS = '(orientation: landscape) and (max-height: 560px)'

/** A phone on its side (the game's CSS lays the sheet on the right then). */
export function useSideways() {
  return useSyncExternalStore(
    (changed) => {
      const q = matchMedia(SIDEWAYS)
      q.addEventListener('change', changed)
      return () => q.removeEventListener('change', changed)
    },
    () => matchMedia(SIDEWAYS).matches,
  )
}

/** A block of the sheet: it comes in a moment after the one before (the sheet staggers them). */
export const ITEM: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: SPRING.pop },
}

/** A block whose own parts come in one by one too (tiles in a row). */
export const GROUP: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { ...SPRING.pop, delayChildren: 0.04, staggerChildren: 0.06 } },
}

/** A part of a GROUP: pops up in its place. */
export const TILE: Variants = {
  hidden: { opacity: 0, scale: 0.86 },
  show: { opacity: 1, scale: 1, transition: SPRING.pop },
}

/** The count of a number shown as it is (no thousands' commas: the words read the same as the game's card). */
export const plain = (n: number) => String(Math.round(n))

const away = (wide: boolean) => (wide ? { x: '104%', y: 0 } : { x: 0, y: '104%' })
const SHEET: Variants = {
  hidden: away,
  show: { x: 0, y: 0, transition: SPRING.sheet },
  out: (wide: boolean) => ({ ...away(wide), transition: SPRING.sheet }),
}
const PANEL: Variants = { show: { transition: { delayChildren: 0.06, staggerChildren: 0.045 } } }

/** How far (px) or how fast (px/s) a swipe must go for the sheet to close; short of it, it springs back. */
const FAR = 110
const FAST = 450

export function LevelSheet({ name, label, top, onClose, children }: { name: string; label: string; top?: boolean; onClose: () => void; children: ReactNode }) {
  const wide = useSideways()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = panel.current
    if (!el) return
    // the sheet itself takes the focus (Tab goes on to its buttons; Esc closes it in the game)
    el.focus({ preventScroll: true })
    // a swipe that starts on a picture moves the sheet, never drags the picture away (a mouse would)
    const keep = (e: DragEvent) => e.preventDefault()
    el.addEventListener('dragstart', keep)
    return () => el.removeEventListener('dragstart', keep)
  }, [])
  // how far the finger has pulled the sheet towards its way out; the shade lifts with it
  const pull = useMotionValue(0)
  const shade = useTransform(pull, [0, 360], [1, 0.15])
  // a swipe that began on a button is not a press of it
  const swiped = useRef(false)
  const letGo = (_: unknown, i: PanInfo) => {
    const far = wide ? i.offset.x : i.offset.y
    const fast = wide ? i.velocity.x : i.velocity.y
    if (far > FAR || (far > 24 && fast > FAST)) {
      // on its way with the finger's speed; the sheet's way out takes it the rest
      animate(pull, far + 240, { ...SPRING.sheet, velocity: fast })
      onClose()
    } else animate(pull, 0, SPRING.pop)
  }
  return (
    <div className={`farm-backdrop v-level-sheet ${name}`} onClick={onClose}>
      <m.div className="lv-shade" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
        <m.span style={{ opacity: shade }} />
      </m.div>
      <m.div className="lv-sheet" custom={wide} variants={SHEET} initial="hidden" animate="show" exit="out">
        <m.div
          className={`farm-panel${top ? ' top' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          ref={panel}
          variants={PANEL}
          drag={wide ? 'x' : 'y'}
          dragConstraints={wide ? { left: 0 } : { top: 0 }}
          dragElastic={0.06}
          dragMomentum={false}
          style={wide ? { x: pull } : { y: pull }}
          onPointerDownCapture={() => (swiped.current = false)}
          onDragStart={() => (swiped.current = true)}
          onDragEnd={letGo}
          onClickCapture={(e) => {
            if (!swiped.current) return
            e.stopPropagation()
            e.preventDefault()
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <i className="lv-grab" aria-hidden="true" />
          {children}
        </m.div>
      </m.div>
    </div>
  )
}

/**
 * Cancel and Claim, pressed with a finger: each sinks onto its lip. Claim pays (the game flies the coins from it to the
 * coin chip), `cheer` celebrates it once, and the row turns into what was claimed, its coins counting up as they land.
 */
export function ClaimRow({ unpaid, onClaim, onClose, cheer }: { unpaid: number; onClaim: (button: HTMLElement) => void; onClose: () => void; cheer?: () => void }) {
  const [got, setGot] = useState(0)
  const claim = (button: HTMLElement) => {
    if (got) return
    setGot(unpaid)
    onClaim(button)
    cheer?.()
  }
  const sink = { ...PRESS, whileTap: { ...PRESS.whileTap, y: 3 } }
  return (
    <AnimatePresence mode="popLayout">
      {unpaid > 0 && !got ? (
        <m.div key="ask" className="farm-confirm" variants={ITEM} exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}>
          <m.button className="btn soft" onClick={onClose} {...sink}>
            Cancel
          </m.button>
          <m.button className="btn leaf farm-buy" onClick={(e) => claim(e.currentTarget)} aria-label={`Claim ${unpaid} coins`} {...sink}>
            Claim <Coins n={unpaid} />
          </m.button>
        </m.div>
      ) : got ? (
        <m.p key="got" className="lv-got" role="status" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.pop}>
          <span className="lv-got-check">
            <Check weight="bold" />
          </span>
          Claimed
          <span className="farm-coins">
            <img src={art('coin')} alt="" />
            <CountUp to={got} duration={0.75} />
          </span>
        </m.p>
      ) : null}
    </AnimatePresence>
  )
}
