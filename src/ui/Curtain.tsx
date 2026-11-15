import { useLayoutEffect } from 'react'
import { skipFilm, useFilm } from '../film/state'
import { useHome } from '../store'
import { SkipForward } from './glyphs'

/** The screen going dark while the map changes (a drive, another farm loaded: src/scene/maps.ts) and coming back once
 *  the other map is in. Over the scene and the controls; it takes the taps meanwhile. While the drive's film plays
 *  (src/film/DriveFilm.tsx, in the game's canvas under it) it opens onto the film: a veil that fades the picture in and
 *  out, thin letterbox bars, and Skip — a tap anywhere skips (and Esc). The rest of the interface is hidden meanwhile
 *  (<html data-film>). */
export function Curtain() {
  const down = useHome((s) => s.curtain)
  const film = useFilm((s) => s.on)
  const lifted = useFilm((s) => s.lifted)
  // the rest of the page hidden (the curtain too) once the film's layer is in, and back as it goes: never a frame
  // with neither the curtain nor the film's veil over the scene
  useLayoutEffect(() => {
    if (!film) return
    const root = document.documentElement
    root.dataset.film = 'drive'
    return () => {
      delete root.dataset.film
    }
  }, [film])
  return (
    <>
      <div className={`curtain${down ? ' down' : ''}`} aria-hidden={!down} />
      {film && (
        <div className={`drive-film${lifted ? ' lifted' : ''}${film.still ? ' still' : ''}`} onPointerDown={skipFilm} role="presentation">
          <div className="drive-film-veil" />
          <div className="drive-film-bars" aria-hidden="true">
            <i />
            <i />
          </div>
          <button className="btn soft small drive-film-skip" onClick={skipFilm} aria-label={`Skip the drive to ${film.to === 'home' ? 'the house' : 'the farm'}`}>
            <SkipForward weight="fill" />
            Skip
          </button>
        </div>
      )}
    </>
  )
}
