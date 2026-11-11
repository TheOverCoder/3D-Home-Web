import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Group, MathUtils, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { useInteractable } from '../lib/interaction'
import { PersonRig, personParts } from '../models/person'
import { art } from '../ui/art'
import { useHome } from '../store'
import { GATE_SPOT, count } from './data'
import { iconImages } from './icons'
import { farm, lineShort, sellAllPreview, waiting, type Visitor } from './state'

// People from the lane who queue at the garden gate to buy something. Built like the player's own body, in their
// own clothes, they walk up, wave when they get to their place, move up the line as it shortens, hop when you sell
// to them and shake their head when you say no. A speech bubble over each head shows what they want and offer.
// Up to fifteen can stand in line, so they are drawn together: each person is a sculpted model
// (src/models/person.ts) on a rig of joints that is posed, then copied into one instanced draw per part for the
// whole crowd; and one bubble each. A buyer in two brings a surprise: a gift on their bubble, given as you sell to them.

/** How wide a bubble is: room for a gift at its end when the buyer brings a surprise. */
const bubbleWidth = (v: Visitor) => (v.gift ? 392 : 320)

/** The bubble over a buyer: the good's picture and how many, the coin and the offer, and a gift when they bring a
 *  surprise. It is drawn at once and again when the pictures and the type have loaded (on the first bubbles of a
 *  visit). */
function bubbleTexture(v: Visitor): CanvasTexture {
  const W = bubbleWidth(v)
  const H = 136
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  const draw = (want?: HTMLImageElement, coin?: HTMLImageElement, gift?: HTMLImageElement) => {
    const r = 34
    c.clearRect(0, 0, W, H)
    c.fillStyle = 'rgba(255, 247, 232, 0.97)'
    c.beginPath()
    c.moveTo(r, 4)
    c.arcTo(W - 4, 4, W - 4, H - 24, r)
    c.arcTo(W - 4, H - 24, 4, H - 24, r)
    c.lineTo(W / 2 + 14, H - 24)
    c.lineTo(W / 2, H - 4)
    c.lineTo(W / 2 - 14, H - 24)
    c.arcTo(4, H - 24, 4, 4, r)
    c.arcTo(4, 4, W - 4, 4, r)
    c.closePath()
    c.fill()
    if (want) c.drawImage(want, 16, 14, 84, 84)
    if (coin) c.drawImage(coin, 186, 30, 54, 54)
    if (gift) c.drawImage(gift, 322, 22, 62, 62)
    c.fillStyle = '#3b2a1e'
    c.font = '800 44px "Nunito Variable", Nunito, system-ui, sans-serif'
    c.textBaseline = 'middle'
    c.fillText(`×${v.qty}`, 102, 58)
    c.fillText(String(v.offer), 244, 58)
    t.needsUpdate = true
  }
  draw()
  Promise.all([iconImages([v.want, 'coin']), v.gift ? giftImage() : Promise.resolve(undefined), document.fonts?.load('800 44px "Nunito Variable"')])
    .then(([[want, coin], gift]) => draw(want, coin, gift))
    .catch(() => {})
  return t
}

let gift: Promise<HTMLImageElement> | null = null
/** The surprise's picture (a gift), loaded once. */
function giftImage() {
  if (!gift) {
    const img = new Image()
    img.src = art('wrapped-gift')
    gift = img.decode().then(() => img)
  }
  return gift
}

const MAX_PEOPLE = 32 // fifteen in line, and room for those walking off after "sell to everyone"

interface Rig {
  body: PersonRig
  bubble: Sprite
  phase: number
  lastX: number
  lastZ: number
}

function buildRig(v: Visitor): Rig {
  const bubble = new Sprite(new SpriteMaterial({ map: bubbleTexture(v), transparent: true, depthWrite: false }))
  bubble.scale.set((0.66 * bubbleWidth(v)) / 320, 0.28, 1)
  bubble.visible = false
  return { body: new PersonRig(v.look), bubble, phase: Math.random() * 10, lastX: v.x, lastZ: v.z }
}

function disposeRig(rig: Rig) {
  rig.bubble.material.map?.dispose()
  rig.bubble.material.dispose()
  rig.bubble.removeFromParent()
}

const buyers = (n: number) => `${n} ${n === 1 ? 'buyer' : 'buyers'}`

/**
 * The line at the gate: Sell, only while the basket has what at least one buyer in it asks for — the line's picture
 * and how many of it you can serve, of how many wait (4/7); it opens the line's panel. With nothing they want, no
 * button: a status shows what they ask for that the basket lacks, each with how many more it takes.
 */
