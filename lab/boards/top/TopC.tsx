import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { Popover } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { ArrowsOutCardinal, CompassRose, EyeSlash, GearSix, SquaresFour, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { List } from '@phosphor-icons/react/dist/csr/List'
import { Compass, Num, Opens, SaleStandIn, topView, usePurse, type HudView, type TopState } from './parts'
import './TopC.css'

// C · a dashboard: nothing hidden, but everything as a small picture that shows its state. The compass in the middle
// with two wings: on the left the silo and the barn, each a tank that fills (green, then sun, then red and shaking once
// when full); on the right the line at the gate and the goals, with their counts. Above, the coins (the hero) and the
// level as a short road from your star to the next level and its prize, with the XP still to go written on it. A
// gauge tapped tells its exact number in a bubble. The corner's menu opens into three buttons with their names.

const NEXT: Record<HudView, HudView> = { all: 'compass', compass: 'clean', clean: 'all' }
const VIEW_WORD: Record<HudView, string> = { all: 'All', compass: 'Compass', clean: 'Clear' }

export function TopC({ s, set }: { s: TopState; set: (s: TopState) => void }) {
  const v = topView(s)
  const lv = v.lv
  const still = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [coins, animateCoins] = useAnimate()
  const [menu, setMenu] = useState(false)
  const [opens, setOpens] = useState<string | null>(null)
  const purse = usePurse(s.coins, (last) => {
    if (still) return
    void animateCoins('img', { y: [0, 3, 0], scaleY: [1, 0.8, 1] }, { duration: 0.2, ease: EASE.out })
    if (last) {
      // the chip pops and a light crosses it once
      void animateCoins(coins.current, { scale: [1, 1.12, 1] }, { duration: 0.35, ease: EASE.pop })
      void animateCoins('.v-top-c-shine', { x: ['-120%', '260%'], opacity: [0, 1, 0] }, { duration: 0.6, ease: 'easeOut' })
    }
  })
  const all = s.hud === 'all'
  const k = lv.into / lv.need
  return (
    <div className={`v-top-c hud-${s.hud}`} ref={root}>
      <div className="v-top-c-row">
        {all && (
          <m.span className="v-top-c-coins" ref={coins} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.05 }}>
            <img src={art('coin')} alt="" data-coin-target />
            <b>
              <Num v={purse.text} />
            </b>
            <m.i className="v-top-c-shine" initial={{ opacity: 0 }} aria-hidden="true" />
          </m.span>
        )}
        {all && (
          <m.button
            className={`v-top-c-road${lv.unpaid ? ' ready' : ''}`}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.pop, delay: 0.1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setOpens('כרטיס הרמה')}
            aria-label={lv.unpaid ? `Level ${lv.level}: ${lv.unpaid} coins to claim` : `Level ${lv.level}: ${lv.need - lv.into} XP to level ${lv.level + 1}`}
          >
            <span className="v-top-c-star">
              <img src={art('glowing-star')} alt="" />
              <b>{lv.level}</b>
            </span>
            <span className="v-top-c-way">
              <span className="v-top-c-togo">{lv.top ? 'Top level' : lv.unpaid ? 'Claim!' : `${lv.need - lv.into} XP to go`}</span>
              <span className="v-top-c-track" role="progressbar" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into}>
                <m.i className="v-top-c-fill" initial={{ width: still ? `${k * 100}%` : '0%' }} animate={{ width: `${k * 100}%` }} transition={{ delay: 0.3, duration: 0.7, ease: EASE.out }}>
                  <span className="v-top-c-head" />
                </m.i>
              </span>
            </span>
            {lv.unpaid ? (
              <m.span className="v-top-c-claim" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.pop, delay: 0.5 }}>
                <img src={art('coin')} alt="" />
                {lv.unpaid}
              </m.span>
            ) : lv.top ? null : (
              <span className="v-top-c-next">
                <i>{lv.level + 1}</i>
                <span className="v-top-c-prize">{lv.gift ? <GarmentPic g={lv.gift} /> : <img className="art" src={art('coin')} alt="" />}</span>
              </span>
            )}
          </m.button>
        )}
        {s.hud !== 'clean' && (
          <div className="v-top-c-dash">
            {all && (
              <m.div className="v-top-c-wing left" initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.pop, delay: 0.14 }}>
                <Gauge pic={<ItemPic id="silo" />} name="Silo" n={v.silo.n} of={v.silo.cap} k={v.silo.k} full={v.silo.full} onOpen={() => setOpens('הממגורה')} />
                <Gauge pic={<ItemPic id="barn" />} name="Barn" n={v.barn.n} of={v.barn.cap} k={v.barn.k} full={v.barn.full} onOpen={() => setOpens('האסם')} />
              </m.div>
            )}
            <m.div className="v-top-c-mid" initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={SPRING.sheet}>
              <Compass heading={s.heading} marks={s.marks} span={70} scale={{ letters: true, mid: true, nums: false }} className="v-top-c-strip">
                <span className="v-top-c-hour">
                  <img src={art(v.phaseArt)} alt="" />
                  {v.hour}
                </span>
              </Compass>
            </m.div>
            {all && (
              <m.div className="v-top-c-wing right" initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.pop, delay: 0.14 }}>
                {v.line ? (
                  <Gauge
                    pic={<img className="art" src={art('people-queue')} alt="" />}
                    name="Line at the gate"
                    n={v.line.n}
                    of={v.line.of}
                    k={v.line.n / v.line.of}
                    count={v.line.n}
                    good={v.line.full}
                    onOpen={() => setOpens('התור בשער')}
                  />
                ) : (
                  <span className="v-top-c-slot" />
                )}
                <Gauge
                  pic={<img className="art" src={art('trophy')} alt="" />}
                  name="Goals"
                  n={v.goals}
                  count={v.goals || undefined}
                  good={v.goals > 0}
                  quiet={!v.goals}
                  onOpen={() => setOpens('לוח המטרות')}
                />
              </m.div>
            )}
          </div>
        )}
        <div className="v-top-c-menu">
          <m.button className={`v-top-c-menu-btn${menu ? ' on' : ''}`} {...PRESS} onClick={() => setMenu((o) => !o)} aria-expanded={menu} aria-label="Menu: edit, the top's view, settings">
            {menu ? <X weight="bold" /> : <List weight="bold" />}
          </m.button>
          <AnimatePresence>
            {menu && (
              <m.ul
                className="v-top-c-dial"
                initial="shut"
                animate="open"
                exit="shut"
                variants={{ open: { transition: { staggerChildren: 0.045 } }, shut: { transition: { staggerChildren: 0.03, staggerDirection: -1 } } }}
              >
                <Dial icon={<ArrowsOutCardinal weight="bold" />} word="Edit the farm" onTap={() => setOpens('מצב עריכה')} />
                <Dial
                  icon={s.hud === 'all' ? <SquaresFour weight="bold" /> : s.hud === 'compass' ? <CompassRose weight="bold" /> : <EyeSlash weight="bold" />}
                  word={`Top: ${VIEW_WORD[s.hud]}`}
                  onTap={() => set({ ...s, hud: NEXT[s.hud] })}
                />
                <Dial icon={<GearSix weight="bold" />} word="Settings" onTap={() => setOpens('ההגדרות')} />
              </m.ul>
            )}
          </AnimatePresence>
        </div>
      </div>
      <SaleStandIn onSell={(from) => purse.pay(24, from, root.current)} />
      <AnimatePresence>{opens && <Opens what={opens} onDone={() => setOpens(null)} />}</AnimatePresence>
    </div>
  )
}

