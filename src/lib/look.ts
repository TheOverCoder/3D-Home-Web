// First-person view direction. Plain numbers so the entry chunk can import it without three.js.
// Camera forward is (-sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch)); yaw = PI looks south (+z).
export const look = { yaw: Math.PI, pitch: -0.04 }

const LIMIT = 1.45
export function addLook(dx: number, dy: number, sensitivity = 0.0022) {
  look.yaw -= dx * sensitivity
  look.pitch = Math.max(-LIMIT, Math.min(LIMIT, look.pitch - dy * sensitivity))
}
