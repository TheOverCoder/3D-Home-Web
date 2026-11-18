import { personById, personLook } from '../data/people'
import { DEFAULT_OUTFIT, outfitLook, type Outfit } from '../farm/outfit'
import { random } from '../lib/sculpt'
import { rollLook } from '../models/look'
import type { PersonLook } from '../models/person'
import type { Film, Look } from './format'
import { voiceOfLook, type Voice } from './voice'

// A film's cast as the people engine draws them and as they sound: the player in what they wear (the game passes the
// save's outfit; the lab the one every farm starts in), the game's fixed characters as the people table has them
// (src/data/people.ts: their looks and voices), and anyone else a roll of its dice. Never colours of its own: when the
// engine changes, the film follows.

/** The player as the people engine draws them: what they wear (src/farm/outfit.ts), their own hair and skin (as
 *  src/scene/Avatar.tsx has them). */
function playerLook(outfit: Outfit): PersonLook {
  const o = outfitLook(outfit)
  return {
    sex: 'm',
    shirt: o.shirt,
    trousers: o.trousers,
    skin: '#e0ac87',
    hair: '#2b2017',
    hairStyle: 0,
    hat: o.hat?.kind ?? false,
    hatBand: o.hat?.colour,
    height: 1,
    basket: false,
    eyes: '#4a2f1e',
  }
}

/** Whether a cast member is one of the film's herd (an animal, drawn by the stage from the herd's own crowd). */
export const isAnimal = (look: Look): look is { herd: number } => typeof look === 'object' && 'herd' in look

/** An animal has no person's look: what asks for one (the colour of a speaker's name; an animal never speaks) gets the
 *  plainest, never drawn. */
const NOBODY: PersonLook = { ...rollLook(random(1)), shirt: '#f3ead8', basket: false }

/** A cast member's look: the player in `outfit`, the manager and the contractor as the game has them, or a roll. */
export function lookOf(look: Look, outfit: Outfit = DEFAULT_OUTFIT): PersonLook {
  if (isAnimal(look)) return NOBODY
  if (look === 'player') return playerLook(outfit)
  if (look === 'manager' || look === 'contractor') return personLook(look)!
  return { ...rollLook(random(look.roll)), basket: false }
}

/** Each cast member's voice (./voice.ts): the game's own for its fixed characters (src/data/people.ts), else one from
 *  their look, tuned by what the film gives. */
export function voicesOf(film: Film): Record<string, Voice> {
  return Object.fromEntries(
    Object.entries(film.cast).map(([id, m]) => [id, { ...((m.look === 'manager' || m.look === 'contractor' ? personById(m.look).voice : null) ?? voiceOfLook(lookOf(m.look))), ...m.voice }]),
  )
}
