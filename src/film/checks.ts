import { shotAt, timeline, type Film } from './format'
import { gap, BODY_RADIUS, solidsOf } from './solids'
import { memberAt } from './stage'

// What a film breaks that only its set can tell (lab/FILM.md: what goes wrong in pictures, caught before the
// pictures): someone walking or standing in a wall, a desk, the fence or the tool (the walks go round them by
// themselves, ./solids.ts: what is left is a mark inside one, or a way with no way round); two people, or a person and
// an animal, walking through each other; a shot framing someone who is not on stage; a line said by someone who is
// not. Each is said once, at the first moment it happens. Empty when it
// keeps them. The lab's player and its picture tool print them (lab/films/moments.mjs), and the films' tests hold them
// at none.

const STEP = 0.05

export function lintStage(film: Film): string[] {
  const tl = timeline(film)
  const out: string[] = []
  const said = new Set<string>()
  const say = (key: string, text: string) => {
    if (said.has(key)) return
    said.add(key)
    out.push(text)
  }
  const ids = Object.keys(film.cast)
  const animal = (id: string) => {
    const look = film.cast[id].look
    return typeof look === 'object' && 'herd' in look
  }
  const radius = (id: string) => (animal(id) && film.herd ? BODY_RADIUS[film.herd] : BODY_RADIUS.person)
  for (let t = 0; t <= tl.length; t += STEP) {
    const at = shotAt(tl, t)
    const w = tl.world(t)
    const solids = solidsOf(at.scene.place, film.herd)
    const now = ids.map((id) => ({ id, m: memberAt(tl, id, w) }))
    for (const { id, m } of now) {
      // (up on something — a hen in her nest, the rooster on a post — is on it, not in it)
      if (!m.visible || m.y > 0.2) continue
      const r = radius(id)
      for (const s of solids) if (gap(m, s) < r * 0.5) say(`${id}|${s.name}`, `${film.cast[id].name} is in ${s.name} at ${t.toFixed(1)} s`)
    }
    for (let i = 0; i < now.length; i++)
      for (let j = i + 1; j < now.length; j++) {
        const a = now[i]
        const b = now[j]
        // (a herd jostles: animals may touch)
        if (!a.m.visible || !b.m.visible || (animal(a.id) && animal(b.id)) || a.m.y > 0.2 || b.m.y > 0.2) continue
        const moving = a.m.pose.walk > 0 || b.m.pose.walk > 0
        if (moving && Math.hypot(a.m.x - b.m.x, a.m.z - b.m.z) < (radius(a.id) + radius(b.id)) * 0.85)
          say(`${a.id}|${b.id}`, `${film.cast[a.id].name} and ${film.cast[b.id].name} walk through each other at ${t.toFixed(1)} s`)
      }
  }
  for (const s of tl.shots) {
    const w = tl.world(s.start + s.shot.len / 2)
    for (const who of [s.shot.cam.on].flat())
      if (film.cast[who] && !memberAt(tl, who, w).visible) say(`frame|${s.index}|${who}`, `shot ${s.index + 1} frames ${film.cast[who].name}, who is not on stage`)
  }
  for (const l of tl.lines)
    if (film.cast[l.item.who] && !memberAt(tl, l.item.who, tl.world(l.t + 0.1)).visible) out.push(`"${l.item.text}" is said by ${film.cast[l.item.who].name}, who is not on stage`)
  return out
}
