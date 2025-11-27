
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, DynamicDrawUsage, Color } from 'three';
import { 
  PARTICLE_COUNT, 
  FRICTION, 
  MAX_SPEED, 
  EMITTER_RATE, 
  PATH_FLOW_FORCE, 
  GRAVITY_STRENGTH 
} from '../constants';
import { LevelConfig, AnomalyData, SandboxSettings, ThemeConfig, AudioControls } from '../types';

interface SwarmProps {
  paths: Vector3[][];
  levelConfig: LevelConfig;
  anomalyRef: React.MutableRefObject<AnomalyData[]>;
  onLevelComplete: () => void;
  onProgress: (count: number) => void;
  isPaused: boolean;
  sandboxSettings: SandboxSettings;
  setFuel: (val: number | ((prev: number) => number)) => void;
  isDrawingRef: React.MutableRefObject<boolean>;
  theme: ThemeConfig;
  audioControls: AudioControls | null;
  resetKey: number;
}

const noise = (x: number, y: number, z: number) => {
    return Math.sin(x * 0.5 + z) * Math.cos(y * 0.5 + z);
};

const TRAIT_NORMAL = 0;
const TRAIT_TITAN = 1; 
const TRAIT_ROGUE = 2; 
const TRAIT_SPARK = 3; 

