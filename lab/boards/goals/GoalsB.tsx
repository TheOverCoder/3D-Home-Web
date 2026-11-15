import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { art } from '../../../src/ui/art'
import { Check, X } from '../../../src/ui/glyphs'
import { PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { claim, GoalPic, howFar, Ring, type GoalRow, type GoalsState } from './data'
import './goals.css'
import './GoalsB.css'

// B · a sticker book: the six goals as tiles in a grid, each its picture in a ring that fills, what to do, how far
// (the words by the small-area rule) and a sticker of what it gives in its corner. A goal reached lifts off the page,
// its ring green, bobbing, a Claim strip across its foot; the others stay flat. Its moment: Claim — a stamp comes down
// on the tile with a squash ("✓"), the coins fly to the coin chip, confetti, and the tile turns over to the goal's next
// step, its ring already part full. Whole numbers, no scrolling: six tiles fit upright and sideways.

const TILES = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }
const TILE = { hidden: { opacity: 0, scale: 0.8, y: 10 }, show: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }

export function GoalsB({ s, act }: { s: GoalsState; act: Act<GoalsState> }) {
  return (
    <LevelSheet name="v-goals v-goals-b" label="Goals" onClose={act.close}>
      <m.header className="gb-head" variants={ITEM}>
        <img className="art" src={art('trophy')} alt="" />
        <h2>Goals</h2>
        {s.ready ? <span className="tag ok">{s.ready} to claim</span> : <span className="tag">Reach one for a prize</span>}
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.ul className="gb-grid" variants={TILES}>
        {s.rows.map((r) => (
          <m.li key={r.id} variants={TILE} layout transition={SPRING.sheet}>
            <AnimatePresence mode="popLayout" initial={false}>
              <Tile key={`${r.id}-${r.step}`} row={r} onClaim={(el) => claim(s, act, r, el, 520)} />
            </AnimatePresence>
          </m.li>
        ))}
      </m.ul>
    </LevelSheet>
  )
}

function Tile({ row, onClaim }: { row: GoalRow; onClaim: (el: HTMLElement) => void }) {
  const still = useReducedMotion()
  return (
    <m.div
      className={`gb-tile${row.done ? ' done' : ''}${row.part >= 0.75 && !row.done ? ' warm' : ''}`}
      aria-label={`${row.words}: ${Math.min(row.have, row.target)} of ${row.target}`}
      initial={{ rotateY: -90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={{ rotateY: 90, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ ...SPRING.soft, delay: 0.05 }}
      style={{ transformPerspective: 600 }}
    >
      <m.span className="gb-lift" animate={row.done && !still ? { y: [0, -4, 0] } : undefined} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="gb-pic">
          <Ring part={row.part} done={row.done} size={70} stroke={7} />
          <GoalPic row={row} />
        </span>
      </m.span>
      <b className="gb-words">{row.words}</b>
      <span className={`gb-far${row.done ? ' done' : ''}`}>{howFar(row)}</span>
      <span className="gb-sticker" aria-hidden="true">
        <img src={art('coin')} alt="" />
        {row.reward.coins}
      </span>
      {row.done && (
        <m.button
          className="gb-claim"
          onClick={(e) => onClaim(e.currentTarget.parentElement ?? e.currentTarget)}
          whileTap={{ scale: 0.95, y: 2 }}
          transition={SPRING.pop}
          aria-label={`Claim ${row.reward.coins} coins`}
        >
          <Check weight="bold" /> Claim
        </m.button>
      )}
    </m.div>
  )
}
