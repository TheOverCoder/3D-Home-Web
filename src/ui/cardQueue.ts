// The cards that open by themselves (update-v1/CONTRACTS.md §1.6): what came while you were away, the day's gift, what a
// level opened, the first letter, one question. They come one at a time, each only when nothing is over the game, in
// one order, and only a few a visit: the rest wait where they live (the gift in the corner menu, an unlock on the level
// chip, a letter on the mailbox's flag), never lost. This is the pure core, with no React and no DOM, so the sim's
// journey reads the same order and budget; 08 adds the watcher that opens them. Not yet used by the game.

/** The cards that open by themselves, in the order they come. A season has no card of its own: its arrival is a line
 *  of the daily gift's [review: update-v1/JOURNEY.md fix 2; 'season' after 'daily' gives it one]. */
export const CARD_ORDER = ['away', 'daily', 'unlocked', 'letter', 'counts'] as const
export type CardId = (typeof CARD_ORDER)[number]

/** [review: JOURNEY.md fix 2] At most this many open by themselves in one visit, the welcome back counted. A visit is a
 *  load, or a return after AWAY_TELLS (2 min) or more away. */
export const VISIT_MOST = 2

/** [review: JOURNEY.md fix 3] The cards that may open by themselves in the visit a new farm's first steps end in (beside
 *  the steps' own card): the rest wait for the next visit, so the end of the steps lands over three visits. */
export const AFTER_STEPS: readonly CardId[] = ['away']

export interface QueueNow {
  /** the cards that want to open now */
  due: readonly CardId[]
  /** the cards opened by themselves this visit */
  opened: readonly CardId[]
  /** nothing is over the game (no panel, film, drive, curtain or toast) */
  free: boolean
  /** the card open now, if one is */
  showing: CardId | null
  /** a new farm's first steps ended in this visit */
  stepsEndedThisVisit: boolean
}

/** The card to open now, or null: none while one shows or the game is not free, none past the visit's budget, only
 *  those AFTER_STEPS in the visit the steps ended in, none opened twice a visit; else the first due, in order. */
export function nextCard(q: QueueNow): CardId | null {
  if (q.showing !== null || !q.free || q.opened.length >= VISIT_MOST) return null
  for (const id of CARD_ORDER) {
    if (!q.due.includes(id) || q.opened.includes(id)) continue
    if (q.stepsEndedThisVisit && !AFTER_STEPS.includes(id)) continue
    return id
  }
  return null
}
