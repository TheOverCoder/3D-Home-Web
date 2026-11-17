import { useEffect, useRef } from 'react'
import { useHome } from '../store'
import { GoalsCard } from './GoalsCard'
import { boardGoals, goalsReady } from './goals'
import { goalsView } from './goalsView'
import { claimGoal, farm, useFarm } from './state'

// The goals board (src/farm/goals.ts): the trophy in the chips at the top opens it, with how many goals are reached
// and wait to be claimed. It reads the farm; how it looks is ./GoalsCard.tsx (the medal case), what it shows
// ./goalsView.ts. A claim is the farm's (claimGoal): its coins, and the building material the silo or the barn is
// shortest of.

export function GoalsPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  return <GoalsCard v={goalsView(farm)} onClaim={claimGoal} onClose={close} />
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
