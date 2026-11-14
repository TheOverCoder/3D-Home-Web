import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { ArrowsOutCardinal, CompassRose, EyeSlash, GearSix, SquaresFour } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { Compass, Num, Opens, SaleStandIn, topView, usePurse, type HudView, type Need, type TopState } from './parts'
import './TopB.css'

// B · only what needs you: one plate at the top left holds the two numbers that always matter — the coins (the hero)
// and the level (its star, the XP written over its bar, the next prize). The hour is in the heart of the compass,
// where the degrees were. Everything else stays away until it needs you: a store full, the line full, goals reached
// come as a callout with words under the compass (two at most; swipe one aside to put it away). One corner button with
// a word, "Farm", opens a grid of tiles — the line, the silo, the barn, the goals, and the menu (edit, the top's view,
// settings), each a picture and a word.

const NEXT: Record<HudView, HudView> = { all: 'compass', compass: 'clean', clean: 'all' }
const VIEW_WORD: Record<HudView, string> = { all: 'All', compass: 'Compass', clean: 'Clear' }

export function TopB({ s, set }: { s: TopState; set: (s: TopState) => void }) {
  const v = topView(s)
  const lv = v.lv
  const still = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [plate, animatePlate] = useAnimate()
  const [open, setOpen] = useState(false)
  const [opens, setOpens] = useState<string | null>(null)
  const [away, setAway] = useState<string[]>([])
  const purse = usePurse(s.coins, (last) => {
    if (still) return
    // each coin landing bumps the plate's coin; the last spins it once and lights the coin half of the plate
    void animatePlate('.v-top-b-coin', { scale: [1, 1.18, 1] }, { duration: 0.2, ease: EASE.out })
    if (last) {
      void animatePlate('.v-top-b-coin', { rotateY: [0, 360] }, { duration: 0.55, ease: EASE.out })
      void animatePlate('.v-top-b-money', { backgroundColor: ['rgba(255, 201, 60, 0.45)', 'rgba(255, 201, 60, 0)'] }, { duration: 0.7, ease: 'easeOut' })
    }
  })
  const all = s.hud === 'all'
  const needs = v.needs.filter((n) => !away.includes(n.id))
  const shown = needs.slice(0, 2)
  const more = needs.length - shown.length
  const k = lv.into / lv.need
  return (
    <div className={`v-top-b hud-${s.hud}`} ref={root}>
      <div className="v-top-b-row">
        {all && (
          <m.div className="v-top-b-plate" ref={plate} initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.sheet}>
            <span className="v-top-b-money">
              <img className="v-top-b-coin" src={art('coin')} alt="" data-coin-target />
              <b>
                <Num v={purse.text} />
              </b>
            </span>
            <m.button
              className={`v-top-b-level${lv.unpaid ? ' ready' : ''}`}
              {...PRESS}
              onClick={() => setOpens('כרטיס הרמה')}
              aria-label={lv.unpaid ? `Level ${lv.level}: ${lv.unpaid} coins to claim` : `Level ${lv.level}: ${lv.into} of ${lv.need} XP`}
            >
              <span className="v-top-b-star">
                <img src={art('glowing-star')} alt="" />
                <b>{lv.level}</b>
              </span>
              <span className="v-top-b-xp">
                <span className="v-top-b-xp-num">{lv.top ? 'Top level' : `${lv.into} / ${lv.need}`}</span>
                <span className="v-top-b-bar" role="progressbar" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into}>
                  <m.i initial={{ scaleX: still ? k : 0 }} animate={{ scaleX: k }} transition={{ delay: 0.25, duration: 0.6, ease: EASE.out }} />
                </span>
              </span>
              {lv.unpaid ? (
                <m.span className="v-top-b-claim" initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: 0.45, duration: 0.45, ease: EASE.out }}>
                  <img src={art('coin')} alt="" />
                  {lv.unpaid}
                </m.span>
              ) : lv.top ? null : (
                <span className="v-top-b-prize">{lv.gift ? <GarmentPic g={lv.gift} /> : <img className="art" src={art('coin')} alt="" />}</span>
              )}
            </m.button>
          </m.div>
        )}
        <m.button
          className="v-top-b-farm"
          {...PRESS}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Farm: your stores, the line, goals and the menu"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING.pop, delay: 0.08 }}
        >
          <img src={art('house-with-garden')} alt="" />
          <span>Farm</span>
          {needs.length > 0 && !all && <i className={`v-top-b-dot ${needs[0].tone}`}>{needs.length}</i>}
        </m.button>
        {s.hud !== 'clean' && (
          <m.div className="v-top-b-compass" initial={{ opacity: 0, scaleX: 0.4 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ ...SPRING.sheet, delay: all ? 0.12 : 0 }}>
            <Compass heading={s.heading} marks={s.marks} scale={{ letters: true, mid: true, nums: false }} className="v-top-b-strip">
              <m.span className="v-top-b-time" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.28 }}>
                <img src={art(v.phaseArt)} alt="" />
                {v.hour}
              </m.span>
            </Compass>
            {all && (
              <div className="v-top-b-calls">
                <AnimatePresence>
                  {shown.map((n, i) => (
                    <Callout key={n.id} n={n} i={i} onTap={() => setOpens(TAPS[n.id])} onAway={() => setAway((a) => [...a, n.id])} />
                  ))}
                  {more > 0 && (
                    <m.span key="more" className="v-top-b-more" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      +{more}
                    </m.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </m.div>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <>
            <m.div key="away" className="v-top-b-away" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <m.div
              key="grid"
              className="v-top-b-sheet paper"
              role="dialog"
              aria-label="Farm"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.14, ease: 'easeIn' } }}
              transition={SPRING.pop}
            >
              <div className="v-top-b-tiles">
                {v.line && (
                  <Tile
                    at={0}
                    pic={<img className="art" src={art('people-queue')} alt="" />}
                    word="Line"
                    value={`${v.line.n}/${v.line.of}`}
                    k={v.line.n / v.line.of}
                    tone={v.line.full ? 'leaf' : ''}
                    onTap={() => setOpens('התור בשער')}
                  />
                )}
                <Tile at={1} pic={<ItemPic id="silo" />} word="Silo" value={`${v.silo.n}/${v.silo.cap}`} k={v.silo.k} tone={v.silo.full ? 'berry' : ''} onTap={() => setOpens('הממגורה')} />
                <Tile at={2} pic={<ItemPic id="barn" />} word="Barn" value={`${v.barn.n}/${v.barn.cap}`} k={v.barn.k} tone={v.barn.full ? 'berry' : ''} onTap={() => setOpens('האסם')} />
                <Tile
                  at={3}
                  pic={<img className="art" src={art('trophy')} alt="" />}
                  word="Goals"
                  value={v.goals ? `${v.goals} ✓` : '—'}
                  tone={v.goals ? 'leaf' : ''}
                  onTap={() => setOpens('לוח המטרות')}
                />
                <Tile at={4} pic={<ArrowsOutCardinal weight="bold" />} word="Edit" onTap={() => setOpens('מצב עריכה')} />
                <Tile
                  at={5}
                  pic={s.hud === 'all' ? <SquaresFour weight="bold" /> : s.hud === 'compass' ? <CompassRose weight="bold" /> : <EyeSlash weight="bold" />}
                  word="View"
                  value={VIEW_WORD[s.hud]}
                  onTap={() => set({ ...s, hud: NEXT[s.hud] })}
                />
                <Tile at={6} pic={<GearSix weight="bold" />} word="Settings" onTap={() => setOpens('ההגדרות')} />
                <Tile at={7} pic={<img className="art" src={art(v.phaseArt)} alt="" />} word={`Day ${v.day}`} value={v.phaseName} onTap={() => setOpens('היום בחווה')} />
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
      <SaleStandIn onSell={(from) => purse.pay(24, from, root.current)} />
      <AnimatePresence>{opens && <Opens what={opens} onDone={() => setOpens(null)} />}</AnimatePresence>
    </div>
  )
}

