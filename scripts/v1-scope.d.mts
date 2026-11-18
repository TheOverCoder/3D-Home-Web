// Types for scripts/v1-scope.mjs, so its unit test (src/v1Scope.test.ts) type-checks.
export interface Touch {
  path: string
  how: string
}
export interface Row {
  phase: number
  owns: string[]
  touch: Touch[]
}
export interface Owners {
  base: string
  never: string[]
  anyone: Touch[]
  hot: string[]
  agents: Record<string, Row>
}
export interface Scope {
  owned: string[]
  touched: { file: string; how: string }[]
  anyone: { file: string; how: string }[]
  outside: string[]
  never: string[]
}
export function globToRegExp(glob: string): RegExp
export function matches(path: string, glob: string): boolean
export function besides(path: string): string[]
export function scope(files: string[], owners: Owners, agent: string): Scope
export function hotFiles(files: string[], owners: Owners): string[]
export function agentOf(branch: string, ids: string[], configured?: string | null): string | null
export function report(result: Scope, meta: { agent: string; branch: string; base: string; count: number; hot?: string[] }): string
