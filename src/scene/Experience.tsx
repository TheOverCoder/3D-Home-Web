import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { useHome } from '../store'
import { Effects } from './Effects'
import { House } from './House'
import { LightDirector } from './LightDirector'
import { LightShafts } from './LightShafts'
import { Lighting } from './Lighting'
import { Pickups } from './Pickups'
import { Player } from './Player'
import { Screens } from './Screens'

const lockedQuality = new URLSearchParams(location.search).get('quality')

function Ready() {
  const markReady = useHome((s) => s.markReady)
  useEffect(() => markReady('scene'), [markReady])
  return null
}

export default function Experience() {
  const quality = useHome((s) => s.quality)
  const setQuality = useHome((s) => s.setQuality)
  const progress = useProgress((s) => s.progress)

  useEffect(() => useHome.setState({ progress }), [progress])

  useEffect(() => {
    if (lockedQuality === 'high' || lockedQuality === 'low') setQuality(lockedQuality)
  }, [setQuality])

  return (
    <Canvas
      shadows="percentage"
      flat
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      camera={{ fov: 50, near: 0.1, far: 1500, position: [0, 6, 9] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    >
      {!lockedQuality && <PerformanceMonitor onDecline={() => setQuality('low')} />}
      <Lighting />
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]}>
          <House />
          <LightShafts />
          <LightDirector />
          <Screens />
          <Pickups />
          <Player />
          <Ready />
        </Physics>
        <Effects />
      </Suspense>
    </Canvas>
  )
}
