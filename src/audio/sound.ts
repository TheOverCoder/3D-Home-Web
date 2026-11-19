// Procedural sound for the house and the farm: everything is synthesised with WebAudio from two noise buffers and a
// few oscillators — nothing is downloaded. The context is created on the first user gesture (browsers refuse to start
// audio before one) and every sound is a silent no-op until then, or while sound is off. The game imports it all from
// here; it lives in these files: the engine and its building blocks (./engine.ts), the farm's sounds by their table
// (./farmSounds.ts, ./sounds.ts), a reward's sting by its tier, its rattle and its coins landing (./stings.ts,
// ./rewardSound.ts), the house's (./house.ts) and the sound of where you are (./ambience.ts). No three.js in here; and
// not in the page shell either: the shell holds only the music's front (./music.ts), which fetches the rest.
import { roomNow, startAmbient } from './ambience'
import { engineStatus, openEngine } from './engine'

export { audioGraph, live, makeEngine, setSoundPrefs, suspendForHidden, type Engine } from './engine'
export { farmSound, play, type FarmSound, type PlayOpts } from './farmSounds'
export { doorSound, dropSound, footstep, impactSound, jumpSound, lampSwitch, land, pickupSound, screenSound, uiClick } from './house'
export { duckAmbient, followSky, hearNight, hearPhase, hearSky, hearWalkIns, placeSound, setOutdoors, setRoomTone } from './ambience'
export { coinLand, rattle, rewardSound } from './rewardSound'

/** Call from a user gesture: creates or resumes the audio context, and starts the room tone. Safe to call often. */
export function unlockAudio() {
  if (openEngine()) startAmbient()
}

/** Debug and the voices: the audio engine's state, its switch and volume, and the room it is in (null before the
 *  first gesture). */
export function audioStatus() {
  const s = engineStatus()
  return s && { ...s, room: roomNow() }
}