function Gate() {
  const openPanel = useHome((s) => s.openPanel)
  useInteractable({
    id: 'farm-queue',
    position: [GATE_SPOT.x, 1.0, GATE_SPOT.z],
    aim: [GATE_SPOT.x, 1.45, GATE_SPOT.z],
    radius: 3.2,
    enabled: () => waiting().length > 0,
    label: () => {
      const line = waiting().length
      const n = sellAllPreview().buyers
      if (n) return `Sell to ${n} of ${buyers(line)}`
      return `${buyers(line)} waiting · short of ${lineShort()
        .map((s) => count(s.item, s.count))
        .join(', ')}`
    },
    icon: () => {
      const n = sellAllPreview().buyers
      return n ? { verb: 'sell', art: 'people-queue', count: n, of: waiting().length } : { verb: 'wait', art: 'people-queue' }
    },
    // nobody can be served: what they ask for that the basket lacks (at most four, the nearest to hand first)
    needs: () => (sellAllPreview().buyers ? null : lineShort().slice(0, 4)),
    run: () => openPanel({ kind: 'queue' }),
  })
  return null
}

/** Everyone on the lane or in line at the gate. */
export function Visitors() {
  const parts = useMemo(() => personParts(MAX_PEOPLE), [])
  useEffect(() => () => parts.dispose(), [parts])
  const bubbles = useRef<Group>(null)
  const rigs = useRef(new Map<number, Rig>())

  useEffect(() => {
    const all = rigs.current
    return () => {
      all.forEach(disposeRig)
      all.clear()
    }
  }, [])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    const live = new Set<number>()
    parts.begin()
    let people = 0
    for (const v of farm.visitors) {
      if (people >= MAX_PEOPLE) break
      people++
      live.add(v.id)
      let rig = rigs.current.get(v.id)
      if (!rig) {
        rig = buildRig(v)
        rigs.current.set(v.id, rig)
        bubbles.current?.add(rig.bubble)
      }
      const H = v.look.height
      const body = rig.body
      body.root.position.set(v.x, 0, v.z)
      body.root.rotation.y = v.heading
      const moved = Math.hypot(v.x - rig.lastX, v.z - rig.lastZ)
      rig.lastX = v.x
      rig.lastZ = v.z
      rig.phase += moved * 5.2
      const walking = v.moving && moved > 1e-4
      const f = rig.phase
      const amp = walking ? 0.55 : 0
      const since = farm.clock - v.moodAt
      const waving = v.phase === 'queued' && v.mood === 'neutral' && since < 2.4
      const happy = v.mood === 'happy' && since < 1.8
      const sad = v.mood === 'sad' && since < 1.8
      const damp = (o: Group, axis: 'x' | 'y' | 'z', to: number, k = 12) => {
        o.rotation[axis] = MathUtils.damp(o.rotation[axis], to, k, dt)
      }
      damp(body.thighL, 'x', -Math.sin(f) * amp)
      damp(body.thighR, 'x', Math.sin(f) * amp)
      damp(body.kneeL, 'x', Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03)
      damp(body.kneeR, 'x', Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03)
      damp(body.armL, 'x', happy ? -2.6 : Math.sin(f) * amp * 0.7)
      damp(body.armL, 'z', happy ? 0.25 : 0.06)
      damp(body.elbowL, 'x', happy ? -0.3 : -0.12)
      damp(body.armR, 'x', waving || happy ? -2.7 : -Math.sin(f) * amp * 0.7)
      damp(body.armR, 'z', waving ? -0.35 + Math.sin(t * 9) * 0.25 : happy ? -0.25 : -0.06)
      damp(body.elbowR, 'x', waving ? -0.5 : -0.15)
      const bob = walking ? Math.abs(Math.cos(f)) * 0.025 : 0
      const hop = happy ? Math.abs(Math.sin(t * 10)) * 0.07 : 0
      const breathe = walking ? 0 : Math.sin(t * 1.6 + v.id) * 0.004
      body.hips.position.y = 0.885 * H + bob + hop + breathe
      damp(body.head, 'y', sad ? Math.sin(t * 13) * 0.4 : 0, 18)
      damp(body.head, 'x', sad ? 0.25 : 0)
      body.write(parts)
      const b = rig.bubble
      b.visible = v.phase === 'queued'
      b.position.set(v.x, 2.12 * H + Math.sin(t * 2.2 + v.id) * 0.02, v.z)
    }
    // whoever has gone home
    for (const [id, rig] of rigs.current) {
      if (live.has(id)) continue
      disposeRig(rig)
      rigs.current.delete(id)
    }
    parts.end() // drawn as a crowd, culled together when out of view (indoors, looking away)
  })

  return (
    <group name="farm-visitors">
      <Gate />
      <primitive object={parts.group} />
      <group ref={bubbles} />
    </group>
  )
}
