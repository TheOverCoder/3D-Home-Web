import { TRACKS, nextTrack, pauseMusic, playMusic, useMusic } from '../audio/music'
import { useSettings } from '../settings'
import { Pause, Play, SkipBack, SkipForward } from './glyphs'

/** The music player: what is playing, play / pause, the track before or after, and its volume. */
export function MusicPlayer({ compact = false }: { compact?: boolean }) {
  const { playing, track } = useMusic()
  const volume = useSettings((s) => s.musicVolume)
  const update = useSettings((s) => s.update)
  const def = TRACKS[track]
  return (
    <div className={`music${compact ? ' compact' : ''}`} aria-label="Music">
      <div className="music-now">
        <span className={`music-eq${playing ? ' on' : ''}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="music-title">
          <strong>{def.name}</strong>
          <span>{playing ? def.mood : 'paused'}</span>
        </div>
      </div>
      <div className="music-controls">
        <button className="music-btn" onClick={() => nextTrack(-1)} aria-label="Previous track">
          <SkipBack weight="fill" />
        </button>
        <button className="music-btn play" onClick={() => (playing ? pauseMusic() : playMusic())} aria-label={playing ? 'Pause the music' : 'Play the music'}>
          {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
        </button>
        <button className="music-btn" onClick={() => nextTrack(1)} aria-label="Next track">
          <SkipForward weight="fill" />
        </button>
        <input className="music-volume" type="range" min={0} max={1} step={0.05} value={volume} aria-label="Music volume" onChange={(e) => update({ musicVolume: Number(e.target.value) })} />
      </div>
    </div>
  )
}
