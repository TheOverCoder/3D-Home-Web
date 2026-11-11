// Shown in the intro. Anything under CC-BY (e.g. a Sketchfab house) REQUIRES attribution — add it here.
export interface Credit {
  what: string
  by: string
  license: string
  url?: string
}

export const CREDITS: Credit[] = [
  {
    what: 'Glam Velvet Sofa (living-room sofa)',
    by: 'Wayfair, LLC — Khronos glTF Sample Assets',
    license: 'CC BY 4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa',
  },
  {
    what: 'Sheen Chair (living-room armchair)',
    by: 'Wayfair, LLC — Khronos glTF Sample Assets',
    license: 'CC0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair',
  },
  {
    what: 'Diffuse Transmission Plant (living-room plant)',
    by: 'Darmstadt Graphics Group GmbH — Khronos glTF Sample Assets',
    license: 'CC BY 4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionPlant',
  },
  {
    what: 'Chair Damask Purplegold (bedroom accent chair)',
    by: 'Wayfair, LLC (Eric Chadwick) — Khronos glTF Sample Assets',
    license: 'CC BY 4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChairDamaskPurplegold',
  },
  {
    what: 'Specular Silk Pouf (living-room footstool)',
    by: 'Wayfair, LLC (Eric Chadwick) — Khronos glTF Sample Assets',
    license: 'CC BY 4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf',
  },
  {
    what: 'Teacup and saucer (coffee table)',
    by: 'Poly Haven, Eric Chadwick — Khronos glTF Sample Assets',
    license: 'CC0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionTeacup',
  },
  { what: 'Water Bottle (studio desk)', by: 'Microsoft — Khronos glTF Sample Assets', license: 'CC0', url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/WaterBottle' },
  { what: 'Blouberg Sunrise 2 HDRI (lighting)', by: 'Poly Haven', license: 'CC0', url: 'https://polyhaven.com/a/blouberg_sunrise_2' },
  { what: 'Fabric Pattern 07 normal map (woven fabrics)', by: 'Poly Haven', license: 'CC0', url: 'https://polyhaven.com/a/fabric_pattern_07' },
  { what: 'Inter typeface (3D labels), via @pmndrs/assets', by: 'The Inter Project Authors', license: 'SIL OFL 1.1', url: 'https://rsms.me/inter/' },
  {
    what: 'Fluent Emoji 3D (interface art: coin, basket, shop and menu pictures, the orders clipboard, the tractor, the surprise gift; the app icon)',
    by: 'Microsoft Corporation',
    license: 'MIT',
    url: 'https://github.com/microsoft/fluentui-emoji',
  },
  { what: 'Phosphor Icons (interface glyphs)', by: 'Phosphor Icons', license: 'MIT', url: 'https://phosphoricons.com' },
  { what: 'Fredoka and Nunito typefaces', by: 'The Fredoka Project Authors; The Nunito Project Authors', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/specimen/Fredoka' },
  { what: 'three.js, react-three-fiber, drei, Rapier, ecctrl, three.quarks', by: 'their respective authors', license: 'MIT / Apache-2.0' },
]
