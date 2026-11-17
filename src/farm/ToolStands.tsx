import { useEffect, useMemo, useState } from 'react'
import { Mesh, type Material } from 'three'
import { debugSet } from '../lib/debug'
import { loadSolids, merge, solidsReady, type Parts } from '../lib/sculpt'
import { lodReady, sunEnough, sunLodsLater } from '../lib/sculpt/lod'
import { shadowOnly } from '../lib/sculpt/sun'
import { structureParts, type Structure } from '../models/structures'
import { GOODS_PART, TOOL_PLACES, modelBox, placedBox, toolModel } from '../models/tools'
import { TOOLS, TOOL_KINDS, type ToolKind } from './data'
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
// Its place is the tool's on the action button (src/farm/useTool.ts: E and a gear open its panel, whose Skins opens its
// skins shop, src/farm/SkinShop.tsx): one way in, never two gears on one tool.

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
