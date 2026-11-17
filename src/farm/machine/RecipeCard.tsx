import { m, useAnimate } from 'motion/react'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { produceById, type ProduceId } from '../data'
import { iconUrl } from '../icons'
import type { RecipeView } from '../machineView'
import { Clock } from '../../ui/glyphs'
import { ItemPic } from '../../ui/ItemPic'
import { LockTag } from '../../ui/LockTag'
import { EASE, SPRING } from '../../ui/motion'
import { HOLD, type Axis } from './drag'
import { Bump } from './parts'
import { clock, timesCan, type Payload } from './queue'

// A recipe, as a card to pick up: what it makes (its picture, raised on a lip: a thing to take), its time, and what it
// takes — each ingredient's picture with how many the farm has of how many it needs (short: red). Drag it into a place
// of the queue, or tap it: it goes into the next free one. Not open yet at the farm's level: faded, the level it opens
// at on the berry ribbon where its time was; a tap shakes it and says so.

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

export function RecipeCard({
  r,
  full,
  axis,
  carried,
  shake,
  press,
  wasDrag,
  onTap,
  index,
  opening,
}: {
  r: RecipeView
  /** no free place in the queue */
  full: boolean
  axis: Axis
  /** it is being dragged (its picture is the one in the air) */
  carried: boolean
  /** grows by one each time it is tapped without being able to go in: it shakes and shows what is short */
  shake: number
  press: (e: ReactPointerEvent<HTMLElement>, p: Payload, o: { src: string; axis: Axis; pic?: HTMLElement | null }) => void
  wasDrag: () => boolean
  onTap: (r: RecipeView, pic: HTMLElement | null) => void
  index: number
  opening: boolean
}) {
  const made = produceById(r.makes)
  const locked = r.locked !== undefined
  const short = !locked && timesCan(r) === 0
  const pic = useRef<HTMLSpanElement>(null)
  const [scope, animate] = useAnimate()
  useEffect(() => {
    if (shake && scope.current) void animate(scope.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.36 })
  }, [shake, scope, animate])
  const needs = Object.entries(r.needs) as [ProduceId, number][]
  const label = `${cap(made.name)}, ${clock(r.seconds)}: takes ${needs.map(([k, n]) => `${n} ${n === 1 ? produceById(k).name : produceById(k).plural} (you have ${r.have[k] ?? 0})`).join(', ')}${r.can ? ' — add to the queue' : locked ? ` — opens at level ${r.locked}` : short ? ' — not enough in store' : ' — the queue is full'}`
  return (
    <m.button
      ref={scope}
      className={`mp-recipe${locked ? ' locked' : ''}${short ? ' short' : ''}${full && !short && !locked ? ' full' : ''}${carried ? ' carried' : ''}${shake ? ' told' : ''}`}
      aria-label={label}
      aria-disabled={!r.can}
      data-recipe={r.id}
      style={{ touchAction: axis === 'y' ? 'pan-y' : axis === 'x' ? 'pan-x' : 'none' }}
      initial={opening ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING.pop, delay: opening ? 0.16 + index * 0.05 : 0 } }}
      // pressed, a card that can go in rises a little (picked up as the finger holds it); one that cannot just sinks
      whileTap={r.can ? { scale: 1.035, y: -2, transition: { duration: HOLD / 1000, ease: EASE.out } } : { scale: 0.98 }}
      onPointerDown={(e) => r.can && press(e, { kind: 'recipe', recipe: r.id }, { src: iconUrl(r.makes), axis, pic: pic.current })}
      onClick={() => !wasDrag() && onTap(r, pic.current)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="mp-recipe-pic" ref={pic}>
        <ItemPic id={r.makes} count={1} />
      </span>
      <span className="mp-recipe-top">
        <b>{cap(made.name)}</b>
        {locked ? (
          <LockTag level={r.locked!} />
        ) : (
          <span className="tag mp-recipe-time">
            <Clock weight="bold" />
            {clock(r.seconds)}
          </span>
        )}
      </span>
      <span className="mp-recipe-needs">
        {needs.map(([k, n]) => {
          const have = r.have[k] ?? 0
          return (
            <span key={k} className={`mp-need${have < n ? ' lack' : ''}`}>
              <ItemPic id={k} />
              <span className="mp-need-count">
                <Bump n={have} />/{n}
              </span>
            </span>
          )
        })}
      </span>
    </m.button>
  )
}
