import { TRACKS, nextTrack, pauseMusic, playMusic, useMusic } from '../audio/music'
import { useSettings } from '../settings'

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
)
const PLAY = 'M8 5.5v13l11-6.5z'
const PAUSE = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z'
const PREV = 'M7 6h2v12H7zM10 12l9 6V6z'
const NEXT = 'M15 6h2v12h-2zM14 12 5 6v12z'

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
          <Icon d={PREV} />
        </button>
        <button className="music-btn play" onClick={() => (playing ? pauseMusic() : playMusic())} aria-label={playing ? 'Pause the music' : 'Play the music'}>
          <Icon d={playing ? PAUSE : PLAY} />
        </button>
        <button className="music-btn" onClick={() => nextTrack(1)} aria-label="Next track">
          <Icon d={NEXT} />
        </button>
        <input
          className="music-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="Music volume"
          onChange={(e) => update({ musicVolume: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
