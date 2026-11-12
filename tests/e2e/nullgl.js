// A WebGL 2 context that draws nothing (the budget engine's counting without a GPU): put in a page before it loads
// (`page.addInitScript({ path })`), every canvas's `getContext('webgl2')` gives it. three.js keeps its counts of what a
// frame draws (`renderer.info`: draws, triangles) on the CPU, in the same calls a real context gets, so they come out
// the same — without the minutes software rendering takes for each frame. Nothing is drawn: anything that reads
// pixels back reads zeros (the budget walk reads none).
;(() => {
  // the browser's own, called with the canvas as `this` below (call)
  // eslint-disable-next-line typescript/unbound-method
  const real = HTMLCanvasElement.prototype.getContext
  const contexts = new WeakMap()
  // the real constants (gl.TRIANGLES, gl.FRAMEBUFFER_COMPLETE…), copied off the browser's own WebGL 2 interface
  const constants = {}
  for (const k of Object.getOwnPropertyNames(WebGL2RenderingContext)) if (/^[A-Z0-9_]+$/.test(k)) constants[k] = WebGL2RenderingContext[k]
  const C = constants
  const EXTENSIONS = [
    'EXT_color_buffer_float',
    'EXT_color_buffer_half_float',
    'EXT_texture_filter_anisotropic',
    'OES_texture_float_linear',
    'WEBGL_debug_renderer_info',
    'WEBGL_lose_context',
    'KHR_parallel_shader_compile',
    'WEBGL_multi_draw',
  ]
  const extension = (name) => {
    if (!EXTENSIONS.includes(name)) return null
    if (name === 'EXT_texture_filter_anisotropic') return { TEXTURE_MAX_ANISOTROPY_EXT: 0x84fe, MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84ff }
    if (name === 'WEBGL_debug_renderer_info') return { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 }
    if (name === 'KHR_parallel_shader_compile') return { COMPLETION_STATUS_KHR: 0x91b1 }
    if (name === 'WEBGL_lose_context') return { loseContext() {}, restoreContext() {} }
    if (name === 'WEBGL_multi_draw')
      return {
        multiDrawArraysWEBGL() {},
        multiDrawElementsWEBGL() {},
        multiDrawArraysInstancedWEBGL() {},
        multiDrawElementsInstancedWEBGL() {},
      }
    return {}
  }
  const parameter = (canvas, p) => {
    switch (p) {
      case C.VERSION:
        return 'WebGL 2.0'
      case C.SHADING_LANGUAGE_VERSION:
        return 'WebGL GLSL ES 3.00'
      case C.VENDOR:
      case 0x9245:
        return 'null'
      case C.RENDERER:
      case 0x9246:
        return 'null (counting only)'
      case C.VIEWPORT:
      case C.SCISSOR_BOX:
        return new Int32Array([0, 0, canvas.width, canvas.height])
      case C.MAX_VIEWPORT_DIMS:
        return new Int32Array([8192, 8192])
      case C.ALIASED_LINE_WIDTH_RANGE:
      case C.ALIASED_POINT_SIZE_RANGE:
        return new Float32Array([1, 1])
      case C.MAX_TEXTURE_SIZE:
      case C.MAX_CUBE_MAP_TEXTURE_SIZE:
      case C.MAX_RENDERBUFFER_SIZE:
      case C.MAX_3D_TEXTURE_SIZE:
        return 8192
      case C.MAX_ARRAY_TEXTURE_LAYERS:
        return 256
      case C.MAX_SAMPLES:
        return 4
      case C.MAX_VERTEX_UNIFORM_VECTORS:
      case C.MAX_FRAGMENT_UNIFORM_VECTORS:
        return 1024
      case C.MAX_VARYING_VECTORS:
        return 30
      case C.MAX_VERTEX_ATTRIBS:
      case C.MAX_TEXTURE_IMAGE_UNITS:
      case C.MAX_VERTEX_TEXTURE_IMAGE_UNITS:
        return 16
      case C.MAX_COMBINED_TEXTURE_IMAGE_UNITS:
        return 32
      case C.MAX_DRAW_BUFFERS:
      case C.MAX_COLOR_ATTACHMENTS:
        return 8
      case C.MAX_UNIFORM_BUFFER_BINDINGS:
        return 24
      case C.UNIFORM_BUFFER_OFFSET_ALIGNMENT:
        return 256
      case 0x84ff: // MAX_TEXTURE_MAX_ANISOTROPY_EXT
        return 16
      default:
        return 0
    }
  }
  function make(canvas, attributes) {
    let id = 0
    const thing = () => ({ __null: ++id })
    const methods = {
      getParameter: (p) => parameter(canvas, p),
      getExtension: extension,
      getSupportedExtensions: () => EXTENSIONS.slice(),
      getContextAttributes: () => ({ alpha: true, antialias: false, depth: true, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default', ...attributes }),
      isContextLost: () => false,
      getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
      getShaderParameter: () => true,
      getProgramParameter: (_program, p) => (p === C.ACTIVE_UNIFORMS || p === C.ACTIVE_ATTRIBUTES || p === C.ACTIVE_UNIFORM_BLOCKS ? 0 : true),
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      getShaderSource: () => '',
      getAttribLocation: () => -1,
      getUniformLocation: () => thing(),
      getUniformBlockIndex: () => 0,
      checkFramebufferStatus: () => C.FRAMEBUFFER_COMPLETE,
      getError: () => 0,
      fenceSync: () => thing(),
      clientWaitSync: () => C.ALREADY_SIGNALED,
      getSyncParameter: () => C.SIGNALED,
      getQueryParameter: () => 0,
      isEnabled: () => false,
      createBuffer: thing,
      createFramebuffer: thing,
      createProgram: thing,
      createRenderbuffer: thing,
      createShader: thing,
      createTexture: thing,
      createVertexArray: thing,
      createQuery: thing,
      createSampler: thing,
      createTransformFeedback: thing,
    }
    const target = { canvas, ...constants }
    return new Proxy(target, {
      get(t, k) {
        if (k === 'drawingBufferWidth') return canvas.width
        if (k === 'drawingBufferHeight') return canvas.height
        if (k === 'drawingBufferColorSpace') return 'srgb'
        if (k in methods) return methods[k]
        if (k in t) return t[k]
        if (typeof k === 'string' && /^[a-z]/.test(k)) return () => undefined // every other call: done, nothing drawn
        return undefined
      },
      set(t, k, v) {
        t[k] = v
        return true
      },
    })
  }
  // the factory itself, for a check that counts one scene with a real context and with this one side by side
  window.__makeNullGl = make
  if (window.__nullGlFactoryOnly) return
  HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    if (type !== 'webgl2') return real.call(this, type, attributes)
    let gl = contexts.get(this)
    if (!gl) contexts.set(this, (gl = make(this, attributes)))
    return gl
  }
})()
