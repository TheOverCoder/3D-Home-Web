import { m, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { produceById } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { Ring } from '../../../src/farm/machine/parts'
import { art } from '../../../src/ui/art'
import { SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { BarnChip, BLOCK, Behind, idleWords, PerTap, Said, ToolSheet, Upgrades, useTool } from './parts'
import { TOOLS, type ToolState, type ToolView } from './sample'
import './AnimalToolsC.css'

// C · the goods as a pile, the animals as portraits: what the herd has waiting is one heap in the middle (on the
// tool's own base: the nest, the bucket, the shears' basket) with its number big under it — the hero, the biggest
// target: a tap takes the per tap from the fullest animal, the top of the heap flies off to the barn. Over it, the
// animals as round portraits, each with her count and a ring to her next: a tap takes from her. Every rule under
// .v-animal-tools-c.

const ANIMAL_ART = { hens: 'chicken', cows: 'cow', sheep: 'ewe' } as const
const BASE = { nests: null, pail: TOOLS.cows.pic, shears: art('basket') }
/** Where each picture of the heap lies (in % of the heap's box), the bottom row first. */
const HEAP = [
  [36, 62],
  [14, 64],
  [58, 64],
  [25, 44],
  [47, 44],
  [5, 46],
  [68, 46],
  [36, 26],
  [16, 28],
  [56, 28],
  [26, 10],
  [46, 10],
] as const

export function AnimalToolsC({ s, act, remote }: { s: ToolState; act: Act<ToolState>; remote?: ReactNode }) {
  const t = useTool(s, act.set)
  const v = t.v
  const off = v.room <= 0
  return (
    <>
      <Behind coins={s.coins} />
      <ToolSheet
        v={v}
        className="v-animal-tools-c"
        remote={remote}
        onClose={act.close}
        head={
          <>
            <PerTap v={v} />
            <BarnChip v={v} chip={t.chip} />
          </>
        }
      >
        <m.div className="atc-portraits" variants={BLOCK} role="group" aria-label={`The ${v.kind}`}>
          {v.spots.map((_, i) => (
            <Portrait key={i} v={v} i={i} off={off} tap={t.tap} />
          ))}
        </m.div>
        <m.div className="atc-main" variants={BLOCK}>
          <Pile v={v} off={off} tap={t.tap} />
          <div className="atc-side">
            <Upgrades v={v} coins={s.coins} onBuy={t.buy} />
            <Said line={t.line} idle={idleWords(v)} />
          </div>
        </m.div>
      </ToolSheet>
    </>
  )
}

function Portrait({ v, i, off, tap }: { v: ToolView; i: number; off: boolean; tap: (spot: number | undefined, from: Element | null) => number }) {
  const sp = v.spots[i]
  const good = produceById(v.good)
  const full = sp.has >= sp.most
  return (
    <m.button
      className={`atc-face${full ? ' full' : ''}${sp.has ? '' : ' empty'}${off ? ' at-off' : ''}`}
      onClick={(e) => tap(i, e.currentTarget.querySelector('.atc-face-pic'))}
      whileTap={{ scale: 0.88 }}
      transition={SPRING.pop}
      aria-label={`${sp.name}: ${sp.has} ${sp.has === 1 ? good.name : good.plural}`}
    >
      <span className="atc-face-pic">
        <Ring size={50} stroke={4} value={full ? 1 : sp.next} className="atc-ring" />
        <img src={art(ANIMAL_ART[v.kind])} alt="" draggable={false} />
        <b className="atc-face-n">{sp.has}</b>
      </span>
      <span className="atc-face-name">{sp.name}</span>
    </m.button>
  )
}

/** The heap: every good waiting (up to twelve drawn), on the tool's base; its number under it. */
function Pile({ v, off, tap }: { v: ToolView; off: boolean; tap: (spot: number | undefined, from: Element | null) => number }) {
  const still = useReducedMotion()
  const all = v.spots.reduce((a, sp) => a + sp.has, 0)
  const good = produceById(v.good)
  const shown = Math.min(all, HEAP.length)
  return (
    <m.button
      className={`atc-pile atc-${v.look}${all ? '' : ' empty'}${off ? ' at-off' : ''}`}
      onClick={(e) => tap(undefined, e.currentTarget.querySelector('.atc-heap img:last-child') ?? e.currentTarget)}
      whileTap={{ scale: 0.94, y: 3 }}
      transition={SPRING.pop}
      aria-label={`All the ${v.kind}: ${all} ${all === 1 ? good.name : good.plural}${all ? `, tap to take ${v.perTap} from the fullest` : ''}`}
    >
      {BASE[v.look] ? <img className="atc-base" src={BASE[v.look]!} alt="" draggable={false} /> : <span className="atc-straw" aria-hidden="true" />}
      <span className="atc-heap" aria-hidden="true">
        {HEAP.slice(0, shown).map(([x, y], k) => (
          <m.img
            key={k}
            src={iconUrl(v.good)}
            alt=""
            draggable={false}
            style={{ left: `${x}%`, top: `${y}%` }}
            initial={still ? false : { scale: 0, y: -16 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ ...SPRING.pop, delay: still ? 0 : 0.18 + k * 0.03 }}
          />
        ))}
      </span>
      <span className="atc-total">
        <b key={all}>{all}</b>
        <span>{all === 1 ? good.name : good.plural}</span>
      </span>
    </m.button>
  )
}
