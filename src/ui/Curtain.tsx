import { useHome } from '../store'

/** The screen going dark while the map changes (a drive, another farm loaded: src/scene/maps.ts) and coming back once
 *  the other map is in. Over the scene and the controls; it takes the taps meanwhile. */
export function Curtain() {
  const down = useHome((s) => s.curtain)
  return <div className={`curtain${down ? ' down' : ''}`} aria-hidden={!down} />
}
