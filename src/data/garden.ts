// Spots in the garden that more than one part of the scene needs: the shrubs (drawn by the exterior, kept clear
// by the farm's layout) and the three big trees in the corners (movable places of the farm, see src/farm/layout.ts).

/** Shrubs along the house and the boundary (the farm's beds, pasture and kitchen corner keep their ground clear). */
export const SHRUB_SPOTS: [number, number][] = [
  [-8.4, -3.2],
  [8.6, 1.6],
  [8.5, 3.4],
  [-3.5, -7.6],
  [1.5, -7.6],
  [-5.2, 7.6],
  [4.6, 7.7],
  [-12.4, 12.0],
  [-12.5, -1.5],
  [-12.2, -8.6],
]
/** The three big trees in the garden's corners, where they start: x, z, height. */
export const CORNER_TREES: [number, number, number][] = [
  [-11.2, -10.2, 7.5],
  [10.8, -10.6, 6.8],
  [-11.6, 9.6, 6.4],
]
