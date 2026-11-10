// Easing towards a target the same way however the frames fall, for angles: three's MathUtils.damp eases a value
// (x + (target - x) * (1 - e^(-k·dt))); a heading also has to go the short way round.

/** An angle in −π … π. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Turns a heading towards `to` the short way round, at rate `k` per second (MathUtils.damp for angles). */
export const dampAngle = (from: number, to: number, k: number, dt: number) => from + wrapAngle(to - from) * (1 - Math.exp(-k * dt))
