
import React, { useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import Swarm from './Swarm';
import LevelElements from './LevelElements';
import Background from './Background';
import Anomalies from './Anomalies';
import { SceneManagerProps, AnomalyData } from '../types';

const SceneManager: React.FC<SceneManagerProps> = ({ 
  levelConfig, 
  onLevelComplete, 
  onProgress,
  isPaused,
  sandboxSettings,
  setFuel,
  theme,
  audioControls,
  resetKey
}) => {
  const { viewport } = useThree();
  
  // Store an array of paths, where each path is an array of Vector3s
  const [paths, setPaths] = useState<Vector3[][]>([]);
  
  const isDrawing = useRef(false);
  const lastPoint = useRef<Vector3 | null>(null);

  // Shared ref for anomalies (communication between Anomalies.tsx and Swarm.tsx)
  const anomalyRef = useRef<AnomalyData[]>([]);

  // Reset all paths when level changes OR when reset button is clicked
  useEffect(() => {
    setPaths([]);
    isDrawing.current = false;
    lastPoint.current = null;
  }, [levelConfig.id, resetKey]);

  const handlePointerDown = (e: any) => {
    if (isPaused) return;
    const point = new Vector3(e.point.x, e.point.y, 0);
    isDrawing.current = true;
    lastPoint.current = point;
    
    // Start a NEW path segment
    setPaths((prev) => [...prev, [point]]);
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing.current || isPaused) return;
    
    const point = new Vector3(e.point.x, e.point.y, 0);
    
    if (lastPoint.current && point.distanceTo(lastPoint.current) > 0.2) {
      setPaths((prev) => {
        if (prev.length === 0) return [[point]];
        
        // Append to the LAST path in the array
        const currentPath = prev[prev.length - 1];
        const newCurrentPath = [...currentPath, point];
        
        // Limit path length per segment for performance? 
        // For now, let it grow, but maybe clamp total points if needed.
        return [...prev.slice(0, -1), newCurrentPath];
      });
      lastPoint.current = point;
    }
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  return (
    <>
      <color attach="background" args={[theme.colors.background1]} />
      <Background levelConfig={levelConfig} sandboxSettings={sandboxSettings} theme={theme} />
      
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

      {/* Render ALL paths */}
      {paths.map((path, index) => (
        path.length > 1 && (
            <Line
                key={index}
                points={path}
                color={theme.colors.primary}
                lineWidth={2}
                opacity={0.3}
                transparent
            />
        )
      ))}

      <LevelElements config={levelConfig} sandboxSettings={sandboxSettings} theme={theme} />
      
      <Anomalies 
        anomalyRef={anomalyRef} 
        isPlaying={!isPaused} 
        sandboxSettings={sandboxSettings} 
        audioControls={audioControls}
        levelConfig={levelConfig}
      />

      <Swarm 
        paths={paths} // Pass array of arrays
        levelConfig={levelConfig}
        anomalyRef={anomalyRef}
        onLevelComplete={onLevelComplete}
        onProgress={onProgress}
        isPaused={isPaused}
        sandboxSettings={sandboxSettings}
        setFuel={setFuel}
        isDrawingRef={isDrawing}
        theme={theme}
        audioControls={audioControls}
        resetKey={resetKey}
      />
    </>
  );
};

export default SceneManager;
