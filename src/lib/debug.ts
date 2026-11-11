// Dev / `?debug` only: lets tests and the console reach into the running scene via window.__home.
export function debugSet(key: string, value: unknown) {
  const hook = (window as unknown as { __home?: Record<string, unknown> }).__home
  if (hook) hook[key] = value
}

const query = typeof location === 'undefined' ? null : new URLSearchParams(location.search)

/** A test's switch in the address (`?debug&stress=10`): read only with `?debug`, so a player's address changes nothing.
 *  Null when it is not there. */
export function debugFlag(name: string): string | null {
  return query?.has('debug') ? query.get(name) : null
}