const Swarm: React.FC<SwarmProps> = ({ 
  paths, 
  levelConfig, 
  anomalyRef,
  onLevelComplete, 
  onProgress,
  isPaused,
  sandboxSettings,
  setFuel,
  isDrawingRef,
  theme,
  audioControls,
  resetKey
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const velocities = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const life = useMemo(() => new Float32Array(PARTICLE_COUNT), []); 
  const ages = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  const traits = useMemo(() => new Int8Array(PARTICLE_COUNT), []); 
  
  const activeCountRef = useRef(0);
  const collectedCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const currentFuelRef = useRef(0);
  
  const activeLevelId = useRef<number>(-1);
  const hasWonRef = useRef(false);
  
  const tempColor = useMemo(() => new Color(), []);
  const colorStart = useMemo(() => new Color(), []);
  const colorEnd = useMemo(() => new Color(), []);

  useEffect(() => {
    colorStart.set(theme.colors.particleStart);
    colorEnd.set(theme.colors.particleEnd);
  }, [theme]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.instanceMatrix.setUsage(DynamicDrawUsage);
    }

    activeCountRef.current = 0;
    collectedCountRef.current = 0;
    frameCountRef.current = 0;
    currentFuelRef.current = levelConfig.particleBudget || 999999;
    hasWonRef.current = false;
    
    onProgress(0);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      life[i] = 0;
      ages[i] = 0;
      traits[i] = TRAIT_NORMAL;
      positions[i * 3] = -9999;
      positions[i * 3 + 1] = -9999;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      
      dummy.position.set(-9999, -9999, -9999);
      dummy.updateMatrix();
      if (meshRef.current) {
         meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }
    
    if (meshRef.current) {
        meshRef.current.instanceMatrix.needsUpdate = true;
    }

    activeLevelId.current = levelConfig.id;

  }, [levelConfig.id, resetKey, levelConfig.particleBudget]); 

  useFrame((state, delta) => {
    if (activeLevelId.current !== levelConfig.id) return;
    if (hasWonRef.current) return; 
    
    if (frameCountRef.current < 20) {
        frameCountRef.current++;
        return;
    }

    if (isPaused || !meshRef.current) return;

    const timeScale = sandboxSettings.timeScale || 1;
    const dt = delta * timeScale;
    
    if (dt <= 0) return;

    // --- EMISSION LOGIC ---
    const hasBudget = levelConfig.particleBudget !== undefined;
    const isInfinite = !hasBudget || sandboxSettings.infiniteAmmo;
    // Emit automatically as long as fuel exists, ignoring click state
    const shouldEmit = isInfinite || currentFuelRef.current > 0;

    let spawnedThisFrame = 0;
    const scaledEmitterRate = EMITTER_RATE * timeScale;
    
    if (shouldEmit) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (spawnedThisFrame >= scaledEmitterRate) break;
            
            if (life[i] <= 0) {
                life[i] = 1;
                ages[i] = 0;
                
                const rand = Math.random();
                if (rand > 0.98) traits[i] = TRAIT_TITAN;      
                else if (rand > 0.94) traits[i] = TRAIT_SPARK; 
                else if (rand > 0.85) traits[i] = TRAIT_ROGUE; 
                else traits[i] = TRAIT_NORMAL;                 

                positions[i * 3] = levelConfig.emitterPos[0] + (Math.random() - 0.5) * 0.2;
                positions[i * 3 + 1] = levelConfig.emitterPos[1] + (Math.random() - 0.5) * 0.2;
                positions[i * 3 + 2] = 0;
                
                const speedMult = traits[i] === TRAIT_SPARK ? 0.3 : 0.1;
                velocities[i * 3] = (Math.random() - 0.5) * speedMult;
                velocities[i * 3 + 1] = (Math.random() - 0.5) * speedMult;
                
                spawnedThisFrame++;
                
                if (!isInfinite) {
                    currentFuelRef.current -= 1;
                }
            }
        }
        
        if (!isInfinite && spawnedThisFrame > 0) {
            setFuel(currentFuelRef.current);
        }
    }

    const targetPos = new Vector3(...levelConfig.targetPos);
    let collectedThisFrame = 0;

    const gravityForce = GRAVITY_STRENGTH * sandboxSettings.gravityMult;
    const flowForce = PATH_FLOW_FORCE * sandboxSettings.gravityMult;
    let baseMaxSpeed = MAX_SPEED * sandboxSettings.speedMult;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (life[i] <= 0) {
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

      const trait = traits[i];

      if (trait !== TRAIT_TITAN && ages[i] > 0.6 && Math.random() < 0.0001) {
          traits[i] = TRAIT_TITAN;
      }

      ages[i] += dt * 0.05; 
      if (ages[i] > 1.2) { 
        life[i] = 0;
        dummy.position.set(-9999, -9999, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      
      const weight = Math.max(0.2, 1.0 - (ages[i] * 0.6));
      const chaosAmount = trait === TRAIT_ROGUE ? 0.02 : 0.002;
      vx += (Math.random() - 0.5) * chaosAmount;
      vy += (Math.random() - 0.5) * chaosAmount;

      const noiseTime = state.clock.elapsedTime * timeScale;
      const n1 = noise(x, y, noiseTime * 0.5);
      const n2 = noise(x + 10, y + 10, noiseTime * 0.3);
      const noiseDir = (trait === TRAIT_ROGUE && Math.random() > 0.9) ? -1 : 1;
      
      vx += (n1 + n2) * 0.005 * weight * noiseDir;
      vy += (n1 - n2) * 0.005 * weight * noiseDir;

      for (const anomaly of anomalyRef.current) {
         if (anomaly.isActive) {
            const adx = x - anomaly.position.x;
            const ady = y - anomaly.position.y;
            const adistSq = adx * adx + ady * ady;
            
            if (adistSq < anomaly.radius * anomaly.radius) {
                const adist = Math.sqrt(adistSq);
                
                if (anomaly.type === 'void') {
                    const resist = trait === TRAIT_TITAN ? 0.5 : 1.0;
                    const force = 0.5 * (1 - adist / anomaly.radius) * resist;
                    vx -= (adx / adist) * force;
                    vy -= (ady / adist) * force;
                    
                    if (adistSq < 0.25) { 
                        life[i] = 0;
                        dummy.position.set(-9999, -9999, 0);
                        dummy.updateMatrix();
                        meshRef.current.setMatrixAt(i, dummy.matrix);
                        continue;
                    }

                } else {
                    vx += (adx / adist) * 0.3;
                    vy += (ady / adist) * 0.3;
                }
            }
         }
      }

      if (paths.length > 0) {
        let globalClosestDistSq = Infinity;
        let globalClosestPoint: Vector3 | null = null;
        let globalClosestPathIdx = -1;
        let globalClosestPointIdx = -1;

        for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
            const path = paths[pathIdx];
            if (path.length < 2) continue;
            for (let p = 0; p < path.length; p += 2) {
                const px = path[p].x;
                const py = path[p].y;
                const distSq = (x - px) * (x - px) + (y - py) * (y - py);
                if (distSq < globalClosestDistSq) {
                    globalClosestDistSq = distSq;
                    globalClosestPoint = path[p];
                    globalClosestPathIdx = pathIdx;
                    globalClosestPointIdx = p;
                }
            }
        }

        if (globalClosestPoint && globalClosestDistSq < 4.0) {
          const dx = globalClosestPoint.x - x;
          const dy = globalClosestPoint.y - y;
          const followFactor = (trait === TRAIT_ROGUE && Math.random() > 0.8) ? -0.5 : 1.0;

          vx += dx * gravityForce * weight * followFactor;
          vy += dy * gravityForce * weight * followFactor;

          const path = paths[globalClosestPathIdx];
          if (globalClosestPointIdx < path.length - 2) {
            const nextP = path[globalClosestPointIdx + 2];
            const dirX = nextP.x - globalClosestPoint.x;
            const dirY = nextP.y - globalClosestPoint.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            vx += (dirX / len) * flowForce * weight * followFactor;
            vy += (dirY / len) * flowForce * weight * followFactor;
          }
        }
      }

      if (levelConfig.obstaclePos) {
        for (let o = 0; o < levelConfig.obstaclePos.length; o++) {
            const obs = levelConfig.obstaclePos[o];
            const type = levelConfig.obstacleTypes?.[o];
            const dx = x - obs[0];
            const dy = y - obs[1];
            const distSq = dx * dx + dy * dy;
            const rad = levelConfig.obstacleRadius || 1.0;
            
            if (type === 'blackhole') {
                const pullRange = rad * 3.5;
                if (distSq < pullRange * pullRange) {
                     const dist = Math.sqrt(distSq);
                     const force = 0.05 * (1 - dist / pullRange);
                     vx -= (dx / dist) * force; 
                     vy -= (dy / dist) * force;
                     if (distSq < (rad * 0.8) * (rad * 0.8)) {
                         life[i] = 0;
                         dummy.position.set(-9999, -9999, 0);
                         dummy.updateMatrix();
                         meshRef.current.setMatrixAt(i, dummy.matrix);
                         vx = 0; vy = 0; 
                         break; 
                     }
                }
            } else if (type === 'pulsar') {
                const pulseRad = rad * (1 + Math.sin(state.clock.elapsedTime * 2 + o) * 0.4);
                if (distSq < pulseRad * pulseRad) {
                    const dist = Math.sqrt(distSq);
                    vx += (dx / dist) * 0.3; // Hard push
                    vy += (dy / dist) * 0.3;
                }
            } else {
                const minDistSq = rad * rad;
                if (distSq < minDistSq) {
                    const dist = Math.sqrt(distSq);
                    const pushForce = trait === TRAIT_TITAN ? 0.05 : 0.15;
                    vx += (dx / dist) * pushForce;
                    vy += (dy / dist) * pushForce;
                }
            }
        }
      }

      // --- WALL COLLISION (RECT) ---
      if (levelConfig.walls) {
          for (const wall of levelConfig.walls) {
              const wx = wall.position[0];
              const wy = wall.position[1];
              const halfW = wall.size[0] / 2;
              const halfH = wall.size[1] / 2;
              
              // Rotate particle point into wall's local space
              const cos = Math.cos(-wall.rotation);
              const sin = Math.sin(-wall.rotation);
              const dx = x - wx;
              const dy = y - wy;
              const localX = dx * cos - dy * sin;
              const localY = dx * sin + dy * cos;
              
              // AABB Check in local space (with some padding)
              const pad = 0.2; 
              if (localX > -halfW - pad && localX < halfW + pad &&
                  localY > -halfH - pad && localY < halfH + pad) {
                  
                  // Simple resolution: Push out closest side
                  const distToLeft = localX - (-halfW);
                  const distToRight = halfW - localX;
                  const distToTop = halfH - localY;
                  const distToBottom = localY - (-halfH);
                  
                  const min = Math.min(distToLeft, distToRight, distToTop, distToBottom);
                  
                  let pushX = 0;
                  let pushY = 0;
                  
                  if (min === distToLeft) pushX = -1;
                  else if (min === distToRight) pushX = 1;
                  else if (min === distToBottom) pushY = -1;
                  else pushY = 1;
                  
                  // Rotate push vector back
                  const worldPushX = pushX * Math.cos(wall.rotation) - pushY * Math.sin(wall.rotation);
                  const worldPushY = pushX * Math.sin(wall.rotation) + pushY * Math.cos(wall.rotation);
                  
                  vx += worldPushX * 0.1;
                  vy += worldPushY * 0.1;
              }
          }
      }

      // --- PORTAL PHYSICS ---
      if (levelConfig.portals) {
          for (const portal of levelConfig.portals) {
              const dx = x - portal.position[0];
              const dy = y - portal.position[1];
              if (dx * dx + dy * dy < 1.0) { // Hit portal
                  // Teleport to target
                  positions[idx] = portal.target[0] + (Math.random() - 0.5);
                  positions[idx + 1] = portal.target[1] + (Math.random() - 0.5);
                  // Shoot out
                  const speed = Math.sqrt(vx*vx + vy*vy);
                  vx = (Math.random() - 0.5) * speed * 2;
                  vy = (Math.random() - 0.5) * speed * 2;
              }
          }
      }

      if (life[i] === 0 && ages[i] <= 1.2) continue;

      const dxTarget = targetPos.x - x;
      const dyTarget = targetPos.y - y;
      const distToTargetSq = dxTarget * dxTarget + dyTarget * dyTarget;
      
      if (distToTargetSq < levelConfig.targetRadius * levelConfig.targetRadius) {
        life[i] = 0;
        collectedThisFrame++;
        dummy.position.set(-9999, -9999, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const friction = trait === TRAIT_TITAN ? 0.98 : FRICTION;
      vx *= friction;
      vy *= friction;

      let effectiveMaxSpeed = baseMaxSpeed * (1.0 - (ages[i] * 0.3));
      if (trait === TRAIT_TITAN) effectiveMaxSpeed *= 0.6;
      if (trait === TRAIT_SPARK) effectiveMaxSpeed *= 1.8; 

      const speedSq = vx * vx + vy * vy;
      if (speedSq > effectiveMaxSpeed * effectiveMaxSpeed) {
        const speed = Math.sqrt(speedSq);
        vx = (vx / speed) * effectiveMaxSpeed;
        vy = (vy / speed) * effectiveMaxSpeed;
      }

      velocities[idx] = vx;
      velocities[idx + 1] = vy;
      
      positions[idx] += vx * timeScale;
      positions[idx + 1] += vy * timeScale;

      dummy.position.set(positions[idx], positions[idx + 1], 0);
      const angle = Math.atan2(vy, vx);
      dummy.rotation.z = angle;
      const stretch = 1 + Math.sqrt(speedSq) * 3;
      
      const baseScaleY = 0.4 + (ages[i] * 0.4);
      const scaleMult = sandboxSettings.giantMode ? 2.5 : 1;

      let sx = stretch;
      let sy = baseScaleY;
      
      if (trait === TRAIT_TITAN) {
          const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
          sx = 2.5 * pulse;
          sy = 2.5 * pulse;
      } else if (trait === TRAIT_SPARK) {
          sx *= 1.5; 
          sy *= 0.5; 
      }

      dummy.scale.set(sx * scaleMult, sy * scaleMult, 1); 
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      if (sandboxSettings.rainbowMode) {
          const hue = (state.clock.elapsedTime * 0.2 + (i * 0.001)) % 1;
          tempColor.setHSL(hue, 1, 0.6);
      } else {
        const ageNorm = Math.min(1, ages[i]);
        tempColor.lerpColors(colorStart, colorEnd, ageNorm);

        if (trait === TRAIT_TITAN) {
            tempColor.addScalar(0.3);
        } else if (trait === TRAIT_ROGUE) {
            tempColor.r += 0.2;
        } else if (trait === TRAIT_SPARK) {
            tempColor.g += 0.2;
            tempColor.b += 0.2;
        }
      }
      meshRef.current.setColorAt(i, tempColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    if (collectedThisFrame > 0) {
      collectedCountRef.current += collectedThisFrame;
      onProgress(collectedCountRef.current);
      
      if (Math.random() < 0.2 && audioControls) {
          audioControls.playCollect();
      }

      if (collectedCountRef.current >= levelConfig.requiredCount) {
         if (!hasWonRef.current) {
             hasWonRef.current = true;
             onLevelComplete();
         }
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <circleGeometry args={[0.07, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

export default Swarm;
