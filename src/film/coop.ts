import type { ToolStyle } from '../models/tools'
import type { Film } from './format'
import { beats, build, carryIn, hero, reaction, setDown } from './kit'
import { toolEnd } from './tools'

// "One Nest Each": the coop bought in the farm shop (plans/animal-tools.md: the hens' tool, a nest for every hen; on
// the farm today the six share one nest box). A film of the style the player chose for it (src/models/tools.ts).
//
// The turn: at the start six hens fight over one nest box and the player gets pecked for an egg; at the end each hen
// sits in a nest of her own, at a snap of the player's fingers, and the eggs wait in a row.
// Logline: the contractor bets six new nests won't stop six hens fighting over one; they prove him right, until the
// player snaps his fingers.
// Who doubts: the contractor ("Six nests? They'll want the same one." — and they do: "Told you."). The rule of three:
// the scrum at the old box, the scrum at the new coop's first nest, and the third time the snap breaks it. The callback:
// the farm's own numbers (6 hens, 1 nest box, as the farm has it) and its rooster's crow. The angle swaps: the
// contractor from below when he is right, from above when the hens hop in. The button: the rooster, who sat on the gate
// post through all of it, comes down in slow motion, shot from the ground as the shop film's hero was; the iris closes
// on him, and he crows inside it. What the player got: the coop, six nests, the build's XP, its two ladders' first steps.
// Where: the pen's set (./set.ts, PEN), in front of its fence, filmed from the lane's side, the woods behind; morning.

