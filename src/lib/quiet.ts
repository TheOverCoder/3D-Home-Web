// What runs by itself in play — the week's events, a new farm's first steps, the locks of the levels, and from update v1
// the season road, the neighbours, the market's mood, the seasons' looks and the weather — is quiet where the game is
// tested (update-v1/CONTRACTS.md §1.3): under Vitest, and on a ?debug page unless the page asks for it by name
// (`&events=on`). A test that wants one turns it on with that system's own switch. Today three systems each write this
// function; this is its one home (08 moves them onto it). Pure at its core; `onHere` reads the page.

/** Whether something that runs by itself in play is on by default: on in play; off under Vitest; off on a ?debug page
 *  unless the page says `&<param>=on`. `search`: the page's query (null where there is no page: on). */
export function onInPlay(param: string, env: { test: boolean; search: string | null }): boolean {
  if (env.test) return false
  if (env.search === null) return true
  const q = new URLSearchParams(env.search)
  return !q.has('debug') || q.get(param) === 'on'
}

/** The same for this page. */
export function onHere(param: string): boolean {
  return onInPlay(param, { test: import.meta.env.MODE === 'test', search: typeof location === 'undefined' ? null : location.search })
}
