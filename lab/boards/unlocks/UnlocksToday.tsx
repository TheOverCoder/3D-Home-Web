import { AnimatePresence, m } from 'motion/react'
import { Column, GarmentShow, LevelShow, Scenes, showSteps, useShow } from './parts'
import type { UnlocksState } from './data'

// Today: the game has no locks — every crop, upgrade, decoration and field can be bought from level 1 at its price —
// and a level reached shows its number, then on every fifth level the garment's card (the card A grows out of).

const out = { opacity: 0, transition: { duration: 0.12 } }

function TodayShow({ s }: { s: UnlocksState }) {
  const { garment, steps } = showSteps(s.level, [])
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
      </AnimatePresence>
    </Column>
  )
}

export function UnlocksToday({ s, onClose }: { s: UnlocksState; onClose: () => void }) {
  return <Scenes s={s} face="none" reveal={<TodayShow s={s} />} onDone={onClose} />
}
