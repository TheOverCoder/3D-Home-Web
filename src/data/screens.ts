import type { RoomId, Vec3 } from './layout'

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   ALL SCREEN CONTENT LIVES IN THIS FILE — it is the one place to edit what the house tells visitors.

   Every room has three views of the same entry:
     · the wall screen   → `title`, `subtitle`, `tagline`, `stats` (first three) and the tab labels
     · the hologram      → `holoKind` picks the 3D piece on the pedestal; `bars` feed it with data
                           ('cards' shows the first tab that has `cards`)
     · the panel (E key) → `title`, `tagline`, `stats`, `cta` on the left, one section per entry in `tabs`

   A section (tab) can mix any of: `body` text, `points` (a checklist), `stats` (big numbers),
   `cards` (tiles with generated artwork — `seed` changes the picture), `steps` (a numbered timeline)
   and a `cta` button. Leave a field out and its block disappears; the layout adapts.

   The copy below is PLACEHOLDER — replace it with your own words, numbers, links and email.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

export type HoloKind = 'orbit' | 'cards' | 'rings' | 'globe'

/** A headline number. `value` may carry a unit or suffix ("140+", "97%", "24 h"); the number counts up. */
export interface Stat {
  value: string
  label: string
}

/** A tile with generated artwork: projects, services, plans… */
export interface Card {
  title: string
  kicker: string // small line above the title (category, client, price…)
  body: string
  meta?: string // small print under the body (year · role, duration…)
  seed?: number // picks the generated artwork: seed % 4 → orbits, waves, skyline, rays; the rest varies it
}

export interface Step {
  title: string
  body: string
}

/** A call to action. `copy` adds a "copy to clipboard" button for that text (an email address, say). */
export interface Cta {
  label: string
  href: string
  copy?: string
  note?: string
}

export interface ScreenTab {
  label: string
  heading: string
  body: string
  points?: string[]
  stats?: Stat[]
  cards?: Card[]
  steps?: Step[]
  cta?: Cta
}

export interface ScreenDef {
  id: string
  room: RoomId
  title: string
  subtitle: string
  tagline: string // one sentence under the title (wall screen + panel)
  accent: string
  position: Vec3 // centre of the panel
  rotationY: number // 0 faces +z (south), PI faces -z, -PI/2 faces -x
  size: [number, number]
  holo: Vec3 // floor position of the pedestal carrying the hologram
  holoKind: HoloKind
  bars: { label: string; value: number }[] // 0..1, drive the hologram and the small chart in the panel
  stats: Stat[] // the first three appear on the wall screen
  cta?: Cta // shown under the stats in the panel
  tabs: ScreenTab[]
}