export function coopFilm(style: ToolStyle = 'a'): Film {
  const hens = [1, 2, 3, 4, 5, 6].map((k) => `h${k}`)
  return {
    id: 'coop',
    title: 'One Nest Each',
    logline: 'The contractor bets six new nests won’t stop six hens fighting over one; they prove him right, until the player snaps his fingers.',
    turn: 'Six hens fight over one nest box and you get pecked for an egg; at the end, at a snap, each sits in a nest of her own and the eggs wait in a row.',
    herd: 'hens',
    style,
    cast: {
      you: { name: 'You', look: 'player', at: 'wait' },
      guy: { name: 'Contractor', look: 'contractor', at: 'east', off: true },
      roo: { name: 'Rooster', look: { herd: 0 }, at: 'perch' },
      h1: { name: 'Hen', look: { herd: 1 }, at: 'old-nest' },
      h2: { name: 'Hen', look: { herd: 2 }, at: 'huddle-0' },
      h3: { name: 'Hen', look: { herd: 3 }, at: 'huddle-1' },
      h4: { name: 'Hen', look: { herd: 4 }, at: 'huddle-2' },
      h5: { name: 'Hen', look: { herd: 5 }, at: 'huddle-3' },
      h6: { name: 'Hen', look: { herd: 6 }, at: 'huddle-4' },
    },
    props: {
      old: { kind: 'nestbox', on: 'old-nest', show: '0' },
      crate: { kind: 'crate', on: 'guy' },
      tool: { kind: 'tool', on: 'tool', open: 0, show: '0' },
    },
    scenes: [
      {
        place: 'pen',
        light: 'morning',
        line: ['you', 'guy'],
        side: -1,
        shots: [
          {
            // say where: seven birds at one nest box, feathers flying, you waiting for an egg, the rooster on the post
            len: 2.8,
            cam: { on: ['nests', 'you'], from: 20, size: 'wide', angle: 'high', move: 'push' },
            caption: '6 hens. 1 nest.',
            do: [
              { at: 0, who: 'you', pose: 'hips' },
              { at: 0.4, who: 'h3', to: 'huddle-5', pace: 0.9 },
              { at: 0.9, who: 'h5', to: 'huddle-1', pace: 1.0 },
              { at: 1.5, who: 'h4', to: 'huddle-6', pace: 0.9 },
            ],
            hear: [{ at: 0, music: 'tension' }, ...beats(0.3, 0.55, 5, 'cluck')],
            fx: [{ at: 0.7, fx: 'feathers', on: 'old' }],
          },
          {
            // the scrum, close: one hops in, the one in it is pushed out
            len: 2.3,
            cam: { on: 'old', from: 30, size: 'medium', angle: 'high' },
            do: [
              { at: 0.3, who: 'h1', to: ['old-front', 'huddle-3'], pace: 1.6 },
              { at: 0.45, who: 'h2', to: ['old-front', 'old-nest'], pace: 1.8 },
              { at: 1.0, who: 'h6', to: 'huddle-0', pace: 1.1 },
            ],
            hear: [
              { at: 0.4, sting: 'cluck' },
              { at: 0.7, sting: 'boing' },
              { at: 1.2, sting: 'cluck' },
            ],
            fx: [
              { at: 0.55, fx: 'feathers', on: 'old' },
              { at: 1.3, fx: 'feathers', on: 'h1' },
            ],
          },
          {
            // you reach in for an egg, and are pecked
            len: 2.6,
            cam: { on: 'you', from: -60, size: 'medium' },
            do: [
              { at: 0, who: 'you', pose: 'stand' },
              { at: 0.2, who: 'you', to: { x: -2.82, z: 20.62 }, pace: 0.9 },
              { at: 0.9, who: 'you', face: 'nests' },
              { at: 1.1, who: 'you', pose: 'point' },
              { at: 1.55, who: 'you', pose: 'flinch' },
              { at: 2.1, who: 'you', pose: 'shake' },
            ],
            hear: [
              { at: 1.5, sting: 'bonk' },
              { at: 1.55, sting: 'cluck' },
            ],
            fx: [
              { at: 1.5, fx: 'stars', on: 'you' },
              { at: 1.55, fx: 'feathers', on: 'old' },
            ],
          },
          // the doubt, as the crate comes in shut, heavy in his arms
          carryIn({
            who: 'guy',
            crate: 'crate',
            len: 3.4,
            pace: 1.35,
            say: { at: 0.6, text: 'Six nests? They’ll want the same one.', mood: 'smug', hold: 2.4 },
            also: [
              { at: 0, who: 'you', pose: 'stand' },
              { at: 0.1, who: 'you', to: 'tool-east', pace: 1.3 },
            ],
          }),
          setDown({ who: 'guy', crate: 'crate' }),
          // it opens, and the coop goes up out of it, a piece after a piece
          build({
            tool: 'tool',
            crate: 'crate',
            look: 'nests',
            style,
            also: [{ at: 0, who: 'you', face: 'tool' }],
          }),
          {
            // a silence: six hens look up at six nests … and all run for the same one (from behind them, low)
            len: 2.6,
            cam: { on: ['h2', 'h4'], from: 165, size: 'full', angle: 'low' },
            do: [
              ...hens.map((h) => ({ at: 0, who: h, face: 'tool' })),
              ...hens.map((h, k) => ({ at: 0.1 + k * 0.05, who: h, pose: 'surprise' as const })),
              // (the one up in the old box hops down first)
              ...hens.map((h, k) => ({ at: 1.3 + [0, 0.1, 0.05, 0.2, 0.15, 0.25][k], who: h, to: h === 'h2' ? ['old-front', `scrum-${k}`] : `scrum-${k}`, pace: 2.6 + k * 0.15, face: 'tool' })),
              ...hens.map((h, k) => ({ at: 1.25 + k * 0.02, who: h, pose: 'stand' as const })),
            ],
            hear: [{ at: 1.3, sting: 'whoosh', music: 'tension' }, ...beats(1.5, 0.3, 3, 'cluck')],
          },
          {
            // the scrum again, at the first nest of six
            len: 2.0,
            cam: { on: 'tool', from: -25, size: 'close', angle: 'high' },
            hear: beats(0.15, 0.35, 5, 'cluck'),
            fx: [
              { at: 0.3, fx: 'feathers', on: 'h3' },
              { at: 1.1, fx: 'feathers', on: 'h5' },
            ],
          },
          {
            // he was right: from below
            len: 2.0,
            cam: { ...reaction('guy', -30), angle: 'low' },
            do: [{ at: 0, who: 'guy', pose: 'hips' }],
            say: [{ at: 0.3, who: 'guy', text: 'Told you.', mood: 'smug', hold: 1.3 }],
          },
          {
            // the quiet one: a held beat, then a snap of the fingers
            len: 1.7,
            cam: { on: 'you', from: 15, size: 'medium', angle: 'low', move: 'push' },
            do: [
              { at: 0, who: 'you', face: 'h2' },
              { at: 0.6, who: 'you', pose: 'snap' },
            ],
            hear: [
              { at: 0.2, music: 'stop' },
              { at: 0.85, sting: 'snap' },
            ],
          },
          {
            // the drop: they hop up into the six nests, one after another, and the eggs come in pairs
            len: 3.2,
            cam: { on: 'tool', from: 8, size: 'close', move: 'pull' },
            do: hens.map((h, k) => ({ at: 0.05 + k * 0.16, who: h, to: [`front-${k}`, `nest-${k}`], pace: 2.4, face: 180 })),
            props: [
              { at: 1.9, prop: 'tool', show: '2' },
              { at: 2.3, prop: 'tool', show: '4' },
              { at: 2.7, prop: 'tool', show: '6' },
            ],
            hear: [{ at: 0, music: 'beat', sting: 'drop' }, ...hens.map((_, k) => ({ at: 0.35 + k * 0.16, sting: 'pop' as const })), ...beats(1.9, 0.4, 3, 'tick')],
            fx: [
              { at: 0, fx: 'flash' },
              { at: 1.9, fx: 'pop', on: 'tool' },
              { at: 2.3, fx: 'pop', on: 'tool' },
              { at: 2.7, fx: 'sparkle' },
            ],
          },
          {
            // he was wrong: from above, scratching his head
            len: 1.8,
            cam: { ...reaction('guy', 25), angle: 'high' },
            do: [
              { at: 0, who: 'guy', pose: 'surprise' },
              { at: 0.8, who: 'guy', pose: 'scratch' },
              { at: 0, who: 'you', pose: 'cool' },
            ],
          },
          {
            // the button: the rooster, who did nothing, comes down off his post — slow, from the ground; the iris
            // closes on him, a beat of silence, and he crows
            len: 3.4,
            slow: 0.6,
            cam: hero('roo'),
            do: [{ at: 0.1, who: 'roo', to: ['perch-foot', 'strut'], pace: 1.1 }],
            hear: [
              { at: 1.9, music: 'stop' },
              { at: 2.55, sting: 'crow' },
            ],
            fx: [{ at: 1.8, fx: 'iris' }],
          },
        ],
      },
    ],
    end: toolEnd({
      art: 'nest-with-eggs',
      title: 'The coop is yours',
      ribbon: 'One nest each',
      owns: [
        { art: 'nest-with-eggs', text: 'The coop' },
        { art: 'basket', text: '6 nests' },
      ],
      place: 'nest',
    }),
  }
}

/** The film in the style every farm starts with (a); the player's own skin is `coopFilm(style)`. */
export const COOP = coopFilm()
