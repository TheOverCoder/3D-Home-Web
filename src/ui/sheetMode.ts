import { useSyncExternalStore } from 'react'
import type { SheetMode } from './motion'

// Which way the screen is held, as the game's sheets read it (src/styles.css lays a panel at the bottom upright and on
// the right sideways): one place for the media queries every sheet asks.

const SIDEWAYS = '(orientation: landscape) and (max-height: 560px)'
const UPRIGHT = '(max-width: 520px)'

const useQuery = (q: string) =>
  useSyncExternalStore(
    (changed) => {
      const l = matchMedia(q)
      l.addEventListener('change', changed)
      return () => l.removeEventListener('change', changed)
    },
    () => matchMedia(q).matches,
  )

/** A phone on its side (the game's CSS lays a sheet on the right then). */
export const useSideways = () => useQuery(SIDEWAYS)

/** Where a sheet stands: on the right (a phone on its side), at the bottom (upright), in the middle (a tablet or a
 *  computer). */
export function useSheetMode(): SheetMode {
  const wide = useQuery(SIDEWAYS)
  const narrow = useQuery(UPRIGHT)
  return wide ? 'right' : narrow ? 'bottom' : 'middle'
}

/** A phone on its side, read once (outside React: a popover's room from the notch). */
export const sidewaysNow = () => matchMedia(SIDEWAYS).matches
