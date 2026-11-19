import { useEffect, useRef, type ReactNode } from 'react'
import { art } from './art'
import { PanelSheet } from './PanelSheet'

// A game panel's card and its coins, with nothing of the farm in them: the game's panels use them (through ./Sheet),
// and so does the design lab (lab/), which shows them without the game.

/**
 * A panel: its picture, a title of a few words, a row of chips, what it is for, and a close button (`className`: its
 * own look, on the sheet's root). It is a `card` of the one sheet (./PanelSheet.tsx): from the bottom upright, at the
 * bottom on the right sideways, as tall as what it holds; swiped from its head, it goes out the way it came on ✕, the
 * shade or Esc, then `onClose`. Being a card it is over any sheet under it (Esc goes to it first). What it holds keeps
 * its own flow (its margins), and its first button takes the keyboard's focus, as a panel's always has (Enter presses
 * it).
 */
export function Shell({ title, art: pic, sub, className, children, onClose }: { title: string; art?: string; sub?: ReactNode; className?: string; children: ReactNode; onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    body.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])
  return (
    <PanelSheet label={title} title={title} pic={pic} sub={sub} size="card" className={`shell${className ? ` ${className}` : ''}`} onClose={onClose}>
      <div className="shell-body" ref={body}>
        {children}
      </div>
    </PanelSheet>
  )
}

/** A price: the coin and how many. */
export const Coins = ({ n }: { n: number }) => (
  <span className="farm-coins">
    <img src={art('coin')} alt="" />
    {n}
  </span>
)
