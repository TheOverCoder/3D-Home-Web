import { m } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { freshEvents } from '../../../src/farm/events'
import { newsView } from '../../../src/farm/news/view'
import { ItemPic } from '../../../src/ui/ItemPic'
import { art, type ArtId } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { ArrowCounterClockwise, CaretRight, Check, Clock, HandSwipeRight } from '../../../src/ui/glyphs'
import { EASE } from '../../../src/ui/motion'
import { useLessMotion } from '../../../src/ui/still'
import { TIPS, loadView, useLive, useWide } from '../loading/load'
import { STEPS, stationOf, useStations, useTapOn } from '../loading/steps'
import type { TodayState } from '../loading-today'
import './LoadingCalendarA.css'

// A · the farm's tear-off calendar, with the tips on its slips (the two the user liked, as one: loading-today's page and
// loading-almanac's deck). On a warm wooden table, today's page of the farm's calendar: the weekday on its red band, the
// date big, what is on at the farm today (or next) by the device's own date in the farm news's words — and under a
// perforated line, a pad of tear-off slips, each one tip (a picture, a word, a line). A swipe tears the top slip off and
// the next is under it; left alone, a slip tears off by itself every few seconds (not after a touch, until the page has
// been left alone a while). The way is the marker circling the date: three strokes, one for each real step
// (../loading/steps.ts), each with its picture, the running one fast and then slower, never closing before its step ends.
// A returning player (✦, sample data) finds the first slip is what waits on the farm. Ready: the circle closes, READY!
// is stamped on the date, the pad jolts, one burst; a tap goes on to the menu.
//
// What answers the finger while the page is held for seconds (the house built, the graphics warmed up) is the browser's
// own scrolling: the slips are a plain scroller that snaps slip by slip, and each slip's place is a scroll-driven
// animation of its transform and opacity — held under the top one, then torn away as the scroller moves on — which the
// browser runs off the page's thread, as it does the marker, the step's picture, the slip's corner, the hint's hand and
// the mug's steam. Only the slip turning by itself and the line's words wait for the page.

