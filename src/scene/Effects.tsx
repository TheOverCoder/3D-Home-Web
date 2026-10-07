import type { JSX } from 'react'
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useHome } from '../store'

export function Effects() {
  const high = useHome((s) => s.quality === 'high')
  const effects: JSX.Element[] = []
  if (high) effects.push(<N8AO key="ao" aoRadius={0.7} intensity={2.6} distanceFalloff={1.1} quality="medium" halfRes />)
  // only emissive surfaces (screens, lamp shades, hologram) exceed the threshold
  effects.push(<Bloom key="bloom" intensity={high ? 0.55 : 0.35} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur />)
  effects.push(<ToneMapping key="tm" mode={ToneMappingMode.AGX} />)
  effects.push(<Noise key="grain" blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />)
  effects.push(<Vignette key="vig" offset={0.3} darkness={0.5} />)
  return <EffectComposer multisampling={high ? 4 : 0}>{effects}</EffectComposer>
}
