// What this device gets: one place that decides the graphics budget per kind of device, so the phone build and the
// desktop build are tuned separately and new features read their limits from here instead of guessing.
// Plain data, no three.js: the page shell (intro, loader) imports it before the 3D engine has downloaded.
import type { Quality } from '../store'

export type DeviceClass = 'phone' | 'tablet' | 'desktop'

/** Per quality tier (the frame-rate governor moves between tiers; the profile says what a tier means here). */
type PerTier<T> = Record<Quality, T>

export interface Profile {
  device: DeviceClass
  /** a phone or tablet with little memory (≤ 4 GB) or few cores: start lighter, keep textures small */
  lowMemory: boolean
  /** the lightest settings: chosen by the player, or used after the graphics failed to start */
  light: boolean
  /** a tier to start on before the frame-rate governor has measured anything */
  startQuality: Quality
  /** pixels per CSS pixel (capped by the screen's own ratio) */
  dpr: PerTier<number>
  /** multisampling in the post-processing chain (0 = none) */
  msaa: PerTier<number>
  /** ambient occlusion: off, or N8AO's quality */
  ao: PerTier<false | 'performance' | 'medium'>
  /** the sun's shadow map, texels per side */
  shadowMap: PerTier<number>
  bloomLevels: PerTier<number>
  /** depth of field and the lens fringe on the highest tier */
  lensEffects: boolean
  /** generated surfaces (wood, tile, fabric…): texels per side */
  surfaceSize: number
  /** downloaded textures (and those inside models) are scaled down to at most this many texels per side */
  maxTexture: number
  /** image-based lighting from the HDR file (else a small generated sky probe, far less memory) */
  hdri: boolean
  powerPreference: WebGLPowerPreference
}

const LIGHT_KEY = '3d-home:light:v1'

function detectDevice(): { device: DeviceClass; lowMemory: boolean } {
  if (typeof window === 'undefined') return { device: 'desktop', lowMemory: false }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const fine = window.matchMedia?.('(any-pointer: fine)').matches ?? false
  const ua = navigator.userAgent
  const mobileUa = /Android|iPhone|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(ua)
  const ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const short = Math.min(screen.width, screen.height)
  let device: DeviceClass = 'desktop'
  if (coarse && !fine) device = short >= 600 || ipad ? 'tablet' : 'phone'
  else if (mobileUa) device = 'phone'
  else if (ipad) device = 'tablet'
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency ?? 8
  const lowMemory = device !== 'desktop' && ((memory !== undefined && memory <= 4) || cores <= 4)
  return { device, lowMemory }
}

/** The player's (or the last failed start's) choice of the lightest settings, kept between visits. */
export function lightModeWanted(): boolean {
  try {
    if (new URLSearchParams(location.search).has('light')) return true
    const v = localStorage.getItem(LIGHT_KEY)
    return v === '1' || v === 'auto'
  } catch {
    return false
  }
}

/** Light graphics were switched on by a start that ran short of graphics memory (not by the player). */
export function lightModeAutomatic(): boolean {
  try {
    return localStorage.getItem(LIGHT_KEY) === 'auto'
  } catch {
    return false
  }
}

export function setLightMode(on: boolean, automatic = false) {
  try {
    if (on) localStorage.setItem(LIGHT_KEY, automatic ? 'auto' : '1')
    else localStorage.removeItem(LIGHT_KEY)
  } catch {
    /* storage blocked: for this visit only */
  }
}

const DESKTOP: Omit<Profile, 'device' | 'lowMemory' | 'light' | 'startQuality'> = {
  dpr: { high: 1.5, medium: 1.25, low: 1 },
  msaa: { high: 4, medium: 2, low: 0 },
  ao: { high: 'medium', medium: 'performance', low: false },
  shadowMap: { high: 2048, medium: 2048, low: 1024 },
  bloomLevels: { high: 8, medium: 6, low: 5 },
  lensEffects: true,
  surfaceSize: 512,
  maxTexture: 2048,
  hdri: true,
  powerPreference: 'high-performance',
}

// Phones and tablets: the screen is small and sharp, so fewer texels go a long way, while memory and heat are
// the real limits — a browser that runs out of graphics memory drops the whole 3D context (a blank or
// "graphics reset" screen). Multisampling and AO buffers, the 2k shadow map and 512² generated surfaces were
// the biggest spends; they shrink here, the look stays.
const MOBILE: typeof DESKTOP = {
  dpr: { high: 1.5, medium: 1.25, low: 1 },
  msaa: { high: 2, medium: 0, low: 0 },
  ao: { high: 'performance', medium: false, low: false },
  shadowMap: { high: 2048, medium: 1024, low: 1024 },
  bloomLevels: { high: 6, medium: 5, low: 4 },
  lensEffects: false,
  surfaceSize: 256,
  maxTexture: 1024,
  hdri: true,
  powerPreference: 'default',
}

export function makeProfile(device: DeviceClass, lowMemory: boolean, light: boolean): Profile {
  const base = device === 'desktop' ? DESKTOP : MOBILE
  const startQuality: Quality = light ? 'low' : device === 'desktop' ? 'high' : lowMemory ? 'low' : 'medium'
  const p: Profile = { ...base, device, lowMemory, light, startQuality }
  if (lowMemory) p.maxTexture = 512
  if (light) {
    // the lightest start that still looks like the house: every tier behaves like "low", small textures, no HDR
    p.dpr = { high: 1, medium: 1, low: 1 }
    p.msaa = { high: 0, medium: 0, low: 0 }
    p.ao = { high: false, medium: false, low: false }
    p.shadowMap = { high: 1024, medium: 1024, low: 1024 }
    p.bloomLevels = { high: 4, medium: 4, low: 4 }
    p.lensEffects = false
    p.surfaceSize = 256
    p.maxTexture = 512
    p.hdri = false
    p.powerPreference = 'default'
  }
  return p
}

const detected = detectDevice()

/** This device's profile; replaced (before the scene mounts again) when the graphics restart in light mode. */
export let profile: Profile = makeProfile(detected.device, detected.lowMemory, lightModeWanted())

/** Switches to (or from) the lightest settings for the next start of the 3D scene. */
export function switchLightProfile(on: boolean, automatic = false) {
  setLightMode(on, automatic)
  profile = makeProfile(detected.device, detected.lowMemory, on)
}

export const deviceLabel = () => `${profile.device === 'phone' ? 'Phone' : profile.device === 'tablet' ? 'Tablet' : 'Computer'}${profile.light ? ' · light graphics' : ''}`
