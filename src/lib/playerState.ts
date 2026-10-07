// Mutable, non-reactive snapshot of the player, written every frame by <Player /> and read by systems
// that must not trigger React renders (interaction, wall fade...). Plain objects on purpose: this file
// is part of the entry chunk, which must not pull in three.js.
export interface Point3 {
  x: number
  y: number
  z: number
}

export const playerState = {
  position: { x: 0, y: 0, z: 0 } as Point3,
  facing: { x: 0, y: 0, z: 1 } as Point3,
  speed: 0,
  grounded: true,
}
