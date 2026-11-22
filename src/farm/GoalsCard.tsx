import { AnimatePresence, animate, m, useAnimate, useIsPresent, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useLessMotion } from '../ui/still'
import { useEffect, useRef, useState } from 'react'
import { flyCoins, flyItem } from '../fx/coins'
import { coinsToFly } from '../fx/fx'
import { art } from '../ui/art'
import { paying } from '../fx/paid'
import { celebrate } from '../fx/reward'
import { Check, Medal as MedalGlyph } from '../ui/glyphs'
import { ItemPic } from '../ui/ItemPic'
import { EASE, ITEM, PRESS, SINK, SPRING } from '../ui/motion'
import { PanelSheet } from '../ui/PanelSheet'
import { useSideways } from '../ui/sheetMode'
import { storeOf } from './data'
import type { GoalId } from './goals'
import { howFar, nextToClaim, onBoard, type GoalView, type GoalsView } from './goalsView'
import { iconUrl } from './icons'
import './GoalsCard.css'

// How the goals board looks: the medal case (the design lab's F, lab/boards/goals; the user chose it with gold medals
// only and the goods in their full colours). What it shows is ./goalsView.ts, made from the farm by ./GoalsPanel.tsx.
//
// Every goal is a gold medal with its picture on the face; each step of it reached is one more medal won (the chip in
// the title counts them). The medal you are working for is big in the middle, its rim the ring that fills; the others
// stand beside it, smaller and turned away, as on a shelf. A swipe moves the shelf (the big medal tilts under the
// finger, like a coin turned in the hand); a medal touched on either side, or one of the small ones in the case under
// it, comes to the middle. Under the big one: the steps (those won, the one being won, the next), what to do, how far
// in words, the bar and at its end what it gives — reached, a Claim in the bar's place.
//
// Its moment is the claim: the medal spins twice in the hand — the coins fly to the chip and the material to its
// building, one burst — and comes round on its next step, its ring filling again from what is already there ("33%
// there already!"). The claim is the farm's at the tap (onClaim): closing the card at any moment loses nothing. Less
// motion: no spin, no tilt, nothing flies.

/** How far apart the medals stand on the shelf (px, upright and sideways), and how far a swipe must go (or how fast)
 *  to move it by one. */
const GAP = { tall: 118, wide: 92 }
const FAR = 50
const FAST = 400
/** The ring round a medal, a share of its size: the big one's, a small one's (thicker, to be seen). */
const RING = { big: 6.5, small: 9 }
/** How long the medal turns before it shows its next step (ms). */
const TURN = 380

