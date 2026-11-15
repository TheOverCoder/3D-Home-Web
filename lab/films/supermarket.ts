import { MANAGER, XP_FOR } from '../../src/farm/data'
import type { Film } from './format'

// "Under New Management": buying the supermarket from the manager (src/farm/state.ts, buyMarket — at the top of his
// rate's ladder he sells it for MANAGER.shopPrice; he walks out, the computer and the till are yours, shoppers come).
//
// Logline: a farmer the manager has always underpaid buys his whole shop with one snap of the fingers.
// The turn: at the start he looks down on the farmer (shot from below, laughing); at the end the farmer stands over
// the shop (shot from the ground), and he is the one selling — at the farmer's price.
// Beats (lab/FILM.md): cold open at closing time with the case already on its way (we know before he does) · he
// mocks twice · the snap kills his muzak · the case in slow motion, "boss" said to the farmer · the thud, the glow, the
// money · the time-skip count · "The shop is yours" (the game's own words) · silence, then the beat drops and the shop
// lights up and fills · the hero walk from the ground · the banner · the button: he begs ("Buy my mug?") and gets the
// 20% he always gave.
// Voices (./voice.ts): every line is said aloud in its speaker's voice — the manager quick, nasal and up and down, the
// contractor slow and deep, the farmer low and level — made from the line's own text, nothing recorded.
// Where: the market's side of the lane, the same on every farm. The camera never turns across the lane to the farm
// (lab/films/set.ts, looksAtFarm): the last beat is a deadpan two-shot from the lane, the shop and its banner behind.

