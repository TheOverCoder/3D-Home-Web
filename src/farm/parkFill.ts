// The car park filled for measuring what it draws (update-v1/missions/11-buildings.md c8): `marketFill` with its
// shoppers parks the most cars there ever are (src/farm/state/market.ts); any other fill empties it again. Not saved.

let full = false

/** Whether the car park stands filled for measuring. */
export const parkFull = () => full

/** Fill the car park for measuring (true), or let it follow who is about (false). */
export function fillPark(on: boolean) {
  full = on
}
