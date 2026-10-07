import { Suspense, useEffect, useState } from 'react'
import { Environment } from '@react-three/drei'
import { assets } from '../assets/registry'
import { useHome } from '../store'

function EnvReady() {
  const markReady = useHome((s) => s.markReady)
  useEffect(() => markReady('env'), [markReady])
  return null
}

/** Image-based lighting: the real HDRI if one was dropped in, otherwise a small bundled stand-in. */
function Hdri() {
  const [fallback, setFallback] = useState<string>()
  useEffect(() => {
    if (assets.hdri) return
    let live = true
    // 512×256 EXR from @pmndrs/assets (CC0) — enough for soft ambient light, not for sharp reflections
    import('@pmndrs/assets/hdri/apartment.exr').then((m) => live && setFallback(m.default))
    return () => {
      live = false
    }
  }, [])
  const files = assets.hdri ?? fallback
  if (!files) return null
  // own boundary: while the HDRI decodes, only this subtree is hidden — never the physics world
  return (
    <Suspense fallback={null}>
      <Environment files={files} background={false} environmentIntensity={0.7} />
      <EnvReady />
    </Suspense>
  )
}

export function Lighting() {
  return (
    <>
      <color attach="background" args={['#0d1014']} />
      <Hdri />
      <hemisphereLight args={['#dfe9ff', '#3a3028', 0.25]} />
      <directionalLight
        position={[9, 15, 8]}
        intensity={2.4}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  )
}
