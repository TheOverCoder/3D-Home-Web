import { useFrame } from '@react-three/fiber'
import { updateLevels } from '../lib/lightLevels'
import { useHome } from '../store'

/** Eases every room's light level towards what the player's position calls for. Renders nothing. */
export function LightDirector() {
  useFrame((_, dt) => updateLevels(useHome.getState().room, Math.min(dt, 0.1)))
  return null
}
