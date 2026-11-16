import { useEffect, useState } from 'react'
import { farmSound } from '../audio/sound'
import { flyCoins } from '../fx/coins'
import { coinsToFly, reducedMotion } from '../fx/fx'
import { useHome } from '../store'
import { LevelCard } from './LevelCard'
import { levelView } from './levelView'
import { claimLevel, currentSlot, farm, openGifts, readyOnFarm, sawLevel, useFarm } from './state'

// The level's card (the level chip at the top opens it): how far into the level, its four gift boxes (open what the
// bar has reached, and every one waiting from before), what the next level brings, and the coins of the levels reached
// to claim. It reads the farm; how it looks is ./LevelCard.tsx.

/** The XP the card showed when it was last open (this visit, this farm): what was gained since lights up on its bar. */
let shown: { slot: number; points: number } | null = null

export function LevelPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // as the card opens: what was gained since it was last open, and the level just reached (told once, then seen)
  const [opened] = useState(() => ({
    gain: shown?.slot === currentSlot() ? Math.max(0, farm.xp.points - shown.points) : 0,
    arrived: levelView(farm.xp.points, farm.xp.paid, farm.gifts).arrived,
  }))
  useEffect(() => {
    shown = { slot: currentSlot(), points: farm.xp.points }
    sawLevel()
  }, [])
  const claim = (button: HTMLElement) => {
    const r = button.getBoundingClientRect()
    const coins = claimLevel()
    if (coins > 0 && !reducedMotion()) flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(coins))
  }
  const v = { ...levelView(farm.xp.points, farm.xp.paid, farm.gifts, { gain: opened.gain, ready: readyOnFarm() }), arrived: opened.arrived }
  return <LevelCard v={v} onOpen={openGifts} onClaim={claim} onClose={close} onReveal={() => farmSound('surprise')} />
}
