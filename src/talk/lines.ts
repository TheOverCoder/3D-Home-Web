import type { NeighbourId, PersonId } from '../data/people'
import type { FarmerMood } from '../farm/firstSteps'
import type { Mood } from '../film/format'

// What the game's characters say out loud, as data: who says it, at which moment, how likely, how near you must be,
// how long before that moment is said again, and the lines (clear, simple English, a few words each, warm and gently
// funny; never a word of guilt or hurry: ./kind.ts). Read aloud in the device's own speech voices (./speech.ts), each
// character in a voice of their own; when a line may be said at all is ./rules.ts. Rare on purpose: a buyer greets now
// and then, not every buyer every time. A neighbour's lines open as their hearts grow (src/farm/people/friends.ts).

/** Who talks: one of the game's people (src/data/people.ts), or a buyer in the line at the gate (a stranger). */
export type Speaker = PersonId | 'buyer'

/** One thing a character says, on screen or aloud (a moment's line here, a line of a letter): who says it, the words,
 *  their face as they say it (a portrait's mood, src/ui/Portrait.tsx; the voice reads it by `voiceMood`), and the
 *  hearts a neighbour must have reached before they say it (none: from the first meeting). */
export interface Line {
  who: Speaker
  say: string
  mood: FarmerMood
  hearts?: number
}

export interface TalkRow {
  who: Speaker
  /** said in answer to you (you talked to them): no other line's gap holds it back, and it cuts in */
  answer?: boolean
  /** how likely the moment is said when it comes (0..1) */
  chance: number
  /** seconds before this moment is said again, by anyone */
  again: number
  /** said only within this many metres of you */
  near: number
  lines: readonly Line[]
}

/** How the speech voice reads a face (src/film/voice.ts, readingOf): glad warm, a surprise or excitement lifted, a wink
 *  smug, a sigh sad; a question or a "go on" plainly. */
const VOICE_MOODS: Partial<Record<FarmerMood, Mood>> = { cheerful: 'warm', proud: 'warm', laughing: 'warm', excited: 'shock', surprised: 'shock', winking: 'smug', sighing: 'sad' }
export const voiceMood = (mood: FarmerMood): Mood => VOICE_MOODS[mood] ?? 'flat'

/** Lines of one speaker in one mood (`hearts`: the hearts they open at). */
const says = (who: Speaker, mood: FarmerMood, say: readonly string[], hearts?: number): Line[] => say.map((s) => (hearts ? { who, say: s, mood, hearts } : { who, say: s, mood }))

/** What a neighbour says at a moment: their face, the lines from the first meeting, and one more at each heart. */
interface Said {
  mood: FarmerMood
  first: readonly string[]
  more: readonly string[]
}

/** A neighbour's two moments: a greeting at their place in the line and thanks when served, each a few lines from the
 *  first meeting and one more at each heart (the k-th of `more` opens at heart k + 1); as rare as a buyer's. */
function neighbour<W extends NeighbourId>(who: W, hello: Said, thanks: Said): Record<`${W}-arrive` | `${W}-thanks`, TalkRow> {
  const grown = (mood: FarmerMood, more: readonly string[]) => more.flatMap((s, k) => says(who, mood, [s], k + 1))
  return {
    [`${who}-arrive`]: { who, chance: 0.35, again: 30, near: 12, lines: [...says(who, hello.mood, hello.first), ...grown(hello.mood, hello.more)] },
    [`${who}-thanks`]: { who, chance: 0.5, again: 12, near: 10, lines: [...says(who, thanks.mood, thanks.first), ...grown(thanks.mood, thanks.more)] },
  } as unknown as Record<`${W}-arrive` | `${W}-thanks`, TalkRow>
}

