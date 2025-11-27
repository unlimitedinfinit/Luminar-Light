
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, DynamicDrawUsage, Color, CanvasTexture, AdditiveBlending } from 'three';
import { 
  PARTICLE_COUNT, 
  FRICTION, 
  MAX_SPEED, 
  EMITTER_RATE, 
  PATH_FLOW_FORCE, 
  GRAVITY_STRENGTH,
  ARENA_BOUNDS,
  getObstaclePos,
  CRITICAL_MASS_THRESHOLD
} from '../constants';
import { LevelConfig, AnomalyData, SandboxSettings, ThemeConfig, AudioControls } from '../types';

interface SwarmProps {
  paths: Vector3[][];
  levelConfig: LevelConfig;
  anomalyRef: React.MutableRefObject<AnomalyData[]>;
  blackHoleStateRef?: React.MutableRefObject<number[]>;
  onLevelComplete: () => void;
  onProgress: (count: number) => void;
  onActiveCount: (count: number) => void;
  isPaused: boolean;
  sandboxSettings: SandboxSettings;
  setFuel: (val: number | ((prev: number) => number)) => void;
  isDrawingRef: React.MutableRefObject<boolean>;
  theme: ThemeConfig;
  audioControls: AudioControls | null;
  resetKey: number;
  mousePos: React.MutableRefObject<Vector3>;
}

const noise = (x: number, y: number, z: number) => {
    return Math.sin(x * 1.5 + z) * Math.cos(y * 1.5 + z); // Increased frequency for more jitter
};

const TRAIT_NORMAL = 0;
const TRAIT_TITAN = 1; 
const TRAIT_ROGUE = 2; 
const TRAIT_SPARK = 3; 
const TRAIT_GHOST = 4;
const TRAIT_WEAVER = 5;

