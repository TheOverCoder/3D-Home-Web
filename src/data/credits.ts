// Shown in the intro. Anything under CC-BY (e.g. a Sketchfab house) REQUIRES attribution — add it here.
export interface Credit {
  what: string
  by: string
  license: string
  url?: string
}

export const CREDITS: Credit[] = [
  { what: 'Glam Velvet Sofa (living-room sofa)', by: 'Wayfair, LLC — Khronos glTF Sample Assets', license: 'CC BY 4.0', url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa' },
  { what: 'Sheen Chair (living-room armchair)', by: 'Wayfair, LLC — Khronos glTF Sample Assets', license: 'CC0', url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair' },
  { what: 'Diffuse Transmission Plant (living-room plant)', by: 'Darmstadt Graphics Group GmbH — Khronos glTF Sample Assets', license: 'CC BY 4.0', url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionPlant' },
  { what: 'Blouberg Sunrise 2 HDRI (lighting)', by: 'Poly Haven', license: 'CC0', url: 'https://polyhaven.com/a/blouberg_sunrise_2' },
  { what: 'Inter typeface (3D labels), via @pmndrs/assets', by: 'The Inter Project Authors', license: 'SIL OFL 1.1', url: 'https://rsms.me/inter/' },
  { what: 'three.js, react-three-fiber, drei, Rapier, ecctrl', by: 'their respective authors', license: 'MIT / Apache-2.0' },
]
