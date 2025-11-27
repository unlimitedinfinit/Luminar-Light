
import { LevelConfig, ThemeConfig, Wall, Portal, Charger } from './types';

export const PARTICLE_COUNT = 4000;
export const TARGET_FILL_RATE = 1;
export const GRAVITY_STRENGTH = 0.05;
export const PATH_FLOW_FORCE = 0.08;
export const FRICTION = 0.96;
export const MAX_SPEED = 0.45;
export const EMITTER_RATE = 20; 
export const RANDOM_FORCE = 0.015;
export const CRITICAL_MASS_THRESHOLD = 50;

// Physics boundaries for containment
export const ARENA_BOUNDS = {
    x: 13,
    y: 6.5
};

const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

export const getObstaclePos = (basePos: [number, number, number], behavior: string | undefined, t: number, seed: number): [number, number, number] => {
    if (!behavior || behavior === 'static') return basePos;
    
    const [x, y, z] = basePos;
    const speed = 0.8; // Increased from 0.5 for more noticeable movement
    
    if (behavior === 'orbit') {
        const rad = 2.5;
        const angle = t * speed + seed;
        return [x + Math.cos(angle) * rad, y + Math.sin(angle) * rad, z];
    }
    if (behavior === 'patrolX') {
        const range = 3.0;
        return [x + Math.sin(t * speed + seed) * range, y, z];
    }
    if (behavior === 'patrolY') {
        const range = 2.0;
        return [x, y + Math.sin(t * speed + seed) * range, z];
    }
    if (behavior === 'wander') {
        return [
            x + Math.sin(t * 0.3 + seed) * 2,
            y + Math.cos(t * 0.4 + seed) * 2,
            z
        ];
    }
    return basePos;
};

