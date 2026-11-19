import { m } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import { art } from '../../ui/art'
import { CaretRight } from '../../ui/glyphs'
import { GoodPic } from '../../ui/GoodPic'
import { LockTag, opensWords } from '../../ui/LockTag'
import { PRESS, REVEAL } from '../../ui/motion'
import { MACHINES, produceById, type ProduceId } from '../data'
import { BASKET } from '../mood'
import { Curve, LineChart, Spark } from './charts'
import type { DeskView } from './ComputerDesk'
import type { GoodMarket, Why } from './marketView'
import { CHANNEL_WORDS, coinsText, moveText, oddsText, timesText, waitText, weekday } from './words'

// The computer's Market (./apps.ts): every good the farm knows, what it is worth now and where it is heading
// ("Prices"), a good's own page (each place that buys it, why it is worth what it is today, your shelf's price against
// its wait, its week), and the vegetable index ("Index"). Draws the Market's view (./marketView.ts).

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
const nameOf = (id: ProduceId) => cap(produceById(id).plural)

/** A good's move today: its price now against fair, as an arrow and a percent on a chip. */
function Move({ pct, suffix = '' }: { pct: number; suffix?: string }) {
  const mv = moveText(pct)
  return (
    <span className={`tag pc-move ${mv.chip}`}>
      {mv.text}
      {suffix}
    </span>
  )
}

export function MarketApp({ v, tab, good, openGood }: { v: DeskView; tab: string; good: ProduceId | null; openGood: (g: ProduceId | null) => void }) {
  if (tab === 'index') return <Index v={v} />
  const g = good ? v.market.goods.find((x) => x.id === good) : null
  return g ? <GoodPage key={g.id} g={g} v={v} /> : <Prices v={v} openGood={openGood} />
}

/** Every good: those the farm knows first (by store, or by today's move), then those not open yet, the materials
 *  apart. A row opens the good's page. */
function Prices({ v, openGood }: { v: DeskView; openGood: (g: ProduceId) => void }) {
  const [by, setBy] = useState<'store' | 'move'>('store')
  const goods = v.market.goods.filter((g) => !g.material)
  const open = goods.filter((g) => g.locked === null)
  const sorted = by === 'move' ? [...open].sort((a, b) => b.move - a.move) : (['silo', 'barn'] as const).flatMap((s) => open.filter((g) => g.store === s))
  const locked = goods.filter((g) => g.locked !== null).sort((a, b) => a.locked! - b.locked!)
  const materials = v.market.goods.filter((g) => g.material)
  return (
    <div className="pc-list">
      <ToggleGroup.Root type="single" value={by} onValueChange={(x) => x && setBy(x as 'store' | 'move')} className="pc-toggle" aria-label="Sort the prices">
        <ToggleGroup.Item value="store" className="pc-toggle-item">
          By store
        </ToggleGroup.Item>
        <ToggleGroup.Item value="move" className="pc-toggle-item">
          By today&apos;s move
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      {sorted.map((g) => (
        <Row key={g.id} g={g} open={() => openGood(g.id)} />
      ))}
      {locked.length > 0 && <h4 className="sheet-heading">Not open yet</h4>}
      {locked.map((g) => (
        <Row key={g.id} g={g} open={() => openGood(g.id)} />
      ))}
      <h4 className="sheet-heading">
        <img className="art" src={art('construction-worker')} alt="" />
        Building materials
      </h4>
      {materials.map((g) => (
        <Row key={g.id} g={g} open={() => openGood(g.id)} />
      ))}
    </div>
  )
}

/** A good's row: its picture (where it is made), and a press that opens its page — its name, its week and tomorrow,
 *  its price now and its move from fair (a good not open yet: the level it opens at). */
