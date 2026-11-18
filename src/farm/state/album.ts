import { debugSet } from '../../lib/debug'
import { albumView, pageById, pagesDone, tilesEarned, type AlbumRecord, type AlbumView } from '../album'
import { albumGarment } from '../outfit'
import { bump, farm, save, toast, useFarm } from './core'
import { give } from './rewards'
import { stepsBusy } from './steps'

// The farm album (src/farm/album.ts): its pages filling as the farm does things, a page finished giving its garment by
// itself, once, a frame later (as the first steps are passed: tick asks, `albumOn`), and the tiles shown as earned
// once the album is opened (`sawAlbum`). No XP, no coins: a page's reward is its garment.

declare module './core' {
  interface FarmData {
    /** the farm album (src/farm/album.ts): the tiles shown as earned, the pages that gave their garment. (Declared
     *  here, beside its rules.) */
    album: AlbumRecord
  }
}

/** What the last look saw: the farm's revision (it moves as anything the album counts changes) and its second. */
let looked = ''
/** Seconds of the farm's clock between two pages' garments (each toast is read before the next). */
const PAGE_GAP = 3
/** The farm's clock when the last page gave its garment, and the record it gave it into (another farm's is not this
 *  one's: a farm loaded or new waits for nothing). */
let gave: { at: number; into: AlbumRecord | null } = { at: -Infinity, into: null }

/**
 * Each frame, from `tick`: when the farm has changed, or once a farm second, a page whose every tile is earned and that
 * has not given its garment gives it (into the wardrobe, through `give`: a `page` reward, its show a toast), one page a
 * look and PAGE_GAP seconds apart, so two at once come one after the other. Not while a new farm's first steps run (their end has its own moment).
 */
export function albumOn() {
  hook()
  const now = `${useFarm.getState().rev}|${Math.floor(farm.clock)}`
  if (now === looked) return
  looked = now
  if (stepsBusy() || (gave.into === farm.album && farm.clock < gave.at + PAGE_GAP)) return
  const page = pagesDone(farm).find((id) => !farm.album.done.includes(id))
  if (!page) return
  const garment = albumGarment(page)
  farm.album = { ...farm.album, done: [...farm.album.done, page] }
  gave = { at: farm.clock, into: farm.album }
  if (garment) {
    give([{ garment: garment.id }], 'page')
    toast(`Album: ${pageById(page)?.name ?? 'a page'} done · a ${garment.name.toLowerCase()} for your wardrobe`, 'open-book')
  }
  bump()
  save()
}

/** The album as it stands now (./AlbumCard.tsx). */
export const albumNow = (): AlbumView => albumView(farm, farm.album.seen)

/** The album opened: every tile earned now is shown (none of them is new any more). */
export function sawAlbum() {
  const seen = tilesEarned(farm)
  if (seen.length === farm.album.seen.length && seen.every((id) => farm.album.seen.includes(id))) return
  farm.album = { ...farm.album, seen }
  bump()
  save()
}

/** ?debug: `window.__home.album` — the album now, the record, opened. Made on the farm's first frame. */
let hooked = false
function hook() {
  if (hooked || typeof window === 'undefined' || !('__home' in window)) return
  hooked = true
  debugSet('album', { now: albumNow, saw: sawAlbum, record: () => farm.album, done: () => pagesDone(farm) })
}
