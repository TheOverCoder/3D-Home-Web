import { useEffect, useRef, type ReactNode } from 'react'
import { art } from './art'
import { X } from './glyphs'

// A game panel's sheet and its coins, with nothing of the farm in them: the game's panels use them (through ./Sheet),
// and so does the design lab (lab/), which shows them without the game.

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
