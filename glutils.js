const { vec3, vec4, quat, mat4 } = glMatrix

export const loadTextFile = url =>
  fetch(url).then(r => r.text())

export const loadFile = url =>
  fetch(url).then(r => r.arrayBuffer())

export const loadImage = url => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  img.onload = () => resolve(img)
  img.onerror = (err) => reject(err)
})

export const radians = deg => deg / 180 * Math.PI

export const lerp = (a, b, t) => a + (b - a) * t
export const ilerp = (x, a, b) => (x - a) / (b - a)

export function preprocessShader(code) {
  const pattern = /RGB#([0-9a-fA-F]{6})/g;
  return code.replace(pattern, (_, hex) => {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const vec3 = `vec3(${(r / 255).toFixed(3)}, ${(g / 255).toFixed(3)}, ${(b / 255).toFixed(3)})`;
    return vec3;
  });
}

export class GLProgram {

  constructor(gl, shaderSources) {
    this.gl = gl
    this.program = gl.createProgram()
    const shaders = shaderSources.map(([type, code]) =>
      this.compileShader(type, code)
    )
    for (const shader of shaders) {
      gl.attachShader(this.program, shader)
    }
    gl.linkProgram(this.program)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(this.program)
      gl.deleteProgram(this.program)
      throw `failed to compile glsl shader program: ${error}`
    }
    for (const shader of shaders) {
      gl.deleteShader(this.shader)
    }
  }

  use() {
    this.gl.useProgram(this.program)
  }

  uniforms = {}
  u(name) {
    return this.uniforms[name] ?? (this.uniforms[name] = this.gl.getUniformLocation(this.program, name))
  }

  attributes = {}
  a(name) {
    return this.attributes[name] ?? (this.attributes[name] = this.gl.getAttribLocation(this.program, name))
  }

  compileShader(type, code) {
    const { gl } = this
    const shader = gl.createShader(type)
    gl.shaderSource(shader, code)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw `failed to compile glsl shader: ${error}`
    }
    return shader
  }

  destroy() {
    this.gl.deleteProgram(this.program)
  }
}

export class GLBuffer {
  constructor(gl, ArrayClass = Float32Array, initialSize = 1024) {
    this.gl = gl
    this.ArrayClass = ArrayClass
    this.array = new ArrayClass(initialSize)
    this.position = 0

    this.buffer = gl.createBuffer()
  }

  clear() {
    this.position = 0
  }

  size() {
    return this.position
  }

  add(a) {
    this._ensureCapacity(+1)
    this.array[this.position++] = a
  }

  add2(a, b) {
    this._ensureCapacity(+2)
    this.array[this.position++] = a
    this.array[this.position++] = b
  }

  add3(a, b, c) {
    this._ensureCapacity(+3)
    this.array[this.position++] = a
    this.array[this.position++] = b
    this.array[this.position++] = c
  }

  addAll(array) {
    this._ensureCapacity(array.length)
    this.array.set(array, this.position)
    this.position += array.length
  }

  _ensureCapacity(plus) {
    if (this.position + plus >= this.array.length) {
      const newSize = Math.max(this.array.length * 2, this.position + plus + 1)
      const newArray = new this.ArrayClass(newSize)
      newArray.set(this.array, 0)
      this.array = newArray
    }
  }

  upload(target, usage) {
    this.gl.bindBuffer(target, this.buffer)
    this.gl.bufferData(target, this.array, usage, 0, this.position)
  }

  destroy() {
    this.gl.deleteBuffer(this.buffer)
  }
}

export class GLTexture {
  constructor(gl, img) {
    this.gl = gl
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  bind() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
  }

  getTexture() {
    return this.texture
  }

  destroy() {
    this.gl.deleteTexture(this.texture)
  }
}

const isLittleEndian = () => {
  const arrayBuffer = new ArrayBuffer(2);
  const uint8Array = new Uint8Array(arrayBuffer);
  const uint16array = new Uint16Array(arrayBuffer);
  uint8Array[0] = 0xAA;
  uint8Array[1] = 0xBB;
  return uint16array[0] === 0xBBAA;
}
const swapToBigEndian = (buffer) => {
  if (!isLittleEndian()) return buffer
  const view = new DataView(buffer);
  for (let i = 0; i < buffer.byteLength; i += 4) {
    const value = view.getUint32(i, false)
    view.setUint32(i, value, true)
  }
  return buffer;
}
export const readBINOBJ = arrayBuffer => {
  const buffer = swapToBigEndian(arrayBuffer)
  const intArray = new Int32Array(buffer)
  const floatArray = new Float32Array(buffer)

  let position = 0
  const readInt = () => intArray[position++]
  const readFloat = () => floatArray[position++]

  let n

  n = readInt()
  const vertices = []
  for (let i = 0; i < n; ++i) {
    vertices.push(readFloat())
  }

  n = readInt()
  const textures = []
  for (let i = 0; i < n; ++i) {
    textures.push(readFloat())
  }

  n = readInt()
  const normals = []
  for (let i = 0; i < n; ++i) {
    normals.push(readFloat())
  }

  n = readInt()
  const faceIndexes = []
  for (let i = 0; i < n; ++i) {
    faceIndexes.push([
      readInt(), // vertex index
      readInt(), // texture index
      readInt()  // normal index
    ])
  }

  return {
    vertices,
    textures,
    normals,
    faceIndexes
  }
}