import { m } from 'motion/react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { freshEvents } from '../../../src/farm/events'
import { newsView } from '../../../src/farm/news/view'
import { ItemPic } from '../../../src/ui/ItemPic'
import { art, type ArtId } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { Check, Clock } from '../../../src/ui/glyphs'
import { EASE } from '../../../src/ui/motion'
import { useLessMotion } from '../../../src/ui/still'
import { loadView, useLive, useWide } from '../loading/load'
import { STEPS, stationOf, useStations, useTapOn } from '../loading/steps'
import type { TodayState } from './index'
import './LoadingTodayA.css'

// A · today's page. The loading screen is the farm's tear-off calendar on a warm table: today's weekday on its red band,
// the date big, and under it what is on at the farm today — or next — by the device's own date (the week's events,
// src/farm/events.ts, in the farm news's own words: src/farm/news/view.ts), so the wait tells something true and new each
// day: "Today: Harvest festival — every crop grows twice as fast, until midnight". The way is a marker circling the
// date: three strokes round it, one for each real step (../loading/steps.ts), each with its picture beside it; the one
// being drawn goes fast and then slower, never closing before its step ends. A mug steams on the table. A returning
// player (✦, sample data) finds a note pinned under the page: what waits on the farm. Its moment: the circle closes, a
// stamp comes down on the page — READY — the pad jolts, one burst; a tap goes on to the menu.
//
// What keeps moving while the page is held: the marker's stroke and its glowing tip, the running step's picture, the
// page's corner lifting in a draught, the mug's steam — all transforms and opacities on the compositor.

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

export function LoadingTodayA({ s, onPlay }: { s: TodayState; onPlay: () => void }) {
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
  // ready: the stamp lands, then one burst from it
  const stamp = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => stamp.current && burst(stamp.current, { count: 70, spread: 100, power: 30 }), 640)
    return () => clearTimeout(t)
  }, [v.ready, still])
  useTapOn(v.ready, onPlay)
  return (
    <m.div
      className={`v-loading-today-a${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <span className="lt-table" aria-hidden="true" />
      <m.header className="lt-name" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE.out }}>
        <h1 aria-label="3D Home">3D Home</h1>
      </m.header>

      <span className="lt-mug" aria-hidden="true">
        <i />
        <i />
        <i />
        <img className="art" src={art('hot-beverage')} alt="" />
      </span>

      <m.div className="lt-pad" initial={{ opacity: 0, y: 40, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -1.5 }} transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.08 }}>
        <div className="lt-jolt">
          <span className="lt-under" aria-hidden="true" />
          <div className="lt-page">
            <span className="lt-rings" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div className="lt-band">{DAYS[day.getDay()]}</div>
            <div className="lt-date">
              <p className="lt-month">{MONTHS[day.getMonth()]}</p>
              <div className="lt-ring" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.min(3, cur)}>
                <svg className="lt-track" viewBox="0 0 100 100" aria-hidden="true">
                  {ARC_FROM.map((a) => (
                    <path key={a} d={arcPath(a, ARC)} />
                  ))}
                </svg>
                <span className="lt-strokes" aria-hidden="true">
                  {STEPS.map((st, i) => (
                    <span key={st} className={`lt-arc ${i < cur ? 'done' : i === cur ? 'now' : 'later'}`} style={{ rotate: `${ARC_FROM[i]}deg` }}>
                      <span className="lt-clip">
                        <i ref={fill(i)}>
                          <b className="lt-tip" />
                        </i>
                      </span>
                    </span>
                  ))}
                </span>
                <strong className="lt-num">{day.getDate()}</strong>
                {STEPS.map((st, i) => (
                  <span key={st} className={`lt-step ${i < cur ? 'done' : i === cur ? 'now' : 'later'}`} style={{ '--a': `${ARC_FROM[i] + ARC / 2}deg`, '--i': i } as CSSProperties} aria-hidden="true">
                    <img className="art" src={art(PIC[st])} alt="" />
                    {i < cur && (
                      <b>
                        <Check weight="bold" />
                      </b>
                    )}
                  </span>
                ))}
              </div>
            </div>
            {ev && !wide && <Happening ev={ev} when={when} until={until} />}
            <span className="lt-curl" aria-hidden="true" />
            <span ref={stamp} className="lt-stamp" aria-hidden="true">
              Ready!
            </span>
          </div>
        </div>
      </m.div>

      <div className="lt-side">
        {ev && wide && <Happening ev={ev} when={when} until={until} />}
        {away && (
          <m.div className="lt-note" initial={{ opacity: 0, y: 16, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 2 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.3 }}>
            <p>On your farm, since {away.ago} ago:</p>
            <div className="lt-goods">
              {away.goods.map((g) => (
                <ItemPic key={g.item} id={g.item} count={g.count} />
              ))}
            </div>
          </m.div>
        )}
        <m.p className="lt-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.3 }}>
          {v.ready && <Check weight="bold" aria-hidden="true" />}
          {v.line}
          {v.left && v.step === 'fetch' && (
            <span className="lt-left">
              <Clock weight="bold" aria-hidden="true" /> {v.left}
            </span>
          )}
          {v.again && <span className="lt-left">Lighter graphics suit this phone.</span>}
        </m.p>
      </div>
    </m.div>
  )
}

/** What is on at the farm today, or next: its picture, when, its name, what it does and until when. */
function Happening({ ev, when, until }: { ev: { name: string; say: string; chip: string; art: ArtId }; when: string; until: string }) {
  return (
    <div className="lt-today">
      <img className="art" src={art(ev.art)} alt="" />
      <div>
        <p className="lt-when">
          {when} · <span>{until}</span>
        </p>
        <p className="lt-ev">
          {ev.name} <b className="lt-chip">{ev.chip}</b>
        </p>
        <p className="lt-say">{ev.say}</p>
      </div>
    </div>
  )
}
