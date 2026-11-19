import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3, type Mesh } from 'three'
import { roomAt, type RoomId } from '../data/layout'
import { farm, useFarm } from '../farm/state'
import { moodDayNow } from '../farm/computer/now'
import { moodHook, moodToday, vegIndex } from '../farm/mood'
import { playGesture } from '../lib/gestures'
import { useInteractable } from '../lib/interaction'
import { turnTowards } from '../lib/look'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { PIECES } from './catalogue'
import type { HomePiece } from './layout'
import { deskOf, hasComputer } from '../farm/computer/place'

// The house's computer (update-v1 mission 09; its desktop and apps: src/farm/computer): a piece of furniture
// (./catalogue.ts; its model is src/scene/Furnishings.tsx's, its screen this file's) that the action button uses —
// you turn to its screen and its desktop opens — and, while the house has none, a price tag on the studio's desk: its
// card asks before anything is spent, and the computer bought stands at the free spot nearest the desk. Its screen in
// the room shows the vegetable index and where it is heading, drawn as the farm changes, at most once a second, and
// only while you are in its room.

/** Where its screen is on the model (built round its middle, its back towards −z): the middle of the glass, and its
 *  width and height (a 256 × 150 picture). */
export const PC_SCREEN = { y: 1.04, z: -0.15, w: 0.6, h: 0.351 }

/** The screen's colours: the market's own computer's (src/farm/Market.tsx), so the two read alike. */
const INK = { bg: '#10232c', bar: '#2c8540', text: '#f3ead8', up: '#6fd36a', down: '#e0604a', flat: '#ffc93c', line: '#3a4a50' }

/** Draws the screen: the vegetable index now, an arrow for tomorrow, and its last seven days. */
function drawScreen(c: HTMLCanvasElement) {
  const g = c.getContext('2d')
  if (!g) return
  const W = c.width
  const H = c.height
  const day = moodDayNow()
  const at = (d: number) => vegIndex(d, moodToday)
  const days = Array.from({ length: 7 }, (_, k) => at(day - 6 + k))
  const now = days[6]
  const next = at(day + 1)
  const dir = next > now + 0.5 ? 'up' : next < now - 0.5 ? 'down' : 'flat'
  g.fillStyle = INK.bg
  g.fillRect(0, 0, W, H)
  g.fillStyle = INK.bar
  g.fillRect(0, 0, W, 30)
  g.fillStyle = INK.text
  g.textBaseline = 'middle'
  g.font = '800 19px Inter, system-ui, sans-serif'
  g.fillText('VEGETABLE INDEX', 10, 16)
  g.font = '800 46px Inter, system-ui, sans-serif'
  g.fillText(String(Math.round(now)), 12, 64)
  // tomorrow's arrow
  const ax = 118
  const ay = 64
  const arrow: [number, number][] =
    dir === 'up'
      ? [
          [0, -14],
          [14, 10],
          [-14, 10],
        ]
      : dir === 'down'
        ? [
            [0, 14],
            [14, -10],
            [-14, -10],
          ]
        : [
            [14, 0],
            [-10, -13],
            [-10, 13],
          ]
  g.fillStyle = INK[dir]
  g.beginPath()
  arrow.forEach(([dx, dy], k) => (k ? g.lineTo(ax + dx, ay + dy) : g.moveTo(ax + dx, ay + dy)))
  g.closePath()
  g.fill()
  // the week, round 100 (the line), at most a tenth either way
  const top = 96
  const bottom = H - 12
  const y = (v: number) => bottom - ((v - 90) / 20) * (bottom - top)
  g.strokeStyle = INK.line
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(10, y(100))
  g.lineTo(W - 10, y(100))
  g.stroke()
  g.strokeStyle = INK.text
  g.lineWidth = 4
  g.beginPath()
  days.forEach((v, k) => (k ? g.lineTo(10 + (k * (W - 50)) / 6, y(v)) : g.moveTo(10, y(v))))
  g.stroke()
  g.fillStyle = INK[dir]
  g.beginPath()
  g.arc(W - 16, y(next), 6, 0, Math.PI * 2)
  g.fill()
}

/** At most once a second. */
const SCREEN_MS = 1000

/** The computer's glass, a picture drawn from the farm (on its model: src/scene/Furnishings.tsx). Drawn once as it
 *  comes (its picture in the shop shows it too), then as the farm changes, at most once a second, and only while you
 *  are in the room it stands in. */
