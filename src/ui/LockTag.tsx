import { useAnimate } from 'motion/react'
import { DID, NOPE } from './motion'

// The one face of a thing not open yet (src/farm/unlocks.ts; the design lab's board "unlocks", C): the level card's
// berry ribbon with the level it opens at, "Level 6", where its price would be — across a card's top corner, as the
// tag on the thing itself, beside a machine's picture on the prompt. Its picture is faded (`.locked .art`); it is shown,
// not hidden: what is locked is what comes next. A tap on it shakes it and pops its ribbon (the words already say why).

/** The ribbon: "Level N", or words of its own ("Opens at level 5"). `big`: where a button stood (a card's Build). */
export function LockTag({ level, words, big }: { level: number; words?: string; big?: boolean }) {
  return <span className={`lock-tag ribbon${big ? ' big' : ''}`}>{words ?? `Level ${level}`}</span>
}

/** The ribbon across a card's top corner: its left one; a row's (`right`) its right one, where its button was. */
export function LockCorner({ level, right }: { level: number; right?: boolean }) {
  return (
    <span className={`lock-corner${right ? ' right' : ''}`} aria-hidden="true">
      <LockTag level={level} />
    </span>
  )
}

/** The words a locked thing says to a screen reader, after its name. */
export const opensWords = (level: number) => `opens at level ${level}`

/** A locked thing's answer to a tap: `[ref, nope]` — a short shake of the element, its ribbon popping. */
export function useNope<T extends HTMLElement>() {
  const [scope, animate] = useAnimate<T>()
  const nope = () => {
    if (!scope.current) return
    void animate(scope.current as Element, NOPE.keyframes, NOPE.options)
    const ribbon = scope.current.querySelector('.lock-tag')
    if (ribbon) void animate(ribbon, DID.keyframes, DID.options)
  }
  return [scope, nope] as const
}
