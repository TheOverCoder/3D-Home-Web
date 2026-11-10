import { art } from '../ui/art'
import type { ProduceId } from './data'

// The pictures of the farm's goods: each drawn from its model (src/models/goods.ts, by src/models/itemArt.ts) and
// saved as a WebP file in src/assets/items by scripts/render-item-art.mjs. The panels, the action button, the
// toasts and the buyers' speech bubbles all show these, so a good looks the same wherever it appears. Coins are
// the interface's coin (src/ui/art.ts).

const files = import.meta.glob('../assets/items/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** The picture of a good (or of coins), as an image URL. */
export function iconUrl(id: ProduceId | 'coin'): string {
  return id === 'coin' ? art('coin') : files[`../assets/items/${id}.webp`]
}

const images = new Map<string, Promise<HTMLImageElement>>()

/** The pictures as loaded images, to draw on a canvas (each loaded once). */
export function iconImages(ids: (ProduceId | 'coin')[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    ids.map((id) => {
      let p = images.get(id)
      if (!p) {
        const img = new Image()
        img.src = iconUrl(id)
        p = img.decode().then(() => img)
        images.set(id, p)
      }
      return p
    }),
  )
}