/** The marker's three strokes: where each starts round the date (degrees from the top, clockwise) and how far it goes. */
const ARC_FROM = [5, 125, 245]
const ARC = 110
/** A circle's arc in the ring's own box (0..100), for the faint track under each stroke. */
const arcPath = (from: number, span: number, r = 44.5) => {
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${(50 + r * Math.sin(a)).toFixed(2)} ${(50 - r * Math.cos(a)).toFixed(2)}`
  }
  return `M ${pt(from)} A ${r} ${r} 0 0 1 ${pt(from + span)}`
}
const PIC: Record<(typeof STEPS)[number], ArtId> = { fetch: 'package', build: 'building-construction', light: 'light-bulb' }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A slip turns by itself this often, and not for this long after a touch. */
const TURN_MS = 6000
const LEFT_ALONE_MS = 15000

type Slip = { key: string; tone: 'sun' | 'berry' | 'leaf' | 'xp'; pic: string; title: string; text: string }
const TONES: Slip['tone'][] = ['sun', 'berry', 'leaf', 'xp']
/** The pad of slips: every tip the loading screen has (each true of the game today). */
const TIP_SLIPS: Slip[] = TIPS.map((t, i) => ({ key: t.title, tone: TONES[i % 4], pic: t.pic, title: t.title, text: t.text }))

export function LoadingCalendarA({ s, onPlay }: { s: TodayState; onPlay: () => void }) {
  const live = useLive(s)
  const v = loadView(live)
  const wide = useWide()
  const still = useLessMotion()
  const cur = stationOf(v.step)
  const fill = useStations(v.step, { prop: 'rotate', val: (p) => `${p * ARC}deg` }, live.total ? live.loaded / live.total : 0, v.again)
  const day = new Date(s.day)
  // what is on at the farm today, else what comes next (the farm news's words)
  const news = newsView(s.day, freshEvents(), [])
  const on = news.now[0] ?? null
  const next = on ? null : (news.soon[0] ?? null)
  const ev = on ?? next
  const when = on ? 'Today' : next ? next.day : ''
  const until = on ? news.now[0].until : next ? next.hours : ''
  const away = live.away
  const slips: (Slip | 'away')[] = away ? ['away', ...TIP_SLIPS] : TIP_SLIPS
  const last = slips.length - 1

  // the pad of slips: torn by the thumb (the browser's scroll), or by itself while it is left alone
  const pad = useRef<HTMLDivElement>(null)
  const stack = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const [swiped, setSwiped] = useState(false)
  const touched = useRef(-Infinity)
  // where the slips stood as a finger came down: a tap turns the slip, a swipe has turned it already
  const downAt = useRef(0)
  const tapped = () => {
    const d = pad.current
    if (d && Math.abs(d.scrollLeft - downAt.current) < 4) turn(1, true)
  }
  const turn = (dir: 1 | -1, byHand: boolean) => {
    const d = pad.current
    const slip = d?.querySelector<HTMLElement>('.lc-slip')
    if (!d || !slip) return
    if (byHand) {
      touched.current = performance.now()
      setSwiped(true)
    }
    const w = slip.offsetWidth
    const now = Math.round(d.scrollLeft / w)
    if (dir === 1 && now >= last) {
      // the pad is done: a fresh one, from the first slip
      d.scrollTo({ left: 0, behavior: 'auto' })
      stack.current?.animate(
        still
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, translate: '0 0.75rem', scale: '0.97' },
              { opacity: 1, translate: '0 0', scale: '1' },
            ],
        {
          duration: 320,
          easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
        },
      )
      return
    }
    d.scrollTo({ left: Math.max(0, now + dir) * w, behavior: still ? 'auto' : 'smooth' })
  }
  const turnRef = useRef(turn)
  turnRef.current = turn
  useEffect(() => {
    const d = pad.current
    if (!d) return
    const hand = () => {
      touched.current = performance.now()
      downAt.current = d.scrollLeft
      setSwiped(true)
    }
    const moved = () => {
      const slip = d.querySelector<HTMLElement>('.lc-slip')
      if (slip) setAt(Math.round(d.scrollLeft / slip.offsetWidth))
    }
    d.addEventListener('pointerdown', hand, { passive: true })
    d.addEventListener('wheel', hand, { passive: true })
    d.addEventListener('scroll', moved, { passive: true })
    return () => {
      d.removeEventListener('pointerdown', hand)
      d.removeEventListener('wheel', hand)
      d.removeEventListener('scroll', moved)
    }
  }, [])
  // by itself: a slip every few seconds, not while the player turns them, nor once the farm is ready
  useEffect(() => {
    if (v.ready) return
    const id = setInterval(() => {
      if (performance.now() - touched.current < LEFT_ALONE_MS) return
      turnRef.current(1, false)
    }, TURN_MS)
    return () => clearInterval(id)
  }, [v.ready])

  // ready: the stamp lands, then one burst from it
  const stamp = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => stamp.current && burst(stamp.current, { count: 70, spread: 100, power: 30 }), 640)
    return () => clearTimeout(t)
  }, [v.ready, still])
  useTapOn(v.ready, onPlay)

  const happening = ev && <Happening ev={ev} when={when} until={until} />
  return (
    <m.div
      className={`v-loading-calendar-a${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}${swiped ? ' swiped' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <span className="lc-table" aria-hidden="true" />
      <m.header className="lc-name" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE.out }}>
        <h1 aria-label="3D Home">3D Home</h1>
      </m.header>

      <span className="lc-mug" aria-hidden="true">
        <i />
        <i />
        <i />
        <img className="art" src={art('hot-beverage')} alt="" />
      </span>

      <m.div className="lc-pad" initial={{ opacity: 0, y: 40, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -1.2 }} transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.08 }}>
        <div className="lc-jolt">
          <span className="lc-under" aria-hidden="true" />
          <div className="lc-page">
            <span className="lc-rings" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div className="lc-band">{DAYS[day.getDay()]}</div>
            <div className="lc-body">
              <div className="lc-date">
                <p className="lc-month">{MONTHS[day.getMonth()]}</p>
                <div className="lc-ring" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.min(3, cur)}>
                  <svg className="lc-track" viewBox="0 0 100 100" aria-hidden="true">
                    {ARC_FROM.map((a) => (
                      <path key={a} d={arcPath(a, ARC)} />
                    ))}
                  </svg>
                  <span className="lc-strokes" aria-hidden="true">
                    {STEPS.map((st, i) => (
                      <span key={st} className={`lc-arc ${i < cur ? 'done' : i === cur ? 'now' : 'later'}`} style={{ rotate: `${ARC_FROM[i]}deg` }}>
                        <span className="lc-clip">
                          <i ref={fill(i)}>
                            <b className="lc-tip" />
                          </i>
                        </span>
                      </span>
                    ))}
                  </span>
                  <strong className="lc-num">{day.getDate()}</strong>
                  {STEPS.map((st, i) => (
                    <span
                      key={st}
                      className={`lc-step ${i < cur ? 'done' : i === cur ? 'now' : 'later'}`}
                      style={{ '--a': `${ARC_FROM[i] + ARC / 2}deg`, '--i': i } as CSSProperties}
                      aria-hidden="true"
                    >
                      <img className="art" src={art(PIC[st])} alt="" />
                      {i < cur && (
                        <b>
                          <Check weight="bold" />
                        </b>
                      )}
                    </span>
                  ))}
                  <span ref={stamp} className="lc-stamp" aria-hidden="true">
                    Ready!
                  </span>
                </div>
              </div>

              <div className="lc-day">
                {happening}
                <div className="lc-perf">
                  <span className="lc-hint">
                    <HandSwipeRight weight="fill" aria-hidden="true" />
                    <span className="by-finger">Swipe for the next tip</span>
                    <span className="by-mouse">Click for the next tip</span>
                  </span>
                </div>
                <div className="lc-stack" ref={stack} style={{ '--n': slips.length } as CSSProperties}>
                  <span className="lc-stack-under" aria-hidden="true" />
                  <div ref={pad} className="lc-slips" role="region" aria-label="Tips" tabIndex={0} onClick={tapped}>
                    {slips.map((c, i) =>
                      c === 'away' && away ? (
                        <article key="away" className="lc-slip leaf away" style={{ '--i': i } as CSSProperties} aria-label="Waiting on your farm">
                          <div className="lc-leaf">
                            <div className="lc-paper">
                              <div className="lc-words">
                                <p className="lc-count">Since {away.ago} ago</p>
                                <h2>Waiting on your farm</h2>
                              </div>
                              <div className="lc-goods">
                                {away.goods.map((g) => (
                                  <ItemPic key={g.item} id={g.item} count={g.count} />
                                ))}
                                <span className="item-pic">
                                  <img className="art" src={art('people-queue')} alt="" draggable={false} />
                                  <b className="qty">{away.buyers}</b>
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ) : c !== 'away' ? (
                        <article key={c.key} className={`lc-slip ${c.tone}`} style={{ '--i': i } as CSSProperties} aria-label={c.title}>
                          <div className="lc-leaf">
                            <div className="lc-paper">
                              <span className="lc-pic">
                                <img className="art" src={c.pic} alt="" draggable={false} />
                              </span>
                              <div className="lc-words">
                                <p className="lc-count">
                                  Tip {i - (away ? 1 : 0) + 1} of {TIP_SLIPS.length}
                                </p>
                                <h2>{c.title}</h2>
                                <p className="lc-text">{c.text}</p>
                              </div>
                            </div>
                          </div>
                        </article>
                      ) : null,
                    )}
                  </div>
                  <button className="lc-corner" aria-label={at >= last ? 'Back to the first tip' : 'Next tip'} onClick={() => turn(1, true)}>
                    {at >= last ? <ArrowCounterClockwise weight="bold" /> : <CaretRight weight="bold" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </m.div>

      <m.p className="lc-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.3 }}>
        <strong>
          {v.ready && <Check weight="bold" aria-hidden="true" />}
          {v.line}
        </strong>
        {v.left && v.step === 'fetch' && (
          <span className="lc-left">
            <Clock weight="bold" aria-hidden="true" /> {v.left}
          </span>
        )}
        {v.again && <span className="lc-left">Lighter graphics suit this phone.</span>}
        {v.ready && <span className="lc-left">Tap to go on</span>}
      </m.p>
    </m.div>
  )
}

/** What is on at the farm today, or next: its picture, when, its name, what it does and until when. */
function Happening({ ev, when, until }: { ev: { name: string; say: string; chip: string; art: ArtId }; when: string; until: string }) {
  return (
    <div className="lc-today">
      <img className="art" src={art(ev.art)} alt="" />
      <div>
        <p className="lc-when">
          {when} · <span>{until}</span>
        </p>
        <p className="lc-ev">
          {ev.name} <b className="lc-chip">{ev.chip}</b>
        </p>
        <p className="lc-say">{ev.say}</p>
      </div>
    </div>
  )
}
