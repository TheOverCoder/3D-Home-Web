import { useEffect, useMemo, useRef, useState } from 'react'
import { Group, Object3D, Vector3 } from 'three'
import { PLACES, toWorld, turnOf } from '../../../src/farm/layout'
import { NEST } from '../../../src/farm/data'
import { loadSolids, solidsReady, type V3 } from '../../../src/lib/sculpt'
import { chickenParts, putChicken } from '../../../src/models/chicken'
import { cowParts, putCow } from '../../../src/models/cow'
import { cropParts } from '../../../src/models/crops'
import { putEgg } from '../../../src/models/plants'
import { putSheep, sheepParts } from '../../../src/models/sheep'
import { nestSpots, TOOL_PLACES, TOOL_WEIGHT, toolModel, toolProp, type ToolLook, type ToolProp, type ToolStyle } from '../../../src/models/tools'
import { m } from 'motion/react'
import { PRESS } from '../../../src/ui/motion'
import { Play } from '../../../src/ui/glyphs'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { checkModel, trianglesOf } from '../../three/model'
import { farmPlace } from '../../three/place'
import { fold, henRun, inPlace, pasture } from './pens'
import type { ToolsState } from './index'
import './ToolsView.css'

// The tools on the screen (./index.tsx): the farm round the three pens as a new farm has them (lab/three/place.ts, and
// the pens as src/farm/Places.tsx draws them: ./pens.ts), with the three herds in them, and a family's three tools each
// at its place at its fence (src/models/tools.ts, TOOL_PLACES); "today" the pens as they are (the hens' nest box
// still there). Its views: in the game (the player's eyes a couple of metres from the tool, where the action button
// offers it), close (turning round the tool; "build" raises its pieces into place as the film's `open` does), and with
// the herd (the player's eyes further back, the animals in the pen behind it).

export type ToolsVariant = 'today' | ToolStyle

/** A tool's place in the world as a new farm has it: where it stands and which way its front faces. */
function spotOf(look: ToolLook) {
  const t = TOOL_PLACES[look]
  const p = PLACES[t.place].home
  const [x, z] = toWorld(p, t.at[0], t.at[2])
  const turn = turnOf(p) + t.turn
  return { x, z, turn, out: [Math.sin(turn), Math.cos(turn)] as [number, number] }
}

/** The views of each tool: the player's eyes near it and further back (where the house lets them stand), and close. */
const VIEWS: Record<ToolLook, { game: View3D; herd: View3D; close: { side: number; size: [number, number] } }> = {
  nests: {
    game: { kind: 'eye', at: [7.15, 0, 5.2], look: [9.72, 0.62, 5.75] },
    herd: { kind: 'eye', at: [7.0, 0, 4.4], look: [10.6, 0.45, 6.3] },
    close: { side: 28, size: [1.25, 1.3] },
  },
  pail: {
    game: { kind: 'eye', at: [6.55, 0, -2.15], look: [9.1, 0.65, -1.6] },
    herd: { kind: 'eye', at: [6.0, 0, -3.4], look: [10.1, 0.5, -0.9] },
    close: { side: 32, size: [1.2, 1.45] },
  },
  shears: {
    // the house's north wall is a step behind you here
    game: { kind: 'eye', at: [-0.3, 0, -6.45], look: [-0.78, 0.55, -8.4] },
    herd: { kind: 'eye', at: [2.3, 0, -6.45], look: [-1.3, 0.45, -9.4] },
    close: { side: 24, size: [1.2, 1.45] },
  },
}

/** Close: turning round the tool, from a little to one side of its front. */
function closeView(look: ToolLook): View3D {
  const s = spotOf(look)
  const c = VIEWS[look].close
  return { kind: 'orbit', target: [s.x + s.out[0] * 0.2, 0.66, s.z + s.out[1] * 0.2], size: c.size, azimuth: (s.turn * 180) / Math.PI + c.side, elevation: 10 }
}

/** The herds where they graze in the game, each in its pen's frame: [x, z, heading]. */
const HENS: [number, number, number][] = [
  [-1.15, 0.7, 2.4],
  [-0.45, 1.5, -0.6],
  [0.35, -0.15, 1.2],
  [0.95, 1.05, 3.6],
  [1.1, -1.45, -1.9],
  [0.15, -1.75, 0.4],
]
const ROOSTER: [number, number, number] = [-0.25, 0.4, -1.4]
const COWS: [number, number, number][] = [
  [-0.95, 0.4, -1.25],
  [0.55, 3.5, 2.7],
  [-0.35, -2.5, 0.35],
]
const SHEEP: [number, number, number][] = [
  [-1.6, 0.25, 1.9],
  [0.25, -0.6, -0.4],
  [1.75, 0.45, 2.6],
  [2.9, -0.45, -1.2],
]

/** A place's point in the world, as a new farm has it. */
const world = (id: 'hens' | 'cows' | 'sheep', x: number, z: number) => toWorld(PLACES[id].home, x, z)

