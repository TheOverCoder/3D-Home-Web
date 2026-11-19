/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs'
import path from 'node:path'
import { expect, type Game, type MapId, type Pose, fillFarm, inRect, marketDoorStill } from './helpers'
import { FRONT_DOOR, GONDOLAS, HALL } from '../../src/data/market'
import { GARDEN, GATE } from '../../src/data/layout'
import type { WalkInRoom } from '../../src/data/buildings'

// The drawing pass that leaves out what cannot be seen (src/lib/visibility) changes how a frame is drawn, never what is
// in it. With the farm at its fullest (every room full, every animal the shop sells, fifteen buyers, a ripe crop in
// every bed), at each pose the same frame is drawn twice — the pass on, then off, nothing running in between (no
// frame, no clock: time and animation stand still) — into a half-float target, and the two must match in every
// pixel's colour and depth; and the sun's shadow map, drawn both ways, in every texel. In first person in the house the
// pass must leave things out (rooms behind walls, the sun under the ceilings); in third person, decorating and the edit
// mode, and on the farm (a map of its own, with no house: src/scene/Maps.tsx), the rooms and the sun must be off. At
// 640×360 and at a phone's 390×844. The house and its garden are posed on the home map, the farm on the farm. Every
// walk-in building (WALK_INS, src/data/buildings.ts) is posed from its own row; the supermarket also from the lane with
// the gate open, at its shelves and in its south aisle, and its interior is proven to cast no shadow anyone could see.
//
// One case is allowed, and only when proven again: a pixel or two where today's renderer (software WebGL) draws a
// thing that reaches across the side of the screen through the wall in front of it, with a depth it does not have
// (the prototype's one pixel at the left edge). Allowed only if hiding exactly the things the pass left out there —
// plain `visible = false`, no pass — draws the same frame as the pass, and rays through those pixels meet the house's
// opaque shell before they meet those things (never a thing drawn without the depth test: the shell does not hide it).
//
//
// The spec comes in four parts, each a shard of its own on a push (a part takes 2 to 6 minutes there): 16-view-rooms
// and 16-view-openings (the house, on its own map), 16-view-farm and 16-view-buildings (the walk-ins and the
// supermarket). This file is what they share: the probe that draws a frame both ways, the poses, and how a pose is
// stood at and compared.

