import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { DiceFive } from '@phosphor-icons/react/dist/csr/DiceFive'
import { animate, AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { art } from '../../../src/ui/art'
import { ArrowRight } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ago, FARM_NAMES, farmOf, NEW_NAMES, WHATS_NEW, type Farm, type IntroState } from './data'
import { Backdrop, CreditsBody, FarmList, MenuTiles, Sheet, SettingsBody, Star, type Menu } from './shared'
import './IntroA.css'

// A · the game's opening screen, round 4: the first screen of the game, from the moment the page opens until you go into
// the farm. Everything an opening screen has, each in its place: the game's name and picture over the farm (1), your
// farm — its level, coins and what is ready, in pictures — for a returning player (2), the one big button (3): while the
// game loads it is the loading bar itself ("Loading 62%", filling), then Play for a new player or Continue for one coming
// back; the menu (4): Farms (the saved farms), Music (on/off), Settings, Credits; and at the foot (5) the device, the
// graphics and the game's version. Sideways the name stands on the left and the card on the right. Its moment: the
// letters drop in and bounce, the sun behind them opens; the bar in the button fills and turns into Play with a pop; a
// press sends the name up and the card down while the scene pulls back into play.
//
// D is the same screen with features the game does not have (`extras`): each farm has a name (a new one is given one
// with a roll of the dice, and it can be changed), and a "What's new" note in the corner tells a returning player what
// came into the game since they last played (./data.ts, sample data).

const NAME = '3D Home'.split('')
const MOST = 4 // goods shown in the dock; the rest is a "+n"
const VERSION = 'v0.1' // package.json's version: the game does not show it yet

const letter = {
  hidden: { opacity: 0, y: -46, scale: 0.6 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop },
  gone: { opacity: 0, y: -30, transition: { duration: 0.18, ease: 'easeIn' } },
} as const

const POP = { hidden: { opacity: 0, scale: 0.4, y: 8 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } } as const

/** A farm's name: its own (D), or its place's number. */
const nameOf = (f: Farm, extras: boolean) => (extras && f.exists ? FARM_NAMES[f.slot] : `Farm ${f.slot}`)

function Dock({ f, farms, extras, onFarms }: { f: Farm; farms: number; extras: boolean; onFarms: () => void }) {
  const w = f.waiting
  const goods = w?.goods ?? []
  const more = goods.length - MOST
  return (
    <div className="ia-farm">
      <m.button className="ia-farm-name" onClick={onFarms} aria-label={`${nameOf(f, extras)}: your farms`} {...PRESS}>
        <Star level={f.level} />
        <span>
          <strong>{nameOf(f, extras)}</strong>
          <small className={w ? 'ia-away' : ''}>{w ? `${ago(w.seconds)} away` : `${farms} farm${farms === 1 ? '' : 's'}`}</small>
        </span>
        {farms > 1 && <b className="ia-count">{farms}</b>}
        <CaretDown weight="bold" />
      </m.button>
      <span className="tag ia-coins">
        <img src={art('coin')} alt="" />
        {f.coins.toLocaleString('en-US')}
      </span>
      {w && (
        <m.div className="ia-ready" aria-label="Ready on your farm" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.045, delayChildren: 0.42 } } }}>
          {goods.slice(0, MOST).map((g) => (
            <m.span key={g.item} variants={POP}>
              <ItemPic id={g.item} count={g.count} />
            </m.span>
          ))}
          {more > 0 && (
            <m.span className="ia-more" variants={POP}>
              +{more}
            </m.span>
          )}
          {w.buyers > 0 && (
            <m.span className="item-pic ia-buyers" variants={POP} aria-label={`${w.buyers} buyers at the gate`}>
              <img className="art" src={art('people-queue')} alt="" />
              <b className="qty">{w.buyers}</b>
            </m.span>
          )}
        </m.div>
      )}
    </div>
  )
}

/** D: a new farm's name, on a sign over the button: a roll of the dice gives another, and it can be typed. */
function NameSign() {
  const [i, setI] = useState(0)
  const [name, setName] = useState(NEW_NAMES[0])
  const [spin, setSpin] = useState(0)
  const roll = () => {
    const n = (i + 1) % NEW_NAMES.length
    setI(n)
    setName(NEW_NAMES[n])
    setSpin((x) => x + 1)
  }
  return (
    <label className="ia-sign">
      <small>Your farm</small>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.input
          key={spin}
          className="ia-sign-name"
          value={name}
          maxLength={18}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your farm's name"
          initial={{ opacity: 0, rotateX: -80 }}
          animate={{ opacity: 1, rotateX: 0 }}
          exit={{ opacity: 0, rotateX: 80, transition: { duration: 0.12 } }}
          transition={SPRING.pop}
        />
      </AnimatePresence>
      <m.button type="button" className="ia-dice" onClick={roll} aria-label="Another name" whileTap={{ scale: 0.85, rotate: 90 }} transition={SPRING.pop}>
        <DiceFive weight="fill" />
      </m.button>
    </label>
  )
}