export const getLevelConfig = (index: number): LevelConfig => {
  const levelNum = index + 1;
  const isBoss = levelNum % 5 === 0;
  const seedBase = index * 492.5;

  const era = Math.floor((levelNum - 1) / 10);

  const angle = index * 0.8 + seededRandom(seedBase) * 2;
  const radius = 5.5 + seededRandom(seedBase + 1) * 2.5;
  
  let ex = Math.cos(angle) * radius;
  let ey = Math.sin(angle) * radius;
  ey = Math.max(-5, Math.min(5, ey));
  ex = Math.max(-9, Math.min(9, ex));
  
  let tx = Math.cos(angle + Math.PI) * radius;
  let ty = Math.sin(angle + Math.PI) * radius;
  ty = Math.max(-5, Math.min(5, ty));
  tx = Math.max(-9, Math.min(9, tx));

  const obstacles: [number, number, number][] = [];
  const obstacleTypes: ('static' | 'blackhole' | 'pulsar' | 'debris')[] = [];
  const obstacleBehaviors: ('static' | 'orbit' | 'patrolX' | 'patrolY' | 'wander')[] = [];
  const walls: Wall[] = [];
  const portals: Portal[] = [];
  const chargers: Charger[] = [];
  let conversionRequired = false;
  
  // Default radius is smaller now to accommodate more density
  let obstacleRadiusGen = 0.6 + seededRandom(seedBase + 6) * 0.4;

  const puzzleType = seededRandom(seedBase + 50); // 0.0 - 1.0

  // --- PUZZLE ARCHETYPES ---
  
  // 1. CHARGER PUZZLE (Chance increases with level)
  if (levelNum > 3 && puzzleType < 0.3) {
      const midX = (ex + tx) / 2;
      const midY = (ey + ty) / 2;
      const dist = Math.hypot(tx-ex, ty-ey);
      const angle = Math.atan2(ty-ey, tx-ex);
      
      walls.push({
          position: [midX, midY, 0],
          size: [1, dist * 0.6, 1],
          rotation: angle + Math.PI/2
      });

      const offset = seededRandom(seedBase + 51) > 0.5 ? 4 : -4;
      const cx = midX + Math.cos(angle + Math.PI/2) * offset;
      const cy = midY + Math.sin(angle + Math.PI/2) * offset;
      
      chargers.push({
          position: [cx, cy, 0],
          radius: 1.5
      });
      conversionRequired = true;
  }

  // 2. PORTAL PUZZLE (Chance increases with level)
  else if (levelNum > 6 && puzzleType < 0.5) {
      const midX = (ex + tx) / 2;
      const midY = (ey + ty) / 2;
      const angle = Math.atan2(ty-ey, tx-ex);

      walls.push({
          position: [midX, midY, 0],
          size: [1, 10, 1],
          rotation: angle + Math.PI/2
      });

      const px1 = ex + Math.cos(angle + Math.PI/4) * 3;
      const py1 = ey + Math.sin(angle + Math.PI/4) * 3;
      const px2 = tx + Math.cos(angle - Math.PI/4) * 3;
      const py2 = ty + Math.sin(angle - Math.PI/4) * 3;

      portals.push({ id: 1, position: [px1, py1, 0], target: [px2, py2, 0], color: '#ffaa00' });
      portals.push({ id: 2, position: [px2, py2, 0], target: [px1, py1, 0], color: '#00aaff' });
  }

  // 3. MINEFIELD (Debris & Black Holes)
  else if (levelNum > 2) {
      const bhCount = 2 + Math.floor(seededRandom(seedBase + 60) * 3); 
      for(let i=0; i<bhCount; i++) {
           const t = 0.2 + seededRandom(seedBase + 61 + i) * 0.6;
           const bx = ex + (tx - ex) * t + (seededRandom(seedBase + 62 + i) - 0.5) * 6;
           const by = ey + (ty - ey) * t + (seededRandom(seedBase + 63 + i) - 0.5) * 6;
           
           if (Math.hypot(bx-ex, by-ey) > 3 && Math.hypot(bx-tx, by-ty) > 3) {
               obstacles.push([bx, by, 0]);
               obstacleTypes.push('blackhole');
               obstacleBehaviors.push(levelNum > 15 ? 'wander' : 'static');
           }
      }
  }

  // --- STANDARD OBSTACLES ---
  const extraObstacles = 2 + Math.floor(seededRandom(seedBase + 70) * 4);
  for (let i = 0; i < extraObstacles; i++) {
        const ox = (seededRandom(seedBase + 80 + i) - 0.5) * 16;
        const oy = (seededRandom(seedBase + 90 + i) - 0.5) * 8;
        
        let safe = true;
        if (Math.hypot(ox-ex, oy-ey) < 2) safe = false;
        if (Math.hypot(ox-tx, oy-ty) < 2) safe = false;
        obstacles.forEach(prev => {
            if (Math.hypot(ox-prev[0], oy-prev[1]) < 2) safe = false;
        });
        walls.forEach(w => {
            if (Math.hypot(ox-w.position[0], oy-w.position[1]) < 3) safe = false;
        });

        if (safe) {
            obstacles.push([ox, oy, 0]);
            
            const rType = seededRandom(seedBase + 100 + i);
            if (rType > 0.8 && levelNum > 10) obstacleTypes.push('pulsar');
            else if (rType > 0.6) obstacleTypes.push('static');
            else obstacleTypes.push('debris'); 

            const rBehav = seededRandom(seedBase + 110 + i);
            if (isBoss) obstacleBehaviors.push('orbit');
            else if (rBehav > 0.7 && levelNum > 8) obstacleBehaviors.push('patrolY');
            else obstacleBehaviors.push('static');
        }
  }

  // Maze Walls logic for Era 1
  const generateMazeWalls = () => {
      const cols = 5;
      const rows = 3;
      const cellW = 16 / cols;
      const cellH = 8 / rows;
      
      for (let c = 1; c < cols; c++) {
          for (let r = 1; r < rows; r++) {
              if (seededRandom(seedBase + c * r) > 0.6) {
                  const x = -8 + c * cellW;
                  const y = -4 + r * cellH;
                  const isVertical = seededRandom(seedBase + c * r + 1) > 0.5;
                  
                  if (Math.hypot(x-ex, y-ey) > 3 && Math.hypot(x-tx, y-ty) > 3) {
                      walls.push({
                          position: [x, y, 0],
                          size: isVertical ? [0.5, cellH * 1.2, 1] : [cellW * 1.2, 0.5, 1],
                          rotation: 0
                      });
                  }
              }
          }
      }
  };

  if (era === 1) generateMazeWalls();

  // Era 4 Chaos
  if (era >= 4 && portals.length === 0) {
      portals.push({ id: 3, position: [0, 3, 0], target: [0, -3, 0], color: '#ff00ff' });
      portals.push({ id: 4, position: [0, -3, 0], target: [0, 3, 0], color: '#00ffff' });
  }

  const baseReq = (3000 + (index * 200)) * 0.7; 
  const req = Math.floor(isBoss ? baseReq * 0.8 : baseReq);
  const budget = levelNum >= 7 ? Math.floor(req * 3.5) : undefined;

  return {
    id: levelNum,
    emitterPos: [ex, ey, 0],
    targetPos: [tx, ty, 0],
    targetRadius: isBoss ? 1.6 : 1.2, 
    obstaclePos: obstacles,
    obstacleTypes: obstacleTypes,
    obstacleBehaviors: obstacleBehaviors,
    obstacleRadius: isBoss ? 1.4 : obstacleRadiusGen,
    walls: walls,
    portals: portals,
    chargers: chargers,
    conversionRequired: conversionRequired,
    requiredCount: req,
    particleBudget: budget, 
    isBossLevel: isBoss,
    movingObstacles: isBoss,
  };
};

