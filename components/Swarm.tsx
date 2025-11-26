import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, DynamicDrawUsage, Color } from 'three';
import { 
  PARTICLE_COUNT, 
  FRICTION, 
  MAX_SPEED, 
  EMITTER_RATE, 
  RANDOM_FORCE, 
  PATH_FLOW_FORCE, 
  GRAVITY_STRENGTH 
} from '../constants';
import { LevelConfig } from '../types';

interface SwarmProps {
  pathPoints: Vector3[];
  levelConfig: LevelConfig;
  onLevelComplete: () => void;
  onProgress: (count: number) => void;
  isPaused: boolean;
}

const Swarm: React.FC<SwarmProps> = ({ 
  pathPoints, 
  levelConfig, 
  onLevelComplete, 
  onProgress,
  isPaused 
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  
  // Data buffers (using Float32Arrays for performance instead of Vector3 objects)
  // [x, y, z] per particle
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const velocities = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const life = useMemo(() => new Float32Array(PARTICLE_COUNT), []); // 0 = dead, 1 = alive
  
  // Track specific state
  const activeCountRef = useRef(0);
  const collectedCountRef = useRef(0);

  // Colors
  const tempColor = useMemo(() => new Color(), []);
  const colorArray = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useEffect(() => {
    // Reset simulation when level changes
    activeCountRef.current = 0;
    collectedCountRef.current = 0;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      life[i] = 0;
      positions[i * 3] = -9999; // Hide offscreen
      positions[i * 3 + 1] = -9999;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
    }
  }, [levelConfig]);

  useFrame((state, delta) => {
    if (isPaused || !meshRef.current) return;

    // Spawn new particles
    let spawnedThisFrame = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (spawnedThisFrame >= EMITTER_RATE) break;
      
      if (life[i] <= 0) {
        life[i] = 1; // Activate
        // Reset to emitter position
        positions[i * 3] = levelConfig.emitterPos[0] + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = levelConfig.emitterPos[1] + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = 0;
        
        // Initial random velocity
        velocities[i * 3] = (Math.random() - 0.5) * 0.1;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
        velocities[i * 3 + 2] = 0;
        
        spawnedThisFrame++;
      }
    }

    // Physics Loop
    const targetPos = new Vector3(...levelConfig.targetPos);
    let collectedThisFrame = 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (life[i] <= 0) {
        // Just keep hidden
        dummy.position.set(-9999, -9999, -9999);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const idx = i * 3;
      let vx = velocities[idx];
      let vy = velocities[idx + 1];
      const x = positions[idx];
      const y = positions[idx + 1];

      // 1. Random Brownian Motion / Noise
      vx += (Math.random() - 0.5) * RANDOM_FORCE;
      vy += (Math.random() - 0.5) * RANDOM_FORCE;

      // 2. Interaction with drawn path
      if (pathPoints.length > 1) {
        let closestDistSq = Infinity;
        let closestPoint: Vector3 | null = null;
        let closestIndex = -1;

        // Find closest point on path (Simplified for performance: checking every nth point)
        // Optimization: In a real robust engine, we'd use a Spatial Hash Grid or Quadtree.
        // For < 50 path points, brute force is acceptable.
        for (let p = 0; p < pathPoints.length; p++) {
          const px = pathPoints[p].x;
          const py = pathPoints[p].y;
          const distSq = (x - px) * (x - px) + (y - py) * (y - py);
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            closestPoint = pathPoints[p];
            closestIndex = p;
          }
        }

        if (closestPoint && closestDistSq < 4.0) { // Influence radius
          // Attraction to line (Gravity)
          const dx = closestPoint.x - x;
          const dy = closestPoint.y - y;
          vx += dx * GRAVITY_STRENGTH;
          vy += dy * GRAVITY_STRENGTH;

          // Flow along the line
          // Get direction to next point in path
          if (closestIndex < pathPoints.length - 1) {
            const nextP = pathPoints[closestIndex + 1];
            const dirX = nextP.x - closestPoint.x;
            const dirY = nextP.y - closestPoint.y;
            // Normalize roughly
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            vx += (dirX / len) * PATH_FLOW_FORCE;
            vy += (dirY / len) * PATH_FLOW_FORCE;
          }
        }
      }

      // 3. Obstacle Avoidance
      if (levelConfig.obstaclePos) {
        for (const obs of levelConfig.obstaclePos) {
          const dx = x - obs[0];
          const dy = y - obs[1];
          const distSq = dx * dx + dy * dy;
          const rad = levelConfig.obstacleRadius || 1.0;
          const minDistSq = rad * rad;
          
          if (distSq < minDistSq) {
            const dist = Math.sqrt(distSq);
            // Push away hard
            const pushForce = 0.1;
            vx += (dx / dist) * pushForce;
            vy += (dy / dist) * pushForce;
          }
        }
      }

      // 4. Target Attraction (Logic: if very close, get sucked in)
      const dxTarget = targetPos.x - x;
      const dyTarget = targetPos.y - y;
      const distToTargetSq = dxTarget * dxTarget + dyTarget * dyTarget;
      
      if (distToTargetSq < levelConfig.targetRadius * levelConfig.targetRadius) {
        // Inside target
        life[i] = 0; // Kill particle
        collectedThisFrame++;
        // Reset visual offscreen immediately
        dummy.position.set(-9999, -9999, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      } else if (distToTargetSq < levelConfig.targetRadius * levelConfig.targetRadius + 4) {
         // Slight suction if near rim
         vx += dxTarget * 0.02;
         vy += dyTarget * 0.02;
      }

      // Apply Physics
      vx *= FRICTION;
      vy *= FRICTION;

      // Speed Limit
      const speedSq = vx * vx + vy * vy;
      if (speedSq > MAX_SPEED * MAX_SPEED) {
        const speed = Math.sqrt(speedSq);
        vx = (vx / speed) * MAX_SPEED;
        vy = (vy / speed) * MAX_SPEED;
      }

      velocities[idx] = vx;
      velocities[idx + 1] = vy;

      positions[idx] += vx;
      positions[idx + 1] += vy;

      // Update Instance Matrix
      dummy.position.set(positions[idx], positions[idx + 1], 0);
      
      // Rotate based on velocity for visual flair
      const angle = Math.atan2(vy, vx);
      dummy.rotation.z = angle;
      
      // Scale based on speed (stretch effect)
      const stretch = 1 + Math.sqrt(speedSq) * 2;
      dummy.scale.set(stretch, 0.5, 1); // Elongated droplets
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color variation based on speed
      const speedParam = Math.min(1, Math.sqrt(speedSq) / MAX_SPEED);
      // Mix Cyan (low speed) to Purple/White (high speed)
      tempColor.setHSL(0.5 + speedParam * 0.1, 1, 0.5 + speedParam * 0.4); 
      meshRef.current.setColorAt(i, tempColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    // Update Game State
    if (collectedThisFrame > 0) {
      collectedCountRef.current += collectedThisFrame;
      onProgress(collectedCountRef.current);
      
      if (collectedCountRef.current >= levelConfig.requiredCount) {
        onLevelComplete();
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
      usage={DynamicDrawUsage}
    >
      <circleGeometry args={[0.08, 8]} />
      {/* 
        Using MeshBasicMaterial with toneMapped=false is key for the "Glow" effect 
        when combined with the Bloom post-processing pass.
        The colors will blow out into bright neon.
      */}
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

export default Swarm;