/** Runs in the page: window.__viewProbe, the comparisons. */
function installProbe() {
  const w = window as any
  if (w.__viewProbe) return
  const h = w.__home
  const gl = h.gl
  const ctx = gl.getContext() as WebGL2RenderingContext
  const sunLight = () => {
    let s: any = null
    h.scene.traverse((o: any) => {
      if (o.isDirectionalLight && o.castShadow) s = o
    })
    return s
  }
  // a depth texture read exactly: each texel's float bits as RGBA8 (a sampler without the shadow comparison)
  let prog: any = null
  const program = () => {
    if (prog) return prog
    const sh = (type: number, src: string) => {
      const s = ctx.createShader(type)!
      ctx.shaderSource(s, src)
      ctx.compileShader(s)
      if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) throw new Error(String(ctx.getShaderInfoLog(s)))
      return s
    }
    const p = ctx.createProgram()!
    ctx.attachShader(p, sh(ctx.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }'))
    ctx.attachShader(
      p,
      sh(
        ctx.FRAGMENT_SHADER,
        '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\nuniform sampler2D d; out vec4 o;\nvoid main(){ uint u = floatBitsToUint(texelFetch(d, ivec2(gl_FragCoord.xy), 0).r); o = vec4(float(u & 255u), float((u >> 8u) & 255u), float((u >> 16u) & 255u), float((u >> 24u) & 255u)) / 255.0; }',
      ),
    )
    ctx.linkProgram(p)
    const sampler = ctx.createSampler()!
    ctx.samplerParameteri(sampler, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST)
    ctx.samplerParameteri(sampler, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST)
    ctx.samplerParameteri(sampler, ctx.TEXTURE_COMPARE_MODE, ctx.NONE)
    prog = { p, sampler, vao: ctx.createVertexArray(), loc: ctx.getUniformLocation(p, 'd') }
    return prog
  }
  const readDepth = (tex: any, W: number, H: number) => {
    const P = program()
    const out = ctx.createTexture()
    ctx.bindTexture(ctx.TEXTURE_2D, out)
    ctx.texStorage2D(ctx.TEXTURE_2D, 1, ctx.RGBA8, W, H)
    const fb = ctx.createFramebuffer()
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb)
    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, out, 0)
    ctx.viewport(0, 0, W, H)
    for (const cap of [ctx.DEPTH_TEST, ctx.BLEND, ctx.SCISSOR_TEST, ctx.CULL_FACE, ctx.STENCIL_TEST]) ctx.disable(cap)
    ctx.colorMask(true, true, true, true)
    ctx.useProgram(P.p)
    ctx.activeTexture(ctx.TEXTURE0)
    ctx.bindTexture(ctx.TEXTURE_2D, gl.properties.get(tex).__webglTexture)
    ctx.bindSampler(0, P.sampler)
    ctx.uniform1i(P.loc, 0)
    ctx.bindVertexArray(P.vao)
    ctx.drawArrays(ctx.TRIANGLES, 0, 3)
    const px = new Uint8Array(W * H * 4)
    ctx.readPixels(0, 0, W, H, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
    ctx.bindSampler(0, null)
    ctx.bindVertexArray(null)
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
    ctx.deleteFramebuffer(fb)
    ctx.deleteTexture(out)
    gl.resetState()
    return px
  }
  let rt: any = null
  const target = () => {
    const W = gl.domElement.width
    const H = gl.domElement.height
    if (rt && rt.width === W && rt.height === H) return rt
    rt?.dispose()
    const map = sunLight().shadow.map
    rt = new map.constructor(W, H, { type: 1016 /* HalfFloatType */, depthBuffer: true })
    rt.depthTexture = new map.depthTexture.constructor(W, H, 1014 /* UnsignedIntType */)
    return rt
  }
  /** One render of the scene by the game's camera: its colour (half floats) and depth, exactly. */
  const shot = () => {
    const t = target()
    const prev = gl.getRenderTarget()
    gl.setRenderTarget(t)
    gl.render(h.scene, h.camera)
    gl.setRenderTarget(prev)
    const color = new Uint16Array(t.width * t.height * 4)
    gl.readRenderTargetPixels(t, 0, 0, t.width, t.height, color)
    return { color, depth: readDepth(t.depthTexture, t.width, t.height), W: t.width, H: t.height }
  }
  const differing = (a: any, b: any) => {
    const out: number[] = []
    for (let i = 0; i < a.color.length; i += 4) {
      if (
        a.color[i] !== b.color[i] ||
        a.color[i + 1] !== b.color[i + 1] ||
        a.color[i + 2] !== b.color[i + 2] ||
        a.color[i + 3] !== b.color[i + 3] ||
        a.depth[i] !== b.depth[i] ||
        a.depth[i + 1] !== b.depth[i + 1] ||
        a.depth[i + 2] !== b.depth[i + 2] ||
        a.depth[i + 3] !== b.depth[i + 3]
      )
        out.push(i / 4)
    }
    return out
  }
  const listed = () => {
    const list = gl.renderLists.get(h.scene, 0)
    return new Set([...list.opaque, ...list.transmissive, ...list.transparent].map((i: any) => i.object))
  }
  const name = (o: any) => {
    const chain: string[] = []
    for (let q = o; q; q = q.parent) if (q.name) chain.push(q.name)
    return `${o.type} ${chain.slice(0, 3).join(' < ')}`
  }

  /** Where the pixels differ, why: the things the pass left out that bring them back (forced into the frame). */
  const explain = (off: any, on: any, bad: number[], culled: any[]) => {
    const fixes = (set: any[]) => {
      for (const o of set) o.frustumCulled = false
      const s = shot()
      for (const o of set) o.frustumCulled = true
      return bad.some((k) => s.color[k * 4] === off.color[k * 4] && s.color[k * 4 + 1] === off.color[k * 4 + 1] && s.color[k * 4 + 2] === off.color[k * 4 + 2])
    }
    const found: any[] = []
    const search = (set: any[]) => {
      if (!set.length || !fixes(set)) return
      if (set.length === 1) found.push(set[0])
      else {
        search(set.slice(0, set.length >> 1))
        search(set.slice(set.length >> 1))
      }
    }
    search(culled.filter((o) => o.frustumCulled))
    // the same frame drawn without the pass, those things hidden (`visible = false`): it must be the pass's frame
    h.view.on = false
    for (const o of found) o.visible = false
    const hidden = shot()
    for (const o of found) o.visible = true
    h.view.on = true
    // kept for the rays through those pixels (behindShell)
    w.__viewProbe.last = { culprits: found, pixels: bad.map((k) => [k % off.W, Math.floor(k / off.W)]), W: off.W, H: off.H, pose: lastPose }
    // each reaches across an edge of the screen (its box, projected): a side, or (seen from above, third person) the top
    const V = h.camera.position.constructor
    const straddles = found.every((o: any) => {
      const g = o.geometry
      if (!g.boundingBox) g.computeBoundingBox()
      const b = g.boundingBox
      let x0 = Infinity
      let x1 = -Infinity
      let y0 = Infinity
      let y1 = -Infinity
      for (let k = 0; k < 8; k++) {
        const v = new V(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld).project(h.camera)
        x0 = Math.min(x0, v.x)
        x1 = Math.max(x1, v.x)
        y0 = Math.min(y0, v.y)
        y1 = Math.max(y1, v.y)
      }
      return (x0 < -1 && x1 > -1) || (x0 < 1 && x1 > 1) || (y0 < -1 && y1 > -1) || (y0 < 1 && y1 > 1)
    })
    // today's depth there (metres along the view): where it is drawn
    const n = h.camera.near
    const f = h.camera.far
    const depths = bad.slice(0, 4).map((k) => {
      const z = new Float32Array(new Uint8Array([off.depth[k * 4], off.depth[k * 4 + 1], off.depth[k * 4 + 2], off.depth[k * 4 + 3]]).buffer)[0]
      return +((2 * n * f) / (f + n - (z * 2 - 1) * (f - n))).toFixed(3)
    })
    return { culprits: found.map(name), straddles, depths, sameAsHidden: found.length > 0 && differing(hidden, on).length === 0 }
  }
  let lastPose: number[] | null = null

  /** The camera's frame with the pass off and on (`pose`: the camera set by hand for this task only). */
  const camera = (pose: number[] | null) => {
    const cam = h.camera
    lastPose = pose
    if (pose) {
      cam.position.set(pose[0], pose[1], pose[2])
      cam.rotation.order = 'YXZ'
      cam.rotation.set(pose[4], pose[3], 0)
      cam.updateMatrixWorld(true)
    }
    const v = h.view
    gl.shadowMap.needsUpdate = false
    gl.info.autoReset = false
    v.on = false
    gl.info.reset()
    const off = shot()
    const offList = listed()
    const before = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
    v.on = true
    gl.info.reset()
    const on = shot()
    const after = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
    gl.info.autoReset = true
    const stats = { ...v.stats }
    const onList = listed()
    const bad = differing(off, on)
    const out: any = { size: [off.W, off.H], before, after, stats, cells: h.viewCells(), differ: bad.length }
    if (bad.length) {
      out.pixels = bad.slice(0, 8).map((k) => [k % off.W, Math.floor(k / off.W)])
      // a crowd's models are not in the render list: do they matter here?
      v.crowds = false
      out.crowds = differing(off, shot()).length !== bad.length
      v.crowds = true
      Object.assign(
        out,
        explain(
          off,
          on,
          bad,
          [...offList].filter((o) => !onList.has(o)),
        ),
      )
    }
    return out
  }

  /** The sun's shadow map drawn with the pass off and on: every texel, exactly. */
  const shadow = () => {
    const s = sunLight()
    const v = h.view
    gl.info.autoReset = false
    const run = (on: boolean) => {
      v.on = on
      gl.shadowMap.needsUpdate = false
      gl.info.reset()
      gl.render(h.scene, h.camera)
      const cam = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
      gl.shadowMap.needsUpdate = true
      gl.info.reset()
      gl.render(h.scene, h.camera)
      const map = s.shadow.map
      return { calls: gl.info.render.calls - cam.calls, triangles: gl.info.render.triangles - cam.triangles, px: readDepth(map.depthTexture, map.width, map.height) }
    }
    const off = run(false)
    const on = run(true)
    const stats = { ...v.stats }
    v.on = true
    gl.info.autoReset = true
    gl.shadowMap.needsUpdate = true
    let differ = 0
    for (let i = 0; i < off.px.length; i++) if (off.px[i] !== on.px[i]) differ++
    return { before: { calls: off.calls, triangles: off.triangles }, after: { calls: on.calls, triangles: on.triangles }, sun: stats.sun, casters: stats.casters, culled: stats.castersCulled, differ }
  }

  /** The land as one mesh each (`__home.land.whole`, the way it was built before the pieces) and in pieces: the
   *  camera's frame with the sun's map redrawn for each, and that map, exactly (the camera set by hand). */
  const land = (pose: number[]) => {
    lastPose = pose
    const cam = h.camera
    cam.position.set(pose[0], pose[1], pose[2])
    cam.rotation.order = 'YXZ'
    cam.rotation.set(pose[4], pose[3], 0)
    cam.updateMatrixWorld(true)
    const s = sunLight()
    gl.info.autoReset = false
    const draw = (whole: boolean) => {
      h.land.whole(whole)
      gl.shadowMap.needsUpdate = true
      gl.info.reset()
      const frame = shot()
      const counts = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
      const map = s.shadow.map
      return { frame, counts, sun: readDepth(map.depthTexture, map.width, map.height) }
    }
    try {
      const whole = draw(true)
      const pieces = draw(false)
      const bad = differing(whole.frame, pieces.frame)
      let texels = 0
      for (let i = 0; i < whole.sun.length; i++) if (whole.sun[i] !== pieces.sun[i]) texels++
      return {
        size: [whole.frame.W, whole.frame.H],
        whole: whole.counts,
        pieces: pieces.counts,
        differ: bad.length,
        pixels: bad.slice(0, 8).map((k) => [k % whole.frame.W, Math.floor(k / whole.frame.W)]),
        texels,
        portals: h.view.stats.portals,
      }
    } finally {
      h.land.whole(false)
      gl.info.autoReset = true
      gl.shadowMap.needsUpdate = true
    }
  }
  const sameBytes = (a: Uint8Array, b: Uint8Array) => {
    let differ = 0
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differ++
    return differ
  }
  const pixelsDiffer = (a: any, b: any) => differing(a, b).length
  const mapNow = () => {
    const map = sunLight().shadow.map
    return readDepth(map.depthTexture, map.width, map.height)
  }
  /** One redraw of the sun's map now, the pass on or off, into the shots' own target (a render of the scene straight to
   *  the canvas, which the game never makes, changes what the next frames draw). */
  const redraw = (on: boolean) => {
    const prev = gl.getRenderTarget()
    h.view.on = on
    gl.shadowMap.needsUpdate = true
    gl.setRenderTarget(target())
    gl.render(h.scene, h.camera)
    gl.setRenderTarget(prev)
    h.view.on = true
    gl.shadowMap.needsUpdate = false
  }
  /** The sun's map as the game left it (drawn again or kept), against a full redraw now — every caster, then the pass
   *  on (left in place: the same map, when they match) — and the camera's frame with each. */
  const kept = () => {
    const stats = { drawn: h.view.stats.mapDrawn, kept: h.view.stats.mapKept }
    gl.shadowMap.needsUpdate = false
    const game = mapNow()
    const gameShot = shot()
    redraw(false)
    const all = mapNow()
    const allShot = shot()
    redraw(true)
    const full = mapNow()
    const fullShot = shot()
    return { ...stats, differ: sameBytes(game, full), differAll: sameBytes(game, all), pixels: pixelsDiffer(gameShot, fullShot), pixelsAll: pixelsDiffer(gameShot, allShot) }
  }
  /** Your body moved by hand (dx metres): what changes in the map drawn with every caster (the pass off), against the
   *  map before — a stale map, were it kept. */
  const bodyMoved = (dx: number) => {
    let body: any = null
    h.scene.traverse((o: any) => {
      if (!body && o.userData?.sun === 'room') body = o
    })
    redraw(false)
    const before = mapNow()
    body.position.x += dx
    body.updateMatrixWorld(true)
    redraw(false)
    const after = mapNow()
    body.position.x -= dx
    body.updateMatrixWorld(true)
    redraw(true)
    return sameBytes(before, after)
  }
  /** The market's interior casters (`__home.market.casters`: its fittings and goods, which do not cast; its people are the buyers' crowd, which never casts): the
   *  camera's frame drawn with the sun's map redrawn with them in it and without — the same in every pixel (no opening
   *  faces the sun, and the roof shades all of it), though the map took them in (the camera set by hand). */
  const casters = (pose: number[]) => {
    lastPose = pose
    const cam = h.camera
    cam.position.set(pose[0], pose[1], pose[2])
    cam.rotation.order = 'YXZ'
    cam.rotation.set(pose[4], pose[3], 0)
    cam.updateMatrixWorld(true)
    gl.info.autoReset = false
    // the goods are made again with the casting switched (a caster is drawn whole): the crowds' lighter copies of far
    // parts off for both frames, so only the shadows differ between them (27-far-copies holds the copies on their own)
    h.view.lod = false
    const draw = (on: boolean) => {
      h.market.casters(on)
      gl.shadowMap.needsUpdate = true
      gl.info.reset()
      const frame = shot()
      return { frame, counts: { calls: gl.info.render.calls, triangles: gl.info.render.triangles }, map: mapNow() }
    }
    try {
      const off = draw(false)
      const on = draw(true)
      const bad = differing(off.frame, on.frame)
      return {
        size: [off.frame.W, off.frame.H],
        off: off.counts,
        on: on.counts,
        differ: bad.length,
        pixels: bad.slice(0, 8).map((k) => [k % off.frame.W, Math.floor(k / off.frame.W)]),
        texels: sameBytes(off.map, on.map),
      }
    } finally {
      h.market.casters(false)
      h.view.lod = true
      gl.info.autoReset = true
      gl.shadowMap.needsUpdate = true
    }
  }
  w.__viewProbe = { camera, shadow, land, kept, bodyMoved, casters }
}

