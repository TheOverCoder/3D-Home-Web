import type { Film } from './format'
import { toolEnd } from './tools'

// "One Nest Each": the coop bought in the farm shop (plans/animal-tools.md: the hens' tool, a nest for every hen; on
// the farm today the six share one nest box).
//
// The turn: at the start six hens fight over one nest and you wait for your eggs; at the end each hen sits at a nest
// of her own and the eggs wait for you.
// Logline: a contractor says six nests will not stop six hens fighting, and the hens prove him wrong in one second.
// Who doubts: the contractor ("They'll still fight."). The callback: the farm's own numbers, 6 hens and 1 nest, and
// its rooster's crow. The button: the rooster, who did nothing, walks up in slow motion, shot from the ground as the
// hero of the shop's film was, and crows as if it was all his work. What the player got: the coop, six nests, the
// build's XP, and its two ladders' first steps.
// Beats (lab/FILM.md): enter late, in the scrum, the player already waiting · the doubt, as the crate comes in shut
// (suspense) · it lands, opens, and the nests rise one after another · a silence, then the beat drops and the hens
// part, each to her own nest · three pops of eggs (the third the last pair) · the rooster's walk and crow.
// Where: the pen's set (./set.ts, PEN), filmed from the lane's side, the woods behind; morning light.

export const COOP: Film = {
  id: 'coop',
  title: 'One Nest Each',
  logline: 'A contractor says six nests will not stop six hens fighting, and the hens prove him wrong in one second.',
  turn: 'Six hens fight over one nest while you wait; at the end each has her own, and the eggs wait for you.',
  herd: 'hens',
  cast: {
    you: { name: 'You', look: 'player', at: 'outside', face: 'post' },
    guy: { name: 'Contractor', look: 'contractor', at: 'east', off: true },
    roo: { name: 'Rooster', look: { herd: 0 }, at: 'huddle-6' },
    h1: { name: 'Hen', look: { herd: 1 }, at: 'huddle-0' },
    h2: { name: 'Hen', look: { herd: 2 }, at: 'huddle-1' },
    h3: { name: 'Hen', look: { herd: 3 }, at: 'huddle-2' },
    h4: { name: 'Hen', look: { herd: 4 }, at: 'huddle-3' },
    h5: { name: 'Hen', look: { herd: 5 }, at: 'huddle-4' },
    h6: { name: 'Hen', look: { herd: 6 }, at: 'huddle-5' },
  },
  props: {
    crate: { kind: 'crate', on: 'guy' },
    // the coop's first nest is the hens' old one: it stands already
    tool: { kind: 'tool', on: 'post', open: 1 / 7, show: '0' },
  },
  scenes: [
    {
      place: 'pen',
      light: 'morning',
      line: ['you', 'guy'],
      side: -1,
      shots: [
        {
          // say where: the pen at sunrise, seven birds at one nest, you outside waiting
          len: 2.6,
          cam: { on: 'h1', from: 'you', size: 'medium', move: 'push' },
          caption: '6 hens. 1 nest.',
          do: [{ at: 0, who: 'you', pose: 'slump' }],
          hear: [
            { at: 0, music: 'tension' },
            { at: 0.35, sting: 'cluck' },
            { at: 1.05, sting: 'cluck' },
            { at: 1.7, sting: 'cluck' },
          ],
        },
        {
          // the scrum, close: heads everywhere round the one nest
          len: 1.5,
          cam: { on: ['h1', 'h4'], from: 180, size: 'full', angle: 'high' },
          hear: [
            { at: 0.2, sting: 'cluck' },
            { at: 0.75, sting: 'cluck' },
          ],
        },
        {
          // the doubt, as the crate comes in shut
          len: 2.4,
          cam: { on: 'guy', size: 'medium' },
          do: [
            { at: 0, who: 'guy', put: 'east' },
            { at: 0, who: 'guy', pose: 'box' },
            { at: 0, who: 'guy', to: 'aside', pace: 1.6 },
            { at: 1.9, who: 'guy', face: 'you' },
          ],
          say: [{ at: 0.4, who: 'guy', text: 'Six nests? They’ll still fight.', mood: 'flat', hold: 2.0 }],
        },
        {
          // it lands, opens, and the nests rise one after another
          len: 2.6,
          cam: { on: 'tool', from: 0, size: 'medium' },
          props: [
            { at: 0, prop: 'crate', on: 'drop' },
            { at: 0.3, prop: 'crate', open: 1, over: 0.5 },
            { at: 0.75, prop: 'tool', open: 1, over: 1.2 },
          ],
          do: [
            { at: 0, who: 'guy', pose: 'stand' },
            { at: 0.5, who: 'guy', to: 'east', pace: 1.1 },
            { at: 0, who: 'you', pose: 'stand' },
          ],
          hear: [
            { at: 0.04, sting: 'thud' },
            { at: 0.32, sting: 'whoosh' },
            { at: 0.8, sting: 'riser' },
            { at: 1.15, sting: 'clunk' },
            { at: 1.75, sting: 'clunk' },
            { at: 2.2, music: 'stop' },
          ],
          fx: [{ at: 1.8, fx: 'sparkle' }],
        },
        {
          // the drop: they part, each to her own nest
          len: 2.6,
          cam: { on: ['nests', 'h3'], from: -20, size: 'full', angle: 'high' },
          do: [
            // each in at her own nest's front, then round to look out
            ...[0, 1, 2, 3, 4, 5].flatMap((k) => [
              { at: [0.1, 0.2, 0.0, 0.3, 0.15, 0.25][k], who: `h${k + 1}`, to: [`front-${k}`, `nest-${k}`], pace: 0.75 + k * 0.08 },
              { at: 2.05 + k * 0.04, who: `h${k + 1}`, face: 180 },
            ]),
            { at: 0, who: 'you', pose: 'cool' },
          ],
          hear: [{ at: 0, music: 'beat', sting: 'drop' }],
          fx: [{ at: 0, fx: 'flash' }],
        },
        {
          // three pops of eggs, a pair each
          len: 2.0,
          cam: { on: 'nests', from: -45, size: 'medium', move: 'push' },
          props: [
            { at: 0.3, prop: 'tool', show: '2' },
            { at: 0.75, prop: 'tool', show: '4' },
            { at: 1.2, prop: 'tool', show: '6' },
          ],
          hear: [
            { at: 0.3, sting: 'tick' },
            { at: 0.75, sting: 'tick' },
            { at: 1.2, sting: 'tick' },
            { at: 1.25, sting: 'cluck' },
          ],
          fx: [{ at: 1.3, fx: 'sparkle' }],
        },
        {
          // the button: the rooster's hero walk, from the ground, slow; a beat of silence; he crows
          len: 2.8,
          slow: 0.6,
          cam: { on: 'roo', from: 20, size: 'full', angle: 'ground' },
          do: [
            { at: 0, who: 'roo', to: 'strut', pace: 0.9 },
            { at: 1.7, who: 'roo', pose: 'surprise' },
          ],
          hear: [
            { at: 1.7, music: 'stop' },
            { at: 2.05, sting: 'crow' },
          ],
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
