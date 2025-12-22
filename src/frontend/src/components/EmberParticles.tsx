import { useEffect, useState, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  hue: number;
  opacity: number;
}

interface EmberParticlesProps {
  active: boolean;
  intensity?: number; // 0-1, controls particle spawn rate
}

export function EmberParticles({ active, intensity = 0.5 }: EmberParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    // Spawn particles based on intensity
    const spawnRate = 200 + (1 - intensity) * 600; // 200-800ms between spawns
    
    const interval = setInterval(() => {
      setParticles(prev => {
        // Limit max particles
        const maxParticles = Math.floor(15 + intensity * 20); // 15-35 particles
        if (prev.length >= maxParticles) {
          return prev;
        }
        
        const id = nextIdRef.current++;
        const hue = Math.random() * 40 + 10;
        const newParticle: Particle = {
          id,
          x: Math.random() * 100,
          size: Math.random() * 12 + 8,
          duration: Math.random() * 4 + 6,
          delay: Math.random() * 0.5,
          hue,
          opacity: Math.random() * 0.4 + 0.3,
        };
        return [...prev, newParticle];
      });
    }, spawnRate);

    // Cleanup old particles periodically
    const cleanup = setInterval(() => {
      setParticles(prev => prev.slice(-40)); // Keep last 40
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(cleanup);
    };
  }, [active, intensity]);

  if (!active) return null;

  if (!active) return null;

  return (
    <div className="ember-particles">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="ember-particle"
          style={{
            left: `${particle.x}%`,
            '--size': `${particle.size}px`,
            '--duration': `${particle.duration}s`,
            '--delay': `${particle.delay}s`,
            '--hue': particle.hue,
            '--particle-opacity': particle.opacity,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 100 100" width={particle.size} height={particle.size}>
            <defs>
              <linearGradient id={`ember-grad-${particle.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={`hsl(${particle.hue + 20}, 100%, 60%)`} />
                <stop offset="100%" stopColor={`hsl(${particle.hue}, 100%, 50%)`} />
              </linearGradient>
            </defs>
            <polygon 
              points="50,0 100,100 50,70 0,100" 
              fill={`url(#ember-grad-${particle.id})`}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

export default EmberParticles;
