import { m, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { art } from '../../../src/ui/art'
import { Check, LockSimple, Plus } from '../../../src/ui/glyphs'
import { SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { Behind } from '../animal-tools/parts'
import { ANIMAL_ART, KIND_NAME, TOOL_KINDS, TOOLS, farmRows, herdRow, ladderRows, ownedLast, remoteRows, toolRow, type Row, type ShopState, type ToolKind } from './data'
import { Heading, RowView, ShopSheet, useShop } from './parts'
import './ShopAnimalsB.css'

// B · a band per animal: one list, the animals first. Each kind is a road of four stops — another animal, its tool,
// "holds more", "more a tap" — joined by a line that fills as they are bought; the next stop to buy glows (the next
// reward in view), what is ahead waits greyed with its lock. A tap on a stop does what its row did (an animal at once;
// the tool and its steps through their card). Under them, the farm's rows (what is yours at the end) and the two
// remotes. Three chips at the top jump to each part. Every rule under .v-shop-animals-b.

export function ShopAnimalsB({ s, act }: { s: ShopState; act: Act<ShopState> }) {
  const shop = useShop(s, act)
  const list = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const jump = (id: string) => list.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
  return (
    <>
      <Behind coins={s.coins} level={s.level} />
      <ShopSheet coins={s.coins} onClose={act.close}>
        <div className="v-shop-animals-b" ref={list}>
          <nav className="sab-jump" aria-label="Go to">
            <button onClick={() => jump('sab-animals')}>
              <img src={art('chicken')} alt="" />
              Animals
            </button>
            <button onClick={() => jump('sab-farm')}>
              <img src={art('seedling')} alt="" />
              Farm
            </button>
            <button onClick={() => jump('sab-premium')}>
              <Crown weight="fill" className="sab-crown" />
              Premium
            </button>
          </nav>
          <Heading id="sab-animals">Animals</Heading>
          {TOOL_KINDS.map((k) => (
            <Band key={k} k={k} s={s} press={shop.press} last={shop.last?.key} />
          ))}
          <Heading id="sab-farm">Farm</Heading>
          <div className="farm-shop">
            {ownedLast(farmRows(s)).map((r) => (
              <RowView key={r.key} r={r} press={shop.press} fresh={shop.last?.key === r.key} />
            ))}
          </div>
          <Heading id="sab-premium" pic={<Crown weight="fill" className="sab-crown" />}>
            Premium
          </Heading>
          <div className="farm-shop">
            {remoteRows(s).map((r) => (
              <RowView key={r.key} r={r} press={shop.press} />
            ))}
          </div>
        </div>
      </ShopSheet>
      {shop.card}
    </>
  )
}

/** A kind's road: its herd's stop, its tool's and its two ladders', the next one to buy lit. */
function Band({ k, s, press, last }: { k: ToolKind; s: ShopState; press: (r: Row, el: Element | null) => void; last?: string }) {
  const herd = herdRow(s, k)
  const stops = [herd, toolRow(s, k), ...ladderRows(s, k)]
  const next = stops.findIndex((r) => r.state === 'buy' || r.state === 'card')
  const [n, most] = herd.steps!
  return (
    <section className="sab-band" aria-label={KIND_NAME[k]}>
      <div className="sab-who">
        <img src={art(ANIMAL_ART[k])} alt="" />
        <b>{KIND_NAME[k]}</b>
        <span className="sab-count">
          {n}/{most}
        </span>
      </div>
      <ol className="sab-road">
        {stops.map((r, i) => (
          <Stop key={r.key} r={r} i={i} k={k} next={i === next} done={r.state === 'owned'} press={press} fresh={last === r.key} />
        ))}
      </ol>
    </section>
  )
}

const WORDS = ['Animal', 'Tool', 'Holds', 'Per tap']

function Stop({ r, i, k, next, done, press, fresh }: { r: Row; i: number; k: ToolKind; next: boolean; done: boolean; press: (r: Row, el: Element | null) => void; fresh: boolean }) {
  const ref = useRef<HTMLLIElement>(null)
  const pic = i === 0 ? art(ANIMAL_ART[k]) : TOOLS[k].pic
  // what the stop says under it: the next animal (5/6), the tool's name, the next step's words (4 a nest, 2 a tap)
  const say = i === 0 ? (done ? 'Full' : `${r.next}/${r.steps![1]}`) : i === 1 ? r.name : (r.next ?? r.now ?? '')
  return (
    <li ref={ref} className={`sab-stop sa-step${done ? ' done' : ''}${next ? ' next' : ''}${r.state === 'locked' ? ' locked' : ''}${fresh ? ' sa-fresh' : ''}`}>
      <m.button
        className="sab-dot"
        onClick={() => press(r, ref.current)}
        whileTap={done ? undefined : { scale: 0.9 }}
        transition={SPRING.pop}
        aria-disabled={done || r.state === 'locked' || undefined}
        aria-label={`${WORDS[i]}: ${r.name}${done ? ', yours' : r.state === 'locked' ? `, ${r.why}` : `, ${r.next ?? ''} for ${r.price} coins`}`}
      >
        <img className={i > 1 ? 'sab-small' : ''} src={pic} alt="" />
        {i === 0 && !done && <Plus weight="bold" className="sab-plus" />}
        {i > 1 && <span className="sab-k">{i === 2 ? 'Hold' : 'Tap'}</span>}
        {done && (
          <span className="sab-mark ok">
            <Check weight="bold" />
          </span>
        )}
        {r.state === 'locked' && (
          <span className="sab-mark lock">
            <LockSimple weight="fill" />
          </span>
        )}
      </m.button>
      <span className="sab-say">{say}</span>
      {!done && r.state !== 'locked' ? (
        <span className="sab-price">
          <Coins n={r.price} />
        </span>
      ) : r.state === 'locked' && i < 2 ? (
        <span className="sab-why">{r.why}</span>
      ) : r.steps && i > 1 ? (
        <span className="sab-why">Max</span>
      ) : null}
    </li>
  )
}