/**
 * Runs in the page, after a comparison where pixels differed: rays from the camera through each such pixel (its
 * centre and its corners) meet an opaque shell — the house's, or a walk-in building's (its group `walk-in-<id>`: from
 * inside one, its walls are what stands between you and the farm) — before they meet anything the pass left out there:
 * the thing is behind a wall, and today's renderer only lets it through at that pixel. A thing drawn without the depth
 * test is behind nothing: it is drawn over the shell. (three from node_modules, as 04 does.)
 */
export async function behindShell() {
  const THREE: any = await import(/* @vite-ignore */ '/__three/three.module.js')
  const w = window as any
  const h = w.__home
  const last = w.__viewProbe.last
  const cam = h.camera
  if (last.pose) {
    cam.position.set(last.pose[0], last.pose[1], last.pose[2])
    cam.rotation.order = 'YXZ'
    cam.rotation.set(last.pose[4], last.pose[3], 0)
    cam.updateMatrixWorld(true)
  }
  const shell: any[] = []
  h.scene.traverse((o: any) => {
    if (!o.isMesh) return
    let always = false
    let walkIn = false
    for (let p = o; p; p = p.parent) {
      if (p.visible === false) return
      if (p.userData?.cell === 'always') always = true
      if (typeof p.name === 'string' && p.name.startsWith('walk-in-')) walkIn = true
    }
    // (a walk-in's shell is one instanced part: the house's is plain meshes, its instanced crowds are not shell)
    if (!walkIn && (!always || o.isInstancedMesh)) return
    const m = o.material
    if (m && !Array.isArray(m) && !m.transparent && m.opacity >= 1 && m.colorWrite !== false) shell.push(o)
  })
  const rc = new THREE.Raycaster()
  rc.near = cam.near
  // a thing drawn without the depth test (the aim marker) is drawn over the shell, however far behind it it stands
  const over = (o: any) => [o.material].flat().some((m: any) => m?.depthTest === false)
  const out: { pixel: number[]; behind: boolean; shell: number; thing: number; over?: boolean }[] = []
  for (const [x, y] of last.pixels) {
    let behind = true
    let drawnOver = false
    let nearestShell = Infinity
    let nearestThing = Infinity
    for (const [dx, dy] of [
      [0, 0],
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ]) {
      rc.setFromCamera({ x: ((x + 0.5 + dx) / last.W) * 2 - 1, y: ((y + 0.5 + dy) / last.H) * 2 - 1 }, cam)
      const s = rc.intersectObjects(shell, false)[0]?.distance ?? Infinity
      const hits = rc.intersectObjects(last.culprits, false)
      const t = hits[0]?.distance ?? Infinity
      nearestShell = Math.min(nearestShell, s)
      nearestThing = Math.min(nearestThing, t)
      if (t !== Infinity && !(s < t)) behind = false
      if (hits.some((h: any) => over(h.object))) {
        behind = false
        drawnOver = true
      }
    }
    out.push({ pixel: [x, y], behind, shell: +nearestShell.toFixed(3), thing: +nearestThing.toFixed(3), ...(drawnOver ? { over: true } : {}) })
  }
  return out
}

