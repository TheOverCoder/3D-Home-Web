import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { uiClick } from '../audio/sound'
import { garmentById, garmentsAt, nextGarment, type Garment, type GarmentSlot } from '../farm/outfit'
import { farm, sawWardrobe, useFarm, wearGarment } from '../farm/state'
import { levelOf } from '../farm/xp'
import { useHome } from '../store'
import { GarmentPic } from '../ui/GarmentPic'
import { X } from '../ui/glyphs'
import { dressView } from './dress'
import './Wardrobe.css'

// The wardrobe's sheet (./Wardrobe.tsx opens it and films you): three tabs, shirts, trousers and hats, each a grid of
// the garments the level has brought (src/farm/outfit.ts) — a tap puts one on at once, and you see it on you; one that
// came since the wardrobe was last open is marked new. Under them, the next garment and the level it comes with. A
// sheet at the bottom on a phone held upright, on the right otherwise: the camera frames you in the rest of the screen.

const TABS: { slot: GarmentSlot; word: string }[] = [
  { slot: 'shirt', word: 'Shirts' },
  { slot: 'trousers', word: 'Trousers' },
  { slot: 'hat', word: 'Hats' },
]

/** The part of the screen the sheet leaves free, for the camera (normalised device coordinates); the chips at the top
 *  are left out too. */
function measure(el: HTMLElement | null) {
  const w = window.innerWidth
  const h = window.innerHeight
  const top = Math.min(h * 0.25, (document.querySelector('.farm-chip')?.getBoundingClientRect().bottom ?? 0) + 8)
  const free = { x0: -1, x1: 1, y0: -1, y1: 1 - (2 * top) / h }
  const r = el?.getBoundingClientRect()
  if (r && r.width > 0) {
    if (r.left > w * 0.25) free.x1 = (2 * r.left) / w - 1
    else if (r.top > h * 0.25) free.y0 = 1 - (2 * r.top) / h
  }
  dressView.free = free
}

export function WardrobePanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const level = levelOf(farm.xp.points)
  // what is new is what came since the wardrobe was last open (the marks stay while it is open)
  const [seen] = useState(() => farm.outfit.seen)
  const [tab, setTab] = useState<GarmentSlot>('shirt')
  const sheet = useRef<HTMLDivElement>(null)
  const owned = garmentsAt(level)
  const next = nextGarment(level)
  const isNew = (g: Garment) => g.level > seen

  useEffect(() => sawWardrobe(), [])
  useLayoutEffect(() => {
    const el = sheet.current
    const again = () => measure(el)
    again()
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(again) : null
    if (el) watch?.observe(el)
    window.addEventListener('resize', again)
    return () => {
      watch?.disconnect()
      window.removeEventListener('resize', again)
      dressView.free = { x0: -1, x1: 1, y0: -1, y1: 1 }
    }
  }, [])
  // its first garment button takes the keyboard's focus (as a panel's first button does)
  useEffect(() => {
    sheet.current?.querySelector<HTMLButtonElement>('.wardrobe-item[aria-pressed="true"]')?.focus({ preventScroll: true })
  }, [])

  const worn = (slot: GarmentSlot) => (slot === 'hat' ? farm.outfit.hat : farm.outfit[slot])
  const wearing = garmentById(worn(tab))
  const list = owned.filter((g) => g.slot === tab)
  const put = (id: string) => {
    if (wearGarment(id)) uiClick()
  }

  return (
    <div className="wardrobe-dock">
      <div className="farm-panel wardrobe" role="dialog" aria-label="Wardrobe" ref={sheet}>
        <header>
          <GarmentPic g={garmentById(farm.outfit.shirt) ?? owned[0]} className="farm-head-art" />
          <div className="farm-head-text">
            <h2>Wardrobe</h2>
            <div className="farm-sub">
              <span className="tag">{wearing ? wearing.name : 'No hat'}</span>
            </div>
          </div>
          <button className="close" onClick={close} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        <div className="wardrobe-tabs" role="tablist">
          {TABS.map((t) => {
            const on = owned.find((g) => g.id === worn(t.slot))
            const fresh = owned.some((g) => g.slot === t.slot && isNew(g))
            return (
              <button key={t.slot} role="tab" aria-selected={tab === t.slot} className={`wardrobe-tab${tab === t.slot ? ' on' : ''}`} onClick={() => setTab(t.slot)}>
                {on ? <GarmentPic g={on} /> : <span className="item-pic garment-pic none" />}
                {t.word}
                {fresh && <i className="wardrobe-new-dot" aria-label="new" />}
              </button>
            )
          })}
        </div>
        <div className="wardrobe-grid" role="tabpanel" aria-label={TABS.find((t) => t.slot === tab)?.word}>
          {tab === 'hat' && (
            <button
              className={`wardrobe-item none${farm.outfit.hat === null ? ' on' : ''}`}
              aria-pressed={farm.outfit.hat === null}
              aria-label="No hat"
              onClick={() => farm.outfit.hat && put(farm.outfit.hat)}
            >
              <X weight="bold" />
            </button>
          )}
          {list.map((g) => (
            <button
              key={g.id}
              className={`wardrobe-item${worn(g.slot) === g.id ? ' on' : ''}`}
              aria-pressed={worn(g.slot) === g.id}
              aria-label={g.name}
              title={g.name}
              onClick={() => worn(g.slot) !== g.id && put(g.id)}
            >
              <GarmentPic g={g} />
              {isNew(g) && <b className="wardrobe-new">New</b>}
            </button>
          ))}
        </div>
        {next && (
          <p className="wardrobe-next">
            <GarmentPic g={next} />
            <span>
              Next: <b>{next.name}</b> at level {next.level}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
