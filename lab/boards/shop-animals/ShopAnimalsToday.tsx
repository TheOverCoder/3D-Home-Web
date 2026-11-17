import { UPGRADES } from '../../../src/farm/data'
import type { Act } from '../../board'
import { Behind } from '../animal-tools/parts'
import { farmRows, herdRow, type Row, type ShopState } from './data'
import { RowView, ShopSheet, useShop } from './parts'

// Today: the farm shop as the game has it (src/farm/FarmUI.tsx ShopPanel): one list of every upgrade in the table's
// order — the fields, the line's two ladders, another cow, sheep and hen, sprinklers, compost — each with its picture,
// level, now → next and its price on the button, which buys at once. No tools and no remotes; no locks shown (Part B's
// locked face waits on the unlocks board).

export function ShopAnimalsToday({ s, act }: { s: ShopState; act: Act<ShopState> }) {
  const shop = useShop(s, act)
  const farm = farmRows(s)
  const herds: Record<string, Row> = { cow: herdRow(s, 'cows'), sheep: herdRow(s, 'sheep'), hen: herdRow(s, 'hens') }
  const rows = UPGRADES.map((u) => herds[u.id] ?? farm.find((r) => r.key === u.id)!).map((r): Row => (r.state === 'locked' ? { ...r, state: 'buy', why: undefined, lock: undefined } : r))
  return (
    <>
      <Behind coins={s.coins} level={s.level} />
      <ShopSheet coins={s.coins} onClose={act.close}>
        <div className="farm-shop">
          {rows.map((r) => (
            <RowView key={r.key} r={r} press={shop.press} />
          ))}
        </div>
      </ShopSheet>
      {shop.card}
    </>
  )
}
