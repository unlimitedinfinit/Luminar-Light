import { Vector3 } from 'three';

export type Point = [number, number, number];

export interface LevelConfig {
  id: number;
  emitterPos: Point;
  targetPos: Point;
  targetRadius: number;
  obstaclePos?: Point[];
  obstacleRadius?: number;
  requiredCount: number;
}

export interface GameState {
  currentLevel: number;
  collectedCount: number;
  isLevelComplete: boolean;
  isPlaying: boolean;
}

export interface Particle {
  position: Vector3;
  velocity: Vector3;
  life: number;
  isActive: boolean;
}