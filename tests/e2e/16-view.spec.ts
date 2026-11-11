/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, emptyFarm, fillFarm, marketDoorStill, type Game } from './helpers'
import { WALK_INS, type Rect, type WalkIn, type WalkInRoom } from '../../src/data/buildings'
import { GARDEN, GATE } from '../../src/data/layout'
import { FRONT_DOOR, HALL, ISLAND, SHELF_RUN } from '../../src/data/market'

// The drawing pass that leaves out what cannot be seen (src/lib/visibility) changes how a frame is drawn, never what is
// in it. With the farm at its fullest (every room full, every animal the shop sells, fifteen buyers, a ripe crop in
// every bed), at each pose the same frame is drawn twice — the pass on, then off, nothing running in between (no
// frame, no clock: time and animation stand still) — into a half-float target, and the two must match in every
// pixel's colour and depth; and the sun's shadow map, drawn both ways, in every texel. In first person the pass must
// leave things out (rooms behind walls, the sun under the ceilings); in third person, decorating and the edit mode the
// rooms and the sun must be off. At 640×360 and at a phone's 390×844. Every walk-in building (WALK_INS,
// src/data/buildings.ts) is posed from its own row; the supermarket also from the lane with the gate open, at its
// shelves and in its south aisle, and its interior is proven to cast no shadow anyone could see.
//
// One case is allowed, and only when proven again: a pixel or two where today's renderer (software WebGL) draws a
// thing that reaches across the side of the screen through the wall in front of it, with a depth it does not have
// (the prototype's one pixel at the left edge). Allowed only if hiding exactly the things the pass left out there —
// plain `visible = false`, no pass — draws the same frame as the pass, and rays through those pixels meet the house's
// opaque shell before they meet those things.

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
 * the thing is behind a wall, and today's renderer only lets it through at that pixel. (three from node_modules, as 04
 * does.)
 */
async function behindShell() {
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
  const out: { pixel: number[]; behind: boolean; shell: number; thing: number }[] = []
  for (const [x, y] of last.pixels) {
    let behind = true
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
      const t = rc.intersectObjects(last.culprits, false)[0]?.distance ?? Infinity
      nearestShell = Math.min(nearestShell, s)
      nearestThing = Math.min(nearestThing, t)
      if (t !== Infinity && !(s < t)) behind = false
    }
    out.push({ pixel: [x, y], behind, shell: +nearestShell.toFixed(3), thing: +nearestThing.toFixed(3) })
  }
  return out
}

interface Pose {
  name: string
  /** where the player stands (teleported, frames run until the camera is there) */
  x: number
  z: number
  /** the camera, set by hand for the comparison: yaw, pitch, and its height (the player's eyes by default) */
  yaw: number
  pitch?: number
  y?: number
  /** the kitchen's door */
  door?: boolean
  /** also compare the sun's shadow map */
  shadow?: boolean
  /** ms to wait once there, for something that moves as you come (the garden's gate swinging open) */
  wait?: number
  /** the market's sliding doors as the pose means them, waited for (0 shut, 1 open); still either way otherwise */
  marketDoor?: 0 | 1
}

