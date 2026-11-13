import { useEffect, useState, type CSSProperties } from 'react'
import { PRODUCE, type ProduceId } from '../farm/data'
import type { PictureId } from '../farm/icons'
import { GARMENTS } from '../farm/outfit'
import { ITEM_IDS, renderGarmentArt, renderItemArt } from './itemArt'

// The item pictures drawn from the models (open the site with ?items): each at the size the panels show it, on
// the paper, on the dark chip, and small, as in a chip — the sizes a picture has to read at.
// `scripts/render-item-art.mjs` saves them from here (`window.__itemArt`).

const page: CSSProperties = { position: 'fixed', inset: 0, overflow: 'auto', padding: 16, background: 'var(--paper)', color: 'var(--ink)', font: '500 15px var(--font-text)' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }
const card: CSSProperties = { margin: 0, padding: 10, display: 'grid', justifyItems: 'center', gap: 6, borderRadius: 'var(--r-card)', background: 'var(--paper-2)' }
const dark: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: 'var(--night)' }

export function ItemArtPage() {
  const [items, setItems] = useState<[PictureId, string][]>([])
  const [clothes, setClothes] = useState<[string, string][]>([])
  useEffect(() => {
    const size = Number(new URLSearchParams(location.search).get('size')) || 256
    const out = {} as Record<PictureId, string>
    for (const id of ITEM_IDS) out[id] = renderItemArt(id, size)
    // the wardrobe's garments, smaller (a tile in its sheet)
    const worn: Record<string, string> = {}
    for (const g of GARMENTS) worn[g.id] = renderGarmentArt(g)
    const w = window as unknown as { __itemArt: Record<string, string>; __garmentArt: Record<string, string> }
    w.__garmentArt = worn
    w.__itemArt = out
    setItems(Object.entries(out) as [PictureId, string][])
    setClothes(Object.entries(worn))
  }, [])
  return (
    <main style={page}>
      <h1 style={{ margin: '0 0 12px', font: '600 26px var(--font-display)' }}>Item pictures</h1>
      <div style={grid}>
        {items.map(([id, url]) => (
          <figure key={id} style={card}>
            <img src={url} alt="" width={128} height={128} />
            <span style={dark}>
              <img src={url} alt="" width={40} height={40} />
              <img src={url} alt="" width={24} height={24} />
            </span>
            <figcaption>{PRODUCE.find((p) => p.id === (id as ProduceId))?.name ?? id}</figcaption>
          </figure>
        ))}
      </div>
      <h1 style={{ margin: '20px 0 12px', font: '600 26px var(--font-display)' }}>Garments</h1>
      <div style={grid}>
        {clothes.map(([id, url]) => (
          <figure key={id} style={card}>
            <img src={url} alt="" width={96} height={96} />
            <figcaption>
              {GARMENTS.find((g) => g.id === id)?.name} · {GARMENTS.find((g) => g.id === id)?.level}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  )
}
