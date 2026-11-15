import { animate, m, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { MACHINE_LEVELS, type LevelBoost, type LevelView } from '../machineView'
import { art } from '../../ui/art'
import { ArrowRight, Check } from '../../ui/glyphs'
import { EASE, PRESS, SPRING } from '../../ui/motion'
import { Ring } from './parts'
import { workTime } from './queue'

// The machine's level: a chip on the panel (the level and a small ring of the way to the next), and the card it opens
// — how long the machine has worked, how much more the next level takes (the ring, with what the queue will add as a
// lighter piece after it), the levels as stations, and what this level gives and the next will.

/** The chip: tap it for what the level gives. */
export function LevelChip({ level, name, onOpen }: { level: LevelView; name: string; onOpen: () => void }) {
  return (
    <m.button className="mp-level" onClick={onOpen} aria-label={`${name}, level ${level.n} — what it gives`} {...PRESS}>
      <span className="mp-level-word">Level</span>
      <m.span className="mp-level-ring" layoutId="mp-level-ring" transition={SPRING.sheet}>
        <Ring size={30} stroke={4} value={level.next === null ? 1 : level.progress} />
        <b>{level.n}</b>
      </m.span>
    </m.button>
  )
}

const pct = (x: number) => `+${Math.round(x * 100)} %`

/** What a level gives, row by row: XP for each job, coins for what it makes, quicker jobs. */
const ROWS: { key: keyof LevelBoost; label: string; pic: string; xp?: boolean; say: (x: number) => string }[] = [
  { key: 'xp', label: 'XP a job', pic: art('gem-stone'), xp: true, say: pct },
  { key: 'coins', label: 'Sale price', pic: art('coin'), say: pct },
  { key: 'speed', label: 'Speed', pic: art('hourglass-done'), say: pct },
]

export function LevelPage({ level, queued, name }: { level: LevelView; queued: number; name: string }) {
  const still = useReducedMotion()
  const top = level.next === null
  const start = MACHINE_LEVELS[level.n - 1]?.minutes ?? 0
  const span = top ? 1 : level.next! - start
  const into = level.minutes - start
  const toGo = top ? 0 : level.next! - level.minutes
  const ghost = top ? 0 : Math.min(1 - level.progress, queued / span)
  // the ring fills to where the machine is as the card opens
  const fill = useMotionValue(still ? level.progress : 0)
  useEffect(() => {
    const run = animate(fill, top ? 1 : level.progress, still ? { duration: 0 } : { duration: 0.9, ease: EASE.out, delay: 0.15 })
    return () => run.stop()
  }, [fill, level.progress, top, still])
  return (
    <div className="mp-lv" aria-label={`${name}, level ${level.n}`}>
      <div className="mp-lv-hero">
        <m.div className="mp-lv-ring" layoutId="mp-level-ring" transition={SPRING.sheet}>
          <Ring size={124} stroke={12} value={fill} ghost={ghost} />
          <span className="mp-lv-n">
            <small>Level</small>
            <b>{level.n}</b>
          </span>
        </m.div>
        <div className="mp-lv-words">
          {top ? (
            <strong className="mp-lv-big">The top level</strong>
          ) : level.progress < 0.5 ? (
            // below half: what is done; past it, what is left (the smaller part reads best)
            <span className="mp-lv-big">
              {into < 1 ? (
                <strong>Just started</strong>
              ) : (
                <>
                  <strong>{workTime(into)}</strong> worked
                </>
              )}
            </span>
          ) : (
            <span className="mp-lv-big">
              <strong>{workTime(toGo)}</strong> to go
            </span>
          )}
          {!top && <span className="mp-lv-line">{level.progress < 0.5 ? `${workTime(toGo)} to level ${level.n + 1}` : `for level ${level.n + 1}`}</span>}
          <span className="mp-lv-facts">
            {ghost > 0 && (
              <span className="mp-lv-ghost">
                <i aria-hidden="true" /> the queue adds {workTime(queued)}
              </span>
            )}
            <span className="tag">{workTime(level.minutes)} in all</span>
          </span>
        </div>
      </div>
      <ol className="mp-lv-stations" aria-label="The levels">
        {MACHINE_LEVELS.map((_, i) => {
          const n = i + 1
          const state = n < level.n ? 'past' : n === level.n ? 'here' : n === level.n + 1 ? 'next' : 'later'
          return (
            <m.li
              key={n}
              className={`mp-lv-station ${state}`}
              aria-label={`Level ${n}${state === 'past' ? ', reached' : state === 'here' ? ', now' : ''}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { ...SPRING.pop, delay: 0.2 + i * 0.05 } }}
            >
              <span>{state === 'past' ? <Check weight="bold" /> : n}</span>
            </m.li>
          )
        })}
      </ol>
      <div className={`mp-lv-boosts${top ? ' top' : ''}`} role="table" aria-label="What the level gives">
        <div className="mp-lv-row head" role="row">
          <span role="columnheader" />
          <span role="columnheader">Now</span>
          {!top && <span role="columnheader" aria-hidden="true" />}
          {!top && <span role="columnheader">Level {level.n + 1}</span>}
        </div>
        {ROWS.map((row, i) => {
          const now = level.boost[row.key]
          const next = level.nextBoost?.[row.key] ?? now
          const up = !top && next > now
          return (
            <m.div key={row.key} className="mp-lv-row" role="row" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0, transition: { ...SPRING.pop, delay: 0.28 + i * 0.06 } }}>
              <span className="mp-lv-what" role="rowheader">
                <img className={`art${row.xp ? ' mp-xp-pic' : ''}`} src={row.pic} alt="" />
                {row.label}
              </span>
              <span className={`mp-lv-now${now ? '' : ' none'}`} role="cell">
                {now ? row.say(now) : '—'}
              </span>
              {!top && (
                <span className="mp-lv-arrow" aria-hidden="true">
                  <ArrowRight weight="bold" />
                </span>
              )}
              {!top && (
                <span className={`mp-lv-next${up ? ' up' : ''}`} role="cell">
                  {next ? row.say(next) : '—'}
                </span>
              )}
            </m.div>
          )
        })}
      </div>
    </div>
  )
}
