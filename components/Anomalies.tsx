import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Mesh } from 'three';
import { AnomalyData, SandboxSettings, AudioControls, LevelConfig } from '../types';

interface AnomaliesProps {
  anomalyRef: React.MutableRefObject<AnomalyData[]>;
  isPlaying: boolean;
  sandboxSettings?: SandboxSettings;
  audioControls: AudioControls | null;
  levelConfig?: LevelConfig;
}

// Maximum possible anomalies
const MAX_CAPACITY = 3;

const Anomalies: React.FC<AnomaliesProps> = ({ anomalyRef, isPlaying, sandboxSettings, audioControls, levelConfig }) => {
  const { viewport } = useThree();
  
  // We manage a pool of objects to avoid reallocation
  const pool = useMemo(() => {
    return Array.from({ length: MAX_CAPACITY }).map((_, i) => ({
      id: i,
      mesh: React.createRef<Mesh>(),
      active: false,
      position: new Vector3(100, 100, 0),
      velocity: new Vector3(0, 0, 0),
      scale: 1,
      shape: 0,
      type: 'repulsor' as 'repulsor' | 'void', 
      rotSpeed: new Vector3(0,0,0)
    }));
  }, []);

  const spawnTimer = useRef(0);
  const nextSpawnTime = useRef(2); 

  useFrame((state, delta) => {
    if (!isPlaying) return;

    // Time scaling
    const timeScale = sandboxSettings?.timeScale || 1;
    const dt = delta * timeScale;

    spawnTimer.current += dt;
    
    // PROGRESSION LOGIC
    // Level 1: 0 anomalies
    // Level 2-4: 1 anomaly
    // Level 5-9: 2 anomalies
    // Level 10+: 3 anomalies
    const currentId = levelConfig ? levelConfig.id : 1;
    let allowedCount = 0;
    if (currentId >= 10) allowedCount = 3;
    else if (currentId >= 5) allowedCount = 2;
    else if (currentId >= 2) allowedCount = 1;
    
    // Count currently active
    const activeCount = pool.filter(p => p.active).length;

    // --- SPAWN LOGIC ---
    if (spawnTimer.current > nextSpawnTime.current && activeCount < allowedCount) {
      const slot = pool.find(p => !p.active);
      
      if (slot) {
        slot.active = true;
        slot.shape = Math.floor(Math.random() * 4);
        
        // 30% Chance to be a "Void Eater" (Moving Black Hole) if level > 5
        const isVoid = currentId > 5 && Math.random() > 0.7;
        slot.type = isVoid ? 'void' : 'repulsor';

        slot.scale = (0.6 + Math.random() * 0.6) * (isVoid ? 1.5 : 1); 
        
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.max(viewport.width, viewport.height) / 2 + 2;
        slot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        
        const targetX = (Math.random() - 0.5) * (viewport.width * 0.5);
        const targetY = (Math.random() - 0.5) * (viewport.height * 0.5);
        const dir = new Vector3(targetX - slot.position.x, targetY - slot.position.y, 0).normalize();
        const speed = 0.8 + Math.random() * 1.0;
        slot.velocity.copy(dir.multiplyScalar(speed));

        slot.rotSpeed.set(Math.random(), Math.random(), Math.random());

        // Play Sound
        if (audioControls && Math.random() > 0.5) audioControls.playAsteroid();
      }
      
      spawnTimer.current = 0;
      nextSpawnTime.current = Math.random() * 5 + 3; // Slower spawn rate
    }

    // --- UPDATE LOGIC ---
    anomalyRef.current = [];

    pool.forEach(p => {
      if (p.active) {
        // Move
        p.position.addScaledVector(p.velocity, dt);

        // Update visual mesh
        if (p.mesh.current) {
          p.mesh.current.position.copy(p.position);
          p.mesh.current.rotation.x += p.rotSpeed.x * dt;
          p.mesh.current.rotation.y += p.rotSpeed.y * dt;
          p.mesh.current.rotation.z += p.rotSpeed.z * dt;
        }

        // Add to physics ref
        anomalyRef.current.push({
          position: p.position,
          radius: 1.5 * p.scale, 
          isActive: true,
          type: p.type
        });

        // Check Bounds (Despawn)
        const bound = Math.max(viewport.width, viewport.height) / 2 + 6;
        if (p.position.length() > bound && p.position.dot(p.velocity) > 0) {
           p.active = false;
           if (p.mesh.current) p.mesh.current.position.set(100, 100, 0);
        }
      } else {
         if (p.mesh.current) p.mesh.current.position.set(100, 100, 0);
      }
    });
  });

  return (
    <>
      {pool.map((p) => (
        <group key={p.id}>
             {/* Wireframe shape */}
            <mesh ref={p.mesh} position={[100, 100, 0]} scale={[p.scale, p.scale, p.scale]}>
                {/* Geometries based on shape ID */}
                {p.id % 4 === 0 && <icosahedronGeometry args={[1.5, 0]} />}
                {p.id % 4 === 1 && <torusGeometry args={[1.0, 0.4, 16, 32]} />}
                {p.id % 4 === 2 && <octahedronGeometry args={[1.5, 0]} />}
                {p.id % 4 === 3 && <dodecahedronGeometry args={[1.5, 0]} />}
                
                <meshBasicMaterial 
                    color={p.type === 'void' ? "#6600cc" : (p.id % 2 === 0 ? "#ff0044" : "#ffaa00")} 
                    wireframe 
                    transparent 
                    opacity={p.type === 'void' ? 0.6 : 0.3} 
                />
            </mesh>
            {/* Core center */}
             <mesh 
                position={p.position} 
                visible={p.active} 
                scale={[p.scale * 0.5, p.scale * 0.5, p.scale * 0.5]}
             >
                 <sphereGeometry args={[1, 8, 8]} />
                 <meshBasicMaterial color={p.type === 'void' ? "#000" : "#222"} />
            </mesh>
        </group>
      ))}
    </>
  );
};

export default Anomalies;