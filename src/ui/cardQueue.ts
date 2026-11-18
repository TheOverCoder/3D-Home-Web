// The cards that open by themselves (update-v1/CONTRACTS.md §1.6): what came while you were away, the day's gift, what a
// level opened, the first letter. They come one at a time, each only when nothing is over the game, in one order, and
// only a few a visit: the rest wait where they live (the gift in the corner menu, an unlock on the level chip, a letter
// on the mailbox's flag), never lost. Here with no React and no DOM, so the sim's journey (src/sim/journey.ts) reads the
// same order and budget: the pure core first, then the runtime — the cards the game registered and this visit — which
// CardWatcher (./useGameFree.ts) turns, a beat after the game is free.

/** The cards that open by themselves, in the order they come. A season has no card of its own: its arrival is a line
 *  of the daily gift's [review: update-v1/JOURNEY.md fix 2; 'season' after 'daily' gives it one]. No question about
 *  counts is asked (decision 20: no outside analytics in v1). */
export const CARD_ORDER = ['away', 'daily', 'unlocked', 'letter'] as const
export type CardId = (typeof CARD_ORDER)[number]

/** [review: JOURNEY.md fix 2] At most this many open by themselves in one visit, the welcome back counted. A visit is a
 *  load, a return after AWAY_TELLS (2 min) or more away, a new day while the game is open, or another farm. */
export const VISIT_MOST = 2

/** [review: JOURNEY.md fix 3] The cards that may open by themselves in the visit a new farm's first steps end in (beside
 *  the steps' own card): the rest wait for the next visit, so the end of the steps lands over three visits. */
export const AFTER_STEPS: readonly CardId[] = ['away']

/** The cards that may open more than once in a visit: each level's reveal is its own (still within VISIT_MOST). The
 *  rest open once a visit at most: one closed and still due (the day's gift, unclaimed) waits where it lives. */
export const AGAIN: readonly CardId[] = ['unlocked']

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

/** Whether a card can no longer open by itself in this visit: the visit's budget is spent, it opened already (and comes
 *  once a visit), or the first steps ended in this visit and it is not one that may come then. It waits where it lives. */
export function spent(id: CardId, q: Pick<QueueNow, 'opened' | 'stepsEndedThisVisit'>): boolean {
  return q.opened.length >= VISIT_MOST || (q.opened.includes(id) && !AGAIN.includes(id)) || (q.stepsEndedThisVisit && !AFTER_STEPS.includes(id))
}

/** The card to open now, or null: none while one shows or the game is not free; else the first due, in order, that is
 *  not spent (none past the visit's budget, none twice a visit but AGAIN, only those AFTER_STEPS in the visit the steps
 *  ended in). */
export function nextCard(q: QueueNow): CardId | null {
  if (q.showing !== null || !q.free) return null
  return CARD_ORDER.find((id) => q.due.includes(id) && !spent(id, q)) ?? null
}

// ─────────────────────────── the runtime: the cards the game registered, and this visit ───────────────────────────

/** A card as the game registers it (the welcome back, src/farm/AwayPanel.tsx; the day's gift, DailyPanel.tsx; what a
 *  level opened, Unlocked.tsx). */
export interface CardDef {
  /** it wants to open now */
  due(): boolean
  /** opens it */
  open(): void
  /** it is open now (by itself or not) */
  showing(): boolean
  /** this visit can no longer open it by itself: it waits where it lives (a level's reveal is let go: the level card
   *  and the tags keep what it opened) */
  pass?(): void
}

const cards = new Map<CardId, CardDef>()
const listeners = new Set<() => void>()

/** Whatever the queue holds changed (a card registered or gone, one opened, a visit begun): its followers look again. */
export function cardsChanged() {
  for (const f of listeners) f()
}

/** Follows the queue (`cardsChanged`). */
export function subscribeCards(f: () => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

/** A card the game offers; the function returned takes it back (only that registration: a newer one of the same id
 *  stays). */
export function registerCard(id: CardId, def: CardDef): () => void {
  cards.set(id, def)
  cardsChanged()
  return () => {
    if (cards.get(id) !== def) return
    cards.delete(id)
    cardsChanged()
  }
}

/** This visit: the cards opened by themselves in it, and whether a new farm's first steps ended in it. */
let visit: { opened: readonly CardId[]; stepsEnded: boolean } = { opened: [], stepsEnded: false }

/** This visit as it stands. */
export const visitNow = () => visit

/** A visit begins (the page loaded, back after AWAY_TELLS or more, a new day, another farm): its budget is whole. */
export function newVisit() {
  visit = { opened: [], stepsEnded: false }
  cardsChanged()
}

/** A new farm's first steps ended in this visit: only the cards AFTER_STEPS open by themselves in the rest of it. */
export function stepsEndedThisVisit() {
  if (visit.stepsEnded) return
  visit = { ...visit, stepsEnded: true }
  cardsChanged()
}

/** The card open now (by itself or not), or null. */
export function cardShowing(): CardId | null {
  return CARD_ORDER.find((id) => cards.get(id)?.showing()) ?? null
}

/** Whether a card can still open by itself in this visit. */
export const mayOpen = (id: CardId) => !spent(id, { opened: visit.opened, stepsEndedThisVisit: visit.stepsEnded })

/** A beat with the game free (`free`: nothing over it, a toast counted): each card due that this visit can no longer
 *  open is let pass, then the next in order opens, counted in the visit. The card opened, or null. */
export function cardTurn(free: boolean): CardId | null {
  const due = CARD_ORDER.filter((id) => cards.get(id)?.due() ?? false)
  for (const id of due) if (!mayOpen(id)) cards.get(id)?.pass?.()
  const id = nextCard({ due, opened: visit.opened, free, showing: cardShowing(), stepsEndedThisVisit: visit.stepsEnded })
  if (!id) return null
  visit = { ...visit, opened: [...visit.opened, id] }
  cards.get(id)?.open()
  cardsChanged()
  return id
}
