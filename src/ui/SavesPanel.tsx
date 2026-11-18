import { lazy, Suspense } from 'react'
import { art } from './art'

// The farms kept on this device, three places (the design lab's board "saves", D): three tabs at the top — each farm
// with its level's star, a green dot on the one being played — and under them the chosen farm as a card of pictures
// with numbers (its level, its coins, the beds growing, its animals, "Playing now" on the one being played), then one
// big Play, and quieter its file (save it on the device, or load one into this place) and the hold to start it afresh:
// a fill runs across while the finger stays, and only a full hold clears a farm (a slip of the finger never loses
// one). An empty place says so in a picture and a chip (a new farm, with the coins it starts with). Sideways the card
// on the left, the presses on the right. Its moments: a tab — the highlight slides to it and the card turns over to
// that farm; Play — the house hops and the screen goes on into that farm; a full hold — the card turns to an empty place.
// The opening screen's "Load farm" page (./Intro.tsx).
//
// Only the door to it is part of the page shell (with the level's star the opening menu's farm card shows): the list
// itself loads with the game's interface (`SavesList` in ./GameLayer.tsx, with its styles, ./SavesPanel.css), which is
// in by the time the menu shows, so the start screen comes sooner.

const List = lazy(() => import('./GameLayer').then((m) => ({ default: m.SavesList })))

/** A farm's level: the game's star with the number on it. */
export const LevelStar = ({ level, className = '' }: { level: number; className?: string }) => (
  <span className={`level-star ${className}`} aria-label={`Level ${level}`}>
    <img className="art" src={art('glowing-star')} alt="" />
    <b>{level}</b>
  </span>
)

/** The saved farms. `onPlay`: a farm chosen to play (it is the current one already: switched to, or started). */
export function SavesPanel({ onPlay }: { onPlay: () => void }) {
  return (
    <Suspense fallback={null}>
      <List onPlay={onPlay} />
    </Suspense>
  )
}
