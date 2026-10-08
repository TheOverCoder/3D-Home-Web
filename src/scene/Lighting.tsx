import { Suspense, useEffect } from 'react'
import { Environment, Sky } from '@react-three/drei'
import { assets } from '../assets/registry'
import { useSettings } from '../settings'
import { SUN } from '../data/layout'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { useHome } from '../store'

const SUN_DIR = SUN

function EnvReady() {
  const markReady = useHome((s) => s.markReady)
  useEffect(() => markReady('env'), [markReady])
  return null
}

/** Daylight as seen from outside: sky dome over a lawn-coloured disc. Lights the scene when there is no real HDRI. */
function DaylightProbe() {
  return (
    <>
      <Sky distance={400} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]}>
        <circleGeometry args={[200, 16]} />
        <meshBasicMaterial color="#7d7566" />
      </mesh>
    </>
  )
}

/** Image-based lighting: the real HDRI if one was dropped in, otherwise a generated daylight probe. */
function Ibl() {
  // own boundary: while an HDRI decodes, only this subtree is hidden — never the physics world
  return (
    <Suspense fallback={null}>
      {assets.hdri ? (
        <Environment files={assets.hdri} background={false} environmentIntensity={0.75} />
      ) : (
        <Environment frames={1} resolution={128} far={900} background={false} environmentIntensity={0.4}>
          <DaylightProbe />
        </Environment>
      )}
      <EnvReady />
    </Suspense>
  )
}

export function Lighting() {
  const markReady = useHome((s) => s.markReady)
  const haze = useSettings((s) => s.haze)
  return (
    <>
      <color attach="background" args={['#a9c4e0']} />
      {/* haze: distant things sink into a pale grey-blue, which is what makes the rooms and the garden feel deep */}
      <fogExp2 attach="fog" args={['#aab4c0', haze ? 0.04 : 0.0006]} />
      {/* the sky you see through windows and over the roof */}
      <Sky distance={900} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <ErrorBoundary fallback={null} onError={() => markReady('env')}>
        <Ibl />
      </ErrorBoundary>
      <hemisphereLight args={['#dfe9ff', '#4a3d32', 0.24]} />
      <directionalLight
        position={[SUN[0] * 1.6, SUN[1] * 1.6, SUN[2] * 1.6]}
        intensity={2.5}
        color="#ffd9a0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-radius={3}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
    </>
  )
}
