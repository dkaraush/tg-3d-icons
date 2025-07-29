#version 300 es

precision highp float;

uniform mat4 uMVPMatrix;

in vec2 a_TexCoordinate;
in vec3 a_Normal;
in vec3 vPosition;

out vec3 vNormal;
out vec2 vUV;
out vec3 modelViewVertex;
out float depth;

void main() {
  vUV = a_TexCoordinate;
  vNormal = a_Normal;
  gl_Position = uMVPMatrix * vec4(vPosition, 1.0);
  modelViewVertex = vPosition;
  depth = gl_Position.z;
}