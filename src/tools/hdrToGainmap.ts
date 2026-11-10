import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { compress, encode, findTextureMinMax } from '@monogrid/gainmap-js/encode'
import { encodeJPEGMetadata } from '@monogrid/gainmap-js/libultrahdr'

// Turns the sky light (an .hdr, 1.5 MB) into a JPEG with a gain map: the picture itself as an ordinary JPEG, and
// beside it how much brighter each part really is, so the full range of light comes back when it is read (drei's
// <Environment> reads it as it is). Run by scripts/hdr-to-gainmap.mjs (the site with ?gainmap), not by the game.

// the .hdr files as fetched (src/assets/hdri) or kept after converting (src/assets/hdri/raw: not shipped)
const hdrs = import.meta.glob(['../assets/hdri/*.hdr', '../assets/hdri/raw/*.hdr'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export async function hdrToGainmap(quality = 0.92): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [path, url] of Object.entries(hdrs)) {
    const image = await new HDRLoader().loadAsync(url)
    const textureMax = findTextureMinMax(image)
    const result = encode({ image, maxContentBoost: Math.max(...textureMax) })
    const pack = (b: { toArray: () => Uint8ClampedArray; width: number; height: number }) => new ImageData(b.toArray() as Uint8ClampedArray<ArrayBuffer>, b.width, b.height)
    const [sdr, gainMap] = await Promise.all([
      compress({ source: pack(result.sdr), mimeType: 'image/jpeg', quality, flipY: true }),
      compress({ source: pack(result.gainMap), mimeType: 'image/jpeg', quality, flipY: true }),
    ])
    const jpeg = encodeJPEGMetadata({ ...result, ...result.getMetadata(), sdr, gainMap })
    result.sdr.dispose()
    result.gainMap.dispose()
    let bin = ''
    for (let i = 0; i < jpeg.length; i += 0x8000) bin += String.fromCharCode(...jpeg.subarray(i, i + 0x8000))
    out[
      path
        .split('/')
        .pop()!
        .replace(/\.hdr$/, '')
    ] = btoa(bin)
  }
  return out
}
