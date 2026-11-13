// The screens the lab shows a design on, at their own size in CSS pixels, with their safe areas (what the notch, the
// rounded corners and the home bar take: given to the game's CSS in place of env(safe-area-inset-*), and drawn over
// the frame). A phone upright and sideways are every board's; the others are asked for (Board.devices) or switched on
// in the lab's bar.

export const DEVICES = {
  upright: { w: 390, h: 844, name: 'טלפון לאורך', safe: { top: 47, right: 0, bottom: 34, left: 0 }, touch: true, most: 270 },
  sideways: { w: 844, h: 390, name: 'טלפון לרוחב', safe: { top: 0, right: 47, bottom: 21, left: 47 }, touch: true, most: 620 },
  small: { w: 375, h: 667, name: 'טלפון קטן', safe: { top: 20, right: 0, bottom: 0, left: 0 }, touch: true, most: 250 },
  tablet: { w: 820, h: 1180, name: 'טאבלט', safe: { top: 24, right: 0, bottom: 20, left: 0 }, touch: true, most: 400 },
  desktop: { w: 1280, h: 800, name: 'מחשב', safe: { top: 0, right: 0, bottom: 0, left: 0 }, touch: false, most: 620 },
} as const

export type DeviceId = keyof typeof DEVICES
export const DEVICE_IDS = Object.keys(DEVICES) as DeviceId[]
