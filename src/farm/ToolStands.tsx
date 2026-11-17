import { useEffect, useMemo, useState } from 'react'
import { Mesh, type Material } from 'three'
import { debugSet } from '../lib/debug'
import { registerInteractable } from '../lib/interaction'
import type { Point3 } from '../lib/playerState'
import { loadSolids, merge, solidsReady, type Parts } from '../lib/sculpt'
import { lodReady, sunEnough, sunLodsLater } from '../lib/sculpt/lod'
import { shadowOnly } from '../lib/sculpt/sun'
import { structureParts, type Structure } from '../models/structures'
import { GOODS_PART, TOOL_PLACES, modelBox, placedBox, toolModel } from '../models/tools'
import { useHome } from '../store'
import { TOOLS, TOOL_KINDS, type ToolKind } from './data'
import { usePlacement } from './edit'
import { toWorld } from './layout'
import { Body, Placed } from './Places'
import { skinsView } from './skinsView'
import { buySkin, farm, skinOwned, skinWorn, toolOwned, useFarm, wearSkin } from './state'

// The animals' tools at their fences (plans/animal-tools.md; the models in src/models/tools.ts, the user's three
// families each a skin of src/farm/skins.ts): once a kind's tool is the farm's, it stands at its place in the skin it
// wears — the coop where the nest box was (src/farm/Places.tsx leaves the box out; the eggs lie in its nests,
// src/farm/Plants.tsx), the milk bucket by the pasture's gate, the shears and their basket by the fold's. What waits to
// be taken (the milk in the pail, the wool in the basket) is drawn while some waits. Each is a crowd of one model, so
// the drawing pass leaves it out where it cannot be seen; its shadow is one mesh of all its parts that cast, drawn only
// into the sun's map from its copy for the sun (as the furniture's: src/lib/sculpt/sun.ts) — one draw there, not one
// for each of its materials (the wool in the basket, which comes and goes, casts on its own). A box round it is solid.
// On it, a gear opens its skins shop (src/farm/SkinShop.tsx): looked at, never the action button's.

/** The coop's cut nests need the solid engine (src/lib/sculpt/solid.ts): it starts loading with the farm. */
void loadSolids()

function useSolids() {
  const [ready, setReady] = useState(solidsReady)
  useEffect(() => {
    if (!ready) void loadSolids().then(() => setReady(true))
  }, [ready])
  return ready
}

/** Puts a tool's model where its group stands: every part, and what waits to be taken only while some waits. */
function putTool(parts: Parts, goods: boolean) {
  parts.begin()
  parts.at(0, 0, 0)
  for (const k of Object.keys(parts.meshes)) if (k !== GOODS_PART || goods) parts.put(k, 0, 0, 0)
  parts.end()
}

/** A tool's shadow: every part of it that casts (but what waits to be taken), merged into one mesh drawn only into the
 *  sun's map, whole until its copy for the sun is made, then from the coarsest copy that keeps its shadow to the texel
 *  (`sunEnough`; it stands at its own size). `material`: one of the model's, for the side it casts from. */
function toolShadow(model: Structure, material: Material, name: string) {
  const shapes = Object.entries(model)
    .filter(([k, part]) => k !== GOODS_PART && (part.castShadow ?? true))
    .map(([, part]) => part.shape)
  const whole = merge(...shapes).geometry()
  const mesh = shadowOnly(new Mesh(whole, material))
  mesh.name = `${name}-sun`
  let gone = false
  void lodReady().then(() =>
    sunLodsLater(whole, (copies) => {
      let copy = null
      for (const c of copies) if (sunEnough(c.error, 1)) copy = c
      if (gone || !copy) return
      mesh.geometry = copy.geometry
      shadowOnly(mesh, whole, copy.geometry)
    }),
  )
  return {
    mesh,
    dispose() {
      gone = true
      whole.dispose()
    },
  }
}

