import { farmSound, uiClick } from '../../audio/sound'
import { farmFx } from '../../fx/fx'
import { useHome } from '../../store'
import { BEDS, BED_BOX, type BedDef } from '../data'
import { buy, useFarm } from '../state'
import { ShopCard, type ShopActions } from './ShopCard'
import { upgradesView } from './view'

// The farm shop in the game (the shed's button opens it): the designed card (./ShopCard.tsx) fed with the farm's, with
// the game's sounds. An animal or one of the farm's upgrades is bought at once, as ever; a tool or a remote opens its
// card (src/farm/Ladder.tsx), which comes back here; an owned tool's button opens its panel, its ✕ back here too.

/** A puff of dust round each bed just built (one bed, or every bed of a field). */
export const dustOver = (beds: BedDef[]) => beds.forEach((b) => farmFx('dust', b.x, 0.04, b.z, { half: BED_BOX }))

const SHOP = { kind: 'shop' } as const

const actions: ShopActions = {
  buy: (id) => {
    if (!buy(id)) return false
    uiClick()
    farmSound('build')
    if (id === 'east' || id === 'west') dustOver(BEDS.filter((b) => b.expansion === id))
    return true
  },
  ask: (id) => useHome.getState().openPanel({ kind: 'ladder', id, from: SHOP }),
  open: (tool) => useHome.getState().openPanel({ kind: 'tool', tool, from: SHOP }),
}

export function ShopPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  return <ShopCard v={upgradesView()} act={actions} onClose={close} />
}
