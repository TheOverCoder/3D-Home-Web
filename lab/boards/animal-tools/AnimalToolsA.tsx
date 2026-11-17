import { m } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { produceById } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { Ring } from '../../../src/farm/machine/parts'
import { art } from '../../../src/ui/art'
import { SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { BarnChip, BLOCK, Behind, idleWords, PerTap, Said, ToolSheet, Upgrades, useTool } from './parts'
import { TOOLS, type ToolState, type ToolView } from './sample'
import './AnimalToolsA.css'

// A · the place itself: the panel draws the tool as it stands at the fence, and you tap it. The coop is its nest box,
// a nest for every hen (her eggs in a heap with their number, a ring round her to her next egg); the bucket is one
// wooden pail filling with the whole herd's milk, the cows as chips under it; the shears hang over a basket of the
// flock's wool, the sheep as chips. A tap on the pail or the basket takes from the fullest animal; a tap on a nest or a
// chip, from that one. Every rule under .v-animal-tools-a.

const ANIMAL_ART = { hens: 'chicken', cows: 'cow', sheep: 'ewe' } as const
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

export function AnimalToolsA({ s, act, remote }: { s: ToolState; act: Act<ToolState>; remote?: ReactNode }) {
  const t = useTool(s, act.set)
  const v = t.v
  const off = v.room <= 0
  return (
    <>
      <Behind coins={s.coins} />
      <ToolSheet
        v={v}
        className="v-animal-tools-a"
        remote={remote}
        onClose={act.close}
        head={
          <>
            <PerTap v={v} />
            <BarnChip v={v} chip={t.chip} />
          </>
        }
      >
        <div className={`ata-stage ata-on-${v.look}`}>
          <m.div className="ata-hero" variants={BLOCK}>
            {v.look === 'nests' ? <NestBox v={v} off={off} tap={t.tap} /> : <Vessel v={v} off={off} tap={t.tap} />}
          </m.div>
          {v.look !== 'nests' && <Herd v={v} off={off} tap={t.tap} />}
          <div className="ata-side">
            <Upgrades v={v} coins={s.coins} onBuy={t.buy} />
            <m.div variants={BLOCK}>
              <Said line={t.line} idle={idleWords(v)} />
            </m.div>
          </div>
        </div>
      </ToolSheet>
    </>
  )
}

type Tap = (spot: number | undefined, from: Element | null) => number

/** The coop's nest box: a nest for every hen, in rows of three. */
function NestBox({ v, off, tap }: { v: ToolView; off: boolean; tap: Tap }) {
  const good = produceById(v.good)
  return (
    <div className="ata-box" role="group" aria-label={`${v.name}: ${v.spots.length} nests`}>
      {v.spots.map((sp, i) => (
        <m.button
          key={i}
          className={`ata-nest${sp.has ? '' : ' empty'}${sp.has >= sp.most ? ' full' : ''}${off ? ' at-off' : ''}`}
          onClick={(e) => tap(i, e.currentTarget.querySelector('.ata-eggs'))}
          whileTap={{ scale: 0.9, y: 2 }}
          transition={SPRING.pop}
          aria-label={`${sp.name}: ${sp.has} ${sp.has === 1 ? good.name : good.plural}${sp.has ? `, tap to take ${Math.min(v.perTap, sp.has)}` : ''}`}
        >
          <span className="ata-straw" aria-hidden="true" />
          <span className="ata-eggs" aria-hidden="true">
            {Array.from({ length: Math.min(sp.has, 4) }, (_, k) => (
              <img key={k} className={`ata-egg e${k}`} src={iconUrl(v.good)} alt="" draggable={false} />
            ))}
          </span>
          {sp.has > 0 && <b className="ata-n">{sp.has}</b>}
          {sp.has < sp.most && (
            <span className="ata-hen" aria-hidden="true">
              <Ring size={34} stroke={4} value={sp.next} className="ata-ring" />
              <img src={art('chicken')} alt="" />
            </span>
          )}
        </m.button>
      ))}
    </div>
  )
}

/** The pail (the herd's milk, filling) or the wool basket under the shears: one target, the fullest animal first. */
function Vessel({ v, off, tap }: { v: ToolView; off: boolean; tap: Tap }) {
  const all = v.spots.reduce((a, sp) => a + sp.has, 0)
  const most = v.spots.reduce((a, sp) => a + sp.most, 0)
  const good = produceById(v.good)
  const snip = useRef<HTMLSpanElement>(null)
  return (
    <m.button
      className={`ata-vessel${all ? '' : ' empty'}${off ? ' at-off' : ''}`}
      onClick={(e) => {
        const n = tap(undefined, e.currentTarget.querySelector('.ata-top'))
        if (n && snip.current) snip.current.animate([{ rotate: '0deg' }, { rotate: '-18deg' }, { rotate: '0deg' }], { duration: 260, easing: 'ease-out' })
      }}
      whileTap={{ scale: 0.95, y: 3 }}
      transition={SPRING.pop}
      aria-label={`${v.name}: ${all} ${all === 1 ? good.name : good.plural} waiting${all ? `, tap to take ${v.perTap} from the fullest` : ''}`}
    >
      {v.look === 'pail' ? (
        <span className="ata-pail" aria-hidden="true">
          <i className="ata-handle" />
          <span className="ata-staves">
            <m.i className="ata-milk" initial={false} animate={{ height: `${Math.max(0, Math.min(1, all / most)) * 100}%` }} transition={SPRING.soft} />
            <i className="ata-hoop h1" />
            <i className="ata-hoop h2" />
          </span>
          <span className="ata-top" />
        </span>
      ) : (
        <span className="ata-basket" aria-hidden="true">
          <span className="ata-wool">
            {Array.from({ length: Math.min(all, 7) }, (_, k) => (
              <img key={k} className={`w${k}`} src={iconUrl('wool')} alt="" draggable={false} />
            ))}
          </span>
          <img className="ata-basket-pic" src={art('basket')} alt="" draggable={false} />
          <span className="ata-top" />
          <span ref={snip} className="ata-shears">
            <img src={TOOLS.sheep.pic} alt="" draggable={false} />
          </span>
        </span>
      )}
      <span className="ata-total">
        <img src={iconUrl(v.good)} alt="" />
        <b key={all}>{all}</b>
      </span>
    </m.button>
  )
}

/** The cows or the sheep as chips: each one's own goods and a ring to her next; a tap takes from her. */
function Herd({ v, off, tap }: { v: ToolView; off: boolean; tap: Tap }) {
  const good = produceById(v.good)
  return (
    <m.div className="ata-herd" variants={BLOCK} role="group" aria-label={`The ${v.kind}`}>
      {v.spots.map((sp, i) => (
        <m.button
          key={i}
          className={`ata-chip${sp.has ? '' : ' empty'}${sp.has >= sp.most ? ' full' : ''}${off ? ' at-off' : ''}`}
          onClick={(e) => tap(i, e.currentTarget.querySelector('.ata-chip-pic'))}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.pop}
          aria-label={`${sp.name}: ${sp.has} ${sp.has === 1 ? good.name : good.plural}`}
        >
          <span className="ata-chip-pic">
            <Ring size={40} stroke={4} value={sp.has >= sp.most ? 1 : sp.next} className="ata-ring" />
            <img src={art(ANIMAL_ART[v.kind])} alt="" />
          </span>
          <span className="ata-chip-name">{cap(sp.name)}</span>
          <b className="ata-chip-n">{sp.has}</b>
        </m.button>
      ))}
    </m.div>
  )
}