export const TALK = {
  // the estate agent, when you talk to him (src/farm/Estate.tsx) and when the house is bought from him
  'agent-hello': {
    who: 'agent',
    answer: true,
    chance: 1,
    again: 8,
    near: 6,
    lines: says('agent', 'cheerful', ['Hello! Looking for a house?', 'Good day! A house of your own?', 'Welcome! The house is still for sale.']),
  },
  'agent-yours': {
    who: 'agent',
    answer: true,
    chance: 1,
    again: 8,
    near: 6,
    lines: says('agent', 'cheerful', ['Hello again! How is the house?', 'Your car is in the parking lot.', 'Enjoy your new house!']),
  },
  'agent-sold': { who: 'agent', answer: true, chance: 1, again: 0, near: 6, lines: says('agent', 'cheerful', ['Here are your keys. Enjoy!', 'Congratulations! The house is yours.']) },
  // a buyer in the line at the gate (src/farm/Visitors.tsx): a greeting at their place, thanks when served, a kind
  // word when turned away (saying no is yours to say: they take it well)
  'buyer-arrive': { who: 'buyer', chance: 0.35, again: 30, near: 12, lines: says('buyer', 'curious', ['Hello!', 'Hi there!', 'Hello, farmer!', 'Hi! Anything fresh today?']) },
  'buyer-thanks': { who: 'buyer', chance: 0.5, again: 12, near: 10, lines: says('buyer', 'cheerful', ['Thank you!', 'Thanks a lot!', 'Lovely, thank you!', 'Perfect, thanks!']) },
  'buyer-no': { who: 'buyer', chance: 0.6, again: 12, near: 10, lines: says('buyer', 'cheerful', ['No problem!', 'Another time, then!', 'All right. Have a lovely day!']) },
  // in the rain or the snow a buyer's greeting is now and then about the weather instead (mission 10 c9: as rare as
  // any greeting, and never more than once in a long while)
  'buyer-rain': { who: 'buyer', chance: 0.35, again: 120, near: 12, lines: says('buyer', 'cheerful', ['Good rain for the garden!', 'Your beds will love this rain.', 'A little rain never hurt!']) },
  'buyer-snow': { who: 'buyer', chance: 0.35, again: 120, near: 12, lines: says('buyer', 'cheerful', ['Look at the snow!', 'What a pretty white farm!', 'Snow at last!']) },
  // the man on the tractor (src/farm/OrderYard.tsx): a few words as he works, a short sentence now and then
  'driver-load': { who: 'driver', chance: 0.6, again: 45, near: 14, lines: says('driver', 'encouraging', ['Up you go.', 'One more crate.', 'Load it up.']) },
  'driver-go': { who: 'driver', chance: 0.5, again: 45, near: 16, lines: says('driver', 'encouraging', ['Off we go!', 'To town!']) },
  'driver-back': { who: 'driver', chance: 0.5, again: 45, near: 16, lines: says('driver', 'encouraging', ['Back again.', 'Easy does it.']) },
  'driver-chat': {
    who: 'driver',
    chance: 0.3,
    again: 150,
    near: 14,
    lines: says('driver', 'cheerful', ['The town loves your vegetables.', 'Another order, another trip!', 'A nice day for a drive.', 'I will be back soon.']),
  },
  // the neighbours at the gate, each in their own way (src/data/people.ts, `trait`)
  ...neighbour(
    'baker',
    {
      mood: 'cheerful',
      first: ['Morning! Moshe, the baker.', 'Hello! Any flour today?', 'Good morning! I was up at four.'],
      more: ['My bread says hello too.', 'Your flour makes my best bread.', 'I saved you a warm roll!', 'Still warm from the oven. Like me.', 'My favourite farm. Shh.'],
    },
    {
      mood: 'laughing',
      first: ['Thank you! Fresh bread tonight.', 'Lovely. The oven thanks you.'],
      more: ['The dough will be so happy.', 'Your eggs are perfect. Every time.', 'A loaf for you next time!', 'Bread is better with friends.', 'The whole town eats your flour.'],
    },
  ),
  ...neighbour(
    'teacher',
    {
      mood: 'curious',
      first: ['Hello! I am Dalia. I teach.', 'Good day! Lemons, please.', 'Hello! Is it a quiet day?'],
      more: ['Hello again, my top farmer.', 'Class is out. Time for berries!', 'Today we learn about lemons.', 'My class asks about your farm.', 'You are the best part of my day.'],
    },
    {
      mood: 'proud',
      first: ['Well done. Thank you!', 'Very good. Top marks!'],
      more: ['A gold star for you.', 'Ten out of ten, as always.', 'My class will love these.', 'I tell everyone about you.', 'Full marks. With a smiley face.'],
    },
  ),
  ...neighbour(
    'knitter',
    {
      mood: 'cheerful',
      first: ['Hello, dear! I am Rina.', 'Any wool today, dear?', 'Hello! Your sheep look cosy.'],
      more: ['I am knitting your cow a scarf.', 'Your wool is the softest, dear.', 'I knitted you socks. Odd ones.', 'Your sheep wave at me, you know.', 'A hat for you is on the needles.'],
    },
    {
      mood: 'cheerful',
      first: ['Thank you, dear!', 'Lovely and soft. Thank you!'],
      more: ['A new scarf by Friday!', 'Tell the sheep I said thanks.', 'You are a treasure, dear.', 'This wool knits itself, I swear.', 'Warm hands, warm heart, dear.'],
    },
  ),
  ...neighbour(
    'beekeeper',
    {
      mood: 'encouraging',
      first: ['Hello. I am Uri. I keep bees.', 'Hmm. Some sugar, please.', 'Hello. The bees say hello.'],
      more: ['A calm day. Like a hive.', 'My bees like your flowers.', 'Buzz. That means hello.', 'The queen bee asked about you.', 'Slow and sweet. Like your farm.'],
    },
    {
      mood: 'cheerful',
      first: ['Thank you. Sweet.', 'Thank you. Very sweet of you.'],
      more: ['The bees will hum about this.', 'Lemon cake. My one weakness.', 'You are sweeter than honey.', 'My hives say thank you too.', 'A jar of honey for you soon.'],
    },
  ),
  ...neighbour(
    'child',
    {
      mood: 'excited',
      first: ['Hi! I am Tali. Can I see the cows?', 'Hi! Do the hens like me?', 'Hello! Why are cows so big?'],
      more: ['I drew your sheep. Twice!', 'Mum says I can stay five minutes.', 'Can I name a chicken? Please?', 'I told my class about your cows.', 'You have the best farm. I checked.'],
    },
    {
      mood: 'laughing',
      first: ['Thank you! Bye, cows!', 'Yay! Thank you!'],
      more: ['Milk! My favourite!', 'I will share. Maybe.', 'When I grow up I want a farm.', 'Bye, hens! Bye, sheep! Bye!', 'You are my best grown up friend.'],
    },
  ),
} as const satisfies Record<string, TalkRow>

export type TalkMoment = keyof typeof TALK

/** At least this many seconds between any two lines (but an answer). */
export const TALK_GAP = 10
