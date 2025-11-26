import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LevelConfig } from '../types';
import { Mesh } from 'three';

interface LevelElementsProps {
  config: LevelConfig;
}

const LevelElements: React.FC<LevelElementsProps> = ({ config }) => {
  const emitterRef = useRef<Mesh>(null);
  const targetRef = useRef<Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Gentle pulsation for target
    if (targetRef.current) {
      const scale = 1 + Math.sin(time * 2) * 0.05;
      targetRef.current.scale.set(scale, scale, scale);
      targetRef.current.rotation.z -= 0.01;
    }

    // Spin emitter
    if (emitterRef.current) {
        emitterRef.current.rotation.z += 0.02;
    }
  });

  return (
    <>
      {/* Emitter Visual */}
      <mesh position={config.emitterPos} ref={emitterRef}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
      </mesh>
      <mesh position={config.emitterPos}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Target Visual (Home Planet) */}
      <group position={config.targetPos}>
         {/* Core */}
        <mesh ref={targetRef}>
          <circleGeometry args={[config.targetRadius, 64]} />
          {/* Use standard material with emissive for glow effect if bloom is on */}
          <meshStandardMaterial 
            color="#000000" 
            emissive="#ff0088"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
        
        {/* Outer Ring */}
        <mesh>
             <ringGeometry args={[config.targetRadius + 0.1, config.targetRadius + 0.2, 64]} />
             <meshBasicMaterial color="#ff0088" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Obstacles */}
      {config.obstaclePos && config.obstaclePos.map((pos, idx) => (
         <group position={pos} key={`obs-${idx}`}>
            <mesh>
                <circleGeometry args={[config.obstacleRadius || 1, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>
            <mesh>
                <ringGeometry args={[(config.obstacleRadius || 1), (config.obstacleRadius || 1) + 0.1, 32]} />
                <meshBasicMaterial color="#333333" />
            </mesh>
         </group>
      ))}
    </>
  );
};

export default LevelElements;