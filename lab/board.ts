import type { ReactElement } from 'react'
import type { DeviceId } from './devices'

// A board of the design lab: one piece of the game's interface (the level's card, the opening screen, the settings…),
// the request it answers, the states it is seen in (with data from the game's own pure code), and its variants side by
// side — "today" (what the game has now) and the new ones, A, B, C. Each variant draws the piece in a state; `act` lets
// its buttons do what they would (a claim empties the coins, a close lets it go out and opens it again so its opening
// is seen once more).

export interface Act<S> {
  /** the state changed by a press (a claim) */
  set: (s: S) => void
  /** closed: its way out plays, and it opens again a moment later */
  close: () => void
}

export interface Variant<S> {
  /** 'today', or a letter */
  id: string
  name: string
  /** one or two lines: what is different, in plain words */
  note: string
  /** what moves and when, in plain words (the opening, a press, the moment of the screen) */
  motion?: string
  render: (s: S, act: Act<S>) => ReactElement
}

export interface Board<S> {
  id: string
  title: string
  /** the request, in the user's words */
  ask: string
  /** where it stands: waiting for the user's choice, chosen (and which), or in the game */
  status: 'choose' | 'chosen' | 'live'
  chosen?: string
  /** what this round changed after what the user said (one or two lines), when it is not the first */
  round?: string
  /** the game still behind it: lab/stills/<name>-upright.jpg and -sideways.jpg, or none (a page of its own) */
  still: string
  /** the chip or button of the game's screen it opens from in the sandbox (a name in lab/stills/<still>.json: level,
   *  coins, line, goals, day, settings…); none: it opens from the sandbox's list only */
  spot?: string
  /** its screen in the map of the interface (lab/map.ts): its picture and verdict there, and the sandbox's list */
  screen?: string
  /** the screens it is shown on (upright and sideways when not given) */
  devices?: DeviceId[]
  states: { id: string; name: string; data: S }[]
  variants: Variant<S>[]
}
