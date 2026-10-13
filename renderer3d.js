/* Original instanced city. Fixed pools, procedural materials, and a local glyph atlas. */
(() => {
  'use strict';
  const STRIDE = 16;
  const HALF = Math.SQRT1_2;
  const SIDES = [-1, 1];
  const COLORS = {
    navy: 0x263955,
    ink: 0x192941,
    cream: 0xfff0cf,
    white: 0xf6f6ed,
    yellow: 0xffd34e,
    coral: 0xff826b,
    pink: 0xe984c0,
    blue: 0x61bde2,
    mint: 0x72e3b3,
    purple: 0xa58ce3,
    glass: 0x294766,
    rail: 0xbac4cd,
    ground: 0x546575,
    pavement: 0xc4b8aa,
    green: 0x79bb7b,
    skin: 0xffcb56,
  };
  const THEMES = [
    {
      top: [0.14, 0.32, 0.53],
      bottom: [0.96, 0.59, 0.42],
      fog: [0.76, 0.59, 0.59],
      colors: [0xef876b, 0xf6c384, 0x71accc, 0xe4a2bf],
      grade: [1.035, 1, 1.015],
      light: [0.85, 0.78],
    },
    {
      top: [0.1, 0.07, 0.26],
      bottom: [0.46, 0.24, 0.49],
      fog: [0.43, 0.28, 0.46],
      colors: [0xa482bd, 0xd98eae, 0xf0cba5, 0x72b5b0],
      grade: [1.01, 0.99, 1.055],
      light: [0.32, 0.48],
    },
    {
      top: [0.15, 0.53, 0.75],
      bottom: [0.68, 0.87, 0.87],
      fog: [0.63, 0.79, 0.81],
      colors: [0x6caebc, 0x9bc5b2, 0xf0be78, 0xc6cce0],
      grade: [0.985, 1.015, 1.045],
      light: [0.92, 0.83],
    },
  ];
  const VERTEX = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPosition;
    layout(location=1) in vec3 aNormal;
    layout(location=2) in vec3 iPosition;
    layout(location=3) in vec3 iScale;
    layout(location=4) in vec4 iRotation;
    layout(location=5) in vec4 iColor;
    layout(location=6) in vec2 iMaterial;
    uniform vec4 uCamera; uniform vec2 uView; uniform mat4 uLight;
    out vec3 vNormal; out vec3 vColor; out vec3 vMaterial;
    out vec3 vWorld; out vec3 vLocal; out vec3 vShadow; out float vDepth;
    vec3 rotate(vec3 v,vec4 q) {return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
    void main() {
      vec3 world=rotate(aPosition*iScale,iRotation)+iPosition;
      vec3 delta=world-uCamera.xyz;
      float c=cos(uCamera.w),s=sin(uCamera.w);
      vec3 view=vec3(delta.x,c*delta.y+s*delta.z,c*delta.z-s*delta.y);
      gl_Position=vec4(view.x*uView.x/uView.y,view.y*uView.x,1.0083682*view.z-2.0083682,view.z);
      vNormal=normalize(rotate(aNormal/iScale,iRotation));
      vColor=pow(iColor.rgb,vec3(2.2));vMaterial=vec3(iMaterial,iColor.a);
      vWorld=world;vLocal=aPosition;vShadow=(uLight*vec4(world,1.0)).xyz*0.5+0.5;vDepth=view.z;
    }`;
  const FRAGMENT = `#version 300 es
    precision highp float;
    in vec3 vNormal; in vec3 vColor; in vec3 vMaterial;
    in vec3 vWorld; in vec3 vLocal; in vec3 vShadow; in float vDepth;
    uniform vec3 uFog; uniform vec3 uTop; uniform vec3 uBottom; uniform vec2 uLighting;
    uniform vec4 uCamera; uniform float uTravel; uniform float uShadows; uniform float uShadowPixel;
    uniform sampler2D uShadowMap; uniform sampler2D uAtlas; uniform int uRenderMode;
    out vec4 outputColor;
    vec3 filmic(vec3 c) {return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0);}
    float shadow(float sun) {
      if(uShadows<0.5 || min(min(vShadow.x,vShadow.y),vShadow.z)<0.0 || max(max(vShadow.x,vShadow.y),vShadow.z)>1.0)return 1.0;
      float bias=max(0.00022,0.00065*(1.0-sun)),sum=0.0;
      for(int x=0;x<2;x++)for(int y=0;y<2;y++) {
        float d=texture(uShadowMap,vShadow.xy+(vec2(float(x),float(y))-0.5)*uShadowPixel*1.6).r;
        sum+=step(vShadow.z-bias,d);
      }
      return mix(0.38,1.0,sum*0.25);
    }
    void main() {
      vec3 n=normalize(vNormal),eye=normalize(uCamera.xyz-vWorld);
      vec3 light=normalize(vec3(-0.45,0.85,-0.50)),halfway=normalize(light+eye);
      float sun=max(0.0,dot(n,light)),visibility=shadow(sun);
      float gloss=vMaterial.x,metal=smoothstep(0.86,0.98,gloss),rough=max(0.075,0.65-gloss*0.48);
      vec3 base=vColor;
      float material=vMaterial.z;
      if(material>0.5 && material<2.5) {
        vec2 cell=material<1.5?vec2(abs(n.x)>0.6?vWorld.z+uTravel:vWorld.x,vWorld.y)*vec2(1.7,3.5):vec2(vWorld.x*2.0,(vWorld.z+uTravel)*1.5);
        if(material<1.5)cell.x+=step(0.5,fract(cell.y*0.5))*0.5;
        float seam=smoothstep(0.465,0.495,max(abs(fract(cell.x)-0.5),abs(fract(cell.y)-0.5)));
        base*=1.0-seam*0.12*(1.0-smoothstep(18.0,60.0,vDepth));
      }
      if(material>4.5 && material<5.5)base*=0.87+0.13*sin((vLocal.y+sin(vLocal.x*16.0)*0.025)*85.0);
      if(material>6.5 && material<7.5) {
        vec2 uv=vLocal.xy;float rings=sin(length(uv-vec2(0.1,0.0))*27.0);
        base=mix(base,vec3(0.9,0.15,0.35),smoothstep(0.3,0.6,rings));
        base=mix(base,vec3(0.02,0.65,0.6),1.0-smoothstep(0.03,0.045,abs(uv.y-uv.x*0.6+0.12)));
      }
      if(material>7.5 && material<9.5) {
        float weave=sin(vLocal.x*110.0)*sin(vLocal.y*110.0);
        float detail=1.0-smoothstep(0.2,0.9,max(fwidth(vLocal.x),fwidth(vLocal.y))*110.0);
        base*=1.0-weave*detail*0.035;
      }
      if(material>=100.0) {
        float glyph=mod(material,100.0);
        vec2 glyphUV=clamp(vLocal.xy+0.5,0.015,0.985);
        if(vLocal.z>0.49)glyphUV.x=1.0-glyphUV.x;
        vec2 uv=(vec2(mod(glyph,4.0),3.0-floor(glyph/4.0))+glyphUV)/4.0;
        float ink=texture(uAtlas,uv).a;
        base=mix(base,material>=200.0?base*0.12:vec3(1.0),ink);
      }
      vec3 ambient=mix(vec3(0.24,0.20,0.27),vec3(0.53,0.64,0.76),n.y*0.5+0.5);
      vec3 color=base*(ambient*uLighting.y+sun*visibility*uLighting.x*vec3(1.65,1.38,1.10))*(1.0-metal*0.35);
      float nh=max(0.0,dot(n,halfway)),a2=rough*rough*rough*rough;
      float spec=min(6.0,a2/(3.14159*pow(nh*nh*(a2-1.0)+1.0,2.0)));
      vec3 f0=mix(vec3(0.035),base,metal);
      color+=spec*f0*sun*visibility*uLighting.x*0.65;
      float reflected=clamp(reflect(-eye,n).y*0.5+0.5,0.0,1.0);
      vec3 reflection=mix(pow(uBottom,vec3(2.2)),pow(uTop,vec3(2.2)),reflected);
      float fresnel=pow(1.0-max(0.0,dot(n,eye)),4.0);
      if(material>3.5 && material<4.5)color=mix(color,reflection*1.15,0.55+fresnel*0.3);
      color+=reflection*fresnel*(0.1+gloss*0.28);
      color+=base*vMaterial.y*3.2;
      float fog=1.0-exp(-pow(max(0.0,vDepth-25.0)/155.0,1.65));
      color=mix(color,pow(uFog,vec3(2.2)),fog);
      if(uRenderMode>0)color=filmic(color*1.10);
      if(uRenderMode>1)color=pow(color,vec3(1.0/2.2));
      outputColor=vec4(color,1.0);
    }`;
  const SKY_VERTEX = `#version 300 es
    void main() {
      vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
      gl_Position=vec4(p*2.0-1.0,0.9999,1.0);
    }`;
  const SKY_FRAGMENT = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform vec3 uTop; uniform vec3 uBottom;
    uniform float uTime; uniform int uRenderMode; out vec4 outputColor;
    float noise(vec2 p) {
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+1.0,vec2(127.1,311.7))))*43758.5453);
      return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
    }
    void main() {
      vec2 uv=gl_FragCoord.xy/uSize;
      vec3 sky=pow(mix(uBottom,uTop,smoothstep(0.24,1.0,uv.y)),vec3(2.2));
      vec2 sun=(uv-vec2(0.76,0.74))*vec2(uSize.x/uSize.y,1.0);
      sky+=exp(-length(sun)*12.0)*vec3(0.50,0.24,0.06);
      sky+=vec3(3.8,2.8,1.4)*(1.0-smoothstep(0.037,0.042,length(sun)));
      vec2 p=uv*vec2(9.0*uSize.x/uSize.y,6.0)+vec2(uTime*0.012,0.0);
      float cloud=noise(p)*0.7+noise(p*2.1)*0.3;
      sky=mix(sky,vec3(0.85,0.68,0.67),smoothstep(0.58,0.79,cloud)*smoothstep(0.4,0.75,uv.y)*0.55);
      if(uRenderMode>0)sky=clamp((sky*(2.51*sky+0.03))/(sky*(2.43*sky+0.59)+0.14),0.0,1.0);
      if(uRenderMode>1)sky=pow(sky,vec3(1.0/2.2));
      outputColor=vec4(sky,1.0);
    }`;

  function mesh(kind) {
    const data = [];
    function vertex(x, y, z, nx, ny, nz) {
      data.push(x, y, z, nx, ny, nz);
    }
    if (kind === 'cube') {
      for (let axis = 0; axis < 3; axis++)
        for (const side of SIDES) {
          const normal = [0, 0, 0];
          normal[axis] = side;
          for (const corner of [0, 1, 2, 0, 2, 3]) {
            const p = [0, 0, 0];
            p[axis] = side * 0.5;
            p[(axis + 1) % 3] = [-0.5, 0.5, 0.5, -0.5][corner];
            p[(axis + 2) % 3] = [-0.5, -0.5, 0.5, 0.5][corner];
            vertex(...p, ...normal);
          }
        }
    } else if (kind === 'rounded') {
      const grid = [-0.5, -0.42, 0, 0.42, 0.5];
      for (let axis = 0; axis < 3; axis++)
        for (const side of SIDES)
          for (let row = 0; row < 4; row++)
            for (let col = 0; col < 4; col++) {
              for (const corner of [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
                [1, 1],
                [0, 1],
              ]) {
                const position = [0, 0, 0];
                position[axis] = side * 0.5;
                position[(axis + 1) % 3] = grid[row + corner[0]];
                position[(axis + 2) % 3] = grid[col + corner[1]];
                const center = position.map((value) => Math.max(-0.42, Math.min(0.42, value)));
                const normal = position.map((value, index) => value - center[index]);
                const length = Math.hypot(...normal);
                for (let index = 0; index < 3; index++) normal[index] /= length;
                vertex(...center.map((value, index) => value + normal[index] * 0.08), ...normal);
              }
            }
    } else if (kind === 'cylinder') {
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          b = ((i + 1) * Math.PI) / 12;
        const ax = Math.cos(a),
          az = Math.sin(a),
          bx = Math.cos(b),
          bz = Math.sin(b);
        for (const p of [
          [ax, -1, az],
          [bx, -1, bz],
          [bx, 1, bz],
          [ax, -1, az],
          [bx, 1, bz],
          [ax, 1, az],
        ])
          vertex(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5, p[0], 0, p[2]);
        for (const side of SIDES) {
          vertex(0, side * 0.5, 0, 0, side, 0);
          vertex(ax * 0.5, side * 0.5, az * 0.5, 0, side, 0);
          vertex(bx * 0.5, side * 0.5, bz * 0.5, 0, side, 0);
        }
      }
    } else if (kind === 'turned') {
      const profile = [
        [-0.5, 0.41],
        [-0.46, 0.48],
        [-0.38, 0.5],
        [0.38, 0.5],
        [0.46, 0.48],
        [0.5, 0.41],
      ];
      for (let row = 0; row < profile.length - 1; row++)
        for (let col = 0; col < 24; col++) {
          const dy = profile[row + 1][0] - profile[row][0],
            dr = profile[row + 1][1] - profile[row][1],
            length = Math.hypot(dy, dr);
          for (const [u, v] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
            [1, 1],
            [0, 1],
          ]) {
            const a = ((col + v) * Math.PI) / 12,
              [y, r] = profile[row + u];
            vertex(
              Math.cos(a) * r,
              y,
              Math.sin(a) * r,
              (Math.cos(a) * dy) / length,
              -dr / length,
              (Math.sin(a) * dy) / length,
            );
          }
        }
      for (const side of SIDES)
        for (let i = 0; i < 24; i++) {
          const a = (i * Math.PI) / 12,
            b = ((i + 1) * Math.PI) / 12;
          vertex(0, side * 0.5, 0, 0, side, 0);
          vertex(Math.cos(a) * 0.41, side * 0.5, Math.sin(a) * 0.41, 0, side, 0);
          vertex(Math.cos(b) * 0.41, side * 0.5, Math.sin(b) * 0.41, 0, side, 0);
        }
    } else if (kind === 'grip') {
      // Molded C-shaped toy hands, including capped ends of the opening.
      for (let ring = 0; ring < 18; ring++)
        for (let tube = 0; tube < 8; tube++)
          for (const [u, v] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
            [1, 1],
            [0, 1],
          ]) {
            const a = Math.PI / 4 + ((ring + u) * Math.PI) / 12,
              b = ((tube + v) * Math.PI) / 4,
              r = 0.35 + 0.15 * Math.cos(b);
            vertex(
              Math.cos(a) * r,
              Math.sin(a) * r,
              Math.sin(b) * 0.15,
              Math.cos(a) * Math.cos(b),
              Math.sin(a) * Math.cos(b),
              Math.sin(b),
            );
          }
      for (const side of SIDES)
        for (let i = 0; i < 8; i++) {
          const a = side < 0 ? Math.PI / 4 : (Math.PI * 7) / 4,
            b = (i * Math.PI) / 4,
            c = ((i + 1) * Math.PI) / 4;
          const nx = -Math.sin(a) * side,
            ny = Math.cos(a) * side;
          vertex(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0, nx, ny, 0);
          for (const angle of [b, c])
            vertex(
              Math.cos(a) * (0.35 + 0.15 * Math.cos(angle)),
              Math.sin(a) * (0.35 + 0.15 * Math.cos(angle)),
              Math.sin(angle) * 0.15,
              nx,
              ny,
              0,
            );
        }
    } else if (kind === 'torus') {
      for (let ring = 0; ring < 24; ring++)
        for (let tube = 0; tube < 8; tube++)
          for (const [u, v] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
            [1, 1],
            [0, 1],
          ]) {
            const a = ((ring + u) * Math.PI) / 12,
              b = ((tube + v) * Math.PI) / 4,
              r = 0.41 + 0.09 * Math.cos(b);
            vertex(
              Math.cos(a) * r,
              Math.sin(a) * r,
              Math.sin(b) * 0.09,
              Math.cos(a) * Math.cos(b),
              Math.sin(a) * Math.cos(b),
              Math.sin(b),
            );
          }
    } else {
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 16; col++) {
          for (const corner of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
            [1, 1],
            [0, 1],
          ]) {
            const lat = ((row + corner[0]) * Math.PI) / 8,
              lon = ((col + corner[1]) * Math.PI) / 8;
            const x = Math.sin(lat) * Math.cos(lon),
              y = Math.cos(lat),
              z = Math.sin(lat) * Math.sin(lon);
            vertex(x * 0.5, y * 0.5, z * 0.5, x, y, z);
          }
        }
    }
    return new Float32Array(data);
  }
  const MESHES = {
    cube: mesh('cube'),
    cylinder: mesh('cylinder'),
    sphere: mesh('sphere'),
    rounded: mesh('rounded'),
    torus: mesh('torus'),
    turned: mesh('turned'),
    grip: mesh('grip'),
  };
  const PROFILES = Array.from({ length: 64 }, (_, i) => ({
    height: 2.7 + ((i * 17) % 23) * 0.18,
    width: 2.3 + ((i * 7) % 11) * 0.1,
    color: i % 4,
    windows: 2 + (i % 3),
  }));

  class Renderer {
    constructor(surface, geometry) {
      this.geometry = geometry;
      if (!window.NeonRunnerModel) throw new Error('Runner model unavailable');
      this.runner = window.NeonRunnerModel.create(this);
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'world-canvas';
      this.canvas.width = this.canvas.height = 1;
      this.canvas.setAttribute('aria-hidden', 'true');
      this.gl = this.canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
      if (!this.gl) throw new Error('WebGL2 unavailable');
      this.resources = [];
      this.batches = [
        ['cube', 4096],
        ['cylinder', 384],
        ['sphere', 384],
        ['rounded', 256],
        ['torus', 256],
        ['turned', 64],
        ['grip', 32],
      ].map(([kind, capacity]) => ({
        kind,
        mesh: MESHES[kind],
        capacity,
        data: new Float32Array(capacity * STRIDE),
        count: 0,
      }));
      this.points = Array.from({ length: 16 }, () => ({ x: 0, y: 0, scale: 1 }));
      this.pointCursor = 0;
      this.width = this.height = 1;
      this.eyeX = 0;
      this.eyeY = 2.9;
      this.eyeZ = -1;
      this.pitch = 0.1;
      this.focal = 1 / Math.tan((24.5 * Math.PI) / 180);
      this.quality = 'auto';
      this.scale = 1;
      this.samples = 0;
      this.elapsed = 0;
      this.lastColor = '';
      this.color = COLORS.mint;
      this.lost = false;
      this.released = false;
      this.disabled = false;
      this.state = { drawCalls: 0, instances: 0, triangles: 0, overflow: 0 };
      this.pose = { lane: 1, jump: 0, crouch: 0, height: geometry.runner.height };

      try {
        if (document.hidden) this.released = true;
        else this.initialize();
      } catch (error) {
        this.releaseGPU();
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
        throw error;
      }
      surface.before(this.canvas);
      this.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.lost = true;
        this.releaseGPU();
        this.released = true;
        this.canvas.width = this.canvas.height = 1;
        this.canvas.hidden = true;
        this.onChange?.();
      });
      this.canvas.addEventListener('webglcontextrestored', () => {
        this.lost = false;
        this.disabled = false;
        try {
          if (!document.hidden) this.initialize();
          else this.released = true;
          this.canvas.hidden = false;
        } catch (_) {
          this.releaseGPU();
          this.disabled = true;
        }
        this.onChange?.();
      });
    }
    get active() {
      return !this.lost && !this.disabled;
    }
    resource(kind, value) {
      if (!value) throw new Error(`Unable to create ${kind}`);
      this.resources.push({ kind, value });
      return value;
    }
    program(vertex, fragment) {
      const gl = this.gl,
        program = this.resource('Program', gl.createProgram());
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ]) {
        const shader = this.resource('Shader', gl.createShader(type));
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error('Shader compilation failed');
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('Shader linking failed');
      return program;
    }
    initialize() {
      const gl = this.gl;
      this.sceneProgram = this.program(VERTEX, FRAGMENT);
      this.skyProgram = this.program(SKY_VERTEX, SKY_FRAGMENT);
      this.uniforms = {
        camera: gl.getUniformLocation(this.sceneProgram, 'uCamera'),
        view: gl.getUniformLocation(this.sceneProgram, 'uView'),
        fog: gl.getUniformLocation(this.sceneProgram, 'uFog'),
        travel: gl.getUniformLocation(this.sceneProgram, 'uTravel'),
        top: gl.getUniformLocation(this.sceneProgram, 'uTop'),
        lighting: gl.getUniformLocation(this.sceneProgram, 'uLighting'),
        bottom: gl.getUniformLocation(this.sceneProgram, 'uBottom'),
        light: gl.getUniformLocation(this.sceneProgram, 'uLight'),
        shadow: gl.getUniformLocation(this.sceneProgram, 'uShadowMap'),
        shadows: gl.getUniformLocation(this.sceneProgram, 'uShadows'),
        shadowPixel: gl.getUniformLocation(this.sceneProgram, 'uShadowPixel'),
        atlas: gl.getUniformLocation(this.sceneProgram, 'uAtlas'),
        mode: gl.getUniformLocation(this.sceneProgram, 'uRenderMode'),
      };
      this.skyUniforms = {
        size: gl.getUniformLocation(this.skyProgram, 'uSize'),
        top: gl.getUniformLocation(this.skyProgram, 'uTop'),
        bottom: gl.getUniformLocation(this.skyProgram, 'uBottom'),
        time: gl.getUniformLocation(this.skyProgram, 'uTime'),
        mode: gl.getUniformLocation(this.skyProgram, 'uRenderMode'),
      };
      this.skyVAO = this.resource('VertexArray', gl.createVertexArray());
      for (const batch of this.batches) {
        batch.vertices = batch.mesh.length / 6;
        batch.vao = this.resource('VertexArray', gl.createVertexArray());
        gl.bindVertexArray(batch.vao);
        const vertices = this.resource('Buffer', gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
        gl.bufferData(gl.ARRAY_BUFFER, batch.mesh, gl.STATIC_DRAW);
        for (let i = 0; i < 2; i++) {
          gl.enableVertexAttribArray(i);
          gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 24, i * 12);
        }
        batch.buffer = this.resource('Buffer', gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, batch.data.byteLength, gl.DYNAMIC_DRAW);
        for (const [location, size, offset] of [
          [2, 3, 0],
          [3, 3, 3],
          [4, 4, 6],
          [5, 4, 10],
          [6, 2, 14],
        ]) {
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
          gl.vertexAttribDivisor(location, 1);
        }
      }
      gl.bindVertexArray(null);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      this.atlas = this.createAtlas();
      if (!window.NeonPipeline) throw new Error('Render pipeline unavailable');
      this.pipeline = window.NeonPipeline.create(this);
      this.released = false;
    }
    createAtlas() {
      const gl = this.gl,
        canvas = (this.glyphCanvas ||= document.createElement('canvas'));
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Glyph canvas unavailable');
      ctx.clearRect(0, 0, 512, 256);
      ctx.font = '900 23px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      [
        'NEON',
        'ARCADE',
        'CAFE',
        'METRO',
        'HARBOR',
        'NIGHT',
        'ND',
        'VIOLET',
        'CITY RUN',
        'PLAY',
        'RUSH',
        'GO',
        '01',
        '02',
        '03',
        'DASH',
      ].forEach((label, i) =>
        ctx.fillText(label, (i % 4) * 128 + 64, Math.floor(i / 4) * 64 + 32, 120),
      );
      const texture = this.resource('Texture', gl.createTexture());
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return texture;
    }
    releaseGPU() {
      if (!this.lost)
        for (const resource of this.resources) this.gl[`delete${resource.kind}`](resource.value);
      this.resources.length = 0;
      this.sceneProgram =
        this.skyProgram =
        this.skyVAO =
        this.uniforms =
        this.skyUniforms =
        this.atlas =
        this.pipeline =
          null;
      if (this.glyphCanvas) this.glyphCanvas.width = this.glyphCanvas.height = 0;
      for (const batch of this.batches) batch.vao = batch.buffer = null;
    }
    release() {
      if (!this.lost) this.releaseGPU();
      this.released = true;
      this.canvas.width = this.canvas.height = 1;
      this.samples = this.elapsed = 0;
    }
    resize(width, height) {
      this.width = width;
      this.height = height;
      if (!this.active) return false;
      if (this.released) {
        try {
          this.initialize();
        } catch (_) {
          this.releaseGPU();
          this.disabled = true;
          this.canvas.hidden = true;
          this.onChange?.();
          return false;
        }
      }
      const budget =
        this.quality === 'smooth'
          ? 600000
          : this.quality === 'detailed'
            ? 1800000
            : 1200000 * this.scale;
      const dpr = Math.min(
        this.quality === 'smooth' ? 1 : 2,
        window.devicePixelRatio || 1,
        Math.sqrt(budget / (width * height)),
      );
      const w = Math.max(1, Math.floor(width * dpr)),
        h = Math.max(1, Math.floor(height * dpr));
      try {
        this.pipeline?.resize(w, h, this.quality, this.scale);
      } catch (_) {
        this.releaseGPU();
        this.disabled = true;
        this.canvas.hidden = true;
        this.onChange?.();
        return false;
      }
      if (this.canvas.width === w && this.canvas.height === h) return false;
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
      return true;
    }
    setQuality(value) {
      if (!['auto', 'smooth', 'detailed'].includes(value)) return;
      this.quality = value;
      this.scale = 1;
      this.samples = this.elapsed = 0;
      this.resize(this.width, this.height);
      this.onChange?.();
    }
    observeFrame(dt, running) {
      if (
        this.quality !== 'auto' ||
        !running ||
        !Number.isFinite(dt) ||
        dt <= 0 ||
        dt > 0.25 ||
        this.scale <= 0.55
      )
        return;
      this.elapsed += dt;
      this.samples++;
      if (this.samples >= 180 || (this.elapsed >= 2.5 && this.samples >= 20)) {
        if (this.elapsed / this.samples > 0.024) {
          this.scale = Math.max(0.55, this.scale * 0.75);
          this.resize(this.width, this.height);
        }
        this.samples = this.elapsed = 0;
      }
    }
    add(
      kind,
      x,
      y,
      z,
      sx,
      sy,
      sz,
      color,
      qx = 0,
      qy = 0,
      qz = 0,
      qw = 1,
      gloss = 0.15,
      emissive = 0,
      material = 0,
    ) {
      const batch = this.batches[kind];
      if (batch.count >= batch.capacity) {
        this.state.overflow++;
        return;
      }
      const data = batch.data;
      let index = batch.count++ * STRIDE;
      data[index++] = x;
      data[index++] = y;
      data[index++] = z;
      data[index++] = sx;
      data[index++] = sy;
      data[index++] = sz;
      data[index++] = qx;
      data[index++] = qy;
      data[index++] = qz;
      data[index++] = qw;
      data[index++] = ((color >> 16) & 255) / 255;
      data[index++] = ((color >> 8) & 255) / 255;
      data[index++] = (color & 255) / 255;
      data[index++] = material;
      data[index++] = gloss;
      data[index] = emissive;
    }
    box(x, y, z, sx, sy, sz, color, emissive = 0, material = 0) {
      this.add(0, x, y, z, sx, sy, sz, color, 0, 0, 0, 1, 0.1, emissive, material);
    }
    label(x, y, z, width, height, color, glyph, emissive = 0.2, rotation = 0, engraved = false) {
      this.add(
        0,
        x,
        y,
        z,
        width,
        height,
        0.022,
        color,
        0,
        Math.sin(rotation / 2),
        0,
        Math.cos(rotation / 2),
        0.25,
        emissive,
        (engraved ? 200 : 100) + glyph,
      );
    }
    facade(x, z, h, width, face, side, index, theme) {
      const district = THEMES.indexOf(theme),
        accent = theme.colors[(index + 1) % 4];
      this.box(x, h + 0.27, z, width + 0.35, 0.1, 8.6, COLORS.navy);
      // Front shop fascia and a painted mural are readable from the chase camera.
      this.box(x, 1.62, z - 4.22, width * 0.91, 0.55, 0.1, COLORS.ink);
      this.label(
        x,
        1.62,
        z - 4.28,
        width * 0.87,
        0.43,
        accent,
        [0, 1, 2, 3, 7, 5][index % 6],
        0.38,
      );
      this.box(x, 0.68, z - 4.21, width * 0.79, 1.02, 0.045, COLORS.glass, 0, 4);
      for (const column of [-1, 0, 1])
        this.box(x + column * width * 0.26, 0.68, z - 4.25, 0.045, 1.05, 0.055, COLORS.cream);
      this.box(x, h * 0.67, z - 4.23, width * 0.8, h * 0.26, 0.035, accent, 0, 7);
      // Roof air conditioners, ducts, and parapets have a bounded near-distance LOD.
      this.add(3, x - side * 0.4, h + 0.53, z - 1.8, 0.8, 0.53, 1.4, COLORS.cream, 0, 0, 0, 1, 0.4);
      for (let vent = 0; vent < 4; vent++)
        this.box(x - side * 0.4, h + 0.79, z - 2.23 + vent * 0.25, 0.65, 0.016, 0.07, COLORS.navy);
      this.add(
        1,
        x + side * 0.65,
        h + 0.4,
        z + 2.1,
        0.35,
        0.62,
        0.35,
        COLORS.rail,
        0,
        0,
        0,
        1,
        0.94,
      );
      for (let level = 0; level < Math.min(3, Math.floor(h / 1.8)); level++) {
        const y = 2.0 + level * 1.5;
        this.box(face - side * 0.23, y, z + 1.8, 0.5, 0.09, 1.7, COLORS.cream);
        this.box(face - side * 0.48, y + 0.24, z + 1.8, 0.035, 0.045, 1.7, COLORS.navy);
        for (let bar = 0; bar < 5; bar++)
          this.box(
            face - side * 0.48,
            y + 0.12,
            z + 1.1 + bar * 0.35,
            0.028,
            0.25,
            0.028,
            COLORS.navy,
          );
      }
      // Small hanging shop signs face the rails, with a glowing border.
      this.box(face - side * 0.36, 2.64, z - 2.2, 0.72, 0.06, 0.06, COLORS.navy);
      this.add(3, face - side * 0.65, 2.23, z - 2.2, 0.07, 0.64, 1.3, COLORS.ink);
      this.label(
        face - side * 0.7,
        2.23,
        z - 2.2,
        1.13,
        0.49,
        accent,
        (index + district * 4) % 6,
        0.45,
        (side * Math.PI) / 2,
      );
      this.box(face - side * 0.75, 1.96, z - 2.2, 0.035, 0.028, 1.2, accent, 0.6);
      if (district === 0) {
        // Cafe terraces, flower boxes, and a bike stand.
        this.add(1, side * 2.52, 0.52, z - 2.1, 0.62, 0.07, 0.62, COLORS.cream);
        this.add(1, side * 2.52, 0.25, z - 2.1, 0.055, 0.5, 0.055, COLORS.navy);
        for (const end of SIDES) {
          this.box(side * 2.55, 0.25, z - 2.1 + end * 0.61, 0.46, 0.07, 0.34, accent);
          this.box(side * 2.55, 0.16, z - 2.1 + end * 0.61, 0.055, 0.26, 0.3, COLORS.navy);
        }
        this.box(side * 2.62, 0.24, z + 1.75, 0.55, 0.42, 0.8, COLORS.cream);
        for (let flower = 0; flower < 3; flower++) {
          this.add(2, side * 2.62, 0.51, z + 1.5 + flower * 0.23, 0.29, 0.24, 0.29, COLORS.green);
          this.add(
            2,
            side * 2.61,
            0.65,
            z + 1.5 + flower * 0.23,
            0.1,
            0.1,
            0.1,
            index % 2 ? COLORS.pink : COLORS.yellow,
          );
        }
      } else if (district === 1) {
        // Lantern strings and arcade storefronts.
        this.box(side * 2.6, 3.04, z - 0.3, 0.04, 0.04, 4.9, COLORS.navy);
        for (let lamp = 0; lamp < 3; lamp++) {
          const phase = this.motionTime * 1.2 + index * 0.7 + lamp;
          const sway = this.motionReduced ? 0 : Math.sin(phase) * 0.045,
            zz = z - 1.7 + lamp * 1.4;
          this.limb(side * 2.6, 3.04, zz, side * 2.6 + sway, 2.66, zz, 0.013, COLORS.navy);
          this.add(
            2,
            side * 2.6 + sway,
            2.49,
            zz,
            0.28,
            0.39,
            0.28,
            lamp % 2 ? COLORS.yellow : COLORS.pink,
            0,
            0,
            0,
            1,
            0.3,
            this.motionReduced ? 0.52 : 0.52 + Math.sin(phase * 2) * 0.035,
          );
          for (const end of SIDES)
            this.add(1, side * 2.6 + sway, 2.49 + end * 0.175, zz, 0.13, 0.027, 0.13, COLORS.navy);
        }
        this.add(3, side * 2.65, 0.59, z + 2.0, 0.47, 1.17, 0.45, COLORS.purple);
        this.box(side * 2.39, 0.79, z + 2, 0.025, 0.4, 0.32, COLORS.glass, 0.3, 4);
        this.box(side * 2.38, 0.47, z + 2, 0.035, 0.06, 0.27, COLORS.mint, 0.5);
      } else {
        // Harbor palms and bollards, distinct from the old-town tree canopy.
        this.add(1, side * 2.64, 1.05, z + 2.4, 0.16, 2.1, 0.16, 0xae7e54);
        for (let leaf = 0; leaf < 5; leaf++) {
          const a = leaf * Math.PI * 0.4;
          this.limb(
            side * 2.64,
            2.09,
            z + 2.4,
            side * 2.64 +
              Math.cos(a) * 0.7 +
              (this.motionReduced ? 0 : Math.sin(this.motionTime * 1.2 + index * 0.91) * 0.04),
            1.86,
            z + 2.4 + Math.sin(a) * 0.7,
            0.13,
            0x3e9e85,
          );
        }
        this.add(1, side * 2.1, 0.32, z - 2.2, 0.19, 0.63, 0.19, COLORS.navy, 0, 0, 0, 1, 0.6);
        this.add(1, side * 2.1, 0.57, z - 2.2, 0.2, 0.08, 0.2, COLORS.yellow);
      }
    }
    world(distance, theme) {
      this.box(0, -0.17, 110, 3.5, 0.3, 245, COLORS.ground);
      for (const side of SIDES) {
        this.box(side * 2.4, -0.04, 110, 1.3, 0.12, 245, COLORS.pavement, 0, 2);
        this.box(side * 1.76, 0.065, 110, 0.13, 0.15, 245, COLORS.cream);
        this.box(side * 3.12, 0.2, 110, 0.1, 0.45, 245, COLORS.coral);
      }
      for (let lane = -1; lane <= 1; lane++) {
        this.box(lane, -0.009, 110, 0.86, 0.016, 245, 0x435666);
        for (const side of SIDES)
          this.add(
            0,
            lane + side * 0.32,
            0.008,
            110,
            0.035,
            0.024,
            245,
            COLORS.rail,
            0,
            0,
            0,
            1,
            0.95,
          );
        for (let i = 0; i < 76; i++)
          this.box(lane, 0, i * 2.7 - ((distance % 2.7) + 3), 0.75, 0.02, 0.19, 0x303e4d);
      }
      const tile = Math.floor(distance / 12),
        shift = distance % 12;
      for (let i = 0; i < 19; i++)
        for (const side of SIDES) {
          const profile = PROFILES[((tile + i) * 2 + (side > 0 ? 1 : 0)) % PROFILES.length];
          const z = i * 12 + 6 - shift,
            x = side * (4.6 + profile.width * 0.12),
            h = profile.height;
          const wind = this.motionReduced
            ? 0
            : Math.sin(this.motionTime * 1.2 + (tile + i) * 0.91) * 0.035;
          const color = theme.colors[profile.color];
          this.box(x, h / 2, z, profile.width, h, 8.3, color, 0, 1);
          this.box(x, h + 0.11, z, profile.width + 0.18, 0.22, 8.5, COLORS.cream);
          this.box(x, h * 0.46, z - 4.2, profile.width + 0.12, 0.14, 0.2, COLORS.cream);
          this.box(x, h * 0.46, z + 4.2, profile.width + 0.12, 0.14, 0.2, COLORS.cream);
          const face = x - side * (profile.width / 2 + 0.015);
          if (z < 85)
            this.facade(
              x,
              z,
              h,
              profile.width,
              face,
              side,
              (tile + i) * 2 + (side > 0 ? 1 : 0),
              theme,
            );
          if (z < 115) {
            for (let row = 0; row < profile.windows; row++)
              for (let col = 0; col < 3; col++) {
                const wy = 1.25 + (row * (h - 1.3)) / profile.windows,
                  wz = z - 2.5 + col * 2.5;
                this.box(face, wy, wz, 0.03, 0.62, 0.77, COLORS.cream);
                this.add(
                  0,
                  face - side * 0.021,
                  wy,
                  wz,
                  0.025,
                  0.49,
                  0.63,
                  theme.light[0] < 0.5 && (tile + i + row + col) % 3 === 0
                    ? 0xffd8a8
                    : COLORS.glass,
                  0,
                  0,
                  0,
                  1,
                  0.75,
                  theme.light[0] < 0.5 && (tile + i + row + col) % 3 === 0 ? 0.18 : 0,
                  4,
                );
                this.box(face - side * 0.04, wy, wz, 0.018, 0.025, 0.65, COLORS.blue, 0.2);
              }
            this.box(face - side * 0.08, 0.46, z, 0.14, 0.9, 1.0, COLORS.navy);
            this.box(
              face - side * 0.36,
              1.05,
              z,
              0.77,
              0.12,
              1.9,
              theme.colors[(profile.color + 1) % 4],
            );
            for (let stripe = 0; stripe < 4; stripe++)
              this.box(
                face - side * 0.38,
                1.12,
                z - 0.75 + stripe * 0.5,
                0.8,
                0.06,
                0.21,
                COLORS.white,
              );
            if ((tile + i) % 3 === 0) {
              this.box(side * 2.55, 0.46, z + 3.2, 0.65, 0.68, 0.75, COLORS.coral);
              this.add(1, side * 2.55, 1.2, z + 3.2, 0.12, 1.1, 0.12, 0x8d6650);
              this.limb(side * 2.55, 1.32, z + 3.2, side * 2.82, 1.83, z + 3.42, 0.08, 0x8d6650);
              this.add(2, side * 2.55 + wind, 2.05, z + 3.2, 0.89, 1.13, 0.91, 0x55a77e);
              this.add(2, side * 2.79 + wind * 0.7, 1.84, z + 3.45, 0.76, 0.84, 0.71, 0x8bc78b);
              this.add(2, side * 2.31 + wind * 0.8, 1.9, z + 3.05, 0.69, 0.78, 0.73, 0x6fb77c);
              this.add(2, side * 2.58 + wind * 1.2, 2.48, z + 3.27, 0.61, 0.62, 0.58, 0xa2cd92);
            } else {
              this.box(side * 2.5, 1.35, z + 3.6, 0.055, 2.7, 0.055, COLORS.navy);
              this.box(side * 2.38, 2.75, z + 3.6, 0.4, 0.09, 0.14, COLORS.navy);
              this.box(side * 2.37, 2.69, z + 3.6, 0.3, 0.045, 0.11, COLORS.yellow, 0.7);
              this.add(3, side * 2.38, 2.75, z + 3.6, 0.44, 0.15, 0.25, COLORS.navy);
              this.box(side * 2.5, 0.12, z + 3.6, 0.19, 0.24, 0.19, COLORS.navy);
            }
          }
          if (i % 2 === 0) {
            this.box(side * 9, h + 1, z, 3.9, h * 2 + 2, 9, theme.colors[(profile.color + 2) % 4]);
            this.box(side * 9, h * 2 + 2.15, z, 4.05, 0.3, 9.2, COLORS.cream);
            if (z < 150) {
              this.box(side * 9, h * 1.4, z - 4.53, 2.7, h * 0.7, 0.025, COLORS.glass, 0, 4);
              for (let floor = 0; floor < 4; floor++)
                this.box(
                  side * 9,
                  h * 1.08 + floor * h * 0.17,
                  z - 4.56,
                  2.75,
                  0.045,
                  0.027,
                  COLORS.cream,
                );
              this.add(1, side * 9, h * 2 + 3.0, z, 1.55, 1.4, 1.55, COLORS.navy, 0, 0, 0, 1, 0.6);
              this.add(1, side * 9, h * 2 + 3.72, z, 1.68, 0.12, 1.68, theme.colors[profile.color]);
              for (const support of SIDES)
                this.box(side * 9 + support * 0.53, h * 2 + 2.35, z, 0.09, 0.7, 0.09, COLORS.rail);
            }
          }
        }
      for (let i = 0; i < 3; i++) {
        const z = i * 72 + 48 - (distance % 72);
        for (const side of SIDES) this.box(side * 2.9, 2.5, z, 0.25, 5, 0.28, COLORS.navy);
        this.box(0, 5.1, z, 6.3, 0.38, 0.42, COLORS.navy);
        this.box(0, 4.9, z - 0.23, 4.5, 0.1, 0.03, COLORS.yellow, 0.6);
        this.label(0, 5.13, z - 0.25, 2.8, 0.31, COLORS.navy, 3, 0.4);
      }
    }
    pickupPart(kind, x, y, z, dx, dy, dz, sx, sy, sz, color, spin, turn, emission = 0) {
      const c = turn * turn - spin * spin,
        s = 2 * spin * turn;
      this.add(
        kind,
        x + dx * c + dz * s,
        y + dy,
        z - dx * s + dz * c,
        sx,
        sy,
        sz,
        color,
        0,
        spin,
        0,
        turn,
        0.45,
        emission,
      );
    }
    obstacle(object, time, theme) {
      const shape = this.geometry[object.type],
        x = object.lane - 1,
        z = object.z;
      if (!shape || object.collected || object.destroyed || z > 220 || z + (shape.length || 0) < -3)
        return;
      const w = shape.halfWidth * 2;
      if (object.type === 'train') {
        const color = theme.colors[(object.lane + 1) % 4];
        const hullHeight = shape.height - 0.17;
        this.add(
          3,
          x,
          hullHeight / 2,
          z + shape.length / 2,
          w,
          hullHeight,
          shape.length,
          color,
          0,
          0,
          0,
          1,
          0.65,
        );
        this.add(
          1,
          x,
          hullHeight,
          z + shape.length / 2,
          w,
          shape.length,
          0.33,
          COLORS.cream,
          HALF,
          0,
          0,
          HALF,
        );
        this.box(x, 0.35, z + shape.length / 2, w * 1.01, 0.35, shape.length, COLORS.navy);
        this.add(3, x, 1.66, z + 0.006, w * 0.77, 0.62, 0.045, COLORS.ink);
        this.add(3, x, 1.66, z - 0.019, w * 0.67, 0.5, 0.026, COLORS.glass, 0, 0, 0, 1, 0.78, 0, 4);
        this.box(x, 1.65, z - 0.035, 0.027, 0.49, 0.014, COLORS.cream);
        this.label(x, 2.01, z - 0.014, w * 0.52, 0.12, COLORS.navy, 12 + object.lane, 0.5);
        this.add(3, x, 0.43, z - 0.009, w * 0.85, 0.14, 0.09, COLORS.ink);
        this.box(x, 1.22, z - 0.014, w * 0.82, 0.045, 0.021, COLORS.cream);
        for (let vent = 0; vent < 5; vent++)
          this.box(x, 0.94 + vent * 0.042, z - 0.014, w * 0.55, 0.015, 0.022, COLORS.navy);
        for (let roof = 0; roof < 3; roof++) {
          this.add(
            3,
            x,
            shape.height - 0.1,
            z + 3 + roof * 5,
            w * 0.62,
            0.13,
            1.1,
            COLORS.rail,
            0,
            0,
            0,
            1,
            0.7,
          );
          for (let slit = 0; slit < 4; slit++)
            this.box(
              x,
              shape.height - 0.03,
              z + 2.65 + roof * 5 + slit * 0.2,
              w * 0.5,
              0.01,
              0.06,
              COLORS.navy,
            );
        }
        this.box(x, 1.98, z + 0.008, w * 0.5, 0.08, 0.02, COLORS.cream);
        this.box(x, 0.62, z + 0.012, w * 0.68, 0.075, 0.024, COLORS.cream);
        for (const side of SIDES) {
          this.box(x + side * w * 0.34, 0.77, z + 0.014, 0.11, 0.12, 0.028, COLORS.yellow, 0.7);
          for (let i = 0; i < 5; i++) {
            this.box(
              x + side * (w / 2 + 0.001),
              1.53,
              z + 1.8 + i * 3.1,
              0.014,
              0.68,
              1.7,
              COLORS.cream,
            );
            this.box(
              x + side * (w / 2 + 0.012),
              1.53,
              z + 1.8 + i * 3.1,
              0.014,
              0.51,
              1.52,
              COLORS.glass,
              0,
              4,
            );
          }
        }
        for (let i = 0; i < 4; i++)
          for (const side of SIDES) {
            const wheel = this.travelDistance / 0.15,
              spin = Math.sin(wheel / 2),
              turn = Math.cos(wheel / 2);
            this.add(
              1,
              x + side * w * 0.38,
              0.18,
              z + 2 + i * 4,
              0.3,
              0.085,
              0.3,
              COLORS.ink,
              spin * HALF,
              -spin * HALF,
              turn * HALF,
              turn * HALF,
              0.7,
            );
            this.add(
              1,
              x + side * w * 0.425,
              0.18,
              z + 2 + i * 4,
              0.16,
              0.016,
              0.16,
              COLORS.rail,
              spin * HALF,
              -spin * HALF,
              turn * HALF,
              turn * HALF,
              0.95,
            );
            this.add(
              0,
              x + side * w * 0.441,
              0.18,
              z + 2 + i * 4,
              0.012,
              0.13,
              0.022,
              COLORS.cream,
              spin,
              0,
              0,
              turn,
              0.6,
            );
            this.add(
              0,
              x + side * w * 0.442,
              0.18,
              z + 2 + i * 4,
              0.012,
              0.022,
              0.13,
              COLORS.cream,
              spin,
              0,
              0,
              turn,
              0.6,
            );
            this.box(
              x + side * (w / 2 + 0.005),
              0.57,
              z + 1.8 + i * 4,
              0.024,
              0.045,
              2.4,
              COLORS.cream,
            );
            this.box(
              x + side * (w / 2 + 0.013),
              1.05,
              z + 3.2 + i * 4,
              0.016,
              1.35,
              0.045,
              COLORS.navy,
            );
          }
      } else if (object.type === 'gate') {
        const g = this.geometry.gate;
        for (const side of SIDES) {
          this.box(
            x + side * g.postOffset,
            g.height / 2,
            z + g.length / 2,
            g.postHalfWidth * 2,
            g.height,
            g.length,
            COLORS.pink,
          );
          for (let i = 0; i < 5; i++)
            this.box(
              x + side * g.postOffset,
              0.25 + i * 0.36,
              z + 0.008,
              g.postHalfWidth * 2,
              0.09,
              0.016,
              COLORS.cream,
            );
        }
        this.box(
          x,
          (g.clearance + g.beamTop) / 2,
          z + g.length / 2,
          g.beamHalfWidth * 2,
          g.beamTop - g.clearance,
          g.length,
          COLORS.pink,
        );
        this.box(x, g.clearance + 0.06, z + 0.006, w, 0.1, 0.018, COLORS.yellow, 0.5);
        for (let i = 0; i < 5; i++)
          this.box(x - 0.45 + i * 0.22, 1.7, z + 0.01, 0.1, 0.4, 0.02, COLORS.cream);
      } else if (object.type === 'barrier') {
        this.box(
          x,
          shape.height / 2,
          z + shape.length / 2,
          w,
          shape.height,
          shape.length,
          COLORS.coral,
        );
        for (let i = 0; i < 5; i++)
          this.add(
            0,
            x - 0.35 + i * 0.18,
            shape.height * 0.52,
            z + 0.011,
            0.1,
            shape.height * 0.9,
            0.023,
            COLORS.cream,
            0,
            0,
            -0.15,
            Math.sqrt(1 - 0.15 ** 2),
          );
        this.box(x, shape.height - 0.04, z + shape.length / 2, w, 0.08, shape.length, COLORS.cream);
        for (const side of SIDES)
          this.add(
            1,
            x + side * 0.31,
            shape.height + 0.035,
            z + 0.2,
            0.09,
            0.06,
            0.09,
            COLORS.yellow,
            0,
            0,
            0,
            1,
            0.5,
            0.4,
          );
      } else if (object.type === 'crate') {
        this.box(
          x,
          shape.height / 2,
          z + shape.length / 2,
          w,
          shape.height,
          shape.length,
          0xd7a164,
        );
        for (const side of SIDES) {
          this.box(
            x + side * w * 0.38,
            shape.height / 2,
            z + 0.013,
            0.075,
            shape.height,
            0.028,
            0xffd29a,
          );
          this.box(
            x + side * w * 0.38,
            shape.height + 0.002,
            z + shape.length / 2,
            0.075,
            0.018,
            shape.length,
            0xffd29a,
          );
        }
        this.box(x, shape.height * 0.25, z + 0.014, w, 0.07, 0.03, 0x8e6347);
        this.box(x, shape.height * 0.75, z + 0.014, w, 0.07, 0.03, 0x8e6347);
      } else {
        const seed = object.poolIndex ?? object.lane;
        const y =
          (shape.bottom + shape.top) / 2 +
          (this.motionReduced ? 0 : Math.sin(time * 3 + seed * 1.7) * 0.018);
        const angle = this.motionReduced ? 0 : time * 2.8 + seed * 0.73,
          spin = Math.sin(angle / 2),
          turn = Math.cos(angle / 2);
        if (object.type === 'coin') {
          // A thin disc spins around its vertical axis; bounds remain within the pickup core.
          const qx = HALF * turn,
            qy = HALF * spin,
            qz = -HALF * spin,
            qw = HALF * turn;
          this.add(1, x, y, z, 0.29, 0.065, 0.29, COLORS.yellow, qx, qy, qz, qw, 0.9, 0.1);
          this.add(4, x, y, z, 0.29, 0.29, 0.29, 0xffe5a0, 0, spin, 0, turn, 0.96, 0.1);
          this.add(0, x, y, z, 0.18, 0.15, 0.073, 0xffd75c, 0, spin, 0, turn, 0.91, 0.02, 206);
        } else if (object.type === 'shield') {
          this.add(2, x, y, z, 0.4, 0.58, 0.25, COLORS.mint, 0, spin, 0, turn, 0.7, 0.12);
          for (const side of SIDES) {
            this.pickupPart(
              4,
              x,
              y,
              z,
              0,
              0,
              side * 0.096,
              0.32,
              0.54,
              0.2,
              COLORS.white,
              spin,
              turn,
              0.1,
            );
            this.pickupPart(
              0,
              x,
              y,
              z,
              0,
              0,
              side * 0.15,
              0.055,
              0.3,
              0.026,
              COLORS.white,
              spin,
              turn,
              0.3,
            );
            this.pickupPart(
              0,
              x,
              y,
              z,
              0,
              0.04,
              side * 0.15,
              0.22,
              0.05,
              0.026,
              COLORS.white,
              spin,
              turn,
              0.3,
            );
          }
        } else if (object.type === 'magnet') {
          for (const side of SIDES) {
            this.pickupPart(
              3,
              x,
              y,
              z,
              side * 0.13,
              0.09,
              0,
              0.11,
              0.34,
              0.17,
              COLORS.blue,
              spin,
              turn,
            );
            this.pickupPart(
              3,
              x,
              y,
              z,
              side * 0.13,
              0.23,
              0,
              0.11,
              0.09,
              0.17,
              COLORS.cream,
              spin,
              turn,
              0.2,
            );
          }
          this.pickupPart(3, x, y, z, 0, -0.09, 0, 0.31, 0.11, 0.17, COLORS.blue, spin, turn);
        }
      }
    }
    limb(x1, y1, z1, x2, y2, z2, width, color) {
      const dx = x2 - x1,
        dy = y2 - y1,
        dz = z2 - z1,
        length = Math.hypot(dx, dy, dz);
      if (length < 0.0001) return;
      const ny = dy / length;
      let qx = dz / length,
        qz = -dx / length,
        qw = 1 + ny;
      if (qw < 0.0001) {
        qx = 1;
        qz = 0;
        qw = 0;
      }
      const inverse = 1 / Math.hypot(qx, qz, qw);
      this.add(
        3,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        (z1 + z2) / 2,
        width,
        length,
        width,
        color,
        qx * inverse,
        0,
        qz * inverse,
        qw * inverse,
        0.5,
      );
    }
    render(game, objects, lane, jump, time, color, district, impact, reducedMotion) {
      if (!this.active || this.released) return false;
      const theme = THEMES[district % 3];
      if (color !== this.lastColor) {
        this.lastColor = color;
        this.color = parseInt(color.slice(1), 16);
      }
      this.eyeX = !reducedMotion && impact > 0 ? Math.sin(time * 95) * impact * 0.05 : 0;
      this.pointCursor = 0;
      this.state.drawCalls = this.state.instances = this.state.triangles = this.state.overflow = 0;
      for (const batch of this.batches) batch.count = 0;
      const distance = game.state === 'ready' ? (reducedMotion ? 0 : time * 3) : game.distance;
      this.runner.motion.sample(game, time, reducedMotion);
      this.motionTime = this.runner.motion.clock;
      this.motionReduced = !!reducedMotion;
      this.travelDistance = distance;
      this.world(distance, theme);
      for (const object of objects) this.obstacle(object, this.motionTime, theme);
      this.runner.draw(game, lane, jump, reducedMotion, impact);
      const gl = this.gl;
      for (const batch of this.batches) {
        gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.count * STRIDE);
      }
      this.pipeline?.shadowPass(this.batches);
      this.pipeline?.begin();
      const mode = this.pipeline ? (this.pipeline.hdr ? 0 : 1) : 2;
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(this.skyProgram);
      gl.bindVertexArray(this.skyVAO);
      gl.uniform2f(this.skyUniforms.size, this.canvas.width, this.canvas.height);
      gl.uniform3fv(this.skyUniforms.top, theme.top);
      gl.uniform3fv(this.skyUniforms.bottom, theme.bottom);
      gl.uniform1f(this.skyUniforms.time, reducedMotion ? 0 : time);
      gl.uniform1i(this.skyUniforms.mode, mode);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.sceneProgram);
      gl.uniform4f(this.uniforms.camera, this.eyeX, this.eyeY, this.eyeZ, this.pitch);
      gl.uniform2f(this.uniforms.view, this.focal, this.width / this.height);
      gl.uniform3fv(this.uniforms.fog, theme.fog);
      gl.uniform1f(this.uniforms.travel, distance % 120);
      gl.uniform2f(this.uniforms.lighting, theme.light[0], theme.light[1]);
      gl.uniform3fv(this.uniforms.top, theme.top);
      gl.uniform3fv(this.uniforms.bottom, theme.bottom);
      gl.uniform1i(this.uniforms.mode, mode);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.uniform1i(this.uniforms.atlas, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.pipeline?.shadow.depth || null);
      gl.uniform1i(this.uniforms.shadow, 0);
      gl.uniform1f(this.uniforms.shadows, this.pipeline?.shadows ? 1 : 0);
      gl.uniform1f(this.uniforms.shadowPixel, 1 / (this.pipeline?.shadowSize || 1));
      if (this.pipeline) gl.uniformMatrix4fv(this.uniforms.light, false, this.pipeline.light);
      for (const batch of this.batches) {
        gl.bindVertexArray(batch.vao);
        const vertices = batch.vertices;
        gl.drawArraysInstanced(gl.TRIANGLES, 0, vertices, batch.count);
        this.state.instances += batch.count;
        this.state.triangles += (vertices / 3) * batch.count;
      }
      gl.bindVertexArray(null);
      this.pipeline?.finish(theme);
      this.state.drawCalls = 1 + this.batches.length + (this.pipeline?.drawCalls || 0);
      return true;
    }
    project(x, z, elevation = 0) {
      const point = this.points[this.pointCursor++ % this.points.length];
      const dy = elevation - this.eyeY,
        dz = z - this.eyeZ,
        c = Math.cos(this.pitch),
        s = Math.sin(this.pitch);
      const depth = c * dz - s * dy;
      point.x = this.width / 2 + ((x - this.eyeX) * this.focal * this.height) / (2 * depth);
      point.y = this.height / 2 - ((c * dy + s * dz) * this.focal * this.height) / (2 * depth);
      point.scale = 1 / depth;
      return point;
    }
    get stats() {
      return {
        ...this.state,
        resources: this.resources.length,
        pixels: this.canvas.width * this.canvas.height,
        instanceBytes: this.batches.reduce((sum, batch) => sum + batch.data.byteLength, 0),
        hdr: !!this.pipeline?.hdr,
        shadows: !!this.pipeline?.shadows,
        bloom: !!this.pipeline?.bloom,
        targetPixels: this.pipeline?.pixels || 0,
        quality: this.quality,
        resolutionScale: this.scale,
      };
    }
  }
  window.Neon3D = {
    create(surface, geometry) {
      try {
        return new Renderer(surface, geometry);
      } catch (_) {
        return null;
      }
    },
  };
})();