export const P = Math.PI
export const ROOMS: Pose[] = [
  { name: 'living room', x: -3.5, z: 1.3, yaw: P, pitch: -0.04, shadow: true },
  { name: 'living room, towards the studio', x: -3.5, z: 1.3, yaw: 0 },
  { name: 'studio', x: -3.5, z: -2, yaw: 0 },
  { name: 'studio, towards the kitchen', x: -3.5, z: -2, yaw: -P / 2 },
  { name: 'kitchen, the door shut', x: 3.5, z: -3, yaw: P, shadow: true },
  { name: 'kitchen, the east window', x: 3.5, z: -3, yaw: -P / 2 },
  { name: 'bedroom', x: 3.5, z: 1, yaw: P },
  { name: 'bedroom, towards the living room', x: 3.5, z: 1, yaw: P / 2 },
  // a ceiling corner, the floor at your feet, and right up against a wall (the near plane cuts into it)
  { name: 'kitchen, looking up into a corner', x: 6.4, z: -5.4, yaw: -P / 4, pitch: 1.1 },
  { name: 'living room, against the studio wall', x: -5.2, z: 0.36, yaw: P / 2, pitch: 0.2 },
  { name: 'bedroom, looking down at your feet', x: 3.5, z: 2, yaw: P, pitch: -1.4 },
  // the prototype's one pixel at the left edge, both poses: a thing outdoors far behind a wall (the farm's, when the farm
  // stood round the house), at the very edge of the view, that today's renderer lets through — proven again each run
  // whenever it shows (check)
  { name: 'living room, the left edge (known pixel)', x: -3.5, z: 0.6, yaw: P, pitch: -0.05 },
  { name: 'kitchen, the left edge (known pixel)', x: 1.5, z: -3, yaw: P / 2, pitch: -0.05 },
]
/** The house's own garden round it (the home map: src/data/home.ts), and the countryside past its fence. */
// (the garden door both ways, the doorways from both sides and standing in them, and each window from its room are made
// from the house's openings as the save has them: openingViews in helpers.ts)
export const GARDEN_POSES: Pose[] = [
  { name: 'the garden, back at the house', x: 0, z: 12.5, yaw: 0, pitch: 0.02, shadow: true },
  { name: 'the garden, behind the house', x: 0, z: -9, yaw: P, pitch: 0.05 },
  { name: 'the garden, over the fence to the west', x: -9.5, z: 2, yaw: P / 2, pitch: 0.02 },
  { name: 'the driveway, out to the lane', x: -1.2, z: 10.2, yaw: -P / 2, pitch: -0.03 },
]
/** The farm (a map of its own: where the house stood is its lawn). */
export const YARD: Pose[] = [
  { name: 'yard, over the farm', x: -12, z: -10.5, yaw: (-3 * P) / 4, pitch: -0.08, shadow: true },
  { name: 'yard, where the house stood', x: 0, z: 12.5, yaw: 0, pitch: 0.02 },
  { name: 'yard, the pasture', x: 9.5, z: -1, yaw: -P / 2, pitch: -0.05 },
  { name: 'yard, from the north', x: 0, z: -9.5, yaw: P, pitch: 0.05 },
  { name: 'gate, the line', x: 4.2, z: 10.8, yaw: P - 0.5, pitch: -0.05 },
  { name: 'gate, along the line', x: 5.6, z: 12.2, yaw: 1.25, pitch: -0.05 },
  { name: 'yard, the office and the tractor', x: -5, z: 7.9, yaw: P / 2, pitch: -0.05, shadow: true },
  // the animals' tools at their fences (fillFarm owns them): the coop and the milk bucket, each a crowd of one model
  // whose shadow is one mesh drawn only into the sun's map (src/farm/ToolStands.tsx); the shears are in "from the north"
  { name: 'yard, the coop and the milk bucket at their fences', x: 4, z: 2, yaw: -P / 2, pitch: -0.05, shadow: true },
]

