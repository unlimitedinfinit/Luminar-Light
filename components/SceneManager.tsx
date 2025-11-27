
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, CatmullRomCurve3, TubeGeometry, Color, DoubleSide, AdditiveBlending } from 'three';
import { Line } from '@react-three/drei';
import Swarm from './Swarm';
import LevelElements from './LevelElements';
import Background from './Background';
import Anomalies from './Anomalies';
import { SceneManagerProps, AnomalyData, ThemeConfig } from '../types';
import { CRITICAL_MASS_THRESHOLD } from '../constants';

// Custom component for the glowing wormhole path
const CosmicPath = ({ points, theme }: { points: Vector3[], theme: ThemeConfig }) => {
    const curve = useMemo(() => {
        if (points.length < 2) return null;
        return new CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    }, [points]);
    
    // Shader for flowing energy
    const shaderRef = useRef<any>(null);
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColor: { value: new Color(theme.colors.primary) }
    }), [theme]);

    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            shaderRef.current.uniforms.uColor.value.set(theme.colors.primary);
        }
    });

    if (!curve || points.length < 2) return null;

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;

        void main() {
            // Scrolling noise effect
            float flow = sin(vUv.x * 20.0 - uTime * 5.0) * 0.5 + 0.5;
            float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
            core = pow(core, 3.0); // Sharpen core
            
            float alpha = core * (0.5 + flow * 0.5);
            alpha *= smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x); // Fade ends

            vec3 finalColor = uColor + vec3(flow * 0.5); 
            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    return (
        <mesh>
            <tubeGeometry args={[curve, 64, 0.15, 8, false]} />
            <shaderMaterial 
                ref={shaderRef}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                depthWrite={false}
                blending={AdditiveBlending}
                side={DoubleSide}
            />
        </mesh>
    );
};

const SceneManager: React.FC<SceneManagerProps> = ({ 
  levelConfig, 
  onLevelComplete, 
  onProgress,
  onActiveCount,
  isPaused,
  sandboxSettings,
  setFuel,
  theme,
  audioControls,
  resetKey,
  completionRatio 
}) => {
  const { viewport } = useThree();
  
  const [paths, setPaths] = useState<Vector3[][]>([]);
  
  const isDrawing = useRef(false);
  const lastPoint = useRef<Vector3 | null>(null);
  const clickStartTime = useRef(0);
  const clickStartPos = useRef<Vector3 | null>(null);
  
  const mousePos = useRef<Vector3>(new Vector3(100,100,0));

  const anomalyRef = useRef<AnomalyData[]>([]);
  const blackHoleStateRef = useRef<number[]>([]);

  // Supernova Logic
  useFrame(() => {
     if (blackHoleStateRef.current) {
         for (let i = 0; i < blackHoleStateRef.current.length; i++) {
             if (blackHoleStateRef.current[i] > CRITICAL_MASS_THRESHOLD) {
                 // Trigger Supernova
                 blackHoleStateRef.current[i] = 0; // Reset
                 if (audioControls) audioControls.playDestroy(); // Boom
                 
                 // Add visual pulse anomaly (shockwave)
                 if (levelConfig.obstaclePos && levelConfig.obstaclePos[i]) {
                     anomalyRef.current.push({
                         position: new Vector3(...levelConfig.obstaclePos[i]),
                         radius: 8.0,
                         isActive: true,
                         type: 'pulse'
                     });
                 }
             }
         }
     }
  });

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
    clickStartTime.current = Date.now();
    clickStartPos.current = point.clone();
    
    const newPaths = [[point]];
    if (sandboxSettings.symmetry) {
        newPaths.push([new Vector3(-point.x, point.y, 0)]);
    }

    setPaths((prev) => [...prev, ...newPaths]);
  };

  const handlePointerMove = (e: any) => {
    const point = new Vector3(e.point.x, e.point.y, 0);
    mousePos.current.copy(point);

    if (!isDrawing.current || isPaused) return;
    
    if (lastPoint.current && point.distanceTo(lastPoint.current) > 0.2) {
      setPaths((prev) => {
        if (prev.length === 0) return [[point]];
        const isSym = sandboxSettings.symmetry;
        if (isSym && prev.length >= 2) {
            const currentPath = prev[prev.length - 2];
            const newCurrentPath = [...currentPath, point];
            const mirrorPath = prev[prev.length - 1];
            const mirrorPoint = new Vector3(-point.x, point.y, 0);
            const newMirrorPath = [...mirrorPath, mirrorPoint];
            return [...prev.slice(0, -2), newCurrentPath, newMirrorPath];
        } else {
            const currentPath = prev[prev.length - 1];
            const newCurrentPath = [...currentPath, point];
            return [...prev.slice(0, -1), newCurrentPath];
        }
      });
      lastPoint.current = point;
    }
  };

  const handlePointerUp = (e: any) => {
    const clickDuration = Date.now() - clickStartTime.current;
    const point = new Vector3(e.point.x, e.point.y, 0);
    const dist = clickStartPos.current ? point.distanceTo(clickStartPos.current) : 999;

    if (clickDuration < 200 && dist < 0.5) {
        anomalyRef.current.push({
            position: point,
            radius: 5.0, 
            isActive: true,
            type: 'pulse'
        });
        const removeCount = sandboxSettings.symmetry ? 2 : 1;
        setPaths(prev => prev.slice(0, -removeCount));
    }

    isDrawing.current = false;
    lastPoint.current = null;
  };

  return (
    <>
      <color attach="background" args={[theme.colors.background1]} />
      <Background 
        levelConfig={levelConfig} 
        sandboxSettings={sandboxSettings} 
        theme={theme} 
        mousePos={mousePos}
      />
      
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

      {paths.map((path, index) => (
        path.length > 1 && (
            <CosmicPath 
                key={index} 
                points={path} 
                theme={theme} 
            />
        )
      ))}

      <LevelElements 
        config={levelConfig} 
        sandboxSettings={sandboxSettings} 
        theme={theme} 
        completionRatio={completionRatio}
      />
      
      <Anomalies 
        anomalyRef={anomalyRef} 
        isPlaying={!isPaused} 
        sandboxSettings={sandboxSettings} 
        audioControls={audioControls}
        levelConfig={levelConfig}
      />

      <Swarm 
        paths={paths}
        levelConfig={levelConfig}
        anomalyRef={anomalyRef}
        blackHoleStateRef={blackHoleStateRef}
        onLevelComplete={onLevelComplete}
        onProgress={onProgress}
        onActiveCount={onActiveCount}
        isPaused={isPaused}
        sandboxSettings={sandboxSettings}
        setFuel={setFuel}
        isDrawingRef={isDrawing}
        theme={theme}
        audioControls={audioControls}
        resetKey={resetKey}
        mousePos={mousePos}
      />
    </>
  );
};

export default SceneManager;
