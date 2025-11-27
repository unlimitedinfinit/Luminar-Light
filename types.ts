
import { Vector3 } from 'three';

export type Point = [number, number, number];

export interface Wall {
  position: Point;
  size: [number, number, number]; // Width, Height, Depth
  rotation: number; // Z-axis rotation in radians
}

export interface Portal {
  id: number;
  position: Point;
  target: Point; // Teleport destination
  color: string;
}

export interface Charger {
  position: Point;
  radius: number;
}

export interface LevelConfig {
  id: number;
  emitterPos: Point;
  targetPos: Point;
  targetRadius: number;
  obstaclePos?: Point[];
  obstacleRadius?: number;
  obstacleTypes?: ('static' | 'blackhole' | 'pulsar' | 'debris')[]; 
  obstacleBehaviors?: ('static' | 'orbit' | 'patrolX' | 'patrolY' | 'wander')[];
  walls?: Wall[]; 
  portals?: Portal[]; 
  chargers?: Charger[]; // New: Color conversion zones
  conversionRequired?: boolean; // New: If true, target rejects uncharged particles
  requiredCount: number;
  particleBudget?: number; 
  isBossLevel?: boolean;
  movingObstacles?: boolean;
}

export interface GameState {
  currentLevel: number;
  collectedCount: number;
  isLevelComplete: boolean;
  isPlaying: boolean;
  showStartScreen: boolean; 
}

export interface AnomalyData {
  position: Vector3;
  radius: number;
  isActive: boolean;
  type: 'repulsor' | 'void' | 'spirit' | 'pulse' | 'hazard'; 
}

export interface SandboxSettings {
  gravityMult: number;
  speedMult: number;
  timeScale: number;
  rainbowMode: boolean;
  giantMode: boolean;
  infiniteAmmo: boolean;
  symmetry: boolean;
  mouseAttractor: boolean;
  invincibility: boolean;
  hyperTrails: boolean;
}

export interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    primary: string; 
    secondary: string; 
    background1: string; 
    background2: string; 
    particleStart: string; 
    particleEnd: string; 
  };
}

export interface VibeSettings {
  themeId: string;
  musicId: string; 
  tempo: number; 
}

export interface AudioControls {
  playCollect: () => void;
  playLevelComplete: () => void;
  playAsteroid: () => void;
  playDestroy: () => void;
}

export interface GameCanvasProps {
  levelConfig: LevelConfig;
  onLevelComplete: () => void;
  onProgress: (count: number) => void;
  onActiveCount: (count: number) => void;
  isPaused: boolean;
  sandboxSettings: SandboxSettings;
  setFuel: (val: number | ((prev: number) => number)) => void;
  theme: ThemeConfig;
  audioControls: AudioControls | null;
  resetKey: number; 
  completionRatio: number;
}

export interface SceneManagerProps extends GameCanvasProps {}
