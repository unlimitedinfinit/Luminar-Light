import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, ShaderMaterial, Vector2, Color } from 'three';
import { LevelConfig, SandboxSettings, ThemeConfig } from '../types';

interface BackgroundProps {
  levelConfig?: LevelConfig;
  sandboxSettings?: SandboxSettings;
  theme: ThemeConfig;
}

const Background: React.FC<BackgroundProps> = ({ levelConfig, sandboxSettings, theme }) => {
  const groupRef = useRef<Group>(null);
  
  // --- COSMIC SHADER ---
  const shaderRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new Color(theme.colors.background1) },
    uColor2: { value: new Color(theme.colors.background2) },
  }), []);

  // Update uniforms when theme changes
  useFrame(() => {
    if (shaderRef.current) {
        shaderRef.current.uniforms.uColor1.value.set(theme.colors.background1);
        shaderRef.current.uniforms.uColor2.value.set(theme.colors.background2);
    }
  });

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec2 vUv;

    // Simple noise function
    float random (in vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise (in vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    #define OCTAVES 4
    float fbm (in vec2 st) {
        float value = 0.0;
        float amplitude = .5;
        for (int i = 0; i < OCTAVES; i++) {
            value += amplitude * noise(st);
            st *= 2.;
            amplitude *= .5;
        }
        return value;
    }

    void main() {
        vec2 st = vUv * 3.0; // Scale
        float time = uTime * 0.1;
        
        // Warping
        vec2 q = vec2(0.);
        q.x = fbm( st + 0.00*time );
        q.y = fbm( st + vec2(1.0));

        vec2 r = vec2(0.);
        r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*time );
        r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*time);

        float f = fbm(st+r);

        // Color mixing using Theme Uniforms
        vec3 color = mix(uColor1, uColor2, clamp((f*f)*4.0,0.0,1.0));
        color = mix(color, uColor2 * 1.5, clamp(length(q),0.0,1.0));
        
        // Vignette effect
        float d = distance(vUv, vec2(0.5));
        color *= (1.0 - d * 0.8);

        gl_FragColor = vec4(color, 1.0);
    }
  `;
  
  // --- DEBRIS GENERATION ---
  const debris = useRef([...Array(60)].map(() => ({
    x: (Math.random() - 0.5) * 40,
    y: (Math.random() - 0.5) * 30,
    z: -4 - Math.random() * 8, 
    scale: 0.2 + Math.random() * 0.4,
    originalScale: 0.2 + Math.random() * 0.4,
    rotationSpeedX: (Math.random() - 0.5) * 0.5,
    rotationSpeedY: (Math.random() - 0.5) * 0.5,
    driftX: (Math.random() - 0.5) * 0.01,
    driftY: (Math.random() - 0.5) * 0.01,
    type: Math.random() > 0.5 ? 0 : 1 
  })));

  useFrame((state, delta) => {
    // Time Scale
    const timeScale = sandboxSettings?.timeScale || 1;
    const dt = delta * timeScale;

    // Update Shader Time
    if (shaderRef.current) {
        shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime * timeScale;
    }

    // Hide debris on level 1
    if (levelConfig?.id === 1) {
        if (groupRef.current) groupRef.current.visible = false;
        return;
    } else {
        if (groupRef.current) groupRef.current.visible = true;
    }

    if (!groupRef.current) return;
    
    // Check for black holes
    const blackHoles: {x: number, y: number, r: number}[] = [];
    if (levelConfig && levelConfig.obstaclePos && levelConfig.obstacleTypes) {
      levelConfig.obstaclePos.forEach((pos, i) => {
        if (levelConfig.obstacleTypes?.[i] === 'blackhole') {
          blackHoles.push({
            x: pos[0],
            y: pos[1],
            r: (levelConfig.obstacleRadius || 1) * 2.5 
          });
        }
      });
    }

    groupRef.current.children.forEach((child, i) => {
      const d = debris.current[i];
      child.rotation.x += d.rotationSpeedX * dt;
      child.rotation.y += d.rotationSpeedY * dt;
      
      let fx = 0;
      let fy = 0;

      for (const bh of blackHoles) {
        const dx = d.x - bh.x;
        const dy = d.y - bh.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < bh.r * bh.r) {
            const dist = Math.sqrt(distSq);
            const force = (1.5 / Math.max(0.1, dist)) * dt;
            d.driftX -= (dx / dist) * force * 0.1;
            d.driftY -= (dy / dist) * force * 0.1;

            if (dist < 1.0) {
               d.scale *= 0.8;
               if (d.scale < 0.05) {
                   d.x = (Math.random() > 0.5 ? 1 : -1) * 25;
                   d.y = (Math.random() - 0.5) * 20;
                   d.driftX = (Math.random() - 0.5) * 0.01;
                   d.driftY = (Math.random() - 0.5) * 0.01;
                   d.scale = d.originalScale;
               }
            }
        }
      }
      
      d.x += d.driftX * timeScale; // Drift speed also affected by time
      d.y += d.driftY * timeScale;
      
      if (d.x > 30) d.x = -30;
      if (d.x < -30) d.x = 30;
      if (d.y > 25) d.y = -25;
      if (d.y < -25) d.y = 25;

      child.position.x = d.x;
      child.position.y = d.y;
      child.scale.set(d.scale, d.scale, d.scale);
    });
  });

  return (
    <>
        {/* Background Plane with Shader */}
        <mesh position={[0, 0, -15]}>
            <planeGeometry args={[100, 100]} />
            <shaderMaterial 
                ref={shaderRef}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
            />
        </mesh>

        <group ref={groupRef}>
        {debris.current.map((d, i) => (
            <mesh key={i} position={[d.x, d.y, d.z]} scale={[d.scale, d.scale, d.scale]}>
            {d.type === 0 ? (
                <dodecahedronGeometry args={[1, 0]} />
            ) : (
                <icosahedronGeometry args={[1, 0]} />
            )}
            <meshStandardMaterial 
                color="#2a2a4e" 
                roughness={0.7} 
                metalness={0.3}
                wireframe={Math.random() > 0.9} 
            />
            </mesh>
        ))}
        </group>
    </>
  );
};

export default Background;