const TAPS: Record<Need['id'], string> = { silo: 'הממגורה', barn: 'האסם', line: 'התור בשער', goals: 'לוח המטרות', level: 'כרטיס הרמה' }

/** Something that needs you, in words: it drops in, swings once, and can be swiped aside (it stays away until the next
 *  time it needs you). */
function Callout({ n, i, onTap, onAway }: { n: Need; i: number; onTap: () => void; onAway: () => void }) {
  return (
    <m.button
      className={`v-top-b-call ${n.tone}`}
      layout
      initial={{ opacity: 0, y: -16, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: [0, -3, 2, 0] }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.15 } }}
      transition={{ y: SPRING.soft, opacity: { duration: 0.2 }, rotate: { delay: 0.35 + i * 0.08, duration: 0.5 }, delay: 0.3 + i * 0.08 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, d) => Math.abs(d.offset.x) > 60 && onAway()}
      whileTap={{ scale: 0.95 }}
      onClick={onTap}
    >
      {n.pic.item ? <ItemPic id={n.pic.item} /> : <img className="art" src={art(n.pic.art!)} alt="" />}
      <span>{n.word}</span>
      {n.count !== undefined && <b>{n.count}</b>}
    </m.button>
  )
}

/** A tile of the Farm grid: a picture, a word, and a number (with a thin bar) where it has one. */
function Tile({ at, pic, word, value, k, tone = '', onTap }: { at: number; pic: ReactNode; word: string; value?: string; k?: number; tone?: string; onTap: () => void }) {
  // the tiles come in as a wave from the corner the grid opens from (the top right)
  const col = at % 4
  const row = Math.floor(at / 4)
  return (
    <m.button
      className={`v-top-b-tile ${tone}`}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.94 }}
      transition={{ ...SPRING.pop, delay: 0.04 + (3 - col + row) * 0.035 }}
      onClick={onTap}
    >
      <span className="v-top-b-tile-pic">{pic}</span>
      <span className="v-top-b-tile-word">{word}</span>
      {value && <b>{value}</b>}
      {k !== undefined && (
        <span className="v-top-b-tile-bar">
          <i style={{ width: `${Math.min(1, k) * 100}%` }} />
        </span>
      )}
    </m.button>
  )
}
