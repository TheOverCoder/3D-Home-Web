import type { Object3D } from 'three'
import { cowParts, putCow } from './cow'
import { putSheep, sheepParts } from './sheep'
import { chickenParts, putChicken } from './chicken'
import { PersonRig, personParts, type PersonLook } from './person'
import { CONTRACTOR_LOOK, MANAGER_LOOK, rollLook } from './look'
import { random } from '../lib/sculpt'
import { cropParts } from './crops'
import { GROWERS, putEgg, putLemon } from './plants'
import type { CropId } from '../farm/data'
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { coopModel, lemonSpots, lemonTreeModel, mouthGlowMaterial, mouthGlowShape, ovenModel, structureParts, troughModel } from './structures'
import { GOODS, type GoodsId } from './goods'
import { DESK_SCREEN, OFFICE_FLOOR, barnModel, crateModel, deskModel, farmGateModel, officeModel, palletModel, siloModel } from './buildings'
import { DRIVER, putTractor, seatDriver, tractorParts } from './tractor'
import { MARKET_MIDDLE, MARKET_SCREEN, MARKET_SIGN, marketFittingsParts, marketShellParts } from './market'
import { putSlidingDoor, slidingDoorParts } from './slidingDoor'
import { BROWSE_SPOTS, CONTRACTOR_SPOT, MANAGER_SPOT, MARKET_WALKIN, PAY_SPOT } from '../data/market'
import { carParts, putCar, putRollingCar, rollingCarParts } from './car'
import { ESTATE_MIDDLE, estateFittingsParts, parkingLotParts } from './estate'
import { walkInShellParts } from './market'
import { AGENT_SEAT, ESTATE_HOURS, ESTATE_SIGN, ESTATE_WALKIN, ESTATE_WINDOW, SALE_BOARD, SEAT_Y } from '../data/estate'
import { CAR_SPOT } from '../data/maps'
import { ESTATE_LOOK } from './look'
import { sitAtDesk } from './person'
import { setSculptGlow } from '../lib/sculpt'
import { decorModel, PATH_HALF, SECTION_HALF } from './decor'
import { FRUIT, FRUIT_KINDS, type DecorKind } from '../farm/decor'
import { fruitParts, fruitPlantModel, fruitSpots, putFruit } from './fruit'
import { bogleScarecrow, ploughmanScarecrow, squireScarecrow } from './scarecrows'
import { birchTree, oakTree, pineTree, poplarTree, type TreePart } from './trees'
import type { Structure } from './structures'
import { nestSpots, TOOL_LOOKS, TOOL_STYLES, toolModel } from './tools'

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
    name: 'People: walking, waving, standing (every hair style and hat), the manager (his tie), the contractor (his cap as a hard hat); behind them 24 looks the people engine rolls (rollLook, the same dice every time)',
    make() {
      const looks: PersonLook[] = [
        { shirt: '#3f6fb0', trousers: '#2d3340', skin: '#e0b48f', hair: '#3a2a1e', hairStyle: 0, hat: false, height: 1 },
        { shirt: '#c0504a', trousers: '#5a6b48', skin: '#8d5a3c', hair: '#1c1714', hairStyle: 1, hat: false, height: 0.95, eyes: '#4f6b3a' },
        { shirt: '#e8d9a8', trousers: '#6a4a3a', skin: '#f0cfb0', hair: '#c79a58', hairStyle: 2, hat: false, height: 0.97, sex: 'f', hips: 1.08, shoulders: 0.92, eyes: '#3f6a8f' },
        { shirt: '#6aa07a', trousers: '#3a3f55', skin: '#c08a64', hair: '#5a4030', hairStyle: 0, hat: true, height: 1.04 },
        { shirt: '#7b5aa6', trousers: '#283044', skin: '#704a32', hair: '#1c1c1c', hairStyle: 3, hat: false, height: 1.02, sex: 'm', shoulders: 1.08, hips: 0.94 },
        { shirt: '#2f8f8a', trousers: '#5a4636', skin: '#f6d5bd', hair: '#a8743f', hairStyle: 4, hat: 'beanie', hatBand: '#b23a48', height: 0.94, sex: 'f', eyes: '#3f6a8f' },
        { ...rollLook(random(5), MANAGER_LOOK), skin: '#e0ac87' },
        { ...rollLook(random(9), CONTRACTOR_LOOK), skin: '#c68863' },
        { shirt: '#d9a441', trousers: '#1f2a24', skin: '#9a6646', hair: '#2b2017', hairStyle: 3, hat: 'straw', hatBand: '#2f4a6b', height: 0.98, sex: 'f', eyes: '#6b5a2a' },
        { shirt: '#4d5d73', trousers: '#6b6255', skin: '#e0ac87', hair: '#d9b98a', hairStyle: 4, hat: false, height: 0.96, sex: 'f', hips: 1.06, shoulders: 0.94, eyes: '#4f6b3a' },
      ]
      const rigs = looks.map((l) => new PersonRig(l))
      // the rolled ones, six by four behind the row
      const rand = random(2024)
      const rolled = Array.from({ length: 24 }, (_, k) => {
        const r = new PersonRig(rollLook(rand))
        r.root.position.set(-2.0 + (k % 6) * 0.8, 0, -0.9 - Math.floor(k / 6) * 0.8)
        r.root.rotation.y = 0.25 * Math.sin(k * 1.7)
        return r
      })
      const parts = personParts(rigs.length + rolled.length)
      return {
        object: parts.group,
        width: 7.6,
        height: 1.8,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          rolled.forEach((r, k) => {
            r.head.rotation.y = 0.3 * Math.sin(t * 0.8 + k)
            r.write(parts)
          })
          rigs.forEach((r, i) => {
            r.root.position.set(-3.6 + i * 0.8, 0, 0)
            r.root.rotation.y = [0.4, 0.1, -0.15, -0.4, 0.3, -0.2, 0, 0.2, -0.3, 2.6][i]
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
    name: 'Crops: every crop half grown, nearly ripe and ripe (front to back); eggs',
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
          for (let k = 0; k < 3; k++) putEgg(parts, 2.2 + k * 0.08, 0, 0.4, k)
          parts.end()
        },
      }
    },
  },
  {
    id: 'farm',
    label: 'Farm',
    name: 'The farm: the oven (fire lit), the hen house, a trough, the lemon tree',
    make() {
      const oven = structureParts(ovenModel(), 'oven')
      const glow = new Mesh(mouthGlowShape().geometry(), mouthGlowMaterial(2.2))
      const coop = structureParts(coopModel(), 'coop')
      const trough = structureParts(troughModel(1.7, 0.55, 0.4), 'trough')
      const tree = structureParts(lemonTreeModel(), 'lemon-tree')
      const lemons = cropParts(0.5)
      lemons.begin()
      lemons.at(0, 0, 0)
      lemonSpots(8).forEach(([x, y, z], k) => putLemon(lemons, x, y, z, k))
      lemons.end()
      const treeAt = new Group()
      treeAt.add(tree.group, lemons.group)
      treeAt.position.x = 3.6
      const ovenAt = new Group()
      ovenAt.add(oven.group, glow)
      ovenAt.position.x = -2.4
      coop.group.position.x = -0.3
      trough.group.position.set(1.3, 0, 0)
      const object = new Group()
      object.add(ovenAt, coop.group, trough.group, treeAt)
      return {
        object,
        width: 6.6,
        height: 2.9,
        triangles: () => oven.triangles() + coop.triangles() + trough.triangles() + tree.triangles() + lemons.triangles(),
        update(t) {
          ;(glow.material as MeshStandardMaterial).emissiveIntensity = 2.2 * (0.75 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08)
        },
      }
    },
  },
  {
    id: 'stores',
    label: 'Stores',
    name: 'The silo and the barn',
    make() {
      const silo = structureParts(siloModel(), 'silo')
      const barn = structureParts(barnModel(), 'barn')
      silo.group.position.x = -2.2
      barn.group.position.x = 1.6
      barn.group.rotation.y = -0.5
      const object = new Group()
      object.add(silo.group, barn.group)
      return { object, width: 7.2, height: 5.8, triangles: () => silo.triangles() + barn.triangles(), update() {} }
    },
  },
  {
    id: 'office',
    label: 'Office',
    name: 'The order office, its desk and computer, a crate on its pallet, the farm gate',
    make() {
      const office = structureParts(officeModel(), 'office')
      const desk = structureParts(deskModel(), 'desk')
      const pallet = structureParts(palletModel(), 'pallet')
      const crate = structureParts(crateModel(), 'crate')
      const gate = structureParts(farmGateModel(), 'gate')
      // the desk in the office, against its back wall; a desk on its own beside it, to see it whole
      desk.group.position.set(-0.64, OFFICE_FLOOR, 0)
      const lone = structureParts(deskModel(), 'desk-lone')
      lone.group.position.set(-2.6, 0, 0.4)
      lone.group.rotation.y = 0.5
      const screen = new Mesh(new PlaneGeometry(DESK_SCREEN.half[0] * 2, DESK_SCREEN.half[1] * 2), new MeshStandardMaterial({ color: 0x0c1a22, emissive: 0x7fd3ff, emissiveIntensity: 0.6 }))
      screen.position.set(DESK_SCREEN.x + 0.002, DESK_SCREEN.y, 0)
      screen.rotation.y = Math.PI / 2
      lone.group.add(screen)
      pallet.group.position.set(2.0, 0, 0.6)
      crate.group.position.set(2.0, 0.14, 0.6)
      gate.group.position.set(3.6, 0, -0.2)
      const object = new Group()
      office.group.add(desk.group)
      object.add(office.group, lone.group, pallet.group, crate.group, gate.group)
      return {
        object,
        width: 8,
        height: 3,
        triangles: () => office.triangles() + desk.triangles() + lone.triangles() + pallet.triangles() + crate.triangles() + gate.triangles(),
        update() {},
      }
    },
  },
  {
    id: 'market',
    label: 'Market',
    name: "The market (its shell from the walk-in row, the shelves, the counter and till, the manager's desk and computer, the shop front, the sliding front door opening and shutting) and the contractor's cabin",
    make() {
      const shell = marketShellParts()
      const fittings = marketFittingsParts()
      const door = MARKET_WALKIN.autoDoor!
      const leaves = slidingDoorParts(door)
      const people = personParts(4)
      const rand = random(31)
      const at = (look: PersonLook, spot: { x: number; z: number; heading: number }) => {
        const r = new PersonRig(look)
        r.root.position.set(spot.x, 0, spot.z)
        r.root.rotation.y = spot.heading
        return r
      }
      const rigs = [at(rollLook(rand, MANAGER_LOOK), MANAGER_SPOT), at(rollLook(rand, CONTRACTOR_LOOK), CONTRACTOR_SPOT), at(rollLook(rand), BROWSE_SPOTS[0]), at(rollLook(rand), PAY_SPOT)]
      people.begin()
      for (const r of rigs) r.write(people)
      people.end()
      // (the screen and the sign as the scene draws them: planes where the model leaves room for them)
      const plane = (p: { x: number; y: number; z: number; half: readonly [number, number]; heading: number }, color: number) => {
        const m = new Mesh(new PlaneGeometry(p.half[0] * 2, p.half[1] * 2), new MeshStandardMaterial({ color: 0x0c1a22, emissive: color, emissiveIntensity: 0.5 }))
        m.position.set(p.x, p.y, p.z)
        m.rotation.y = p.heading
        return m
      }
      const object = new Group()
      const world = new Group()
      world.add(shell.group, fittings.group, leaves.group, people.group, plane(MARKET_SCREEN, 0x7fd3ff), plane(MARKET_SIGN, 0xf3ead8))
      // its front (north, to the lane) turned to the gallery's camera
      world.rotation.y = Math.PI
      world.position.set(MARKET_MIDDLE.x, 0, MARKET_MIDDLE.z)
      object.add(world)
      return {
        object,
        width: 10,
        height: 3.5,
        triangles: () => shell.triangles() + fittings.triangles() + leaves.triangles() + people.triangles(),
        // the front door opening and shutting, as it does for whoever comes near
        update(t) {
          putSlidingDoor(leaves, door, Math.min(1, Math.max(0, 0.5 + Math.sin(t * 0.8) * 0.8)))
        },
      }
    },
  },
  {
    id: 'tractor',
    label: 'Tractor',
    name: 'The tractor and its driver, four crates on its carrier, rolling on and off',
    make() {
      const parts = tractorParts(4)
      const people = personParts(1)
      const driver = new PersonRig(DRIVER)
      const object = new Group()
      object.add(parts.group, people.group)
      return {
        object,
        width: 4,
        height: 2.2,
        triangles: () => parts.triangles() + people.triangles(),
        update(t) {
          const roll = Math.sin(t * 0.6) * 1.2
          parts.begin()
          putTractor(parts, 0, 0, Math.PI / 2, roll, 4)
          parts.end()
          driver.root.position.set(0, 0, 0)
          driver.root.rotation.y = Math.PI / 2
          seatDriver(driver, Math.sin(t * 0.5) * 0.4)
          people.begin()
          driver.write(people)
          people.end()
        },
      }
    },
  },
  {
    id: 'car',
    label: 'Car',
    name: 'The car that drives you between the farm and the house: a small hatchback, its wheels in its arches',
    make() {
      const parts = carParts(1)
      return {
        object: parts.group,
        width: 4.2,
        height: 1.6,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          // three quarters on, turning slowly
          putCar(parts, 0, 0, -2.4 + Math.sin(t * 0.4) * 0.5)
          parts.end()
        },
      }
    },
  },
  {
    id: 'car-road',
    label: 'Car on the road',
    name: "The car on the road, in the drive's film: its wheels apart, rolling, its body swaying on its springs as it pulls away and brakes",
    make() {
      const parts = rollingCarParts()
      return {
        object: parts.group,
        width: 4.2,
        height: 1.6,
        triangles: () => parts.triangles(),
        update(t) {
          parts.begin()
          // side on, rolling to and fro, squatting as it sets off and dipping as it stops
          const k = Math.sin(t * 0.9)
          putRollingCar(parts, 0, 0, -Math.PI / 2 - 0.5, k * 2.4, { pitch: Math.cos(t * 0.9) * 0.03, lift: Math.sin(t * 5) * 0.006 })
          parts.end()
        },
      }
    },
  },
  {
    id: 'estate',
    label: 'Estate office',
    name: 'The estate office (its shell from the walk-in row, weatherboards; the agent sitting at his desk, the house for sale on the wall, the sign, the hours and the window; the sliding door opening and shutting), the parking lot with the car in its bay',
    make() {
      const shell = walkInShellParts(ESTATE_WALKIN)
      const fittings = estateFittingsParts()
      const door = ESTATE_WALKIN.autoDoor!
      const leaves = slidingDoorParts(door)
      const lot = parkingLotParts()
      const car = carParts(1)
      car.begin()
      putCar(car, CAR_SPOT.farm.x, CAR_SPOT.farm.z, CAR_SPOT.farm.heading)
      car.end()
      const people = personParts(1)
      const agent = new PersonRig(rollLook(random(4271), ESTATE_LOOK))
      agent.root.position.set(AGENT_SEAT.x, 0, AGENT_SEAT.z)
      agent.root.rotation.y = AGENT_SEAT.heading
      // (the pictures as the scene draws them: planes where the model leaves room for them)
      const plane = (p: { x: number; y: number; z: number; half: readonly [number, number] }, color: number, heading = Math.PI) => {
        const m = new Mesh(new PlaneGeometry(p.half[0] * 2, p.half[1] * 2), new MeshStandardMaterial({ color: 0x0c1a22, emissive: color, emissiveIntensity: 0.5 }))
        m.position.set(p.x, p.y, p.z)
        m.rotation.y = heading
        return m
      }
      const world = new Group()
      world.add(
        shell.group,
        fittings.group,
        leaves.group,
        lot.group,
        car.group,
        people.group,
        plane({ ...ESTATE_SIGN, z: ESTATE_SIGN.z - 0.047 }, 0x22344f),
        plane({ ...ESTATE_HOURS, z: ESTATE_HOURS.z - 0.022 }, 0xf6f1e4),
        plane({ ...ESTATE_WINDOW, z: ESTATE_WINDOW.z - 0.01 }, 0x26394a),
        plane({ ...SALE_BOARD, x: SALE_BOARD.x + 0.018 }, 0xf6f1e4, Math.PI / 2),
      )
      // its front (north, to the lane) turned to the gallery's camera, the lot to its right
      world.rotation.y = Math.PI
      world.position.set(ESTATE_MIDDLE.x - 2, 0, ESTATE_MIDDLE.z - 1)
      const object = new Group()
      object.add(world)
      return {
        object,
        width: 10,
        height: 3,
        triangles: () => shell.triangles() + fittings.triangles() + leaves.triangles() + lot.triangles() + car.triangles() + people.triangles(),
        update(t) {
          putSlidingDoor(leaves, door, Math.min(1, Math.max(0, 0.5 + Math.sin(t * 0.8) * 0.8)))
          sitAtDesk(agent, SEAT_Y, Math.sin(t * 0.6) * 0.4)
          people.begin()
          agent.write(people)
          people.end()
        },
      }
    },
  },
  {
    id: 'goods',
    label: 'Goods',
    name: 'The goods, as their pictures show them (?items draws the pictures)',
    make() {
      const ids = Object.keys(GOODS) as GoodsId[]
      const object = new Group()
      const all = ids.map((id, k) => {
        const parts = structureParts(GOODS[id](), `goods-${id}`)
        // three rows, side by side
        parts.group.position.set(((k % 10) - 4.5) * 0.42, 0, (Math.floor(k / 10) - 1) * 0.6)
        object.add(parts.group)
        return parts
      })
      return { object, width: 4.4, height: 0.8, triangles: () => all.reduce((n, p) => n + p.triangles(), 0), update() {} }
    },
  },
  {
    id: 'decor',
    label: 'Decoration',
    name: "The farm's decoration (its glass lit): a fence and a hedge each three sections round a corner, four path tiles, stepping stones, flowers, a planter, a bush, roses, a bird bath; a bench, a yard lamp, a path lantern, a wishing well; a shade tree and a pine",
    make() {
      // the lamps' glass glowing, as at night (the gallery's own page: nothing else glows)
      setSculptGlow(1)
      const object = new Group()
      const all: ReturnType<typeof structureParts>[] = []
      const put = (kind: DecorKind, x: number, z: number, turn = 0) => {
        const parts = structureParts(decorModel(kind), `decor-${kind}-${all.length}`)
        parts.group.position.set(x, 0, z)
        parts.group.rotation.y = turn
        object.add(parts.group)
        all.push(parts)
      }
      // runs of sections every 2 m, round a corner: two along x, the third turned to run back along z
      const run = (kind: DecorKind, x: number, z: number) => {
        put(kind, x + SECTION_HALF, z)
        put(kind, x + 3 * SECTION_HALF, z)
        put(kind, x + 4 * SECTION_HALF, z - SECTION_HALF, Math.PI / 2)
      }
      run('fence', -5.2, 1.2)
      run('hedge', -5.2, -1.4)
      for (const [i, j] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        put('path', -1.4 + i * 2 * PATH_HALF, 1.1 + j * 2 * PATH_HALF)
      put('stones', 0.6, 1.6)
      put('flowers', 1.6, 1.9)
      put('planter', 2.9, 1.9)
      put('bush', 4.0, 1.7)
      put('roses', 5.1, 1.7)
      put('birdbath', 6.2, 1.7)
      put('bench', 0.4, -0.4, 0.3)
      put('lamp', 1.8, -0.6)
      put('lantern', 2.6, -0.2)
      put('well', 4.0, -0.4, -0.3)
      put('tree', -2.4, -3.6)
      put('pine', 6.2, -2.6)
      return { object, width: 12.4, height: 4.8, triangles: () => all.reduce((n, p) => n + p.triangles(), 0), update() {} }
    },
  },
  {
    id: 'fruit',
    label: 'Fruit trees',
    name: 'Fruit trees and bushes, ten fruit on each: an apple tree, an orange tree, a cherry tree, a blueberry bush, a raspberry bush',
    make() {
      const object = new Group()
      const fruit = fruitParts(10)
      const plants = FRUIT_KINDS.map((kind, i) => {
        const parts = structureParts(fruitPlantModel(kind), `fruit-${kind}`)
        const x = [-4.4, -2.0, 0.4, 2.5, 4.2][i]
        parts.group.position.x = x
        object.add(parts.group)
        return { kind, x, parts }
      })
      fruit.begin()
      for (const p of plants) {
        fruit.at(p.x, 0, 0)
        fruitSpots(p.kind, 10).forEach(([x, y, z], k) => putFruit(fruit, FRUIT[p.kind].fruit, x, y, z, k))
      }
      fruit.end()
      object.add(fruit.group)
      return { object, width: 10.4, height: 3.6, triangles: () => plants.reduce((n, p) => n + p.parts.triangles(), 0) + fruit.triangles(), update() {} }
    },
  },
  {
    id: 'scarecrows',
    label: 'Scarecrows',
    name: "The farm's scarecrows (decoration, src/models/scarecrows.ts), of the English and Scottish fields: the squire with a turnip head, the ploughman with a mangel head, the bogle with a sack head, a tartan scarf and a clapper",
    make() {
      const object = new Group()
      const all = [squireScarecrow, ploughmanScarecrow, bogleScarecrow].map((make, k) => {
        const parts = structureParts(make(), `scarecrow-${k}`)
        parts.group.position.x = (k - 1) * 1.7
        object.add(parts.group)
        return parts
      })
      return { object, width: 5.2, height: 2.3, triangles: () => all.reduce((n, p) => n + p.triangles(), 0), update() {} }
    },
  },
  {
    id: 'woods',
    label: 'Woods',
    name: "The farm's big trees (src/models/trees.ts): an oak as in the garden's corners and as in the woods, a birch, a poplar and a pine",
    make() {
      const object = new Group()
      const trees: [Structure<TreePart>, number][] = [
        [oakTree(7.5, 21, 0, 6), -8.4],
        [oakTree(8.6, 44, 1), -2.6],
        [birchTree(8.2, 46), 2.2],
        [poplarTree(8.4, 45), 5.4],
        [pineTree(8.0, 41), 9.2],
      ]
      const all = trees.map(([model, x], k) => {
        const parts = structureParts(model, `tree-${k}`)
        parts.group.position.x = x
        object.add(parts.group)
        return parts
      })
      return { object, width: 22, height: 9.6, triangles: () => all.reduce((n, p) => n + p.triangles(), 0), update() {} }
    },
  },
  {
    id: 'tools',
    label: 'Tools',
    name: "The animals' tools (src/models/tools.ts), three families for the design lab's choice, each the coop with its eggs, the milk bucket and the shears with their wool: A little red houses, B tin and blue enamel, C wicker and plain wood",
    make() {
      const object = new Group()
      const eggs = cropParts(0.2)
      eggs.begin()
      const all = TOOL_STYLES.flatMap((style, s) =>
        TOOL_LOOKS.map((look, l) => {
          const parts = structureParts(toolModel(look, style), `tool-${style}-${look}`)
          const x = (s * 3 + l - 4) * 1.15 + (s - 1) * 0.6
          parts.group.position.x = x
          object.add(parts.group)
          if (look === 'nests')
            nestSpots(style).forEach(([ex, ey, ez], k) => {
              eggs.at(x, 0, 0)
              putEgg(eggs, ex, ey, ez, k)
            })
          return parts
        }),
      )
      eggs.end()
      object.add(eggs.group)
      return { object, width: 12.6, height: 1.5, triangles: () => all.reduce((n, p) => n + p.triangles(), 0) + eggs.triangles(), update() {} }
    },
  },
]