const dial = { shut: { opacity: 0, y: -14, scale: 0.6 }, open: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop } }

function Dial({ icon, word, onTap }: { icon: ReactNode; word: string; onTap: () => void }) {
  return (
    <m.li variants={dial}>
      <m.button className="v-top-c-dial-btn" {...PRESS} onClick={onTap}>
        <span className="v-top-c-dial-word">{word}</span>
        <span className="v-top-c-dial-icon">{icon}</span>
      </m.button>
    </m.li>
  )
}

/**
 * A gauge: a tank its picture stands in, filled as far as it is full (from empty as it comes in, with a little wave);
 * full, it turns red and shakes once. A count where it has one. A tap tells its number in a bubble, with a way to open it.
 */
function Gauge({
  pic,
  name,
  n,
  of,
  k,
  count,
  full,
  good,
  quiet,
  onOpen,
}: {
  pic: ReactNode
  name: string
  n: number
  of?: number
  k?: number
  count?: number
  full?: boolean
  good?: boolean
  quiet?: boolean
  onOpen: () => void
}) {
  const tone = full ? 'full' : good ? 'good' : (k ?? 0) >= 0.8 ? 'high' : ''
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <m.button
          className={`v-top-c-gauge ${tone}${quiet ? ' quiet' : ''}`}
          aria-label={of ? `${name}: ${n} of ${of}${full ? ', full' : ''}` : `${name}: ${n}`}
          whileTap={{ scale: 0.9 }}
          animate={full ? { x: [0, -4, 4, -3, 3, 0] } : undefined}
          transition={full ? { delay: 0.75, duration: 0.45 } : SPRING.pop}
        >
          {k !== undefined && <m.i className="v-top-c-tank" initial={{ scaleY: 0 }} animate={{ scaleY: Math.max(0.04, Math.min(1, k)) }} transition={{ ...SPRING.soft, delay: 0.3 }} />}
          <span className="v-top-c-gauge-pic">{pic}</span>
          {full ? (
            <m.b className="v-top-c-flag" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: 0.9 }}>
              Full
            </m.b>
          ) : count !== undefined ? (
            <b className="v-top-c-count">{count}</b>
          ) : null}
        </m.button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="v-top-c-pop" side="bottom" sideOffset={8} collisionPadding={12}>
          <span className="v-top-c-pop-name">{name}</span>
          <b className="v-top-c-pop-num">
            {n}
            {of ? <small> / {of}</small> : null}
          </b>
          <Popover.Close asChild>
            <button className="btn soft small" onClick={onOpen}>
              Open
            </button>
          </Popover.Close>
          <Popover.Arrow className="v-top-c-pop-arrow" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
