// Where a farm is kept on the device (src/farm/state/save.ts): three save slots, the first under the original key so
// saves from before slots load unchanged, and the slot this device played last. Pure and tiny: the page shell reads
// them too (src/lib/loader.ts) before any of the farm's code is there.

/** The slot this device played last. */
export const SLOT_KEY = '3d-home:slot:v1'
/** A slot's farm. */
export const keyFor = (slot: number) => (slot === 1 ? '3d-home:farm:v1' : `3d-home:farm:v1:slot${slot}`)

/** Whether the farm this device will open starts on the farm's map: a new farm (nothing saved yet), or one saved
 *  there (`place`). Anything else, or a save that cannot be read: not known to (a farm from before the two maps that
 *  owns the house starts in it; the save's own reader decides). */
export function startsOnFarm(): boolean {
  try {
    const n = Number(localStorage.getItem(SLOT_KEY))
    const raw = localStorage.getItem(keyFor(n === 2 || n === 3 ? n : 1))
    if (raw === null) return true
    return (JSON.parse(raw) as { place?: unknown } | null)?.place === 'farm'
  } catch {
    return false
  }
}
