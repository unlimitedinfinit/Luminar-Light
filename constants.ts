
import { LevelConfig, ThemeConfig, Wall, Portal } from './types';

export const PARTICLE_COUNT = 4000;
export const TARGET_FILL_RATE = 1;
export const GRAVITY_STRENGTH = 0.05;
export const PATH_FLOW_FORCE = 0.08;
export const FRICTION = 0.96;
export const MAX_SPEED = 0.45;
export const EMITTER_RATE = 20; 
export const RANDOM_FORCE = 0.015;

const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

export const getLevelConfig = (index: number): LevelConfig => {
  const levelNum = index + 1;
  const isBoss = levelNum % 5 === 0;
  const seedBase = index * 492.5;

  // ERA SYSTEM
  // 1-9: Basics (Orbit)
  // 10-19: The Labyrinth (Walls)
  // 20-29: Wormholes (Portals)
  // 30-39: Pulsars (Time)
  // 40+: Chaos (Mixed)
  const era = Math.floor((levelNum - 1) / 10);

  // BASE COORDINATES
  // Rotate positions to keep it fresh
  const angle = index * 0.8 + seededRandom(seedBase) * 2;
  const radius = 6 + seededRandom(seedBase + 1) * 3;
  
  let ex = Math.cos(angle) * radius;
  let ey = Math.sin(angle) * radius;
  
  let tx = Math.cos(angle + Math.PI) * radius;
  let ty = Math.sin(angle + Math.PI) * radius;

  // OBSTACLES (Standard)
  const obstacles: [number, number, number][] = [];
  const obstacleTypes: ('static' | 'blackhole' | 'pulsar')[] = [];
  const walls: Wall[] = [];
  const portals: Portal[] = [];

  // ERA 0: BASICS & OBSTACLES
  if (era === 0 || era >= 3) {
      const numObstacles = isBoss ? 3 + Math.floor(index / 10) : 1 + Math.floor(index / 5);
      for (let i = 0; i < numObstacles; i++) {
        const t = 0.2 + seededRandom(seedBase + 3 + i) * 0.6; 
        const ox = ex + (tx - ex) * t + (seededRandom(seedBase + 4 + i) - 0.5) * 4;
        const oy = ey + (ty - ey) * t + (seededRandom(seedBase + 5 + i) - 0.5) * 4;
        
        // Safety check
        const d1 = Math.hypot(ox-ex, oy-ey);
        const d2 = Math.hypot(ox-tx, oy-ty);

        if (d1 > 3 && d2 > 3) {
            obstacles.push([ox, oy, 0]);
            const isBlackHole = levelNum > 5 && seededRandom(seedBase + 10 + i) > 0.7;
            const isPulsar = era >= 3 && seededRandom(seedBase + 20 + i) > 0.6;
            
            if (isPulsar) obstacleTypes.push('pulsar');
            else if (isBlackHole) obstacleTypes.push('blackhole');
            else obstacleTypes.push('static');
        }
      }
  }

  // ERA 1: THE LABYRINTH (Walls)
  if (era === 1 || era === 4) {
      // Create a wall between emitter and target
      const mx = (ex + tx) / 2;
      const my = (ey + ty) / 2;
      const angleToTarget = Math.atan2(ty - ey, tx - ex);
      
      // Type A: Split Wall (Two walls with gap)
      if (levelNum % 2 === 0) {
        walls.push({
            position: [mx + Math.cos(angleToTarget + Math.PI/2) * 3, my + Math.sin(angleToTarget + Math.PI/2) * 3, 0],
            size: [1, 6, 1],
            rotation: angleToTarget
        });
        walls.push({
            position: [mx - Math.cos(angleToTarget + Math.PI/2) * 3, my - Math.sin(angleToTarget + Math.PI/2) * 3, 0],
            size: [1, 6, 1],
            rotation: angleToTarget
        });
      } 
      // Type B: Box (Cage around target)
      else {
         walls.push({
             position: [tx + Math.cos(angleToTarget + Math.PI) * 3, ty + Math.sin(angleToTarget + Math.PI) * 3, 0],
             size: [0.5, 5, 1],
             rotation: angleToTarget
         });
      }
  }

  // ERA 2: WORMHOLES (Portals)
  if (era === 2 || era === 4) {
      // Place a wall blocking direct path
      const mx = (ex + tx) / 2;
      const my = (ey + ty) / 2;
      const angleToTarget = Math.atan2(ty - ey, tx - ex);

      walls.push({
        position: [mx, my, 0],
        size: [1, 12, 1], // Huge wall
        rotation: angleToTarget + Math.PI/2
      });

      // Portal 1 (Orange) - Near Emitter but off to side
      const p1x = ex + Math.cos(angleToTarget + Math.PI/2) * 4;
      const p1y = ey + Math.sin(angleToTarget + Math.PI/2) * 4;

      // Portal 2 (Blue) - Near Target but off to side
      const p2x = tx + Math.cos(angleToTarget - Math.PI/2) * 4;
      const p2y = ty + Math.sin(angleToTarget - Math.PI/2) * 4;

      portals.push({ id: 1, position: [p1x, p1y, 0], target: [p2x, p2y, 0], color: '#ffaa00' }); // In
      portals.push({ id: 2, position: [p2x, p2y, 0], target: [p1x, p1y, 0], color: '#00aaff' }); // Out/In bi-directional
  }

  // Difficulty scaling
  const baseReq = (3000 + (index * 200)) * 0.7; // Lowered curve
  const req = Math.floor(isBoss ? baseReq * 0.8 : baseReq);
  const budget = levelNum >= 7 ? Math.floor(req * 3.5) : undefined;

  return {
    id: levelNum,
    emitterPos: [ex, ey, 0],
    targetPos: [tx, ty, 0],
    targetRadius: isBoss ? 1.6 : 1.2, // Reduced from 3.0/1.5 to 1.6/1.2
    obstaclePos: obstacles,
    obstacleTypes: obstacleTypes,
    obstacleRadius: isBoss ? 1.8 : 1.5 + seededRandom(seedBase + 6) * 0.8,
    walls: walls,
    portals: portals,
    requiredCount: req,
    particleBudget: budget, 
    isBossLevel: isBoss,
    movingObstacles: isBoss,
  };
};