/** The three herds, posed at t (seconds; idle: pecking, grazing, a tail swishing). */
function herds() {
  const hens = chickenParts(HENS.length)
  const cows = cowParts(1)
  const sheep = sheepParts(SHEEP.length)
  const pose = (t: number) => {
    hens.begin()
    const [rx, rz] = world('hens', ROOSTER[0], ROOSTER[1])
    putChicken(hens, true, 0, rx, rz, ROOSTER[2], { phase: 0, stride: 0, peck: 0, look: Math.sin(t * 0.9) * 0.6 })
    HENS.forEach(([x, z, h], i) => {
      const [wx, wz] = world('hens', x, z)
      putChicken(hens, false, i, wx, wz, h, { phase: 0, stride: 0, peck: i % 2 ? Math.max(0, Math.sin(t * 6 + i)) : 0, look: i % 2 ? 0 : Math.sin(t * 0.8 + i) * 0.6 })
    })
    hens.end()
    cows.begin()
    COWS.forEach(([x, z, h], i) => {
      const [wx, wz] = world('cows', x, z)
      putCow(cows, i, wx, wz, h, { phase: 0, stride: 0, graze: i === 1 ? 1 : 0, tail: t * 1.5 + i * 2, chew: t * 5 + i, look: i === 1 ? 0 : Math.sin(t * 0.4 + i * 2) * 0.35 })
    })
    cows.end()
    sheep.begin()
    SHEEP.forEach(([x, z, h], i) => {
      const [wx, wz] = world('sheep', x, z)
      putSheep(sheep, i, wx, wz, h, { phase: 0, stride: 0, graze: i % 2 ? 1 : 0.15, wool: 1, chew: t * 5 + i, look: i % 2 ? 0 : Math.sin(t * 0.5 + i) * 0.4 })
    })
    sheep.end()
  }
  const group = new Group()
  group.add(hens.group, cows.group, sheep.group)
  return { group, pose }
}

/** The eggs waiting: in today's nest box, or in the coop's nests (one or two a nest, one nest empty). */
function eggs(v: ToolsVariant, coop: Object3D | null) {
  const parts = cropParts(0.2)
  parts.begin()
  parts.at(0, 0, 0)
  if (v === 'today' || !coop) {
    // as src/farm/Plants.tsx lays them: a grid of 3 × 2 on the nest box's straw
    const grid: [number, number][] = [
      [-0.085, -0.0425],
      [0, -0.0425],
      [0.085, -0.0425],
      [-0.085, 0.0425],
    ]
    grid.forEach(([ex, ez], k) => {
      const [x, z] = world('hens', NEST.x + ez, NEST.z + ex)
      putEgg(parts, x, 0.645, z, k)
    })
  } else {
    coop.updateWorldMatrix(true, true)
    const many = [2, 1, 0, 1, 2, 1]
    nestSpots(v).forEach((spot, i) => {
      for (let k = 0; k < many[i]; k++) {
        const p = coop.localToWorld(new Vector3(spot[0] + (k - (many[i] - 1) / 2) * 0.065, spot[1], spot[2] + k * 0.02))
        putEgg(parts, p.x, p.y, p.z, i + k)
      }
    })
  }
  parts.end()
  return parts.group
}

const LOOKS: ToolLook[] = ['nests', 'pail', 'shears']

export function ToolsView({ v, s }: { v: ToolsVariant; s: ToolsState }) {
  // the coops are cut with the solid engine: nothing is built, counted or checked before it is in
  const [solid, setSolid] = useState(solidsReady())
  useEffect(() => {
    if (!solid) void loadSolids().then(() => setSolid(true))
  }, [solid])
  const triangles = useMemo(() => (!solid || v === 'today' ? 0 : trianglesOf(toolModel(s.look, v))), [solid, v, s.look])
  // the build played by the button: asked for here, played in the scene's frames
  const play = useRef<{ ask: boolean; start: number; draw?: () => void; prop?: ToolProp; eggs?: Object3D }>({ ask: false, start: -1 })
  if (!solid) return <div className="model-view" />
  const build = async (): Promise<Built> => {
    const root = new Group()
    root.add(await farmPlace())
    root.add(henRun({ nestBox: v === 'today' }), pasture(), fold())
    let coop: Object3D | null = null
    if (v !== 'today')
      for (const look of LOOKS) {
        const t = TOOL_PLACES[look]
        const prop = toolProp(look, v)
        if (look === s.look) play.current.prop = prop
        root.add(inPlace(t.place, prop.group, t.at, t.turn))
        if (look === 'nests') coop = prop.group
      }
    const laid = eggs(v, coop)
    root.add(laid)
    // (the eggs are the crops' crowd, not the coop's: they wait until it stands)
    if (s.look === 'nests') play.current.eggs = laid
    const h = herds()
    root.add(h.group)
    h.pose(0)
    if (s.view === 'herd') return { root, tick: h.pose }
    if (s.view !== 'close' || v === 'today') return { root }
    // close: still until the button asks for the build, then its pieces rise into place (the film's `open`, 2.4 s)
    return {
      root,
      wake: (draw) => (play.current.draw = draw),
      tick: (t) => {
        const p = play.current
        if (p.ask) {
          p.ask = false
          p.start = t
        }
        if (p.start < 0 || !p.prop) return false
        const k = Math.min(1, (t - p.start) / 2.4)
        p.prop.open(k)
        if (p.eggs) p.eggs.visible = k >= 1
        if (k >= 1) p.start = -1
        return k < 1
      },
    }
  }
  const view = s.view === 'close' ? closeView(s.look) : VIEWS[s.look][s.view]
  const spot = spotOf(s.look)
  const focus: V3 = [spot.x, 0.6, spot.z]
  const checks = () => (v === 'today' ? [] : checkModel(`${v.toUpperCase()} · ${s.look}`, toolModel(s.look, v)))
  return (
    <>
      <ModelView build={build} view={view} focus={focus} count={v === 'today' ? { triangles: 0 } : { triangles, weight: TOOL_WEIGHT }} checks={checks} />
      {s.view === 'close' && v !== 'today' && (
        <m.button
          className="btn soft tools-build"
          {...PRESS}
          onClick={() => {
            play.current.ask = true
            play.current.prop?.open(0)
            if (play.current.eggs) play.current.eggs.visible = false
            play.current.draw?.()
          }}
        >
          <Play weight="fill" aria-hidden="true" />
          בנייה
        </m.button>
      )}
    </>
  )
}
