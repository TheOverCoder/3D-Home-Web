import { lazy, Suspense } from 'react'
import { useStory } from '../film/films'

// Where a moment's film shows over the game (src/film/films.ts): its overlay (./Film.tsx) loaded only once a film plays,
// so the game's start carries none of it. src/film/StoryFilm.tsx loads it before the film starts (`loadFilmOverlay`).

/** The overlay's code (loaded once, the first time a film plays). */
export const loadFilmOverlay = () => import('./Film')

const Overlay = lazy(() => loadFilmOverlay().then((m) => ({ default: m.StoryOverlay })))

export function FilmLayer() {
  const on = useStory((s) => s.on !== null)
  return on ? (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  ) : null
}