function Row({ g, open }: { g: GoodMarket; open: () => void }) {
  const mv = moveText(g.move)
  const label = g.locked !== null ? `${nameOf(g.id)}, ${opensWords(g.locked)}` : `${nameOf(g.id)}: ${coinsText(g.now)} coins a unit, ${mv.words} on fair`
  return (
    <div className={`pc-row${g.locked !== null ? ' locked' : ''}`} data-good={g.id}>
      <GoodPic good={g.id} className="pc-good" />
      <m.button className="pc-row-open" onClick={open} aria-label={label} {...PRESS}>
        <span className="pc-row-name">{nameOf(g.id)}</span>
        {!g.material && <Spark days={g.trend.days} next={g.trend.tomorrow} tone={moveText(g.trend.pct).tone} />}
        {g.locked !== null ? (
          <LockTag level={g.locked} />
        ) : (
          <>
            <span className="pc-price" data-price={g.now}>
              <img src={art('coin')} alt="" />
              {coinsText(g.now)}
            </span>
            {!g.material && <Move pct={g.move} />}
          </>
        )}
        <CaretRight className="pc-caret" weight="bold" />
      </m.button>
    </div>
  )
}

/** Why a good is worth what it is today, in a few words each. */
function whyWords(w: Why): string {
  if (w.kind === 'machine') return `${MACHINES[w.machine].name} Lv ${w.level} ${timesText(w.times)}`
  if (w.kind === 'draw') return `Lucky draw ×${w.times}`
  return `Market mood ${timesText(w.times)}`
}

/** A good's own page: what it is worth now and why, every place that buys it, your shelf's price against its wait,
 *  and its week with your own sales. */
function GoodPage({ g, v }: { g: GoodMarket; v: DeskView }) {
  const p = produceById(g.id)
  const tomorrow = moveText(g.trend.pct)
  // your own sales a unit, on the days of the week the chart draws (the book keeps two weeks)
  const yours = g.yours.slice(-7)
  const dots = yours.flatMap((y, k) => (y === null ? [] : [{ at: k, v: y }]))
  const sold = g.yours.filter((y): y is number => y !== null)
  const shelf = g.shelves[0]
  return (
    <m.div className="pc-page" {...REVEAL}>
      <div className="pc-page-head">
        <GoodPic good={g.id} className="pc-good big" />
        <div className="pc-page-title">
          <h4>{nameOf(g.id)}</h4>
          {g.locked !== null ? (
            <LockTag level={g.locked} />
          ) : (
            <span className="pc-page-price">
              <span className="pc-price" data-price={g.now}>
                <img src={art('coin')} alt="" />
                {coinsText(g.now)}
              </span>
              a unit {!g.material && <Move pct={g.move} suffix=" on fair" />}
            </span>
          )}
        </div>
      </div>
      <div className="pc-chips" aria-label="Why today">
        <span className="pc-chips-word">Why today:</span>
        {g.why.length ? (
          g.why.map((w) => (
            <span key={w.kind} className={`tag pc-move ${w.times > 1 ? 'ok' : 'short'}`}>
              {whyWords(w)}
            </span>
          ))
        ) : (
          <span className="tag">{g.material ? 'The contractor’s price' : `Its fair price, ${coinsText(g.base)}`}</span>
        )}
      </div>
      <h5 className="sheet-heading">Where it sells</h5>
      <ul className="pc-channels">
        {g.channels.map((c) => (
          <li key={c.id} className={`pc-channel${g.best === c.id ? ' best' : ''}`}>
            <div className="pc-channel-top">
              <span className="pc-channel-name">{CHANNEL_WORDS[c.id].name}</span>
              <span className="pc-price">
                <img src={art('coin')} alt="" />
                {c.low !== c.high && c.id === 'gate' ? `${coinsText(c.low)}–${coinsText(c.high)}` : coinsText(c.per)}
              </span>
            </div>
            <div className="pc-chips">
              {g.best === c.id && <span className="tag ok">Pays most</span>}
              {g.soonest === c.id && <span className="tag pc-soon">Sells soonest</span>}
              <span className="tag">
                +{coinsText(c.xp + c.bonusXp)} XP{c.bonusXp ? ' a sale' : ''}
              </span>
              <span className="tag">{c.gifts > 1 && c.gift > 0 ? `${oddsText(c.gift)}, ×${c.gifts}` : oddsText(c.gift)}</span>
              <span className="tag">{waitText(c.wait)}</span>
            </div>
          </li>
        ))}
      </ul>
      {g.curve.length > 1 && (
        <>
          <h5 className="sheet-heading">Your shelf: its price against the wait</h5>
          <Curve points={g.curve} at={shelf?.pct ?? null} />
          <p className="pc-say">
            {shelf
              ? `On your shelf at ${shelf.pct} %: ${coinsText(shelf.per)} a unit, sold ${waitText(shelf.wait).toLowerCase()}.`
              : `From ${coinsText(g.curve[0].per)} a unit at ${g.curve[0].pct} %, sold ${waitText(g.curve[0].wait).toLowerCase()}, to ${coinsText(g.curve[g.curve.length - 1].per)} at ${g.curve[g.curve.length - 1].pct} %.`}
          </p>
        </>
      )}
      {!g.material && (
        <>
          <h5 className="sheet-heading">Its week</h5>
          <LineChart days={g.trend.days} next={g.trend.tomorrow} base={g.base} dots={dots} />
          <div className="pc-axis" aria-hidden="true">
            <span>{weekday(v.day - 6)}</span>
            <span>Tomorrow ●</span>
          </div>
          <p className="pc-say">
            Tomorrow {tomorrow.words}: {coinsText(g.trend.tomorrow)} a unit.{' '}
            {sold.length
              ? `You sold ${p.plural} for ${coinsText(sold.reduce((a, b) => a + b, 0) / sold.length)} a unit, on average, these two weeks.`
              : `You have sold no ${p.plural} these two weeks.`}
          </p>
        </>
      )}
    </m.div>
  )
}

