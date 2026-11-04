# Credits

Keep this file and `src/data/credits.ts` (shown in the app's intro) in sync. Anything licensed CC-BY needs attribution.

## Bundled third-party assets

| Asset | By | License | Source |
|---|---|---|---|
| Glam Velvet Sofa | Wayfair, LLC (Khronos glTF Sample Assets) | CC BY 4.0 — attribution required | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa |
| Diffuse Transmission Plant | Darmstadt Graphics Group GmbH (Khronos glTF Sample Assets) | CC BY 4.0 — attribution required | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionPlant |
| Sheen Chair | Wayfair, LLC (Khronos glTF Sample Assets) | CC0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair |
| Chair Damask Purplegold (bedroom accent chair) | Wayfair, LLC — Eric Chadwick (Khronos glTF Sample Assets) | CC BY 4.0 — attribution required | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChairDamaskPurplegold |
| Specular Silk Pouf (living-room footstool) | Wayfair, LLC — Eric Chadwick (Khronos glTF Sample Assets) | CC BY 4.0 — attribution required | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf |
| Diffuse Transmission Teacup (coffee table) | Poly Haven and Eric Chadwick (Khronos glTF Sample Assets) | CC0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionTeacup |
| Water Bottle (studio desk) | Microsoft (Khronos glTF Sample Assets) | CC0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/WaterBottle |
| Blouberg Sunrise 2 (1k HDRI) | Poly Haven | CC0 | https://polyhaven.com/a/blouberg_sunrise_2 |

The models were compressed (meshopt + WebP textures, small props capped at 512–1024 px; the pouf and teacup meshes simplified with meshoptimizer) with `npm run assets:optimize`; nothing else was changed.

## Bundled today (placeholders)

- Daylight and surface textures are generated in code (no third-party image files).
- Inter typeface for 3D labels (packaged by [`@pmndrs/assets`](https://github.com/pmndrs/assets), declared CC0-1.0) — The Inter Project Authors, SIL Open Font License 1.1.
- three.js, @react-three/fiber, @react-three/drei, @react-three/rapier, @react-three/postprocessing, ecctrl, zustand — MIT.

## Real assets (add when downloaded)

| Asset | Author | License | Source |
|---|---|---|---|
| House | _e.g. Katydid_ | _verify: CC-BY, not NC_ | _Sketchfab URL_ |
| Character | Quaternius | CC0 | Universal Base Characters |
| Animations | Quaternius | CC0 | Universal Animation Library 1 + 2 |
| HDRI / props / textures | Poly Haven | CC0 | https://polyhaven.com |
