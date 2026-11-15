import { useEffect, useState } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { ItemPic } from '../ui/ItemPic'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { ArrowRight, CaretLeft, Check, Clock, X } from '../ui/glyphs'
import { MACHINES, produceById, type MachineId, type ProduceId } from './data'
import { iconUrl } from './icons'
import type { LevelBoost } from './machineView'
import { clockText, farm, machineActions, machineView, useFarm } from './state'

// A machine's panel, as plain as it can be until its designed one replaces it (it is fed the same MachineView and
// calls the same MachineActions, src/farm/machineView.ts): the level (tapped, what it gives), the queue as a row of
// places (done, under way, waiting: a waiting job can be taken out or moved up), Collect, what it makes (a tap, or its
// number key, puts one into the queue), and another place for its price (a card asks first).

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const seconds = (s: number) => (s < 60 ? `${Math.ceil(s)} s` : `${Math.round((s / 60) * 10) / 10} min`)
const percent = (share: number) => `${Math.round(share * 100)}%`
/** What a level gives, in a few words. */
const boostWords = (b: LevelBoost) => (b.xp || b.coins || b.speed ? `+${percent(b.xp)} XP · +${percent(b.coins)} coins${b.speed ? ` · ${percent(b.speed)} quicker` : ''}` : 'No boost yet')
/** The machine's picture: what it makes (the oven, its first cake). */
const pictureOf = (id: MachineId) => iconUrl(MACHINES[id].picture ?? MACHINES[id].recipes[0].makes)

/** Draws again every second while open: the time left counts down. */
function useSeconds() {
  const [, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
}

export function MachinePanel({ id }: { id: MachineId }) {
  useFarm((s) => s.rev)
  useSeconds()
  const close = useHome((s) => s.closePanel)
  const openPanel = useHome((s) => s.openPanel)
  const [showBoost, setShowBoost] = useState(false)
  const view = machineView(id)
  const act = machineActions(id)
  const { level } = view
  const done = view.slots.filter((s) => s.state === 'done').length
  const add = (recipe: string) => {
    if (act.add(recipe)) playGesture('interact')
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = view.recipes[Number(e.key) - 1]
      if (r?.can) add(r.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <Shell
      title={view.name}
      art={pictureOf(id)}
      sub={
        <>
          <button className="tag level" onClick={() => setShowBoost(!showBoost)} aria-expanded={showBoost} aria-label={`Level ${level.n}: what it gives`}>
            Level {level.n}
          </button>
          <span className="tag" title="Places in the queue">
            {view.slots.length}/{view.capacity}
          </span>
        </>
      }
      onClose={close}
    >
      {showBoost && (
        <p className="farm-line machine-boost">
          {boostWords(level.boost)}
          {level.next !== null && level.nextBoost && ` — level ${level.n + 1} after ${level.next - level.minutes} more minutes of work: ${boostWords(level.nextBoost)}`}
        </p>
      )}
      {view.slots.length ? (
        <div className="farm-basket machine-queue" aria-label="The queue">
          {view.slots.map((s, i) => {
            const first = view.slots.findIndex((x) => x.state === 'waiting')
            return (
              <div key={i} className={`farm-basket-item machine-slot ${s.state}`} title={cap(produceById(s.makes).name)}>
                <ItemPic id={s.makes} count={1} />
                {s.state === 'done' && (
                  <span className="tag ok">
                    <Check weight="bold" />
                    Done
                  </span>
                )}
                {s.state === 'working' && (
                  <span className="tag">
                    <Clock weight="bold" />
                    {clockText(s.left)}
                  </span>
                )}
                {s.state === 'waiting' && (
                  <span className="machine-slot-actions" style={{ display: 'flex', gap: 6 }}>
                    <button className="btn soft small round" disabled={i === first} onClick={() => act.move(i, i - 1)} aria-label="Sooner">
                      <CaretLeft weight="bold" />
                    </button>
                    <button className="btn soft small round" onClick={() => act.remove(i) && uiClick()} aria-label="Take it out">
                      <X weight="bold" />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="farm-empty">The queue is empty: choose what to make.</p>
      )}
      {done > 0 && (
        <div className="farm-confirm">
          <button
            className="btn leaf"
            onClick={() => {
              if (act.collect()) playGesture('interact')
            }}
          >
            <Check weight="bold" />
            Collect {done}
          </button>
        </div>
      )}
      <div className="farm-grid machine-recipes" aria-label="What it makes">
        {view.recipes.map((r, i) => (
          <button key={r.id} className="farm-card" disabled={!r.can} onClick={() => add(r.id)} aria-label={`${MACHINES[id].words.word} ${produceById(r.makes).name}`}>
            <kbd className="farm-key">{i + 1}</kbd>
            <img className="art" src={iconUrl(r.makes)} alt="" />
            <span className="farm-card-name">{cap(produceById(r.makes).name)}</span>
            <span className="farm-card-tags">
              {Object.entries(r.needs).map(([item, n]) => {
                const have = r.have[item as ProduceId] ?? 0
                return (
                  <span key={item} className={`tag ${have >= (n ?? 0) ? 'ok' : 'short'}`} title={`${cap(produceById(item as ProduceId).plural)}: you have ${have}`}>
                    <img src={iconUrl(item as ProduceId)} alt="" />
                    {n}
                  </span>
                )
              })}
              <span className="tag">
                <Clock weight="bold" />
                {seconds(r.seconds)}
              </span>
            </span>
          </button>
        ))}
      </div>
      {view.upgrade && (
        <div className="farm-shop-item">
          <div className="farm-shop-text">
            <strong>Another place</strong>
            <div className="farm-shop-tags">
              <span className="tag effect">
                {view.capacity}
                <ArrowRight weight="bold" className="effect-arrow" />
                <b>{view.upgrade.capacity}</b>
              </span>
            </div>
          </div>
          <button
            className="btn small"
            disabled={farm.coins < view.upgrade.price}
            onClick={() => openPanel({ kind: 'machine-slot', id })}
            aria-label={`Another place in the queue, for ${view.upgrade.price} coins`}
          >
            <Coins n={view.upgrade.price} />
          </button>
        </div>
      )}
    </Shell>
  )
}

/** The card that asks before a machine's next place is bought: its places now → after, Not now, and Buy with the price.
 *  It goes back to the machine's panel. */
export function MachineSlotCard({ id }: { id: MachineId }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const view = machineView(id)
  const next = view.upgrade
  const afford = !!next && farm.coins >= next.price
  const back = () => openPanel({ kind: 'machine', id })
  const confirm = () => {
    if (!armed || !machineActions(id).buySlot()) return
    farmSound('build')
    playGesture('interact')
    back()
  }
  return (
    <Shell
      title="Another place"
      art={pictureOf(id)}
      sub={
        <>
          <Purse />
          <span className="tag effect">
            {view.capacity}
            {next && (
              <>
                <ArrowRight weight="bold" className="effect-arrow" />
                <b>{next.capacity}</b>
              </>
            )}
          </span>
        </>
      }
      onClose={close}
    >
      <p className="farm-line">One more job in the {view.name.toLowerCase()}&apos;s queue.</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Not now
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
          {!next ? (
            <>
              <Check weight="bold" />
              Max
            </>
          ) : afford ? (
            <>
              Buy · <Coins n={next.price} />
            </>
          ) : (
            <>Needs {next.price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}