export function ComputerScreen() {
  const screen = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 150
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return { canvas: c, texture: t }
  }, [])
  useEffect(() => () => screen.texture.dispose(), [screen])
  const mesh = useRef<Mesh>(null)
  const rev = useFarm((s) => s.rev)
  const here = useHome((s) => s.room)
  // the room it stands in (it moves with its piece), looked at a few times a second
  const room = useRef<RoomId | null>(null)
  const p = useMemo(() => new Vector3(), [])
  useFrame(() => {
    if (mesh.current) room.current = roomAt(mesh.current.getWorldPosition(p).x, p.z)
  })
  const drawn = useRef(0)
  useEffect(() => {
    const draw = () => {
      drawScreen(screen.canvas)
      screen.texture.needsUpdate = true
      drawn.current = performance.now()
    }
    // (the first time as it comes; then only in its room, and at most once a second)
    const wait = !drawn.current ? 0 : here === null || here !== room.current ? null : drawn.current + SCREEN_MS - performance.now()
    if (wait === null) return
    if (wait <= 0) {
      draw()
      return
    }
    const t = window.setTimeout(draw, wait)
    return () => window.clearTimeout(t)
  }, [rev, here, screen])
  return (
    // (its own mesh, never merged into the furniture's: its picture changes, and it asks where it stands)
    <group userData={{ noBatch: true }}>
      <mesh ref={mesh} position={[0, PC_SCREEN.y, PC_SCREEN.z + 0.0185]}>
        <planeGeometry args={[PC_SCREEN.w, PC_SCREEN.h]} />
        <meshStandardMaterial color="#000000" emissive="#ffffff" emissiveMap={screen.texture} emissiveIntensity={0.85} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** Where on the floor a point of a piece's model is (`along`: metres in front of its middle). */
const inFront = (p: HomePiece, along: number) => {
  const a = (p.rot * Math.PI) / 2
  return { x: p.x + Math.sin(a) * along, z: p.z + Math.cos(a) * along }
}

/** A piece's footprint, half its size each way, as it is turned. */
const boxOf = (p: HomePiece) => {
  const [w, , d] = PIECES[p.type].size
  const quarter = p.rot % 2 === 1
  return { x: (quarter ? d : w) / 2, z: (quarter ? w : d) / 2 }
}

/** A computer's action: use it. Reach is from its front and sides (its footprint), like a wardrobe's. */
function ComputerAction({ p }: { p: HomePiece }) {
  const glass = inFront(p, PC_SCREEN.z)
  useInteractable({
    id: `computer-${p.id}`,
    label: 'Use the computer',
    icon: { verb: 'watch', art: 'desktop-computer' },
    position: [p.x, 0, p.z],
    box: boxOf(p),
    // you look at its screen
    aim: [glass.x, PC_SCREEN.y, glass.z],
    radius: 1.2,
    run: () => {
      playGesture('interact')
      turnTowards(playerState.eye, { x: glass.x, y: PC_SCREEN.y, z: glass.z })
      useHome.getState().openPanel({ kind: 'computer', piece: p.id })
    },
  })
  return null
}

/** The studio's desk while the house has no computer: nothing to press, a price tag (its card asks first). */
function DeskTag({ desk }: { desk: HomePiece }) {
  const top = PIECES.desk.size[1]
  const price = PIECES.computer.price
  useInteractable({
    id: 'computer-desk-tag',
    label: 'The desk',
    position: [desk.x, 0, desk.z],
    box: boxOf(desk),
    aim: [desk.x, top + 0.1, desk.z],
    radius: 1.2,
    enabled: () => false,
    tag: () => ({
      kind: 'price',
      label: `Buy a computer · ${price} coins`,
      price,
      at: { x: desk.x, y: top + 0.35, z: desk.z },
      open: () => useHome.getState().openPanel({ kind: 'computer', piece: desk.id, buy: true }),
    }),
    run: () => {},
  })
  return null
}

/** Every computer in the house is used with the action button (one bought later too), and the desk carries the price
 *  tag while the house has none. Mounted on the house's map (src/scene/Experience.tsx). */
export function Computers() {
  const home = useFarm(() => farm.home)
  // (?debug: the market's mood's switch for the tests, before any price asks for it)
  useEffect(() => moodHook(), [])
  const desk = deskOf(home)
  return (
    <>
      {home.pieces
        .filter((p) => p.type === 'computer')
        .map((p) => (
          <ComputerAction key={`${p.id}|${p.x}|${p.z}|${p.rot}`} p={p} />
        ))}
      {!hasComputer(home) && desk && <DeskTag key={`${desk.x}|${desk.z}|${desk.rot}`} desk={desk} />}
    </>
  )
}