export function GoalsCard({ v, onClaim, onClose }: { v: GoalsView; onClaim: (id: GoalId) => unknown; onClose: () => void }) {
  const still = useLessMotion()
  const wide = useSideways()
  // the goal in the middle, by its id: a claim sorts the board again, and the medal in the hand stays the same
  const [atId, setAtId] = useState<GoalId | null>(null)
  // while the medal turns, the board as it was before the claim (it comes round on its next step)
  const [held, setHeld] = useState<GoalsView | null>(null)
  // the step just reached by a claim: its words say how much of the next is already there
  const [fresh, setFresh] = useState<string | null>(null)
  const shown = held ?? v
  // the board as it is now (a claim's timer reads it after the farm has paid)
  const latest = useRef(v)
  latest.current = v
  const rows = onBoard(shown.goals, atId)
  const i = Math.max(
    0,
    rows.findIndex((r) => r.id === atId),
  )
  const hero = rows[i]

  // the shelf under the finger: how far it is pulled, and the big medal's tilt with it
  const pull = useMotionValue(0)
  const tilt = useTransform(pull, [-160, 160], [32, -32])
  const gap = wide ? GAP.wide : GAP.tall
  const go = (to: number) => setAtId(rows[Math.max(0, Math.min(rows.length - 1, to))].id)
  // a swipe that ends on a medal is not a touch of it
  const panned = useRef(false)
  const panEnd = (_: unknown, info: PanInfo) => {
    const by = info.offset.x < -FAR || info.velocity.x < -FAST ? 1 : info.offset.x > FAR || info.velocity.x > FAST ? -1 : 0
    // the shelf takes the move on from where the finger left it: what was pulled is given back as it slides
    if (by && rows[i + by]) pull.set(pull.get() + by * gap)
    go(i + by)
    animate(pull, 0, SPRING.sheet)
  }

  // the claim: the medal spins in the hand and comes round on its next step
  const [coin, spin] = useAnimate()
  const turning = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(turning.current), [])
  const take = (button: HTMLElement) => {
    if (held) return
    const goal = hero
    setAtId(goal.id)
    // the claim is the farm's at the tap; its show as big as what it gave (the tier it was counted at)
    const { tier } = paying(
      'goal',
      () => onClaim(goal.id),
      () => [{ coins: goal.reward.coins }, { item: goal.reward.item, n: goal.reward.count }],
    )
    if (!still) {
      const b = button.getBoundingClientRect()
      flyCoins(b.left + b.width / 2, b.top + b.height / 2, coinsToFly(goal.reward.coins))
      // the material flies from where the card shows it, at the end of the bar
      const g = button.closest('.gc-info')?.querySelector('.gc-gives .item-pic')?.getBoundingClientRect()
      if (g) flyItem(g.left + g.width / 2, g.top + g.height / 2, iconUrl(goal.reward.item), 1, storeOf(goal.reward.item))
      const c = coin.current?.getBoundingClientRect()
      // (its sound and touch the farm played as it paid: claimGoal's own line)
      celebrate('goal', tier ?? 'small', c ? { x: c.left + c.width / 2, y: c.top + c.height / 2 } : button, { sound: false })
      if (coin.current) void spin(coin.current, { rotateY: [0, 720] }, { duration: 1.1, ease: [0.3, 0.9, 0.25, 1] })
      setHeld(v)
    }
    // once it has come round: on to the next goal whose prize waits, if another does (./goalsView.ts, nextToClaim)
    turning.current = setTimeout(
      () => {
        setHeld(null)
        const next = nextToClaim(onBoard(latest.current.goals, goal.id), goal.id)
        if (next) setAtId(next)
      },
      still ? 0 : TURN,
    )
    setFresh(`${goal.id}-${goal.step + 1}`)
  }
  const isFresh = !held && fresh === `${hero.id}-${hero.step}` && !hero.done

  return (
    // the sheet's head: the trophy, "Goals", the medals won and how many wait (src/ui/PanelSheet.tsx)
    <PanelSheet
      label="Goals"
      title="Goals"
      pic={art('trophy')}
      className="goals-card"
      sub={
        <>
          <span className="tag gc-won" aria-label={`${shown.won} ${shown.won === 1 ? 'medal' : 'medals'} won`}>
            <MedalGlyph weight="fill" />
            {shown.won}
          </span>
          {shown.ready > 0 && <span className="tag ok">{shown.ready} to claim</span>}
        </>
      }
      onClose={onClose}
    >
      <div className="gc-body">
        <m.div className="gc-stage-col" variants={ITEM}>
          {/* the shelf: a swipe moves it, a medal on either side touched comes to the middle */}
          <m.div
            className="gc-stage"
            onPointerDownCapture={() => (panned.current = false)}
            onPanStart={() => (panned.current = true)}
            onPan={(_, info) => pull.set(info.offset.x)}
            onPanEnd={panEnd}
            aria-roledescription="carousel"
            aria-label="Goals, one at a time"
          >
            <m.div className="gc-track" style={{ x: pull }}>
              {rows.map((r, k) => {
                const d = k - i
                const near = Math.abs(d) <= 1
                return (
                  <m.button
                    key={r.id}
                    className={`gc-slot${d === 0 ? ' on' : ''}`}
                    tabIndex={d !== 0 && near ? 0 : -1}
                    aria-hidden={!near}
                    aria-label={`${r.words}${r.done ? ', reached' : ''}`}
                    onClick={() => d !== 0 && !panned.current && go(k)}
                    initial={false}
                    animate={{
                      x: d * gap + (d === 0 ? 0 : Math.sign(d) * (wide ? 6 : 10)),
                      scale: d === 0 ? 1 : 0.56,
                      rotateY: still ? 0 : Math.max(-1, Math.min(1, d)) * -42,
                      opacity: near ? 1 : 0,
                      zIndex: 10 - Math.abs(d),
                    }}
                    transition={SPRING.sheet}
                    style={{ pointerEvents: near ? 'auto' : 'none' }}
                  >
                    {d === 0 ? (
                      <m.span className="gc-hold" style={still ? undefined : { rotateY: tilt }}>
                        <m.span ref={coin} className="gc-spin">
                          <Medal goal={r} big delay={0.25} />
                        </m.span>
                      </m.span>
                    ) : (
                      <Medal goal={r} big ring={near} />
                    )}
                  </m.button>
                )
              })}
            </m.div>
            <i className="gc-pedestal" aria-hidden="true" />
          </m.div>
          <Steps step={hero.step} />
        </m.div>

        <m.div className="gc-info-col" variants={ITEM}>
          <AnimatePresence mode="popLayout" initial={false}>
            <Info key={`${hero.id}-${hero.step}`} goal={hero} fresh={isFresh} onClaim={take} />
          </AnimatePresence>

          {/* the case: every goal on the board as a small medal; touched, it comes to the middle */}
          <div className="gc-case" role="tablist" aria-label="Every goal">
            {rows.map((r, k) => (
              <m.button
                key={r.id}
                role="tab"
                aria-selected={k === i}
                className={`gc-thumb${k === i ? ' on' : ''}${r.done ? ' done' : ''}`}
                onClick={() => go(k)}
                aria-label={`${r.words}${r.done ? ', reached' : `, ${Math.min(r.have, r.target)} of ${r.target}`}`}
                {...PRESS}
              >
                <m.span
                  className="gc-thumb-in"
                  animate={r.done && !still ? { y: [0, -3, 0] } : { y: 0 }}
                  transition={r.done && !still ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : SPRING.pop}
                >
                  <Medal goal={r} delay={0.4 + k * 0.05} />
                </m.span>
                {r.done && <i className="gc-dot" aria-hidden="true" />}
              </m.button>
            ))}
          </div>
        </m.div>
      </div>
    </PanelSheet>
  )
}