export const SUPERMARKET: Film = {
  id: 'buy-the-shop',
  title: 'Under New Management',
  logline: 'A farmer the manager has always underpaid buys his whole shop with one snap of the fingers.',
  turn: 'He looks down on the farmer and pays 20%; at the end the farmer owns the shop and offers him 20%.',
  cast: {
    you: { name: 'You', look: 'player', at: 'you' },
    boss: { name: 'Manager', look: 'manager', at: 'boss' },
    guy: { name: 'Contractor', look: 'contractor', at: 'lane-near' },
    a: { name: 'Shopper', look: { roll: 21 }, at: 'lane-west', off: true },
    b: { name: 'Shopper', look: { roll: 47 }, at: 'lane-east', off: true },
  },
  props: {
    case: { kind: 'case', on: 'guy' },
    box: { kind: 'box' },
    banner: { kind: 'banner', open: 0 },
    screen: { kind: 'screen', show: 'sale' },
    lights: { kind: 'lights', open: 0 },
    goods: { kind: 'goods', open: 0 },
  },
  scenes: [
    {
      // EXT. THE MARKET — EVENING. The muzak from its speaker; someone heavy-laden heading for its door.
      place: 'market',
      light: 'evening',
      shots: [
        {
          len: 2.4,
          cam: { on: ['door', 'guy'], from: 0, size: 'full', move: 'push' },
          caption: 'Closing time.',
          do: [
            { at: 0, who: 'guy', pose: 'carry' },
            { at: 0, who: 'guy', to: ['doorstep', 'inside'], pace: 1.0 },
          ],
          hear: [{ at: 0, music: 'muzak' }],
        },
      ],
    },
    {
      // INT. THE MANAGER'S OFFICE — NIGHT. He at his desk, the farmer in front of it. The camera keeps to the east
      // of the line between them; the walls in its way are left out by the player.
      place: 'market',
      light: 'night',
      line: ['boss', 'you'],
      side: 1,
      shots: [
        {
          len: 2.6,
          cam: { on: ['you', 'boss'], from: 'side', size: 'full' },
          do: [
            { at: 0, who: 'boss', face: 'screen' },
            { at: 0, who: 'boss', pose: 'type' },
          ],
          say: [{ at: 0.3, who: 'boss', text: 'Back to sell me carrots, kid?', mood: 'smug' }],
        },
        {
          len: 1.5,
          cam: { on: 'you', from: 'boss', size: 'medium' },
          do: [
            { at: 0.15, who: 'you', face: 'screen' },
            { at: 0.35, who: 'you', pose: 'point' },
          ],
        },
        {
          len: 1.4,
          cam: { on: 'screen', from: -30, size: 'extreme', move: 'punch' },
          hear: [
            { at: 0, sting: 'whoosh' },
            { at: 0.3, sting: 'coins' },
          ],
          fx: [{ at: 0.25, fx: 'tag', art: 'coin', text: String(MANAGER.shopPrice) }],
        },
        {
          len: 2.5,
          cam: { on: 'boss', size: 'medium', angle: 'low' },
          do: [
            { at: 0, who: 'boss', face: 'you' },
            { at: 0.1, who: 'boss', pose: 'laugh' },
            { at: 0, who: 'you', pose: 'stand' },
            { at: 0, who: 'you', face: 'boss' },
          ],
          say: [{ at: 0.25, who: 'boss', text: 'Ha! With what? Turnips?', mood: 'smug' }],
        },
        {
          len: 1.2,
          cam: { on: 'you', size: 'medium', angle: 'low' },
          do: [
            { at: 0, who: 'boss', pose: 'stand' },
            { at: 0.12, who: 'you', pose: 'snap' },
          ],
          hear: [
            { at: 0.4, sting: 'snap' },
            { at: 0.5, sting: 'scratch', music: 'stop' },
          ],
        },
        {
          len: 2.8,
          slow: 0.6,
          cam: { on: ['guy', 'case'], from: 0, size: 'medium', angle: 'low' },
          do: [
            { at: 0, who: 'guy', put: 'hall-door' },
            { at: 0, who: 'guy', pose: 'carry' },
            { at: 0, who: 'guy', to: ['office-door', 'aside'], pace: 1.0 },
            { at: 0, who: 'you', pose: 'cool' },
          ],
          say: [{ at: 1.0, who: 'guy', text: 'Heavy one, boss.' }],
          hear: [{ at: 0.3, music: 'tension' }],
        },
        {
          len: 1.2,
          cam: { on: 'case', from: 45, size: 'close', angle: 'high', shake: 0.8 },
          props: [{ at: 0, prop: 'case', on: 'desk' }],
          do: [
            { at: 0, who: 'guy', pose: 'stand' },
            { at: 0.3, who: 'guy', to: ['office-door', 'hall-door'], pace: 1.2 },
          ],
          hear: [{ at: 0.04, sting: 'thud' }],
        },
        {
          len: 2.3,
          cam: { on: 'boss', from: -25, size: 'medium', angle: 'low' },
          props: [{ at: 0.15, prop: 'case', open: 1, over: 0.6 }],
          do: [{ at: 0.35, who: 'boss', pose: 'surprise' }],
          hear: [
            { at: 0.15, sting: 'glow' },
            { at: 0.45, voice: 'boss', text: 'Ooh…', mood: 'shock' },
          ],
          fx: [{ at: 0.15, fx: 'glow' }],
        },
        {
          len: 1.8,
          cam: { on: 'case', from: -90, size: 'close', angle: 'high', move: 'push' },
          hear: [{ at: 0.3, sting: 'coins' }],
        },
        {
          len: 2.4,
          cam: { on: 'boss', from: 'you', size: 'medium' },
          caption: 'Two hours later.',
          do: [{ at: 0, who: 'boss', pose: 'count' }],
          say: [{ at: 0.5, who: 'boss', text: '…1,498. 1,499…', hold: 1.9 }],
          hear: [
            { at: 0.9, sting: 'tick' },
            { at: 1.4, sting: 'tick' },
            { at: 1.9, sting: 'tick' },
          ],
        },
        {
          len: 2.8,
          cam: { on: ['you', 'boss'], from: 'side', size: 'medium' },
          do: [
            { at: 0.15, who: 'boss', pose: 'shake' },
            { at: 0.25, who: 'you', pose: 'shake' },
          ],
          props: [{ at: 1.3, prop: 'screen', show: 'yours' }],
          say: [{ at: 0.2, who: 'boss', text: '1,500. The shop is yours.', mood: 'warm' }],
          hear: [
            { at: 1.35, sting: 'riser' },
            { at: 2.45, music: 'stop' },
          ],
        },
      ],
    },
    {
      // EXT. THE MARKET — NIGHT, from the ground: the beat drops and the shop lights up, a light to a beat.
      place: 'market',
      light: 'night',
      shots: [
        {
          len: 2.6,
          cam: { on: 'sign', from: 0, size: 'full', angle: 'ground', move: 'push' },
          props: [
            { at: 0, prop: 'lights', open: 1, over: 1.4 },
            { at: 0, prop: 'goods', open: 1, over: 0.01 },
          ],
          hear: [
            { at: 0, music: 'beat', sting: 'drop' },
            { at: 0.45, sting: 'clunk' },
            { at: 0.95, sting: 'clunk' },
          ],
          fx: [
            { at: 0, fx: 'flash' },
            { at: 1.35, fx: 'glint' },
            { at: 1.5, fx: 'sparkle' },
          ],
        },
      ],
    },
    {
      // EXT. THE MARKET — NEXT MORNING. The farmer walks out of their shop, from the ground, in slow motion; the
      // banner goes up over the sign. Then the button, square and deadpan: the two side by side on the lane, facing us,
      // the shop behind them (the camera stays on the shop's side of the lane, looking at it).
      place: 'market',
      light: 'morning',
      line: ['boss', 'you'],
      side: 1,
      shots: [
        {
          len: 3.4,
          slow: 0.55,
          cam: { on: 'you', from: 0, size: 'full', angle: 'ground' },
          caption: 'Next morning.',
          props: [
            { at: 0, prop: 'case', on: 'guy', open: 0, over: 0.01 },
            { at: 0, prop: 'lights', open: 1, over: 0.01 },
            { at: 0, prop: 'goods', open: 1, over: 0.01 },
            { at: 0, prop: 'screen', show: 'yours' },
          ],
          do: [
            { at: 0, who: 'you', put: 'inside' },
            { at: 0, who: 'you', pose: 'cool' },
            { at: 0, who: 'you', to: ['doorstep', 'front'], pace: 1.0 },
            { at: 0, who: 'guy', put: { x: 7.6, z: 18.2, heading: Math.PI } },
            { at: 0, who: 'guy', pose: 'carry' },
            { at: 0.5, who: 'guy', to: ['doorstep', 'front-right'], pace: 1.0 },
            { at: 0, who: 'boss', off: true },
          ],
          hear: [{ at: 0.1, sting: 'door' }],
        },
        {
          len: 2.6,
          cam: { on: 'sign', from: 0, size: 'wide', angle: 'low', move: 'crane' },
          props: [{ at: 0.35, prop: 'banner', open: 1, over: 0.55 }],
          hear: [
            { at: 0.35, sting: 'whoosh' },
            { at: 0.85, sting: 'swell' },
          ],
          fx: [
            { at: 0.95, fx: 'sparkle' },
            { at: 1.05, fx: 'glint' },
            { at: 1.15, fx: 'confetti' },
          ],
        },
        {
          // the button: he comes out of the door behind the farmer with his things in a box, stops at their side and
          // turns to them; they keep looking ahead
          len: 2.8,
          cam: { on: ['you', 'boss'], from: 0, size: 'medium' },
          props: [{ at: 0, prop: 'box', on: 'boss' }],
          do: [
            { at: 0, who: 'you', face: 180 },
            { at: 0, who: 'boss', put: 'inside' },
            { at: 0, who: 'boss', pose: 'box' },
            { at: 0, who: 'boss', to: ['doorstep', 'front-left'], pace: 1.25 },
            { at: 1.9, who: 'boss', face: 'you' },
          ],
          say: [{ at: 1.2, who: 'boss', text: 'Buy my mug? Mint condition.', mood: 'sad' }],
        },
        {
          // the last laugh, from below: the farmer does not even turn, the banner over them
          len: 2.0,
          cam: { on: 'you', from: 0, size: 'medium', angle: 'low' },
          say: [{ at: 0.75, who: 'you', text: 'I’ll give you 20%.', mood: 'cool' }],
        },
        {
          // the same square two-shot, wider: he freezes, wilts and trudges off; the first shoppers go in behind them
          len: 2.6,
          cam: { on: ['you', 'boss'], from: 0, size: 'full' },
          do: [
            { at: 0.15, who: 'boss', pose: 'freeze' },
            { at: 1.5, who: 'boss', pose: 'slump' },
            { at: 1.6, who: 'boss', to: 'lane-east', pace: 0.9 },
            { at: 0.6, who: 'a', put: { x: 3.4, z: 15.9, heading: Math.PI / 2 } },
            { at: 0.6, who: 'a', to: ['lane', 'doorstep', 'inside', 'hall'], pace: 1.3 },
            { at: 0.9, who: 'b', put: { x: 10.8, z: 16.1, heading: -Math.PI / 2 } },
            { at: 0.9, who: 'b', to: ['lane', 'doorstep', 'inside', 'hall'], pace: 1.3 },
          ],
          hear: [
            { at: 0.2, music: 'stop' },
            { at: 0.25, sting: 'trombone' },
          ],
        },
      ],
    },
  ],
  end: {
    art: 'convenience-store',
    title: 'The shop is yours',
    chips: [
      { art: 'gem-stone', text: `+${XP_FOR.shop} XP` },
      { art: 'shopping-bags', text: 'Shoppers come' },
      { art: 'coin', text: 'The till is yours' },
    ],
  },
}
