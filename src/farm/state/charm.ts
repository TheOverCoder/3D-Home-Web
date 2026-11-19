import { ROOM_IDS } from '../../home/shell'
import { onHere } from '../../lib/quiet'
import { intIn, isObject } from '../../lib/saved'
import { charmPoints, charmView, rankOf, RANKS, type CharmInput, type CharmView } from '../charm'
import { bump, farm, save, toast, type FarmData } from './core'

// The farm's charm on the farm (src/farm/charm.ts): words and stars only. The news shows it (`charmNow`), and a rank
// reached for the first time is told once with a toast (`tellCharm`, asked as the farm changes: src/farm/FarmUI.tsx);
// the highest rank told is kept (`farm.charm.told`), so taking a lamp away and back tells nothing twice. Quiet where the
// game is tested (src/lib/quiet.ts: `&charm=on` on a ?debug page; `quietCharm(false)` in a test).

declare module './core' {
  interface FarmData {
    /** the farm's charm (src/farm/charm.ts): the highest rank a toast has told */
    charm: { told: number }
  }
}

let tells = onHere('charm')

/** For the tests (and a ?debug page's console): the toast quiet (true), or told as in play (false). */
export function quietCharm(on: boolean) {
  tells = !on
}

/** What the charm is measured on, on a farm: what stands on it, and the house's rooms painted (none without a house). */
export const charmInput = (f: Pick<FarmData, 'layout' | 'apartment' | 'home'> = farm): CharmInput => ({
  decor: f.layout.decor,
  roomsPainted: f.apartment.owned ? ROOM_IDS.filter((r) => f.home.shell.paint[r] !== null).length : null,
})

/** The charm as the news shows it now. */
export const charmNow = (): CharmView => charmView(charmInput())

/** A new farm's: nothing told yet (its first rank is where every farm starts). */
export const charmFresh = () => ({ told: 0 })

/** As saved; a farm from before it has its rank now told already (nothing old is told as new). */
export function savedCharm(raw: unknown, f: Pick<FarmData, 'layout' | 'apartment' | 'home'>): { told: number } {
  const now = rankOf(charmPoints(charmInput(f)))
  if (!isObject(raw) || !intIn(raw.told, 0, RANKS.length - 1)) return { told: now }
  return { told: raw.told }
}

/** A rank reached for the first time: one toast, kept (no prize: the charm is its own reward). Whether it told one. */
export function tellCharm(): boolean {
  const v = charmNow()
  if (v.rank <= farm.charm.told) return false
  farm.charm = { told: v.rank }
  if (tells) toast(`Your farm is ${v.name.toLowerCase()} now · ${'★'.repeat(v.stars)}`, v.art)
  bump()
  save()
  return true
}
