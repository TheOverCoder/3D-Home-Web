// Dev / `?debug` only: lets tests and the console reach into the running scene via window.__home.
export function debugSet(key: string, value: unknown) {
  const hook = (window as unknown as { __home?: Record<string, unknown> }).__home
  if (hook) hook[key] = value
}
