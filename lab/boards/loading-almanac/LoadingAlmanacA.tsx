import { m } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ItemPic } from '../../../src/ui/ItemPic'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { CaretLeft, CaretRight, Check, Clock, HandSwipeRight } from '../../../src/ui/glyphs'
import { EASE } from '../../../src/ui/motion'
import { useLessMotion } from '../../../src/ui/still'
import { TIPS, loadView, useLive, useWide, type LoadingState } from '../loading/load'
import { STEPS, stationOf, useStations, useTapOn } from '../loading/steps'
import './LoadingAlmanacA.css'

// A · the farm's almanac, in your hand. While the farm loads, a deck of big cards waits under the thumb — each one thing
// about the game in a picture, a word and one line — and a swipe turns them. The one thing on a web page that answers a
// finger while the page is held for seconds (as the house is built and the graphics warm up) is scrolling: the browser
// scrolls on its own thread. So the deck is a plain scroller that snaps card by card, and everything that moves with it
// — each card leaning and growing as it comes to the middle, its picture sliding in with depth, the dot under the deck —
// is a scroll-driven animation of a transform or an opacity, which the browser also runs off the page's thread. Left
// alone, the deck turns a card by itself now and then (when the page is free). By the thumb, the way: one line and a bar
// cut in three, a part for each real step (../loading/steps.ts), the running part filling fast and then slower, never
// full before its step ends. A returning player (✦, sample data) finds the first card is what waits on the farm.
// Ready: the three parts turn green from left to right, a tick pops at the end, one burst — a tap goes on to the menu.

type Card = { key: string; tone: 'sun' | 'berry' | 'leaf' | 'xp'; pic: string; title: string; text: string }

const TONES: Card['tone'][] = ['sun', 'berry', 'leaf', 'xp']
/** The deck: every tip the loading screen has, and the week's festival (true of the game: src/farm/events.ts). */
const CARDS: Card[] = [
  ...TIPS.map((t, i): Card => ({ key: t.title, tone: TONES[i % 4], pic: t.pic, title: t.title, text: t.text })),
  { key: 'week', tone: 'sun', pic: art('ear-of-corn'), title: 'Festival', text: 'Every Wednesday, crops grow twice as fast.' },
]

export function LoadingAlmanacA({ s, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const live = useLive(s)
  const v = loadView(live)
  const wide = useWide()
  const still = useLessMotion()
  const cur = stationOf(v.step)
  const fill = useStations(v.step, { prop: 'translate', val: (p) => `${(Math.max(0.03, p) - 1) * 100}% 0` }, live.total ? live.loaded / live.total : 0, v.again)
  const away = live.away
  const cards = away ? [{ key: 'away', tone: 'leaf', pic: '', title: 'Waiting for you', text: '' } as Card, ...CARDS] : CARDS
  // the deck: turned by the thumb, or by itself every few seconds while it is left alone
  const deck = useRef<HTMLDivElement>(null)
  const [swiped, setSwiped] = useState(false)
  const touched = useRef(0)
  useEffect(() => {
    const d = deck.current
    if (!d) return
    const hand = () => {
      touched.current = performance.now()
      setSwiped(true)
    }
    d.addEventListener('pointerdown', hand, { passive: true })
    d.addEventListener('wheel', hand, { passive: true })
    const id = setInterval(() => {
      if (still || performance.now() - touched.current < 9000) return
      const card = d.querySelector<HTMLElement>('.la-card')
      if (!card) return
      const step = card.offsetWidth + parseFloat(getComputedStyle(d).columnGap || '0')
      const atEnd = d.scrollLeft + d.clientWidth >= d.scrollWidth - 4
      d.scrollTo({ left: atEnd ? 0 : d.scrollLeft + step, behavior: 'smooth' })
    }, 5200)
    return () => {
      clearInterval(id)
      d.removeEventListener('pointerdown', hand)
      d.removeEventListener('wheel', hand)
    }
  }, [still])
  const turn = (dir: 1 | -1) => {
    const d = deck.current
    const card = d?.querySelector<HTMLElement>('.la-card')
    if (!d || !card) return
    touched.current = performance.now()
    setSwiped(true)
    d.scrollBy({ left: dir * (card.offsetWidth + parseFloat(getComputedStyle(d).columnGap || '0')), behavior: still ? 'auto' : 'smooth' })
  }
  // ready: one burst from the way, once
  const way = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => way.current && burst(way.current, { count: 70, spread: 80, power: 30 }), 520)
    return () => clearTimeout(t)
  }, [v.ready, still])
  useTapOn(v.ready, onPlay)
  return (
    <m.div
      className={`v-loading-almanac-a${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}${swiped ? ' swiped' : ''}`}
      style={{ '--n': cards.length } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <span className="la-bg" aria-hidden="true" />
      <m.header className="la-top" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE.out }}>
        <h1 aria-label="3D Home">3D Home</h1>
        <p className="la-hint">
          <HandSwipeRight weight="fill" aria-hidden="true" />
          {v.ready ? 'Tap to go on' : 'Swipe the cards while you wait'}
        </p>
      </m.header>

      <div className="la-deck-wrap">
        <m.div
          ref={deck}
          className="la-deck"
          role="region"
          aria-label="The farm almanac"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.1 }}
        >
          {cards.map((c, i) => (
            <article key={c.key} className={`la-card ${c.tone}`} aria-label={c.title}>
              <div className="la-art">
                {c.key === 'away' && away ? (
                  <div className="la-away">
                    {away.goods.map((g) => (
                      <ItemPic key={g.item} id={g.item} count={g.count} />
                    ))}
                  </div>
                ) : (
                  <span className="la-pic">
                    <img className="art" src={c.pic} alt="" draggable={false} />
                  </span>
                )}
                <b className="la-num">
                  {i + 1}/{cards.length}
                </b>
              </div>
              <h2>{c.title}</h2>
              <p>{c.key === 'away' && away ? `Gathered while you were away, ${away.ago} ago — and ${away.buyers} buyers at the gate.` : c.text}</p>
            </article>
          ))}
        </m.div>
        <button className="la-arrow left" aria-label="Previous card" onClick={() => turn(-1)}>
          <CaretLeft weight="bold" />
        </button>
        <button className="la-arrow right" aria-label="Next card" onClick={() => turn(1)}>
          <CaretRight weight="bold" />
        </button>
      </div>
      <div className="la-dots" aria-hidden="true">
        {cards.map((c) => (
          <i key={c.key} />
        ))}
        <b className="la-dot-now" />
      </div>

      <m.div ref={way} className="la-way" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32, delay: 0.18 }}>
        <div className="la-line">
          <strong>
            {v.ready && <Check weight="bold" aria-hidden="true" />}
            {v.line}
          </strong>
          {v.left && v.step === 'fetch' && (
            <span className="la-left">
              <Clock weight="bold" aria-hidden="true" /> {v.left}
            </span>
          )}
        </div>
        <div className="la-bar" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.min(3, cur)}>
          {STEPS.map((st, i) => (
            <span key={st} className={`la-part ${i < cur ? 'done' : i === cur ? 'now' : 'later'}`} style={{ '--i': i } as CSSProperties}>
              <i ref={fill(i)} />
            </span>
          ))}
          <b className="la-seal" aria-hidden="true">
            <Check weight="bold" />
          </b>
        </div>
        {v.again && <p className="la-note">Lighter graphics suit this phone.</p>}
      </m.div>
    </m.div>
  )
}
