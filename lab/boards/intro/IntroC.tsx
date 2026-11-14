import { m, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { art } from '../../../src/ui/art'
import { ArrowRight, GearSix } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ago, farmOf, isCrop, type Farm, type IntroState } from './data'
import { MusicNotes } from '@phosphor-icons/react/dist/csr/MusicNotes'
import { Backdrop, FarmList, Sheet, SettingsBody, Star } from './shared'
import './IntroC.css'

// C · the road: a short road across a card, from where you left to the big button. A returning player's road has what
// happened while away as stops on it — what ripened, what the animals gave, who waits at the gate — and ends in
// Continue; a new player's road is the farm's own loop in four pictures (plant, water, harvest, sell) ending in Play,
// so the first screen already says what the game is. The farms, the music and the settings are a quiet row of labelled
// buttons under it. Its moment: the road draws itself to the button and each stop pops as the road reaches it; on the
// press the stops hop one after another towards the button, like a wave running into the farm. Every rule of its CSS
// is under .v-intro-c.

const DRAW = 0.6 // s: the road drawing itself
const START = 0.2 // s: when it starts
const AT = [0.13, 0.38, 0.63, 0.88] // where the four stops stand along the road

interface Stop {
  key: string
  pic: ReactNode
  word: string
}

/** The stops of a farm's road: three goods that came ready (or two and "+n"), then the buyers at the gate; a new farm's
 *  loop when nothing has been played. */
function stops(f: Farm): Stop[] {
  const w = f.waiting
  if (!f.played)
    return [
      { key: 'plant', pic: <img className="art" src={art('seedling')} alt="" />, word: 'Plant' },
      { key: 'water', pic: <img className="art" src={art('droplet')} alt="" />, word: 'Water' },
      { key: 'harvest', pic: <img className="art" src={art('sheaf-of-rice')} alt="" />, word: 'Harvest' },
      { key: 'sell', pic: <img className="art" src={art('coin')} alt="" />, word: 'Sell' },
    ]
  const goods = w?.goods ?? []
  const room = w && w.buyers > 0 ? 3 : 4
  const out: Stop[] = goods.slice(0, room).map((g) => ({ key: g.item, pic: <ItemPic id={g.item} count={g.count} />, word: isCrop(g.item) ? 'ripe' : 'ready' }))
  const rest = goods.length - room
  if (rest > 0) out[out.length - 1] = { key: 'more', pic: <span className="ic-more">+{rest + 1}</span>, word: 'more' }
  if (w && w.buyers > 0)
    out.push({
      key: 'gate',
      pic: (
        <span className="item-pic">
          <img className="art" src={art('people-queue')} alt="" />
          <b className="qty">{w.buyers}</b>
        </span>
      ),
      word: 'at the gate',
    })
  return out
}

/** The road's line across a box `w` wide: a gentle wave through the stops. */
const yAt = (x: number, w: number) => 34 + 12 * Math.sin((x / w) * Math.PI * 2.2 - 0.9)
function roadPath(w: number) {
  const pts: string[] = []
  for (let x = 14; x <= w - 14; x += 6) pts.push(`${x.toFixed(1)},${yAt(x, w).toFixed(1)}`)
  return `M${pts.join(' L')}`
}

function Road({ f, going }: { f: Farm; going: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  const still = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setW(el.clientWidth)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // the press: each stop hops in turn, towards the button
  useEffect(() => {
    if (!going || still || !scope.current) return
    void animate('.ic-stop-pic', { y: [0, -14, 0], scale: [1, 1.12, 1] }, { duration: 0.26, delay: (i) => i * 0.05, ease: EASE.out })
  }, [going, still, animate, scope])
  const list = stops(f)
  const n = list.length
  const at = n === 4 ? AT : n === 3 ? [0.17, 0.5, 0.83] : n === 2 ? [0.3, 0.7] : [0.5]
  return (
    <div className="ic-road" ref={box}>
      <svg className="ic-line" width={w} height={70} aria-hidden="true">
        <m.path d={roadPath(w)} className="ic-bed" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: START, duration: DRAW, ease: 'linear' }} />
        <m.path d={roadPath(w)} className="ic-dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: START + DRAW, duration: 0.3 }} />
      </svg>
      <div ref={scope} className="ic-stops">
        {list.map((s, i) => (
          <div key={s.key} className="ic-stop" style={{ left: at[i] * w, top: yAt(at[i] * w, w) }}>
            <m.span className="ic-stop-pic" initial={still ? { opacity: 0 } : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: START + DRAW * at[i] }}>
              {s.pic}
            </m.span>
            <m.small initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: START + DRAW * at[i] + 0.1, duration: 0.2 }}>
              {s.word}
            </m.small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function IntroC({ s, act }: { s: IntroState; act: Act<IntroState> }) {
  const f = farmOf(s)
  const back = f.played
  const [sheet, setSheet] = useState<'farms' | 'settings' | null>(null)
  const [going, setGoing] = useState(false)
  const [music, setMusic] = useState(false)
  const go = () => {
    if (going) return
    setGoing(true)
    setTimeout(act.close, 300)
  }
  const farms = s.farms.filter((x) => x.exists).length
  return (
    <div className="v-intro-c">
      <Backdrop />
      <m.div
        className="ic-logo"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, y: -40, transition: { duration: 0.22, ease: 'easeIn' } }}
        transition={SPRING.soft}
      >
        <img className="art" src={art('house-with-garden')} alt="" />
        <h1>3D Home</h1>
      </m.div>
      <m.div
        className="ic-low"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80, transition: { duration: 0.24, ease: 'easeIn' } }}
        transition={{ ...SPRING.sheet, delay: 0.08 }}
      >
        <section className="ic-card paper" aria-label={back ? `Farm ${f.slot}` : 'Your farm'}>
          <header className="ic-head">
            {back ? <Star level={f.level} /> : <img className="art ic-head-art" src={art('sunrise')} alt="" />}
            <span className="ic-head-text">
              <strong>{back ? `Farm ${f.slot}` : 'Your first day'}</strong>
              <small>{back ? (f.waiting ? `${ago(f.waiting.seconds)} away` : 'all quiet') : 'A cosy house and farm'}</small>
            </span>
            <span className="tag ic-coins">
              <img src={art('coin')} alt="" />
              {f.coins.toLocaleString('en-US')}
            </span>
          </header>
          <Road key={f.slot} f={f} going={going} />
          <m.button
            className={`btn primary ic-go${going ? ' going' : ''}`}
            onClick={go}
            aria-label={back ? `Continue · Farm ${f.slot}` : 'Play'}
            whileTap={{ scale: 0.95, y: 3 }}
            transition={SPRING.pop}
          >
            <span>{back ? 'Continue' : 'Play'}</span>
            <ArrowRight weight="bold" />
          </m.button>
        </section>
        <nav className="ic-quiet" aria-label="More">
          <m.button onClick={() => setSheet('farms')} {...PRESS}>
            <img src={art('floppy-disk')} alt="" />
            Farms{farms > 1 && <b>{farms}</b>}
          </m.button>
          <m.button className={music ? 'on' : ''} aria-pressed={music} onClick={() => setMusic(!music)} {...PRESS}>
            <MusicNotes weight="fill" />
            Music
            <span className="v-intro-eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </m.button>
          <m.button onClick={() => setSheet('settings')} {...PRESS}>
            <GearSix weight="fill" />
            Settings
          </m.button>
        </nav>
      </m.div>
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
    </div>
  )
}
