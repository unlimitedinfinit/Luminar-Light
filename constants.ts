export const PARTICLE_COUNT = 3000;
export const TARGET_FILL_RATE = 2; // How fast the target fills up per particle
export const GRAVITY_STRENGTH = 0.05; // Pull towards drawn path
export const PATH_FLOW_FORCE = 0.08; // Push along the drawn path
export const FRICTION = 0.96;
export const MAX_SPEED = 0.4;
export const EMITTER_RATE = 10; // Particles spawned per frame
export const RANDOM_FORCE = 0.01;

// Level Definitions
export const LEVELS = [
  {
    id: 1,
    emitterPos: [-5, 0, 0] as [number, number, number],
    targetPos: [5, 0, 0] as [number, number, number],
    targetRadius: 1.5,
    requiredCount: 500,
  },
  {
    id: 2,
    emitterPos: [-6, -3, 0] as [number, number, number],
    targetPos: [0, 4, 0] as [number, number, number],
    targetRadius: 1.5,
    obstaclePos: [[0, 0, 0]] as [number, number, number][],
    obstacleRadius: 1.5,
    requiredCount: 800,
  },
  {
    id: 3,
    emitterPos: [0, -6, 0] as [number, number, number],
    targetPos: [0, 6, 0] as [number, number, number],
    targetRadius: 1.5,
    // Two obstacles creating a choke point
    obstaclePos: [[-3, 0, 0], [3, 0, 0]] as [number, number, number][],
    obstacleRadius: 2,
    requiredCount: 1000,
  }
];