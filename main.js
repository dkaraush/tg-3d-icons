import {
  GLProgram,
  loadTextFile,
  loadFile,
  readBINOBJ,
  GLBuffer,
  loadImage,
  GLTexture,
  radians,
  preprocessShader
} from './glutils.js'
import animated, {Easing} from './animated.js'
const { mat4, vec3 } = glMatrix

const TYPE_STAR = 0
const TYPE_COIN = 1
const TYPE_GOLDEN_STAR = 2
const TYPE_DIAMOND = 4

const MODEL_FILES = {
  [TYPE_STAR]: { src: [ './models/star.binobj' ] },
  [TYPE_GOLDEN_STAR]: { src: [ './models/star.binobj' ] },
  [TYPE_DIAMOND]: {
    src: [
      './models/diamond_outer_2.binobj',
      './models/diamond_outer.binobj',
      './models/diamond.binobj'
    ],
    scale: 8.0
  }
}

async function setup(canvas, type) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true })

  let W, H
  function onResize() {
    canvas.width = W = canvas.clientWidth * window.devicePixelRatio
    canvas.height = H = canvas.clientHeight * window.devicePixelRatio
  }
  window.addEventListener('resize', onResize)
  onResize()


  // controls
  canvas.style.cursor = 'grab'
  let mouseover = false
  const over = new animated(0.32, Easing.easeOutQuint)
  const mouse = [0, 0]
  const center = [0, 0]
  window.addEventListener('mousemove', e => {
    const bounds = canvas.getBoundingClientRect()
    center[0] = bounds.x + bounds.width / 2
    center[1] = bounds.y + bounds.height / 2

    mouse[0] = e.clientX
    mouse[1] = e.clientY
  })
  canvas.addEventListener('mouseenter', e => mouseover = true)
  canvas.addEventListener('mouseleave', e => mouseover = false)

  canvas.addEventListener('mousedown', e => {
    canvas.style.cursor = 'grabbing'
  })
  window.addEventListener('mouseup', e => {
    canvas.style.cursor = 'grab'
  })

  const fragmentShader = type == TYPE_DIAMOND ? './shaders/fragment5.glsl' : './shaders/fragment4.glsl'
  const program = new GLProgram(gl, [
    [ gl.VERTEX_SHADER, await loadTextFile('./shaders/vertex2.glsl') ],
    [ gl.FRAGMENT_SHADER, preprocessShader(await loadTextFile(fragmentShader)) ]
  ])

  class Model {
    constructor(file, scale) {
      const model = readBINOBJ(file)

      program.use()

      this.vertices = new GLBuffer(gl, Float32Array)
      this.uv = new GLBuffer(gl, Float32Array)
      this.normals = new GLBuffer(gl, Float32Array)

      for (const [vi, ti, ni] of model.faceIndexes) {
        this.vertices.add3(model.vertices[vi * 3 + 0] * scale, model.vertices[vi * 3 + 1] * scale, model.vertices[vi * 3 + 2] * scale)
        this.uv.add2(model.textures[ti * 2 + 0], 1 - model.textures[ti * 2 + 1])
        this.normals.add3(model.normals[ni * 3 + 0], model.normals[ni * 3 + 1], model.normals[ni * 3 + 2])
      }

      this.vertices.upload(gl.ARRAY_BUFFER, gl.STATIC_DRAW)
      this.uv.upload(gl.ARRAY_BUFFER, gl.STATIC_DRAW)
      this.normals.upload(gl.ARRAY_BUFFER, gl.STATIC_DRAW)
    }

    bind() {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.buffer)
      gl.enableVertexAttribArray(program.a('vPosition'))
      gl.vertexAttribPointer(program.a('vPosition'), 3, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.uv.buffer)
      gl.enableVertexAttribArray(program.a('a_TexCoordinate'))
      gl.vertexAttribPointer(program.a('a_TexCoordinate'), 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.normals.buffer)
      gl.enableVertexAttribArray(program.a('a_Normal'))
      gl.vertexAttribPointer(program.a('a_Normal'), 3, gl.FLOAT, false, 0, 0)
    }
  }

  const modelInfo = MODEL_FILES[type]
  const models = await Promise.all(
    modelInfo.src
      .map(src => loadFile(src).then(file => new Model(file, modelInfo.scale ?? 1))
  ))

  if (type == TYPE_STAR || type == TYPE_GOLDEN_STAR) {
    const texture0 = new GLTexture(gl, await loadImage('./models/star_texture.svg'))
    gl.activeTexture(gl.TEXTURE0)
    texture0.bind()
    gl.uniform1i(program.u('u_Texture'), 0)

    const texture1 = new GLTexture(gl, await loadImage('./models/flecks.png'))
    gl.activeTexture(gl.TEXTURE1)
    texture1.bind()
    gl.uniform1i(program.u('u_NormalMap'), 1)
  }

  if (type == TYPE_STAR) {
    const backgroundTexture = (() => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 100
      canvas.height = 100

      const gradient = ctx.createLinearGradient(0, 100, 150, 0)
      gradient.addColorStop(0, '#55A5FF')
      gradient.addColorStop(0.5, '#A767FF')
      gradient.addColorStop(0.78, '#DB5C9D')
      gradient.addColorStop(1, '#F38926')

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 100, 100)

      return canvas
    })()
    const texture2 = new GLTexture(gl, backgroundTexture)
    gl.activeTexture(gl.TEXTURE2)
    texture2.bind()
    gl.uniform1i(program.u('u_BackgroundTexture'), 2)
  }

  let time = 0.0
  let lastTime = Date.now()
  function render() {
    const now = Date.now()
    const deltaTimeMs = now - lastTime
    lastTime = now
    const deltaTime = deltaTimeMs / 1000.0
    time += deltaTime

    requestAnimationFrame(render)

    gl.viewport(0, 0, W, H)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    program.use()

    const proj = mat4.create()
    mat4.perspective(proj, radians(type == TYPE_DIAMOND ? 12 : 53.13), W / H, 1, 200)
    const view = mat4.create()
    mat4.lookAt(view, vec3.fromValues(0, type == TYPE_DIAMOND ? 40 : 0, 100), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0))
    const model = mat4.create()
    mat4.rotate(model, model, radians(over.set(mouseover) * Math.min(mouse[0] - center[0], 100) / 100 * 10), vec3.fromValues(0, 1, 0))
    mat4.rotate(model, model, radians(over.set(mouseover) * Math.min(mouse[1] - center[1], 100) / 100 * 10), vec3.fromValues(1, 0, 0))
    // if (type == TYPE_DIAMOND) {
      mat4.rotate(model, model, radians(time * 60), vec3.fromValues(0, 1, 0))
    // }

    const matrix = mat4.create()

    mat4.mul(matrix, view, model)
    mat4.mul(matrix, proj, matrix)

    gl.uniformMatrix4fv(program.u('uMVPMatrix'), false, matrix)
    gl.uniformMatrix4fv(program.u('world'), false, model)

    function drawModel(i, behind) {
      const model = models[i]

      model.bind()

      gl.uniform1f(program.u('behind'), behind ? 1 : 0)

      gl.uniform1f(program.u('spec1'), 2.0)
      gl.uniform1f(program.u('spec2'), 0.13)

      gl.uniform1f(program.u('white'), 0.0)
      gl.uniform1f(program.u('golden'), type == TYPE_GOLDEN_STAR ? 1.0 : 0.0)
      gl.uniform1f(program.u('u_diffuse'), 1.0)
      gl.uniform1f(program.u('normalSpec'), 0.2)

      if (type == TYPE_GOLDEN_STAR) {
        gl.uniform3f(program.u('gradientColor1'), .996, .784, .274) // #FEC846
        gl.uniform3f(program.u('gradientColor2'), .925, .572, .039) // #EC920A
      } else {
        gl.uniform3f(program.u('gradientColor1'), 1.0, 1.0, 1.0)
        gl.uniform3f(program.u('gradientColor2'), .890, .925, .980) // #E3ECFA
      }
      gl.uniform3f(program.u('normalSpecColor'), 1.0, 1.0, 1.0)
      gl.uniform3f(program.u('specColor'), 1.0, 1.0, 1.0)
      gl.uniform2f(program.u('resolution'), W, H)
      gl.uniform4f(program.u('gradientPosition'), 0, 0, 1.0, 1.0)

      gl.uniform1f(program.u('f_alpha'), 1.0)

      gl.uniform1f(program.u('time'), time)
      gl.uniform1i(program.u('night'), 1)
      gl.uniform1i(program.u('modelIndex'), i)

      gl.drawArrays(gl.TRIANGLES, 0, model.vertices.size() / 3)
    }

    if (type == TYPE_DIAMOND) {
      drawModel(0, true)
      gl.clear(gl.DEPTH_BUFFER_BIT)
      drawModel(1, true)
      gl.clear(gl.DEPTH_BUFFER_BIT)

      drawModel(2, false)
      drawModel(1, false)
      drawModel(0, false)
    } else {
      for (let i = 0; i < models.length; ++i) {
        drawModel(i, false)
      }
    }
  }
  render()
}

setup(document.querySelector('canvas#star-premium'), TYPE_STAR)
// setup(document.querySelector('canvas#biz-coin'), TYPE_COIN)
setup(document.querySelector('canvas#stars'), TYPE_GOLDEN_STAR)
setup(document.querySelector('canvas#diamond'), TYPE_DIAMOND)