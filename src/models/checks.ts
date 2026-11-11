import { DoubleSide } from 'three'
import { checkPieces, checkPose, ellipsoid, lathe, piecesOf, posedPieces, random, type Issue, type Parts } from '../lib/sculpt'
import { PRODUCERS, type CropId } from '../farm/data'
import { COATS, cowParts, putCow, type CowPose } from './cow'
import { FACES, putSheep, sheepParts, type SheepPose } from './sheep'
import { chickenParts, putChicken, type ChickenPose } from './chicken'
import { HAIR_PARTS, PersonRig, personParts, type HatKind, type PersonLook } from './person'
import { CONTRACTOR_LOOK, MANAGER_LOOK, rollLook } from './look'
import { cropParts } from './crops'
import { GROWERS, putEgg, putLemon } from './plants'
import { coopModel, lemonSpots, lemonTreeModel, ovenModel, structurePieces, troughModel, type Structure } from './structures'
import { GOODS, type GoodsId } from './goods'
import { barnModel, crateModel, deskModel, farmGateModel, officeModel, palletModel, siloModel } from './buildings'
import { DRIVER, putTractor, seatDriver, tractorParts } from './tractor'
import { marketFittingsParts, putMarketFittings, walkInShellModel } from './market'
import { putSlidingDoor, slidingDoorParts } from './slidingDoor'
import { WALK_INS } from '../data/buildings'

// Every model, in every variant and in the poses it takes in the game, run through the kit's checks (see
// src/lib/sculpt/check.ts): every piece holds on to the rest, and the model stands on its ground. The gallery shows
// the findings, the e2e suite (12-models) fails on any, and new models belong here as soon as they exist.

/** Parts drawn from both sides (leaves, a shell) are open surfaces by design: their edges are not holes. */
const openParts = (parts: Parts) => Object.entries(parts.meshes).flatMap(([k, m]) => ((Array.isArray(m.material) ? m.material[0] : m.material).side === DoubleSide ? [k] : []))
const openStructure = (s: Structure) => Object.entries(s).flatMap(([k, p]) => (p.material?.doubleSided ? [k] : []))
/** A structure's pieces and its options for checkPieces. */
const structure = (s: Structure) => [structurePieces(s), { ground: 0, open: openStructure(s) }] as const

export interface ModelCheck {
  id: string
  name: string
  run(): Issue[]
}

const cowPoses: [string, CowPose, boolean][] = [
  ['standing', { phase: 0, stride: 0, graze: 0, tail: 0 }, true],
  ['grazing', { phase: 0, stride: 0, graze: 1, tail: 1.2, chew: Math.PI / 2 }, true],
  ['looking round', { phase: 0, stride: 0, graze: 0, tail: -1.4, look: 0.6 }, true],
  ['mid-stride', { phase: Math.PI / 2, stride: 1, graze: 0, tail: 2 }, false],
  ['other stride', { phase: (3 * Math.PI) / 2, stride: 1, graze: 0.3, tail: 4 }, false],
]

const sheepPoses: [string, Omit<SheepPose, 'wool'>, boolean][] = [
  ['standing', { phase: 0, stride: 0, graze: 0 }, true],
  ['grazing', { phase: 0, stride: 0, graze: 1, chew: Math.PI / 2 }, true],
  ['looking round', { phase: 0, stride: 0, graze: 0.2, look: -0.5 }, true],
  ['mid-stride', { phase: Math.PI / 2, stride: 1, graze: 0 }, false],
]

const chickenPoses: [string, ChickenPose, boolean][] = [
  ['standing', { phase: 0, stride: 0, peck: 0 }, true],
  ['pecking', { phase: 0, stride: 0, peck: 1 }, true],
  ['half a peck', { phase: 0, stride: 0, peck: 0.5, look: 0.4 }, true],
  ['looking round', { phase: 0, stride: 0, peck: 0, look: -0.7 }, true],
  ['mid-stride', { phase: Math.PI / 2, stride: 1, peck: 0 }, false],
]

const LOOKS: PersonLook[] = [
  { shirt: '#3f6fb0', trousers: '#2d3340', skin: '#e0b48f', hair: '#3a2a1e', hairStyle: 0, hat: false, height: 1 },
  { shirt: '#c0504a', trousers: '#5a6b48', skin: '#8d5a3c', hair: '#1c1714', hairStyle: 1, hat: true, height: 0.95 },
  { shirt: '#e8d9a8', trousers: '#6a4a3a', skin: '#f0cfb0', hair: '#c79a58', hairStyle: 2, hat: false, height: 1.05 },
  // the people engine's builds at the ends of their ranges (src/models/look.ts): broad shoulders on narrow hips, wide
  // hips under narrow shoulders, the smallest and the biggest heads; the new hair styles, hats and the tie
  { ...MANAGER_LOOK, skin: '#c68863', hips: 0.9, shoulders: 1.1, head: 1.05, eyes: '#3f6a8f' } as PersonLook,
  { ...rollLook(random(7), { sex: 'f' }), hairStyle: 4, hat: 'beanie', hips: 1.1, shoulders: 0.9, head: 0.95, height: 0.92 },
  { ...rollLook(random(11), { sex: 'm' }), hairStyle: 3, hat: 'cap', hips: 0.9, shoulders: 1.1, head: 0.95, height: 1.08 },
  { ...rollLook(random(13), { sex: 'f' }), ...CONTRACTOR_LOOK, hairStyle: 3, hips: 1.1, shoulders: 0.9, head: 1.05 },
]

