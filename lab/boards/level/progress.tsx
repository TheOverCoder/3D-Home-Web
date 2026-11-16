import { XP_FOR, cropById, type CropId, type ProduceId } from '../../../src/farm/data'
import type { Ready } from '../../../src/farm/levelView'

// What is ready on the farm in the level board's states (LevelPanel reads it from the farm: readyOnFarm in
// src/farm/state.ts), from the game's own numbers: two XP a bed harvested, one a good collected.

/** Beds of a crop ripe: their goods, two XP a bed (gainXp('harvest', 1) per bed). */
export const beds = (id: CropId, n: number): Ready => ({ id, n: n * cropById(id).yield, xp: n * XP_FOR.harvest })
/** Goods to collect from an animal: one XP each (gainXp('collect', n)). */
export const goods = (id: ProduceId, n: number): Ready => ({ id, n, xp: n * XP_FOR.collect })
