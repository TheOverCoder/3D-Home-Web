import { garmentUrl } from '../farm/icons'
import type { Garment } from '../farm/outfit'

/** A garment's picture (its model in its colour, src/assets/garments): the wardrobe's tiles, the level's card, the show
 *  of a new garment. */
export function GarmentPic({ g, className }: { g: Garment; className?: string }) {
  return (
    <span className={`item-pic garment-pic${className ? ` ${className}` : ''}`}>
      <img className="art" src={garmentUrl(g.id)} alt="" draggable={false} />
    </span>
  )
}
