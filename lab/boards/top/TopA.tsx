import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { ArrowsOutCardinal, GearSix } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { CountUp, EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { Compass, Num, Opens, SaleStandIn, topView, usePurse, type HudView, type TopState } from './parts'
import './TopA.css'

// A · one row and a drawer: the top is one row — the coins (the hero), the level with its bar, its number and the next
// level's prize at the end, and in the corner the farm's day (its picture and the hour) — and the compass under it.
// Everything else (the line, the silo, the barn, the goals, and the three corner buttons of today, with words) is in
// one drawer that drops from the day's chip; a dot on the chip says something in there needs you. In "only the
// compass" and "clear", the chip shrinks to a round button in the same corner, which opens the same drawer.

const row = { hidden: {}, shown: { transition: { staggerChildren: 0.045 } } }
const chip = { hidden: { opacity: 0, scale: 0.8, y: -6 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }

const VIEWS: { id: HudView; word: string }[] = [
  { id: 'all', word: 'All' },
  { id: 'compass', word: 'Compass' },
  { id: 'clean', word: 'Clear' },
]

export function TopA({ s, set }: { s: TopState; set: (s: TopState) => void }) {
  const v = topView(s)
  const lv = v.lv
  const still = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [coinChip, animateCoin] = useAnimate()
  const [open, setOpen] = useState(false)
  const [opens, setOpens] = useState<string | null>(null)
  const [plus, setPlus] = useState(0)
  const purse = usePurse(s.coins, (last) => {
    if (still) return
    // each coin landing squashes the chip's coin; the last lights its rim and shows how many came
    void animateCoin('img', { scaleX: [1, 1.22, 1], scaleY: [1, 0.78, 1] }, { duration: 0.22, ease: EASE.out })
    if (last) {
      void animateCoin(coinChip.current, { scale: [1, 1.1, 1] }, { duration: 0.32, ease: EASE.pop })
      setPlus((n) => n + 1)
    }
  })
  const all = s.hud === 'all'
  const need = v.needs.length ? (v.needs.some((n) => n.tone === 'berry') ? 'berry' : 'leaf') : null
  const prize = lv.unpaid ? (
    <m.span className="v-top-a-prize claim" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: 0.32 }}>
      <img className="art" src={art('coin')} alt="" />
      <b>{lv.unpaid}</b>
    </m.span>
  ) : lv.top ? null : (
    <span className="v-top-a-prize" title={`Level ${lv.level + 1} brings`}>
      {lv.gift ? <GarmentPic g={lv.gift} /> : <img className="art" src={art('coin')} alt="" />}
      {!lv.gift && <b>{lv.nextCoins}</b>}
    </span>
  )
  return (
    <div className={`v-top-a hud-${s.hud}`} ref={root}>
      <m.div className="v-top-a-row" variants={row} initial="hidden" animate="shown" key={s.hud}>
        {all && (
          <m.span className="v-top-a-coins" variants={chip} ref={coinChip}>
            <img src={art('coin')} alt="" data-coin-target />
            <b>
              <Num v={purse.text} />
            </b>
            <AnimatePresence>
              {plus > 0 && (
                <m.span
                  key={plus}
                  className="v-top-a-plus"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [4, -2, -10, -18] }}
                  transition={{ duration: 1.1, times: [0, 0.15, 0.7, 1] }}
                >
                  +24
                </m.span>
              )}
            </AnimatePresence>
          </m.span>
        )}
        {all && (
          <m.button
            className={`v-top-a-level${lv.unpaid ? ' ready' : ''}`}
            variants={chip}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpens('כרטיס הרמה')}
            aria-label={lv.unpaid ? `Level ${lv.level}: ${lv.unpaid} coins to claim` : `Level ${lv.level}: ${lv.into} of ${lv.need} XP to level ${lv.level + 1}`}
          >
            <span className="v-top-a-star">
              <img src={art('glowing-star')} alt="" />
              <b>{lv.level}</b>
            </span>
            <span className="v-top-a-bar" role="progressbar" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into}>
              <m.span
                className="v-top-a-fill"
                initial={{ width: still ? `${(lv.into / lv.need) * 100}%` : '0%' }}
                animate={{ width: `${(lv.into / lv.need) * 100}%` }}
                transition={{ delay: 0.22, duration: 0.6, ease: EASE.out }}
              />
              <span className="v-top-a-xp">
                {lv.top ? (
                  'Top'
                ) : (
                  <>
                    <CountUp to={lv.into} duration={0.6} />/{lv.need}
                  </>
                )}
              </span>
            </span>
            {prize}
          </m.button>
        )}
        {!all && <span className="v-top-a-balance" />}
        {s.hud !== 'clean' && (
          <m.div className="v-top-a-compass" variants={chip}>
            <Compass heading={s.heading} marks={s.marks} scale={{ letters: true, mid: false, nums: true }} className="v-top-a-strip">
              <span className="v-top-a-heading">{s.heading}°</span>
            </Compass>
          </m.div>
        )}
        {all ? (
          <m.button className="v-top-a-day" variants={chip} {...PRESS} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${v.phaseName}, ${v.hour} — the farm and the menu`}>
            <img src={art(v.phaseArt)} alt="" />
            <b>{v.hour}</b>
            {need && (
              <m.i className={`v-top-a-dot ${need}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: 0.4 }}>
                {v.needs.length}
              </m.i>
            )}
          </m.button>
        ) : (
          <m.button className="v-top-a-round" variants={chip} {...PRESS} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="The farm and the menu">
            <img src={art(v.phaseArt)} alt="" />
            {need && <i className={`v-top-a-dot ${need}`}>{v.needs.length}</i>}
          </m.button>
        )}
      </m.div>
      <AnimatePresence>
        {open && (
          <>
            <m.div key="away" className="v-top-a-away" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <m.div
              key="drawer"
              className="v-top-a-drawer paper"
              role="dialog"
              aria-label="The farm"
              initial={{ opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={SPRING.sheet}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.5, bottom: 0.05 }}
              onDragEnd={(_, i) => (i.offset.y < -40 || i.velocity.y < -400) && setOpen(false)}
            >
              <header className="v-top-a-head">
                <img src={art(v.phaseArt)} alt="" />
                <h2>
                  {v.phaseName} · {v.hour}
                </h2>
                <span className="tag">Day {v.day}</span>
              </header>
              <m.ul className="v-top-a-list" initial="hidden" animate="shown" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } } }}>
                {v.line && (
                  <Row
                    pic={<img className="art" src={art('people-queue')} alt="" />}
                    name="Line at the gate"
                    n={v.line.n}
                    of={v.line.of}
                    tone={v.line.full ? 'leaf' : ''}
                    note={v.line.full ? 'Full' : ''}
                    onTap={() => setOpens('התור בשער')}
                  />
                )}
                <Row pic={<ItemPic id="silo" />} name="Silo" n={v.silo.n} of={v.silo.cap} tone={v.silo.full ? 'berry' : ''} note={v.silo.full ? 'Full' : ''} onTap={() => setOpens('הממגורה')} />
                <Row pic={<ItemPic id="barn" />} name="Barn" n={v.barn.n} of={v.barn.cap} tone={v.barn.full ? 'berry' : ''} note={v.barn.full ? 'Full' : ''} onTap={() => setOpens('האסם')} />
                <Row
                  pic={<img className="art" src={art('trophy')} alt="" />}
                  name="Goals"
                  n={v.goals}
                  tone={v.goals ? 'leaf' : ''}
                  note={v.goals ? `${v.goals} to claim` : 'On the way'}
                  onTap={() => setOpens('לוח המטרות')}
                />
              </m.ul>
              <div className="v-top-a-views">
                <span>Top of the screen</span>
                <ToggleGroup.Root type="single" value={s.hud} onValueChange={(h) => h && set({ ...s, hud: h as HudView })} className="v-top-a-toggle" aria-label="Top of the screen">
                  {VIEWS.map((x) => (
                    <ToggleGroup.Item key={x.id} value={x.id} className="v-top-a-toggle-item">
                      {x.word}
                    </ToggleGroup.Item>
                  ))}
                </ToggleGroup.Root>
              </div>
              <div className="v-top-a-actions">
                <m.button className="btn soft small" {...PRESS} onClick={() => setOpens('מצב עריכה')}>
                  <ArrowsOutCardinal weight="bold" /> Edit the farm
                </m.button>
                <m.button className="btn soft small" {...PRESS} onClick={() => setOpens('ההגדרות')}>
                  <GearSix weight="bold" /> Settings
                </m.button>
              </div>
              <span className="v-top-a-grip" aria-hidden="true" />
            </m.div>
          </>
        )}
      </AnimatePresence>
      <SaleStandIn onSell={(from) => purse.pay(24, from, root.current)} />
      <AnimatePresence>{opens && <Opens what={opens} onDone={() => setOpens(null)} />}</AnimatePresence>
    </div>
  )
}

const item = { hidden: { opacity: 0, x: 12 }, shown: { opacity: 1, x: 0, transition: SPRING.pop } }

/** One of the farm's numbers in the drawer: its picture, its name, how many (of how many, as a bar), a word if full. */
function Row({ pic, name, n, of, tone, note, onTap }: { pic: ReactNode; name: string; n: number; of?: number; tone: string; note?: string; onTap: () => void }) {
  return (
    <m.li variants={item}>
      <m.button className={`v-top-a-item ${tone}`} {...PRESS} onClick={onTap}>
        <span className="v-top-a-pic">{pic}</span>
        <span className="v-top-a-what">
          <span className="v-top-a-name">{name}</span>
          {of !== undefined ? (
            <span className="v-top-a-gauge">
              <m.i initial={{ width: 0 }} animate={{ width: `${Math.min(1, n / of) * 100}%` }} transition={{ delay: 0.2, duration: 0.5, ease: EASE.out }} />
            </span>
          ) : null}
        </span>
        <span className="v-top-a-count">
          {of !== undefined ? (
            <>
              {n}
              <small>/{of}</small>
            </>
          ) : null}
          {note && <em>{note}</em>}
        </span>
      </m.button>
    </m.li>
  )
}
