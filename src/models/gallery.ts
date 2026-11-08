import type { Object3D } from 'three'
import { cowParts, putCow } from './cow'
import { putSheep, sheepParts } from './sheep'
import { chickenParts, putChicken } from './chicken'
import { PersonRig, personParts } from './person'
import { cropParts } from './crops'
import { GROWERS, putEgg, putLemon } from './plants'
import type { CropId } from '../farm/data'

// Every model the kit makes, posed and moving, for the gallery page (open the site with ?gallery). Add a new
// model here as soon as it has a shape: it is the quickest way to see it from every side, in the game's light.
//
//   ?gallery                    everything, in a row
//   ?gallery&focus=cow          one entry, framed
//   &t=1.5                      time frozen at 1.5 s (for screenshots)
//   &az=30&el=12&dist=4         camera: degrees round from the front, degrees up, metres away
//   &x=0.4&y=1.6                what the camera looks at: across from the entry's middle, and how high

export interface GalleryModel {
  object: Object3D
  /** poses the model at time t (seconds) */
  update(t: number): void
  /** how wide the entry is (metres), for laying out the row and framing the camera */
  width: number
  /** how tall, for framing */
  height: number
  /** triangles drawn, for the label */
  triangles(): number
}

export interface GalleryEntry {
  id: string
  /** a word or two for the strip of models at the top */
  label: string
  name: string
  make(): GalleryModel
}

export const GALLERY: GalleryEntry[] = [
  {
    id: 'cow',
    label: 'Cows',
    name: 'Cows: walking, grazing, standing (three coats)',
    make() {
      const parts = cowParts(1)
      return {
        object: parts.group,
        width: 4.6,
        height: 1.6,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          putCow(parts, 0, -1.5, 0, 0.5, { phase: t * 5, stride: 1, graze: 0, tail: t * 1.7, look: 0 })
          putCow(parts, 1, 0, 0, 0.35, { phase: 0, stride: 0, graze: 1, tail: t * 1.4 + 2, chew: t * 5 })
          putCow(parts, 2, 1.5, 0, 0.2, { phase: 0, stride: 0, graze: 0, tail: t * 2 + 4, look: Math.sin(t * 0.7) * 0.5 })
          parts.end()
        },
      }
    },
  },
  {
    id: 'sheep',
    label: 'Sheep',
    name: 'Sheep: full fleece, half grown, just shorn (four faces)',
    make() {
      const parts = sheepParts(4)
      return {
        object: parts.group,
        width: 4.4,
        height: 1,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          putSheep(parts, 0, -1.65, 0, 0.4, { phase: t * 7, stride: 1, graze: 0, wool: 1 })
          putSheep(parts, 1, -0.55, 0, 0.3, { phase: 0, stride: 0, graze: 1, wool: 1, chew: t * 6 })
          putSheep(parts, 2, 0.55, 0, 0.2, { phase: 0, stride: 0, graze: 0, wool: 0.5, look: Math.sin(t * 0.8) * 0.4 })
          putSheep(parts, 3, 1.65, 0, -0.2, { phase: 0, stride: 0, graze: 0.3, wool: 0 })
          parts.end()
        },
      }
    },
  },
  {
    id: 'chickens',
    label: 'Hens',
    name: 'Hens (four colours) and the rooster',
    make() {
      const parts = chickenParts(4)
      return {
        object: parts.group,
        width: 2.2,
        height: 0.5,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          putChicken(parts, false, 0, -0.85, 0, 0.5, { phase: t * 11, stride: 1, peck: 0 })
          putChicken(parts, false, 1, -0.35, 0.1, 0.2, { phase: 0, stride: 0, peck: Math.max(0, Math.sin(t * 9)) })
          putChicken(parts, false, 2, 0.15, -0.05, -0.3, { phase: 0, stride: 0, peck: 0, look: Math.sin(t * 2) * 0.6 })
          putChicken(parts, false, 3, 0.55, 0.15, 0.8, { phase: 0, stride: 0, peck: 1 })
          putChicken(parts, true, 0, 0.95, -0.1, -0.5, { phase: t * 9, stride: 0.6, peck: 0 })
          parts.end()
        },
      }
    },
  },
  {
    id: 'people',
    label: 'People',
    name: 'People: walking, waving, standing (three hair styles, a hat)',
    make() {
      const parts = personParts(4)
      const looks = [
        { shirt: '#3f6fb0', trousers: '#2d3340', skin: '#e0b48f', hair: '#3a2a1e', hairStyle: 0, hat: false, height: 1 },
        { shirt: '#c0504a', trousers: '#5a6b48', skin: '#8d5a3c', hair: '#1c1714', hairStyle: 1, hat: false, height: 0.95 },
        { shirt: '#e8d9a8', trousers: '#6a4a3a', skin: '#f0cfb0', hair: '#c79a58', hairStyle: 2, hat: false, height: 0.97 },
        { shirt: '#6aa07a', trousers: '#3a3f55', skin: '#c08a64', hair: '#5a4030', hairStyle: 0, hat: true, height: 1.04 },
      ]
      const rigs = looks.map((l) => new PersonRig(l))
      return {
        object: parts.group,
        width: 3,
        height: 1.8,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          rigs.forEach((r, i) => {
            r.root.position.set(-1.2 + i * 0.8, 0, 0)
            r.root.rotation.y = [0.4, 0.1, -0.15, -0.4][i]
            const f = t * 6
            const amp = i === 0 ? 0.55 : 0
            r.thighL.rotation.x = -Math.sin(f) * amp
            r.thighR.rotation.x = Math.sin(f) * amp
            r.kneeL.rotation.x = Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03
            r.kneeR.rotation.x = Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03
            r.armL.rotation.x = Math.sin(f) * amp * 0.7
            r.armL.rotation.z = 0.06
            r.armR.rotation.x = i === 1 ? -2.7 : -Math.sin(f) * amp * 0.7
            r.armR.rotation.z = i === 1 ? -0.35 + Math.sin(t * 9) * 0.25 : -0.06
            r.elbowR.rotation.x = i === 1 ? -0.5 : -0.15
            r.head.rotation.y = i === 3 ? Math.sin(t * 13) * 0.4 : 0
            r.write(parts)
          })
          parts.end()
        },
      }
    },
  },
  {
    id: 'crops',
    label: 'Crops',
    name: 'Crops: every crop half grown, nearly ripe and ripe (front to back); lemons and eggs',
    make() {
      const parts = cropParts(0.3)
      const crops: CropId[] = ['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'sugarcane', 'wheat', 'pumpkin']
      return {
        object: parts.group,
        width: 4.6,
        height: 1.2,
        triangles: () => parts.triangles(),
        update() {
          parts.begin()
          parts.at(0, 0, 0)
          crops.forEach((crop, i) => {
            ;[1, 0.8, 0.45].forEach((g, j) => GROWERS[crop](parts, -2 + i * 0.55, 0, 0.6 - j * 0.6, g, 0.13 + i * 0.07 + j * 0.31))
          })
          for (let k = 0; k < 3; k++) putLemon(parts, 2.25, 0.3 + k * 0.12, -0.3 + k * 0.1, k)
          for (let k = 0; k < 3; k++) putEgg(parts, 2.2 + k * 0.08, 0, 0.4, k)
          parts.end()
        },
      }
    },
  },
]
