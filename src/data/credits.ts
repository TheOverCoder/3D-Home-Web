// Shown in the intro. Anything under CC-BY (e.g. a Sketchfab house) REQUIRES attribution — add it here.
export interface Credit {
  what: string
  by: string
  license: string
  url?: string
}

export const CREDITS: Credit[] = [
  { what: 'Inter typeface (3D labels), via @pmndrs/assets', by: 'The Inter Project Authors', license: 'SIL OFL 1.1', url: 'https://rsms.me/inter/' },
  { what: 'three.js, react-three-fiber, drei, Rapier, ecctrl', by: 'their respective authors', license: 'MIT / Apache-2.0' },
]
