import { art } from '../ui/art'
import { TOOLS, type ProduceId, type ToolKind } from './data'
import type { ShopKind } from './decor'
import type { SkinStyle } from './skins'

// The pictures of the farm's goods: each drawn from its model (src/models/goods.ts, by src/models/itemArt.ts) and
// saved as a WebP file in src/assets/items by scripts/render-item-art.mjs. The panels, the action button, the
// toasts and the buyers' speech bubbles all show these, so a good looks the same wherever it appears. Coins are
// the interface's coin (src/ui/art.ts).

const files = import.meta.glob('../assets/items/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const garments = import.meta.glob('../assets/garments/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const decor = import.meta.glob('../assets/decor/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const skins = import.meta.glob('../assets/skins/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** What has a picture of its own, drawn from its model: every good, the silo and the barn. */
export type PictureId = ProduceId | 'silo' | 'barn'

/** The picture of a good, a farm building (or of coins), as an image URL. (One whose picture is not drawn yet shows the
 *  basket rather than a broken image.) */
export function iconUrl(id: PictureId | 'coin'): string {
  return id === 'coin' ? art('coin') : (files[`../assets/items/${id}.webp`] ?? art('basket'))
}

/** The picture of a kind the farm's shop sells (src/farm/decor.ts), drawn from its model and saved the same way
 *  (src/models/itemArt.ts, renderShopArt); a kind not drawn yet shows the seedling. */
export const shopArtUrl = (kind: ShopKind): string => decor[`../assets/decor/${kind}.webp`] ?? art('seedling')

/** A tool's skin's picture (src/farm/skins.ts), drawn from its model and saved the same way (src/models/itemArt.ts,
 *  renderSkinArt); one not drawn yet shows the tool's own picture. */
export const skinArtUrl = (kind: ToolKind, style: SkinStyle): string => skins[`../assets/skins/${kind}-${style}.webp`] ?? art(TOOLS[kind].art)

/** A garment's picture (src/farm/outfit.ts), drawn from the people engine's model in its colour and saved the same way
 *  (src/models/itemArt.ts, renderGarmentArt). */
export const garmentUrl = (id: string): string | undefined => garments[`../assets/garments/${id}.webp`]

const images = new Map<string, Promise<HTMLImageElement>>()

/** The pictures as loaded images, to draw on a canvas (each loaded once). */
export function iconImages(ids: (PictureId | 'coin')[]): Promise<HTMLImageElement[]> {
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