/** The vegetable index: the mood of every crop over two weeks and tomorrow, round 100 (fair), and today's movers. */
function Index({ v }: { v: DeskView }) {
  const ix = v.market.index
  const pct = ix.now > 0 ? (ix.tomorrow / ix.now - 1) * 100 : 0
  const movers = BASKET.map((c) => v.market.goods.find((g) => g.id === c)!)
    .map((g) => ({ g, pct: ((g.why.find((w) => w.kind === 'mood')?.times ?? 1) - 1) * 100 }))
    .sort((a, b) => b.pct - a.pct)
  const still = movers.every((x) => Math.abs(x.pct) < 0.5)
  return (
    <div className="pc-list">
      <div className="pc-index-head">
        <span className="pc-today-word">Vegetable index</span>
        <b className="pc-big">{Math.round(ix.now)}</b>
        <Move pct={pct} suffix=" tomorrow" />
      </div>
      <LineChart days={ix.days} next={ix.tomorrow} base={100} />
      <div className="pc-axis" aria-hidden="true">
        <span>{weekday(v.day - ix.days.length + 1)}</span>
        <span>Tomorrow ●</span>
      </div>
      <p className="pc-say">Every crop&apos;s price against fair, all together: 100 is fair. Tomorrow {Math.round(ix.tomorrow)}.</p>
      <h5 className="sheet-heading">Today&apos;s movers</h5>
      {still ? (
        <p className="mp-note calm">Every crop sells at its fair price today.</p>
      ) : (
        movers.map(({ g, pct: p }) => (
          <div key={g.id} className="pc-row">
            <GoodPic good={g.id} className="pc-good" />
            <span className="pc-row-name">{nameOf(g.id)}</span>
            <Move pct={p} />
          </div>
        ))
      )}
      <p className="pc-say">Every good but the building materials moves with the town&apos;s market mood, a little each day, the same on every farm.</p>
    </div>
  )
}