/** The supermarket's own: from the lane before the garden's gate (open: you stand within 1.8 m of it), in the aisle
 *  between its two islands of shelves looking down it (with the sun's map), along the aisle south of them, and from the
 *  lane before its sliding doors, open (you within 2 m of the doorway: the shop seen through them). */
const GATE_OPEN: Pose = { name: 'market: the gate open, from the lane', x: GATE.x, z: GARDEN.maxZ + 1.3, yaw: 0, pitch: -0.05, wait: 3000 }
export const DOORS_OPEN: Pose = { name: 'market: its doors open, from the lane', x: (FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, z: FRONT_DOOR.z0 - 1.6, yaw: P, pitch: -0.05, marketDoor: 1 }
export const SHELVES: Pose = { name: 'market: the shelves', x: (GONDOLAS[0].x1 + GONDOLAS[1].x0) / 2, z: GONDOLAS[0].z0 - 0.2, yaw: P, pitch: -0.1, shadow: true }
export const AISLE: Pose = { name: 'market: the south aisle', x: HALL.x1 - 0.6, z: (Math.max(...GONDOLAS.map((g) => g.z1)) + HALL.z1) / 2, yaw: P / 2, pitch: -0.05 }
export const MARKET: Pose[] = [GATE_OPEN, DOORS_OPEN, SHELVES, AISLE]

/** Third person at a pose: the frame compared (the walls hide things far off along the top of the screen: a few more
 *  pixels of the known edge case, each proven), the rooms and the sun not used, the sun's map the same; `walls`: the
 *  walls must leave something out; `room`: the camera must stay inside that room, under its top. */
export async function thirdAt(game: Game, p: Pose, log: string[], opts: { walls?: boolean; room?: WalkInRoom } = {}) {
  const { page } = game
  await game.teleport(p.x, 1.4, p.z, p.yaw, 0)
  await page.waitForTimeout(600)
  await page.evaluate(() => (window as any).__home.useHome.getState().setView('third'))
  try {
    // the camera's flight there (about a second), and the market's sliding doors still
    await page.waitForTimeout(2500)
    await marketDoorStill(page)
    const r = await page.evaluate(() => (window as any).__viewProbe.camera(null))
    if (r.differ && r.culprits?.length) r.rays = await page.evaluate(behindShell)
    report(log, p.name, r)
    if (r.differ) console.log(log[log.length - 1])
    check(p.name, r, 8)
    expect(r.stats.portals, `${p.name}: no rooms and portals`).toBe(false)
    if (opts.walls) expect(r.stats.wallCulled + r.stats.wallModels, `${p.name}: things behind its walls left out`).toBeGreaterThan(0)
    if (opts.room) {
      const c = await page.evaluate(() => ({ ...(window as any).__home.camera.position }))
      log.push(`  the camera at ${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}`)
      expect(inRect(opts.room, c.x, c.z, 0.02), `${p.name}: the camera inside ${opts.room.space}`).toBe(true)
      expect(c.y, `${p.name}: the camera under the room's top`).toBeLessThanOrEqual(opts.room.top + 0.02)
    }
    const s = await page.evaluate(() => (window as any).__viewProbe.shadow())
    log.push(`  sun's shadow map: ${s.after.calls} draws, ${s.culled} casters left out, ${s.differ} bytes differ`)
    expect(s.sun, `${p.name}: the sun's pass is whole`).toBe(false)
    expect(s.differ).toBe(0)
  } finally {
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
    await firstAgain(game)
  }
}

/** Back in first person: in the house, once the camera is home the pass is back (its rooms and portals); on the farm (no
 *  house, no portals), once the edit mode's camera is home and two more frames are drawn. */
export async function firstAgain(game: Game) {
  const { page } = game
  await page.waitForFunction(
    () => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      if (s.map === 'home') return h.view.stats.portals === true
      return s.view === 'first' && !s.editing && !s.decorating && h.farm.edit.camera.blend === 0 && h.home.decorate.camera.blend === 0
    },
    null,
    { timeout: 30_000, polling: 250 },
  )
  const frames = await page.evaluate(() => (window as any).__home.view.stats.renders)
  await page.waitForFunction((f) => (window as any).__home.view.stats.renders > f + 2, frames, { timeout: 30_000, polling: 100 })
}

