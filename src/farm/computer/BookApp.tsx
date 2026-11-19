import { art } from '../../ui/art'
import { GoodPic } from '../../ui/GoodPic'
import { produceById, type ProduceId } from '../data'
import { CHANNELS } from '../ledger'
import { Bars } from './charts'
import type { DeskView } from './ComputerDesk'
import { CHANNEL_WORDS, coinsText, moveText, weekday } from './words'

// The computer's Sales book (./apps.ts; the farm's book: src/farm/ledger.ts): the coins of each of the last two weeks'
// days, stacked by where they came from, this week's by place against the week before, and your own price index —
// what you got against fair ("Days"); and each good sold, how many, for how much, a unit and where ("Goods"). Draws
// the book's view (./bookView.ts).

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
const nameOf = (id: ProduceId) => cap(produceById(id).plural)

export function BookApp({ v, tab }: { v: DeskView; tab: string }) {
  const b = v.book
  if (!b.goods.length) return <p className="mp-note calm">Nothing sold these two weeks yet: every sale is written here as it is made.</p>
  if (tab === 'goods')
    return (
      <div className="pc-list">
        {b.goods.map((g) => (
          <div key={g.good} className="pc-row" data-good={g.good}>
            <GoodPic good={g.good} count={g.units} className="pc-good" />
            <span className="pc-row-text">
              <span className="pc-row-name">{nameOf(g.good)}</span>
              <span className="pc-row-sub">
                {coinsText(g.per)} a unit{g.fair > 0 ? ` (fair ${coinsText(g.fair)})` : ''} · {g.places.map((c) => CHANNEL_WORDS[c].name.toLowerCase()).join(', ')}
              </span>
            </span>
            <span className="pc-price">
              <img src={art('coin')} alt="" />
              {coinsText(g.coins)}
            </span>
          </div>
        ))}
      </div>
    )
  const used = CHANNELS.filter((c) => b.days.some((d) => d.coins[c] > 0))
  const change = b.lastWeekTotal > 0 ? moveText((b.weekTotal / b.lastWeekTotal - 1) * 100) : null
  const index = b.index === null ? null : moveText(b.index - 100)
  return (
    <div className="pc-list">
      <div className="pc-index-head">
        <img className="art pc-head-art" src={art('bar-chart')} alt="" />
        <span className="pc-today-word">This week</span>
        <b className="pc-big pc-coins">
          <img src={art('coin')} alt="" />
          {coinsText(b.weekTotal)}
        </b>
        {change && <span className={`tag pc-move ${change.chip}`}>{change.text} on the week before</span>}
      </div>
      <Bars days={b.days.map((d) => d.coins)} order={used} />
      <div className="pc-axis" aria-hidden="true">
        <span>{weekday(b.days[0].day)}</span>
        <span>Today</span>
      </div>
      <div className="pc-keys" aria-label="This week, by where you sold">
        {used.map((c) => (
          <span key={c} className="tag pc-key">
            <i className={`pc-swatch pc-ch-${c}`} aria-hidden="true" />
            {CHANNEL_WORDS[c].name} {coinsText(b.week[c])}
          </span>
        ))}
      </div>
      <p className="pc-say">The week before: {coinsText(b.lastWeekTotal)} coins.</p>
      {b.index !== null && index && (
        <div className="pc-row">
          <span className="pc-row-text">
            <span className="pc-row-name">Your price index: {b.index}</span>
            <span className="pc-row-sub">What you got this week against the fair price: 100 is fair.</span>
          </span>
          <span className={`tag pc-move ${index.chip}`}>{index.text}</span>
        </div>
      )}
    </div>
  )
}
