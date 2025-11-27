
import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, ShaderMaterial, Vector2, Color, Vector3, Mesh } from 'three';
import { LevelConfig, SandboxSettings, ThemeConfig } from '../types';
import { CRITICAL_MASS_THRESHOLD, getObstaclePos } from '../constants';

interface BackgroundProps {
  levelConfig?: LevelConfig;
  sandboxSettings?: SandboxSettings;
  theme: ThemeConfig;
  mousePos?: React.MutableRefObject<Vector3>;
  blackHoleStateRef?: React.MutableRefObject<number[]>;
}

const Background: React.FC<BackgroundProps> = ({ levelConfig, sandboxSettings, theme, mousePos, blackHoleStateRef }) => {
  const groupRef = useRef<Group>(null);
  
  // --- COSMIC SHADER ---
  const shaderRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new Color(theme.colors.background1) },
    uColor2: { value: new Color(theme.colors.background2) },
  }), []);

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
        vec2 st = vUv * 3.0; 
        float time = uTime * 0.1;
        
        vec2 q = vec2(0.);
        q.x = fbm( st + 0.00*time );
        q.y = fbm( st + vec2(1.0));

        vec2 r = vec2(0.);
        r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*time );
        r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*time);

        float f = fbm(st+r);

        vec3 color = mix(uColor1, uColor2, clamp((f*f)*4.0,0.0,1.0));
        color = mix(color, uColor2 * 1.5, clamp(length(q),0.0,1.0));
        
        float d = distance(vUv, vec2(0.5));
        color *= (1.0 - d * 0.8);

        gl_FragColor = vec4(color, 1.0);
    }
  `;
  
  const debris = useRef([...Array(80)].map(() => ({
    x: (Math.random() - 0.5) * 40,
    y: (Math.random() - 0.5) * 30,
    z: -2 - Math.random() * 6, 
    scale: 0.1 + Math.random() * 0.2,
    originalScale: 0.1 + Math.random() * 0.2,
    rotationSpeedX: (Math.random() - 0.5) * 0.5,
    rotationSpeedY: (Math.random() - 0.5) * 0.5,
    driftX: (Math.random() - 0.5) * 0.01,
    driftY: (Math.random() - 0.5) * 0.01,
    type: Math.random() > 0.5 ? 0 : 1,
    active: true,
    stretch: 1.0
  })));

  const lastMassRef = useRef<number[]>([]);
  const eyeRef = useRef<Group>(null);
  const [eyeState, setEyeState] = useState({
      active: false,
      x: 0,
      y: 0,
      opacity: 0,
      blink: 1.0,
      color: theme.colors.secondary
  });

  useFrame((state, delta) => {
    const timeScale = sandboxSettings?.timeScale || 1;
    const dt = delta * timeScale;
    const t = state.clock.elapsedTime;

    if (shaderRef.current) {
        shaderRef.current.uniforms.uTime.value = t * timeScale;
    }

    if (t > 15) {
        if (!eyeState.active && Math.random() < 0.002) {
            const colors = ["#ff0000", "#00ff00", "#00ffff", "#ff00ff", "#ffff00"];
            setEyeState({
                active: true,
                x: (Math.random() - 0.5) * 20,
                y: (Math.random() - 0.5) * 15,
                opacity: 0,
                blink: 1.0,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    if (eyeState.active && eyeRef.current) {
        const eye = eyeRef.current;
        eye.position.set(eyeState.x, eyeState.y, -12);
        eye.scale.set(0.25, 0.25 * eyeState.blink, 0.25); 
        
        if (mousePos) {
            eye.lookAt(mousePos.current.x, mousePos.current.y, 10);
        }

        let newOp = eyeState.opacity + dt * 0.5;
        if (newOp > 2.5) { 
            setEyeState(prev => ({...prev, active: false}));
        } else {
             setEyeState(prev => ({...prev, opacity: newOp}));
        }

        const renderOp = Math.min(0.6, Math.sin(Math.min(3.14, eyeState.opacity)) * 0.6);
        
        let blink = eyeState.blink;
        if (Math.random() < 0.01) blink = 0; 
        blink = Math.min(1, blink + dt * 5); 
        setEyeState(prev => ({...prev, blink}));

        eye.children.forEach((mesh: any) => {
             if (mesh.material) {
                 mesh.material.opacity = renderOp;
                 mesh.visible = renderOp > 0.01;
             }
        });
    } else if (eyeRef.current) {
        eyeRef.current.scale.set(0,0,0);
    }

    if (levelConfig?.id === 1) {
        if (groupRef.current) groupRef.current.visible = false;
        return;
    } else {
        if (groupRef.current) groupRef.current.visible = true;
    }

    if (!groupRef.current) return;
    
    // Prepare black holes with REAL-TIME POSITIONS
    const blackHoles: {x: number, y: number, r: number, id: number}[] = [];
    if (levelConfig && levelConfig.obstaclePos && levelConfig.obstacleTypes) {
      levelConfig.obstaclePos.forEach((pos, i) => {
        if (levelConfig.obstacleTypes?.[i] === 'blackhole') {
          // Dynamic Position Calculation
          const dynamicPos = getObstaclePos(pos, levelConfig.obstacleBehaviors?.[i], t, i * 100);
          blackHoles.push({
            x: dynamicPos[0],
            y: dynamicPos[1],
            r: (levelConfig.obstacleRadius || 1) * 0.5, // 0.5 Scale visual radius
            id: i
          });
        }
      });
    }

    // Supernova Logic
    if (blackHoleStateRef && blackHoleStateRef.current) {
        if (lastMassRef.current.length !== blackHoleStateRef.current.length) {
            lastMassRef.current = [...blackHoleStateRef.current];
        }
        blackHoles.forEach(bh => {
            const currentMass = blackHoleStateRef.current![bh.id] || 0;
            const lastMass = lastMassRef.current[bh.id] || 0;
            if (lastMass > 40 && currentMass === 0) {
                 let eruptedCount = 0;
                 for (let k = 0; k < debris.current.length; k++) {
                     const d = debris.current[k];
                     if (!d.active || Math.random() > 0.7) {
                         d.active = true;
                         d.x = bh.x + (Math.random() - 0.5) * 1.0;
                         d.y = bh.y + (Math.random() - 0.5) * 1.0;
                         d.scale = d.originalScale * 1.5;
                         d.type = 1; 
                         const angle = Math.random() * Math.PI * 2;
                         const speed = 8.0 + Math.random() * 8.0;
                         d.driftX = Math.cos(angle) * speed;
                         d.driftY = Math.sin(angle) * speed;
                         eruptedCount++;
                         if (eruptedCount > 25) break;
                     }
                 }
            }
            lastMassRef.current[bh.id] = currentMass;
        });
    }

    const walls = levelConfig?.walls || [];
    const subSteps = 3;
    const subDt = dt / subSteps;

    groupRef.current.children.forEach((child, i) => {
      const d = debris.current[i];
      if (!d.active) {
          if (Math.random() < 0.005) {
              d.x = (Math.random() > 0.5 ? 1 : -1) * 25;
              d.y = (Math.random() - 0.5) * 20;
              d.scale = d.originalScale;
              d.active = true;
              d.stretch = 1.0;
              d.driftX = (Math.random() - 0.5) * 0.5;
              d.driftY = (Math.random() - 0.5) * 0.5;
          }
      }

      if (d.active) {
          child.rotation.x += d.rotationSpeedX * dt;
          child.rotation.y += d.rotationSpeedY * dt;
          
          for (let s = 0; s < subSteps; s++) {
              d.stretch = 1.0; 
              
              // Black Hole Interaction
              for (const bh of blackHoles) {
                const dx = d.x - bh.x;
                const dy = d.y - bh.y;
                const distSq = dx * dx + dy * dy;
                
                // Strong gravity within visual range + buffer
                if (distSq < bh.r * bh.r * 60.0) { 
                    const dist = Math.sqrt(distSq);
                    
                    const gForce = 80.0 / Math.max(0.5, dist);
                    
                    const pullX = -(dx / dist) * gForce;
                    const pullY = -(dy / dist) * gForce;
                    const swirlX = -dy / dist;
                    const swirlY = dx / dist;
                    
                    d.driftX *= 0.96;
                    d.driftY *= 0.96;

                    d.driftX += (pullX + swirlX * 8.0) * subDt;
                    d.driftY += (pullY + swirlY * 8.0) * subDt;

                    if (dist < 4.0) {
                        d.stretch = 1.0 + (4.0 - dist) * 2.0; 
                    }

                    // EAT DEBRIS
                    if (dist < bh.r * 1.2) { 
                        d.active = false;
                        d.scale = 0.01; 
                        // INCREMENT MASS
                        if (blackHoleStateRef && blackHoleStateRef.current && blackHoleStateRef.current[bh.id] !== undefined) {
                            blackHoleStateRef.current[bh.id]++;
                        }
                    }
                }
              }

              // Wall Collision (Hard Push Out)
              for (const wall of walls) {
                  const wx = wall.position[0];
                  const wy = wall.position[1];
                  const cos = Math.cos(-wall.rotation);
                  const sin = Math.sin(-wall.rotation);
                  const dx = d.x - wx;
                  const dy = d.y - wy;
                  const localX = dx * cos - dy * sin;
                  const localY = dx * sin + dy * cos;
                  
                  const halfW = wall.size[0] / 2 + 0.5; 
                  const halfH = wall.size[1] / 2 + 0.5;

                  if (localX > -halfW && localX < halfW && localY > -halfH && localY < halfH) {
                      const distToLeft = localX - (-halfW);
                      const distToRight = halfW - localX;
                      const distToTop = halfH - localY;
                      const distToBottom = localY - (-halfH);
                      const min = Math.min(distToLeft, distToRight, distToTop, distToBottom);
                      
                      let pushX = 0; let pushY = 0; let pushDist = 0;
                      if (min === distToLeft) { pushX = -1; pushDist = distToLeft + 0.1; }
                      else if (min === distToRight) { pushX = 1; pushDist = distToRight + 0.1; }
                      else if (min === distToBottom) { pushY = -1; pushDist = distToBottom + 0.1; }
                      else { pushY = 1; pushDist = distToTop + 0.1; }

                      // HARD PUSH OUT
                      const lXNew = localX + pushX * pushDist;
                      const lYNew = localY + pushY * pushDist;
                      
                      const wXNew = lXNew * Math.cos(wall.rotation) - lYNew * Math.sin(wall.rotation) + wx;
                      const wYNew = lXNew * Math.sin(wall.rotation) + lYNew * Math.cos(wall.rotation) + wy;

                      d.x = wXNew;
                      d.y = wYNew;

                      const wNormX = pushX * Math.cos(wall.rotation) - pushY * Math.sin(wall.rotation);
                      const wNormY = pushX * Math.sin(wall.rotation) + pushY * Math.cos(wall.rotation);
                      
                      const dot = d.driftX * wNormX + d.driftY * wNormY;
                      if (dot < 0) { 
                          d.driftX = d.driftX - 2 * dot * wNormX;
                          d.driftY = d.driftY - 2 * dot * wNormY;
                          d.driftX *= 0.8; 
                          d.driftY *= 0.8;
                      }
                  }
              }
              
              d.x += d.driftX * subDt; 
              d.y += d.driftY * subDt;
          }
      }
      
      if (d.x > 30) d.x = -30;
      if (d.x < -30) d.x = 30;
      if (d.y > 25) d.y = -25;
      if (d.y < -25) d.y = 25;

      child.position.x = d.x;
      child.position.y = d.y;
      child.scale.set(d.scale * d.stretch, d.scale * (1/d.stretch), d.scale);
      
      if (d.stretch > 1.1) {
          const angle = Math.atan2(d.driftY, d.driftX);
          child.rotation.z = angle;
      }
      
      child.visible = d.active;
    });
  });

  return (
    <>
        <mesh position={[0, 0, -15]}>
            <planeGeometry args={[100, 100]} />
            <shaderMaterial 
                ref={shaderRef}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
            />
        </mesh>
        
        <group ref={eyeRef} scale={[0,0,0]}> 
            <mesh>
                <sphereGeometry args={[4, 32, 32]} />
                <meshBasicMaterial color="#050510" transparent opacity={0} />
            </mesh>
            <mesh position={[0, 0, 3.5]} scale={[1,1,0.2]}>
                <sphereGeometry args={[2, 32, 16]} />
                <meshBasicMaterial color={eyeState.color} transparent opacity={0} />
            </mesh>
            <mesh position={[0, 0, 3.8]} scale={[1,1,0.2]}>
                <sphereGeometry args={[0.8, 32, 16]} />
                <meshBasicMaterial color="#000" transparent opacity={0} />
            </mesh>
        </group>

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
