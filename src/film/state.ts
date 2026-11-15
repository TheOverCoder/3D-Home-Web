import { create } from 'zustand'

// The drive's film as the interface sees it (src/ui/Curtain.tsx: the letterbox, Skip and the fade over the picture),
// apart from the film itself so the page's shell never loads three.js for it. ./DriveFilm.tsx plays the film and
// sets it here.

export interface FilmShowing {
  /** where the drive goes */
  to: 'farm' | 'home'
  /** less motion: one still, no bars sliding in */
  still: boolean
}

export const useFilm = create<{ on: FilmShowing | null; lifted: boolean }>(() => ({ on: null, lifted: false }))

let skipper: (() => void) | null = null

/** Skips the film playing (a tap, Esc): it fades out at once and the drive goes on. */
export function skipFilm() {
  skipper?.()
}

/** What skipping does now (the film playing sets it, and null once it is over). */
export function onSkip(skip: (() => void) | null) {
  skipper = skip
}
