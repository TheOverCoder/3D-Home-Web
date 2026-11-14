import { useEffect, useRef, useState } from 'react'

// What the user says about the designs in the sandbox: a ✓ or ✗ on each variant, notes (on a variant, or on one point
// of it), and the screens they ask to be designed next. Kept in the published lab's own database (the artifact's `db`
// capability: the main agent reads it with ArtifactData and hands it to the designer as lab/feedback/<board>.json), or,
// where the page has no database (`npm run lab`, a copy of the page), in this browser only.
//
// The database: reviews/<board> = Review, requests/screens = { ids: { <map screen id>: true } }.

export type Verdict = 'yes' | 'no'

export interface Note {
  id: string
  variant: string
  state: string
  /** the phone's way round when it was written: a point is on that screen */
  kind: 'upright' | 'sideways'
  /** a point on the design, as a part of its width and height (0–1); none for a note on the whole variant */
  x?: number
  y?: number
  text: string
  /** when, in ms since 1970 */
  at: number
}

export interface Review {
  verdicts: Record<string, Verdict>
  notes: Note[]
}

export const NO_REVIEW: Review = { verdicts: {}, notes: [] }

// the platform's database, as far as this page uses it (lab/README.md; the artifact-capabilities contract)
interface DocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface Db {
  doc(path: string): { set(data: Record<string, unknown>): Promise<void>; onSnapshot(next: (s: DocSnap) => void, error?: (e: { code: string }) => void): () => void }
  collection(path: string): { onSnapshot(next: (s: { docs: DocSnap[] }) => void, error?: (e: { code: string }) => void): () => void }
}
type ClaudeHost = { use(name: 'db'): Promise<Db | null> }

const LOCAL = 'lab-reviews'
interface Kept {
  reviews: Record<string, Review>
  requests: Record<string, boolean>
}
function readLocal(): Kept {
  try {
    const k = JSON.parse(localStorage.getItem(LOCAL) ?? 'null') as Partial<Kept> | null
    return { reviews: k?.reviews ?? {}, requests: k?.requests ?? {} }
  } catch {
    return { reviews: {}, requests: {} }
  }
}
function writeLocal(k: Kept) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(k))
  } catch {
    // private window: kept for this visit only
  }
}

const asReview = (d: Record<string, unknown> | undefined): Review => ({
  verdicts: (d?.verdicts as Record<string, Verdict>) ?? {},
  notes: Array.isArray(d?.notes) ? (d.notes as Note[]) : [],
})

/** Where the feedback is kept: the lab's shared database, this browser only, or still asking. */
export type Keeping = 'loading' | 'shared' | 'local'

export function useReviews() {
  const [kept, setKept] = useState<Kept>(readLocal)
  const [keeping, setKeeping] = useState<Keeping>('loading')
  const db = useRef<Db | null>(null)
  const latest = useRef(kept)
  latest.current = kept

  useEffect(() => {
    let stop: (() => void)[] = []
    let gone = false
    const host = (window as unknown as { claude?: ClaudeHost }).claude
    if (!host?.use) {
      setKeeping('local')
      return
    }
    // the database answers, or after 10 s the page keeps its feedback here
    const late = setTimeout(() => !gone && db.current == null && setKeeping('local'), 10_000)
    host
      .use('db')
      .then((d) => {
        if (gone) return
        if (!d) {
          setKeeping('local')
          return
        }
        db.current = d
        setKeeping('shared')
        const fail = () => setKeeping('local')
        stop.push(
          d.collection('reviews').onSnapshot((s) => {
            const reviews: Record<string, Review> = {}
            for (const doc of s.docs) if (doc.exists) reviews[doc.id] = asReview(doc.data())
            setKept((k) => ({ ...k, reviews }))
          }, fail),
          d.doc('requests/screens').onSnapshot((s) => {
            const ids = (s.exists ? (s.data()?.ids as Record<string, boolean>) : null) ?? {}
            setKept((k) => ({ ...k, requests: ids }))
          }, fail),
        )
      })
      .catch(() => !gone && setKeeping('local'))
    return () => {
      gone = true
      clearTimeout(late)
      for (const s of stop) s()
      stop = []
    }
  }, [])

  // one write at a time for each document: the next waits for the one before
  const queue = useRef(new Map<string, Promise<void>>())
  const save = (path: string, body: Record<string, unknown>) => {
    const d = db.current
    if (!d) return
    const before = queue.current.get(path) ?? Promise.resolve()
    const next = before
      .then(() => d.doc(path).set(body))
      .catch(() => {
        // refused (a viewer who may not write): this visit keeps it here instead
        setKeeping('local')
        writeLocal(latest.current)
      })
    queue.current.set(path, next)
  }

  const change = (board: string, edit: (r: Review) => Review) => {
    const now = edit(latest.current.reviews[board] ?? NO_REVIEW)
    const k = { ...latest.current, reviews: { ...latest.current.reviews, [board]: now } }
    setKept(k)
    latest.current = k
    if (db.current && keeping !== 'local') save(`reviews/${board}`, { verdicts: now.verdicts, notes: now.notes })
    else writeLocal(k)
  }

  return {
    keeping,
    reviews: kept.reviews,
    requests: kept.requests,
    review: (board: string) => kept.reviews[board] ?? NO_REVIEW,
    /** ✓ or ✗ on a variant; the same again takes it back */
    verdict: (board: string, variant: string, v: Verdict) =>
      change(board, (r) => {
        const verdicts = { ...r.verdicts }
        if (verdicts[variant] === v) delete verdicts[variant]
        else verdicts[variant] = v
        return { ...r, verdicts }
      }),
    addNote: (board: string, note: Omit<Note, 'id' | 'at'>) => change(board, (r) => ({ ...r, notes: [...r.notes, { ...note, id: Math.random().toString(36).slice(2, 10), at: Date.now() }] })),
    removeNote: (board: string, id: string) => change(board, (r) => ({ ...r, notes: r.notes.filter((n) => n.id !== id) })),
    /** ask for a screen to be designed next, or take it back */
    request: (screen: string) => {
      const requests = { ...latest.current.requests }
      if (requests[screen]) delete requests[screen]
      else requests[screen] = true
      const k = { ...latest.current, requests }
      setKept(k)
      latest.current = k
      if (db.current && keeping !== 'local') save('requests/screens', { ids: requests })
      else writeLocal(k)
    },
  }
}
