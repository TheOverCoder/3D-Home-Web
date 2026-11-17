import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { produceById } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { Ring } from '../../../src/farm/machine/parts'
import { art } from '../../../src/ui/art'
import { Clock } from '../../../src/ui/glyphs'
import { SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { BarnChip, BLOCK, Behind, clock, idleWords, PerTap, Said, ToolSheet, Upgrades, useTool } from './parts'
import type { ToolState, ToolView } from './sample'
import './AnimalToolsB.css'

// B · a card per animal, one big target each: the same for the three tools (only the head's picture says which). Each
// card is the animal (her picture and name), one round target with her goods and how many, a ring round it to her
// next one, and a peg for every place she has (filled as they are). A tap on the target takes the tool's per tap from
// her. Nothing to take: the target is pale with her time; no room: every target greys. Every rule under
// .v-animal-tools-b.

const ANIMAL_ART = { hens: 'chicken', cows: 'cow', sheep: 'ewe' } as const

export function AnimalToolsB({ s, act, remote }: { s: ToolState; act: Act<ToolState>; remote?: ReactNode }) {
  const t = useTool(s, act.set)
  const v = t.v
  const off = v.room <= 0
  return (
    <>
      <Behind coins={s.coins} />
      <ToolSheet
        v={v}
        className="v-animal-tools-b"
        remote={remote}
        onClose={act.close}
        head={
          <>
            <PerTap v={v} />
            <BarnChip v={v} chip={t.chip} />
          </>
        }
      >
        <m.div className={`atb-cards n${v.spots.length}`} variants={BLOCK} role="group" aria-label={`The ${v.kind}`}>
          {v.spots.map((_, i) => (
            <Card key={i} v={v} i={i} off={off} tap={t.tap} />
          ))}
        </m.div>
        <div className="atb-foot">
          <Upgrades v={v} coins={s.coins} onBuy={t.buy} />
          <m.div variants={BLOCK}>
            <Said line={t.line} idle={idleWords(v)} />
          </m.div>
        </div>
      </ToolSheet>
    </>
  )
}

function Card({ v, i, off, tap }: { v: ToolView; i: number; off: boolean; tap: (spot: number | undefined, from: Element | null) => number }) {
  const sp = v.spots[i]
  const good = produceById(v.good)
  const full = sp.has >= sp.most
  return (
    <div className={`atb-card${full ? ' full' : ''}${sp.has ? '' : ' empty'}`}>
      <span className="atb-who">
        <img src={art(ANIMAL_ART[v.kind])} alt="" />
        <span>{sp.name}</span>
      </span>
      <m.button
        className={`atb-target${off ? ' at-off' : ''}`}
        onClick={(e) => tap(i, e.currentTarget.querySelector('.atb-pic'))}
        whileTap={{ scale: 0.86 }}
        transition={SPRING.pop}
        aria-label={`${sp.name}: ${sp.has} ${sp.has === 1 ? good.name : good.plural}${sp.has ? `, tap to take ${Math.min(v.perTap, sp.has)}` : `, next in ${clock(sp.seconds)}`}`}
      >
        <Ring size={76} stroke={5} value={full ? 1 : sp.next} className="atb-ring" />
        <img className="atb-pic art" src={iconUrl(v.good)} alt="" draggable={false} />
        {sp.has > 0 ? (
          <b className="atb-n">{sp.has}</b>
        ) : (
          <span className="atb-time">
            <Clock weight="bold" />
            {clock(sp.seconds)}
          </span>
        )}
      </m.button>
      <span className="atb-pegs" aria-hidden="true">
        {Array.from({ length: sp.most }, (_, k) => (
          <i key={k} className={k < sp.has ? 'on' : ''} />
        ))}
      </span>
    </div>
  )
}
