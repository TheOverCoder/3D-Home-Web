import { Suspense, useEffect, useState } from 'react'
import { Environment } from '@react-three/drei'
import { DataTexture, EquirectangularReflectionMapping, LinearFilter, LinearSRGBColorSpace, type Texture } from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { assets } from '../assets/registry'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { useHome } from '../store'

function EnvReady() {
  const markReady = useHome((s) => s.markReady)
  useEffect(() => markReady('env'), [markReady])
  return null
}

/** Decodes a base64 `data:` EXR in memory. No fetch(), so it also works where connect-src is locked down. */
function decodeExr(dataUri: string): Texture {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const exr = new EXRLoader().parse(bytes.buffer)
  const texture = new DataTexture(exr.data, exr.width, exr.height, exr.format, exr.type)
  texture.colorSpace = LinearSRGBColorSpace
  texture.mapping = EquirectangularReflectionMapping
  texture.minFilter = texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.flipY = true
  texture.needsUpdate = true
  return texture
}

/** Image-based lighting: the real HDRI if one was dropped in, otherwise a small bundled stand-in. */
function Hdri() {
  const [fallback, setFallback] = useState<Texture>()
  const markReady = useHome((s) => s.markReady)

  useEffect(() => {
    if (assets.hdri) return
    let live = true
    // 512×256 EXR from @pmndrs/assets (CC0) — enough for soft ambient light, not for sharp reflections
    import('@pmndrs/assets/hdri/apartment.exr')
      .then((m) => live && setFallback(decodeExr(m.default)))
      .catch((error) => {
        console.warn('[3d-home] stand-in HDRI failed to load; continuing without image-based lighting', error)
        markReady('env')
      })
    return () => {
      live = false
    }
  }, [markReady])

  if (!assets.hdri && !fallback) return null
  // own boundary: while the HDRI decodes, only this subtree is hidden — never the physics world
  return (
    <Suspense fallback={null}>
      {assets.hdri ? (
        <Environment files={assets.hdri} background={false} environmentIntensity={0.7} />
      ) : (
        <Environment map={fallback} background={false} environmentIntensity={0.7} />
      )}
      <EnvReady />
    </Suspense>
  )
}

export function Lighting() {
  const markReady = useHome((s) => s.markReady)
  return (
    <>
      <color attach="background" args={['#0d1014']} />
      <ErrorBoundary fallback={null} onError={() => markReady('env')}>
        <Hdri />
      </ErrorBoundary>
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
