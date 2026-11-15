// The estate office and the parking lot in the scene (src/data/estate.ts): the walk-in building (src/scene/WalkIn.tsx:
// its door shut out of the office's hours), its fittings and the lot (src/models/estate.ts), the pictures on its front
// and inside — the sign with the logo (a house and a key), the opening hours, the house for sale in its window and on
// its wall — and the things you press or tap: the agent (his panel: the house for sale), the board on the wall (the
// house's price tag), and the door out of hours (when it opens). The agent himself is drawn with the market's people
// (./marketPeople.ts); where he is comes from the clock (estateAgentNow, src/farm/state.ts). The car in the lot is
// src/farm/car.

import { useEffect, useMemo } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { BufferAttribute, BufferGeometry, CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three'
import type { Box } from '../data/buildings'
import { AGENT_SEAT, AGENT_STAND, CABINET, ESTATE_DESK, ESTATE_HOURS, ESTATE_PATH, ESTATE_SIGN, ESTATE_WALKIN, ESTATE_WINDOW, PARKING_SIGN, PLANT, SALE_BOARD } from '../data/estate'
import { debugSet } from '../lib/debug'
import { useInteractable } from '../lib/interaction'
import { estateFittingsParts, parkingLotParts } from '../models/estate'
import { WalkIn, hidingPiece, walkInDoor } from '../scene/WalkIn'
import { useHome } from '../store'
import { art } from '../ui/art'
import { ESTATE } from './data'
import { clockOf, hoursText, opensAt } from './day'
import { agentBackIn, agentHere, estateAgentNow, estateOpen, estateOpensIn, farm, useFarm } from './state'

const mmss = (seconds: number) => {
  const t = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

// ───────────────────────────── the pictures ─────────────────────────────

/** The pictures, all on one canvas (one texture, one draw outside and one inside): each a region of it in pixels. */
const W = 1024
const H = 1024
const REGIONS = {
  sign: { x: 0, y: 0, w: 1024, h: 240 },
  hours: { x: 0, y: 256, w: 512, h: 380 },
  window: { x: 528, y: 256, w: 300, h: 500 },
  parking: { x: 848, y: 256, w: 176, h: 176 },
  board: { x: 0, y: 640, w: 512, h: 384 },
} as const
type Region = keyof typeof REGIONS

const NAVY = '#22344f'
const GOLD = '#d8b25a'
const CREAM = '#f6f1e4'
const RED = '#c8402f'
const DISPLAY = '"Fredoka Variable", Fredoka, ui-rounded, system-ui, sans-serif'
const TEXT = '"Nunito Variable", Nunito, system-ui, sans-serif'

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** The logo: a house drawn in one gold line, a key through its door. In a box `s` across at (x, y). */
function logo(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const u = s / 100
  g.save()
  g.translate(x, y)
  g.scale(u, u)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = GOLD
  g.lineWidth = 7
  // the house: a roof and its walls, the chimney
  g.beginPath()
  g.moveTo(12, 46)
  g.lineTo(50, 12)
  g.lineTo(88, 46)
  g.moveTo(22, 38)
  g.lineTo(22, 88)
  g.lineTo(78, 88)
  g.lineTo(78, 38)
  g.moveTo(68, 29)
  g.lineTo(68, 16)
  g.lineTo(76, 16)
  g.lineTo(76, 36)
  g.stroke()
  // the key: its bow, its shaft and its bit, in the house
  g.fillStyle = GOLD
  g.beginPath()
  g.arc(50, 50, 11, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = NAVY
  g.beginPath()
  g.arc(50, 50, 4.5, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = GOLD
  g.fillRect(46.5, 58, 7, 24)
  g.fillRect(53, 70, 8, 5)
  g.fillRect(53, 78, 6, 4)
  g.restore()
}

/** The house as a picture (the interface's art), once loaded; its coin. */
type Pics = { house?: HTMLImageElement; coin?: HTMLImageElement }

/** A poster of the house for sale (or sold): a cream card, a red banner, the house, its price with a coin. */
function poster(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, pics: Pics, sold: boolean) {
  g.fillStyle = CREAM
  g.fillRect(r.x, r.y, r.w, r.h)
  const band = r.h * 0.2
  g.fillStyle = sold ? NAVY : RED
  g.fillRect(r.x, r.y, r.w, band)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `600 ${Math.round(band * 0.62)}px ${DISPLAY}`
  g.fillText(sold ? 'SOLD' : 'FOR SALE', r.x + r.w / 2, r.y + band / 2 + 2)
  const pic = Math.min(r.w * 0.62, r.h * 0.5)
  if (pics.house) g.drawImage(pics.house, r.x + (r.w - pic) / 2, r.y + band + r.h * 0.04, pic, pic)
  const priceY = r.y + band + r.h * 0.06 + pic + (r.h - band - r.h * 0.06 - pic) / 2
  g.fillStyle = NAVY
  g.font = `800 ${Math.round(r.h * 0.12)}px ${TEXT}`
  if (sold) g.fillText('Thank you!', r.x + r.w / 2, priceY)
  else {
    const text = String(ESTATE.price)
    const coin = r.h * 0.12
    const tw = g.measureText(text).width
    const x0 = r.x + (r.w - (coin + 8 + tw)) / 2
    if (pics.coin) g.drawImage(pics.coin, x0, priceY - coin / 2, coin, coin)
    g.textAlign = 'left'
    g.fillText(text, x0 + coin + 8, priceY + 2)
  }
}

/** Draws every picture on the canvas: the sign, the hours, the window, the parking sign and the board inside. */
function drawPictures(c: HTMLCanvasElement, pics: Pics, sold: boolean) {
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  // the sign: navy, a gold line in from its edge, the logo, the words
  const s = REGIONS.sign
  g.fillStyle = NAVY
  g.fillRect(s.x, s.y, s.w, s.h)
  g.strokeStyle = GOLD
  g.lineWidth = 5
  g.strokeRect(s.x + 12, s.y + 12, s.w - 24, s.h - 24)
  logo(g, s.x + 34, s.y + 30, 180)
  g.fillStyle = '#ffffff'
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = `600 92px ${DISPLAY}`
  g.fillText('ESTATE AGENT', s.x + 240, s.y + 104)
  g.fillStyle = GOLD
  g.font = `700 40px ${TEXT}`
  g.fillText('Homes for sale', s.x + 244, s.y + 178)
  // the hours: a cream plaque
  const h = REGIONS.hours
  g.fillStyle = CREAM
  g.fillRect(h.x, h.y, h.w, h.h)
  g.fillStyle = NAVY
  g.textAlign = 'center'
  g.font = `600 64px ${DISPLAY}`
  g.fillText('OPEN', h.x + h.w / 2, h.y + 92)
  g.font = `800 92px ${TEXT}`
  g.fillText(hoursText('estate').replace(' – ', '–'), h.x + h.w / 2, h.y + 210)
  g.fillStyle = '#5b6573'
  g.font = `700 42px ${TEXT}`
  g.fillText('every day', h.x + h.w / 2, h.y + 310)
  // the window: dark glass, the sky caught in its top, the poster of the house in it
  const w = REGIONS.window
  const glass = g.createLinearGradient(0, w.y, 0, w.y + w.h)
  glass.addColorStop(0, '#5f7f96')
  glass.addColorStop(0.35, '#26394a')
  glass.addColorStop(1, '#1b2a37')
  g.fillStyle = glass
  g.fillRect(w.x, w.y, w.w, w.h)
  poster(g, { x: w.x + 30, y: w.y + 70, w: w.w - 60, h: 330 }, pics, sold)
  // the parking sign: a white P on blue
  const p = REGIONS.parking
  g.fillStyle = '#ffffff'
  g.fillRect(p.x, p.y, p.w, p.h)
  g.fillStyle = '#1f5fa8'
  roundRect(g, p.x + 8, p.y + 8, p.w - 16, p.h - 16, 18)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = `800 132px ${TEXT}`
  g.textAlign = 'center'
  g.fillText('P', p.x + p.w / 2, p.y + p.h / 2 + 8)
  // the board on the wall inside: the same poster, larger
  const b = REGIONS.board
  poster(g, b, pics, sold)
}

/** One picture's quad: its middle, which way is right and up on it (its face looks along right × up), half its size,
 *  and its region of the canvas. */
interface Quad {
  at: [number, number, number]
  right: [number, number, number]
  half: readonly [number, number]
  region: Region
}

const NORTH: [number, number, number] = [-1, 0, 0] // facing the lane (−z): its right is −x
const EAST: [number, number, number] = [0, 0, -1] // facing +x: its right is −z

/** The quads as one geometry, its UVs in the canvas. */
function quads(list: Quad[]): BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const index: number[] = []
  for (const q of list) {
    const [rx, , rz] = q.right
    // the face's normal: right × up (up is +y)
    const n: [number, number, number] = [-rz, 0, rx]
    const r = REGIONS[q.region]
    const u0 = r.x / W
    const u1 = (r.x + r.w) / W
    const v0 = 1 - (r.y + r.h) / H
    const v1 = 1 - r.y / H
    const k = pos.length / 3
    for (const [sx, sy, u, v] of [
      [-1, -1, u0, v0],
      [1, -1, u1, v0],
      [1, 1, u1, v1],
      [-1, 1, u0, v1],
    ]) {
      pos.push(q.at[0] + rx * sx * q.half[0], q.at[1] + sy * q.half[1], q.at[2] + rz * sx * q.half[0])
      nor.push(...n)
      uv.push(u, v)
    }
    index.push(k, k + 1, k + 2, k, k + 2, k + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

/** Outside: the sign, the hours, the window (each just in front of its board or frame) and the parking sign's plate. */
const OUTSIDE: Quad[] = [
  { at: [ESTATE_SIGN.x, ESTATE_SIGN.y, ESTATE_SIGN.z - 0.047], right: NORTH, half: ESTATE_SIGN.half, region: 'sign' },
  { at: [ESTATE_HOURS.x, ESTATE_HOURS.y, ESTATE_HOURS.z - 0.022], right: NORTH, half: ESTATE_HOURS.half, region: 'hours' },
  { at: [ESTATE_WINDOW.x, ESTATE_WINDOW.y, ESTATE_WINDOW.z - 0.01], right: NORTH, half: ESTATE_WINDOW.half, region: 'window' },
  { at: [PARKING_SIGN.x + 0.052, PARKING_SIGN.y, PARKING_SIGN.z], right: EAST, half: PARKING_SIGN.half, region: 'parking' },
]
/** Inside: the board with the house for sale, in its frame on the west wall. */
const INSIDE: Quad[] = [{ at: [SALE_BOARD.x + 0.018, SALE_BOARD.y, SALE_BOARD.z], right: EAST, half: SALE_BOARD.half, region: 'board' }]

let images: Promise<Pics> | null = null
/** The house's and the coin's pictures, loaded once. */
function loadPics(): Promise<Pics> {
  images ??= Promise.all(
    [art('house'), art('coin')].map((src) => {
      const img = new Image()
      img.src = src
      return img.decode().then(() => img)
    }),
  ).then(([house, coin]) => ({ house, coin }))
  return images
}

function Pictures() {
  const made = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.8 })
    return { canvas, texture, material, outside: quads(OUTSIDE), inside: quads(INSIDE), pics: {} as Pics }
  }, [])
  useEffect(
    () => () => {
      made.texture.dispose()
      made.material.dispose()
      made.outside.dispose()
      made.inside.dispose()
    },
    [made],
  )
  const sold = useFarm(() => farm.apartment.owned)
  useEffect(() => {
    let live = true
    const draw = () => {
      drawPictures(made.canvas, made.pics, sold)
      made.texture.needsUpdate = true
    }
    draw()
    // again once the pictures and the type have loaded
    Promise.all([loadPics(), document.fonts?.load(`600 92px ${DISPLAY}`), document.fonts?.load(`800 92px ${TEXT}`)])
      .then(([pics]) => {
        if (!live) return
        Object.assign(made.pics, pics)
        draw()
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [made, sold])
  return (
    <>
      <mesh name="estate-pictures" geometry={made.outside} material={made.material} receiveShadow />
      <mesh name="estate-board" geometry={made.inside} material={made.material} receiveShadow />
    </>
  )
}

// ───────────────────────────── what you press ─────────────────────────────

/** The agent, the board with the house for sale, and the door out of hours. */
function Counterparts() {
  const openPanel = useHome((s) => s.openPanel)

  // the agent at his desk, in the office's hours: his panel (the house for sale); away, when he is back
  useInteractable({
    id: 'farm-estate-agent',
    position: [AGENT_STAND.x, 1.0, AGENT_STAND.z],
    aim: [AGENT_SEAT.x, 1.2, AGENT_SEAT.z - 0.05],
    radius: 1.3,
    label: () => {
      if (agentHere()) return 'Talk to the estate agent'
      // the office open, he is on his way in from the lane; shut, he is back when it opens
      return estateOpen() ? `The estate agent is on his way in · ${mmss(agentBackIn())}` : `The estate agent is back at ${clockOf(opensAt('estate'))} · ${mmss(agentBackIn())}`
    },
    icon: () => (agentHere() ? { verb: 'talk', art: 'man-office-worker' } : { verb: 'wait', art: 'man-office-worker', seconds: Math.ceil(agentBackIn()) }),
    run: () => {
      if (agentHere()) openPanel({ kind: 'estate' })
    },
  })

  // the house for sale on the wall: nothing to press, its price tag (the card asks before anything is spent)
  useInteractable({
    id: 'farm-estate-board',
    position: [SALE_BOARD.x + 0.3, 1.0, SALE_BOARD.z],
    aim: [SALE_BOARD.x, SALE_BOARD.y, SALE_BOARD.z],
    radius: 1.2,
    enabled: () => false,
    label: 'The house for sale',
    tag: () =>
      farm.apartment.owned
        ? null
        : {
            kind: 'price',
            label: `Buy the house · ${ESTATE.price} coins`,
            price: ESTATE.price,
            at: { x: SALE_BOARD.x + 0.06, y: SALE_BOARD.y + SALE_BOARD.half[1] + 0.16, z: SALE_BOARD.z },
            open: () => openPanel({ kind: 'house-buy' }),
          },
    run: () => {},
  })

  // out of hours, at the door: when it opens
  const [outside] = ESTATE_PATH.slice(1)
  useInteractable({
    id: 'farm-estate-door',
    position: [outside.x, 1.0, outside.z],
    aim: [outside.x, 1.4, ESTATE_PATH[2].z - 0.3],
    radius: 1.6,
    enabled: () => !estateOpen(),
    label: () => `The estate office opens at ${clockOf(opensAt('estate'))} · ${mmss(estateOpensIn())}`,
    icon: () => ({ verb: 'wait', art: 'house', seconds: Math.ceil(estateOpensIn()) }),
    run: () => {},
  })
  return null
}

// ───────────────────────────── the office and the lot ─────────────────────────────

/** Who opens the office's door besides you: the agent, walking in or out (sitting at his desk he is near it too). */
function* doorWalkers() {
  const a = estateAgentNow()
  if (a?.walking) yield a
}
const closedNow = () => !estateOpen()

const middle = (b: Box) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2] as [number, number, number]
const half = (b: Box) => [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2] as [number, number, number]

export function Estate() {
  const fittings = useMemo(() => estateFittingsParts(), [])
  const lot = useMemo(() => parkingLotParts(), [])
  // ?debug: how far open its door is (0 shut, 1 open), and its walls as hiding pieces (for the tests)
  useEffect(() => debugSet('estate', { door: () => walkInDoor(ESTATE_WALKIN.id), walls: ESTATE_WALKIN.walls.map(hidingPiece) }), [])
  useEffect(
    () => () => {
      for (const p of [fittings, lot] as const) {
        p.dispose()
        for (const m of Object.values(p.meshes)) m.geometry.dispose()
      }
    },
    [fittings, lot],
  )
  return (
    <group name="farm-estate">
      <WalkIn def={ESTATE_WALKIN} walkers={doorWalkers} closed={closedNow} />
      <primitive object={fittings.group} />
      <primitive object={lot.group} />
      <Pictures />
      <Counterparts />
      {/* what you bump into: the desk and his chair behind it, the cabinet, the plant; the parking sign's post */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={half(ESTATE_DESK)} position={middle(ESTATE_DESK)} />
        <CuboidCollider args={[0.24, 0.5, 0.25]} position={[AGENT_SEAT.x, 0.5, AGENT_SEAT.z]} />
        <CuboidCollider args={half(CABINET)} position={middle(CABINET)} />
        <CylinderCollider args={[0.5, 0.2]} position={[PLANT.x, 0.5, PLANT.z]} />
        <CylinderCollider args={[1.1, 0.05]} position={[PARKING_SIGN.x, 1.1, PARKING_SIGN.z]} />
      </RigidBody>
    </group>
  )
}
