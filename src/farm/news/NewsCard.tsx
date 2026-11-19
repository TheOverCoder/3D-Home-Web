import { AnimatePresence, m, type Variants } from 'motion/react'
import { useState } from 'react'
import { art } from '../../ui/art'
import { GarmentPic } from '../../ui/GarmentPic'
import { Check } from '../../ui/glyphs'
import { Road } from '../../ui/Road'
import { EASE, ITEM, SPRING, STAGGER } from '../../ui/motion'
import { PanelSheet } from '../../ui/PanelSheet'
import { Odds } from '../DailyCard'
import type { ProduceId } from '../data'
import { iconUrl } from '../icons'
import type { RoadStopView, SeasonRoadView } from '../seasonRoad'
import { LuckyReels } from './LuckyReels'
import type { NewsView, NowItem, SoonItem } from './view'
import './NewsCard.css'

// How the farm news looks (the design lab's board "news" shows it with no game round it). What it shows is ./view.ts,
// made from the farm by ../NewsPanel.tsx.
//
// A front page in the game's paper: the masthead (the sheet's head: the rolled newspaper, "Farm News", today's date;
// a double rule under it),
// then "Active now" — the hero: the event on today as a story, its picture, what it does, its effect, until when and
// when it comes back (an invitation, never a clock running out); on the lucky draw's day the story is the draw itself
// (./LuckyReels.tsx: one tap, two reels, two goods at double price; its "?" says what it can draw and how likely) — and
// "Coming soon": the next time of every other event, each on a
// calendar leaf with its weekday and date, its name, when (Tomorrow · All day) and its effect on a chip. A quiet day
// says so and names the next. The sheet comes in from the bottom (sideways, the right) on its spring, its blocks one by
// one; the story's picture lands last, the one moment of a day without a draw; a swipe down (sideways: right) closes.

/** An event on now, as the front page's story: what it is, what it does, until when, and when it comes back. */
function Story({ e }: { e: NowItem }) {
  return (
    <article className={`nw-story ${e.id}`} aria-label={`${e.name}: ${e.say} ${e.until}. ${e.back}.`}>
      <m.img
        className="art nw-story-art"
        src={art(e.art)}
        alt=""
        initial={{ scale: 0.3, rotate: -14, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ ...SPRING.soft, delay: 0.28 }}
      />
      <div className="nw-story-words">
        <h4>
          {e.name}
          {e.fresh && <span className="nw-new">New</span>}
        </h4>
        <p>{e.say}</p>
        <div className="nw-story-tags">
          <span className="tag nw-effect">{e.chip}</span>
          <span className="nw-left">
            {e.until} · <b>{e.back}</b>
          </span>
        </div>
      </div>
    </article>
  )
}

/** One coming event: its calendar leaf, its picture, its name and when, its effect. */
function Soon({ s }: { s: SoonItem }) {
  return (
    <m.li className={`nw-row ${s.id}`} variants={ITEM} aria-label={`${s.name}: ${s.day}, ${s.hours}. ${s.say}`}>
      <span className="nw-leaf" aria-hidden="true">
        <small>{s.weekday}</small>
        <b>{s.date}</b>
      </span>
      <img className="art nw-row-art" src={art(s.art)} alt="" />
      <span className="nw-row-words">
        <b>{s.name}</b>
        <span>
          {s.day} · {s.hours}
        </span>
      </span>
      <span className="tag nw-effect">{s.chip}</span>
    </m.li>
  )
}

/** What a stop of the season road gives, as a picture: coins, a building material, goods, the season's garment. */
function StopPic({ s }: { s: RoadStopView }) {
  if (s.kind === 'garment' && s.garment) return <GarmentPic g={s.garment} />
  const src = s.kind === 'coins' ? art('coin') : s.kind === 'material' ? iconUrl('plank') : s.kind === 'goods' ? art('basket') : art('wrapped-gift')
  return <img className="art" src={src} alt="" />
}

/** What a stop gives, in words. */
const stopWords = (s: RoadStopView) =>
  s.kind === 'coins'
    ? `${s.coins} coins`
    : s.kind === 'material'
      ? 'a building material'
      : s.kind === 'goods'
        ? 'goods from your farm'
        : s.garment
          ? `the ${s.garment.name.toLowerCase()} and ${s.coins} coins`
          : `${s.coins} coins`

/** The "This season" tab: the season road (src/farm/seasonRoad.ts) — its season, ten stops on a line filled as far as
 *  the XP has come, the one being worked on glowing, the last the season's garment; and one line: how far the next stop
 *  is, or, done, when the next season's road opens. Nothing ticks down: it waits for you. */
