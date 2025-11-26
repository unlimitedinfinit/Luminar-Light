import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { LevelConfig } from '../types';
import SceneManager from './SceneManager';

interface GameCanvasProps {
  levelConfig: LevelConfig;
  onLevelComplete: () => void;
  onProgress: (count: number) => void;
  isPaused: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  levelConfig, 
  onLevelComplete, 
  onProgress,
  isPaused 
}) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 45 }}
      dpr={[1, 2]} // Handle high DPI screens
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={['#020205']} />
      
      <Suspense fallback={null}>
        <SceneManager 
          levelConfig={levelConfig} 
          onLevelComplete={onLevelComplete}
          onProgress={onProgress}
          isPaused={isPaused}
        />
        
        <EffectComposer disableNormalPass>
          {/* High intensity bloom for the "bioluminescent" look */}
          <Bloom 
            luminanceThreshold={0.2} 
            mipmapBlur 
            intensity={1.5} 
            radius={0.6}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
};

export default GameCanvas;