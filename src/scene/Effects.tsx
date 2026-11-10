import { useCallback, useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  N8AO,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing'
import { Vector2 } from 'three'
import { create } from 'zustand'
import { debugSet } from '../lib/debug'
import { focus } from '../lib/focus'
import { createHdrSanitizePass } from '../lib/hdrGuard'
import { profile } from '../lib/profile'
import { useSettings } from '../settings'
import { useHome } from '../store'

interface N8AOPass {
  autoDetectTransparency: boolean
  configuration: { transparencyAware: boolean }
}

/** The film look's numbers, in one place: `?tune` (src/debug/Tune.tsx) changes them while the game runs. */
export const LOOK = {
  bloom: { low: 0.35, medium: 0.5, high: 0.6, threshold: 1, smoothing: 0.25 },
  ao: { radius: 0.6, intensity: 1.15, falloff: 1.0 },
  grade: { brightness: -0.01, contrast: 0.1, saturation: 0.1 },
  vignette: { offset: 0.22, darkness: 0.72 },
  grain: 0.1,
}
/** Bumped after LOOK (or the device profile) changed: the effects are made again with the new numbers. */
export const useLook = create(() => ({ rev: 0 }))

/**
 * The film look, in order: contact shadows → lens focus → bloom on the bright things → a lens fringe →
 * filmic tone mapping → grade (a touch of contrast and colour) → vignette → grain.
 * Per tier: high has all of it with MSAA ×4; medium keeps the AO (cheaper sampling), bloom and grade with
 * MSAA ×2 and drops the lens effects; low is tone mapping, grade and a light bloom only.
 */
export function Effects() {
  const quality = useHome((s) => s.quality)
  const high = quality === 'high'
  const medium = quality === 'medium'
  const view = useHome((s) => s.view)
  const depthOfField = useSettings((s) => s.depthOfField)
  const filmGrain = useSettings((s) => s.filmGrain)
  useLook((s) => s.rev)
  const dof = useRef<DepthOfFieldEffect>(null)
  debugSet('settings', useSettings)
  debugSet('focus', focus)
  const fringe = useMemo(() => new Vector2(0.0005, 0.0007), [])
  // cleans the frame right before anything blurs it (see lib/hdrGuard: one bad pixel became a black rectangle)
  const sanitize = useMemo(() => createHdrSanitizePass(), [])
  // N8AO turns "transparency aware" on by itself as soon as it sees a transparent material (window glass,
  // fading walls). That costs two extra full-scene renders, two full-resolution copies and three walks over the
  // whole scene graph (with a fresh Map of every object — garbage-collector stutter) every frame, all to keep AO
  // off glass, which has almost none anyway. Off, for good.
  const aoRef = useCallback((pass: N8AOPass | null) => {
    if (!pass) return
    pass.autoDetectTransparency = false
    pass.configuration.transparencyAware = false
  }, [])

  // follow whatever the player looks at (distance measured in <Player />)
  useFrame(() => {
    const d = dof.current
    debugSet('dof', d)
    if (d) d.circleOfConfusionMaterial.worldFocusDistance = focus.distance
  })

  const fx: JSX.Element[] = []
  // what each tier costs on this device (src/lib/profile.ts): phones skip the AO buffers below the top tier
  const ao = profile.ao[quality]
  // moderate intensity: strong AO turns the dark undersides of furniture into noisy black patches
  if (ao) {
    fx.push(
      <N8AO
        key="ao"
        ref={aoRef as never}
        aoRadius={LOOK.ao.radius}
        intensity={LOOK.ao.intensity}
        color="#2a2018"
        distanceFalloff={LOOK.ao.falloff}
        quality={ao}
        halfRes
      />,
    )
  }
  fx.push(<primitive key="sanitize" object={sanitize} />)
  if (high && depthOfField && profile.lensEffects) {
    fx.push(
      <DepthOfField
        key="dof"
        ref={dof}
        worldFocusDistance={4}
        worldFocusRange={view === 'first' ? 6 : 14}
        bokehScale={view === 'first' ? 1.1 : 0.8}
        resolutionScale={0.5}
      />,
    )
  }
  const { bloom, grade, vignette } = LOOK
  fx.push(
    <Bloom
      key="bloom"
      intensity={high ? bloom.high : medium ? bloom.medium : bloom.low}
      luminanceThreshold={bloom.threshold}
      luminanceSmoothing={bloom.smoothing}
      mipmapBlur
      levels={profile.bloomLevels[quality]}
    />,
  )
  if (high && profile.lensEffects) fx.push(<ChromaticAberration key="ca" offset={fringe} radialModulation modulationOffset={0.25} />)
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.AGX} />)
  fx.push(<BrightnessContrast key="bc" brightness={grade.brightness} contrast={grade.contrast} />)
  fx.push(<HueSaturation key="hs" saturation={grade.saturation} />)
  fx.push(<Vignette key="vig" offset={vignette.offset} darkness={vignette.darkness} />)
  if (filmGrain) fx.push(<Noise key="grain" blendFunction={BlendFunction.SOFT_LIGHT} opacity={LOOK.grain} />)
  return <EffectComposer multisampling={profile.msaa[quality]}>{fx}</EffectComposer>
}