/** What to do about the goal in the middle: its step, its words, how far, and the bar leading to what it gives (reached:
 *  Claim in the bar's place). `fresh`: the step was just reached by a claim, and part of the next is already there. The
 *  one going out as another comes in is hidden from the screen reader. */
function Info({ goal, fresh, onClaim }: { goal: GoalView; fresh: boolean; onClaim: (button: HTMLElement) => void }) {
  const still = useLessMotion()
  const here = useIsPresent()
  const have = Math.min(goal.have, goal.target)
  return (
    <m.section
      className={`gc-info${goal.done ? ' done' : goal.almost ? ' warm' : ''}${here ? '' : ' leaving'}`}
      aria-label={`${goal.words}: ${have} of ${goal.target}`}
      aria-hidden={here ? undefined : true}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
      transition={{ duration: 0.2, ease: EASE.out }}
    >
      <span className="gc-step">Step {goal.step + 1}</span>
      <h3>{goal.words}</h3>
      <span className="gc-say">{fresh ? `${Math.round(goal.part * 100)}% there already!` : howFar(goal)}</span>
      <div className="gc-act">
        {goal.done ? (
          <m.button className="btn leaf gc-claim" onClick={(e) => here && onClaim(e.currentTarget)} aria-label={`Claim ${goal.reward.coins} coins`} {...SINK}>
            <Check weight="bold" /> Claim
          </m.button>
        ) : (
          <span className="gc-barline">
            <span className="gc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={have}>
              <m.i
                initial={still ? false : { width: fresh ? `${(goal.from / goal.target) * 100}%` : '0%' }}
                animate={{ width: `${Math.max(goal.part > 0 ? 4 : 0, goal.part * 100)}%` }}
                transition={{ delay: 0.15, duration: 0.8, ease: EASE.out }}
              />
            </span>
            <b className="gc-count">
              {have}/{goal.target}
            </b>
          </span>
        )}
        <Gives goal={goal} />
      </div>
    </m.section>
  )
}

/** A goal's picture: the good it is about (its model), or a piece of interface art. */
const GoalPic = ({ goal }: { goal: GoalView }) =>
  'item' in goal.pic ? (
    <ItemPic id={goal.pic.item} />
  ) : (
    <span className="item-pic">
      <img className="art" src={art(goal.pic.art)} alt="" draggable={false} />
    </span>
  )

/** A gold medal: its ribbon, its coin with the goal's picture on the face, its rim the ring that fills. */
function Medal({ goal, big = false, ring = true, delay = 0.2 }: { goal: GoalView; big?: boolean; ring?: boolean; delay?: number }) {
  return (
    <span className={`gc-medal${big ? ' big' : ''}${goal.done ? ' done' : ''}`}>
      <span className="gc-ribbon" aria-hidden="true" />
      <span className="gc-coin">
        <span className="gc-face">
          <GoalPic goal={goal} />
        </span>
        <span className="gc-shine" aria-hidden="true" />
      </span>
      {ring && <Ring key={goal.step} part={goal.part} done={goal.done} almost={goal.almost} stroke={big ? RING.big : RING.small} delay={delay} />}
    </span>
  )
}

/** The ring round a medal (a share of its size: the medal's CSS sets the size): it fills as far as the goal has come,
 *  it warms in its last stretch (almost there), and reached it is the leaf's. */
function Ring({ part, done, almost, stroke, delay }: { part: number; done: boolean; almost: boolean; stroke: number; delay: number }) {
  const r = 50 - stroke / 2
  const c = 2 * Math.PI * r
  return (
    <svg className={`gc-ring${done ? ' done' : almost ? ' warm' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <circle className="gc-ring-track" cx={50} cy={50} r={r} strokeWidth={stroke} />
      <m.circle
        className="gc-ring-fill"
        cx={50}
        cy={50}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.max(0.02, part)) }}
        transition={{ delay, duration: 0.8, ease: EASE.out }}
        transform="rotate(-90 50 50)"
      />
    </svg>
  )
}

/** The steps of a goal round the one being won: those won (gold), the one being won (ringed), the next (empty). */
function Steps({ step }: { step: number }) {
  const first = Math.max(0, step - 3)
  return (
    <span className="gc-steps" role="img" aria-label={`Step ${step + 1}: ${step} ${step === 1 ? 'medal' : 'medals'} won`}>
      {[0, 1, 2, 3, 4].map((k) => {
        const s = first + k
        return <i key={s} className={s < step ? 'won' : s === step ? 'now' : undefined} />
      })}
    </span>
  )
}

/** What a goal gives, at the end of its bar: its coins and its material with how many. */
const Gives = ({ goal }: { goal: GoalView }) => (
  <span className="gc-gives" aria-label={`Gives ${goal.reward.coins} coins and ${goal.reward.count} ${goal.reward.item}`}>
    <span className="farm-coins">
      <img src={art('coin')} alt="" />
      {goal.reward.coins}
    </span>
    <ItemPic id={goal.reward.item} count={goal.reward.count} />
  </span>
)
