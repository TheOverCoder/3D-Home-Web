import { useCallback, useEffect, useRef } from 'react'
import { Loading, type LoadView as GameView } from '../../../src/ui/Loading'
import { loadView, useLive, type LoadingState } from './load'

// Today, drawn live: the game's own loading screen (src/ui/Loading.tsx, its CSS and its tractor) fed with the board's
// state as it goes on, so a new proposal stands beside the screen the game really has now (the picture of round 5 is
// from before the tractor was drawn again). The bar is the game's one animation of its fill on the compositor: here it
// runs from where the state puts it toward the creep's end (0.99) over the step's first-load time, and fills in a
// moment once ready, as src/ui/loadPace.ts does.

/** A translate for the bar's fill showing `v` of it (src/ui/Loading.tsx, barAt). */
const barAt = (v: number) => `${(Math.max(0.02, v) - 1) * 100}% 0`

export function TodayLive({ s, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const live = useLive(s)
  const v = loadView(live)
  const el = useRef<HTMLSpanElement | null>(null)
  const at = useRef({ p: v.p, ready: v.ready })
  at.current = { p: v.p, ready: v.ready }
  const run = useCallback((node: HTMLSpanElement | null) => {
    el.current = node
    if (!node || typeof node.animate !== 'function') return
    node.animate([{ translate: barAt(at.current.p) }, { translate: barAt(0.99) }], { duration: 30_000, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' })
  }, [])
  useEffect(() => {
    const node = el.current
    if (!v.ready || !node || typeof node.animate !== 'function') return
    const from = getComputedStyle(node).translate || barAt(at.current.p)
    for (const a of node.getAnimations()) a.cancel()
    node.animate([{ translate: from }, { translate: barAt(1) }], { duration: 450, easing: 'ease-out', fill: 'forwards' })
  }, [v.ready])
  // a tap once ready goes on, as in the game (the menu takes its place)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => addEventListener('click', onPlay, { once: true }), 300)
    return () => {
      clearTimeout(t)
      removeEventListener('click', onPlay)
    }
  }, [v.ready, onPlay])
  const game: GameView = { p: v.p, bar: run, pct: v.pct, step: v.step, line: v.line, left: v.left, ready: v.ready, again: v.again, offline: false }
  return <Loading v={game} />
}
