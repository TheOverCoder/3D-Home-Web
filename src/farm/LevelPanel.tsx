import { flyCoins } from '../fx/coins'
import { coinsToFly, reducedMotion } from '../fx/fx'
import { useHome } from '../store'
import { LevelCard } from './LevelCard'
import { levelView } from './levelView'
import { claimLevel, farm, useFarm } from './state'

// The level's card (the level chip at the top opens it): how much XP is left to the next level, and what that level
// brings — its coins, and a garment for the wardrobe every fifth level, shown big so it is plain that it comes next.
// When the next garment is further off, which level brings it. The coins of the levels reached are claimed here. How it
// looks is ./LevelCard.tsx.

export function LevelPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const claim = (button: HTMLElement) => {
    const r = button.getBoundingClientRect()
    const coins = claimLevel()
    if (coins > 0 && !reducedMotion()) flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(coins))
  }
  return <LevelCard v={levelView(farm.xp.points, farm.xp.paid)} onClaim={claim} onClose={close} />
}
