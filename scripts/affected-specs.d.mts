// Types for scripts/affected-specs.mjs, so src/ci.test.ts can use it.
export interface Area {
  name: string
  paths: string[]
  specs: string[]
  final?: boolean
  fallback?: boolean
  all?: boolean
  self?: boolean
}
export interface Areas {
  about: string
  smoke: string[]
  heavy: Record<string, string>
  nightly: string[]
  areas: Area[]
}
export interface Affected {
  specs: Map<string, string[]>
  all: string[]
  fallback: string[]
  unknown: string[]
}
export function globToRegExp(glob: string): RegExp
export function loadAreas(root?: string): Areas
export function specFiles(root?: string): string[]
export function resolveSpec(ref: string, files: string[]): string[]
export function kindOf(file: string, map: Areas): { kind: 'run' | 'nightly' } | { kind: 'heavy'; grep: string }
export function affected(paths: string[], map: Areas, files: string[]): Affected