const P = Math.PI
const ROOMS: Pose[] = [
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
  // the prototype's one pixel at the left edge, both poses: a thing on the farm far behind a wall, at the very edge of
  // the view, that today's renderer lets through — proven again each run (check)
  { name: 'living room, the left edge (known pixel)', x: -3.5, z: 0.6, yaw: P, pitch: -0.05 },
  { name: 'kitchen, the left edge (known pixel)', x: 1.5, z: -3, yaw: P / 2, pitch: -0.05 },
]
const DOORWAYS: Pose[] = [
  { name: 'living ↔ studio doorway, from the living room', x: -3.5, z: 1.2, yaw: 0 },
  { name: 'living ↔ studio doorway, standing in it', x: -3.5, z: 0.05, yaw: -0.6 },
  { name: 'studio ↔ kitchen doorway', x: -1.2, z: -3, yaw: -P / 2 },
  { name: 'living ↔ bedroom doorway', x: -1.2, z: 3, yaw: -P / 2 },
  { name: 'kitchen ↔ bedroom, the door shut, from the kitchen', x: 3.5, z: -1.3, yaw: P, door: false, shadow: true },
  { name: 'kitchen ↔ bedroom, the door shut, from the bedroom', x: 3.5, z: 2.2, yaw: 0, door: false },
  { name: 'kitchen ↔ bedroom, the door open, from the kitchen', x: 3.5, z: -1.3, yaw: P, door: true, shadow: true },
  { name: 'kitchen ↔ bedroom, the door open, from the bedroom', x: 3.5, z: 2.2, yaw: 0, door: true },
  { name: 'kitchen ↔ bedroom, the door open, standing in it', x: 3.6, z: 0, yaw: 0.4, door: true },
]
const OUTSIDE: Pose[] = [
  { name: 'garden door, looking out', x: -1.2, z: 3.6, yaw: P, pitch: -0.05, shadow: true },
  { name: 'garden door, standing in it', x: -1.2, z: 6, yaw: P - 0.3 },
  { name: 'garden door, looking in', x: -1.2, z: 8.5, yaw: 0, pitch: -0.05 },
  { name: 'yard, over the farm', x: -12, z: -10.5, yaw: (-3 * P) / 4, pitch: -0.08, shadow: true },
  { name: 'yard, back at the house', x: 0, z: 12.5, yaw: 0, pitch: 0.02 },
  { name: 'yard, the pasture', x: 9.5, z: -1, yaw: -P / 2, pitch: -0.05 },
  { name: 'yard, behind the house', x: 0, z: -9.5, yaw: P, pitch: 0.05 },
  { name: 'gate, the line', x: 4.2, z: 10.8, yaw: P - 0.5, pitch: -0.05 },
  { name: 'gate, along the line', x: 5.6, z: 12.2, yaw: 1.25, pitch: -0.05 },
  { name: 'yard, the office and the tractor', x: -5, z: 7.9, yaw: P / 2, pitch: -0.05, shadow: true },
]

const inRect = (r: Rect, x: number, z: number, margin = 0) => x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin
/** The yaw that looks from (x, z) towards (tx, tz) (yaw 0 looks north, along −z; π/2 west). */
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z))

/**
 * A walk-in building's poses, made from its row alone (nothing here names one: a new row is posed the same way). In
 * first person: outside, 2.5 m out from its outer door and facing it (with the sun's map); standing in each doorway,
 * looking into each room it opens on; each room from just inside its door, looking across to its far corner. In third
 * person: from that spot outside (its walls must hide what is in it) and from that spot inside its first room, facing
 * the door (the camera behind you held in the room).
 */
