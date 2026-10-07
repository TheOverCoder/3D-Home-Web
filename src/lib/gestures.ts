// Tiny event bus: gameplay code asks the avatar to play a one-shot gesture (pick up, press a button...).
export type Gesture = 'interact' | 'pickup'
type Listener = (gesture: Gesture) => void

const listeners = new Set<Listener>()

export function playGesture(gesture: Gesture) {
  listeners.forEach((l) => l(gesture))
}

export function onGesture(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