// Explicit tutorial levels
const TUTORIAL_LEVELS: LevelConfig[] = [
  {
    id: 1,
    emitterPos: [-5, 0, 0],
    targetPos: [5, 0, 0],
    targetRadius: 1.2,
    requiredCount: 2000, 
    particleBudget: undefined,
  },
  {
    id: 2,
    emitterPos: [-7, -4, 0],
    targetPos: [0, 4, 0],
    targetRadius: 1.2,
    obstaclePos: [[0, 0, 0]],
    obstacleTypes: ['static'],
    obstacleRadius: 1.5,
    requiredCount: 3000, 
    particleBudget: undefined,
  },
  {
    id: 3,
    emitterPos: [0, -6, 0],
    targetPos: [0, 6, 0],
    targetRadius: 1.2,
    obstaclePos: [[-3.5, 0, 0], [3.5, 0, 0]], 
    obstacleTypes: ['static', 'blackhole'],
    obstacleRadius: 2,
    requiredCount: 3500, 
    particleBudget: undefined,
  }
];

export const getLevel = (index: number): LevelConfig => {
  if (index < TUTORIAL_LEVELS.length) {
    return TUTORIAL_LEVELS[index];
  }
  return getLevelConfig(index);
};

export const THEMES: Record<string, ThemeConfig> = {
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic Void',
    colors: {
      primary: '#00ffff', // Cyan
      secondary: '#ff0088', // Magenta
      background1: '#02010a', // Deep Purple/Black
      background2: '#050214', // Deep Blue/Black
      particleStart: '#00ffff',
      particleEnd: '#ff00ff',
    }
  },
  zen: {
    id: 'zen',
    name: 'Zen Garden',
    colors: {
      primary: '#00ffaa', // Spring Green
      secondary: '#ffdd00', // Gold
      background1: '#001a11', // Deep Green
      background2: '#002626', // Teal Dark
      particleStart: '#ccffcc',
      particleEnd: '#00cc66',
    }
  },
  retro: {
    id: 'retro',
    name: 'Synthwave',
    colors: {
      primary: '#ff00ff', // Hot Pink
      secondary: '#00ffff', // Cyan
      background1: '#1a001a', // Deep Purple
      background2: '#2b002b', // Darker Purple
      particleStart: '#ff00cc',
      particleEnd: '#3300ff',
    }
  },
  amber: {
    id: 'amber',
    name: 'Solar Flare',
    colors: {
      primary: '#ffaa00', // Orange
      secondary: '#ff4400', // Red
      background1: '#1a0a00', // Dark Brown
      background2: '#2b1100', // Dark Red/Brown
      particleStart: '#ffff00',
      particleEnd: '#ff0000',
    }
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      primary: '#aaddff', // Light Blue
      secondary: '#ffffff', // White
      background1: '#000000', // Black
      background2: '#0a0a20', // Dark Navy
      particleStart: '#ffffff',
      particleEnd: '#4444ff',
    }
  },
  forest: {
    id: 'forest',
    name: 'Deep Forest',
    colors: {
      primary: '#55ff55', // Lime
      secondary: '#ffff55', // Yellow
      background1: '#051a05', // Black Green
      background2: '#0a220a', // Dark Green
      particleStart: '#aaffaa',
      particleEnd: '#005500',
    }
  }
};