/** The big button: while the game loads, the loading bar itself (its fill and its share); then Play or Continue. */
function GoButton({ back, f, load, going, onGo, extras }: { back: boolean; f: Farm; load: number; going: boolean; onGo: () => void; extras: boolean }) {
  const ready = load >= 1
  const word = back ? 'Continue' : 'Play'
  return (
    <m.button
      className={`btn primary ia-go${going ? ' going' : ''}${ready ? '' : ' loading'}`}
      onClick={ready ? onGo : undefined}
      aria-disabled={!ready}
      aria-label={ready ? (back ? `Continue · ${nameOf(f, extras)}` : 'Play') : `Loading ${Math.round(load * 100)}%`}
      whileTap={ready ? { scale: 0.95, y: 3 } : undefined}
      animate={going ? { scale: [0.95, 1.06, 1], transition: { duration: 0.3, ease: EASE.out } } : undefined}
      transition={SPRING.pop}
    >
      {!ready && <span className="ia-go-fill" style={{ width: `${load * 100}%` }} aria-hidden="true" />}
      <AnimatePresence mode="popLayout" initial={false}>
        {ready ? (
          <m.span key="go" className="ia-go-words" initial={{ opacity: 0, scale: 0.5, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
            {word}
            <ArrowRight weight="bold" />
          </m.span>
        ) : (
          <m.span key="load" className="ia-go-words" exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.15 } }}>
            Loading <b>{Math.round(load * 100)}%</b>
          </m.span>
        )}
      </AnimatePresence>
    </m.button>
  )
}

export function IntroA({ s, act, extras = false }: { s: IntroState; act: Act<IntroState>; extras?: boolean }) {
  const f = farmOf(s)
  const back = f.played
  const still = useReducedMotion()
  const [sheet, setSheet] = useState<Menu | 'new' | null>(null)
  const count = s.farms.filter((x) => x.exists).length
  const [going, setGoing] = useState(false)
  const [load, setLoad] = useState(s.load ?? 1)
  // the lab's loading goes on to the end by itself, as the game's would
  useEffect(() => {
    if ((s.load ?? 1) >= 1) return
    if (still) {
      const t = setTimeout(() => setLoad(1), 2600)
      return () => clearTimeout(t)
    }
    const run = animate(s.load ?? 1, 1, { duration: 3.2, ease: 'linear', delay: 0.6, onUpdate: setLoad })
    return () => run.stop()
  }, [s.load, still])
  const go = () => {
    if (going) return
    setGoing(true)
    setTimeout(act.close, 150)
  }
  return (
    <div className={`v-intro-a${extras ? ' v-intro-d' : ''}`}>
      <Backdrop />
      <m.span
        className="ia-sun"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ delay: 0.25, duration: 0.8, ease: EASE.out }}
      >
        <i />
      </m.span>
      {extras && back && (
        <m.button
          className="ia-news"
          onClick={() => setSheet('new')}
          initial={{ opacity: 0, y: -20, rotate: -8 }}
          animate={{ opacity: 1, y: 0, rotate: -4 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ ...SPRING.pop, delay: 0.9 }}
          whileTap={{ scale: 0.92 }}
          aria-label="What's new in the game"
        >
          <img className="art" src={art('sparkles')} alt="" />
          What's new
          <i className="ia-news-dot" aria-hidden="true" />
        </m.button>
      )}
      <m.div
        className="ia-logo"
        initial="hidden"
        animate="shown"
        exit="gone"
        variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.16 } }, gone: { transition: { staggerChildren: 0.02 } } }}
      >
        <m.div
          className="ia-house"
          variants={{
            hidden: { opacity: 0, scale: 0.3, y: 30 },
            shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.soft },
            gone: { opacity: 0, y: -60, scale: 0.8, transition: { duration: 0.22, ease: 'easeIn' } },
          }}
        >
          <img className="art" src={art('house-with-garden')} alt="" />
        </m.div>
        <h1 aria-label="3D Home">
          {NAME.map((c, i) => (
            <m.span key={i} variants={letter} aria-hidden="true">
              {c}
            </m.span>
          ))}
        </h1>
        <m.p variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE.out } }, gone: { opacity: 0, transition: { duration: 0.12 } } }}>
          {back ? `Welcome back to ${nameOf(f, extras)}` : 'A cosy house and farm'}
        </m.p>
      </m.div>
      <div className="ia-bottom">
        <m.div
          className="ia-dock paper"
          initial={{ opacity: 0, y: 70 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 90, transition: { duration: 0.24, ease: 'easeIn' } }}
          transition={{ ...SPRING.sheet, delay: 0.1 }}
        >
          {back ? <Dock f={f} farms={count} extras={extras} onFarms={() => setSheet('farms')} /> : extras ? <NameSign /> : null}
          <GoButton back={back} f={f} load={load} going={going} onGo={go} extras={extras} />
          <MenuTiles onOpen={setSheet} farms={count} />
        </m.div>
        <m.p className="ia-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.5, duration: 0.3 }}>
          Phone · graphics auto · {VERSION}
        </m.p>
      </div>
      <Sheet open={sheet === 'farms'} title="Your farms" pic={art('house-with-garden')} onClose={() => setSheet(null)}>
        <FarmList
          s={s}
          onSet={act.set}
          onPick={(slot) => {
            act.set({ ...s, slot })
            setSheet(null)
          }}
        />
      </Sheet>
      <Sheet open={sheet === 'settings'} title="Settings" pic={art('gear')} onClose={() => setSheet(null)}>
        <SettingsBody />
      </Sheet>
      <Sheet open={sheet === 'credits'} title="Credits" pic={art('sparkles')} onClose={() => setSheet(null)}>
        <CreditsBody />
      </Sheet>
      <Sheet open={sheet === 'new'} title="What's new" pic={art('sparkles')} onClose={() => setSheet(null)}>
        <m.ul className="ia-news-list" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}>
          {WHATS_NEW.map((n) => (
            <m.li key={n.title} variants={POP}>
              <img className="art" src={art(n.art)} alt="" />
              <span>
                <b>{n.title}</b>
                {n.line}
              </span>
            </m.li>
          ))}
        </m.ul>
      </Sheet>
    </div>
  )
}
