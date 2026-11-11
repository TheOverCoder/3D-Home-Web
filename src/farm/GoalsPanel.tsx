import { useEffect, useRef } from 'react'
import { useHome } from '../store'
import { art } from '../ui/art'
import { ItemPic } from '../ui/ItemPic'
import { Coins, Shell } from '../ui/Sheet'
import { Check } from '../ui/glyphs'
import { boardGoals, goalReward, goalsReady, type GoalNow } from './goals'
import { claimGoal, farm, useFarm } from './state'

// The goals board (src/farm/goals.ts): the trophy in the chips at the top opens it, with how many goals are reached
// and wait to be claimed. Each goal a card like an order's: its picture, what to do, how far you have got, what it
// gives (coins, and the building material the silo or the barn is shortest of); reached, it turns green with a Claim
// button. The board shows those reached first, then those nearest to done — never more than six — so it always says
// what is worth doing next.

/** A goal's picture: the good it is about (its model), or a piece of interface art. */
const GoalPic = ({ g }: { g: GoalNow }) =>
  'item' in g.def.pic ? (
    <ItemPic id={g.def.pic.item} />
  ) : (
    <span className="item-pic">
      <img className="art" src={art(g.def.pic.art)} alt="" draggable={false} />
    </span>
  )

function GoalCard({ g }: { g: GoalNow }) {
  const reward = goalReward(g.def, g.step, farm)
  const have = Math.min(g.have, g.target)
  const words = g.def.say(g.target)
  return (
    <div className={`farm-goal${g.done ? ' ok' : ''}`} aria-label={`${words}: ${have} of ${g.target}`}>
      <GoalPic g={g} />
      <div className="farm-goal-text">
        <strong>{words}</strong>
        <div className="farm-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={g.target} aria-valuenow={have}>
          <span style={{ width: `${(100 * have) / g.target}%` }} />
        </div>
        <span className="farm-goal-count">
          {have}/{g.target}
        </span>
      </div>
      <div className="farm-goal-reward" title="What it gives">
        <Coins n={reward.coins} />
        <ItemPic id={reward.item} count={reward.count} />
      </div>
      {g.done && (
        <button className="btn small leaf" onClick={() => claimGoal(g.def.id)}>
          <Check weight="bold" />
          Claim
        </button>
      )}
    </div>
  )
}

export function GoalsPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const ready = goalsReady(farm)
  const goals = boardGoals(farm)
  return (
    <Shell title="Goals" art={art('trophy')} sub={ready ? <span className="tag ok">{ready} to claim</span> : <span className="tag">Reach one for a reward</span>} onClose={close}>
      <div className="farm-goals">
        {goals.map((g) => (
          <GoalCard key={g.def.id} g={g} />
        ))}
      </div>
    </Shell>
  )
}

/** The trophy in the chips at the top: how many goals wait to be claimed; it tells you, once, when one is reached. */
export function useGoalsReady() {
  useFarm((s) => s.rev)
  const ready = goalsReady(farm)
  const told = useRef(ready)
  useEffect(() => {
    if (ready > told.current) {
      const g = boardGoals(farm, 1)[0]
      if (g?.done) useHome.getState().showToast(`Goal reached: ${g.def.say(g.target)} — claim it on the board`, 'trophy')
    }
    told.current = ready
  }, [ready])
  return ready
}
