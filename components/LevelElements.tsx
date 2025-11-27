
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LevelConfig, SandboxSettings, ThemeConfig } from '../types';
import { Mesh, Group, Vector3, Euler } from 'three';
import { ARENA_BOUNDS, getObstaclePos } from '../constants';

interface LevelElementsProps {
  config: LevelConfig;
  sandboxSettings?: SandboxSettings; 
  theme: ThemeConfig;
  completionRatio: number; 
  blackHoleStateRef?: React.MutableRefObject<number[]>;
}

// Visual Boundary for the play arena
const ContainmentField: React.FC<{ theme: ThemeConfig }> = ({ theme }) => {
    return (
        <group>
            {/* Faint Outer Box */}
            <mesh>
                <boxGeometry args={[ARENA_BOUNDS.x * 2, ARENA_BOUNDS.y * 2, 0.5]} />
                <meshBasicMaterial color={theme.colors.primary} wireframe transparent opacity={0.05} />
            </mesh>
            
            {/* Corner Brackets */}
            {[
                { pos: [ARENA_BOUNDS.x, ARENA_BOUNDS.y, 0], rot: [0,0,0] },
                { pos: [-ARENA_BOUNDS.x, ARENA_BOUNDS.y, 0], rot: [0,0,Math.PI/2] },
                { pos: [-ARENA_BOUNDS.x, -ARENA_BOUNDS.y, 0], rot: [0,0,Math.PI] },
                { pos: [ARENA_BOUNDS.x, -ARENA_BOUNDS.y, 0], rot: [0,0,-Math.PI/2] }
            ].map((bracket, i) => (
                <group key={i} position={new Vector3(...bracket.pos)} rotation={new Euler(...bracket.rot)}>
                     <mesh position={[-0.5, -0.5, 0]}>
                         {/* L-Shape */}
                         <boxGeometry args={[1, 0.1, 0]} />
                         <meshBasicMaterial color={theme.colors.secondary} transparent opacity={0.4} />
                     </mesh>
                     <mesh position={[-0.05, -1, 0]}>
                         <boxGeometry args={[0.1, 1, 0]} />
                         <meshBasicMaterial color={theme.colors.secondary} transparent opacity={0.4} />
                     </mesh>
                </group>
            ))}
        </group>
    );
};