/** Opens a tool's skins shop. */
const openSkins = (tool: ToolKind) => useHome.getState().openPanel({ kind: 'skins', tool })

function ToolStand({ kind }: { kind: ToolKind }) {
  const look = TOOLS[kind].look
  const { place, at, turn } = TOOL_PLACES[look]
  const style = useFarm(() => farm.skins[kind].worn)
  // (the hens' eggs are the crops' crowd, in its nests: the coop has no goods part)
  const waiting = useFarm(() => farm.producers[kind].stock.some((n) => n > 0))
  const solids = useSolids()
  const built = useMemo(() => {
    if (!solids) return null
    const model = toolModel(look, style)
    const b = placedBox(look, modelBox(model))
    // the crowd casts only what waits to be taken: the rest's shadow is one mesh (toolShadow)
    const seen = Object.fromEntries(Object.entries(model).map(([k, part]) => [k, k === GOODS_PART ? part : { ...part, castShadow: false }])) as Structure
    const parts = structureParts(seen, `tool-${kind}`)
    return {
      parts,
      shadow: toolShadow(model, Object.values(parts.meshes)[0].material as Material, `tool-${kind}`),
      // solid: a box round it, from the ground up (in its place's frame)
      body: {
        half: [(b.max[0] - b.min[0]) / 2, b.max[1] / 2, (b.max[2] - b.min[2]) / 2] as [number, number, number],
        at: [(b.min[0] + b.max[0]) / 2, b.max[1] / 2, (b.min[2] + b.max[2]) / 2] as [number, number, number],
      },
      top: b.max[1],
    }
  }, [solids, look, style, kind])
  useEffect(
    () => () => {
      built?.parts.dispose()
      built?.shadow.dispose()
    },
    [built],
  )
  useEffect(() => {
    if (built) putTool(built.parts, waiting)
  }, [built, waiting])

  // its gear: the skins shop, on the thing you look at (its top, above where its own offer is looked at)
  const p = usePlacement(place)
  const top = built?.top ?? 1
  useEffect(() => {
    const w = ([x, y, z]: [number, number, number]): Point3 => {
      const [wx, wz] = toWorld(p, x, z)
      return { x: wx, y, z: wz }
    }
    const t = TOOLS[kind]
    const crown: [number, number, number] = [t.aim[0], top - 0.12, t.aim[2]]
    return registerInteractable({
      id: `farm-skins-${kind}`,
      label: `${t.name}: its skins`,
      position: w(t.stand),
      aim: w(crown),
      radius: t.reach,
      // (a gear only: never on the action button)
      enabled: () => false,
      tag: () => ({ kind: 'gear', label: `${t.name}: its skins`, at: w([t.aim[0], top + 0.1, t.aim[2]]), open: () => openSkins(kind) }),
      run: () => openSkins(kind),
    })
  }, [kind, p, top])

  return (
    <>
      <Placed id={place}>
        {built && (
          <group position={at} rotation-y={turn}>
            <primitive object={built.parts.group} />
            <primitive object={built.shadow.mesh} />
          </group>
        )}
      </Placed>
      {built && <Body id={place} boxes={[built.body]} />}
    </>
  )
}

/** Every tool the farm owns, at its fence. */
export function ToolStands() {
  const owned = useFarm(() => TOOL_KINDS.filter((k) => toolOwned(k) !== null).join(','))
  // the tools' skins, for the tests (?debug): buy, put on, what is worn and owned, the shop's view
  useEffect(() => {
    debugSet('skins', {
      buy: buySkin,
      wear: wearSkin,
      worn: skinWorn,
      owned: skinOwned,
      view: (kind: ToolKind) => skinsView(kind, farm.skins, toolOwned(kind) !== null, farm.coins),
    })
  }, [])
  return (
    <>
      {TOOL_KINDS.filter((k) => owned.split(',').includes(k)).map((k) => (
        <ToolStand key={k} kind={k} />
      ))}
    </>
  )
}
