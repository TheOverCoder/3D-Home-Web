import { useEffect, useRef } from 'react'
import { Html } from '@react-three/drei'
import { Vector3, type Camera, type Object3D } from 'three'
import { uiClick } from '../audio/sound'
import { farm, useFarm } from '../farm/state'
import { coarsePointer } from '../lib/device'
import { tagOf } from '../lib/interaction'
import { touchLayout } from '../lib/stick'
import { busy, useHome } from '../store'
import { art } from './art'
import './ThingTag.css'

// The tag on the thing you look at: a gear when something can be set about it (a bed: what it always grows), a price
// tag — a coin and the price — when it is for sale (a staked-out bed to build, a field to buy). It turns up on the
// thing itself, a little above and to the right of where you look, and stays whole on the screen (clear of the touch
// controls) when the thing is near an edge; tap it (or press G) to open its card, which asks before anything is
// spent. Never on the action button: that only ever does what one press does.

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

/** Where the tag sits from the point it marks: a little above and to the right. */
const OFFSET_X = 40
const OFFSET_Y = -34
/** Kept this far inside the screen's edges and the touch controls. */
const MARGIN = 10
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const at = new Vector3()

/** The tag's place on the screen: beside the point it marks, moved in as far as it takes to show whole — inside the
 *  screen, above the touch controls in the corners and the prompt along the bottom. */
function placeTag(el: { current: HTMLElement | null }) {
  return (obj: Object3D, camera: Camera, size: { width: number; height: number }) => {
    at.setFromMatrixPosition(obj.matrixWorld).project(camera)
    const halfW = (el.current?.offsetWidth || 44) / 2
    const halfH = (el.current?.offsetHeight || 44) / 2
    const x = clamp(((at.x + 1) * size.width) / 2 + OFFSET_X, MARGIN + halfW, size.width - MARGIN - halfW)
    let below = 0
    if (coarsePointer) {
      below = touchLayout.prompt
      if (x - halfW < touchLayout.left.w) below = Math.max(below, touchLayout.left.h)
      if (x + halfW > size.width - touchLayout.right.w) below = Math.max(below, touchLayout.right.h)
    }
    const lowest = Math.max(MARGIN + halfH, size.height - below - MARGIN - halfH)
    const y = clamp(((1 - at.y) * size.height) / 2 + OFFSET_Y, MARGIN + halfH, lowest)
    return [x, y]
  }
}

export function ThingTag() {
  const tag = useHome((s) => s.tag)
  const occupied = useHome(busy)
  const playing = useHome((s) => s.phase === 'playing')
  useFarm((s) => s.rev) // a price tag shows whether the coins are there
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyG' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const s = useHome.getState()
      if (!s.tag || busy(s)) return
      uiClick()
      tagOf(s.tag.id)?.open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const live = tag && playing && !occupied ? tagOf(tag.id) : null
  if (!tag || !live) return null
  const price = live.kind === 'price'
  const short = price && farm.coins < (live.price ?? 0)
  return (
    <Html key={`${tag.id}|${live.kind}`} position={[live.at.x, live.at.y, live.at.z]} center calculatePosition={placeTag(button)} zIndexRange={[12, 11]} wrapperClass="thing-tag-anchor">
      <button
        ref={button}
        className={`thing-tag ${price ? 'thing-price' : 'thing-gear'}${short ? ' short' : ''}`}
        onClick={() => {
          uiClick()
          live.open()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={live.label}
        title={coarsePointer ? undefined : `${live.label} (G)`}
      >
        <img src={art(price ? 'coin' : 'gear')} alt="" draggable={false} />
        {price && <b>{live.price}</b>}
        {!coarsePointer && <kbd>G</kbd>}
      </button>
    </Html>
  )
}