// NEW: Charger Component
const Charger: React.FC<{ position: [number,number,number], radius: number, theme: ThemeConfig }> = ({ position, radius, theme }) => {
    const ringRef = useRef<Mesh>(null);
    const coreRef = useRef<Mesh>(null);

    useFrame((state, delta) => {
        if (ringRef.current) {
            ringRef.current.rotation.x += delta;
            ringRef.current.rotation.y += delta * 0.5;
        }
        if (coreRef.current) {
            coreRef.current.rotation.z -= delta * 2;
            const s = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.1;
            coreRef.current.scale.set(s,s,s);
        }
    });

    return (
        <group position={position}>
            {/* Energy Ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[radius, 0.05, 16, 32]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffaa" emissiveIntensity={2} />
            </mesh>
            {/* Crystal Core */}
            <mesh ref={coreRef}>
                <octahedronGeometry args={[radius * 0.4, 0]} />
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
            </mesh>
            {/* Glow Field */}
            <mesh>
                <sphereGeometry args={[radius, 32, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={2} />
            </mesh>
        </group>
    );
};

const LevelElements: React.FC<LevelElementsProps> = ({ config, sandboxSettings, theme, completionRatio, blackHoleStateRef }) => {
  const emitterRef = useRef<Group>(null);
  
  // Target Refs
  const targetGroupRef = useRef<Group>(null);
  const targetRing1Ref = useRef<Mesh>(null);
  const targetRing2Ref = useRef<Mesh>(null);
  const targetCoreRef = useRef<Mesh>(null);
  const shockwaveRef = useRef<Mesh>(null);

  const obstaclesRef = useRef<Group>(null);
  const portalsRef = useRef<Group>(null);
  
  // Supernova visuals
  const supernovaRingRef = useRef<Mesh[]>([]);

  useFrame((state, delta) => {
    const timeScale = sandboxSettings?.timeScale || 1;
    const dt = delta * timeScale;
    const t = state.clock.elapsedTime;
    
    // Animate Emitter (Ref logic handled implicitly by group)

    // Animate New Target
    if (targetGroupRef.current) {
      const bob = Math.sin(t * 0.8) * 0.2;
      const safeRatio = Math.max(0, Math.min(1, completionRatio));
      const growthScale = 0.3 + (safeRatio * 0.7);
      const currentScale = targetGroupRef.current.scale.x;
      const smoothScale = currentScale + (growthScale - currentScale) * dt * 2.0;

      targetGroupRef.current.scale.set(smoothScale, smoothScale, smoothScale);
      const spinMult = 1.0 + safeRatio * 3.0;

      if (config.isBossLevel) {
          targetGroupRef.current.position.y = config.targetPos[1] + Math.sin(t * 0.5) * 1.5;
          // Shockwave Animation (Sector)
          if (shockwaveRef.current) {
               shockwaveRef.current.rotation.z -= dt * 0.5;
          }
      } else {
          targetGroupRef.current.position.y = config.targetPos[1] + bob * 0.1;
      }

      if (targetCoreRef.current) {
          const pulseSpeed = (config.isBossLevel ? 8 : 3) * spinMult;
          const pulseScale = 1 + Math.sin(t * pulseSpeed) * 0.15;
          targetCoreRef.current.scale.set(pulseScale, pulseScale, pulseScale);
          targetCoreRef.current.rotation.y += dt * spinMult;
          targetCoreRef.current.rotation.z += dt * 0.5 * spinMult;
      }

      if (targetRing1Ref.current) {
          targetRing1Ref.current.rotation.x += dt * 0.8 * spinMult;
          targetRing1Ref.current.rotation.y += dt * 0.4 * spinMult;
      }

      if (targetRing2Ref.current) {
          targetRing2Ref.current.rotation.x -= dt * 1.2 * spinMult;
          targetRing2Ref.current.rotation.z += dt * 0.6 * spinMult;
      }
    }

    // Dynamic Obstacles & Pulsars
    if (obstaclesRef.current) {
        // Move Group itself? No, we need individual moving logic
        // We iterate children to update positions
        obstaclesRef.current.children.forEach((child, i) => {
            const type = config.obstacleTypes?.[i];
            const basePos = config.obstaclePos?.[i] || [0,0,0];
            const behavior = config.obstacleBehaviors?.[i];
            
            // Dynamic Position Sync
            const dynamicPos = getObstaclePos(basePos, behavior, t, i * 100);
            child.position.set(dynamicPos[0], dynamicPos[1], dynamicPos[2]);

            if (type === 'blackhole') {
                child.rotation.z -= 2.0 * dt;
                // Black Hole Growth
                if (blackHoleStateRef && blackHoleStateRef.current && blackHoleStateRef.current[i] !== undefined) {
                    const mass = blackHoleStateRef.current[i];
                    const baseScale = 0.6 + (mass / 50.0) * 0.5; // Reduced Base Scale significantly (was 1.0)
                    const pulse = mass > 40 ? 1 + Math.sin(t * 20) * 0.1 : 1;
                    child.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);
                    
                    // Supernova Ring Animation
                    const ring = supernovaRingRef.current[i];
                    if (ring) {
                        if (mass === 0) { 
                             // Just reset, trigger expansion
                             if (ring.scale.x < 10) ring.scale.addScalar(dt * 20);
                             if (!Array.isArray(ring.material)) {
                                ring.material.opacity = Math.max(0, 1.0 - ring.scale.x / 10);
                             }
                        } else {
                             // Reset ring
                             ring.scale.set(0.1, 0.1, 0.1);
                             if (!Array.isArray(ring.material)) {
                                ring.material.opacity = 0;
                             }
                        }
                    }
                }
            } else if (type === 'pulsar') {
                const pulse = 1 + Math.sin(t * 2 + i) * 0.4;
                child.scale.set(pulse, pulse, 1);
                child.rotation.z += dt;
            } else {
                const scale = 1 + Math.sin(t * 1.5 + i) * 0.05;
                child.scale.set(scale, scale, scale);
                child.rotation.x += dt * 0.2;
                child.rotation.y += dt * 0.3;
            }
        });
    }

    if (portalsRef.current) {
        portalsRef.current.children.forEach((child, i) => {
             child.rotation.z += 2.0 * dt;
             child.rotation.x += 1.0 * dt;
             const scale = 1 + Math.sin(t * 5 + i) * 0.1;
             child.scale.set(scale, scale, scale);
        });
    }
  });

  const targetCoreColor = config.isBossLevel ? "#ff0000" : theme.colors.secondary;
  const targetRingColor = config.isBossLevel ? "#ff3333" : theme.colors.primary;

  return (
    <>
      <ContainmentField theme={theme} />

      {/* Enhanced Emitter */}
      <group position={config.emitterPos} ref={emitterRef}>
        <mesh>
             <torusGeometry args={[0.5, 0.02, 16, 32]} />
             <meshBasicMaterial color={theme.colors.primary} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
             <torusGeometry args={[0.4, 0.02, 16, 32]} />
             <meshBasicMaterial color={theme.colors.primary} />
        </mesh>
        <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive={theme.colors.primary} emissiveIntensity={2} />
        </mesh>
        <mesh>
             <ringGeometry args={[0.0, 0.8, 32]} />
             <meshBasicMaterial color={theme.colors.primary} transparent opacity={0.15} />
        </mesh>
        <mesh position={[0, 0, -2]} rotation={[Math.PI/2, 0, 0]}>
             <cylinderGeometry args={[0.05, 0.0, 4, 8]} />
             <meshBasicMaterial color={theme.colors.primary} transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Chargers */}
      {config.chargers?.map((c, i) => (
          <Charger key={`charger-${i}`} position={c.position} radius={c.radius} theme={theme} />
      ))}

      {/* NEW Futuristic Target (Goal) */}
      <group position={config.targetPos} ref={targetGroupRef}>
        
        <mesh ref={targetCoreRef}>
          <icosahedronGeometry args={[config.targetRadius * 0.35, 0]} />
          <meshStandardMaterial 
            color="#ffffff" 
            emissive={targetCoreColor}
            emissiveIntensity={3} 
            toneMapped={false}
          />
        </mesh>

        <mesh ref={targetRing1Ref}>
             <torusGeometry args={[config.targetRadius * 0.6, 0.03, 8, 32]} />
             <meshBasicMaterial color={targetRingColor} />
        </mesh>

        <mesh ref={targetRing2Ref}>
             <torusGeometry args={[config.targetRadius * 0.85, 0.02, 8, 32]} />
             <meshBasicMaterial color={theme.colors.secondary} />
        </mesh>

        <mesh>
             <sphereGeometry args={[config.targetRadius, 16, 16]} />
             <meshBasicMaterial 
                color={targetCoreColor} 
                wireframe 
                transparent 
                opacity={0.15} 
             />
        </mesh>

        <mesh>
             <sphereGeometry args={[config.targetRadius * 0.9, 32, 32]} />
             <meshBasicMaterial 
                color={targetCoreColor} 
                transparent 
                opacity={0.08}
                side={2} 
             />
        </mesh>

        {/* BOSS SHOCKWAVE VISUAL - SECTOR */}
        {config.isBossLevel && (
            <mesh ref={shockwaveRef} rotation={[0,0,0]}>
                <ringGeometry args={[0.95, 1.0, 64, 1, 0, 2.0]} /> {/* Sector */}
                <meshBasicMaterial color="#ff0000" transparent opacity={0.5} side={2} />
            </mesh>
        )}
      </group>

      {/* Walls (Neon Barriers) */}
      {config.walls?.map((wall, i) => (
          <mesh key={`wall-${i}`} position={wall.position} rotation={[0, 0, wall.rotation]}>
              <boxGeometry args={wall.size} />
              {/* Glass Core */}
              <meshPhysicalMaterial 
                color="#000" 
                roughness={0.1}
                transmission={0.6}
                thickness={0.5}
                emissive={theme.colors.primary} 
                emissiveIntensity={0.2} 
              />
              {/* Forcefield Shell */}
              <mesh scale={[1.05, 1.05, 1.05]}>
                <boxGeometry args={wall.size} />
                <meshBasicMaterial 
                    color={theme.colors.primary} 
                    wireframe 
                    transparent 
                    opacity={0.3} 
                />
              </mesh>
          </mesh>
      ))}

      {config.portals && (
          <group ref={portalsRef}>
              {config.portals.map((portal) => (
                  <group key={`portal-${portal.id}`} position={portal.position}>
                      <mesh>
                          <torusGeometry args={[1, 0.1, 16, 32]} />
                          <meshBasicMaterial color={portal.color} />
                      </mesh>
                      <mesh rotation={[Math.PI/2, 0, 0]}>
                          <circleGeometry args={[0.8, 32]} />
                          <meshBasicMaterial color={portal.color} transparent opacity={0.2} />
                      </mesh>
                  </group>
              ))}
          </group>
      )}

      {config.obstaclePos && config.obstaclePos.length > 0 && (
         <group ref={obstaclesRef}>
            {config.obstaclePos.map((pos, idx) => {
                const type = config.obstacleTypes?.[idx];
                const radius = config.obstacleRadius || 1;

                if (type === 'blackhole') {
                    // Smaller Visual Multiplier: 1.5 instead of 2.5
                    const visualScale = 1.0; 
                    return (
                        <group key={`obs-${idx}`}>
                            {/* Event Horizon */}
                            <mesh>
                                <sphereGeometry args={[radius * 0.5 * visualScale, 32, 32]} />
                                <meshBasicMaterial color="#000000" />
                            </mesh>
                            {/* Photon Ring */}
                            <mesh>
                                <ringGeometry args={[radius * 0.5 * visualScale, radius * 0.55 * visualScale, 64]} />
                                <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
                            </mesh>
                            {/* Accretion Disk */}
                            <mesh rotation={[Math.PI / 3, 0, 0]}>
                                <ringGeometry args={[radius * 0.7 * visualScale, radius * 1.5 * visualScale, 64]} />
                                <meshStandardMaterial 
                                    color="#5500aa" 
                                    emissive="#440088"
                                    emissiveIntensity={2}
                                    transparent 
                                    opacity={0.6} 
                                    side={2}
                                />
                            </mesh>
                            {/* Lensing Distortion sphere placeholder */}
                            <mesh>
                                <sphereGeometry args={[radius * 2 * visualScale, 16, 16]} />
                                <meshPhysicalMaterial 
                                    roughness={0}
                                    transmission={1}
                                    thickness={2}
                                    ior={1.5}
                                    transparent
                                />
                            </mesh>
                            {/* Supernova Ring */}
                            <mesh ref={(el) => supernovaRingRef.current[idx] = el!}>
                                <ringGeometry args={[0.5, 0.6, 64]} />
                                <meshBasicMaterial color="#ffffff" transparent opacity={0} />
                            </mesh>
                        </group>
                    );
                }
                
                if (type === 'pulsar') {
                    return (
                        <group key={`obs-${idx}`}>
                            <mesh>
                                <octahedronGeometry args={[radius * 0.2, 0]} /> {/* SHRUNK 0.6 -> 0.2 */}
                                <meshBasicMaterial color="#ff3333" wireframe />
                            </mesh>
                            <mesh>
                                <ringGeometry args={[radius * 0.25, radius * 0.35, 32]} /> {/* SHRUNK */}
                                <meshBasicMaterial color="#ff0000" transparent opacity={0.5} />
                            </mesh>
                        </group>
                    );
                }

                // Debris or Static
                const isDebris = type === 'debris';
                const finalRadius = isDebris ? 0.3 : radius * 0.25; // SHRUNK significantly (was just radius)

                return (
                    <group key={`obs-${idx}`}>
                         {/* Core */}
                        <mesh>
                            {idx % 3 === 0 ? <tetrahedronGeometry args={[finalRadius, 0]} /> :
                             idx % 3 === 1 ? <boxGeometry args={[finalRadius, finalRadius, finalRadius]} /> :
                             <dodecahedronGeometry args={[finalRadius * 0.8, 0]} />
                            }
                            <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
                        </mesh>
                        {/* Shell */}
                        <mesh scale={[1.2, 1.2, 1.2]}>
                             {idx % 3 === 0 ? <tetrahedronGeometry args={[finalRadius, 0]} /> :
                             idx % 3 === 1 ? <boxGeometry args={[finalRadius, finalRadius, finalRadius]} /> :
                             <dodecahedronGeometry args={[finalRadius * 0.8, 0]} />
                            }
                             <meshBasicMaterial 
                                color={theme.colors.primary} 
                                wireframe 
                                transparent 
                                opacity={isDebris ? 0.5 : 0.2} 
                             />
                        </mesh>
                    </group>
                );
            })}
         </group>
      )}
    </>
  );
};

export default LevelElements;