/** At a pose, the market's interior casters on and off: the same frame, every pixel; and the map did take them in. */
export async function castersAt(game: Game, p: Pose, log: string[]) {
  const { page } = game
  await standAt(game, p)
  const r = await page.evaluate((pose) => (window as any).__viewProbe.casters(pose), [p.x, p.y ?? EYE, p.z, p.yaw, p.pitch ?? 0])
  log.push(
    `${p.name}, the interior casting (${r.size.join('×')}): ${r.off.calls} draws / ${r.off.triangles} triangles with the sun's map → ${r.on.calls} / ${r.on.triangles}; ${r.texels} map bytes and ${r.differ} pixels differ${r.differ ? ` ${JSON.stringify(r.pixels)}` : ''}`,
  )
  expect(r.on.calls, `${p.name}: the interior's casters drawn into the sun's map`).toBeGreaterThan(r.off.calls)
  expect(r.differ, `${p.name}: their shadows change no pixel`).toBe(0)
}

/** Stands the player at a pose (the kitchen's door as it says), until the camera is there and the door still. */
export async function standAt(game: Game, p: Pose) {
  const { page } = game
  await page.evaluate(
    ([x, z, yaw, door]) => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      if (door !== null && s.doors['door-kitchen-bedroom'] !== door) s.toggleDoor('door-kitchen-bedroom')
      // the market's shelves full again, and the shop quiet: nobody about, no visits (a shopper walking by would open its
      // front door at random)
      h.farm.marketFill?.('corn', { quiet: true })
      // already standing there (the pose before was here too): no need to go again
      const at = h.playerState.position
      if (Math.hypot(at.x - x, at.z - z) > 0.6) h.teleport(x, 1.4, z)
      if (typeof h.look === 'function') h.look({ yaw, pitch: 0 })
      else {
        h.look.yaw = yaw
        h.look.pitch = 0
      }
    },
    [p.x, p.z, p.yaw, p.door ?? null] as [number, number, number, boolean | null],
  )
  // the player there (a chair in a full room may push them a little: the camera is set by hand below), and the
  // kitchen's door wherever it was going (open, or shut: its leaf back in the frame)
  await expect
    .poll(
      () =>
        page.evaluate(
          ([x, z, door]) => {
            const h = (window as any).__home
            const c = h.camera.position
            const leaf = h.scene.getObjectByName('door-leaf')
            const angle = leaf ? Math.abs(Math.atan2(-leaf.matrixWorld.elements[2], leaf.matrixWorld.elements[0])) : -1
            const settled = door === null || (door ? angle > Math.PI / 2 - 0.01 : angle >= 0 && angle < 0.002)
            const near = Math.hypot(c.x - x, c.z - z) < 1.2
            return { ready: near && settled, camera: [c.x, c.z].map((v: number) => +v.toFixed(2)), door: +angle.toFixed(4) }
          },
          [p.x, p.z, p.door ?? null] as [number, number, boolean | null],
        ),
      { timeout: 60_000, intervals: [250], message: `${p.name}: the player there and the door settled` },
    )
    .toMatchObject({ ready: true })
  if (p.wait) await page.waitForTimeout(p.wait)
  await marketDoorStill(page, p.marketDoor)
}

