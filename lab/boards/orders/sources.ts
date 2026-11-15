import { CROPS, MACHINES, PRODUCERS, type ProduceId } from '../../../src/farm/data'
import type { ArtId } from '../../../src/ui/art'

// For variant E of the order board, a feature the game does not have: a good tapped on an order says where it comes
// from, and "Show me" puts that place on the compass (the game's route walks you there). Where a good comes from is
// read from the game's own tables (CROPS, PRODUCERS, MACHINES); the pictures and words for each place are the lab's
// (SAMPLE: the game would need a word and a picture per place, and a way to mark it on the compass).

export interface Source {
  /** the place: a bed, an animal, the tree, a machine */
  pic: ArtId
  /** "Grows in a bed", "Laid by the hens", "Made at the mill" */
  words: string
  /** the place, for the compass: "Beds", "Hens", "Mill" */
  place: string
  /** what goes in, for a machine */
  from?: ProduceId[]
}

const PLACE: Record<string, { pic: ArtId; words: string; place: string }> = {
  tree: { pic: 'seedling', words: 'Picked from the lemon tree', place: 'Lemon tree' },
  hens: { pic: 'chicken', words: 'Laid by the hens', place: 'Hens' },
  cows: { pic: 'cow', words: 'Milked from the cows', place: 'Cows' },
  sheep: { pic: 'ewe', words: 'Shorn from the sheep', place: 'Sheep' },
  mill: { pic: 'sheaf-of-rice', words: 'Made at the mill', place: 'Mill' },
  loom: { pic: 'yarn', words: 'Woven at the loom', place: 'Loom' },
  oven: { pic: 'shortcake', words: 'Baked in the oven', place: 'Oven' },
}

/** Where a good comes from, by the game's tables. */
export function sourceOf(good: ProduceId): Source {
  if (CROPS.some((c) => c.id === good)) return { pic: 'seedling', words: 'Grows in a bed', place: 'Beds' }
  for (const [id, p] of Object.entries(PRODUCERS)) if (p.good === good) return PLACE[id]
  for (const [id, m] of Object.entries(MACHINES)) {
    const r = m.recipes.find((x) => x.makes === good)
    if (r) return { ...PLACE[id], from: Object.keys(r.needs) as ProduceId[] }
  }
  return { pic: 'wrapped-gift', words: 'A surprise', place: 'Surprises' }
}
