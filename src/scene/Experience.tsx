import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Preload, useProgress } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { debugSet } from '../lib/debug'
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
  const gl = useThree((s) => s.gl)
  debugSet('gl', gl)
  useEffect(() => markReady('scene'), [markReady])
  return null
}

export default function Experience() {
  const quality = useHome((s) => s.quality)
  const setQuality = useHome((s) => s.setQuality)
  const progress = useProgress((s) => s.progress)
  // 4K/retina screens at 2x are far too heavy for the full post chain: cap it, and shed resolution before effects
  const [dprCap, setDprCap] = useState(() => Math.min(window.devicePixelRatio || 1, 1.5))
  const declines = useRef(0)

  useEffect(() => useHome.setState({ progress }), [progress])

  useEffect(() => {
    if (lockedQuality === 'high' || lockedQuality === 'low') setQuality(lockedQuality)
  }, [setQuality])

  return (
    <Canvas
      shadows="percentage"
      flat
      dpr={quality === 'high' ? [1, dprCap] : [1, Math.min(dprCap, 1.25)]}
      camera={{ fov: 50, near: 0.1, far: 1500, position: [0, 6, 9] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
    >
      {!lockedQuality && (
        <PerformanceMonitor
          onDecline={() => {
            declines.current += 1
            if (declines.current === 1 && dprCap > 1) setDprCap(1)
            else setQuality('low')
          }}
        />
      )}
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
        {/* compile every shader and upload every texture up front, so turning round or entering a room never stalls */}
        <Preload all />
      </Suspense>
    </Canvas>
  )
}
