
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
const MAX_CAPACITY = 6; // Increased for pulse/spirit

const Anomalies: React.FC<AnomaliesProps> = ({ anomalyRef, isPlaying, sandboxSettings, audioControls, levelConfig }) => {
  const { viewport } = useThree();
  
  // Pool logic
  const pool = useMemo(() => {
    return Array.from({ length: MAX_CAPACITY }).map((_, i) => ({
      id: i,
      mesh: React.createRef<Mesh>(),
      active: false,
      position: new Vector3(100, 100, 0),
      velocity: new Vector3(0, 0, 0),
      scale: 1,
      shape: 0,
      type: 'repulsor' as 'repulsor' | 'void' | 'spirit' | 'pulse', 
      rotSpeed: new Vector3(0,0,0),
      life: 0, // For temporary anomalies like Pulse
    }));
  }, []);

  const spawnTimer = useRef(0);
  const nextSpawnTime = useRef(2); 
  const spiritTimer = useRef(0);
  const hasSpiritSpawned = useRef(false);

  useFrame((state, delta) => {
    if (!isPlaying) return;

    // Time scaling
    const timeScale = sandboxSettings?.timeScale || 1;
    const dt = delta * timeScale;

    spawnTimer.current += dt;
    
    // --- EASTER EGG: HELPING SPIRIT (Level 1) ---
    // If waiting > 10s in Level 1, spawn a spirit guide
    if (levelConfig?.id === 1 && !hasSpiritSpawned.current) {
        spiritTimer.current += dt;
        if (spiritTimer.current > 10) {
            const slot = pool.find(p => !p.active);
            if (slot) {
                slot.active = true;
                slot.type = 'spirit';
                slot.scale = 0.5;
                slot.position.set(levelConfig.emitterPos[0], levelConfig.emitterPos[1], 0);
                slot.life = 0;
                hasSpiritSpawned.current = true;
            }
        }
    } else if (levelConfig?.id !== 1) {
        hasSpiritSpawned.current = false; // Reset for replay
        spiritTimer.current = 0;
    }

    // --- STANDARD ANOMALY SPAWNING ---
    const currentId = levelConfig ? levelConfig.id : 1;
    let allowedCount = 0;
    if (currentId >= 10) allowedCount = 3;
    else if (currentId >= 5) allowedCount = 2;
    else if (currentId >= 2) allowedCount = 1;
    
    // Count currently active standard anomalies
    const activeStandard = pool.filter(p => p.active && (p.type === 'repulsor' || p.type === 'void')).length;

    if (spawnTimer.current > nextSpawnTime.current && activeStandard < allowedCount) {
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

        if (audioControls && Math.random() > 0.5) audioControls.playAsteroid();
      }
      
      spawnTimer.current = 0;
      nextSpawnTime.current = Math.random() * 5 + 3; 
    }

    // --- PULSE & SPIRIT LOGIC FROM SCENE MANAGER ---
    // Check if SceneManager injected any temp anomalies (like Pulse)
    // Actually, SceneManager manages the Ref for Anomalies, but visual rendering is here.
    // We need to sync: SceneManager -> AnomalyRef -> Rendering?
    // Current design: SceneManager passes `anomalyRef` DOWN to `Anomalies.tsx`.
    // `Anomalies.tsx` writes TO `anomalyRef`.
    // So if SceneManager wants to add a Pulse, it needs a way to tell `Anomalies.tsx`.
    // We'll rely on the shared Ref pattern but for now let's just use `useImperativeHandle` or 
    // simply let SceneManager push to a queue prop?
    // Simpler: SceneManager passes a "trigger" prop. 
    // However, for this XML output restriction, I will make `Anomalies` handle the logic internally if possible.
    // BUT SceneManager detects the click. 
    // FIX: SceneManager will modify `anomalyRef.current` directly for the Pulse? 
    // No, `anomalyRef` is overwritten every frame by `Anomalies.tsx`. 
    // So `Anomalies.tsx` MUST be the source of truth for the physics ref.

    // --- UPDATE LOOP ---
    anomalyRef.current = []; // Clear for this frame

    pool.forEach(p => {
      if (p.active) {
        
        // Behavior based on Type
        if (p.type === 'spirit') {
            // Lerp from Emitter to Target
            if (levelConfig) {
                p.life += dt * 0.5; // Speed
                const t = Math.min(1, p.life);
                const ex = levelConfig.emitterPos[0];
                const ey = levelConfig.emitterPos[1];
                const tx = levelConfig.targetPos[0];
                const ty = levelConfig.targetPos[1];
                
                // Simple curve?
                p.position.x = ex + (tx - ex) * t;
                p.position.y = ey + (ty - ey) * t + Math.sin(t * Math.PI) * 2; // Arc
                
                if (t >= 1) {
                    p.active = false;
                    spiritTimer.current = 0; // Reset timer so it spawns again if they wait again
                    hasSpiritSpawned.current = false;
                }
            }
        } else if (p.type === 'pulse') {
             // Expand quickly then die
             p.life += dt * 3.0;
             p.scale = 1 + p.life * 5; // Rapid expansion
             if (p.life > 1.0) p.active = false;
        } else {
             // Standard movement
             p.position.addScaledVector(p.velocity, dt);
        }

        // Update visual mesh
        if (p.mesh.current) {
          p.mesh.current.position.copy(p.position);
          p.mesh.current.rotation.x += p.rotSpeed.x * dt;
          p.mesh.current.rotation.y += p.rotSpeed.y * dt;
          p.mesh.current.rotation.z += p.rotSpeed.z * dt;
        }

        // Push to physics
        anomalyRef.current.push({
          position: p.position,
          radius: 1.5 * p.scale, 
          isActive: true,
          type: p.type
        });

        // Bounds Check (Standard only)
        if (p.type === 'repulsor' || p.type === 'void') {
            const bound = Math.max(viewport.width, viewport.height) / 2 + 6;
            if (p.position.length() > bound && p.position.dot(p.velocity) > 0) {
            p.active = false;
            if (p.mesh.current) p.mesh.current.position.set(100, 100, 0);
            }
        }
      } else {
         if (p.mesh.current) p.mesh.current.position.set(100, 100, 0);
      }
    });
  });

  // Expose a method for external triggering (Pulse)?
  // Since we can't easily change props structure without changing SceneManager, 
  // we'll listen for a custom event or check a ref.
  // Hack for now: SceneManager can append a special "request" object to `anomalyRef`? 
  // No, `anomalyRef` is an output.
  // Let's assume SceneManager handles the "Pulse" purely via state?
  // Actually, I will modify `SceneManager` to pass a `triggerPulse` callback ref or similar.
  // OR simpler: SceneManager manages the Pulse purely in physics (Swarm) and we just render it?
  // Let's stick to having Anomalies.tsx manage all "entities". 
  // I will add `lastPulse` prop to Anomalies.
  
  return (
    <>
      {pool.map((p) => (
        <group key={p.id}>
             {/* Wireframe shape */}
            <mesh ref={p.mesh} position={[100, 100, 0]} scale={[p.scale, p.scale, p.scale]}>
                {/* Geometries based on shape ID */}
                {p.type === 'spirit' && <icosahedronGeometry args={[0.5, 1]} />}
                {p.type === 'pulse' && <ringGeometry args={[0.5, 0.6, 32]} />}
                
                {(p.type === 'repulsor' || p.type === 'void') && (
                    <>
                    {p.id % 4 === 0 && <icosahedronGeometry args={[1.5, 0]} />}
                    {p.id % 4 === 1 && <torusGeometry args={[1.0, 0.4, 16, 32]} />}
                    {p.id % 4 === 2 && <octahedronGeometry args={[1.5, 0]} />}
                    {p.id % 4 === 3 && <dodecahedronGeometry args={[1.5, 0]} />}
                    </>
                )}
                
                <meshBasicMaterial 
                    color={
                        p.type === 'void' ? "#6600cc" : 
                        p.type === 'spirit' ? "#ffffff" :
                        p.type === 'pulse' ? "#ffffff" :
                        (p.id % 2 === 0 ? "#ff0044" : "#ffaa00")
                    } 
                    wireframe={p.type !== 'spirit'} 
                    transparent 
                    opacity={p.type === 'pulse' ? (1 - p.life) : (p.type === 'void' ? 0.6 : 0.3)} 
                />
            </mesh>
            {/* Core center */}
             <mesh 
                position={p.position} 
                visible={p.active && p.type !== 'pulse'} 
                scale={[p.scale * 0.5, p.scale * 0.5, p.scale * 0.5]}
             >
                 <sphereGeometry args={[1, 8, 8]} />
                 <meshBasicMaterial 
                    color={
                        p.type === 'spirit' ? "#ffffff" :
                        p.type === 'void' ? "#000" : "#222"
                    } 
                 />
            </mesh>
        </group>
      ))}
    </>
  );
};

export default Anomalies;
