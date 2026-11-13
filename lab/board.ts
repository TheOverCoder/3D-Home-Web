import type { ReactElement } from 'react'

// A board of the design lab: one piece of the game's interface (the level's card…), the request it answers, the states
// it is seen in (with data from the game's own pure code), and its variants side by side — "today" (what the game has
// now) and the new ones, A, B, C. Each variant draws the piece in a state; `act` lets its buttons do what they would
// (a claim empties the coins, a close shuts it and opens it again so its opening is seen once more).

export interface Act<S> {
  /** the state changed by a press (a claim) */
  set: (s: S) => void
  /** closed: it opens again a moment later */
  close: () => void
}

export interface Variant<S> {
  /** 'today', or a letter */
  id: string
  name: string
  /** one or two lines: what is different, in plain words */
  note: string
  render: (s: S, act: Act<S>) => ReactElement
}

export interface Board<S> {
  id: string
  title: string
  /** the request, in the user's words */
  ask: string
  /** the game still behind it: one of lab/stills (upright and sideways) */
  still: 'yard'
  states: { id: string; name: string; data: S }[]
  variants: Variant<S>[]
}
