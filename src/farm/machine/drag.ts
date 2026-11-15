import { animate, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SPRING } from '../../ui/motion'

// Drag and drop for the machine panel, by finger and by mouse: Motion moves a picture (the ghost) that follows the
// finger, the panel says what lies under it as it moves (`onOver`) and what a drop does (`onDrop`). No library of its
// own: pointer events, and what lies under the ghost found where it is as it moves (the panel measures its places
// where they are laid out, not where they are sliding to).
//
// A finger and a scrolling list must not fight: where nothing scrolls (`axis: 'none'`, the queue's places) the drag
// starts as the finger moves; in a list that scrolls along one way (`'x'` or `'y'`) a move along it scrolls, a move
// across it starts the drag at once, and a finger held still a moment (HOLD) lifts the thing too (the phones' own
// "hold to pick up"). A mouse starts a drag after a few pixels. A press that never became a drag is a tap (the
// element's own click: the same as Enter or Space for a keyboard).

/** How the list a draggable is in scrolls: not at all, or along x or y. */
export type Axis = 'none' | 'x' | 'y'

export interface Lifted<P> {
  payload: P
  /** the picture carried */
  src: string
  /** its size as it was lifted (px), and whether a finger carries it (it rides above the finger then) */
  size: number
  touch: boolean
}

/** ms a still finger is held before it lifts the thing in a list that scrolls */
export const HOLD = 260
/** px a finger (or a mouse) may wander before a press is a move */
const SLOP = { touch: 8, mouse: 4 }
/** px the ghost rides above a finger, so the finger does not hide it */
const ABOVE = 46

interface Pending<P> {
  id: number
  x0: number
  y0: number
  touch: boolean
  axis: Axis
  payload: P
  src: string
  pic: HTMLElement
  timer: number
  live: boolean
}

