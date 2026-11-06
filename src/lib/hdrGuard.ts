import { ShaderChunk, ShaderMaterial, Uniform } from 'three'
import { ShaderPass } from 'postprocessing'

/*
 * Why this exists — the "black rectangle" seen on phones.
 *
 * The scene is rendered into half-float buffers (largest value 65504). A single pixel that is not a finite
 * number in that range (an overflow becomes +Inf; some mobile GPUs also produce NaN from maths that is fine on
 * a desktop) is harmless on its own, but the bloom's mipmap blur spreads it: every level averages it into a
 * bigger block, `mix(Inf, Inf, t)` turns into NaN, and NaN ends up black on screen. The result is a sharp,
 * pure-black rectangle running to the screen edges, aligned to the texels of one of the tiny mip levels —
 * exactly what showed up on an Android phone, and reproducible here by putting one over-bright pixel in view.
 *
 * Two guards, both cheap: lit and unlit materials clamp what they write (so nothing overflows at the source),
 * and a sanitising pass cleans the buffer once more right before anything that blurs it (bloom, depth of
 * field), whatever produced the bad value. NaN fails every comparison, so the selects below map it to 0
 * without doing arithmetic on it.
 */

/** Far above anything the house produces (a sweep of the whole house peaks at a few hundred), far below 65504. */
export const HDR_MAX = 4096

const max = HDR_MAX.toFixed(1)
const select = (c: string) => `hdrOk.${c} ? hdrIn.${c} : ( hdrIn.${c} > 0.0 ? ${max} : 0.0 )`
const GUARD_GLSL = /* glsl */ `
{
  vec3 hdrIn = gl_FragColor.rgb;
  bvec3 hdrOk = lessThanEqual( abs( hdrIn ), vec3( ${max} ) );
  gl_FragColor.rgb = vec3( ${select('x')}, ${select('y')}, ${select('z')} );
}
`

let installed = false

/** Adds the clamp to every built-in material's output (MeshStandard/Physical/Basic/Lambert/Phong, points, sprites…). Call before the first shader compiles. */
export function installHdrGuard() {
  if (installed) return
  installed = true
  ShaderChunk.opaque_fragment = `${ShaderChunk.opaque_fragment}\n${GUARD_GLSL}`
}

/** A full-screen pass that rewrites the buffer with every non-finite or overflowing value made safe. */
export function createHdrSanitizePass() {
  const material = new ShaderMaterial({
    name: 'HdrSanitize',
    uniforms: { inputBuffer: new Uniform(null) },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D inputBuffer;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(inputBuffer, vUv);
        gl_FragColor = texel;
        ${GUARD_GLSL}
        // alpha should be 0..1; anything else (NaN included) becomes opaque
        gl_FragColor.a = (texel.a >= 0.0 && texel.a <= 1.0) ? texel.a : 1.0;
      }
    `,
    depthTest: false,
    depthWrite: false,
  })
  const pass = new ShaderPass(material, 'inputBuffer')
  pass.name = 'HdrSanitizePass'
  return pass
}