type PersonPose = (r: PersonRig) => void
const personPoses: [string, PersonPose, boolean][] = [
  ['standing', () => {}, true],
  [
    'walking',
    (r) => {
      r.thighL.rotation.x = -0.5
      r.thighR.rotation.x = 0.5
      r.kneeL.rotation.x = 0.6
      r.armL.rotation.x = 0.4
      r.armR.rotation.x = -0.4
    },
    false,
  ],
  [
    'waving',
    (r) => {
      r.armR.rotation.x = -2.7
      r.armR.rotation.z = -0.6
      r.elbowR.rotation.x = -0.5
    },
    true,
  ],
  [
    'cheering',
    (r) => {
      r.armL.rotation.x = -2.6
      r.armL.rotation.z = 0.25
      r.elbowL.rotation.x = -0.3
      r.armR.rotation.x = -2.7
      r.armR.rotation.z = -0.25
    },
    true,
  ],
  [
    'shaking the head',
    (r) => {
      r.head.rotation.y = 0.4
      r.head.rotation.x = 0.25
    },
    true,
  ],
]

const CROPS: CropId[] = ['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'sugarcane', 'wheat', 'pumpkin']
const STAGES = [0.2, 0.45, 0.7, 0.9, 1]

export const MODEL_CHECKS: ModelCheck[] = [
  {
    id: 'cow',
    name: 'Cows',
    run() {
      const parts = cowParts(1)
      const open = openParts(parts)
      return COATS.flatMap((coat, k) =>
        cowPoses.flatMap(([pose, p, grounded]) => checkPose(`cow (${coat.name}), ${pose}`, parts, (pp) => putCow(pp, k, 0, 0, 0, p), { ground: grounded ? 0 : undefined, open })),
      )
    },
  },
  {
    id: 'sheep',
    name: 'Sheep',
    run() {
      const parts = sheepParts(1)
      const open = openParts(parts)
      return [0, 0.5, 1].flatMap((wool) =>
        FACES.flatMap((_, k) =>
          sheepPoses.flatMap(([pose, p, grounded]) =>
            checkPose(`sheep (face ${k + 1}, wool ${wool}), ${pose}`, parts, (pp) => putSheep(pp, k, 0, 0, 0, { ...p, wool }), { ground: grounded ? 0 : undefined, open }),
          ),
        ),
      )
    },
  },
  {
    id: 'chickens',
    name: 'Hens and the rooster',
    run() {
      const parts = chickenParts(1)
      const open = openParts(parts)
      return [false, true].flatMap((rooster) =>
        chickenPoses.flatMap(([pose, p, grounded]) =>
          checkPose(`${rooster ? 'rooster' : 'hen'}, ${pose}`, parts, (pp) => putChicken(pp, rooster, 0, 0, 0, 0, p), { ground: grounded ? 0 : undefined, open }),
        ),
      )
    },
  },
  {
    id: 'people',
    name: 'People',
    run() {
      const parts = personParts(1)
      const open = openParts(parts)
      const posed = LOOKS.flatMap((look, k) =>
        personPoses.flatMap(([pose, apply, grounded]) => {
          const rig = new PersonRig(look)
          apply(rig)
          return checkPose(`person ${k + 1}, ${pose}`, parts, (pp) => rig.write(pp), { ground: grounded ? 0 : undefined, open })
        }),
      )
      // every hair style under every hat (and none), standing
      const hats: (false | HatKind)[] = [false, 'straw', 'cap', 'beanie']
      const worn = HAIR_PARTS.flatMap((style, hairStyle) =>
        hats.flatMap((hat) => checkPose(`${style} under ${hat || 'no hat'}`, parts, (pp) => new PersonRig({ ...LOOKS[0], hairStyle, hat }).write(pp), { ground: 0, open })),
      )
      return [...posed, ...worn]
    },
  },
  {
    id: 'crops',
    name: 'Crops, lemons and eggs',
    run() {
      const parts = cropParts(0.1)
      const open = openParts(parts)
      const issues = CROPS.flatMap((crop) =>
        STAGES.flatMap((g) =>
          [0.17, 0.71].flatMap((seed) => checkPose(`${crop} at ${Math.round(g * 100)}% (seed ${seed})`, parts, (pp) => GROWERS[crop](pp, 0, 0, 0, g, seed), { ground: 0, sink: 0.06, open })),
        ),
      )
      // an egg rests on the floor of the nest
      for (let k = 0; k < 3; k++) issues.push(...checkPose(`egg ${k + 1}`, parts, (pp) => putEgg(pp, 0, 0, 0, k), { ground: 0, sink: 0.004, open }))
      return issues
    },
  },
  {
    id: 'farm',
    name: 'The farm: oven, hen house, troughs, lemon tree',
    run() {
      const lemons = cropParts(0.1)
      return [
        checkPieces('oven', ...structure(ovenModel())),
        checkPieces('hen house', ...structure(coopModel())),
        checkPieces("the pasture's trough", ...structure(troughModel(1.7, 0.55, 0.4))),
        checkPieces("the fold's trough", ...structure(troughModel(1.1, 0.45, 0.34))),
        // every lemon holds on to the tree by its stalk
        checkPieces(
          'lemon tree with its lemons',
          [
            ...structurePieces(lemonTreeModel()),
            ...posedPieces(lemons, (pp) => {
              pp.at(0, 0, 0)
              lemonSpots(PRODUCERS.tree.max).forEach(([x, y, z], k) => putLemon(pp, x, y, z, k))
            }),
          ],
          { ground: 0, open: openParts(lemons) },
        ),
      ].flat()
    },
  },
  {
    id: 'stores',
    name: 'The silo, the barn, the order office and its desk, a crate, the pallet, the farm gate',
    run() {
      return [
        checkPieces('silo', ...structure(siloModel())),
        checkPieces('barn', ...structure(barnModel())),
        checkPieces('order office', ...structure(officeModel())),
        checkPieces('desk and computer', ...structure(deskModel())),
        checkPieces('crate', ...structure(crateModel())),
        checkPieces('pallet', ...structure(palletModel())),
        checkPieces('farm gate', ...structure(farmGateModel())),
      ].flat()
    },
  },
  {
    id: 'tractor',
    name: 'The tractor, its driver and its crates',
    run() {
      const parts = tractorParts(4)
      const people = personParts(1)
      const open = [...openParts(parts), ...openParts(people)]
      return [0, 2, 4].flatMap((aboard) =>
        [0, 0.7].flatMap((roll) => {
          const driver = new PersonRig(DRIVER)
          seatDriver(driver, roll ? 0.6 : 0)
          // the tractor with its crates, and the driver on its seat, as one model
          const pieces = [
            ...posedPieces(parts, (pp) => {
              pp.begin()
              putTractor(pp, 0, 0, 0, roll, aboard)
            }),
            ...posedPieces(people, (pp) => {
              pp.begin()
              driver.write(pp)
            }),
          ]
          return checkPieces(`tractor with ${aboard} crates, wheels turned ${roll} m`, pieces, { ground: 0, open })
        }),
      )
    },
  },
  {
    id: 'market',
    name: "The walk-in buildings (the market and the contractor's cabin) with their fittings",
    run() {
      const fittings = marketFittingsParts()
      return WALK_INS.flatMap((def) => {
        // the shell and what stands in it and on it, as one model: the sign, the awning and the window hold on to the
        // walls, the till to the counter, the computer to the desk; the sliding door's leaves, shut and open, to the
        // wall at either side of the doorway
        const door = def.autoDoor
        const leaves = door ? slidingDoorParts(door) : null
        return [0, 1].flatMap((open) =>
          open && !leaves
            ? []
            : checkPieces(
                `${def.id}${leaves ? `, its door ${open ? 'open' : 'shut'}` : ''}`,
                [
                  ...structurePieces(walkInShellModel(def)),
                  ...(def.id === 'market' ? posedPieces(fittings, putMarketFittings) : []),
                  ...(leaves && door ? posedPieces(leaves, (pp) => putSlidingDoor(pp, door, open)) : []),
                ],
                { ground: 0 },
              ),
        )
      })
    },
  },
  {
    id: 'goods',
    name: 'The goods (the item pictures)',
    run() {
      return (Object.keys(GOODS) as GoodsId[]).flatMap((id) => checkPieces(id.replace('_', ' '), ...structure(GOODS[id]())))
    },
  },
]

/** The checks must catch what they are for: a ball with a smaller one a centimetre off its side, the pair two
 *  centimetres above the ground, has to come back loose and floating; a cup standing on the ball, open at the top,
 *  shows a hole. */
export function checkerSelfTest(): string[] {
  const ball = ellipsoid(0.1, 0.1, 0.1, 12, 8).place([0, 0.12, 0]).geometry()
  const loose = ellipsoid(0.03, 0.03, 0.03, 8, 4).place([0.14, 0.12, 0]).geometry()
  const cup = lathe(
    [
      [0, 0.2],
      [0.04, 0.21],
      [0.05, 0.27],
    ],
    { seg: 10, steps: 1 },
  ).geometry()
  return checkPieces('sample', [...piecesOf('ball', ball), ...piecesOf('loose', loose), ...piecesOf('cup', cup)], { ground: 0 }).map((i) => i.kind)
}
