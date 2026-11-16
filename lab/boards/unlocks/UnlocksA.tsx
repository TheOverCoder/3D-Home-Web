import { AnimatePresence, m } from 'motion/react'
import type { CSSProperties } from 'react'
import { unlockName } from '../../../src/farm/unlocks'
import { SPRING } from '../../../src/ui/motion'
import { unlockPic, type UnlocksState } from './data'
import { Column, GarmentShow, LevelShow, Scenes, showSteps, useRoom, useShow } from './parts'
import { Reveal } from './Reveal'
import './UnlocksA.css'

// A · the garment's card as "Unlocked!": after the level's show (and its garment, every fifth level) the same card
// pops out of its burst of light with every picture of what opened, the names under them, "Level 2" beside the word.
// Locked, a thing keeps its picture faded and its price gives way to a chip: the lock and "Level 2" (the plan's
// LockTag), on cards, buttons, tags, the prompt and the labels alike. Every rule of its CSS is under .v-unlocks-a.

const out = { opacity: 0, transition: { duration: 0.12 } }

/** How many pictures a row holds: all of them sideways, two rows of three upright for five or six. */
export const colsFor = (n: number, wide: boolean) => (wide ? Math.min(n, 6) : n <= 4 ? n : Math.ceil(n / 2))

function Show({ s }: { s: UnlocksState }) {
  const room = useRoom()
  const n = s.opens.length
  const { garment, steps } = showSteps(s.level, [{ id: 'opened', ms: 3400 + 300 * Math.max(0, n - 3) }])
  const { step, round } = useShow(steps)
  const names = s.opens.map(unlockName)
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
        {step === 'opened' && (
          <Reveal
            key={`o${round}`}
            word="Unlocked!"
            note={<span className="tag v-unlocks-a-level">Level {s.level}</span>}
            items={s.opens.map((id, k) => ({ pic: unlockPic(id), name: names[k] }))}
            cols={colsFor(n, room.wide)}
            label={`Unlocked at level ${s.level}: ${names.join(', ')}`}
          />
        )}
      </AnimatePresence>
    </Column>
  )
}

/** Under "At level N" in the level card: what it opens, the same pictures and names as the card that will say so. */
function Row({ s }: { s: UnlocksState }) {
  return (
    <m.div
      className="v-unlocks-a-row"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.pop, delay: 0.45 }}
      aria-label={`Opens: ${s.opens.map(unlockName).join(', ')}`}
    >
      <span className="v-unlocks-a-row-word">Opens</span>
      <ul style={{ '--cols': colsFor(s.opens.length, false) } as CSSProperties}>
        {s.opens.map((id) => (
          <li key={id}>
            <img className="art" src={unlockPic(id)} alt="" />
            <b>{unlockName(id)}</b>
          </li>
        ))}
      </ul>
    </m.div>
  )
}

export function UnlocksA({ s, onClose }: { s: UnlocksState; onClose: () => void }) {
  return (
    <div className="v-unlocks-a">
      <Scenes s={s} face="chip" reveal={<Show s={s} />} row={<Row s={s} />} onDone={onClose} />
    </div>
  )
}
