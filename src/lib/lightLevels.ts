import { ADJACENT, ROOMS, type RoomId } from '../data/layout'

// How much of its designed light each room currently shows. The room you stand in is at full strength, its
// neighbours are dimmed so the eye is drawn to where you are, and the rest recede. Plain numbers, eased each
// frame by <LightDirector />; the lights themselves read them.
export const levels: Record<RoomId, number> = { living: 1, office: 1, kitchen: 1, bedroom: 1 }

const neighbours = (a: RoomId, b: RoomId) => ADJACENT.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

export function updateLevels(current: RoomId | null, dt: number) {
  for (const id of Object.keys(ROOMS) as RoomId[]) {
    const target = current === null ? 0.75 : id === current ? 1 : neighbours(current, id) ? 0.5 : 0.2
    const k = 1 - Math.exp(-2.2 * dt)
    levels[id] += (target - levels[id]) * k
  }
}
