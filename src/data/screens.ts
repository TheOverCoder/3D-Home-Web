import type { RoomId, Vec3 } from './layout'

// PLACEHOLDER CONTENT — replace with the real information each room should show.
// `bars` drive the floating 3D chart above each in-world screen.

export interface ScreenTab {
  label: string
  heading: string
  body: string
  points?: string[]
}

export interface ScreenDef {
  id: string
  room: RoomId
  title: string
  subtitle: string
  accent: string
  position: Vec3 // centre of the panel
  rotationY: number // 0 faces +z (south), PI faces -z, -PI/2 faces -x
  size: [number, number]
  holo: Vec3 // floor position of the pedestal carrying the 3D chart
  bars: { label: string; value: number }[]
  tabs: ScreenTab[]
}

export const SCREENS: ScreenDef[] = [
  {
    id: 'screen-living',
    room: 'living',
    title: 'Welcome',
    subtitle: 'Living room',
    accent: '#ffb454',
    position: [-3.5, 1.55, 5.88],
    rotationY: Math.PI,
    size: [1.6, 0.9],
    holo: [-5.5, 0, 4.9],
    bars: [
      { label: 'Q1', value: 0.45 },
      { label: 'Q2', value: 0.62 },
      { label: 'Q3', value: 0.8 },
      { label: 'Q4', value: 0.95 },
    ],
    tabs: [
      {
        label: 'About',
        heading: 'About this place',
        body: 'Placeholder text. Each screen in the house can present rich, designed information — text, figures and 3D data.',
        points: ['Walk with WASD, run with Shift', 'Press E near anything glowing', 'Drag the mouse to look around'],
      },
      {
        label: 'Highlights',
        heading: 'Highlights',
        body: 'Replace this with the key points you want visitors to remember.',
        points: ['Point one', 'Point two', 'Point three'],
      },
    ],
  },
  {
    id: 'screen-office',
    room: 'office',
    title: 'Projects',
    subtitle: 'Studio',
    accent: '#5eead4',
    position: [-3.5, 1.6, -5.88],
    rotationY: 0,
    size: [1.6, 0.9],
    holo: [-1.6, 0, -5.0],
    bars: [
      { label: 'A', value: 0.9 },
      { label: 'B', value: 0.55 },
      { label: 'C', value: 0.72 },
      { label: 'D', value: 0.38 },
      { label: 'E', value: 0.66 },
    ],
    tabs: [
      {
        label: 'Overview',
        heading: 'Selected projects',
        body: 'Placeholder. List the work you want to show, with a short description each.',
        points: ['Project A — description', 'Project B — description', 'Project C — description'],
      },
      {
        label: 'Process',
        heading: 'How it is made',
        body: 'Placeholder. Explain the process, tools or method behind the work.',
      },
    ],
  },
  {
    id: 'screen-kitchen',
    room: 'kitchen',
    title: 'Services',
    subtitle: 'Kitchen',
    accent: '#f472b6',
    position: [3.3, 1.75, -5.88],
    rotationY: 0,
    size: [1.6, 0.9],
    holo: [5.7, 0, -3.2],
    bars: [
      { label: 'Fast', value: 0.7 },
      { label: 'Good', value: 0.85 },
      { label: 'Fair', value: 0.5 },
    ],
    tabs: [
      {
        label: 'Offer',
        heading: 'What is on the menu',
        body: 'Placeholder. Describe the services or products on offer.',
        points: ['Service one', 'Service two', 'Service three'],
      },
      {
        label: 'Pricing',
        heading: 'Pricing',
        body: 'Placeholder. Add plans or price ranges here.',
      },
    ],
  },
  {
    id: 'screen-bedroom',
    room: 'bedroom',
    title: 'Contact',
    subtitle: 'Bedroom',
    accent: '#93c5fd',
    position: [6.88, 1.5, 2.4],
    rotationY: -Math.PI / 2,
    size: [1.6, 0.9],
    holo: [6.3, 0, 4.6],
    bars: [
      { label: 'Mon', value: 0.4 },
      { label: 'Tue', value: 0.6 },
      { label: 'Wed', value: 0.5 },
      { label: 'Thu', value: 0.85 },
    ],
    tabs: [
      {
        label: 'Reach out',
        heading: 'Get in touch',
        body: 'Placeholder. Add an email address, links and opening hours.',
        points: ['hello@example.com', 'Mon–Fri, 09:00–17:00'],
      },
    ],
  },
]

export const screenById = (id: string) => SCREENS.find((s) => s.id === id)