function walkInPoses(w: WalkIn) {
  const first: Pose[] = []
  let outside: Pose | null = null
  // each room's way in: the middle of the first door that opens on it, and the way into the room from there
  const ways = new Map<WalkInRoom, { x: number; z: number; dx: number; dz: number }>()
  for (const d of w.doors) {
    const x = (d.x0 + d.x1) / 2
    const z = (d.z0 + d.z1) / 2
    // a door in a wall along x is passed through along z, and the other way round
    const [nx, nz] = d.x1 - d.x0 >= d.z1 - d.z0 ? [0, 1] : [1, 0]
    const side = (s: number) => w.rooms.find((r) => inRect(r, x + nx * s * 0.5, z + nz * s * 0.5)) ?? null
    for (const s of [1, -1]) {
      const room = side(s)
      if (!room) continue
      if (!ways.has(room)) ways.set(room, { x, z, dx: nx * s, dz: nz * s })
      first.push({ name: `${w.id}: in the doorway, into ${room.space}`, x, z, yaw: yawTo(x, z, x + nx * s, z + nz * s), pitch: -0.05 })
      if (!side(-s) && !outside) {
        const ox = x - nx * s * 2.5
        const oz = z - nz * s * 2.5
        outside = { name: `${w.id}: outside, facing its door`, x: ox, z: oz, yaw: yawTo(ox, oz, x, z), pitch: -0.03, shadow: true }
      }
    }
  }
  let inside: (Pose & { room: WalkInRoom }) | null = null
  for (const room of w.rooms) {
    const way = ways.get(room)
    if (!way) continue
    const x = way.x + way.dx * 0.45
    const z = way.z + way.dz * 0.45
    const corners = [
      [room.x0, room.z0],
      [room.x1, room.z0],
      [room.x0, room.z1],
      [room.x1, room.z1],
    ]
    const [cx, cz] = corners.sort((a, b) => Math.hypot(b[0] - x, b[1] - z) - Math.hypot(a[0] - x, a[1] - z))[0]
    first.push({ name: `${w.id}: ${room.space}, from its door across to the far corner`, x, z, yaw: yawTo(x, z, cx, cz), pitch: -0.1 })
    inside ??= { name: `${w.id}: third person in ${room.space}`, x, z, yaw: yawTo(x, z, way.x, way.z), room }
  }
  if (!outside || !inside) throw new Error(`${w.id}: no outer door, or no room with a door`)
  return { first: [outside, ...first], outside: { ...outside, name: `${w.id}: third person outside` }, inside }
}

/** The supermarket's own: from the lane before the garden's gate (open: you stand within 1.8 m of it), at the shelves
 *  along the hall's south wall (with the sun's map), along the aisle between the island and those shelves, and from the
 *  lane before its sliding doors, open (you within 2 m of the doorway: the shop seen through them). */
const GATE_OPEN: Pose = { name: 'market: the gate open, from the lane', x: GATE.x, z: GARDEN.maxZ + 1.3, yaw: 0, pitch: -0.05, wait: 3000 }
const DOORS_OPEN: Pose = { name: 'market: its doors open, from the lane', x: (FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, z: FRONT_DOOR.z0 - 1.6, yaw: P, pitch: -0.05, marketDoor: 1 }
const SHELVES: Pose = { name: 'market: the shelves', x: (SHELF_RUN.x0 + SHELF_RUN.x1) / 2, z: SHELF_RUN.z0 - 1.1, yaw: P, pitch: -0.1, shadow: true }
const AISLE: Pose = { name: 'market: the south aisle', x: HALL.x1 - 0.6, z: (ISLAND.z1 + HALL.z1) / 2, yaw: P / 2, pitch: -0.05 }
const MARKET: Pose[] = [GATE_OPEN, DOORS_OPEN, SHELVES, AISLE]

/** Third person at a pose: the frame compared (the walls hide things far off along the top of the screen: a few more
 *  pixels of the known edge case, each proven), the rooms and the sun not used, the sun's map the same; `walls`: the
 *  walls must leave something out; `room`: the camera must stay inside that room, under its top. */
async function thirdAt(game: Game, p: Pose, log: string[], opts: { walls?: boolean; room?: WalkInRoom } = {}) {
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
    // back in first person: once the camera is home, the pass is back
    await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 30_000, polling: 250 })
  }
}