export const SCREENS: ScreenDef[] = [
  {
    id: 'screen-living',
    room: 'living',
    title: 'Welcome',
    subtitle: 'Living room',
    tagline: 'A small house you can walk through. Every room tells one part of the story.',
    accent: '#ffb454',
    position: [-3.5, 1.55, 5.88],
    rotationY: Math.PI,
    size: [1.6, 0.9],
    holo: [-5.5, 0, 4.9],
    holoKind: 'orbit',
    bars: [
      { label: 'Design', value: 0.92 },
      { label: 'Build', value: 0.78 },
      { label: 'Care', value: 0.64 },
    ],
    stats: [
      { value: '12', label: 'Years of practice' },
      { value: '140+', label: 'Projects shipped' },
      { value: '9', label: 'Countries' },
    ],
    tabs: [
      {
        label: 'About',
        heading: 'A studio, in a house',
        body: 'Placeholder. Introduce yourself or your studio in two or three sentences: who you are, what you make and for whom. Keep it warm — this is the first thing visitors read.',
        points: ['Independent and small on purpose', 'Design and engineering under one roof', 'Long-term partnerships over one-off jobs'],
      },
      {
        label: 'Highlights',
        heading: 'The short version',
        body: 'Placeholder. The few facts you want every visitor to leave with.',
        stats: [
          { value: '4.9', label: 'Average client rating' },
          { value: '70%', label: 'Clients who come back' },
          { value: '3', label: 'Industry awards' },
        ],
        points: ['Featured in a design annual', 'Speaker at two conferences', 'Open-source tools used by thousands'],
      },
      {
        label: 'Tour',
        heading: 'Where to go next',
        body: 'Each room has a screen like this one. Walk up to it and press E.',
        steps: [
          { title: 'Studio', body: 'Selected projects and how they were made.' },
          { title: 'Kitchen', body: 'Services, ways of working and pricing.' },
          { title: 'Bedroom', body: 'Contact details and availability.' },
        ],
      },
    ],
  },
  {
    id: 'screen-office',
    room: 'office',
    title: 'Projects',
    subtitle: 'Studio',
    tagline: 'Selected work: digital products, spaces and the systems behind them.',
    accent: '#5eead4',
    position: [-3.5, 1.6, -5.88],
    rotationY: 0,
    size: [1.6, 0.9],
    holo: [-1.6, 0, -5.0],
    holoKind: 'cards',
    bars: [
      { label: 'Product', value: 0.9 },
      { label: 'Brand', value: 0.55 },
      { label: 'Spatial', value: 0.72 },
      { label: 'Research', value: 0.38 },
      { label: 'Systems', value: 0.66 },
    ],
    stats: [
      { value: '38', label: 'Launches' },
      { value: '6', label: 'Awards' },
      { value: '97%', label: 'Delivered on time' },
    ],
    tabs: [
      {
        label: 'Selected work',
        heading: 'Selected projects',
        body: 'Placeholder. Four projects you are proud of, one line each. Swap the titles, clients and years for your own.',
        cards: [
          { kicker: 'Product · Fintech', title: 'Northwind', body: 'A calm banking app for people who hate banking apps.', meta: '2025 · Lead design', seed: 4 },
          { kicker: 'Spatial · Retail', title: 'Atlas Rooms', body: 'An interactive showroom that works in the browser.', meta: '2024 · Design + build', seed: 9 },
          { kicker: 'Brand · Energy', title: 'Lumen', body: 'Identity and design system for a solar co-op.', meta: '2024 · Art direction', seed: 14 },
          { kicker: 'Systems · Health', title: 'Harbor', body: 'Scheduling platform for a network of clinics.', meta: '2023 · Engineering', seed: 3 },
        ],
      },
      {
        label: 'Process',
        heading: 'How the work gets made',
        body: 'Placeholder. Explain your method in four steps — visitors like to know what working with you feels like.',
        steps: [
          { title: 'Discover', body: 'Interviews, audits and a clear problem statement.' },
          { title: 'Shape', body: 'Sketches and prototypes, tested with real people.' },
          { title: 'Build', body: 'Production code and assets, shipped in small steps.' },
          { title: 'Refine', body: 'Measure, learn, and polish what matters most.' },
        ],
      },
      {
        label: 'Toolkit',
        heading: 'Tools of the trade',
        body: 'Placeholder. The tools and techniques you rely on.',
        points: ['Figma, Blender and a lot of paper', 'TypeScript, React and three.js', 'Usability testing and analytics'],
      },
    ],
  },
  {
    id: 'screen-kitchen',
    room: 'kitchen',
    title: 'Services',
    subtitle: 'Kitchen',
    tagline: 'What is cooking: from the first sketch to a finished, running product.',
    accent: '#f472b6',
    position: [3.3, 1.75, -5.88],
    rotationY: 0,
    size: [1.6, 0.9],
    holo: [5.7, 0, -3.2],
    holoKind: 'rings',
    bars: [
      { label: 'Design', value: 0.86 },
      { label: 'Build', value: 0.72 },
      { label: 'Advise', value: 0.5 },
    ],
    stats: [
      { value: '3', label: 'Core services' },
      { value: '2 wk', label: 'Typical sprint' },
      { value: '24 h', label: 'Reply time' },
    ],
    tabs: [
      {
        label: 'Offer',
        heading: 'What is on the menu',
        body: 'Placeholder. Describe each service in a sentence and say who it is for.',
        cards: [
          { kicker: 'Service 01', title: 'Design', body: 'Product strategy, UX and interface design.', meta: 'From 2 weeks', seed: 8 },
          { kicker: 'Service 02', title: 'Build', body: 'Web apps and 3D experiences, end to end.', meta: 'From 4 weeks', seed: 13 },
          { kicker: 'Service 03', title: 'Advise', body: 'Reviews, workshops and team coaching.', meta: 'From 1 day', seed: 22 },
        ],
      },
      {
        label: 'Pricing',
        heading: 'Plans and prices',
        body: 'Placeholder. Indicative prices help people decide to get in touch.',
        cards: [
          { kicker: 'From €4k', title: 'Sprint', body: 'Two weeks on one focused problem.', meta: 'Fixed scope', seed: 12 },
          { kicker: 'From €18k', title: 'Project', body: 'A full product, launched and handed over.', meta: '6–12 weeks', seed: 21 },
          { kicker: 'From €3k / mo', title: 'Retainer', body: 'Ongoing design and engineering support.', meta: 'Cancel anytime', seed: 31 },
        ],
      },
      {
        label: 'FAQ',
        heading: 'Good to know',
        body: 'Placeholder. Answer the questions people always ask.',
        points: ['Remote first, on site when it helps', 'Fixed quotes, no surprise invoices', 'You own everything we make together'],
      },
    ],
  },
  {
    id: 'screen-bedroom',
    room: 'bedroom',
    title: 'Contact',
    subtitle: 'Bedroom',
    tagline: 'Have a project in mind? Say hello — every message gets a reply within a day.',
    accent: '#93c5fd',
    position: [6.88, 1.5, 2.4],
    rotationY: -Math.PI / 2,
    size: [1.6, 0.9],
    holo: [6.3, 0, 4.6],
    holoKind: 'globe',
    bars: [
      { label: 'Mon', value: 0.4 },
      { label: 'Tue', value: 0.6 },
      { label: 'Wed', value: 0.5 },
      { label: 'Thu', value: 0.85 },
      { label: 'Fri', value: 0.7 },
    ],
    stats: [
      { value: '24 h', label: 'Reply time' },
      { value: '5', label: 'Days a week' },
      { value: '3', label: 'Open slots' },
    ],
    cta: { label: 'Write an email', href: 'mailto:hello@example.com', copy: 'hello@example.com', note: 'Replies within one working day' },
    tabs: [
      {
        label: 'Reach out',
        heading: 'Get in touch',
        body: 'Placeholder. Tell people the best way to reach you and what to include in a first message.',
        points: ['hello@example.com', 'Mon–Fri, 09:00–17:00 (CET)', 'Based in Europe, working worldwide'],
        cta: { label: 'Book an intro call', href: 'mailto:hello@example.com?subject=Intro%20call', note: 'Thirty minutes, no strings attached' },
      },
      {
        label: 'Availability',
        heading: 'Taking on new work',
        body: 'Placeholder. Say when you can start and how far ahead you are booked.',
        stats: [
          { value: '3', label: 'Slots this quarter' },
          { value: '2 wk', label: 'Lead time' },
        ],
        steps: [
          { title: 'Intro call', body: 'Thirty minutes to see if we are a good fit.' },
          { title: 'Proposal', body: 'Scope, timeline and a fixed quote within a week.' },
          { title: 'Kick-off', body: 'We start — usually within two weeks.' },
        ],
      },
      {
        label: 'Elsewhere',
        heading: 'Find us online',
        body: 'Placeholder. Links to the places you are active.',
        points: ['github.com/your-name', 'linkedin.com/in/your-name', 'dribbble.com/your-name'],
      },
    ],
  },
]

export const screenById = (id: string) => SCREENS.find((s) => s.id === id)
