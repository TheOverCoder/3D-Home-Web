import { useStory } from '../film/films'
import { useFilm } from '../film/state'
import { awaySummary, useFarm } from '../farm/state'
import { useHome } from '../store'

// Nothing is over the game: you are playing, on a map that is in view (no curtain, no drive), and there is no panel, no
// screen, no settings, no edit or decorate mode, no film or story film, and no welcome-back card waiting. What comes
// by itself waits for it: the daily gift (and a toast too: `toast`), what a level opened, a new farm's next step.

/** Whether nothing is over the game now (`toast`: a word at the top counts too). For a check a moment later. */
export function gameFree({ toast = false } = {}) {
  const s = useHome.getState()
  if (s.phase !== 'playing' || !s.mapReady || s.curtain) return false
  if (s.panel || s.editing || s.decorating || s.screen || s.settingsOpen || (toast && s.toast)) return false
  return useFilm.getState().on === null && useStory.getState().on === null && awaySummary() === null
}

/** Whether nothing is over the game, kept as it changes (`toast`: a word at the top counts too). */
export function useGameFree({ toast = false } = {}) {
  const playing = useHome((s) => s.phase === 'playing' && s.mapReady && !s.curtain)
  const busy = useHome((s) => !!(s.panel || s.editing || s.decorating || s.screen || s.settingsOpen || (toast && s.toast)))
  const film = useFilm((s) => s.on !== null)
  const story = useStory((s) => s.on !== null)
  const away = useFarm(() => awaySummary() !== null)
  return playing && !busy && !film && !story && !away
}
