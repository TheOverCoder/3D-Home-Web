import { art, type ArtId } from '../../ui/art'
import { CROPS, MACHINES, PRODUCERS, type MachineId, type ProduceId, type ProducerId } from '../data'
import { FRUIT } from '../decor'
import { shopArtUrl } from '../icons'

// Where a good of an order comes from, said in its bubble on the order board (./OrdersBoard.tsx): a bed, an animal,
// a tree or a bush, a machine (and from what) — read from the game's own tables (CROPS, PRODUCERS, MACHINES, FRUIT),
// so a new crop, producer or recipe is here by being a row there.

export interface Source {
  /** the place's picture (an image URL) */
  pic: string
  /** "Grows in a bed", "Laid by the hens", "Made at the mill" */
  words: string
  /** what goes in, for a machine */
  from?: ProduceId[]
}

/** The words and pictures of the places that are not a bed, a fruit plant or a machine of their own words. */
const PRODUCER: Partial<Record<ProducerId, { pic: ArtId; words: string }>> = {
  tree: { pic: 'seedling', words: 'Picked from the lemon tree' },
  hens: { pic: 'chicken', words: 'Laid by the hens' },
  cows: { pic: 'cow', words: 'Milked from the cows' },
  sheep: { pic: 'ewe', words: 'Shorn from the sheep' },
}
const MACHINE: Partial<Record<MachineId, { pic: ArtId; verb: string }>> = {
  mill: { pic: 'sheaf-of-rice', verb: 'Made at' },
  loom: { pic: 'yarn', verb: 'Woven at' },
  oven: { pic: 'shortcake', verb: 'Baked in' },
}

/** Where a good comes from, by the game's tables. */
export function sourceOf(good: ProduceId): Source {
  if (CROPS.some((c) => c.id === good)) return { pic: art('seedling'), words: 'Grows in a bed' }
  for (const [id, p] of Object.entries(PRODUCERS) as [ProducerId, (typeof PRODUCERS)[ProducerId]][]) {
    if (p.good !== good) continue
    if (p.plant) return { pic: shopArtUrl(p.plant), words: `Picked from the ${FRUIT[p.plant].name.toLowerCase()}` }
    const own = PRODUCER[id]
    return own ? { pic: art(own.pic), words: own.words } : { pic: art('seedling'), words: 'Gathered on the farm' }
  }
  for (const [id, m] of Object.entries(MACHINES) as [MachineId, (typeof MACHINES)[MachineId]][]) {
    const r = m.recipes.find((x) => x.makes === good)
    if (!r) continue
    const own = MACHINE[id]
    return { pic: art(own?.pic ?? 'gear'), words: `${own?.verb ?? 'Made at'} the ${m.name.toLowerCase()}`, from: Object.keys(r.needs) as ProduceId[] }
  }
  return { pic: art('wrapped-gift'), words: 'A surprise' }
}
