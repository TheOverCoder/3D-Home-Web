import { Suspense, useEffect } from 'react'
import { Environment, Sky } from '@react-three/drei'
import { assets } from '../assets/registry'
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
        <Environment files={assets.hdri} background={false} environmentIntensity={0.55} />
      ) : (
        <Environment frames={1} resolution={128} far={900} background={false} environmentIntensity={0.55}>
          <DaylightProbe />
        </Environment>
      )}
      <EnvReady />
    </Suspense>
  )
}

export function Lighting() {
  const markReady = useHome((s) => s.markReady)
  return (
    <>
      <color attach="background" args={['#a9c4e0']} />
      <fog attach="fog" args={['#bdd0e2', 70, 420]} />
      {/* the sky you see through windows and over the roof */}
      <Sky distance={900} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <ErrorBoundary fallback={null} onError={() => markReady('env')}>
        <Ibl />
      </ErrorBoundary>
      <hemisphereLight args={['#dfe9ff', '#3a3028', 0.12]} />
      <directionalLight
        position={[SUN[0] * 1.6, SUN[1] * 1.6, SUN[2] * 1.6]}
        intensity={3.4}
        color="#fff1d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
    </>
  )
}
