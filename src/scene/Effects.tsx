import { useMemo, useRef, type JSX } from 'react'
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
import { debugSet } from '../lib/debug'
import { focus } from '../lib/focus'
import { useSettings } from '../settings'
import { useHome } from '../store'

/**
 * The film look, in order: contact shadows → lens focus → bloom on the bright things → a lens fringe →
 * filmic tone mapping → grade (a touch of contrast and colour) → vignette → grain.
 */
export function Effects() {
  const high = useHome((s) => s.quality === 'high')
  const view = useHome((s) => s.view)
  const depthOfField = useSettings((s) => s.depthOfField)
  const filmGrain = useSettings((s) => s.filmGrain)
  const dof = useRef<DepthOfFieldEffect>(null)
  debugSet('settings', useSettings)
  debugSet('focus', focus)
  const fringe = useMemo(() => new Vector2(0.0005, 0.0007), [])

  // follow whatever the player looks at (distance measured in <Player />)
  useFrame(() => {
    const d = dof.current
    debugSet('dof', d)
    if (d) d.circleOfConfusionMaterial.worldFocusDistance = focus.distance
  })

  const fx: JSX.Element[] = []
  // moderate intensity: strong AO turns the dark undersides of furniture into noisy black patches
  if (high) fx.push(<N8AO key="ao" aoRadius={0.6} intensity={1.15} color="#2a2018" distanceFalloff={1.0} aoSamples={20} denoiseSamples={10} denoiseRadius={10} quality="medium" halfRes />)
  if (high && depthOfField) {
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
  fx.push(<Bloom key="bloom" intensity={high ? 0.6 : 0.35} luminanceThreshold={1} luminanceSmoothing={0.25} mipmapBlur />)
  if (high) fx.push(<ChromaticAberration key="ca" offset={fringe} radialModulation modulationOffset={0.25} />)
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.AGX} />)
  fx.push(<BrightnessContrast key="bc" brightness={-0.01} contrast={0.1} />)
  fx.push(<HueSaturation key="hs" saturation={0.1} />)
  fx.push(<Vignette key="vig" offset={0.22} darkness={0.72} />)
  if (filmGrain) fx.push(<Noise key="grain" blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.1} />)
  return <EffectComposer multisampling={high ? 4 : 0}>{fx}</EffectComposer>
}
