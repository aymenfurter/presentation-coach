import { useEffect, useRef, useCallback } from 'react';

interface DartLogoProps {
  size?: number;
  heat?: number; // 0-1, controls color/speed transition
  animated?: boolean;
  className?: string;
}

const DART_CLIP_PATH = 'polygon(50% 0%, 100% 100%, 50% 70%, 0% 100%)';

const VERTEX_SHADER = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float u_time;
uniform float u_heat;
uniform vec2 u_resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv;
    
    // Speed increases dramatically - like washing machine spinning up
    float speed = 0.15 + u_heat * 1.5;
    float time = u_time * speed;
    
    // Movement radius increases with heat
    float movement = 0.12 + u_heat * 0.25;
    
    // Blob orbits get faster and more erratic
    vec2 blob1 = vec2(
        0.5 + cos(time * 0.7) * movement * 1.2 + sin(time * 1.8) * movement * 0.3 * u_heat,
        0.5 + sin(time * 0.7) * movement * 1.2 + cos(time * 2.1) * movement * 0.3 * u_heat
    );
    vec2 blob2 = vec2(
        0.5 + cos(time * 0.9 + 2.1) * movement * 1.1 + sin(time * 2.3) * movement * 0.35 * u_heat,
        0.5 + sin(time * 0.9 + 2.1) * movement * 1.1 + cos(time * 1.7) * movement * 0.35 * u_heat
    );
    vec2 blob3 = vec2(
        0.5 + cos(time * 0.6 + 4.2) * movement + sin(time * 2.5) * movement * 0.4 * u_heat,
        0.5 + sin(time * 0.6 + 4.2) * movement + cos(time * 1.9) * movement * 0.4 * u_heat
    );
    
    // Blobs grow bigger with heat
    float blobSize = 0.4 + u_heat * 0.35;
    float d1 = 1.0 - smoothstep(0.0, blobSize, length(p - blob1));
    float d2 = 1.0 - smoothstep(0.0, blobSize, length(p - blob2));
    float d3 = 1.0 - smoothstep(0.0, blobSize * 0.9, length(p - blob3));
    
    // Cool colors (blue/purple)
    vec3 cool1 = vec3(0.38, 0.40, 0.95);
    vec3 cool2 = vec3(0.68, 0.38, 0.95);
    vec3 cool3 = vec3(0.40, 0.60, 0.98);
    vec3 coolBase = vec3(0.28, 0.30, 0.60);
    
    // Hot colors (orange/red/yellow)
    vec3 hot1 = vec3(1.0, 0.45, 0.15);
    vec3 hot2 = vec3(0.95, 0.25, 0.30);
    vec3 hot3 = vec3(1.0, 0.75, 0.20);
    vec3 hotBase = vec3(0.55, 0.20, 0.15);
    
    // Blend between cool and hot based on heat
    vec3 col1 = mix(cool1, hot1, u_heat);
    vec3 col2 = mix(cool2, hot2, u_heat);
    vec3 col3 = mix(cool3, hot3, u_heat);
    vec3 base = mix(coolBase, hotBase, u_heat);
    
    // Blend colors
    vec3 color = base;
    color = mix(color, col1, d1 * 0.7);
    color = mix(color, col2, d2 * 0.7);
    color = mix(color, col3, d3 * 0.6);

    gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function DartLogo({ size = 64, heat = 0, animated = true, className = '' }: DartLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<{
    time: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    heat: WebGLUniformLocation | null;
  }>({ time: null, resolution: null, heat: null });
  const startTimeRef = useRef<number>(Date.now());
  const currentHeatRef = useRef<number>(heat);
  const targetHeatRef = useRef<number>(heat);

  // Update target heat when prop changes
  useEffect(() => {
    targetHeatRef.current = heat;
  }, [heat]);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext('webgl', { 
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (!gl) return false;

    glRef.current = gl;

    // Create shaders
    const vertShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return false;

    // Create program
    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link failed:', gl.getProgramInfoLog(program));
      return false;
    }

    programRef.current = program;
    gl.useProgram(program);

    // Setup geometry
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    uniformsRef.current = {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      heat: gl.getUniformLocation(program, 'u_heat'),
    };

    return true;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }, [size]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const uniforms = uniformsRef.current;
    if (!gl || !uniforms.time || !uniforms.resolution || !uniforms.heat) return;

    // Smooth heat transition over ~30 seconds (0.002 factor at 60fps)
    currentHeatRef.current += (targetHeatRef.current - currentHeatRef.current) * 0.002;

    const time = (Date.now() - startTimeRef.current) * 0.001;
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.heat, currentHeatRef.current);
    gl.uniform2f(uniforms.resolution, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (animated) {
      animationRef.current = requestAnimationFrame(render);
    }
  }, [animated]);

  useEffect(() => {
    if (!initGL()) return;
    resize();
    startTimeRef.current = Date.now();
    
    if (animated) {
      render();
    } else {
      // Render once
      render();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initGL, resize, render, animated]);

  // Handle resize
  useEffect(() => {
    resize();
  }, [size, resize]);

  return (
    <div 
      className={`dart-logo ${className}`}
      style={{
        width: size,
        height: size,
        clipPath: DART_CLIP_PATH,
        overflow: 'hidden',
        filter: `drop-shadow(0 0 ${Math.max(15, heat * 30)}px rgba(${heat > 0.5 ? '249, 115, 22' : '99, 102, 241'}, ${0.2 + heat * 0.3}))`,
        transition: 'filter 30s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
}

// Static SVG version for favicon and non-animated uses
export function DartLogoStatic({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
      style={{ filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.4))' }}
    >
      <defs>
        <linearGradient id="dartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <polygon 
        points="50,0 100,100 50,70 0,100" 
        fill="url(#dartGradient)"
      />
    </svg>
  );
}

export default DartLogo;