function SeasonRoad({ r }: { r: SeasonRoadView }) {
  const line = r.done
    ? `Road done. ${r.opens!.name}’s road opens in ${r.opens!.days} ${r.opens!.days === 1 ? 'day' : 'days'} of play.`
    : `${r.next!.left} XP to stop ${r.next!.stop}${r.next!.almost ? ': almost there' : ''}.`
  return (
    <m.section className="nw-road" variants={ITEM} aria-label={`The season road: ${r.name}`}>
      <div className="nw-road-head">
        <img className="art" src={art(r.art)} alt="" />
        <span className="nw-road-words">
          <b>{r.name}</b>
          <small>{r.current ? 'This season’s road' : 'Carried on from its season'}</small>
        </span>
        <span className={`tag${r.done ? ' ok' : ''}`}>{r.done ? 'Done' : `${r.stops.filter((s) => s.state === 'got').length}/${r.stops.length}`}</span>
      </div>
      <Road
        road={r.road}
        have={r.xp}
        toward={r.next?.stop ?? 0}
        label={`${r.name}’s road: ${r.stops.filter((s) => s.state === 'got').length} of ${r.stops.length} stops`}
        cls="sr"
        stop={(k) => {
          const s = r.stops[k - 1]
          return (
            <li key={k} className={`sr-stop ${s.state}${s.kind === 'garment' ? ' big' : ''}`} aria-label={`Stop ${k}: ${stopWords(s)}${s.state === 'got' ? ', given' : ''}`}>
              <span className="sr-disc">
                <StopPic s={s} />
                {s.state === 'got' && (
                  <i className="sr-check">
                    <Check weight="bold" />
                  </i>
                )}
              </span>
              <small className="sr-num">{k}</small>
            </li>
          )
        }}
      />
      <p className="nw-road-line">{line}</p>
    </m.section>
  )
}

/** A tab's page: it comes in from the side, its blocks one after another (each an ITEM), and goes quickly. It holds
 *  its blocks' variants itself, so a page opened after the sheet came in still brings them in. */
const TAB: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE.out, staggerChildren: 0.05 } },
  out: { opacity: 0, transition: { duration: 0.1 } },
}

export function NewsCard({
  v,
  road = null,
  onDraw,
  onClose,
  onLand,
  onReveal,
}: {
  v: NewsView
  /** the season road for the "This season" tab (none: the week's news alone) */
  road?: SeasonRoadView | null
  /** the lucky draw (the farm's): its goods, or null */
  onDraw: () => ProduceId[] | null
  onClose: () => void
  /** a reel landing (a tick) */
  onLand?: () => void
  /** both reels in (the gift's sound) */
  onReveal?: () => void
}) {
  const [tab, setTab] = useState<'week' | 'season'>('week')
  const lucky = v.now.find((e) => e.id === 'lucky')
  const others = v.now.filter((e) => e.id !== 'lucky')
  const next = v.soon[0]
  return (
    // the sheet's head is the masthead: the rolled newspaper, "Farm News" and today's date (src/ui/PanelSheet.tsx)
    <PanelSheet label="Farm news" title="Farm News" pic={art('rolled-up-newspaper')} sub={<small className="nw-date">{v.date}</small>} className="news-card" onClose={onClose}>
      {road && (
        <div className="nw-tabs" role="tablist" aria-label="The farm news">
          <button type="button" role="tab" className={`nw-tab${tab === 'week' ? ' on' : ''}`} aria-selected={tab === 'week'} onClick={() => setTab('week')}>
            This week
          </button>
          <button type="button" role="tab" className={`nw-tab${tab === 'season' ? ' on' : ''}`} aria-selected={tab === 'season'} onClick={() => setTab('season')}>
            <img className="art" src={art('triangular-flag')} alt="" />
            This season
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {road && tab === 'season' ? (
          <m.div key="season" className="nw-body" variants={TAB} initial="hidden" animate="show" exit="out">
            <SeasonRoad r={road} />
          </m.div>
        ) : (
          <m.div key="week" className="nw-body" variants={TAB} initial="hidden" animate="show" exit="out">
            <m.section className="nw-now" variants={ITEM} aria-label="Active now">
              <h3 className="nw-kicker">
                {v.now.length > 0 && <i className="nw-live" aria-hidden="true" />}
                Active now
              </h3>
              {lucky && v.lucky && (
                <article className="nw-story lucky nw-lucky" aria-label={`${lucky.name}: ${lucky.say}`}>
                  <div className="nw-lucky-head">
                    <img className="art" src={art(lucky.art)} alt="" />
                    <h4>
                      {lucky.name}
                      {lucky.fresh && <span className="nw-new">New</span>}
                    </h4>
                    <span className="nw-left">
                      <b>{lucky.until}</b>
                    </span>
                    {v.lucky.odds.length > 0 && <Odds rows={v.lucky.odds} label="What the draw can pick" className="nw-odds" />}
                  </div>
                  <LuckyReels pool={v.lucky.pool} goods={v.lucky.goods} until={v.lucky.until} onDraw={onDraw} onLand={onLand} onReveal={onReveal} />
                </article>
              )}
              {others.map((e) => (
                <Story key={e.key} e={e} />
              ))}
              {!v.now.length && (
                <p className="nw-quiet">
                  <img className="art" src={art('sun')} alt="" />
                  <span>
                    A quiet day on the farm.
                    {next && (
                      <>
                        {' '}
                        Next: <b>{next.name}</b>, {next.day.toLowerCase()}.
                      </>
                    )}
                  </span>
                </p>
              )}
            </m.section>
            {v.soon.length > 0 && (
              <m.section className="nw-soon" variants={ITEM} aria-label="Coming soon">
                <h3 className="nw-kicker">
                  <img className="art" src={art('spiral-calendar')} alt="" />
                  Coming soon
                </h3>
                <m.ul variants={STAGGER}>
                  {v.soon.map((s) => (
                    <Soon key={s.key} s={s} />
                  ))}
                </m.ul>
              </m.section>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </PanelSheet>
  )
}
