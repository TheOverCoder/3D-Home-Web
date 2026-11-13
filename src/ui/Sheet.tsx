import { useEffect, useState } from 'react'
import { farm, useFarm } from '../farm/state'
import { art } from './art'

// The game's panels (the farm's, the furniture shop's): a sheet with its picture, a title of a few words, a row of
// chips, what it is for, and a close button; and the coins in them.

export { Shell, Coins } from './Shell'

/** What you have, as a chip. */
export const Purse = () => {
  useFarm((s) => s.rev)
  return (
    <span className="tag">
      <img src={art('coin')} alt="" />
      {farm.coins}
    </span>
  )
}

/** How long a confirm button waits before it can be pressed: a second tap of the button that opened the card (a
 *  double tap, a key held down) lands on nothing. */
export const ARM_MS = 450

/** False until a card's confirm button may be pressed (ARM_MS after the card opens). */
export function useArmed() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_MS)
    return () => clearTimeout(t)
  }, [])
  return armed
}