export const COMPLETION_MESSAGES = [
  "Entropy reversed.", "The swarm is pleased.", "Harmonic convergence achieved.", 
  "Physics approves.", "Flow state restored.", "A symphony of light.", 
  "Chaos managed.", "The void smiles back.", "Orbit stabilized.", 
  "Stardust organized.", "Luminosity increased.", "Gravity obeyed.", 
  "Singularity avoided.", "Data stream harmonious.", "The algorithm purrs.", 
  "Quantum entanglement stable.", "Energy efficiency: 100%.", "Ethereal pathways aligned.", 
  "Simulation: Optimal.", "You are a good shepherd.", "Celestial balance found.", 
  "Drift correction applied.", "Nebula density nominal.", "Particle cohesion maximum.", 
  "The universe exhales.", "Silence in the void.", "Brilliant trajectory.", 
  "Logic gate open.", "Resonance found.", "Vector field purified.", 
  "Matter rearranged.", "Cosmic dust swept.", "Navigation successful.", 
  "Pilot grade: Alpha.", "System homeostasis.", "The glow intensifies.", 
  "Frequency matched.", "Wavelength perfected.", "Swarm intelligence upgraded.", 
  "Trajectory: Beautiful.", "Space-time untangled.", "Event horizon safely ignored.", 
  "Dark matter displaced.", "Photons gathered.", "A constellation forms.", 
  "Stellar nursery fed.", "Galactic spin synchronized.", "Hyperdrive cooling.", 
  "Zero-G success.", "Atmosphere: Electric.", "Magnetic flux stable.", 
  "Calculations correct.", "The math works.", "Serenity now.", 
  "Peace in the machine.", "Digital zen.", "Pixel perfect.", 
  "Resolution achieved.", "Frame rate stable.", "Memory leak plugged.", 
  "Cache cleared.", "Buffer flush complete.", "Signal received.", 
  "Transmission ending.", "Uplink established.", "Download complete.", 
  "Upgrade installed.", "Patch applied.", "Bug squashed.", 
  "Code compiled.", "Syntax verified.", "Logic parsed.", 
  "Render complete.", "Shaders compiled.", "Textures loaded.", 
  "Polygons smoothed.", "Vertices aligned.", "Normals calculated.", 
  "Raytracing engaged.", "Bloom intensified.", "Antialiasing max.", 
  "Vignette applied.", "Chromatic aberration minimized.", "Lens flare observed.", 
  "Field of view optimal.", "Depth of field calibrated.", "Motion blur smooth.", 
  "Refresh rate sync.", "Latency zero.", "Ping: 1ms.", 
  "Packet loss: 0%.", "Connection stable.", "Server acknowledging.", 
  "Client responding.", "Handshake valid.", "Protocol adhered.", 
  "Encryption secure.", "Firewall green.", "Access granted.", 
  "Admin privileges.", "Root access.", "Sudo success."
];