/** Stands the player at a pose, then compares the frame there. */
export async function compareAt(game: Game, p: Pose, log: string[]) {
  const { page } = game
  await standAt(game, p)
  const r = await page.evaluate((pose) => (window as any).__viewProbe.camera(pose), [p.x, p.y ?? EYE, p.z, p.yaw, p.pitch ?? 0])
  if (r.differ && r.culprits?.length) r.rays = await page.evaluate(behindShell)
  report(log, p.name, r)
  if (r.differ) console.log(log[log.length - 1])
  check(p.name, r)
  // the rooms and portals, and the sun's windows, are the house's: in first person on the home map; the farm has none
  const house = (await page.evaluate(() => (window as any).__home.useHome.getState().map)) === 'home'
  expect(r.stats.portals, `${p.name}: the rooms and portals are used in first person in the house (only)`).toBe(house)
  if (p.shadow) {
    const s = await page.evaluate(() => (window as any).__viewProbe.shadow())
    log.push(
      `  sun's shadow map: ${s.before.calls} draws / ${s.before.triangles} triangles → ${s.after.calls} / ${s.after.triangles} (${s.culled} of ${s.casters} casters left out), ${s.differ} bytes differ`,
    )
    expect(s.sun, `${p.name}: the sun's pass is culled in first person in the house (only)`).toBe(house)
    if (house) expect(s.culled, `${p.name}: casters under the ceilings left out`).toBeGreaterThan(0)
    expect(s.differ, `${p.name}: the shadow map is the same`).toBe(0)
  }
  return r
}

/** Eye height for the poses (the player's, standing on the floor) */
export const EYE = 1.62

