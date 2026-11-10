import { useEffect, useState, type CSSProperties } from 'react'
import { produceById, type ProduceId } from '../farm/data'
import { ITEM_IDS, renderItemArt } from './itemArt'

// The item pictures drawn from the models (open the site with ?items): each at the size the panels show it, on
// the paper, on the dark chip, and small, as in a chip — the sizes a picture has to read at.
// `scripts/render-item-art.mjs` saves them from here (`window.__itemArt`).

const page: CSSProperties = { position: 'fixed', inset: 0, overflow: 'auto', padding: 16, background: 'var(--paper)', color: 'var(--ink)', font: '500 15px var(--font-text)' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }
const card: CSSProperties = { margin: 0, padding: 10, display: 'grid', justifyItems: 'center', gap: 6, borderRadius: 'var(--r-card)', background: 'var(--paper-2)' }
const dark: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: 'var(--night)' }

export function ItemArtPage() {
  const [items, setItems] = useState<[ProduceId, string][]>([])
  useEffect(() => {
    const size = Number(new URLSearchParams(location.search).get('size')) || 256
    const out = {} as Record<ProduceId, string>
    for (const id of ITEM_IDS) out[id] = renderItemArt(id, size)
    ;(window as unknown as { __itemArt: Record<string, string> }).__itemArt = out
    setItems(Object.entries(out) as [ProduceId, string][])
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
            <figcaption>{produceById(id).name}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  )
}
