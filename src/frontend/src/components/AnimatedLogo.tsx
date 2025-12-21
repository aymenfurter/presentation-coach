import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface AnimatedLogoHandle {
  setHeat: (value: number) => void;
  getHeat: () => number;
}

interface AnimatedLogoProps {
  size?: number;
  className?: string;
  initialHeat?: number;
}

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform float u_time;
  uniform float u_heat;
  uniform vec2 u_resolution;

  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m * m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 center = vec2(0.5, 0.5);
    
    // Speed increases with heat
    float speed = 0.3 + u_heat * 0.7;
    float time = u_time * speed;
    
    // Create flowing blobs
    float blob1 = snoise(vec2(uv.x * 2.0 + time * 0.5, uv.y * 2.0 + time * 0.3));
    float blob2 = snoise(vec2(uv.x * 2.5 - time * 0.4, uv.y * 2.5 + time * 0.6));
    float blob3 = snoise(vec2(uv.x * 1.8 + time * 0.2, uv.y * 1.8 - time * 0.5));
    
    float blobs = (blob1 + blob2 + blob3) / 3.0;
    blobs = blobs * 0.5 + 0.5;
    
    // Cool colors (blue/purple/cyan)
    vec3 coolColor1 = vec3(0.2, 0.4, 0.9);   // Blue
    vec3 coolColor2 = vec3(0.6, 0.3, 0.9);   // Purple
    vec3 coolColor3 = vec3(0.1, 0.8, 0.9);   // Cyan
    
    // Hot colors (orange/red/yellow)
    vec3 hotColor1 = vec3(1.0, 0.4, 0.1);    // Orange
    vec3 hotColor2 = vec3(1.0, 0.2, 0.3);    // Red-orange
    vec3 hotColor3 = vec3(1.0, 0.8, 0.2);    // Yellow
    
    // Mix between cool and hot based on heat
    vec3 color1 = mix(coolColor1, hotColor1, u_heat);
    vec3 color2 = mix(coolColor2, hotColor2, u_heat);
    vec3 color3 = mix(coolColor3, hotColor3, u_heat);
    
    // Create gradient
    vec3 color = mix(color1, color2, blobs);
    color = mix(color, color3, snoise(uv * 3.0 + time * 0.2) * 0.5 + 0.5);
    
    // Add glow from center
    float dist = distance(uv, center);
    float glow = 1.0 - smoothstep(0.0, 0.7, dist);
    color += glow * 0.2 * (1.0 + u_heat * 0.5);
    
    // Boost brightness slightly
    color = pow(color, vec3(0.9));
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const AnimatedLogo = forwardRef<AnimatedLogoHandle, AnimatedLogoProps>(
  ({ size = 120, className = '', initialHeat = 0 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const animationRef = useRef<number>(0);
    const startTimeRef = useRef<number>(Date.now());
    const heatRef = useRef<number>(initialHeat);
    const targetHeatRef = useRef<number>(initialHeat);

    useImperativeHandle(ref, () => ({
      setHeat: (value: number) => {
        targetHeatRef.current = Math.max(0, Math.min(1, value));
      },
      getHeat: () => heatRef.current,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext('webgl', { 
        alpha: true,
        premultipliedAlpha: false,
        antialias: true 
      });
      if (!gl) return;

      glRef.current = gl;

      // Create shaders
      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(vertexShader, vertexShaderSource);
      gl.compileShader(vertexShader);

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(fragmentShader, fragmentShaderSource);
      gl.compileShader(fragmentShader);

      // Create program
      const program = gl.createProgram()!;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);
      programRef.current = program;

      // Create vertices for full-screen quad
      const vertices = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1,
      ]);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Animation loop
      function render() {
        if (!gl || !programRef.current) return;

        const currentTime = (Date.now() - startTimeRef.current) / 1000;

        // Smoothly interpolate heat
        const heatDiff = targetHeatRef.current - heatRef.current;
        heatRef.current += heatDiff * 0.02;

        gl.viewport(0, 0, canvas!.width, canvas!.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const timeLocation = gl.getUniformLocation(programRef.current, 'u_time');
        const heatLocation = gl.getUniformLocation(programRef.current, 'u_heat');
        const resolutionLocation = gl.getUniformLocation(programRef.current, 'u_resolution');

        gl.uniform1f(timeLocation, currentTime);
        gl.uniform1f(heatLocation, heatRef.current);
        gl.uniform2f(resolutionLocation, canvas!.width, canvas!.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        animationRef.current = requestAnimationFrame(render);
      }

      render();

      return () => {
        cancelAnimationFrame(animationRef.current);
      };
    }, []);

    // Dart shape clip-path: polygon(50% 0%, 100% 100%, 50% 70%, 0% 100%)
    return (
      <div
        className={`animated-logo ${className}`}
        style={{
          width: size,
          height: size,
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          width={size * 2}
          height={size * 2}
          style={{
            width: '100%',
            height: '100%',
            clipPath: 'polygon(50% 0%, 100% 100%, 50% 70%, 0% 100%)',
            filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))',
          }}
        />
      </div>
    );
  }
);

AnimatedLogo.displayName = 'AnimatedLogo';

// Static logo for favicon and small uses
export function StaticLogo({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <polygon
        points="50,0 100,100 50,70 0,100"
        fill={color === 'currentColor' ? 'url(#logoGradient)' : color}
      />
    </svg>
  );
}