const Swarm: React.FC<SwarmProps> = ({ 
  paths, 
  levelConfig, 
  anomalyRef,
  blackHoleStateRef,
  onLevelComplete, 
  onProgress, 
  onActiveCount,
  isPaused,
  sandboxSettings,
  setFuel,
  isDrawingRef,
  theme,
  audioControls,
  resetKey,
  mousePos
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const velocities = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const life = useMemo(() => new Float32Array(PARTICLE_COUNT), []); 
  const ages = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  const traits = useMemo(() => new Int8Array(PARTICLE_COUNT), []); 
  const deathTimer = useMemo(() => new Float32Array(PARTICLE_COUNT), []); 
  const chargeState = useMemo(() => new Int8Array(PARTICLE_COUNT), []); // 0 = Uncharged, 1 = Charged
  const teleportTimer = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  
  const activeCountRef = useRef(0);
  const collectedCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const currentFuelRef = useRef(0);
  const activeTitans = useRef<number[]>([]); 
  
  const activeLevelId = useRef<number>(-1);
  const hasWonRef = useRef(false);
  
  const tempColor = useMemo(() => new Color(), []);
  const colorStart = useMemo(() => new Color(), []);
  const colorEnd = useMemo(() => new Color(), []);
  const whiteColor = useMemo(() => new Color('#ffffff'), []);
  const chargedColor = useMemo(() => new Color('#ffffee'), []);
  const destroyColor = useMemo(() => new Color('#ff4400'), []);

  // SHARP TEXTURE: "Pinpoint Star" style to prevent blobbing
  const particleTexture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const center = size / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        
        // Very sharp core, fast falloff
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.8)'); 
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);

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
    onActiveCount(0);
    if (blackHoleStateRef) {
        blackHoleStateRef.current = levelConfig.obstaclePos ? new Array(levelConfig.obstaclePos.length).fill(0) : [];
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      life[i] = 0;
      ages[i] = 0;
      deathTimer[i] = 0;
      chargeState[i] = 0;
      teleportTimer[i] = 0;
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
    const shouldEmit = isInfinite || currentFuelRef.current > 0;

    let spawnedThisFrame = 0;
    let destroyedThisFrame = 0; 
    const scaledEmitterRate = EMITTER_RATE * timeScale;
    
    activeTitans.current = [];
    let currentActive = 0;
    
    if (shouldEmit) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (spawnedThisFrame >= scaledEmitterRate) break;
            
            if (life[i] <= 0 && deathTimer[i] === 0) {
                life[i] = 1;
                ages[i] = 0;
                deathTimer[i] = 0;
                chargeState[i] = 0; 
                teleportTimer[i] = 0;
                
                const rand = Math.random();
                if (rand > 0.985) traits[i] = TRAIT_TITAN;      
                else if (rand > 0.94) traits[i] = TRAIT_SPARK; 
                else if (rand > 0.90) traits[i] = TRAIT_ROGUE; 
                else if (rand > 0.85) traits[i] = TRAIT_GHOST; 
                else if (rand > 0.80) traits[i] = TRAIT_WEAVER; 
                else traits[i] = TRAIT_NORMAL;                 

                const spawnAngle = Math.random() * Math.PI * 2;
                const spawnDist = Math.random() * 0.15; 
                positions[i * 3] = levelConfig.emitterPos[0] + Math.cos(spawnAngle) * spawnDist;
                positions[i * 3 + 1] = levelConfig.emitterPos[1] + Math.sin(spawnAngle) * spawnDist;
                positions[i * 3 + 2] = 0;
                
                let speedMult = 0.12;
                if (traits[i] === TRAIT_SPARK) speedMult = 0.2;
                if (traits[i] === TRAIT_TITAN) speedMult = 0.05;

                velocities[i * 3] = Math.cos(spawnAngle) * speedMult;
                velocities[i * 3 + 1] = Math.sin(spawnAngle) * speedMult;
                
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

    let bossAngleStart = 0;
    let bossAngleEnd = 0;
    let bossKillDist = 0;
    let checkBoss = false;

    if (levelConfig.isBossLevel && !sandboxSettings.invincibility) {
        checkBoss = true;
        const progressRatio = levelConfig.requiredCount > 0 ? (collectedCountRef.current / levelConfig.requiredCount) : 0;
        const speedMult = progressRatio > 0.5 ? 2.0 : 1.0;
        const rotationSpeed = 0.5;
        
        const currentRotation = -(state.clock.elapsedTime * rotationSpeed * speedMult) % (Math.PI * 2);
        
        bossAngleStart = currentRotation;
        bossKillDist = 10.0; 
    }
    
    const GLOBAL_SCALE_MODIFIER = 0.10; // Slightly reduced to prevent overlap

    // --- SUB-STEPPING SETUP ---
    const subSteps = 3;
    const subDt = dt / subSteps;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (life[i] <= 0 && deathTimer[i] === 0) continue;
      
      currentActive++;
      const idx = i * 3;

      if (teleportTimer[i] > 0) teleportTimer[i] -= dt;

      if (traits[i] === TRAIT_TITAN && activeTitans.current.length < 50) {
          activeTitans.current.push(i);
      }

      // HANDLE DEATH ANIMATIONS
      if (deathTimer[i] !== 0) {
          if (deathTimer[i] > 0) {
              // EXPLOSION ANIMATION
              if (deathTimer[i] === 1.0) destroyedThisFrame++;
              deathTimer[i] -= dt * 4.0; 
              if (deathTimer[i] <= 0) {
                  life[i] = 0;
                  deathTimer[i] = 0;
                  dummy.position.set(-9999, -9999, 0);
                  dummy.updateMatrix();
                  meshRef.current.setMatrixAt(i, dummy.matrix);
                  continue;
              }
              const scale = (1.0 + (1.0 - deathTimer[i]) * 4.0) * GLOBAL_SCALE_MODIFIER; 
              dummy.position.set(positions[idx], positions[idx + 1], 0);
              dummy.rotation.z += dt * 10;
              dummy.scale.set(scale, scale, 1);
              dummy.updateMatrix();
              meshRef.current.setMatrixAt(i, dummy.matrix);
              meshRef.current.setColorAt(i, destroyColor);
              continue;
          }
          else {
              // IMPLOSION / SPAGHETTIFICATION ANIMATION
              deathTimer[i] += dt * 1.5; 
              if (deathTimer[i] >= 0) {
                  life[i] = 0;
                  deathTimer[i] = 0;
                  dummy.position.set(-9999, -9999, 0);
                  dummy.updateMatrix();
                  meshRef.current.setMatrixAt(i, dummy.matrix);
                  continue;
              }
              positions[idx] += velocities[idx] * dt * 5.0; 
              positions[idx + 1] += velocities[idx + 1] * dt * 5.0;
              
              const progress = 1.0 + deathTimer[i]; 
              const stretch = 1.0 + progress * 10.0;
              const width = 1.0 - progress;

              dummy.position.set(positions[idx], positions[idx + 1], 0);
              const angle = Math.atan2(velocities[idx + 1], velocities[idx]);
              dummy.rotation.z = angle;
              dummy.scale.set(stretch * GLOBAL_SCALE_MODIFIER, width * 0.5 * GLOBAL_SCALE_MODIFIER, 1);
              dummy.updateMatrix();
              meshRef.current.setMatrixAt(i, dummy.matrix);
              tempColor.lerpColors(theme.colors.secondary ? new Color(theme.colors.secondary) : colorEnd, new Color('#000000'), progress);
              meshRef.current.setColorAt(i, tempColor);
              continue;
          }
      }

      let vx = velocities[idx];
      let vy = velocities[idx + 1];
      let x = positions[idx];
      let y = positions[idx + 1];

      const trait = traits[i];

      ages[i] += dt * 0.15; 
      if (ages[i] > 1.2) { 
        life[i] = 0;
        dummy.position.set(-9999, -9999, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      
      // SEPARATION (Anti-Clumping)
      // Check 4 random neighbors (Increased from 2)
      if (trait !== TRAIT_GHOST) {
          for(let k=0; k<4; k++) {
              const otherIdx = Math.floor(Math.random() * PARTICLE_COUNT) * 3;
              if (otherIdx === idx) continue;
              const odx = x - positions[otherIdx];
              const ody = y - positions[otherIdx+1];
              const odistSq = odx*odx + ody*ody;
              if (odistSq < 0.04 && odistSq > 0.0001) { 
                  const odist = Math.sqrt(odistSq);
                  const push = (0.2 - odist) * 0.35; // Stronger push
                  vx += (odx / odist) * push;
                  vy += (ody / odist) * push;
              }
          }
      }

      // --- FORCES CALCULATION ---
      const weight = Math.max(0.2, 1.0 - (ages[i] * 0.6));
      const chaosAmount = trait === TRAIT_ROGUE ? 0.04 : 0.005; // More chaos
      vx += (Math.random() - 0.5) * chaosAmount;
      vy += (Math.random() - 0.5) * chaosAmount;

      if (trait !== TRAIT_GHOST) {
        const noiseTime = state.clock.elapsedTime * timeScale;
        const n1 = noise(x, y, noiseTime * 0.5);
        const n2 = noise(x + 10, y + 10, noiseTime * 0.3);
        const noiseDir = (trait === TRAIT_ROGUE && Math.random() > 0.9) ? -1 : 1;
        vx += (n1 + n2) * 0.01 * weight * noiseDir; // Stronger Turbulence
        vy += (n1 - n2) * 0.01 * weight * noiseDir;
      }

      if (paths.length > 0) {
        let globalClosestDistSq = Infinity;
        let globalClosestPoint: Vector3 | null = null;
        let globalClosestPathIdx = -1;
        let globalClosestPointIdx = -1;

        // Loop Backwards (Newest overrides Oldest)
        for (let pathIdx = paths.length - 1; pathIdx >= 0; pathIdx--) {
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
            if (globalClosestDistSq < 1.0) break; // Captured by this path
        }

        if (globalClosestPoint && globalClosestDistSq < 4.0) {
          const dx = globalClosestPoint.x - x;
          const dy = globalClosestPoint.y - y;
          const followFactor = (trait === TRAIT_ROGUE && Math.random() > 0.8) ? -0.5 : 1.0;

          let ageGravityMult = 1.0;
          if (ages[i] < 0.2) ageGravityMult = 0.5; 
          if (ages[i] > 0.8) ageGravityMult = 1.5; 

          vx += dx * gravityForce * 3.0 * ageGravityMult * weight * followFactor;
          vy += dy * gravityForce * 3.0 * ageGravityMult * weight * followFactor;
          
          vx *= 0.98; 
          vy *= 0.98;

          const path = paths[globalClosestPathIdx];
          if (globalClosestPointIdx < path.length - 2) {
            const nextP = path[globalClosestPointIdx + 2];
            const dirX = nextP.x - globalClosestPoint.x;
            const dirY = nextP.y - globalClosestPoint.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            
            vx += (dirX / len) * flowForce * 2.5 * weight * followFactor;
            vy += (dirY / len) * flowForce * 2.5 * weight * followFactor;

            const currentSpeedSq = vx*vx + vy*vy;
            if (currentSpeedSq < 0.0025) { 
                 vx += (dirX / len) * 0.02;
                 vy += (dirY / len) * 0.02;
            }
          }
        }
      }

      // Check Boss (Start of frame check)
      if (checkBoss) {
          const dxTarget = x - targetPos.x;
          const dyTarget = y - targetPos.y;
          const distToTarget = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);
          if (distToTarget < bossKillDist && distToTarget > 1.6) {
               const cosR = Math.cos(-bossAngleStart);
               const sinR = Math.sin(-bossAngleStart);
               const localX = dxTarget * cosR - dyTarget * sinR;
               const localY = dxTarget * sinR + dyTarget * cosR;
               const localAngle = Math.atan2(localY, localX);
               if (localAngle > 0 && localAngle < 1.57) { // 90 deg sector
                    deathTimer[i] = 1.0; 
                    continue;
               }
          }
      }

      // --- MOVEMENT SUB-STEPPING ---
      let collided = false;

      for (let s = 0; s < subSteps; s++) {
          x += vx * subDt;
          y += vy * subDt;

          // 1. Check Obstacles & Black Holes
          if (trait !== TRAIT_GHOST && levelConfig.obstaclePos) {
              for (let o = 0; o < levelConfig.obstaclePos.length; o++) {
                  const basePos = levelConfig.obstaclePos[o];
                  const behavior = levelConfig.obstacleBehaviors?.[o];
                  const obsPos = getObstaclePos(basePos, behavior, state.clock.elapsedTime + s * subDt, o * 100);
                  
                  const type = levelConfig.obstacleTypes?.[o];
                  const dx = x - obsPos[0];
                  const dy = y - obsPos[1];
                  const distSq = dx * dx + dy * dy;
                  const rad = levelConfig.obstacleRadius || 1.0;
                  
                  // SYNC WITH VISUAL SCALE
                  const visualRadius = type === 'blackhole' ? rad * 0.5 : rad * 0.25; 
                  
                  // DYNAMIC BLACK HOLE GROWTH PHYSICS
                  let effectiveRad = visualRadius;
                  if (type === 'blackhole' && blackHoleStateRef && blackHoleStateRef.current) {
                      const mass = blackHoleStateRef.current[o] || 0;
                      // Matches Visual Formula: 1.0 + (mass / 50.0) * 2.0
                      // Base is 1.0 relative to original, so mult visualRadius
                      const growth = 1.0 + (mass / 50.0) * 2.0; 
                      effectiveRad *= growth;
                  }

                  const collisionRad = effectiveRad * 0.9;
                  
                  if (type === 'blackhole') {
                      const pullRange = effectiveRad * 10.0; 
                      
                      // Event Horizon (Capture)
                      if (distSq < collisionRad * collisionRad) {
                          if (sandboxSettings.invincibility) {
                              // Safe
                          } else {
                              deathTimer[i] = -1.0; // Trigger Capture Animation
                              velocities[idx] = (dx / Math.sqrt(distSq)) * 2.0; 
                              velocities[idx+1] = (dy / Math.sqrt(distSq)) * 2.0;
                              // INCREMENT MASS
                              if (blackHoleStateRef && blackHoleStateRef.current && blackHoleStateRef.current[o] !== undefined) {
                                  blackHoleStateRef.current[o]++;
                              }
                              collided = true;
                              break;
                          }
                      }
                      
                      // Gravity
                      if (distSq < pullRange * pullRange) {
                          const dist = Math.sqrt(distSq);
                          const swirlX = -dy / dist;
                          const swirlY = dx / dist;
                          const swirlForce = 0.8 * (1 - dist / pullRange); // Stronger swirl
                          const force = 0.3 * (1 - dist / pullRange);
                          vx -= (dx / dist) * force; 
                          vy -= (dy / dist) * force;
                          vx += swirlX * swirlForce;
                          vy += swirlY * swirlForce;
                      }
                  } else {
                      if (distSq < collisionRad * collisionRad) {
                          if (!sandboxSettings.invincibility) {
                              deathTimer[i] = 1.0; 
                              collided = true;
                              break; 
                          }
                      }
                  }
              }
          }
          if (collided) break;

          // 2. Check Walls (Anti-Tunneling with HARD PUSH OUT)
          if (levelConfig.walls && !sandboxSettings.invincibility) {
              for (const wall of levelConfig.walls) {
                  const wx = wall.position[0];
                  const wy = wall.position[1];
                  const halfW = wall.size[0] / 2;
                  const halfH = wall.size[1] / 2;
                  const cos = Math.cos(-wall.rotation);
                  const sin = Math.sin(-wall.rotation);
                  
                  const dx = x - wx;
                  const dy = y - wy;
                  const localX = dx * cos - dy * sin;
                  const localY = dx * sin + dy * cos;
                  
                  const pad = 0.15; 
                  
                  if (localX > -halfW - pad && localX < halfW + pad && localY > -halfH - pad && localY < halfH + pad) {
                      
                      if (Math.random() < 0.1) { 
                          deathTimer[i] = 1.0; 
                          collided = true;
                          break;
                      }

                      const distToLeft = localX - (-halfW);
                      const distToRight = halfW - localX;
                      const distToTop = halfH - localY;
                      const distToBottom = localY - (-halfH);
                      const min = Math.min(distToLeft, distToRight, distToTop, distToBottom);
                      
                      let pushX = 0; let pushY = 0; let pushDist = 0;
                      if (min === distToLeft) { pushX = -1; pushDist = distToLeft + 0.05; }
                      else if (min === distToRight) { pushX = 1; pushDist = distToRight + 0.05; }
                      else if (min === distToBottom) { pushY = -1; pushDist = distToBottom + 0.05; }
                      else { pushY = 1; pushDist = distToTop + 0.05; }

                      const lXNew = localX + pushX * pushDist;
                      const lYNew = localY + pushY * pushDist;
                      
                      const wXNew = lXNew * Math.cos(wall.rotation) - lYNew * Math.sin(wall.rotation) + wx;
                      const wYNew = lXNew * Math.sin(wall.rotation) + lYNew * Math.cos(wall.rotation) + wy;
                      
                      x = wXNew;
                      y = wYNew;

                      const worldNormX = pushX * Math.cos(wall.rotation) - pushY * Math.sin(wall.rotation);
                      const worldNormY = pushX * Math.sin(wall.rotation) + pushY * Math.cos(wall.rotation);
                      
                      const dot = vx * worldNormX + vy * worldNormY;
                      if (dot < 0) { 
                          vx = vx - 2 * dot * worldNormX;
                          vy = vy - 2 * dot * worldNormY;
                          vx *= 0.6; 
                          vy *= 0.6;
                      }
                  }
              }
          }
          if (collided) break;
      }

      if (collided) continue;

      positions[idx] = x;
      positions[idx + 1] = y;

      const friction = trait === TRAIT_TITAN ? 0.98 : (trait === TRAIT_GHOST ? 0.99 : FRICTION);
      vx *= friction;
      vy *= friction;

      let effectiveMaxSpeed = baseMaxSpeed * (1.0 - (ages[i] * 0.3));
      if (ages[i] < 0.2) effectiveMaxSpeed *= 1.3; 
      if (ages[i] > 0.8) effectiveMaxSpeed *= 0.6; 
      if (trait === TRAIT_TITAN) effectiveMaxSpeed *= 0.6;
      if (trait === TRAIT_SPARK) effectiveMaxSpeed *= 2.2;
      if (trait === TRAIT_GHOST) effectiveMaxSpeed *= 1.2; 

      const speedSq = vx * vx + vy * vy;
      if (speedSq > effectiveMaxSpeed * effectiveMaxSpeed) {
        const speed = Math.sqrt(speedSq);
        vx = (vx / speed) * effectiveMaxSpeed;
        vy = (vy / speed) * effectiveMaxSpeed;
      }

      velocities[idx] = vx;
      velocities[idx + 1] = vy;
      
      if (positions[idx] > ARENA_BOUNDS.x) { positions[idx] = ARENA_BOUNDS.x; velocities[idx] *= -1; }
      if (positions[idx] < -ARENA_BOUNDS.x) { positions[idx] = -ARENA_BOUNDS.x; velocities[idx] *= -1; }
      if (positions[idx + 1] > ARENA_BOUNDS.y) { positions[idx + 1] = ARENA_BOUNDS.y; velocities[idx + 1] *= -1; }
      if (positions[idx + 1] < -ARENA_BOUNDS.y) { positions[idx + 1] = -ARENA_BOUNDS.y; velocities[idx + 1] *= -1; }
      
      // --- RENDER UPDATES ---
      let dispX = positions[idx];
      let dispY = positions[idx + 1];

      if (ages[i] > 0.8) {
           dispX += (Math.random() - 0.5) * 0.05;
           dispY += (Math.random() - 0.5) * 0.05;
      }

      if (trait === TRAIT_WEAVER) {
          const speed = Math.sqrt(speedSq) || 0.1;
          const nvx = vx / speed;
          const nvy = vy / speed;
          const wave = Math.sin(ages[i] * 15) * 0.3;
          dispX += -nvy * wave;
          dispY += nvx * wave;
      }

      dummy.position.set(dispX, dispY, 0);
      const angle = Math.atan2(vy, vx);
      dummy.rotation.z = angle;
      const stretch = 1 + Math.sqrt(speedSq) * 3;
      
      const baseScaleY = 0.4 + (ages[i] * 0.4);
      const scaleMult = sandboxSettings.giantMode ? 2.5 : 1;

      let sx = stretch;
      let sy = baseScaleY;
      
      if (ages[i] < 0.2) { sx *= 1.2; sy *= 0.7; }
      if (ages[i] > 0.8) { sx *= 0.7; sy *= 1.3; }
      if (sandboxSettings.hyperTrails) sx *= 5.0; 

      if (trait === TRAIT_TITAN) {
          const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
          sx = 3.0 * pulse;
          sy = 3.0 * pulse;
      } else if (trait === TRAIT_SPARK) {
          sx *= 2.0; sy *= 0.3;
      } else if (trait === TRAIT_GHOST) {
          sy *= 0.8 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
      }

      dummy.scale.set(sx * scaleMult * GLOBAL_SCALE_MODIFIER, sy * scaleMult * GLOBAL_SCALE_MODIFIER, 1); 
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color Updates
      if (sandboxSettings.rainbowMode) {
          const hue = (state.clock.elapsedTime * 0.2 + (i * 0.001)) % 1;
          tempColor.setHSL(hue, 1, 0.6);
      } else if (chargeState[i] === 1) {
          tempColor.lerpColors(chargedColor, whiteColor, Math.sin(state.clock.elapsedTime * 10) * 0.5 + 0.5);
      } else {
        const ageNorm = Math.min(1, ages[i]);
        if (trait === TRAIT_GHOST) {
            tempColor.setRGB(0.8, 1.0, 1.0);
        } else if (trait === TRAIT_WEAVER) {
            tempColor.lerpColors(new Color('#ffaa00'), new Color('#aaff00'), Math.sin(ages[i] * 5) * 0.5 + 0.5);
        } else {
            if (ages[i] < 0.2) { 
                 tempColor.lerpColors(whiteColor, colorStart, ageNorm * 5); 
            } else if (ages[i] > 0.8) { 
                 tempColor.lerpColors(colorEnd, new Color('#333333'), (ageNorm - 0.8) * 5);
            } else {
                 tempColor.lerpColors(colorStart, colorEnd, ageNorm);
            }

            if (trait === TRAIT_TITAN) tempColor.addScalar(0.3);
            else if (trait === TRAIT_ROGUE) {
                tempColor.r += 0.4;
                if (Math.random() > 0.8) tempColor.setRGB(1, 1, 1);
            } else if (trait === TRAIT_SPARK) tempColor.setRGB(1, 1, 0.5);
        }
      }
      meshRef.current.setColorAt(i, tempColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    if (frameCountRef.current % 10 === 0) {
        onActiveCount(currentActive);
    }

    if (destroyedThisFrame > 0 && audioControls && Math.random() > 0.7) {
        audioControls.playDestroy();
    }

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
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={particleTexture}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false} 
      />
    </instancedMesh>
  );
};

export default Swarm;
