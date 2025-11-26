import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, LevelConfig } from './types';
import { LEVELS } from './constants';
import { Play, RotateCcw, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>({
    currentLevel: 1,
    collectedCount: 0,
    isLevelComplete: false,
    isPlaying: false,
  });

  const currentLevelConfig = LEVELS[levelIndex];

  const handleLevelComplete = () => {
    setGameState(prev => ({ ...prev, isLevelComplete: true }));
  };

  const handleProgress = (count: number) => {
    setGameState(prev => ({ ...prev, collectedCount: count }));
  };

  const nextLevel = () => {
    if (levelIndex < LEVELS.length - 1) {
      setLevelIndex(prev => prev + 1);
      setGameState({
        currentLevel: levelIndex + 2,
        collectedCount: 0,
        isLevelComplete: false,
        isPlaying: true,
      });
    } else {
      // Loop back to start or show end screen (looping for now)
      setLevelIndex(0);
      setGameState({
        currentLevel: 1,
        collectedCount: 0,
        isLevelComplete: false,
        isPlaying: true,
      });
    }
  };

  const restartLevel = () => {
    // Force a re-mount of the canvas logic by toggling state or passing a key
    setGameState({
      ...gameState,
      collectedCount: 0,
      isLevelComplete: false,
    });
    // A simple hack to reset the scene is usually key-based, handled in the return
  };

  return (
    <div className="w-full h-screen bg-black relative font-sans text-white overflow-hidden">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <GameCanvas 
          key={`level-${levelIndex}-${gameState.isLevelComplete}`} // Re-mounts on level change to reset particles
          levelConfig={currentLevelConfig}
          onLevelComplete={handleLevelComplete}
          onProgress={handleProgress}
          isPaused={!gameState.isPlaying}
        />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">
        
        {/* Header / Stats */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              LUMINA FLOW
            </h1>
            <p className="text-cyan-200/50 text-sm">LEVEL {gameState.currentLevel}</p>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-light">
              {Math.min(100, Math.floor((gameState.collectedCount / currentLevelConfig.requiredCount) * 100))}%
            </div>
            <div className="w-32 h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-cyan-400 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, (gameState.collectedCount / currentLevelConfig.requiredCount) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center Messages */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!gameState.isPlaying && !gameState.isLevelComplete && (
            <div className="bg-black/40 backdrop-blur-md border border-cyan-500/30 p-8 rounded-2xl text-center pointer-events-auto shadow-2xl shadow-cyan-900/20">
              <h2 className="text-2xl mb-4 font-light">Welcome to the Void</h2>
              <p className="text-gray-300 mb-6 max-w-md">
                Draw paths with your cursor or finger to guide the swarm from the Source to the Planet.
              </p>
              <button 
                onClick={() => setGameState(prev => ({ ...prev, isPlaying: true }))}
                className="group flex items-center justify-center gap-2 mx-auto px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-all hover:scale-105 font-medium"
              >
                <Play size={20} fill="currentColor" />
                Begin
              </button>
            </div>
          )}

          {gameState.isLevelComplete && (
            <div className="bg-black/60 backdrop-blur-lg border border-green-500/30 p-8 rounded-2xl text-center pointer-events-auto animate-in fade-in zoom-in duration-300">
              <h2 className="text-3xl mb-2 font-bold text-green-400">Harmony Achieved</h2>
              <p className="text-gray-400 mb-6">The swarm has found its home.</p>
              <button 
                onClick={nextLevel}
                className="flex items-center justify-center gap-2 mx-auto px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-full transition-all hover:scale-105 font-bold"
              >
                Next Level
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex justify-between items-end pointer-events-auto">
          <div className="text-xs text-gray-600 max-w-xs">
            Performance: 3000 Instanced Particles via R3F
          </div>
          <button 
            onClick={restartLevel}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title="Restart Level"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;