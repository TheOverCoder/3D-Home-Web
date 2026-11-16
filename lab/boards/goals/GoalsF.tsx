import { Medal as MedalGlyph } from '@phosphor-icons/react/dist/csr/Medal'
import { AnimatePresence, animate, m, useAnimate, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react'
import { useRef, useState, type CSSProperties } from 'react'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { Check, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet, useSideways } from '../level/LevelSheet'
import type { GoalId } from '../../../src/farm/goals'
import { claimed, GoalPic, howFar, Ring, starsOf, tierOf, TIERS, type GoalRow, type GoalsState } from './data'
import './goals.css'
import './GoalsF.css'

// F · the medal case (round 6: "one more variant as another reference, at the highest level you can").
//
// Every goal is a medal, and each step of it a metal: bronze, silver, gold, platinum, then diamond with a star for
// every step past it (the step is the game's; the metal is only how it is pictured). The medal you are working for is
// big in the middle, its rim the ring that fills, its face matt until it is reached and polished once it is; the others
// stand beside it, smaller and turned away, as on a shelf. A swipe moves the shelf (the big medal tilts under the
// finger, like a coin turned in the hand); a medal touched on either side, or one of the small ones in the case under
// it, comes to the middle. Under the big one: what to do, how far in words, the bar and at its end what it gives, and
// the ladder of metals (the ones won, the one being won, the ones to come) — the next station always in view.
//
// Its moment is the claim: the medal spins twice in the hand and comes round in its next metal — the coins fly to the
// chip, one burst — its ring filling again from what is already there ("33% there already!"). Reduced motion: no spin,
// no tilt; the medal simply turns to its next metal.
//
// Nothing here needs new logic: the steps, counts and rewards are the game's own (boardGoals, goalReward); the case's
// count is the steps already claimed.

/** The metals' names, as the ladder says them. */
const METAL: Record<(typeof TIERS)[number], string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond' }

/** A medal: its ribbon, its coin of the step's metal with the goal's picture on its face, its rim the ring that fills. */
function Medal({ row, size, ring = true, delay = 0.2 }: { row: GoalRow; size: number; ring?: boolean; delay?: number }) {
  const stars = starsOf(row.step)
  const stroke = Math.max(4, Math.round(size * 0.065))
  return (
    <span className={`gf-medal t-${tierOf(row.step)}${row.done ? ' done' : ''}`} style={{ '--size': `${size}px`, '--stroke': `${stroke}px` } as CSSProperties}>
      <span className="gf-ribbon" aria-hidden="true" />
      <span className="gf-coin">
        <span className="gf-face">
          <GoalPic row={row} />
        </span>
        <span className="gf-shine" aria-hidden="true" />
      </span>
      {ring && <Ring key={row.step} part={row.part} done={row.done} size={size} stroke={stroke} delay={delay} />}
      {stars > 0 && (
        <span className="gf-stars" aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'}`}>
          ★{stars > 1 ? stars : ''}
        </span>
      )}
    </span>
  )
}

/** The ladder of metals: those won (full), the one being won (ringed), those to come (empty). */
function Ladder({ step }: { step: number }) {
  const now = Math.min(step, TIERS.length - 1)
  return (
    <span className="gf-ladder" role="img" aria-label={`${METAL[tierOf(step)]}${starsOf(step) ? ` ★${starsOf(step)}` : ''}: step ${step + 1}`}>
      {TIERS.map((t, i) => (
        <i key={t} className={`t-${t}${i < now || (i === now && step > now) ? ' won' : i === now ? ' now' : ''}`} />
      ))}
    </span>
  )
}

/** What a goal gives, at the end of its bar: its coins and its material with how many. */
const Gives = ({ row }: { row: GoalRow }) => (
  <span className="gf-gives" aria-label={`Gives ${row.reward.coins} coins and ${row.reward.count} ${row.reward.item}`}>
    <span className="farm-coins">
      <img src={art('coin')} alt="" />
      {row.reward.coins}
    </span>
    <ItemPic id={row.reward.item} count={row.reward.count} />
  </span>
)

/** How far apart the medals stand on the shelf, and how far a swipe must go (or how fast) to move it by one. */
const FAR = 50
const FAST = 400

export function GoalsF({ s, act }: { s: GoalsState; act: Act<GoalsState> }) {
  const still = useReducedMotion()
  const wide = useSideways()
  const rows = s.rows
  // the goal in the middle, by its id: a claim sorts the board again, and the medal in the hand stays the same
  const [atId, setAtId] = useState<GoalId | null>(null)
  const i = Math.max(
    0,
    rows.findIndex((r) => r.id === atId),
  )
  const hero = rows[i]
  const [justClaimed, setJustClaimed] = useState<string | null>(null)
  const won = Object.values(s.farm.goals).reduce((n, k) => n + (k ?? 0), 0)

  // the shelf under the finger: how far it is pulled, and the big medal's tilt with it
  const pull = useMotionValue(0)
  const tilt = useTransform(pull, [-160, 160], [32, -32])
  const gap = wide ? 90 : 118
  const go = (to: number) => setAtId(rows[Math.max(0, Math.min(rows.length - 1, to))].id)
  // a swipe that ends on a medal is not a touch of it
  const panned = useRef(false)
  const panEnd = (_: unknown, info: PanInfo) => {
    const by = info.offset.x < -FAR || info.velocity.x < -FAST ? 1 : info.offset.x > FAR || info.velocity.x > FAST ? -1 : 0
    // the shelf takes the move on from where the finger left it: what was pulled is given back as it slides
    if (by) pull.set(pull.get() + by * gap)
    go(i + by)
    animate(pull, 0, SPRING.sheet)
  }

  // the claim: the medal spins in the hand and comes round in its next metal
  const [coin, spin] = useAnimate()
  const busy = useRef(false)
  const take = (el: HTMLElement) => {
    if (busy.current) return
    busy.current = true
    // the medal in the hand stays there as the board sorts itself again
    setAtId(hero.id)
    const r = el.getBoundingClientRect()
    if (!still) {
      flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(hero.reward.coins))
      const m = coin.current?.getBoundingClientRect()
      burst(m ? { x: m.left + m.width / 2, y: m.top + m.height / 2 } : el, { count: 70, spread: 90, power: 28 })
      if (coin.current) void spin(coin.current, { rotateY: [0, 720] }, { duration: 1.1, ease: [0.3, 0.9, 0.25, 1] })
    }
    setTimeout(
      () => {
        act.set(claimed(s, hero.id))
        setJustClaimed(`${hero.id}-${hero.step + 1}`)
        busy.current = false
      },
      still ? 0 : 380,
    )
  }
  const fresh = justClaimed === `${hero.id}-${hero.step}` && !hero.done

  return (
    <LevelSheet name="v-goals v-goals-f" label="Goals" scrolls onClose={act.close}>
      <m.header className="gf-head" variants={ITEM}>
        <img className="art" src={art('trophy')} alt="" />
        <h2>Goals</h2>
        <span className="tag gf-won" aria-label={`${won} medals won`}>
          <MedalGlyph weight="fill" />
          {won}
        </span>
        {s.ready > 0 && <span className="tag ok">{s.ready} to claim</span>}
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <div className="gf-body" data-scroll>
        <m.div className="gf-stage-col" variants={ITEM}>
          {/* the shelf: a swipe moves it, a medal on either side touched comes to the middle */}
          <m.div
            className="gf-stage"
            onPointerDownCapture={() => (panned.current = false)}
            onPanStart={() => (panned.current = true)}
            onPan={(_, info) => pull.set(info.offset.x)}
            onPanEnd={panEnd}
            aria-roledescription="carousel"
            aria-label="Goals, one at a time"
          >
            <m.div className="gf-track" style={{ x: pull }}>
              {rows.map((r, k) => {
                const d = k - i
                const near = Math.abs(d) <= 1
                return (
                  <m.button
                    key={r.id}
                    className={`gf-slot${d === 0 ? ' on' : ''}`}
                    tabIndex={d !== 0 && near ? 0 : -1}
                    aria-hidden={!near}
                    aria-label={d === 0 ? undefined : `${r.words}${r.done ? ', reached' : ''}`}
                    onClick={() => d !== 0 && !panned.current && go(k)}
                    initial={false}
                    animate={{
                      x: d * gap + (d === 0 ? 0 : Math.sign(d) * (wide ? 6 : 10)),
                      scale: d === 0 ? 1 : 0.56,
                      rotateY: still ? 0 : Math.max(-1, Math.min(1, d)) * -42,
                      opacity: d === 0 ? 1 : near ? 0.72 : 0,
                      zIndex: 10 - Math.abs(d),
                    }}
                    transition={SPRING.sheet}
                    style={{ pointerEvents: near ? 'auto' : 'none' }}
                  >
                    {d === 0 ? (
                      <m.span className="gf-hold" style={still ? undefined : { rotateY: tilt }}>
                        <m.span ref={coin} className="gf-spin">
                          <Medal row={r} size={wide ? 132 : 148} delay={0.25} />
                        </m.span>
                      </m.span>
                    ) : (
                      <Medal row={r} size={wide ? 132 : 148} ring={near} />
                    )}
                  </m.button>
                )
              })}
            </m.div>
            <i className="gf-pedestal" aria-hidden="true" />
          </m.div>
          <Ladder step={hero.step} />
        </m.div>

        <m.div className="gf-info-col" variants={ITEM}>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.section
              key={`${hero.id}-${hero.step}`}
              className={`gf-info${hero.done ? ' done' : ''}${hero.part >= 0.75 && !hero.done ? ' warm' : ''}`}
              aria-label={`${hero.words}: ${Math.min(hero.have, hero.target)} of ${hero.target}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: EASE.out }}
            >
              <span className="gf-metal">
                {METAL[tierOf(hero.step)]}
                {starsOf(hero.step) ? ` ★${starsOf(hero.step)}` : ''} · step {hero.step + 1}
              </span>
              <h3>{hero.words}</h3>
              <span className={`gf-say${hero.done ? ' done' : ''}`}>{fresh ? `${Math.round(hero.part * 100)}% there already!` : howFar(hero)}</span>
              <div className="gf-act">
                {hero.done ? (
                  <m.button
                    className="btn leaf gf-claim"
                    onClick={(e) => take(e.currentTarget)}
                    whileTap={{ scale: 0.95, y: 3 }}
                    transition={SPRING.pop}
                    aria-label={`Claim ${hero.reward.coins} coins`}
                  >
                    <Check weight="bold" /> Claim
                  </m.button>
                ) : (
                  <span className="gf-barline">
                    <span className={`gf-bar${hero.part >= 0.75 ? ' warm' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={hero.target} aria-valuenow={Math.min(hero.have, hero.target)}>
                      <m.i
                        initial={still ? false : { width: fresh ? `${(hero.from / hero.target) * 100}%` : '0%' }}
                        animate={{ width: `${Math.max(hero.part > 0 ? 4 : 0, hero.part * 100)}%` }}
                        transition={{ delay: 0.15, duration: 0.8, ease: EASE.out }}
                      />
                    </span>
                    <b>
                      {Math.min(hero.have, hero.target)}/{hero.target}
                    </b>
                  </span>
                )}
                <Gives row={hero} />
              </div>
            </m.section>
          </AnimatePresence>

          {/* the case: every goal as a small medal; touched, it comes to the middle */}
          <div className="gf-case" role="tablist" aria-label="Every goal">
            {rows.map((r, k) => (
              <m.button
                key={r.id}
                role="tab"
                aria-selected={k === i}
                className={`gf-thumb${k === i ? ' on' : ''}${r.done ? ' done' : ''}`}
                onClick={() => go(k)}
                aria-label={`${r.words}, ${METAL[tierOf(r.step)]}${r.done ? ', reached' : `, ${Math.min(r.have, r.target)} of ${r.target}`}`}
                {...PRESS}
              >
                <m.span
                  className="gf-thumb-in"
                  animate={r.done && !still ? { y: [0, -3, 0] } : { y: 0 }}
                  transition={r.done && !still ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : SPRING.pop}
                >
                  <Medal row={r} size={wide ? 40 : 44} delay={0.4 + k * 0.05} />
                </m.span>
                {r.done && <i className="gf-dot" aria-hidden="true" />}
              </m.button>
            ))}
          </div>
        </m.div>
      </div>
    </LevelSheet>
  )
}