/** At a pose, the market's interior casters on and off: the same frame, every pixel; and the map did take them in. */
async function castersAt(game: Game, p: Pose, log: string[]) {
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
async function standAt(game: Game, p: Pose) {
  const { page } = game
  await page.evaluate(
    ([x, z, yaw, door]) => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      if (door !== null && s.doors['door-kitchen-bedroom'] !== door) s.toggleDoor('door-kitchen-bedroom')
      // the market's shelves full again (shoppers take what they buy as the poses go on)
      h.farm.marketFill?.('corn')
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
async function compareAt(game: Game, p: Pose, log: string[]) {
  const { page } = game
  await standAt(game, p)
  const r = await page.evaluate((pose) => (window as any).__viewProbe.camera(pose), [p.x, p.y ?? EYE, p.z, p.yaw, p.pitch ?? 0])
  if (r.differ && r.culprits?.length) r.rays = await page.evaluate(behindShell)
  report(log, p.name, r)
  if (r.differ) console.log(log[log.length - 1])
  check(p.name, r)
  expect(r.stats.portals, `${p.name}: the rooms and portals are used in first person`).toBe(true)
  if (p.shadow) {
    const s = await page.evaluate(() => (window as any).__viewProbe.shadow())
    log.push(
      `  sun's shadow map: ${s.before.calls} draws / ${s.before.triangles} triangles → ${s.after.calls} / ${s.after.triangles} (${s.culled} of ${s.casters} casters left out), ${s.differ} bytes differ`,
    )
    expect(s.sun, `${p.name}: the sun's pass is culled in first person`).toBe(true)
    expect(s.culled, `${p.name}: casters under the ceilings left out`).toBeGreaterThan(0)
    expect(s.differ, `${p.name}: the shadow map is the same`).toBe(0)
  }
  return r
}

/** Eye height for the poses (the player's, standing on the floor) */
const EYE = 1.62

function report(log: string[], name: string, r: any) {
  log.push(
    `${name} (${r.size.join('×')}): ${r.before.calls} draws / ${r.before.triangles} triangles → ${r.after.calls} / ${r.after.triangles}; ${r.stats.culled} of ${r.stats.tested} things and ${r.stats.modelsCulled} of ${r.stats.models} crowd models left out (behind a wall: ${r.stats.wallCulled} things, ${r.stats.wallModels} models, of ${r.stats.walls} wall pieces); eye in ${r.cells.start.join(', ') || '-'}, seen ${r.cells.seen.join(', ') || '-'}; ${r.differ} pixels differ${r.differ ? ` ${JSON.stringify(r.pixels)} (${r.culprits?.join('; ')}; across the screen's edge: ${r.straddles}; today drawn at ${r.depths?.join(', ')} m; same with them hidden: ${r.sameAsHidden}; rays ${JSON.stringify(r.rays)})` : ''}`,
  )
}

/** No pixel may differ — but for the one known edge case, proven again: a pixel or two at the edge of the screen
 *  where a thing far behind a wall shows through today, and the pass's frame is exactly today's with those things
 *  hidden. */
function check(name: string, r: any, most = 2) {
  if (r.differ === 0) return
  expect(r.crowds, `${name}: no crowd model left out may show`).toBe(false)
  expect(r.differ, `${name}: ${r.differ} pixels differ at ${JSON.stringify(r.pixels)}`).toBeLessThanOrEqual(most)
  expect(r.culprits?.length, `${name}: what the pass left out there`).toBeGreaterThan(0)
  expect(r.straddles, `${name}: ${r.culprits?.join('; ')} do not reach across an edge of the screen`).toBe(true)
  expect(r.sameAsHidden, `${name}: the pass's frame is today's with ${r.culprits?.join('; ')} hidden`).toBe(true)
  // and what was left out is behind the house's shell (or a walk-in's) there: no ray through those pixels meets it first
  expect(r.rays?.length, `${name}: rays through the pixels`).toBe(r.differ)
  for (const ray of r.rays) expect(ray.behind, `${name}: pixel ${ray.pixel} — ${r.culprits?.join('; ')} at ${ray.thing} m, the shell at ${ray.shell} m`).toBe(true)
}

const routed = new WeakSet<object>()
async function setUp(game: Game) {
  await game.ready()
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

test.describe('the drawing pass leaves out only what cannot be seen', () => {
  test('640×360: every room, its corners and walls, the sun', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of ROOMS) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('640×360: each doorway, the door shut and open', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of DOORWAYS) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('640×360: the garden door both ways, the yard and the gate with a full line', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of OUTSIDE) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('640×360: things carried from room to room, and things left there', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    // the mug, picked up in the kitchen and carried into the bedroom: in your hand, looking down at it
    await page.evaluate(() => (window as any).__home.useHome.getState().pickUp('item-mug'))
    await compareAt(game, { name: 'carrying the mug in the bedroom', x: 3.5, z: 3, yaw: P, pitch: -0.9, shadow: true }, log)
    // put down in the bedroom, seen from the living room through the doorway
    await page.evaluate(() => (window as any).__home.useHome.getState().drop([2.5, 0.3, 3.4]))
    await compareAt(game, { name: 'the mug left in the bedroom, from the living room', x: -1.2, z: 3, yaw: -P / 2 }, log)
    console.log(log.join('\n'))
  })

  test('640×360: every walk-in building — outside facing its door, in its doorways, each room; third person outside and in', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const w of WALK_INS) {
      const poses = walkInPoses(w)
      for (const p of poses.first) await compareAt(game, p, log)
      await thirdAt(game, poses.outside, log, { walls: true })
      await thirdAt(game, poses.inside, log, { room: poses.inside.room })
    }
    console.log(log.join('\n'))
  })

  test("640×360: the supermarket — the gate open from the lane, its shelves, its south aisle; its interior's shadows are never seen", async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    for (const p of MARKET) await compareAt(game, p, log)
    // its fittings and goods cast no shadow: proven unseen, inside, through its open doors and from outside them shut
    expect(await page.evaluate(() => typeof (window as any).__home.market?.casters), '__home.market.casters').toBe('function')
    const market = walkInPoses(WALK_INS.find((w) => w.id === 'market')!)
    for (const p of [SHELVES, AISLE, DOORS_OPEN, ...market.first]) await castersAt(game, p, log)
    console.log(log.join('\n'))
  })

  // The sun's map is drawn again only when something in it changed (Lighting.tsx): your body walking, turning or jumping
  // indoors where no window lets sunlight in is left out of it, so the map is kept. After each thing that happens, the
  // map as the game left it must be a full redraw's, texel for texel (every caster, and the pass on), and so must the
  // frame drawn with it; and the check must see a stale map (your body moved outdoors, the map left as it was).
  test("the sun's map, kept while you move where no sunlight reaches, is always a full redraw's", async ({ game }) => {
    // a dozen places and things that happen, each compared three ways: longer than one room's poses
    test.setTimeout(600_000)
    await setUp(game)
    const { page } = game
    const log: string[] = []
    let last = { drawn: 0, kept: 0 }
    const check = async (name: string) => {
      const r = await page.evaluate(() => (window as any).__viewProbe.kept())
      log.push(
        `${name}: map drawn again on ${r.drawn - last.drawn} frames, kept on ${r.kept - last.kept}; ${r.differ} bytes differ from a full redraw (${r.differAll} with every caster), ${r.pixels} pixels (${r.pixelsAll})`,
      )
      expect(r.differ, `${name}: the map is a full redraw's`).toBe(0)
      expect(r.differAll, `${name}: the map is every caster's`).toBe(0)
      expect(r.pixels, `${name}: the frame drawn with it`).toBe(0)
      expect(r.pixelsAll, `${name}: the frame drawn with every caster's map`).toBe(0)
      const since = { drawn: r.drawn - last.drawn, kept: r.kept - last.kept }
      last = r
      return since
    }
    const at = async (x: number, z: number, yaw: number) => {
      await game.teleport(x, 1.4, z, yaw, 0)
      await page.waitForTimeout(2500)
    }
    const turn = async (by: number) => {
      await page.evaluate((by) => ((window as any).__home.look.yaw += by), by)
      await page.waitForTimeout(1500)
    }
    // turning in the living room: the body moves every frame, the map stays
    await at(-3.5, 1.3, P)
    await check('living room')
    let kept = 0
    for (let i = 0; i < 3; i++) {
      await turn(0.5)
      kept += (await check(`living room, turned ${i + 1}`)).kept
    }
    expect(kept, 'turning indoors keeps the map').toBeGreaterThan(0)
    // walking, then a jump, indoors
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1000)
    await check('walking in the living room')
    await page.keyboard.up('KeyW')
    await page.keyboard.down('Space')
    await page.waitForTimeout(200)
    await page.keyboard.up('Space')
    await check('jumping, in the air')
    await page.waitForTimeout(2000)
    await check('landed')
    // into the sunlight from the kitchen's east window, and turning there; the kitchen's door opened and shut
    await at(3.5, -3, P)
    await check('kitchen')
    await at(5.3, -4.0, -P / 2)
    await check("kitchen, in the east window's sunlight")
    await turn(0.6)
    await check('kitchen, in the sunlight, turned')
    for (const time of ['once', 'twice']) {
      await page.evaluate(() => (window as any).__home.useHome.getState().toggleDoor('door-kitchen-bedroom'))
      await page.waitForTimeout(4000)
      await check(`the kitchen's door moved ${time}`)
    }
    // carrying the mug, then out through the garden door (it opens as you come) into the yard, and turning there
    await page.evaluate(() => (window as any).__home.useHome.getState().pickUp('item-mug'))
    await at(-1.2, 4.6, P)
    await check('carrying the mug, at the garden door')
    await at(-1.2, 8.5, 0)
    await check('the yard')
    await turn(0.6)
    await check('the yard, turned')
    await page.evaluate(() => (window as any).__home.useHome.getState().drop([-1.0, 0.3, 9.0]))
    await page.waitForTimeout(2000)
    await check('the mug dropped in the yard')
    expect(await page.evaluate(() => (window as any).__viewProbe.bodyMoved(0.3)), 'a stale map is seen: the body moved outdoors').toBeGreaterThan(0)
    // third person and back
    await at(-3.5, 1.3, P)
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('third'))
    await page.waitForTimeout(3000)
    await check('third person')
    await turn(0.5)
    await check('third person, turned')
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
    await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 30_000, polling: 250 })
    await page.waitForTimeout(1500)
    await check('first person again')
    expect(await page.evaluate(() => (window as any).__viewProbe.bodyMoved(0.3)), 'indoors, the moved body changes nothing in the map (with every caster)').toBe(0)
    console.log(log.join('\n'))
  })

  test('third person, decorating and the edit mode: the rooms and the sun are not used, the walls are', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    const off = async (name: string, mode: 'third' | 'decorate' | 'edit', x: number, z: number) => {
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
      if (mode === 'third' && x > -7 && x < 7 && z > -6 && z < 6) expect(r.stats.wallCulled + r.stats.wallModels, `${name}: things behind a wall left out`).toBeGreaterThan(0)
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
      // back in first person: once the camera is home and the ceilings are up again, the pass is back
      await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 30_000, polling: 250 })
    }
    await off('third person, the living room', 'third', -3.5, 2.5)
    await off('third person, the office', 'third', -3.5, -2)
    await off('third person, the kitchen', 'third', 3.5, -3)
    await off('third person, the bedroom', 'third', 3.5, 1)
    await off('third person, the yard', 'third', -6, 9)
    await off('decorating the living room', 'decorate', -3.5, 2.5)
    await off('the edit mode over the farm', 'edit', 2, 9)
    console.log(log.join('\n'))
  })

  test('a phone held upright (390×844): rooms, the door, the garden door, the yard, the gate and the market', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await page.waitForFunction(() => (window as any).__home.gl.domElement.height > (window as any).__home.gl.domElement.width, null, { timeout: 30_000 })
      await page.waitForTimeout(1500)
      const poses = [ROOMS[0], ROOMS[2], ROOMS[4], ROOMS[6], DOORWAYS[4], DOORWAYS[6], OUTSIDE[0], OUTSIDE[2], OUTSIDE[3], OUTSIDE[4], OUTSIDE[7], SHELVES]
      for (const p of poses) await compareAt(game, { ...p, name: `phone: ${p.name}`, shadow: p === ROOMS[0] }, log)
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
      await page.waitForTimeout(1500)
    }
    console.log(log.join('\n'))
  })

  test('the hedge and the woods in pieces: the same frame and sun as one mesh each, built again when land is bought', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    /** At a pose (the player there, the camera set by hand): the land drawn both ways, every pixel and texel the same. */
    const landAt = async (p: Pose) => {
      await page.evaluate(
        ([x, z, yaw]) => {
          const h = (window as any).__home
          h.teleport(x, 1.4, z)
          if (typeof h.look === 'function') h.look({ yaw, pitch: 0 })
          else {
            h.look.yaw = yaw
            h.look.pitch = 0
          }
        },
        [p.x, p.z, p.yaw],
      )
      await page.waitForFunction(([x, z]) => Math.hypot((window as any).__home.camera.position.x - x, (window as any).__home.camera.position.z - z) < 1.2, [p.x, p.z], {
        timeout: 60_000,
        polling: 250,
      })
      const r = await page.evaluate((pose) => (window as any).__viewProbe.land(pose), [p.x, p.y ?? EYE, p.z, p.yaw, p.pitch ?? 0])
      log.push(
        `${p.name} (${r.size.join('×')}): one mesh each ${r.whole.calls} draws / ${r.whole.triangles} triangles, in pieces ${r.pieces.calls} / ${r.pieces.triangles} (camera and sun); ${r.differ} pixels and ${r.texels} sun texels differ${r.differ ? ` ${JSON.stringify(r.pixels)}` : ''}`,
      )
      expect(r.differ, `${p.name}: pixels ${JSON.stringify(r.pixels)}`).toBe(0)
      expect(r.texels, `${p.name}: the sun's map`).toBe(0)
      return r
    }
    // from the yard, at the gate and out of the garden door (the portals leave out what the doorway does not show)
    const poses = [OUTSIDE[3], OUTSIDE[4], OUTSIDE[7], OUTSIDE[0], ROOMS[0]]
    for (const p of poses) await landAt(p)

    // buying the north meadow moves the hedge and the woods out round it: the pieces are built again and the old ones let
    // go of (each geometry disposed)
    const old = await page.evaluate(() => {
      const w = window as any
      const h = w.__home
      w.__landDisposed = 0
      const pieces = h.land.pieces()
      for (const m of pieces) m.geometry.addEventListener('dispose', () => w.__landDisposed++)
      h.farm.state.coins += 1000
      return { pieces: pieces.length, bought: h.farm.buyLand('north') }
    })
    expect(old.bought).toBe(true)
    await page.waitForFunction((n) => (window as any).__landDisposed === n, old.pieces, { timeout: 30_000, polling: 250 })
    const now = await page.evaluate(() =>
      (window as any).__home.land.pieces().map((m: any) => {
        m.geometry.computeBoundingBox()
        const b = m.geometry.boundingBox
        return { name: m.name, box: [b.min.x, b.min.z, b.max.x, b.max.z] }
      }),
    )
    log.push(`the north meadow bought: ${old.pieces} pieces let go, ${now.length} built`)
    const hedges = now.filter((p: any) => p.name === 'hedge')
    // the hedge along the meadow's north edge (z = −25), none left along the garden's (z = −13)
    expect(hedges.some((p: any) => p.box[3] < -24 && p.box[1] > -25.6)).toBe(true)
    expect(hedges.some((p: any) => p.box[3] - p.box[1] < 1.5 && Math.abs((p.box[1] + p.box[3]) / 2 + 13) < 0.6)).toBe(false)
    // no tree stands on the meadow
    for (const c of now.filter((p: any) => p.name === 'crown')) {
      const [x, z] = [(c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2]
      expect(x > -14 && x < 14 && z > -25 && z < -13, `a tree at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(false)
    }
    // and the new pieces draw the same as one mesh too
    for (const p of [OUTSIDE[3], { name: 'the north meadow, looking north', x: 0, z: -16, yaw: 0, pitch: -0.05 }]) await landAt(p)
    console.log(log.join('\n'))
  })

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
