// Types for scripts/ci-shards.mjs, so src/ci.test.ts can use it.
export interface Times {
  about: string
  newFile: number
  seconds: Record<string, number>
  /** the night's: every test, the @full ones included */
  full: Record<string, number>
}
export interface Shard {
  files: string[]
  seconds: number
}
export function loadTimes(root?: string): Times
export function nightTimes(times: Times): Times
export function deal(seconds: Record<string, number>, files: string[], n: number, newFile: number): Shard[]
export function problems(times: Times, files: string[], n: number, mostMinutes: number): string[]
