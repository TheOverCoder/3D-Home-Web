// Mutable, non-reactive snapshot of the player, written every frame by <Player /> and read by systems
// that must not trigger React renders (interaction, wall fade...). Plain objects on purpose: this file
// is part of the entry chunk, which must not pull in three.js.
export interface Point3 {
  x: number
  y: number
  z: number
}

/** The player's body, a capsule (ecctrl, src/scene/Player.tsx): the half height of its straight part, its radius, and
 *  how far it floats over the floor. Finding the way (src/lib/route) tries the same shape against the world. */
export const BODY = { half: 0.5, radius: 0.28, float: 0.12 } as const

export const playerState = {
  position: { x: 0, y: 0, z: 0 } as Point3,
  facing: { x: 0, y: 0, z: 1 } as Point3,
  eye: { x: 0, y: 1.6, z: 0 } as Point3, // the camera, last frame
  speed: 0,
  grounded: true,
  /** asked for by the game (something was built where you stand): <Player /> puts you here on its next frame */
  moveTo: null as Point3 | null,
}
