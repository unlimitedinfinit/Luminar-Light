
import React, { useEffect, useRef } from 'react';
import { VibeSettings } from '../types';

interface AudioControllerProps {
  vibe: VibeSettings;
  isPlaying: boolean;
  onAudioReady: (controls: any) => void;
}

const AudioController: React.FC<AudioControllerProps> = ({ vibe, isPlaying, onAudioReady }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const stepRef = useRef<number>(0);
  const ambientNodeRef = useRef<AudioNode | null>(null);

  // Use refs to access latest vibe settings inside the recursive scheduler
  const vibeRef = useRef(vibe);
  useEffect(() => { vibeRef.current = vibe; }, [vibe]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playKick = (time: number, vol = 0.5) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  const playSnare = (time: number, vol = 0.3) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
  }

  const playHiHat = (time: number, vol = 0.1) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
  }

  const playTone = (freq: number, type: OscillatorType, duration: number, time: number, vol: number) => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
  };

  const playChord = (freqs: number[], type: OscillatorType, duration: number, time: number, vol: number) => {
      freqs.forEach(f => playTone(f, type, duration, time, vol));
  }

  const scheduleNotes = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const currentVibe = vibeRef.current;

      const lookahead = 25.0; 
      const scheduleAheadTime = 0.1; 

      if (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
          
          const currentStep = stepRef.current;
          const time = nextNoteTimeRef.current;
          
          // --- MUSIC LOGIC ---
          const id = currentVibe.musicId;

          // PULSE (LOFI 1)
          if (id === 'pulse') {
              if (currentStep % 8 === 0) playKick(time, 0.6);
              if (currentStep % 16 === 10) playKick(time, 0.4);
              if (currentStep % 8 === 4) playSnare(time, 0.2);
              if (currentStep % 2 === 0) playHiHat(time, 0.05);
              if (currentStep % 32 === 0) {
                  const chord = Math.random() > 0.5 ? [174.61, 207.65, 261.63, 311.13] : [130.81, 155.56, 196.00, 233.08];
                  playChord(chord, 'triangle', 2.0, time, 0.1);
              }
              if (currentStep % 8 === 7 && Math.random() > 0.5) playTone(523.25, 'sine', 0.2, time, 0.05);
          }

          // CHILL (LOFI 2 - Jazz)
          else if (id === 'chill') {
              // Jazzy chords Fmaj7 -> G7
               if (currentStep % 16 === 0) {
                   playChord([174.61, 220.00, 261.63, 329.63], 'sine', 1.0, time, 0.1);
               }
               if (currentStep % 16 === 8) {
                   playChord([196.00, 246.94, 293.66, 349.23], 'sine', 1.0, time, 0.1);
               }
               // Soft shuffle
               if (currentStep % 2 === 0) playHiHat(time, 0.03);
               if (currentStep % 4 === 0 && Math.random() > 0.5) playSnare(time, 0.1);
          }

          // NIGHT (LOFI 3 - Sleep)
          else if (id === 'night') {
               // Slow ambient pads
               if (currentStep % 32 === 0) {
                   playTone(110.00, 'sine', 4.0, time, 0.2); // A2
                   playTone(164.81, 'triangle', 4.0, time, 0.05); // E3
               }
               // Very sparse clicks
               if (Math.random() < 0.1) playHiHat(time, 0.02);
          }

          // BIT (RETRO)
          else if (id === 'bit') {
              const scale = [220, 261.63, 329.63, 392.00, 440, 523.25];
              if (currentStep % 4 === 0) playTone(110, 'square', 0.1, time, 0.05);
              if (currentStep % 2 === 0) {
                 const n = scale[Math.floor(Math.random() * scale.length)];
                 playTone(n * 2, 'square', 0.05, time, 0.03);
              }
              if (currentStep % 8 === 0) playKick(time, 0.4);
              if (currentStep % 8 === 4) playSnare(time, 0.2);
          }
          else if (id === 'life') {
              if (Math.random() < 0.1) {
                   const pentatonic = [392.00, 440.00, 493.88, 587.33, 659.25, 783.99];
                   const f = pentatonic[Math.floor(Math.random() * pentatonic.length)];
                   playTone(f, 'sine', 1.5, time, 0.05);
              }
          }
          else if (id === 'void') {
              if (currentStep % 64 === 0) {
                   playTone(65.41, 'sine', 4.0, time, 0.2); 
                   playTone(130.81, 'triangle', 4.0, time, 0.05); 
                   playTone(196.00, 'sine', 4.0, time, 0.05); 
              }
          }
          else if (id === 'ether') {
              if (currentStep % 32 === 0) {
                  const chord = [155.56, 196.00, 233.08, 311.13]; 
                  chord.forEach(f => playTone(f, 'sine', 6.0, time, 0.08));
              }
          }
          else if (id === 'focus') {
             if (currentStep % 4 === 0) playTone(880, 'sine', 0.05, time, 0.02);
             if (currentStep % 5 === 0) playTone(660, 'triangle', 0.05, time, 0.02);
             if (currentStep % 32 === 0) playTone(220, 'sine', 2.0, time, 0.05);
          }
          else if (id === 'warp') {
              if (currentStep % 16 === 0) {
                   const freq = 110 + Math.random() * 50;
                   const osc = ctx.createOscillator();
                   const gain = ctx.createGain();
                   osc.type = 'sawtooth';
                   osc.frequency.setValueAtTime(freq, time);
                   osc.frequency.linearRampToValueAtTime(freq * 0.5, time + 1); 
                   gain.gain.setValueAtTime(0.05, time);
                   gain.gain.exponentialRampToValueAtTime(0.001, time + 1);
                   osc.connect(gain);
                   gain.connect(ctx.destination);
                   osc.start(time);
                   osc.stop(time + 1);
              }
          }
          else if (id === 'piano') {
              const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
              if (Math.random() > 0.6) {
                   const note = scale[Math.floor(Math.random() * scale.length)];
                   playTone(note, 'triangle', 0.8, time, 0.1);
              }
          }

          // Advance Step
          let secondsPerBeat = 0.5; 
          
          if (id === 'pulse') secondsPerBeat = 60 / 85 / 4; 
          if (id === 'chill') secondsPerBeat = 60 / 80 / 4;
          if (id === 'night') secondsPerBeat = 60 / 60 / 4;
          if (id === 'bit') secondsPerBeat = 60 / 140 / 4;
          if (id === 'void') secondsPerBeat = 0.2;
          if (id === 'life') secondsPerBeat = 0.3;
          if (id === 'ether') secondsPerBeat = 0.4;
          if (id === 'focus') secondsPerBeat = 60 / 110 / 4;
          if (id === 'warp') secondsPerBeat = 0.25;
          if (id === 'piano') secondsPerBeat = 0.3;

          // Apply Tempo dynamically using ref
          secondsPerBeat = secondsPerBeat / currentVibe.tempo;

          nextNoteTimeRef.current += secondsPerBeat;
          stepRef.current++;
      }
      
      schedulerRef.current = window.setTimeout(scheduleNotes, lookahead);
  };

  const playCollect = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'suspended') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freqs = [880, 987, 1046, 1318, 1568];
    const freq = freqs[Math.floor(Math.random() * freqs.length)];
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.type = vibe.musicId === 'bit' ? 'square' : 'sine';
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const playLevelComplete = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const root = 261.63; 
    const chord = [root, root * 1.25, root * 1.5, root * 2];
    chord.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1 + (i*0.05));
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 3);
    });
  };

  const playAsteroid = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 150;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
  }

  useEffect(() => {
    if (!isPlaying) {
        if (schedulerRef.current) clearTimeout(schedulerRef.current);
        if (ambientNodeRef.current) { ambientNodeRef.current.disconnect(); ambientNodeRef.current = null; }
        return;
    }

    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    nextNoteTimeRef.current = ctx.currentTime;
    stepRef.current = 0;
    scheduleNotes();

    if (!ambientNodeRef.current) {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const gain = ctx.createGain();
        
        gain.gain.value = 0.02;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
        ambientNodeRef.current = gain;
    }

    return () => {
        if (schedulerRef.current) clearTimeout(schedulerRef.current);
        if (ambientNodeRef.current) { 
             ambientNodeRef.current.disconnect(); 
             ambientNodeRef.current = null; 
        }
    };
  }, [vibe.musicId, isPlaying]);

  useEffect(() => {
    onAudioReady({
        playCollect,
        playLevelComplete,
        playAsteroid
    });
  }, [vibe]);

  return null;
};

export default AudioController;
