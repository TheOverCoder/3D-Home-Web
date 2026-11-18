// The estate office and the parking lot in the scene (src/data/estate.ts): the walk-in building (src/scene/WalkIn.tsx:
// its door shut out of the office's hours), its fittings and the lot (src/models/estate.ts), the house's model on its
// table (as the save's shell has the house), the pictures on its front and inside — the sign with the logo (a house and
// a key), the opening hours, the house for sale in its window and on its wall, the farm's map on its west wall and in
// its wide window — and the things you press or tap: the agent (his panel: the house for sale), the board on the wall
// (the house's price tag), each meadow for sale on the map (its price tag: the edit mode's card for it, where it is
// bought), and the door out of hours (when it opens). The agent himself is drawn with the market's people
// (./marketPeople.ts); where he is comes from the clock (estateAgentNow, src/farm/state.ts). The car in the lot is
// src/farm/car.

import { useEffect, useMemo } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { BufferAttribute, BufferGeometry, CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { WALK_INS, bounds, type Box } from '../data/buildings'
import {
  AGENT_SEAT,
  AGENT_STAND,
  BENCH,
  CABINET,
  ESTATE_DESK,
  ESTATE_DISPLAY,
  ESTATE_HOURS,
  ESTATE_MAP,
  ESTATE_PATH,
  ESTATE_ROOM,
  ESTATE_SIGN,
  ESTATE_WALKIN,
  ESTATE_WINDOW,
  HOUSE_TABLE,
  MAP_AREA,
  PARKING_SIGN,
  PLANT,
  SALE_BOARD,
  onMap,
} from '../data/estate'
import { GATE } from '../data/layout'
import { LOT } from '../data/lot'
import { CABIN } from '../data/market'
import { debugSet } from '../lib/debug'
import { useInteractable } from '../lib/interaction'
import { clock } from '../lib/time'
import { estateFittingsParts, houseModelParts, parkingLotParts } from '../models/estate'
import { WalkIn, hidingPiece, walkInDoor } from '../scene/WalkIn'
import { AGENT, talk } from '../talk/speech'
import { useHome } from '../store'
import { art } from '../ui/art'
import { ESTATE } from './data'
import { clockOf, hoursText, opensAt } from './day'
import { useEdit } from './edit'
import { HOME_LAND, PARCELS, PARCEL_IDS, type ParcelId, type Rect } from './layout'
import { agentBackIn, agentHere, estateAgentNow, estateOpen, estateOpensIn, farm, lockOf, useFarm } from './state'

// ───────────────────────────── the pictures ─────────────────────────────

/** The pictures, all on one canvas (one texture, one draw outside and one inside): each a region of it in pixels. The
 *  map is 10 pixels a metre of the farm (MAP_AREA); the wide window's picture its own copy of it under a banner. */
const W = 1024
const H = 1536
const REGIONS = {
  sign: { x: 0, y: 0, w: 1024, h: 240 },
  hours: { x: 0, y: 256, w: 512, h: 380 },
  window: { x: 528, y: 256, w: 300, h: 500 },
  parking: { x: 848, y: 256, w: 176, h: 176 },
  board: { x: 0, y: 640, w: 512, h: 384 },
  plate: { x: 560, y: 660, w: 340, h: 340 },
  map: { x: 0, y: 1032, w: (MAP_AREA.x1 - MAP_AREA.x0) * 10, h: (MAP_AREA.z1 - MAP_AREA.z0) * 10 },
  display: { x: 576, y: 1032, w: 448, h: 256 },
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

/** What the map shows of the farm now: the meadows it has. */
type MapState = { land: readonly ParcelId[] }

const GRASS = '#a6c97a'
const FIELD_FOR_SALE = '#ece4c4'
const COUNTRY = '#cdd6b6'
const LANE_TONE = '#cbbfa5'
const FENCE = '#7a5a3a'

/** The farm's map, north up, 10 pixels a metre: the countryside, the lane and the lot's buildings (the office marked:
 *  you are here), the garden and the meadows it has in green behind their fence, each meadow still for sale pale with
 *  its name. */
function drawMap(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, map: MapState) {
  const px = (x: number) => r.x + (x - MAP_AREA.x0) * 10
  const pz = (z: number) => r.y + (z - MAP_AREA.z0) * 10
  const fill = (rc: Rect, color: string) => {
    g.fillStyle = color
    g.fillRect(px(rc.minX), pz(rc.minZ), (rc.maxX - rc.minX) * 10, (rc.maxZ - rc.minZ) * 10)
  }
  g.save()
  g.beginPath()
  g.rect(r.x, r.y, r.w, r.h)
  g.clip()
  g.fillStyle = COUNTRY
  g.fillRect(r.x, r.y, r.w, r.h)
  // the lane and the lot beyond it
  g.fillStyle = LANE_TONE
  g.fillRect(r.x, pz(13.7), r.w, 2.6 * 10)
  for (const l of LOT) g.fillRect(px(l.x0), pz(l.z0), (l.x1 - l.x0) * 10, (l.z1 - l.z0) * 10)
  // the land: the garden and every meadow the farm has, green; those for sale pale, with a dashed edge
  const owned = [HOME_LAND, ...map.land.map((id) => PARCELS[id].rect)]
  for (const id of PARCEL_IDS) if (!map.land.includes(id)) fill(PARCELS[id].rect, FIELD_FOR_SALE)
  for (const rc of owned) fill(rc, GRASS)
  g.lineWidth = 3
  g.strokeStyle = FENCE
  for (const rc of owned) g.strokeRect(px(rc.minX) + 1.5, pz(rc.minZ) + 1.5, (rc.maxX - rc.minX) * 10 - 3, (rc.maxZ - rc.minZ) * 10 - 3)
  // the gate in the garden's south fence
  g.fillStyle = GRASS
  g.fillRect(px(GATE.x - GATE.width / 2), pz(HOME_LAND.maxZ) - 3, GATE.width * 10, 6)
  g.setLineDash([10, 7])
  g.strokeStyle = GOLD
  for (const id of PARCEL_IDS) {
    if (map.land.includes(id)) continue
    const rc = PARCELS[id].rect
    g.strokeRect(px(rc.minX) + 3, pz(rc.minZ) + 3, (rc.maxX - rc.minX) * 10 - 6, (rc.maxZ - rc.minZ) * 10 - 6)
  }
  g.setLineDash([])
  // the buildings on the lot: the market and the cabin grey, the office navy with a gold star (you are here)
  g.fillStyle = '#8d9096'
  for (const w of WALK_INS) {
    const b = bounds(w)
    g.fillRect(px(b.x0), pz(b.z0), (b.x1 - b.x0) * 10, (b.z1 - b.z0) * 10)
  }
  g.fillRect(px(CABIN.x0), pz(CABIN.z0), (CABIN.x1 - CABIN.x0) * 10, (CABIN.z1 - CABIN.z0) * 10)
  const office = bounds(ESTATE_WALKIN)
  g.fillStyle = NAVY
  g.fillRect(px(office.x0), pz(office.z0), (office.x1 - office.x0) * 10, (office.z1 - office.z0) * 10)
  star(g, px((office.x0 + office.x1) / 2), pz((office.z0 + office.z1) / 2), 13)
  // the words: the farm's own, and each meadow's name and whether it is for sale
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#2f4a1f'
  g.font = `600 30px ${DISPLAY}`
  g.fillText('Your farm', px(0), pz(-1))
  for (const id of PARCEL_IDS) {
    const rc = PARCELS[id].rect
    const cx = px((rc.minX + rc.maxX) / 2)
    const cz = pz((rc.minZ + rc.maxZ) / 2)
    const mine = map.land.includes(id)
    g.fillStyle = mine ? '#2f4a1f' : NAVY
    g.font = `700 ${PARCELS[id].name.length > 14 ? 15 : 18}px ${TEXT}`
    g.fillText(PARCELS[id].name, cx, cz - 11)
    g.font = `800 15px ${TEXT}`
    g.fillStyle = mine ? '#2f4a1f' : RED
    g.fillText(mine ? 'Yours' : 'FOR SALE', cx, cz + 11)
  }
  // north, in the bottom right corner (the countryside south-east of the lot)
  g.fillStyle = NAVY
  g.font = `800 22px ${TEXT}`
  g.fillText('N', r.x + r.w - 30, r.y + r.h - 72)
  g.beginPath()
  g.moveTo(r.x + r.w - 30, r.y + r.h - 56)
  g.lineTo(r.x + r.w - 39, r.y + r.h - 32)
  g.lineTo(r.x + r.w - 21, r.y + r.h - 32)
  g.closePath()
  g.fill()
  g.restore()
}

/** A five-pointed star, gold, `s` across, round (x, y). */
function star(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = GOLD
  g.beginPath()
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const rr = k % 2 ? s * 0.42 : s
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
}

/** Draws every picture on the canvas: the sign, the hours, the window, the parking sign, the board and the map inside,
 *  and the map again in the wide window under its banner. */
function drawPictures(c: HTMLCanvasElement, pics: Pics, sold: boolean, map: MapState) {
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
  // the plate on the wall behind his desk: the logo, gold on navy, and the words under it
  const l = REGIONS.plate
  g.fillStyle = NAVY
  g.fillRect(l.x, l.y, l.w, l.h)
  g.strokeStyle = GOLD
  g.lineWidth = 6
  g.strokeRect(l.x + 12, l.y + 12, l.w - 24, l.h - 24)
  logo(g, l.x + 80, l.y + 40, 180)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.font = `600 44px ${DISPLAY}`
  g.fillText('ESTATE AGENT', l.x + l.w / 2, l.y + 268)
  // the farm's map, and in the wide window: dark glass, a red banner, the map
  const m = REGIONS.map
  drawMap(g, m, map)
  const d = REGIONS.display
  const dark = g.createLinearGradient(0, d.y, 0, d.y + d.h)
  dark.addColorStop(0, '#5f7f96')
  dark.addColorStop(0.35, '#26394a')
  dark.addColorStop(1, '#1b2a37')
  g.fillStyle = dark
  g.fillRect(d.x, d.y, d.w, d.h)
  const band = 46
  const ph = d.h - band - 30
  const pw = (ph * m.w) / m.h
  const p0 = d.x + (d.w - pw) / 2
  g.fillStyle = RED
  g.fillRect(p0, d.y + 14, pw, band)
  g.fillStyle = '#ffffff'
  g.font = `600 30px ${DISPLAY}`
  g.textBaseline = 'middle'
  g.fillText('LAND FOR SALE', d.x + d.w / 2, d.y + 14 + band / 2 + 2)
  g.drawImage(c, m.x, m.y, m.w, m.h, p0, d.y + 14 + band, pw, ph)
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
const WEST: [number, number, number] = [0, 0, 1] // facing −x: its right is +z

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

/** Outside: the sign, the hours, the windows (each just in front of its board or frame) and the parking sign's plate. */
const OUTSIDE: Quad[] = [
  { at: [ESTATE_SIGN.x, ESTATE_SIGN.y, ESTATE_SIGN.z - 0.047], right: NORTH, half: ESTATE_SIGN.half, region: 'sign' },
  { at: [ESTATE_HOURS.x, ESTATE_HOURS.y, ESTATE_HOURS.z - 0.022], right: NORTH, half: ESTATE_HOURS.half, region: 'hours' },
  { at: [ESTATE_WINDOW.x, ESTATE_WINDOW.y, ESTATE_WINDOW.z - 0.01], right: NORTH, half: ESTATE_WINDOW.half, region: 'window' },
  { at: [ESTATE_DISPLAY.x, ESTATE_DISPLAY.y, ESTATE_DISPLAY.z - 0.01], right: NORTH, half: ESTATE_DISPLAY.half, region: 'display' },
  { at: [PARKING_SIGN.x + 0.052, PARKING_SIGN.y, PARKING_SIGN.z], right: EAST, half: PARKING_SIGN.half, region: 'parking' },
]
/** Inside: the board with the house for sale, in its frame on the east wall; the farm's map in its frame on the west
 *  wall; the plate with the logo on the wall behind the agent's desk, over his head. */
const INSIDE: Quad[] = [
  { at: [SALE_BOARD.x - 0.018, SALE_BOARD.y, SALE_BOARD.z], right: WEST, half: SALE_BOARD.half, region: 'board' },
  { at: [ESTATE_MAP.x + 0.018, ESTATE_MAP.y, ESTATE_MAP.z], right: EAST, half: ESTATE_MAP.half, region: 'map' },
  { at: [AGENT_SEAT.x, 1.75, ESTATE_ROOM.z1 - 0.008], right: NORTH, half: [0.24, 0.24], region: 'plate' },
]

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
  // the meadows the farm has, as the map shows them (drawn again when one is bought)
  const land = useFarm(() => farm.layout.land.join(' '))
  useEffect(() => {
    let live = true
    const map: MapState = { land: land ? (land.split(' ') as ParcelId[]) : [] }
    const draw = () => {
      drawPictures(made.canvas, made.pics, sold, map)
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
  }, [made, sold, land])
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
      return estateOpen() ? `The estate agent is on his way in · ${clock(agentBackIn())}` : `The estate agent is back at ${clockOf(opensAt('estate'))} · ${clock(agentBackIn())}`
    },
    icon: () => (agentHere() ? { verb: 'talk', art: 'man-office-worker' } : { verb: 'wait', art: 'man-office-worker', seconds: Math.ceil(agentBackIn()) }),
    run: () => {
      if (!agentHere()) return
      openPanel({ kind: 'estate' })
      // he says hello (src/talk)
      talk(farm.apartment.owned ? 'agent-yours' : 'agent-hello', AGENT, AGENT_SEAT)
    },
  })

  // the house for sale on the wall: nothing to press, its price tag (the card asks before anything is spent); in reach
  // from where you talk to the agent
  useInteractable({
    id: 'farm-estate-board',
    position: [SALE_BOARD.x - 0.3, 1.0, SALE_BOARD.z],
    aim: [SALE_BOARD.x, SALE_BOARD.y, SALE_BOARD.z],
    radius: 1.4,
    enabled: () => false,
    label: 'The house for sale',
    tag: () =>
      farm.apartment.owned
        ? null
        : {
            kind: 'price',
            label: `Buy the house · ${ESTATE.price} coins`,
            price: ESTATE.price,
            at: { x: SALE_BOARD.x - 0.06, y: SALE_BOARD.y + SALE_BOARD.half[1] + 0.16, z: SALE_BOARD.z },
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
    label: () => `The estate office opens at ${clockOf(opensAt('estate'))} · ${clock(estateOpensIn())}`,
    icon: () => ({ verb: 'wait', art: 'man-office-worker', seconds: Math.ceil(estateOpensIn()) }),
    run: () => {},
  })
  return null
}

/** Where a meadow is on the map on the wall: its middle's. */
export const meadowOnMap = (id: ParcelId) => {
  const r = PARCELS[id].rect
  return onMap((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2)
}
/** How far from the map you may stand to read a meadow's tag (from a metre in front of it, on the ground). */
const MAP_REACH = 1.5

/** A meadow on the map: nothing to press, its price tag while it is for sale — the edit mode opens on it, its card
 *  asking before anything is spent (where every field is bought: src/farm/EditPanel.tsx); a meadow the level has not
 *  opened yet carries the level instead of a price. */
function Meadow({ id }: { id: ParcelId }) {
  const spot = meadowOnMap(id)
  const def = PARCELS[id]
  useInteractable({
    id: `farm-estate-map-${id}`,
    position: [spot.x + 1.0, 1.0, spot.z],
    aim: [spot.x, spot.y, spot.z],
    radius: MAP_REACH,
    enabled: () => false,
    label: `The ${def.name.toLowerCase()} on the farm's map`,
    tag: () => {
      if (farm.layout.land.includes(id)) return null
      const at = { x: spot.x + 0.05, y: spot.y, z: spot.z }
      const open = () => {
        useHome.getState().setEditing(true)
        useEdit.getState().pick({ kind: 'parcel', id })
      }
      const lock = lockOf(`parcel:${id}`)
      return lock !== null
        ? { kind: 'price', label: `${def.name} · opens at level ${lock}`, locked: lock, at, open }
        : { kind: 'price', label: `Buy the ${def.name.toLowerCase()} · ${def.price} coins`, price: def.price, at, open }
    },
    run: () => {},
  })
  return null
}

/** The house's model on its table, as the save's shell has the house: made again when the shell changes (an opening
 *  moved or closed, a room painted, a floor laid). */
function HouseModel() {
  const shell = useFarm(() => farm.home.shell)
  const parts = useMemo(() => houseModelParts(shell), [shell])
  useEffect(
    () => () => {
      parts.dispose()
      parts.meshes.house.geometry.dispose()
    },
    [parts],
  )
  return <primitive object={parts.group} />
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
  // ?debug: how far open its door is (0 shut, 1 open), its walls as hiding pieces, and where each meadow is on its map
  // (for the tests)
  useEffect(
    () =>
      debugSet('estate', {
        door: () => walkInDoor(ESTATE_WALKIN.id),
        walls: ESTATE_WALKIN.walls.map(hidingPiece),
        meadows: Object.fromEntries(PARCEL_IDS.map((id) => [id, meadowOnMap(id)])),
        reach: MAP_REACH,
      }),
    [],
  )
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
      <HouseModel />
      <Pictures />
      <Counterparts />
      {PARCEL_IDS.map((id) => (
        <Meadow key={id} id={id} />
      ))}
      {/* what you bump into: the desk and his chair behind it, the cabinet, the plant, the bench, the house's table; the
          parking sign's post */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={half(ESTATE_DESK)} position={middle(ESTATE_DESK)} />
        <CuboidCollider args={[0.24, 0.5, 0.25]} position={[AGENT_SEAT.x, 0.5, AGENT_SEAT.z]} />
        <CuboidCollider args={half(CABINET)} position={middle(CABINET)} />
        <CylinderCollider args={[0.5, 0.2]} position={[PLANT.x, 0.5, PLANT.z]} />
        <CuboidCollider args={half(BENCH)} position={middle(BENCH)} />
        <CuboidCollider args={half(HOUSE_TABLE)} position={middle(HOUSE_TABLE)} />
        <CylinderCollider args={[1.1, 0.05]} position={[PARKING_SIGN.x, 1.1, PARKING_SIGN.z]} />
      </RigidBody>
    </group>
  )
}
