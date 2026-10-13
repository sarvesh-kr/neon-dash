/* Bounded WebGL2 shadows, HDR where supported, bloom, edge smoothing, and filmic color. */
(() => {
  'use strict';
  const FULLSCREEN = `#version 300 es
    out vec2 vUV;
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
      vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const SHADOW_VERTEX = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPosition;
    layout(location=2) in vec3 iPosition;
    layout(location=3) in vec3 iScale;
    layout(location=4) in vec4 iRotation;
    uniform mat4 uLight;
    void main() {
      vec3 p = aPosition * iScale;
      p += 2.0 * cross(iRotation.xyz, cross(iRotation.xyz,p) + iRotation.w*p);
      gl_Position = uLight * vec4(p + iPosition, 1.0);
    }`;
  const SHADOW_FRAGMENT = `#version 300 es
    precision highp float;
    void main() { }`;
  const EXTRACT = `#version 300 es
    precision highp float;
    in vec2 vUV; uniform sampler2D uImage; uniform float uHDR;
    out vec4 outputColor;
    void main() {
      vec3 color = texture(uImage,vUV).rgb;
      float light = max(color.r,max(color.g,color.b));
      float threshold = mix(0.65,1.05,uHDR);
      color *= smoothstep(threshold, threshold+0.6,light);
      outputColor = vec4(color,1.0);
    }`;
  const BLUR = `#version 300 es
    precision highp float;
    in vec2 vUV; uniform sampler2D uImage; uniform vec2 uStep;
    out vec4 outputColor;
    void main() {
      vec3 color = texture(uImage,vUV).rgb * 0.227027;
      color += (texture(uImage,vUV+uStep*1.384615).rgb + texture(uImage,vUV-uStep*1.384615).rgb)*0.316216;
      color += (texture(uImage,vUV+uStep*3.230769).rgb + texture(uImage,vUV-uStep*3.230769).rgb)*0.070270;
      outputColor = vec4(color,1.0);
    }`;
  const COMPOSITE = `#version 300 es
    precision highp float;
    in vec2 vUV;
    uniform sampler2D uImage; uniform sampler2D uDepth; uniform sampler2D uBloom;
    uniform vec2 uPixel; uniform float uHDR; uniform float uGlow; uniform vec3 uGrade;
    out vec4 outputColor;
    float luma(vec3 c) { return dot(c,vec3(0.2126,0.7152,0.0722)); }
    float distanceAt(vec2 uv) { float d = texture(uDepth,uv).r; return 240.0 / (240.0-d*239.0); }
    vec3 filmic(vec3 color) { return clamp((color*(2.51*color+0.03))/(color*(2.43*color+0.59)+0.14),0.0,1.0); }
    void main() {
      vec3 c = texture(uImage,vUV).rgb;
      vec3 n = texture(uImage,vUV+vec2(0.0,uPixel.y)).rgb;
      vec3 s = texture(uImage,vUV-vec2(0.0,uPixel.y)).rgb;
      vec3 e = texture(uImage,vUV+vec2(uPixel.x,0.0)).rgb;
      vec3 w = texture(uImage,vUV-vec2(uPixel.x,0.0)).rgb;
      float low = min(luma(c),min(min(luma(n),luma(s)),min(luma(e),luma(w))));
      float high = max(luma(c),max(max(luma(n),luma(s)),max(luma(e),luma(w))));
      float edge = smoothstep(0.08,0.40,(high-low)/max(0.1,high));
      c = mix(c,(n+s+e+w+c*2.0)/6.0,edge*0.58);
      float depth = distanceAt(vUV);
      float outline = max(max(abs(depth-distanceAt(vUV+vec2(uPixel.x,0.0))),abs(depth-distanceAt(vUV-vec2(uPixel.x,0.0)))),
        max(abs(depth-distanceAt(vUV+vec2(0.0,uPixel.y))),abs(depth-distanceAt(vUV-vec2(0.0,uPixel.y)))));
      c *= 1.0-smoothstep(0.025,0.10,outline/max(1.0,depth))*0.10;
      if(uGlow>0.0) c += texture(uBloom,vUV).rgb*uGlow;
      c *= uGrade;
      if(uHDR>0.5) c = filmic(c*1.10);
      c = pow(max(c,vec3(0.0)),vec3(1.0/2.2));
      vec2 q = vUV-0.5;
      c *= 1.0-smoothstep(0.12,0.60,dot(q,q))*0.13;
      float dither = fract(dot(gl_FragCoord.xy,vec2(0.06711,0.00583))*52.98291)-0.5;
      outputColor=vec4(c+dither/255.0,1.0);
    }`;

  function lightMatrix() {
    // A fixed orthographic sun frustum covers the runner and nearby scenery.
    const eye = [-15, 27, 3],
      target = [0, 0, 22];
    const z = eye.map((value, i) => value - target[i]);
    let length = Math.hypot(...z);
    for (let i = 0; i < 3; i++) z[i] /= length;
    const x = [z[2], 0, -z[0]];
    length = Math.hypot(...x);
    for (let i = 0; i < 3; i++) x[i] /= length;
    const y = [z[1] * x[2], z[2] * x[0] - z[0] * x[2], -z[1] * x[0]];
    const out = new Float32Array(16),
      sx = 1 / 15,
      sy = 1 / 23,
      sz = -2 / 85;
    out[0] = x[0] * sx;
    out[4] = x[1] * sx;
    out[8] = x[2] * sx;
    out[1] = y[0] * sy;
    out[5] = y[1] * sy;
    out[9] = y[2] * sy;
    out[2] = z[0] * sz;
    out[6] = z[1] * sz;
    out[10] = z[2] * sz;
    out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]) * sx;
    out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]) * sy;
    out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]) * sz - 1;
    out[15] = 1;
    return out;
  }
  class Pipeline {
    constructor(owner) {
      this.owner = owner;
      this.gl = owner.gl;
      this.light = lightMatrix();
      const gl = this.gl;
      this.hdr = !!gl.getExtension('EXT_color_buffer_float');
      this.shadowProgram = owner.program(SHADOW_VERTEX, SHADOW_FRAGMENT);
      this.extractProgram = owner.program(FULLSCREEN, EXTRACT);
      this.blurProgram = owner.program(FULLSCREEN, BLUR);
      this.postProgram = owner.program(FULLSCREEN, COMPOSITE);
      this.shadowUniform = gl.getUniformLocation(this.shadowProgram, 'uLight');
      this.extract = {
        image: gl.getUniformLocation(this.extractProgram, 'uImage'),
        hdr: gl.getUniformLocation(this.extractProgram, 'uHDR'),
      };
      this.blur = {
        image: gl.getUniformLocation(this.blurProgram, 'uImage'),
        step: gl.getUniformLocation(this.blurProgram, 'uStep'),
      };
      this.post = Object.fromEntries(
        ['Image', 'Depth', 'Bloom', 'Pixel', 'HDR', 'Glow', 'Grade'].map((name) => [
          name,
          gl.getUniformLocation(this.postProgram, `u${name}`),
        ]),
      );
      this.scene = this.target(true);
      this.shadow = this.target(false);
      this.a = this.target(true, false);
      this.b = this.target(true, false);
      this.width = this.height = 0;
      this.shadowSize = 0;
      this.bloomWidth = this.bloomHeight = 0;
      this.drawCalls = 0;
      this.shadows = false;
      this.bloom = false;
    }
    texture(depth) {
      const gl = this.gl,
        texture = this.owner.resource('Texture', gl.createTexture());
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, depth ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, depth ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    }
    target(color, depth = true) {
      const gl = this.gl,
        fbo = this.owner.resource('Framebuffer', gl.createFramebuffer());
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      const target = {
        fbo,
        color: color ? this.texture(false) : null,
        depth: depth ? this.texture(true) : null,
      };
      if (target.color)
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          target.color,
          0,
        );
      if (target.depth)
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          target.depth,
          0,
        );
      if (!color) {
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);
      }
      return target;
    }
    allocate(texture, width, height, depth) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        depth ? gl.DEPTH_COMPONENT24 : this.hdr ? gl.RGBA16F : gl.RGBA8,
        width,
        height,
        0,
        depth ? gl.DEPTH_COMPONENT : gl.RGBA,
        depth ? gl.UNSIGNED_INT : this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
    }
    resize(width, height, quality, scale) {
      const gl = this.gl;
      this.shadows = quality !== 'smooth' && (quality === 'detailed' || scale > 0.7);
      this.bloom = quality !== 'smooth' && (quality === 'detailed' || scale > 0.7);
      const shadowSize = this.shadows ? (quality === 'detailed' ? 1024 : 768) : 1;
      if (width !== this.width || height !== this.height) {
        this.width = width;
        this.height = height;
        this.allocate(this.scene.color, width, height, false);
        this.allocate(this.scene.depth, width, height, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && this.hdr) {
          this.hdr = false;
          this.allocate(this.scene.color, width, height, false);
        }
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
          throw new Error('Scene framebuffer unavailable');
      }
      if (shadowSize !== this.shadowSize) {
        this.shadowSize = shadowSize;
        this.allocate(this.shadow.depth, shadowSize, shadowSize, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.fbo);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
          throw new Error('Shadow framebuffer unavailable');
        gl.viewport(0, 0, shadowSize, shadowSize);
        gl.clear(gl.DEPTH_BUFFER_BIT);
      }
      const bw = this.bloom ? Math.max(1, Math.floor(width / 4)) : 1,
        bh = this.bloom ? Math.max(1, Math.floor(height / 4)) : 1;
      if (bw !== this.bloomWidth || bh !== this.bloomHeight) {
        this.bloomWidth = bw;
        this.bloomHeight = bh;
        this.allocate(this.a.color, bw, bh, false);
        this.allocate(this.b.color, bw, bh, false);
        for (const target of [this.a, this.b]) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error('Bloom framebuffer unavailable');
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    shadowPass(batches) {
      const gl = this.gl;
      this.drawCalls = 0;
      if (!this.shadows) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.fbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2, 3);
      gl.useProgram(this.shadowProgram);
      gl.uniformMatrix4fv(this.shadowUniform, false, this.light);
      for (const batch of batches) {
        if (!batch.count) continue;
        gl.bindVertexArray(batch.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, batch.vertices, batch.count);
        this.drawCalls++;
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    begin() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
      gl.viewport(0, 0, this.width, this.height);
    }
    image(program, fbo, width, height, texture) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(this.owner.skyVAO);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }
    finish(theme) {
      const gl = this.gl;
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      if (this.bloom) {
        this.image(
          this.extractProgram,
          this.a.fbo,
          this.bloomWidth,
          this.bloomHeight,
          this.scene.color,
        );
        gl.uniform1i(this.extract.image, 0);
        gl.uniform1f(this.extract.hdr, this.hdr ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.image(this.blurProgram, this.b.fbo, this.bloomWidth, this.bloomHeight, this.a.color);
        gl.uniform1i(this.blur.image, 0);
        gl.uniform2f(this.blur.step, 1 / this.bloomWidth, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.image(this.blurProgram, this.a.fbo, this.bloomWidth, this.bloomHeight, this.b.color);
        gl.uniform2f(this.blur.step, 0, 1 / this.bloomHeight);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.drawCalls += 3;
      }
      this.image(this.postProgram, null, this.width, this.height, this.scene.color);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.scene.depth);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.a.color);
      gl.uniform1i(this.post.Image, 0);
      gl.uniform1i(this.post.Depth, 1);
      gl.uniform1i(this.post.Bloom, 2);
      gl.uniform2f(this.post.Pixel, 1 / this.width, 1 / this.height);
      gl.uniform1f(this.post.HDR, this.hdr ? 1 : 0);
      gl.uniform1f(this.post.Glow, this.bloom ? 0.22 : 0);
      gl.uniform3fv(this.post.Grade, theme.grade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawCalls++;
      gl.depthMask(true);
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
    }
    get pixels() {
      return (
        this.width * this.height * 2 +
        this.shadowSize * this.shadowSize +
        this.bloomWidth * this.bloomHeight * 2
      );
    }
  }
  window.NeonPipeline = { create: (owner) => new Pipeline(owner) };
})();
