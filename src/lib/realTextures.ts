import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { textureSets } from '../assets/registry'
import { overrideSurface, type SurfaceKind } from './proceduralTextures'
import { profile } from './profile'
import { fitTexture } from './textureBudget'

/**
 * Loads any real texture sets dropped into src/assets/textures/<surface>/ and substitutes them for the generated
 * surfaces. Resolves (never rejects) before the scene is built, so every material sees the final maps.
 */
export async function loadRealTextures(): Promise<void> {
  const names = Object.keys(textureSets)
  // light graphics keep the generated surfaces: no download, a fraction of the memory
  if (names.length === 0 || profile.light) return
  const loader = new TextureLoader()
  const load = (url: string | undefined, colour: boolean): Promise<Texture | undefined> =>
    url
      ? loader.loadAsync(url).then(
          (t) => {
            t.wrapS = t.wrapT = RepeatWrapping
            t.anisotropy = profile.device === 'desktop' ? 8 : 4
            if (colour) t.colorSpace = SRGBColorSpace
            fitTexture(t)
            return t
          },
          (e) => {
            console.warn('[textures] could not load', url, e)
            return undefined
          },
        )
      : Promise.resolve(undefined)
  await Promise.all(
    names.map(async (name) => {
      const set = textureSets[name]
      const [map, normalMap, roughnessMap] = await Promise.all([load(set.map, true), load(set.normalMap, false), load(set.roughnessMap, false)])
      overrideSurface(name as SurfaceKind, { map, normalMap, roughnessMap })
    }),
  )
}
