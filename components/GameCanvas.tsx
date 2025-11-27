
import React, { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { GameCanvasProps } from '../types';
import SceneManager from './SceneManager';
import { ARENA_BOUNDS } from '../constants';

// Automatically adjusts camera Z position to fit the arena bounds
const ResponsiveCamera = () => {
    const { camera, size } = useThree();
    
    useEffect(() => {
        const aspect = size.width / size.height;
        const isMobile = size.width < 768; 
        
        // Tighter bounds for Desktop to make things look bigger
        // Mobile needs more padding due to UI overlays and notches
        const padX = isMobile ? 1.5 : 1.1; 
        const padY = isMobile ? 1.8 : 1.1;

        const targetWidth = ARENA_BOUNDS.x * 2 * padX;
        const targetHeight = ARENA_BOUNDS.y * 2 * padY;
        
        const fov = 45;
        const fovRad = (fov * Math.PI) / 180;
        
        const distForHeight = targetHeight / (2 * Math.tan(fovRad / 2));
        const distForWidth = targetWidth / (2 * aspect * Math.tan(fovRad / 2));
        
        // Choose the larger distance to ensure everything fits
        let finalDist = Math.max(distForHeight, distForWidth);
        
        // Clamp min distance to avoid clipping near plane
        finalDist = Math.max(finalDist, 10); 

        camera.position.z = finalDist;
        
        // On large desktops, the sidebar (320px) covers the left side.
        // We shift the camera to the LEFT (negative X) to push the world to the RIGHT,
        // centering the arena in the visible space.
        if (!isMobile && size.width > 1000) {
             camera.position.x = -3.0; 
        } else {
             camera.position.x = 0;
        }

        camera.updateProjectionMatrix();
        
    }, [camera, size]);
    
    return null;
};

const GameCanvas: React.FC<GameCanvasProps> = (props) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 45 }}
      dpr={[1, 2]} // Handle high DPI screens
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
    >
      <ResponsiveCamera />
      <color attach="background" args={[props.theme.colors.background1]} />
      
      <Suspense fallback={null}>
        <SceneManager {...props} />
        
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
