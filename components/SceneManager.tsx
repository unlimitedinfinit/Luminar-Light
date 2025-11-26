import React, { useRef, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import Swarm from './Swarm';
import LevelElements from './LevelElements';
import { LevelConfig } from '../types';

interface SceneManagerProps {
  levelConfig: LevelConfig;
  onLevelComplete: () => void;
  onProgress: (count: number) => void;
  isPaused: boolean;
}

const SceneManager: React.FC<SceneManagerProps> = ({ 
  levelConfig, 
  onLevelComplete, 
  onProgress,
  isPaused 
}) => {
  const { viewport } = useThree();
  const [pathPoints, setPathPoints] = useState<Vector3[]>([]);
  const isDrawing = useRef(false);
  const lastPoint = useRef<Vector3 | null>(null);

  // Handle pointer events for drawing logic
  const handlePointerDown = (e: any) => {
    if (isPaused) return;
    // Raycasting happens on a plane at Z=0
    const point = new Vector3(e.point.x, e.point.y, 0);
    isDrawing.current = true;
    setPathPoints([point]);
    lastPoint.current = point;
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing.current || isPaused) return;
    
    const point = new Vector3(e.point.x, e.point.y, 0);
    
    // Only add point if distance is significant enough to avoid jagged lines
    if (lastPoint.current && point.distanceTo(lastPoint.current) > 0.2) {
      setPathPoints((prev) => {
        // Limit path length for performance (tail effect)
        const newPath = [...prev, point];
        if (newPath.length > 50) return newPath.slice(newPath.length - 50);
        return newPath;
      });
      lastPoint.current = point;
    }
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    setPathPoints([]); // Clear path when user lifts finger (Frost mechanics usually imply holding to sustain flow, or the path fades)
    lastPoint.current = null;
  };

  // Create an invisible plane to catch raycasts for drawing
  return (
    <>
      <mesh 
        position={[0, 0, 0]} 
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
        <meshBasicMaterial />
      </mesh>

      {/* Visual representation of the drawn path */}
      {pathPoints.length > 1 && (
        <Line
          points={pathPoints}
          color="#ffffff"
          lineWidth={2}
          opacity={0.3}
          transparent
        />
      )}

      {/* The Goals and Emitters */}
      <LevelElements config={levelConfig} />

      {/* The main simulation */}
      <Swarm 
        pathPoints={pathPoints}
        levelConfig={levelConfig}
        onLevelComplete={onLevelComplete}
        onProgress={onProgress}
        isPaused={isPaused}
      />
    </>
  );
};

export default SceneManager;