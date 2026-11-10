import { iconUrl } from '../farm/icons'
import type { ProduceId } from '../farm/data'

/**
 * A good's picture with how many, wherever goods change hands or go into a machine — a buyer's order, the basket,
 * what the oven takes, the compass: the number in a small see-through round badge on the picture's lower corner,
 * always (1 included), so the picture is never repeated just to say how many.
 */
export function ItemPic({ id, count, className }: { id: string; count?: number; className?: string }) {
  return (
    <span className={`item-pic${className ? ` ${className}` : ''}`}>
      <img className="art" src={iconUrl(id as ProduceId)} alt="" draggable={false} />
      {count !== undefined && <b className="qty">{count}</b>}
    </span>
  )
}
