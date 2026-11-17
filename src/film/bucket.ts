import type { Film } from './format'
import { toolEnd } from './tools'

// "Out of Reach": the milk bucket bought in the farm shop (plans/animal-tools.md: the cows' tool, a bucket that hangs
// on the pasture's gate post, so the herd's milk is taken there instead of chasing each cow round the field).
//
// The turn: at the start the pail stands on the ground and Daisy kicks it over; at the end it hangs on the post, out of
// her reach, and the cows come to it by themselves.
// Logline: Daisy has kicked over three pails this week; the fourth hangs on the gate post, and she can only look.
// Who doubts: the contractor ("That's three pails this week.": the rule of three told, the fourth shown). The callback:
// the herd's own names (Bella, Mazal, Daisy: src/farm/data.ts) and the game's milking sound. The button: the player's
// one line, a dare ("Kick it now, Daisy."), and her long, defeated moo. What the player got: the bucket, the herd's milk
// at the post, the build's XP, and its two ladders' first steps.
// Beats (lab/FILM.md): enter late, mid-milking · suspense: the pail, her hind legs, the tail, two ticks · the kick on
// the cut (a clunk, the shake, the music gone) · the laugh in her reaction, one shot · the doubt, as the crate comes in
// shut · it lands, opens, and the arm and the bucket rise onto the post · a silence, the beat drops, the cows come and
// the bucket fills · the dare, a held beat, the moo.
// Where: the pen's set (./set.ts, PEN), filmed from the lane's side, the woods behind; evening light.

