import { create } from 'zustand'
import { profile } from './profile'
import { swControlling } from './sw'

// The loading screen's facts: what the 3D part of the game needs to download, how much of it has arrived, how
// fast, and how long is left. The build writes a manifest of those files (vite.config.ts → assets-manifest.json);
// this fetches them up front with a progress count, through the service worker, which keeps them on the device —
// so the next visit loads from the phone or computer itself instead of the network. Only after that does the app
// import the 3D engine, which then finds every file already here. No three.js in this file.

export type LoadPhase = 'download' | 'prepare' | 'compile' | 'ready'
export type FileStatus = 'waiting' | 'loading' | 'done' | 'cached' | 'failed'

export interface LoadFile {
  url: string
  label: string
  kind: 'code' | 'model' | 'hdr' | 'texture' | 'other'
  bytes: number
  loaded: number
  status: FileStatus
}

interface LoaderState {
  phase: LoadPhase
  files: LoadFile[]
  total: number
  loaded: number
  fromDevice: number // bytes that came from this device's cache, not the network
  speed: number // bytes per second, smoothed
  startedAt: number
  downloadedAt: number // when the downloads finished (ms since page start)
  readyAt: number // when everything was ready
  compile: number // 0..1 while the graphics warm up
  offline: boolean
}

export const useLoader = create<LoaderState>(() => ({
  phase: 'download',
  files: [],
  total: 0,
  loaded: 0,
  fromDevice: 0,
  speed: 0,
  startedAt: performance.now(),
  downloadedAt: 0,
  readyAt: 0,
  compile: 0,
  offline: typeof navigator !== 'undefined' && navigator.onLine === false,
}))

export const setLoadPhase = (phase: LoadPhase) =>
  useLoader.setState((s) => (s.phase === phase ? s : { phase, readyAt: phase === 'ready' ? performance.now() : s.readyAt }))

interface Manifest {
  version: string
  files: { url: string; bytes: number; kind: LoadFile['kind']; label: string }[]
}

const BASE = import.meta.env.BASE_URL
const abs = (url: string) => new URL(url, location.origin + BASE).href

async function inDeviceCache(url: string) {
  try {
    return typeof caches !== 'undefined' && !!(await caches.match(url))
  } catch {
    return false
  }
}

let windowBytes = 0
let windowStart = 0
function count(bytes: number) {
  const now = performance.now()
  if (!windowStart) windowStart = now
  windowBytes += bytes
  useLoader.setState((s) => ({ loaded: s.loaded + bytes }))
  // the rate over the last moment or so, smoothed: an honest "MB/s" and time left
  if (now - windowStart > 400) {
    const rate = (windowBytes * 1000) / (now - windowStart)
    useLoader.setState((s) => ({ speed: s.speed ? s.speed * 0.6 + rate * 0.4 : rate }))
    windowBytes = 0
    windowStart = now
  }
}

const patch = (url: string, change: Partial<LoadFile>) =>
  useLoader.setState((s) => ({ files: s.files.map((f) => (f.url === url ? { ...f, ...change } : f)) }))

async function download(file: LoadFile) {
  patch(file.url, { status: 'loading' })
  // a phone's connection can stall without failing: give up on a file after 25 s without a byte (the scene's
  // own loaders ask for it again), rather than hold the whole start
  const abort = new AbortController()
  let idle = window.setTimeout(() => abort.abort(), 25_000)
  const alive = () => {
    window.clearTimeout(idle)
    idle = window.setTimeout(() => abort.abort(), 25_000)
  }
  try {
    const res = await fetch(abs(file.url), { signal: abort.signal })
    if (!res.ok) throw new Error(`${res.status}`)
    if (!res.body) {
      await res.arrayBuffer()
      count(file.bytes)
      patch(file.url, { status: 'done', loaded: file.bytes })
      return
    }
    const reader = res.body.getReader()
    let got = 0
    let shown = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      alive()
      // the server may send it compressed: count against the file's size, never past it
      const step = Math.min(value.byteLength, Math.max(0, file.bytes - got))
      got += value.byteLength
      if (step) count(step)
      const now = performance.now()
      if (now - shown > 120) {
        shown = now
        patch(file.url, { loaded: Math.min(file.bytes, got) })
      }
    }
    if (got < file.bytes) count(file.bytes - got) // compressed transfer: the rest is accounted as arrived
    patch(file.url, { status: 'done', loaded: file.bytes })
  } catch (e) {
    patch(file.url, { status: 'failed' })
    console.warn('[loader] could not fetch', file.url, e)
  } finally {
    window.clearTimeout(idle)
  }
}

let started: Promise<void> | null = null

/** Downloads everything the 3D scene will ask for (once), reporting progress in `useLoader`. Never rejects. */
export function preload(): Promise<void> {
  started ??= (async () => {
    useLoader.setState({ startedAt: performance.now() })
    let manifest: Manifest | null = null
    try {
      // the service worker takes over the page on its first visit too, so the downloads below land in its cache
      await swControlling(2500)
      const res = await fetch(`${BASE}assets-manifest.json`, { cache: 'no-cache', signal: AbortSignal.timeout?.(8000) })
      if (res.ok) manifest = (await res.json()) as Manifest
    } catch {
      /* offline with no cache, or the dev server: the scene's own loaders fetch what they need */
    }
    if (!manifest) {
      useLoader.setState({ downloadedAt: performance.now(), phase: 'prepare' })
      return
    }
    // light graphics never use the HDR sky or the photographed textures: do not fetch them
    const wanted = manifest.files.filter((f) => !(profile.light && (f.kind === 'hdr' || f.kind === 'texture')))
    const files: LoadFile[] = wanted.map((f) => ({ ...f, loaded: 0, status: 'waiting' }))
    useLoader.setState({ files, total: files.reduce((n, f) => n + f.bytes, 0) })
    // what this device already keeps needs no network at all
    const cached = await Promise.all(files.map((f) => inDeviceCache(abs(f.url))))
    let fromDevice = 0
    files.forEach((f, i) => {
      if (cached[i]) fromDevice += f.bytes
    })
    useLoader.setState((s) => ({
      fromDevice,
      loaded: fromDevice,
      files: s.files.map((f, i) => (cached[i] ? { ...f, status: 'cached', loaded: f.bytes } : f)),
    }))
    // the rest: biggest first, a few at a time (phones open few connections at once; big files set the pace)
    const queue = files.filter((_, i) => !cached[i]).sort((a, b) => b.bytes - a.bytes)
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) await download(f)
    })
    await Promise.all(workers)
    useLoader.setState({ downloadedAt: performance.now(), phase: 'prepare' })
  })()
  return started
}

/** Seconds left at the current speed, or null while that is not known yet. */
export function secondsLeft(s: LoaderState): number | null {
  const left = s.total - s.loaded
  if (left <= 0) return 0
  if (s.speed < 1) return null
  return left / s.speed
}

export const mb = (bytes: number) => (bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)
