import { XP_FOR } from '../farm/data'
import type { EndCard, EndThing } from './format'

// What the three animal tools' films share (./coop.ts, ./bucket.ts, ./shears.ts; plans/animal-tools.md §4): every tool
// is the same in play — one good a tap, the same price and the same two ladders — so their end cards are one shape.

/** Where every tool's two ladders start (plans/animal-tools.md §1, TOOL: each place holds 3 at first, a tap takes 1):
 *  the end card's next steps. One for all three, as the game has one TOOL. */
export const TOOL_START = { hold: 3, tap: 1 } as const

/** A tool's end card: its picture and words, the XP its purchase gives (a build, as every ladder's step), what is the
 *  player's now, and its two ladders' first steps (`place`: what one of its places is — a nest, a cow, a sheep). */
export function toolEnd(o: { art: string; title: string; ribbon: string; owns: EndThing[]; place: string }): EndCard {
  return {
    art: o.art,
    title: o.title,
    ribbon: o.ribbon,
    xp: XP_FOR.build,
    owns: o.owns,
    next: [
      { art: 'package', text: `${TOOL_START.hold} a ${o.place} → ${TOOL_START.hold + 1}` },
      { art: 'high-voltage', text: `${TOOL_START.tap} a tap → ${TOOL_START.tap + 1}` },
    ],
  }
}
