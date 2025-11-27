
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LevelConfig, SandboxSettings, ThemeConfig } from '../types';
import { Mesh, Group, Vector3 } from 'three';

interface LevelElementsProps {
  config: LevelConfig;
  sandboxSettings?: SandboxSettings; 
  theme: ThemeConfig;
}

const LevelElements: React.FC<LevelElementsProps> = ({ config, sandboxSettings, theme }) => {
  const emitterRef = useRef<Group>(null);
  
  // Target Refs
  const targetGroupRef = useRef<Group>(null);
  const targetRing1Ref = useRef<Mesh>(null);
  const targetRing2Ref = useRef<Mesh>(null);
  const targetCoreRef = useRef<Mesh>(null);

  const obstaclesRef = useRef<Group>(null);
  const ringRef1 = useRef<Mesh>(null);
  const ringRef2 = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const portalsRef = useRef<Group>(null);

  useFrame((state, delta) => {
    const timeScale = sandboxSettings?.timeScale || 1;
    const dt = delta * timeScale;
    const t = state.clock.elapsedTime;
    
    // Animate Emitter
    if (emitterRef.current) {
        if (ringRef1.current) {
            ringRef1.current.rotation.x += 1.0 * dt;
            ringRef1.current.rotation.y += 0.5 * dt;
        }
        if (ringRef2.current) {
            ringRef2.current.rotation.x -= 0.5 * dt;
            ringRef2.current.rotation.y += 1.2 * dt;
        }
        if (coreRef.current) {
            const scale = 1 + Math.sin(t * 5) * 0.2;
            coreRef.current.scale.set(scale, scale, scale);
        }
    }

    // Animate New Target (Futuristic Reactor)
    if (targetGroupRef.current) {
      // Gentle floating/bobbing for the whole target
      const bob = Math.sin(t * 0.8) * 0.2;
      
      if (config.isBossLevel) {
          // Boss movement
          targetGroupRef.current.position.y = config.targetPos[1] + Math.sin(t * 0.5) * 1.5;
      } else {
          // Slight bob in place
          targetGroupRef.current.position.y = config.targetPos[1] + bob * 0.1;
      }

      // 1. Core Pulse
      if (targetCoreRef.current) {
          const pulseSpeed = config.isBossLevel ? 8 : 3;
          const pulseScale = 1 + Math.sin(t * pulseSpeed) * 0.15;
          targetCoreRef.current.scale.set(pulseScale, pulseScale, pulseScale);
          targetCoreRef.current.rotation.y += dt;
          targetCoreRef.current.rotation.z += dt * 0.5;
      }

      // 2. Gyroscope Ring 1 (Outer)
      if (targetRing1Ref.current) {
          targetRing1Ref.current.rotation.x += dt * 0.8;
          targetRing1Ref.current.rotation.y += dt * 0.4;
      }

      // 3. Gyroscope Ring 2 (Inner)
      if (targetRing2Ref.current) {
          targetRing2Ref.current.rotation.x -= dt * 1.2;
          targetRing2Ref.current.rotation.z += dt * 0.6;
      }
    }

    // Dynamic Obstacles & Pulsars
    if (obstaclesRef.current) {
        if (config.movingObstacles) {
            obstaclesRef.current.rotation.z = Math.sin(t * 0.3) * 0.5;
        }

        obstaclesRef.current.children.forEach((child, i) => {
            const type = config.obstacleTypes?.[i];
            
            if (type === 'blackhole') {
                child.rotation.z -= 2.0 * dt;
                const scale = 1 + Math.sin(t * 10 + i) * 0.1;
                child.scale.set(scale, scale, scale);
            } else if (type === 'pulsar') {
                // Pulsar: Expands and contracts drastically
                const pulse = 1 + Math.sin(t * 2 + i) * 0.4;
                child.scale.set(pulse, pulse, 1);
                child.rotation.z += dt;
            } else {
                // Static
                const scale = 1 + Math.sin(t * 2 + i) * 0.05;
                const distortX = 1 + Math.cos(t * 1.5 + i) * 0.1;
                child.scale.set(scale * distortX, scale, 1);
            }
        });
    }

    // Animate Portals
    if (portalsRef.current) {
        portalsRef.current.children.forEach((child, i) => {
             child.rotation.z += 2.0 * dt;
             child.rotation.x += 1.0 * dt;
             const scale = 1 + Math.sin(t * 5 + i) * 0.1;
             child.scale.set(scale, scale, scale);
        });
    }
  });

  // Theme colors for Target
  const targetCoreColor = config.isBossLevel ? "#ff0000" : theme.colors.secondary;
  const targetRingColor = config.isBossLevel ? "#ff3333" : theme.colors.primary;

  return (
    <>
      {/* Enhanced Emitter */}
      <group position={config.emitterPos} ref={emitterRef}>
        <mesh ref={ringRef1}>
             <torusGeometry args={[0.5, 0.02, 16, 32]} />
             <meshBasicMaterial color={theme.colors.primary} />
        </mesh>
        <mesh ref={ringRef2} rotation={[Math.PI / 2, 0, 0]}>
             <torusGeometry args={[0.4, 0.02, 16, 32]} />
             <meshBasicMaterial color={theme.colors.primary} />
        </mesh>
        <mesh ref={coreRef}>
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

      {/* NEW Futuristic Target (Goal) */}
      <group position={config.targetPos} ref={targetGroupRef}>
        
        {/* 1. Singularity Core (Polyhedron) */}
        <mesh ref={targetCoreRef}>
          <icosahedronGeometry args={[config.targetRadius * 0.35, 0]} />
          <meshStandardMaterial 
            color="#ffffff" 
            emissive={targetCoreColor}
            emissiveIntensity={3} // High glow
            toneMapped={false}
          />
        </mesh>

        {/* 2. Gyro Ring 1 (Inner) */}
        <mesh ref={targetRing1Ref}>
             <torusGeometry args={[config.targetRadius * 0.6, 0.03, 8, 32]} />
             <meshBasicMaterial color={targetRingColor} />
        </mesh>

        {/* 3. Gyro Ring 2 (Outer) */}
        <mesh ref={targetRing2Ref}>
             <torusGeometry args={[config.targetRadius * 0.85, 0.02, 8, 32]} />
             <meshBasicMaterial color={theme.colors.secondary} />
        </mesh>

        {/* 4. Capture Field (Wireframe Sphere) */}
        <mesh>
             <sphereGeometry args={[config.targetRadius, 16, 16]} />
             <meshBasicMaterial 
                color={targetCoreColor} 
                wireframe 
                transparent 
                opacity={0.15} 
             />
        </mesh>

        {/* 5. Faint Glow Shell */}
        <mesh>
             <sphereGeometry args={[config.targetRadius * 0.9, 32, 32]} />
             <meshBasicMaterial 
                color={targetCoreColor} 
                transparent 
                opacity={0.08}
                side={2} // Double side
             />
        </mesh>
      </group>

      {/* Walls (Neon Barriers) */}
      {config.walls?.map((wall, i) => (
          <mesh key={`wall-${i}`} position={wall.position} rotation={[0, 0, wall.rotation]}>
              <boxGeometry args={wall.size} />
              <meshStandardMaterial 
                color="#000" 
                emissive={theme.colors.primary} 
                emissiveIntensity={0.5} 
                wireframe={false}
              />
              {/* Neon edge glow hack */}
              <mesh scale={[1.05, 1.05, 1.05]}>
                <boxGeometry args={wall.size} />
                <meshBasicMaterial color={theme.colors.primary} wireframe transparent opacity={0.5} />
              </mesh>
          </mesh>
      ))}

      {/* Portals */}
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

      {/* Obstacles */}
      {config.obstaclePos && config.obstaclePos.length > 0 && (
         <group ref={obstaclesRef}>
            {config.obstaclePos.map((pos, idx) => {
                const type = config.obstacleTypes?.[idx];
                const radius = config.obstacleRadius || 1;

                if (type === 'blackhole') {
                    return (
                        <group position={pos} key={`obs-${idx}`}>
                            <mesh>
                                <circleGeometry args={[radius, 32]} />
                                <meshBasicMaterial color="#000000" />
                            </mesh>
                            <mesh>
                                <ringGeometry args={[radius * 0.8, radius * 1.2, 32]} />
                                <meshBasicMaterial color="#4b0082" transparent opacity={0.8} wireframe />
                            </mesh>
                        </group>
                    );
                }
                
                if (type === 'pulsar') {
                    return (
                        <group position={pos} key={`obs-${idx}`}>
                            <mesh>
                                <circleGeometry args={[radius * 0.5, 6]} />
                                <meshBasicMaterial color="#ff3333" wireframe />
                            </mesh>
                            <mesh>
                                <ringGeometry args={[radius * 0.8, radius, 32]} />
                                <meshBasicMaterial color="#ff0000" transparent opacity={0.5} />
                            </mesh>
                        </group>
                    );
                }

                return (
                    <group position={pos} key={`obs-${idx}`}>
                        <mesh>
                            <circleGeometry args={[radius, 32]} />
                            <meshBasicMaterial color="#050505" />
                        </mesh>
                        <mesh>
                            <ringGeometry args={[radius - 0.1, radius, 32]} />
                            <meshBasicMaterial color="#333333" transparent opacity={0.5} />
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
