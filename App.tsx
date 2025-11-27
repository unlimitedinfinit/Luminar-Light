
import React, { useState, useMemo, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import AudioController from './components/AudioController';
import { GameState, SandboxSettings, VibeSettings, AudioControls } from './types';
import { getLevel, THEMES, COMPLETION_MESSAGES, PARTICLE_COUNT, LORE_FRAGMENTS } from './constants';
import { Play, RotateCcw, ArrowRight, Zap, Move, Palette, Maximize, Infinity as InfinityIcon, Clock, Eye, Headphones, ChevronLeft, ChevronRight, FastForward, Rewind, ChevronDown, ChevronUp, Split, Magnet, Shield, Activity, Terminal, Smartphone } from 'lucide-react';

const App: React.FC = () => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>({
    currentLevel: 1,
    collectedCount: 0,
    isLevelComplete: false,
    isPlaying: false,
    showStartScreen: true,
  });

  const [activeParticleCount, setActiveParticleCount] = useState(0);

  const [sandbox, setSandbox] = useState<SandboxSettings>({
    gravityMult: 1,
    speedMult: 1,
    timeScale: 0.25, // Default speed slowed down for meditative feel
    rainbowMode: true, // Rainbow mode enabled by default
    giantMode: false,
    infiniteAmmo: false,
    symmetry: false,
    mouseAttractor: false,
    invincibility: false,
    hyperTrails: false,
  });

  const [vibe, setVibe] = useState<VibeSettings>({
      themeId: 'amber', 
      musicId: 'chill', 
      tempo: 1.0
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const audioRef = useRef<AudioControls | null>(null);
  const [fuel, setFuel] = useState(100); 
  const [completionMsg, setCompletionMsg] = useState("");
  const [loreMsg, setLoreMsg] = useState("");
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  const currentLevelConfig = useMemo(() => getLevel(levelIndex), [levelIndex]);
  const currentTheme = THEMES[vibe.themeId];

  useEffect(() => {
    const checkOrientation = () => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
        const isPortrait = window.innerHeight > window.innerWidth;
        setIsPortraitMobile(isMobile && isPortrait);
        
        // Auto-close menu on small screens initially
        if (window.innerWidth < 768) {
            setIsMenuOpen(false);
        }
    };

    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
      const msg = LORE_FRAGMENTS[Math.floor(Math.random() * LORE_FRAGMENTS.length)];
      setLoreMsg(msg);
  }, [levelIndex, resetKey]);

  useEffect(() => {
    if (currentLevelConfig.particleBudget) {
        setFuel(currentLevelConfig.particleBudget);
    } else {
        setFuel(100); 
    }
  }, [currentLevelConfig]);

  const handleLevelComplete = () => {
    setGameState(prev => ({ ...prev, isLevelComplete: true }));
    const msg = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
    setCompletionMsg(msg);
    if (audioRef.current) audioRef.current.playLevelComplete();
  };

  const handleProgress = (count: number) => {
    setGameState(prev => ({ ...prev, collectedCount: count }));
  };

  const handleActiveCount = (count: number) => {
      setActiveParticleCount(count);
  };

  const nextLevel = () => {
    const nextIdx = levelIndex + 1;
    setLevelIndex(nextIdx);
    setGameState({
      currentLevel: nextIdx + 1,
      collectedCount: 0,
      isLevelComplete: false,
      isPlaying: false, 
      showStartScreen: true, 
    });
    setActiveParticleCount(0);
  };

  const prevLevel = () => {
    if (levelIndex > 0) {
        const prevIdx = levelIndex - 1;
        setLevelIndex(prevIdx);
        setGameState({
            currentLevel: prevIdx + 1,
            collectedCount: 0,
            isLevelComplete: false,
            isPlaying: false,
            showStartScreen: true,
        });
        setActiveParticleCount(0);
    }
  };

  const jumpToLevel = (idx: number) => {
    setLevelIndex(idx);
    setGameState({
        currentLevel: idx + 1,
        collectedCount: 0,
        isLevelComplete: false,
        isPlaying: false,
        showStartScreen: true,
    });
    setActiveParticleCount(0);
  }

  const restartLevel = () => {
    setGameState(prev => ({
      ...prev,
      collectedCount: 0,
      isLevelComplete: false,
      isPlaying: false,
      showStartScreen: true,
    }));
    if (currentLevelConfig.particleBudget) {
        setFuel(currentLevelConfig.particleBudget);
    }
    setResetKey(prev => prev + 1);
    setActiveParticleCount(0);
  };

  const startGame = () => {
      setGameState(prev => ({ ...prev, isPlaying: true, showStartScreen: false }));
  }

  const toggleSandbox = (key: keyof SandboxSettings) => {
      setSandbox(prev => {
          if (key === 'gravityMult') return { ...prev, gravityMult: prev.gravityMult === 1 ? 2.5 : 1 };
          if (key === 'speedMult') return { ...prev, speedMult: prev.speedMult === 1 ? 2 : 1 };
          if (key === 'timeScale') return prev; 
          return { ...prev, [key]: !prev[key] };
      });
  };

  const setTimeScale = (val: number) => {
      setSandbox(prev => ({ ...prev, timeScale: val }));
  }

  const setTempo = (val: number) => {
      setVibe(prev => ({ ...prev, tempo: val }));
  }

  const maxFuel = currentLevelConfig.particleBudget || 100;
  const fuelPercent = currentLevelConfig.particleBudget 
    ? Math.max(0, (fuel / maxFuel) * 100)
    : 100;

  const getDifficultyLabel = (lvl: number) => {
      if (currentLevelConfig.isBossLevel) return 'EXTREME';
      if (lvl <= 4) return 'EASY';
      if (lvl <= 9) return 'NORMAL';
      if (lvl <= 14) return 'DIFFICULT';
      if (lvl <= 19) return 'HARD';
      if (lvl <= 29) return 'COMPLEX';
      return 'CHAOS';
  };

  const difficultyLabel = getDifficultyLabel(currentLevelConfig.id);

  const completionRatio = currentLevelConfig.requiredCount > 0 
    ? Math.min(1, gameState.collectedCount / currentLevelConfig.requiredCount)
    : 0;

  // MECHANIC TIPS
  const getMechanicTip = () => {
      if (currentLevelConfig.conversionRequired) return "TIP: Route particles through the Prism to charge them.";
      if (currentLevelConfig.portals && currentLevelConfig.portals.length > 0) return "TIP: Use Portals to bypass the barrier.";
      if (currentLevelConfig.isBossLevel) return "WARNING: Avoid the rotating Hazard Sector.";
      return null;
  };
  const mechanicTip = getMechanicTip();

  if (isPortraitMobile) {
      return (
          <div className="flex w-full h-screen bg-black text-white items-center justify-center p-8 text-center flex-col z-50">
               <Smartphone size={48} className="mb-4 text-cyan-400 animate-spin-slow" />
               <h1 className="text-2xl font-bold mb-2 tracking-widest text-cyan-200">ORIENTATION ERROR</h1>
               <p className="text-gray-400 font-mono text-sm max-w-xs">
                   Lumina Flow requires landscape mode for quantum alignment.
               </p>
               <div className="mt-8 animate-pulse text-xs text-gray-600 font-mono">
                   PLEASE ROTATE DEVICE
               </div>
          </div>
      );
  }

  return (
    <div 
      className="flex w-full h-screen bg-black text-white font-sans overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      
      <AudioController 
        vibe={vibe} 
        isPlaying={gameState.isPlaying} 
        onAudioReady={(ctrl) => audioRef.current = ctrl} 
      />

      {/* SIDEBAR */}
      <div 
        className={`relative flex-shrink-0 bg-black/90 backdrop-blur-xl border-r border-gray-800 z-20 flex flex-col transition-all duration-500 ease-in-out overflow-hidden ${isMenuOpen ? 'w-80 md:w-80 w-full translate-x-0' : 'w-0 -translate-x-full opacity-0'}`}
      >
        <div className="p-6 flex-grow space-y-6 overflow-y-auto custom-scrollbar w-80">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-cyan-400 tracking-wider">SYSTEM</h2>
                {/* Mobile Close Button */}
                <button onClick={() => setIsMenuOpen(false)} className="md:hidden text-gray-500 hover:text-white">
                    <ChevronLeft />
                </button>
            </div>

            <div className="border-b border-gray-800 pb-4">
                <button 
                  onClick={() => setIsLevelSelectOpen(!isLevelSelectOpen)}
                  className="w-full flex justify-between items-center text-[10px] uppercase tracking-widest text-gray-500 mb-2 hover:text-gray-300 transition-colors group"
                >
                  <span className="group-hover:text-cyan-400 transition-colors">Level Select</span>
                  {isLevelSelectOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                
                <div className={`grid grid-cols-5 gap-1 transition-all duration-300 overflow-hidden ${isLevelSelectOpen ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    {Array.from({ length: 50 }, (_, i) => i).map(i => (
                        <button 
                            key={i}
                            onClick={() => jumpToLevel(i)}
                            className={`aspect-square flex items-center justify-center rounded text-[9px] transition-colors border ${
                                levelIndex === i 
                                ? 'bg-cyan-900/50 border-cyan-500 text-cyan-200' 
                                : 'bg-gray-900 border-gray-800 hover:bg-gray-800 text-gray-400'
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Status</h3>
                <div className="text-[10px] text-gray-400 space-y-1 font-mono bg-gray-900/50 p-3 rounded border border-gray-800">
                    <div className="flex justify-between">
                        <span>Status:</span>
                        <span className={gameState.isPlaying ? "text-green-400" : "text-yellow-400"}>
                            {gameState.isPlaying ? 'ACTIVE' : 'IDLE'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Particles:</span>
                        <span>{activeParticleCount.toLocaleString()} <span className="text-gray-600">/ {PARTICLE_COUNT.toLocaleString()}</span></span>
                    </div>
                    <div className="flex justify-between">
                        <span>Reservoir:</span>
                        <span className={currentLevelConfig.particleBudget ? (fuel > 0 ? "text-cyan-400" : "text-red-500") : "text-green-400"}>
                            {currentLevelConfig.particleBudget ? `${Math.floor(fuel)} / ${currentLevelConfig.particleBudget}` : '∞'}
                        </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-800 pt-1 mt-1">
                        <span>Difficulty:</span>
                        <span className={`font-bold ${difficultyLabel === 'EXTREME' || difficultyLabel === 'HARD' ? 'text-red-400' : 'text-blue-300'}`}>
                            {difficultyLabel}
                        </span>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-[10px] uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-2">
                    <Eye size={10} /> Visual Themes
                </h3>
                <div className="grid grid-cols-2 gap-1 mb-2">
                    {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(key => (
                        <button
                            key={key}
                            onClick={() => setVibe(prev => ({...prev, themeId: key}))}
                            className={`px-2 py-1.5 rounded text-[10px] capitalize transition-all border text-center ${vibe.themeId === key ? 'bg-purple-900/40 border-purple-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
                        >
                            {THEMES[key].name}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-2">
                    <Headphones size={10} /> Soundscapes
                </h3>
                <div className="grid grid-cols-2 gap-1 mb-2">
                    {[
                        { id: 'pulse', label: 'Pulse', desc: 'Lofi' },
                        { id: 'chill', label: 'Chill', desc: 'Jazz' },
                        { id: 'night', label: 'Night', desc: 'Sleep' },
                        { id: 'bit', label: 'Bit', desc: 'Retro' },
                        { id: 'life', label: 'Life', desc: 'Nature' },
                        { id: 'ether', label: 'Ether', desc: 'Choral' },
                        { id: 'void', label: 'Void', desc: 'Drone' },
                        { id: 'focus', label: 'Focus', desc: 'Minimal' },
                        { id: 'warp', label: 'Warp', desc: 'Sci-Fi' },
                        { id: 'piano', label: 'Piano', desc: 'Gen' },
                    ].map((m) => (
                        <button
                            key={m.id}
                            onClick={() => setVibe(prev => ({...prev, musicId: m.id}))}
                            className={`px-2 py-1.5 rounded text-left transition-all border ${vibe.musicId === m.id ? 'bg-cyan-900/40 border-cyan-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="text-[9px] font-bold uppercase">{m.label}</div>
                                <div className="text-[8px] text-gray-500">{m.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
                
                <div className="bg-gray-900 border border-gray-800 rounded p-1.5 flex justify-between items-center">
                    <span className="text-[9px] text-gray-500 ml-1 uppercase">Tempo</span>
                    <div className="flex gap-1">
                        {[0.5, 1.0, 1.5].map(t => (
                            <button
                                key={t}
                                onClick={() => setTempo(t)}
                                className={`px-2 py-0.5 rounded text-[9px] border transition-colors ${
                                    vibe.tempo === t
                                    ? 'bg-cyan-700 border-cyan-500 text-white' 
                                    : 'bg-black border-gray-700 text-gray-500 hover:bg-gray-800'
                                }`}
                            >
                                {t === 0.5 ? 'Slow' : t === 1.5 ? 'Hype' : 'Norm'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-[10px] uppercase tracking-widest text-pink-500 mb-2 flex items-center gap-2">
                    <Zap size={10} /> Sandbox Tools
                </h3>
                <div className="space-y-1.5">
                        <button 
                        onClick={() => toggleSandbox('infiniteAmmo')}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-[10px] border transition-all ${sandbox.infiniteAmmo ? 'bg-yellow-900/30 border-yellow-500 text-yellow-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                        >
                        <span className="flex items-center gap-2"><InfinityIcon size={10} /> Infinite Source</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${sandbox.infiniteAmmo ? 'bg-yellow-500' : 'bg-gray-700'}`} />
                        </button>

                        <div className="bg-gray-900 border border-gray-800 rounded p-1.5">
                        <div className="text-[9px] text-gray-500 mb-1 flex items-center gap-1"><Clock size={9}/> TIME DILATION</div>
                        <div className="flex justify-between gap-0.5">
                            {[0.1, 0.25, 0.5, 1, 2, 4].map(scale => (
                                <button
                                    key={scale}
                                    onClick={() => setTimeScale(scale)}
                                    className={`flex-1 py-0.5 text-[9px] rounded border transition-colors ${
                                        sandbox.timeScale === scale 
                                        ? 'bg-blue-600 border-blue-400 text-white' 
                                        : 'bg-black border-gray-700 text-gray-500 hover:bg-gray-800'
                                    }`}
                                >
                                    {scale === 0.1 ? '.1' : scale === 0.25 ? '.25' : scale}x
                                </button>
                            ))}
                        </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                            <button 
                            onClick={() => toggleSandbox('symmetry')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.symmetry ? 'bg-indigo-900/30 border-indigo-500 text-indigo-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Split size={10} /> Symmetry</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.symmetry ? 'bg-indigo-500' : 'bg-gray-700'}`} />
                            </button>

                             <button 
                            onClick={() => toggleSandbox('mouseAttractor')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.mouseAttractor ? 'bg-red-900/30 border-red-500 text-red-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Magnet size={10} /> Mouse Grav</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.mouseAttractor ? 'bg-red-500' : 'bg-gray-700'}`} />
                            </button>

                             <button 
                            onClick={() => toggleSandbox('invincibility')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.invincibility ? 'bg-teal-900/30 border-teal-500 text-teal-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Shield size={10} /> Invincible</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.invincibility ? 'bg-teal-500' : 'bg-gray-700'}`} />
                            </button>

                             <button 
                            onClick={() => toggleSandbox('hyperTrails')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.hyperTrails ? 'bg-orange-900/30 border-orange-500 text-orange-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Activity size={10} /> Hyper Trails</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.hyperTrails ? 'bg-orange-500' : 'bg-gray-700'}`} />
                            </button>

                            <button 
                            onClick={() => toggleSandbox('gravityMult')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.gravityMult > 1 ? 'bg-pink-900/30 border-pink-500 text-pink-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Move size={10} /> Grav+</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.gravityMult > 1 ? 'bg-pink-500' : 'bg-gray-700'}`} />
                            </button>

                            <button 
                            onClick={() => toggleSandbox('speedMult')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.speedMult > 1 ? 'bg-cyan-900/30 border-cyan-500 text-cyan-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Zap size={10} /> Speed+</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.speedMult > 1 ? 'bg-cyan-500' : 'bg-gray-700'}`} />
                            </button>

                            <button 
                            onClick={() => toggleSandbox('rainbowMode')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.rainbowMode ? 'bg-purple-900/30 border-purple-500 text-purple-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Palette size={10} /> Color</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.rainbowMode ? 'bg-purple-500' : 'bg-gray-700'}`} />
                            </button>

                            <button 
                            onClick={() => toggleSandbox('giantMode')}
                            className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-all ${sandbox.giantMode ? 'bg-green-900/30 border-green-500 text-green-200' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
                            >
                            <span className="flex items-center gap-1"><Maximize size={10} /> Giant</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${sandbox.giantMode ? 'bg-green-500' : 'bg-gray-700'}`} />
                            </button>
                        </div>
                </div>
            </div>

        </div>
        
        <div className="p-4 border-t border-gray-800 text-[9px] text-gray-600">
            LUMINA FLOW v3.5
        </div>
      </div>

      <div 
        className={`absolute z-30 bottom-40 transition-all duration-500 ${isMenuOpen ? 'left-80 md:left-80 left-0' : 'left-0'}`}
      >
        <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-black/80 backdrop-blur border-y border-r border-gray-800 text-cyan-400 p-2 rounded-r-xl hover:bg-gray-900 hover:pr-4 transition-all shadow-xl group flex items-center gap-2"
        >
            {isMenuOpen ? <ChevronLeft size={24} /> : (
                <>
                 <ChevronRight size={24} />
                 <span className="text-xs font-bold tracking-widest block pr-2">SHOW MENU</span>
                </>
            )}
        </button>
      </div>

      <div className="flex-grow relative h-full">
        <div className="absolute inset-0 z-0">
            <GameCanvas 
            levelConfig={currentLevelConfig}
            onLevelComplete={handleLevelComplete}
            onProgress={handleProgress}
            onActiveCount={handleActiveCount}
            isPaused={!gameState.isPlaying}
            sandboxSettings={sandbox}
            setFuel={setFuel}
            theme={currentTheme}
            audioControls={audioRef.current}
            resetKey={resetKey}
            completionRatio={completionRatio}
            />
        </div>

        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between md:p-10 p-4">
            
            <div className={`flex justify-between items-start pointer-events-none select-none pl-4 transition-all duration-500 ${isMenuOpen ? 'md:ml-0 ml-0 opacity-20 md:opacity-100' : 'md:ml-8 ml-0'}`}>
                <div>
                    <h1 className="md:text-8xl text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-0 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                        style={{ backgroundImage: `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`}}
                    >
                    LUMINA
                    </h1>
                    <div className="flex items-center gap-4 mt-2">
                        <span className="md:text-6xl text-3xl font-thin text-white tracking-widest">
                            LEVEL {currentLevelConfig.id}
                        </span>
                        {currentLevelConfig.isBossLevel && (
                            <span className="text-xs md:text-sm bg-red-600 text-white font-bold px-2 md:px-3 py-1 rounded animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                BOSS ZONE
                            </span>
                        )}
                        {mechanicTip && (
                            <div className="ml-2 md:ml-4 px-2 md:px-3 py-1 bg-blue-900/40 border border-blue-500 text-blue-200 text-[10px] md:text-xs font-mono tracking-wide rounded animate-pulse hidden md:block">
                                {mechanicTip}
                            </div>
                        )}
                    </div>
                    {mechanicTip && (
                        <div className="mt-2 px-2 py-1 bg-blue-900/40 border border-blue-500 text-blue-200 text-[10px] font-mono tracking-wide rounded animate-pulse md:hidden inline-block">
                             {mechanicTip}
                        </div>
                    )}
                </div>
            
                <div className="text-right pt-4 flex flex-col gap-6">
                    <div>
                        <div className="text-2xl md:text-4xl font-thin font-mono text-cyan-100">
                        {Math.min(100, Math.floor((gameState.collectedCount / currentLevelConfig.requiredCount) * 100))}%
                        </div>
                        <div className="w-32 md:w-64 h-2 bg-gray-800 rounded-full mt-3 overflow-hidden backdrop-blur-sm border border-gray-700">
                        <div 
                            className={`h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,211,238,0.8)] ${currentLevelConfig.isBossLevel ? 'bg-red-500' : 'bg-cyan-400'}`}
                            style={{ 
                                width: `${Math.min(100, (gameState.collectedCount / currentLevelConfig.requiredCount) * 100)}%`,
                                backgroundColor: currentTheme.colors.primary
                            }}
                        />
                        </div>
                    </div>

                    {currentLevelConfig.particleBudget && !sandbox.infiniteAmmo && (
                        <div>
                            <div className={`text-2xl md:text-4xl font-thin font-mono ${fuelPercent < 20 ? 'text-red-400 animate-pulse' : 'text-yellow-100'}`}>
                            {Math.ceil(fuelPercent)}%
                            </div>
                            <div className="w-32 md:w-64 h-2 bg-gray-800 rounded-full mt-3 overflow-hidden backdrop-blur-sm border border-gray-700">
                            <div 
                                className={`h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)] ${fuelPercent < 20 ? 'bg-red-500' : 'bg-yellow-400'}`}
                                style={{ width: `${fuelPercent}%` }}
                            />
                            </div>
                        </div>
                    )}
                    
                     <div className="h-4 text-[10px] font-mono text-cyan-500/50 uppercase tracking-widest text-right animate-pulse hidden md:block">
                         {Math.random() > 0.995 ? "SYSTEM WATCHING" : Math.random() > 0.995 ? "ENTROPY INCREASING" : ""}
                     </div>
                </div>
            </div>

            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-500 ${isMenuOpen ? 'md:ml-72 ml-0' : 'ml-0'}`}>
            
            {!gameState.isPlaying && !gameState.isLevelComplete && gameState.showStartScreen && (
                <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 p-6 md:p-10 rounded-lg text-center pointer-events-auto shadow-2xl shadow-cyan-900/10 max-w-lg select-none mx-4">
                    <div className="text-cyan-400 mb-4 animate-pulse"><Terminal size={32} className="mx-auto" /></div>
                    <h2 className="text-lg md:text-xl mb-4 font-mono text-cyan-200 tracking-widest border-b border-cyan-900 pb-2">SYSTEM INTERCEPT</h2>
                    <p className="text-gray-300 mb-8 text-sm md:text-md font-mono leading-relaxed opacity-80 min-h-[60px] flex items-center justify-center">
                        "{loreMsg}"
                    </p>
                    <button 
                        onClick={startGame}
                        className="group relative flex items-center justify-center gap-2 mx-auto px-10 py-3 bg-cyan-900/40 hover:bg-cyan-500/20 rounded-sm transition-all border border-cyan-500/50 hover:border-cyan-400 text-cyan-200 font-mono tracking-widest text-sm overflow-hidden"
                    >
                        <span className="relative z-10">INITIATE PROTOCOL</span>
                        <div className="absolute inset-0 bg-cyan-500/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>
                </div>
            )}

            {!gameState.isPlaying && !gameState.isLevelComplete && !gameState.showStartScreen && (
                <div className="hidden"></div> 
            )}

            {gameState.isLevelComplete && (
                <div className="bg-black/90 backdrop-blur-xl border border-green-500/50 p-8 rounded-sm text-center pointer-events-auto animate-in fade-in zoom-in duration-300 max-w-lg select-none shadow-[0_0_50px_rgba(34,197,94,0.2)] mx-4">
                <div className="border-b border-green-900/50 pb-4 mb-6">
                    <h2 className="text-xl md:text-2xl font-mono text-green-500 uppercase tracking-widest mb-1">Session Report</h2>
                    <div className="text-[10px] text-green-700 font-mono">{new Date().toISOString()} // LOG_ID_442</div>
                </div>
                
                <div className="font-mono text-green-300 mb-8 text-sm md:text-lg typing-effect min-h-[60px] flex items-center justify-center">
                    &gt; {completionMsg}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8 text-[11px] font-mono text-green-600">
                    <div className="border border-green-900/30 p-2">CYCLES: {Math.floor(Math.random()*5000)}</div>
                    <div className="border border-green-900/30 p-2">EFFICIENCY: {90 + Math.floor(Math.random()*10)}%</div>
                    <div className="border border-green-900/30 p-2">LOSS: {Math.floor(Math.random() * 25 + 5)}.{Math.floor(Math.random()*9)}%</div>
                    <div className="border border-green-900/30 p-2">SYNC: STABLE</div>
                </div>

                <button 
                    onClick={nextLevel}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-green-900/20 text-green-400 hover:bg-green-500 hover:text-black border border-green-500 transition-all font-mono uppercase tracking-widest text-sm"
                >
                    Initialize Next Level
                    <ArrowRight size={16} />
                </button>
                </div>
            )}
            </div>

            <div className={`flex justify-end items-end pointer-events-none pl-4 transition-all duration-500 ${isMenuOpen ? 'md:mr-0 mr-0' : 'md:mr-4 mr-0'}`}>
                <div className="flex gap-2 pointer-events-auto">
                    <button 
                        onClick={prevLevel}
                        disabled={levelIndex === 0}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700 ${levelIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title="Previous Level"
                    >
                        <Rewind size={20} />
                        <span className="text-xs md:text-sm font-medium uppercase tracking-wider hidden md:inline">Back</span>
                    </button>
                    <button 
                        onClick={nextLevel}
                        className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700"
                        title="Skip Level"
                    >
                        <FastForward size={20} />
                        <span className="text-xs md:text-sm font-medium uppercase tracking-wider hidden md:inline">Skip</span>
                    </button>
                    <button 
                        onClick={restartLevel}
                        className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700"
                        title="Restart Level"
                    >
                        <RotateCcw size={20} />
                        <span className="text-xs md:text-sm font-medium uppercase tracking-wider hidden md:inline">Reset</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