export function useDragDrop<P>({
  onLift,
  onOver,
  onDrop,
}: {
  onLift?: (p: P) => void
  /** the ghost's middle as it moves, and the topmost element there (or null) */
  onOver: (at: { x: number; y: number }, el: Element | null, p: P) => void
  /** the drop: where the ghost lands — a function that finds that place once the panel has drawn the change (null:
   *  it goes back where it came from) */
  onDrop: (p: P) => (() => DOMRect | null) | null
}) {
  const [lifted, setLifted] = useState<Lifted<P> | null>(null)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const ox = useMotionValue(0)
  const oy = useMotionValue(0)
  const x = useTransform(() => px.get() + ox.get())
  const y = useTransform(() => py.get() + oy.get())
  const scale = useMotionValue(1)
  const rotate = useMotionValue(0)
  const opacity = useMotionValue(1)
  const st = useRef<Pending<P> | null>(null)
  const from = useRef({ x: 0, y: 0 })
  /** a drag happened since the last press: its click is not a tap */
  const dragged = useRef(false)
  const cb = useRef({ onLift, onOver, onDrop })
  cb.current = { onLift, onOver, onDrop }

  const over = () => {
    const s = st.current
    if (!s?.live) return
    const at = { x: px.get() + ox.get(), y: py.get() + oy.get() }
    const hit = document.elementsFromPoint(at.x, at.y).find((e) => !e.closest('.mp-ghost')) ?? null
    cb.current.onOver(at, hit, s.payload)
  }

  const lift = (s: Pending<P>, cx: number, cy: number) => {
    s.live = true
    dragged.current = true
    window.clearTimeout(s.timer)
    const r = s.pic.getBoundingClientRect()
    const size = Math.max(36, Math.min(r.width, r.height))
    from.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    px.set(cx)
    py.set(cy)
    // the picture leaves its place from where it was and rides to the finger (above it, for a finger)
    ox.set(from.current.x - cx)
    oy.set(from.current.y - cy)
    opacity.set(1)
    scale.set(1)
    rotate.set(0)
    animate(ox, 0, SPRING.pop)
    animate(oy, s.touch ? -ABOVE : -4, SPRING.pop)
    animate(scale, 1.22, SPRING.pop)
    animate(rotate, -6, SPRING.pop)
    navigator.vibrate?.(8)
    setLifted({ payload: s.payload, src: s.src, size, touch: s.touch })
    cb.current.onLift?.(s.payload)
    over()
  }

  const finish = (dropped: boolean) => {
    const s = st.current
    if (!s) return
    window.clearTimeout(s.timer)
    st.current = null
    if (!s.live) return
    const find = dropped ? cb.current.onDrop(s.payload) : null
    // the offset folded into the point, so the ghost flies from exactly where it is (the lift's springs stopped first,
    // or they would carry on pulling it above the finger)
    for (const v of [px, py, ox, oy]) v.stop()
    px.set(px.get() + ox.get())
    py.set(py.get() + oy.get())
    ox.set(0)
    oy.set(0)
    const land = (to: { x: number; y: number }, size: number | null) => {
      const spring = { ...SPRING.pop, restDelta: 0.5 }
      animate(px, to.x, spring)
      animate(py, to.y, spring)
      animate(rotate, 0, SPRING.pop)
      animate(scale, size ? Math.max(0.6, size) : 1, SPRING.pop)
      void animate(opacity, 0, { duration: 0.12, delay: size ? 0.16 : 0.2 }).then(() => setLifted(null))
    }
    if (!find) {
      land(from.current, null)
      return
    }
    navigator.vibrate?.(12)
    // where it lands is known once the panel has drawn the change: two frames on
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const r = find()
        if (!r) {
          animate(scale, 0.4, { duration: 0.16 })
          void animate(opacity, 0, { duration: 0.16 }).then(() => setLifted(null))
          return
        }
        // shrunk (or grown) to the picture it becomes: the ghost's picture is three quarters of its plate
        const ghost = document.querySelector('.mp-ghost')?.getBoundingClientRect()
        land({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, ghost ? r.width / ((ghost.width / scale.get()) * 0.75) : 1)
      }),
    )
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = st.current
      if (!s || e.pointerId !== s.id) return
      if (s.live) {
        px.set(e.clientX)
        py.set(e.clientY)
        over()
        return
      }
      const dx = e.clientX - s.x0
      const dy = e.clientY - s.y0
      const far = Math.hypot(dx, dy)
      if (!s.touch) {
        if (far > SLOP.mouse) lift(s, e.clientX, e.clientY)
        return
      }
      if (far <= SLOP.touch) return
      // a finger: where nothing scrolls, any move; in a list, a move across it (along it, the list scrolls)
      const across = s.axis === 'y' ? Math.abs(dx) > Math.abs(dy) * 1.2 : s.axis === 'x' ? Math.abs(dy) > Math.abs(dx) * 1.2 : true
      if (across) lift(s, e.clientX, e.clientY)
      else {
        window.clearTimeout(s.timer)
        st.current = null
      }
    }
    const up = (e: PointerEvent) => {
      if (st.current && e.pointerId === st.current.id) finish(true)
    }
    const cancel = (e: PointerEvent) => {
      if (st.current && e.pointerId === st.current.id) finish(false)
    }
    // a finger carrying something never scrolls the page under it (a listener that may cancel, from the start)
    const still = (e: TouchEvent) => {
      if (st.current?.live && e.cancelable) e.preventDefault()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && st.current?.live) {
        e.stopPropagation()
        finish(false)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchmove', still, { passive: false })
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchmove', still)
      window.removeEventListener('keydown', key, true)
      if (st.current) window.clearTimeout(st.current.timer)
    }
    // the handlers read everything through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** On a draggable's pointerdown: what it carries, the picture it shows, and how its list scrolls. */
  const press = (e: ReactPointerEvent<HTMLElement>, payload: P, o: { src: string; axis: Axis; pic?: HTMLElement | null }) => {
    dragged.current = false
    if (st.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const touch = e.pointerType !== 'mouse'
    const s: Pending<P> = { id: e.pointerId, x0: e.clientX, y0: e.clientY, touch, axis: o.axis, payload, src: o.src, pic: o.pic ?? e.currentTarget, timer: 0, live: false }
    // a finger held still lifts it (where the list scrolls, the one way to drag along it)
    if (touch) s.timer = window.setTimeout(() => st.current === s && !s.live && lift(s, s.x0, s.y0), HOLD)
    st.current = s
  }

  return {
    lifted,
    press,
    /** true once, after a press that became a drag: its click is not a tap */
    wasDrag: () => {
      const d = dragged.current
      dragged.current = false
      return d
    },
    ghost: { x, y, scale, rotate, opacity },
  }
}