export function report(log: string[], name: string, r: any) {
  log.push(
    `${name} (${r.size.join('×')}): ${r.before.calls} draws / ${r.before.triangles} triangles → ${r.after.calls} / ${r.after.triangles}; ${r.stats.culled} of ${r.stats.tested} things and ${r.stats.modelsCulled} of ${r.stats.models} crowd models left out (behind a wall: ${r.stats.wallCulled} things, ${r.stats.wallModels} models, of ${r.stats.walls} wall pieces); eye in ${r.cells.start.join(', ') || '-'}, seen ${r.cells.seen.join(', ') || '-'}; ${r.differ} pixels differ${r.differ ? ` ${JSON.stringify(r.pixels)} (${r.culprits?.join('; ')}; across the screen's edge: ${r.straddles}; today drawn at ${r.depths?.join(', ')} m; same with them hidden: ${r.sameAsHidden}; rays ${JSON.stringify(r.rays)})` : ''}`,
  )
}

/** No pixel may differ — but for the one known edge case, proven again: a pixel or two at the edge of the screen
 *  where a thing far behind a wall shows through today, and the pass's frame is exactly today's with those things
 *  hidden. */
export function check(name: string, r: any, most = 2) {
  if (r.differ === 0) return
  expect(r.crowds, `${name}: no crowd model left out may show`).toBe(false)
  expect(r.differ, `${name}: ${r.differ} pixels differ at ${JSON.stringify(r.pixels)}`).toBeLessThanOrEqual(most)
  expect(r.culprits?.length, `${name}: what the pass left out there`).toBeGreaterThan(0)
  expect(r.straddles, `${name}: ${r.culprits?.join('; ')} do not reach across an edge of the screen`).toBe(true)
  expect(r.sameAsHidden, `${name}: the pass's frame is today's with ${r.culprits?.join('; ')} hidden`).toBe(true)
  // and what was left out is behind the house's shell (or a walk-in's) there: no ray through those pixels meets it first
  expect(r.rays?.length, `${name}: rays through the pixels`).toBe(r.differ)
  for (const ray of r.rays)
    expect(
      ray.behind,
      `${name}: pixel ${ray.pixel} — ${r.culprits?.join('; ')} at ${ray.thing} m${ray.over ? ' (drawn without the depth test: over the shell)' : ''}, the shell at ${ray.shell} m`,
    ).toBe(true)
}

const routed = new WeakSet<object>()
export async function setUp(game: Game, map: MapId = 'home') {
  await game.ready(map)
  // a three.js for the rays (behindShell): the one from node_modules, under a private path
  if (!routed.has(game.page)) {
    routed.add(game.page)
    await game.page.route('**/__three/*', (route) =>
      route.fulfill({ body: fs.readFileSync(path.join(process.cwd(), 'node_modules/three/build', path.basename(new URL(route.request().url()).pathname))), contentType: 'text/javascript' }),
    )
  }
  await game.page.evaluate(installProbe)
  const filled = await fillFarm(game.page)
  expect(filled.line).toBe(15)
  for (const room of ['bedroom', 'living', 'office', 'kitchen']) expect(filled.rooms[room].added, room).toBeGreaterThan(0)
}

/** Third person, decorating or the edit mode at a spot: the frame compared (the known edge case: a few more pixels, each
 *  proven), the rooms and the sun not used, the sun's map the same. */
export const off = async (game: Game, log: string[], name: string, mode: 'third' | 'decorate' | 'edit', x: number, z: number) => {
  const { page } = game
  await game.teleport(x, 1.4, z, P, 0)
  await page.waitForTimeout(600)
  await page.evaluate((mode) => {
    const s = (window as any).__home.useHome.getState()
    if (mode === 'third') s.setView('third')
    if (mode === 'decorate') s.setDecorating(true)
    if (mode === 'edit') s.setEditing(true)
  }, mode)
  // the camera's flight there (about a second)
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => (window as any).__viewProbe.camera(null))
  // (the known edge case, proven as in first person: rays through the pixels, from the game's camera as it stands;
  // seen from above, the walls hide many things far off along the top of the screen, so a few more pixels — each
  // still proven: the frame is today's with those things hidden, and a ray through it meets the wall first)
  if (r.differ && r.culprits?.length) r.rays = await page.evaluate(behindShell)
  report(log, name, r)
  if (r.differ) console.log(log[log.length - 1])
  check(name, r, 8)
  expect(r.stats.portals, `${name}: no rooms and portals`).toBe(false)
  // the house's walls hide what is behind them (src/lib/visibility/walls.ts), in third person from every room
  const house = (await page.evaluate(() => (window as any).__home.useHome.getState().map)) === 'home'
  if (house && mode === 'third' && x > -7 && x < 7 && z > -6 && z < 6) expect(r.stats.wallCulled + r.stats.wallModels, `${name}: things behind a wall left out`).toBeGreaterThan(0)
  const s = await page.evaluate(() => (window as any).__viewProbe.shadow())
  log.push(`  sun's shadow map: ${s.after.calls} draws, ${s.culled} casters left out, ${s.differ} bytes differ`)
  expect(s.sun, `${name}: the sun's pass is whole`).toBe(false)
  expect(s.differ).toBe(0)
  await page.evaluate(() => {
    const s = (window as any).__home.useHome.getState()
    s.setView('first')
    s.setDecorating(false)
    s.setEditing(false)
  })
  // back in first person: once the camera is home (in the house, the ceilings up again and the pass back)
  await firstAgain(game)
}