export const BUCKET: Film = {
  id: 'bucket',
  title: 'Out of Reach',
  logline: 'Daisy has kicked over three pails this week; the fourth hangs on the gate post, and she can only look.',
  turn: 'The pail on the ground is Daisy’s to kick; at the end it hangs on the post, out of her reach, and the cows come to it.',
  herd: 'cows',
  cast: {
    you: { name: 'You', look: 'player', at: 'milker' },
    guy: { name: 'Contractor', look: 'contractor', at: 'east', off: true },
    daisy: { name: 'Daisy', look: { herd: 2 }, at: 'milk' },
    bella: { name: 'Bella', look: { herd: 0 }, at: 'field-1' },
    mazal: { name: 'Mazal', look: { herd: 1 }, at: 'field-2' },
  },
  props: {
    // her pail, on the ground under her (the bucket alone, before it hangs)
    pail: { kind: 'tool', on: 'pail', show: 'ground' },
    crate: { kind: 'crate', on: 'guy' },
    tool: { kind: 'tool', on: 'post', open: 0, show: '0' },
  },
  scenes: [
    {
      place: 'pen',
      light: 'evening',
      line: ['you', 'guy'],
      side: -1,
      shots: [
        {
          // say where: the pen in the evening, you milking Daisy
          len: 2.4,
          cam: { on: ['daisy', 'you'], from: 45, size: 'full' },
          caption: 'Milking time.',
          do: [{ at: 0, who: 'you', pose: 'type' }],
          hear: [
            { at: 0, music: 'tension' },
            { at: 0.5, sting: 'milk' },
            { at: 1.5, sting: 'milk' },
          ],
        },
        {
          // suspense: the pail by her hind legs, her tail swishing
          len: 1.4,
          cam: { on: 'pail', from: 20, size: 'medium', angle: 'low' },
          hear: [
            { at: 0.45, sting: 'tick' },
            { at: 0.95, sting: 'tick' },
          ],
        },
        {
          // the kick, on the cut
          len: 1.0,
          cam: { on: 'pail', from: 20, size: 'medium', angle: 'low', shake: 0.9 },
          props: [{ at: 0, prop: 'pail', show: 'tipped' }],
          do: [{ at: 0.05, who: 'you', pose: 'surprise' }],
          hear: [
            { at: 0, sting: 'clunk' },
            { at: 0.02, sting: 'scratch', music: 'stop' },
          ],
        },
        {
          // her reaction: none
          len: 1.5,
          cam: { on: 'daisy', from: 0, size: 'medium' },
          do: [{ at: 0, who: 'daisy', pose: 'surprise' }],
          hear: [{ at: 0.65, sting: 'moo' }],
        },
        {
          // the doubt, as the crate comes in shut
          len: 2.4,
          cam: { on: 'guy', size: 'medium' },
          do: [
            { at: 0, who: 'guy', put: 'east' },
            { at: 0, who: 'guy', pose: 'box' },
            { at: 0, who: 'guy', to: 'aside', pace: 1.6 },
            { at: 0, who: 'you', put: 'outside' },
            { at: 0, who: 'you', pose: 'stand' },
            { at: 0, who: 'daisy', pose: 'stand' },
          ],
          say: [{ at: 0.4, who: 'guy', text: 'That’s three pails this week.', mood: 'flat', hold: 2.0 }],
        },
        {
          // it lands, opens, and the arm and the bucket rise onto the post
          len: 2.6,
          cam: { on: 'tool', from: 0, size: 'medium', angle: 'low' },
          props: [
            { at: 0, prop: 'crate', on: 'drop' },
            { at: 0.3, prop: 'crate', open: 1, over: 0.5 },
            { at: 0.8, prop: 'tool', open: 1, over: 0.9 },
          ],
          do: [
            { at: 0, who: 'guy', pose: 'stand' },
            { at: 0.5, who: 'guy', to: 'east', pace: 1.1 },
            { at: 0, who: 'you', face: 'post' },
          ],
          hear: [
            { at: 0.04, sting: 'thud' },
            { at: 0.32, sting: 'whoosh' },
            { at: 0.8, sting: 'riser' },
            { at: 1.25, sting: 'clunk' },
            { at: 1.7, sting: 'clunk' },
            { at: 2.2, music: 'stop' },
          ],
          fx: [{ at: 1.75, fx: 'glint' }],
        },
        {
          // the drop: the cows come to the post, and it fills
          len: 2.8,
          cam: { on: ['tool', 'mazal'], from: 20, size: 'wide', angle: 'high' },
          props: [
            { at: 1.5, prop: 'tool', show: '1' },
            { at: 1.95, prop: 'tool', show: '2' },
            { at: 2.4, prop: 'tool', show: '3' },
          ],
          do: [
            { at: 0, who: 'daisy', to: 'stall-2', pace: 1.3 },
            { at: 0.1, who: 'bella', to: 'stall-0', pace: 1.4 },
            { at: 0.2, who: 'mazal', to: 'stall-1', pace: 1.5 },
            { at: 0, who: 'you', pose: 'cool' },
          ],
          hear: [
            { at: 0, music: 'beat', sting: 'drop' },
            { at: 1.5, sting: 'milk' },
            { at: 1.95, sting: 'milk' },
            { at: 2.4, sting: 'milk' },
          ],
          fx: [{ at: 0, fx: 'flash' }],
        },
        {
          // the button: the dare, without looking at her; a held beat; her moo
          len: 2.7,
          cam: { on: ['you', 'daisy'], from: 0, size: 'medium', angle: 'low' },
          do: [
            { at: 0, who: 'you', put: 'by-post' },
            { at: 0, who: 'you', face: 180 },
          ],
          say: [{ at: 0.3, who: 'you', text: 'Kick it now, Daisy.', mood: 'cool', hold: 1.6 }],
          hear: [
            { at: 1.9, music: 'stop' },
            { at: 2.2, sting: 'moo' },
          ],
        },
      ],
    },
  ],
  end: toolEnd({
    art: 'bucket',
    title: 'The bucket is yours',
    ribbon: 'No more kicks',
    owns: [
      { art: 'bucket', text: 'Milk bucket' },
      { art: 'droplet', text: 'Milk at the post' },
    ],
    place: 'cow',
  }),
}
