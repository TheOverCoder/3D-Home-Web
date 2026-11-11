import { useEffect, useRef, useState, type ReactNode } from 'react'
import { farm, useFarm } from '../farm/state'
import { art } from './art'
import { X } from './glyphs'

// The game's panels (the farm's, the furniture shop's): a sheet with its picture, a title of a few words, a row of
// chips, what it is for, and a close button; and the coins in them.

/** A panel: its picture, a title of a few words, a row of chips, what it is for, and a close button. */
export function Shell({ title, art: pic, sub, children, onClose }: { title: string; art?: string; sub?: ReactNode; children: ReactNode; onClose: () => void }) {
  const first = useRef<HTMLDivElement>(null)
  useEffect(() => {
    first.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="farm-backdrop" onClick={onClose}>
      <div className="farm-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} ref={first}>
        <header>
          {pic && <img className="art farm-head-art" src={pic} alt="" />}
          <div className="farm-head-text">
            <h2>{title}</h2>
            {sub && <div className="farm-sub">{sub}</div>}
          </div>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

/** A price: the coin and how many. */
export const Coins = ({ n }: { n: number }) => (
  <span className="farm-coins">
    <img src={art('coin')} alt="" />
    {n}
  </span>
)

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