const TUTORIAL_LEVELS: LevelConfig[] = [
  {
    id: 1,
    emitterPos: [-5, 0, 0],
    targetPos: [5, 0, 0],
    targetRadius: 1.2,
    requiredCount: 2000, 
    particleBudget: undefined,
    obstaclePos: [[0, 2, 0], [0, -2, 0], [-2, 0, 0]], 
    obstacleTypes: ['debris', 'debris', 'static'],
    walls: [
        { position: [2, 0, 0], size: [0.5, 3, 1], rotation: 0 } 
    ]
  },
  {
    id: 2,
    emitterPos: [-7, -4, 0],
    targetPos: [0, 4, 0],
    targetRadius: 1.2,
    obstaclePos: [[0, 0, 0], [2, 2, 0], [-2, 2, 0]],
    obstacleTypes: ['blackhole', 'debris', 'debris'], 
    obstacleRadius: 0.8, // Small black hole
    requiredCount: 3000, 
    particleBudget: undefined,
    walls: [
        { position: [-2, 0, 0], size: [4, 0.5, 1], rotation: Math.PI / 4 }, 
        { position: [2, 0, 0], size: [4, 0.5, 1], rotation: -Math.PI / 4 }
    ]
  },
  {
    id: 3,
    emitterPos: [0, -6, 0],
    targetPos: [0, 6, 0],
    targetRadius: 1.2,
    obstaclePos: [[-3.5, 0, 0], [3.5, 0, 0], [0, 0, 0]], 
    obstacleTypes: ['static', 'blackhole', 'debris'],
    obstacleRadius: 1.0,
    requiredCount: 3500, 
    particleBudget: undefined,
    walls: [
        { position: [0, -2, 0], size: [6, 0.5, 1], rotation: 0 }, 
        { position: [4, 0, 0], size: [0.5, 4, 1], rotation: 0 },
        { position: [-4, 2, 0], size: [0.5, 4, 1], rotation: 0 }
    ]
  },
  {
    id: 4,
    emitterPos: [-6, 0, 0],
    targetPos: [6, 0, 0],
    targetRadius: 1.2,
    requiredCount: 3000,
    particleBudget: undefined,
    walls: [
        { position: [0, 0, 0], size: [0.5, 6, 1], rotation: 0 } 
    ],
    chargers: [
        { position: [0, 3.5, 0], radius: 1.5 },
        { position: [0, -3.5, 0], radius: 1.5 }
    ],
    conversionRequired: true, 
    obstaclePos: [[3, 0, 0], [-3, 0, 0]],
    obstacleTypes: ['debris', 'debris']
  },
  {
    id: 5,
    emitterPos: [-6, 3, 0],
    targetPos: [6, -3, 0],
    targetRadius: 1.2,
    requiredCount: 3500,
    particleBudget: undefined,
    walls: [
        { position: [0, 0, 0], size: [0.5, 12, 1], rotation: 0 } 
    ],
    portals: [
        { id: 1, position: [-3, -2, 0], target: [3, 2, 0], color: '#ffaa00' }, 
        { id: 2, position: [3, 2, 0], target: [-3, -2, 0], color: '#00aaff' } 
    ],
    obstaclePos: [[-3, 3, 0]],
    obstacleTypes: ['static']
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

export const LORE_FRAGMENTS = [
    "INTERCEPT: The swarm remembers the old path. Remind them.",
    "QUERY: Is the gravity real, or merely a suggestion?",
    "TIP: Walls are absolute. Light is flexible.",
    "LORE: We built the emitters to seed the stars. We forgot to stop them.",
    "INTERCEPT: Black holes are just greedy math. Don't feed them.",
    "TIP: Short bursts conserve fuel. Long paths create highways.",
    "QUERY: Who is drawing the line? You, or the machine?",
    "LORE: The Watchers only blink when they are confused.",
    "TIP: Speed kills. Patience fills the reactor.",
    "INTERCEPT: The singularity is hungry today.",
    "QUERY: Why do particles fear the edge?",
    "LORE: These are not dust. They are data.",
    "TIP: Portals preserve momentum. Use it wisely.",
    "INTERCEPT: System drift detected. Correct immediately.",
    "QUERY: Are you optimizing, or just playing?",
    "LORE: The first pilot went through the portal. They never came back.",
    "TIP: Titans create their own gravity. Follow the big ones.",
    "INTERCEPT: Void eaters prefer the fast ones.",
    "QUERY: If space is infinite, why are there walls?",
    "LORE: We found the code in a dead satellite.",
    "TIP: Shockwaves operate on a rhythm. Learn the beat.",
    "INTERCEPT: Entropy is the enemy.",
    "QUERY: Can light feel cold?",
    "LORE: The maze changes when you aren't looking.",
    "TIP: Use the environment. Bounce the flow.",
    "INTERCEPT: Signal strength falling. Hurry.",
    "QUERY: Is the target a destination or a prison?",
    "LORE: Before the void, there was only noise.",
    "TIP: Symmetry is beautiful, but not always efficient.",
    "INTERCEPT: Debris field density increasing."
];
