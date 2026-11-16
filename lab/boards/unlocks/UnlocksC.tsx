import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, type CSSProperties } from 'react'
import { unlockName, type UnlockId } from '../../../src/farm/unlocks'
import { art } from '../../../src/ui/art'
import { DID, SPRING } from '../../../src/ui/motion'
import { unlockPic, whereOf, type UnlocksState } from './data'
import { Column, GarmentShow, LevelShow, Scenes, showSteps, useRoom, useShow } from './parts'
import './UnlocksC.css'

// C · one small card per thing, dealt in turn: after the level's show the cards fly out one by one, each turning from
// its back (the level's star) to its face — the picture, the name, and where to find it (Seeds, Mill, Shop…) — then,
// a moment later, they gather into the level's star on the dashboard, where the level card keeps "what's next".
// Locked, a thing wears the level card's berry banner across its corner ("Level 6"), its price gone. Every rule of
// its CSS is under .v-unlocks-c.

const out = { opacity: 0, transition: { duration: 0.12 } }
const DEAL = 0.22 // s between two cards

/** How many cards a row holds: up to four upright (five or more: two rows), up to eight sideways. */
const colsFor = (n: number, wide: boolean) => (wide ? Math.min(n, 8) : n <= 4 ? n : Math.ceil(n / 2))

/** One card: its back, then (turned) its face. `dealt`: it flies out of the deck and turns; else it is just there. */
function Card({ id, k, n, dealt }: { id: UnlockId; k: number; n: number; dealt?: boolean }) {
  const tilt = (k - (n - 1) / 2) * 3
  return (
    <m.div
      className="v-unlocks-c-card"
      style={{ transformPerspective: 700 }}
      initial={dealt ? { opacity: 0, y: -80, scale: 0.35, rotateY: 180, rotate: -16 } : { opacity: 0, y: 8, rotateY: 0, rotate: tilt }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0, rotate: tilt }}
      transition={dealt ? { ...SPRING.soft, delay: 0.2 + k * DEAL, opacity: { duration: 0.12, delay: 0.2 + k * DEAL } } : { ...SPRING.pop, delay: 0.5 + k * 0.05 }}
    >
      <span className="v-unlocks-c-back" aria-hidden="true">
        <img src={art('glowing-star')} alt="" />
      </span>
      <span className="v-unlocks-c-face">
        <img className="art" src={unlockPic(id)} alt="" draggable={false} />
        <b>{unlockName(id)}</b>
        <small>{whereOf(id)}</small>
      </span>
    </m.div>
  )
}

/** The deal, and (collect) the cards gathering into the level's star on the dashboard, which pops as they land. */
function Deal({ s, collect }: { s: UnlocksState; collect: boolean }) {
  const room = useRoom()
  const still = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const n = s.opens.length
  useEffect(() => {
    if (!collect || !scope.current) return
    const star = document.querySelector('.v-top-c-star')
    const to = star?.getBoundingClientRect()
    const cards = Array.from(scope.current.querySelectorAll<HTMLElement>('.v-unlocks-c-card'))
    void animate(scope.current.querySelector('.v-unlocks-c-title')!, { opacity: 0 }, { duration: 0.2 })
    if (!to || !to.width || still) {
      for (const el of cards) void animate(el, { opacity: 0 }, { duration: 0.25 })
      return
    }
    cards.forEach((el, k) => {
      const r = el.getBoundingClientRect()
      const dx = to.left + to.width / 2 - (r.left + r.width / 2)
      const dy = to.top + to.height / 2 - (r.top + r.height / 2)
      void animate(el, { x: dx, y: dy, scale: 0.12, rotate: 0, opacity: [1, 1, 0.2] }, { duration: 0.55, delay: k * 0.06, ease: [0.5, 0, 0.75, 1] })
    })
    if (star) void animate(star, DID.keyframes, { ...DID.options, delay: 0.5 + (cards.length - 1) * 0.06 })
  }, [collect, animate, scope, still])
  return (
    <div ref={scope} className="v-unlocks-c-deal" role="status" aria-label={`Unlocked at level ${s.level}: ${s.opens.map(unlockName).join(', ')}`}>
      <m.span className="v-unlocks-c-title" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.pop}>
        <img src={art('glowing-star')} alt="" />
        Unlocked at level {s.level}
      </m.span>
      <div className="v-unlocks-c-row" style={{ '--cols': colsFor(n, room.wide) } as CSSProperties} aria-hidden="true">
        {s.opens.map((id, k) => (
          <Card key={id} id={id} k={k} n={n} dealt />
        ))}
      </div>
    </div>
  )
}

function Show({ s }: { s: UnlocksState }) {
  const n = s.opens.length
  const { garment, steps } = showSteps(s.level, [
    { id: 'deal', ms: 600 + n * DEAL * 1000 + 2000 },
    { id: 'collect', ms: 1000 },
  ])
  const { step, round } = useShow(steps)
  return (
    <Column>
      <AnimatePresence mode="wait">
        {step === 'level' && (
          <m.div key={`l${round}`} exit={out}>
            <LevelShow level={s.level} />
          </m.div>
        )}
        {step === 'garment' && garment && (
          <m.div key={`g${round}`} exit={out}>
            <GarmentShow g={garment} />
          </m.div>
        )}
        {(step === 'deal' || step === 'collect') && (
          <m.div key={`d${round}`} exit={out}>
            <Deal s={s} collect={step === 'collect'} />
          </m.div>
        )}
      </AnimatePresence>
    </Column>
  )
}

/** Under "At level N" in the level card: the next level's cards, face up, waiting. */
function Row({ s }: { s: UnlocksState }) {
  const room = useRoom()
  return (
    <div
      className="v-unlocks-c-row small"
      style={{ '--cols': room.wide ? s.opens.length : colsFor(s.opens.length, false) } as CSSProperties}
      aria-label={`Opens: ${s.opens.map(unlockName).join(', ')}`}
    >
      {s.opens.map((id, k) => (
        <Card key={id} id={id} k={k} n={s.opens.length} />
      ))}
    </div>
  )
}

export function UnlocksC({ s, onClose }: { s: UnlocksState; onClose: () => void }) {
  return (
    <div className="v-unlocks-c">
      <Scenes s={s} face="banner" reveal={<Show s={s} />} row={<Row s={s} />} onDone={onClose} />
    </div>
  )
}
