import { BufferAttribute, BufferGeometry } from 'three'

/**
 * Re-maps a box-like geometry's UVs so that one texture tile covers `tile` metres, projected along
 * whichever axis each vertex faces. A 2 m counter and a 20 cm book then show grain/weave at the same
 * physical scale. `offset` shifts the pattern so identical pieces don't look stamped.
 */
export function boxProject(geometry: BufferGeometry, tile: number, offset = 0): BufferGeometry {
  const pos = geometry.getAttribute('position')
  const nor = geometry.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset
    const y = pos.getY(i) + offset * 0.37
    const z = pos.getZ(i) - offset * 0.61
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    const az = Math.abs(nor.getZ(i))
    let u: number
    let v: number
    if (ax >= ay && ax >= az) {
      u = z
      v = y
    } else if (ay >= az) {
      u = x
      v = z
    } else {
      u = x
      v = y
    }
    uv[i * 2] = u / tile
    uv[i * 2 + 1] = v / tile
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}
