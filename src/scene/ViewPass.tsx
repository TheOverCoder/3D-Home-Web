import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { assets } from '../assets/registry'
import { editCamera } from '../farm/EditMode'
import { decorateCamera } from '../home/DecorateMode'
import { debugSet } from '../lib/debug'
import { installViewPass, portalCells, view } from '../lib/visibility/pass'
import { useHome } from '../store'
import { ceilingsUp } from './Ceilings'
import { doorAngle } from './Door'
import { sunLight } from './Lighting'

/** The door counts as shut below this turn (radians): its leaf still sits inside the jambs and the head, no gap. */
const SHUT = 0.002

/**
 * The drawing pass that leaves out what cannot be seen (src/lib/visibility), started on the game's scene and camera.
 * The rooms and portals, and the sun's windows, only in first person with the house closed round you: playing, not
 * decorating or editing (their camera flight back included), every ceiling up and opaque — and only for the house
 * drawn from src/data/layout.ts (a real house model would not match its rooms and windows).
 */
export function ViewPass() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    debugSet('view', view)
    debugSet('viewCells', portalCells)
    const fits = !assets.house
    return installViewPass({
      scene,
      camera,
      firstPerson: () => {
        const s = useHome.getState()
        return (
          fits &&
          s.phase === 'playing' &&
          s.view === 'first' &&
          !s.decorating &&
          !s.editing &&
          decorateCamera.blend === 0 &&
          editCamera.blend === 0 &&
          ceilingsUp.living &&
          ceilingsUp.office &&
          ceilingsUp.kitchen &&
          ceilingsUp.bedroom
        )
      },
      doorOpen: () => doorAngle() > SHUT,
      sun: () => sunLight.current,
    })
  }, [scene, camera])
  return null
}
