// Ten times the farm, for measuring only (`?debug&stress=10`, tests/e2e/05-budget): k times today's most of everyone —
// buyers in rows along the lane, cows in the east meadow, sheep behind the house, hens in the west — drawn with the
// game's own models and crowds (`Parts`, so the drawing pass culls them like any other), walking in place. Loaded
// lazily by src/farm/Garden.tsx only with `?debug`: a chunk of its own (`dev-stress`) that players never download and
// the service worker never keeps.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { debugSet } from '../lib/debug'
import { chickenParts, putChicken } from '../models/chicken'
import { cowParts, putCow } from '../models/cow'
import { PersonRig, personParts } from '../models/person'
import { putSheep, sheepParts } from '../models/sheep'

/** `n` spots in a grid of `cols` columns over a rectangle, a little off the grid, each with a heading. */
const grid = (n: number, x0: number, x1: number, z0: number, z1: number, cols: number) =>
  Array.from({ length: n }, (_, i) => {
    const rows = Math.ceil(n / cols)
    const c = i % cols
    const r = Math.floor(i / cols)
    return [x0 + ((c + 0.5) / cols) * (x1 - x0) + Math.sin(i * 7.1) * 0.15, z0 + ((r + 0.5) / rows) * (z1 - z0) + Math.cos(i * 3.3) * 0.15, i * 2.39]
  })

export default function Stress({ k }: { k: number }) {
  // today's most: fifteen buyers in line, three cows, four sheep, six hens
  const n = useMemo(() => ({ people: 15 * k, cows: 3 * k, sheep: 4 * k, hens: 6 * k }), [k])
  const crowds = useMemo(() => ({ people: personParts(n.people), cows: cowParts(Math.ceil(n.cows / 3)), sheep: sheepParts(n.sheep), hens: chickenParts(n.hens) }), [n])
  const spots = useMemo(
    () => ({
      people: grid(n.people, -12, 13, 15.3, 18.2, 30),
      cows: grid(n.cows, 16, 26, -10, 10, 5),
      sheep: grid(n.sheep, -12, 12, -24, -15, 10),
      hens: grid(n.hens, -26, -16, -6, 6, 8),
    }),
    [n],
  )
  const rigs = useMemo(
    () =>
      spots.people.map(
        (_, i) =>
          new PersonRig({
            shirt: ['#c0503a', '#3a6ea5', '#7a9a3a', '#e0b040'][i % 4],
            trousers: ['#2e3a4a', '#5a4632', '#3a3a3a'][i % 3],
            skin: ['#f1c6a0', '#c68a5e', '#8a5a3a'][i % 3],
            hair: ['#2a1d14', '#7a4a20', '#d9b36a'][i % 3],
            hairStyle: i % 3,
            hat: i % 4 === 0,
            height: 0.92 + (i % 5) * 0.03,
          }),
      ),
    [spots],
  )
  useEffect(() => {
    debugSet('stress', { k, n, ...crowds })
    return () => {
      for (const c of Object.values(crowds)) c.dispose()
    }
  }, [k, n, crowds])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const { people, cows, sheep, hens } = crowds
    people.begin()
    spots.people.forEach(([x, z, h], i) => {
      const rig = rigs[i]
      const f = t * 5 + i
      rig.root.position.set(x, 0, z)
      rig.root.rotation.y = h
      rig.thighL.rotation.x = -Math.sin(f) * 0.4
      rig.thighR.rotation.x = Math.sin(f) * 0.4
      rig.armL.rotation.x = Math.sin(f) * 0.3
      rig.armR.rotation.x = -Math.sin(f) * 0.3
      rig.write(people)
    })
    people.end()
    cows.begin()
    spots.cows.forEach(([x, z, h], i) => putCow(cows, i, x, z, h, { phase: t * 3 + i, stride: 0.6, graze: (i % 2) * 0.8, tail: t * 2 + i, chew: t * 5 + i }))
    cows.end()
    sheep.begin()
    spots.sheep.forEach(([x, z, h], i) => putSheep(sheep, i, x, z, h, { phase: t * 3 + i, stride: 0.5, graze: (i % 2) * 0.8, wool: 0.4 + (i % 3) * 0.3, chew: t * 6 + i }))
    sheep.end()
    hens.begin()
    // the crowd has room for one rooster: the first, and hens all the rest
    spots.hens.forEach(([x, z, h], i) => putChicken(hens, i === 0, i, x, z, h, { phase: t * 6 + i, stride: 0.5, peck: (i % 3) * 0.4 }))
    hens.end()
  })
  return (
    <group name="stress">
      <primitive object={crowds.people.group} />
      <primitive object={crowds.cows.group} />
      <primitive object={crowds.sheep.group} />
      <primitive object={crowds.hens.group} />
    </group>
  )
}
