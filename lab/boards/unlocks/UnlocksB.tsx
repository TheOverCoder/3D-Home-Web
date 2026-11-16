import { AnimatePresence, m, type Variants } from 'motion/react'
import type { CSSProperties } from 'react'
import { unlockName } from '../../../src/farm/unlocks'
import { EASE, POP, SPRING } from '../../../src/ui/motion'
import { unlockPic, type UnlocksState } from './data'
import { Column, GarmentShow, LevelShow, Scenes, showSteps, useRoom, useShow } from './parts'
import { colsFor } from './UnlocksA'
import './UnlocksB.css'

// B · no second card: the level's show itself carries what opened, on a berry ribbon that unrolls under the number —
// one moment, "Level 2" and its gifts together, then the two rise and go. Locked, a thing keeps its price (greyed) and
// gets a violet badge on its picture's corner, the lock and the level's number, in the level's own colour. Every rule
// of its CSS is under .v-unlocks-b.

const out = { opacity: 0, transition: { duration: 0.12 } }
const ITEMS: Variants = { show: { transition: { delayChildren: 0.95, staggerChildren: 0.08 } } }

/** The ribbon: "Unlocked", then each thing in a white disc with its name, unrolling from its middle. */
function Ribbon({ ids, cols, small }: { ids: UnlocksState['opens']; cols: number; small?: boolean }) {
  return (
    <m.div
      className={`v-unlocks-b-ribbon${small ? ' small' : ''}`}
      initial={{ clipPath: 'inset(-10% 50% -10% 50%)', opacity: 0 }}
      animate={{ clipPath: 'inset(-10% 0% -10% 0%)', opacity: 1 }}
      transition={{ delay: small ? 0.4 : 0.55, duration: 0.45, ease: EASE.out }}
      aria-label={`Unlocked: ${ids.map(unlockName).join(', ')}`}
    >
      <span className="v-unlocks-b-band">
        <span className="v-unlocks-b-word">{small ? 'Opens' : 'Unlocked'}</span>
        <m.ul style={{ '--cols': cols } as CSSProperties} initial="hidden" animate="show" variants={small ? { show: { transition: { delayChildren: 0.6, staggerChildren: 0.06 } } } : ITEMS}>
          {ids.map((id) => (
            <m.li key={id} variants={POP}>
              <span className="v-unlocks-b-disc">
                <img className="art" src={unlockPic(id)} alt="" draggable={false} />
              </span>
              <b>{unlockName(id)}</b>
            </m.li>
          ))}
        </m.ul>
      </span>
    </m.div>
  )
}

function Show({ s }: { s: UnlocksState }) {
  const room = useRoom()
  const n = s.opens.length
  // the level's show lasts while its ribbon is there; a garment (every fifth level) after it
  const { garment, steps } = showSteps(s.level, [], 4900 + 250 * Math.max(0, n - 3))
  const { step, round } = useShow(steps)
  return (
    <Column>
      <AnimatePresence mode="wait">
        {step === 'level' && (
          <m.div key={`l${round}`} className="v-unlocks-b-show" exit={{ opacity: 0, y: -12, transition: { duration: 0.35, ease: 'easeIn' } }}>
            <LevelShow level={s.level} hold />
            <Ribbon ids={s.opens} cols={colsFor(n, room.wide)} />
          </m.div>
        )}
        {step === 'garment' && garment && (
          <m.div key={`g${round}`} exit={out} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: SPRING.pop }}>
            <GarmentShow g={garment} />
          </m.div>
        )}
      </AnimatePresence>
    </Column>
  )
}

export function UnlocksB({ s, onClose }: { s: UnlocksState; onClose: () => void }) {
  const room = useRoom()
  return (
    <div className="v-unlocks-b">
      <Scenes s={s} face="badge" reveal={<Show s={s} />} row={<Ribbon ids={s.opens} cols={colsFor(s.opens.length, room.wide)} small />} onDone={onClose} />
    </div>
  )
}
