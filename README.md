
# Lumina Flow

**Lumina Flow** is a meditative, bioluminescent particle puzzle game built for the web. Inspired by titles like *Frost* and *Blek*, it tasks players with guiding a swarm of autonomous agents through complex cosmic puzzles using drawn paths, gravity manipulation, and flow mechanics.

This project is a technical demonstration of high-performance 3D graphics in the browser using **React**, **Three.js**, and **WebGL shaders**.

---

## 🚀 Tech Stack

*   **Framework:** [React 19](https://react.dev/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **3D Engine:** [Three.js](https://threejs.org/)
*   **React Renderer:** [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) (R3F)
*   **Helpers:** [@react-three/drei](https://github.com/pmndrs/drei)
*   **Post-Processing:** [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) (Bloom, Vignette)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)

---

## 🛠️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/lumina-flow.git
    cd lumina-flow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open in browser:**
    Navigate to `http://localhost:5173` (or the port shown in your terminal).

---

## 🧠 Architecture & Educational Guide

This project is designed to handle **9,000+ interactive particles** at 60 FPS. To achieve this, we bypass standard React state updates for the render loop.

### 1. The Physics Engine (`Swarm.tsx`)
Instead of creating 9,000 `<Mesh>` components (which would crash the browser), we use **`InstancedMesh`**.

*   **InstancedMesh:** Draws the same geometry 9,000 times in a single GPU draw call.
*   **Direct Mutation:** We do not use `useState` for particle positions. Instead, we maintain `Float32Array` buffers for:
    *   `positions` (x, y, z)
    *   `velocities` (vx, vy, vz)
    *   `life` (active state)
    *   `traits` (unique behaviors)
*   **useFrame Loop:** Inside the `useFrame` hook, we iterate through these arrays, apply physics math, and update the `InstancedMesh` matrix directly.

**Forces applied per frame:**
1.  **Flow:** Attraction towards the user-drawn paths (Cosmic Tubes).
2.  **Gravity:** Slight pull towards the bottom (or towards Titans/Black Holes).
3.  **Noise:** Perlin-like noise to create organic "swarming" jitter.
4.  **Collision:** Ray-circle intersection for walls, obstacles, and black holes.

### 2. Generative Levels (`constants.ts`)
Levels are not hardcoded JSON files. They are **Procedurally Generated** based on a seed (the level ID).
*   **Determinism:** Level 4 will always look the same because the random number generator is seeded by the level index.
*   **Eras:** The generation logic changes as you progress:
    *   *Levels 1-9:* Orbitals & Debris.
    *   *Levels 10-19:* Grid-based Mazes.
    *   *Levels 20+:* Portals & Chaos.

### 3. Generative Audio (`AudioController.tsx`)
There are **no MP3 files** in this project. All audio is synthesized in real-time using the **Web Audio API**.
*   **Oscillators:** We create Sine, Triangle, and Square waves for melodies.
*   **Noise Buffers:** We generate white noise buffers for Snares and Hi-Hats.
*   **Sequencer:** A generic `setTimeout` recursive scheduler plays music based on the selected "Vibe" (Lofi, Retro, Ambient).

### 4. Shaders (`components/SceneManager.tsx`)
Custom GLSL shaders are used for:
*   **CosmicPath:** The glowing tubes you draw. They use a scrolling noise texture to simulate flowing energy.
*   **Background:** The nebula effect is a fractal brownian motion (FBM) noise shader.

---

## 🎮 Gameplay Mechanics

### Core Loop
*   **Goal:** Guide particles from the **Emitter** to the **Target** (Singularity Reactor).
*   **Interaction:** Click and drag to draw "gravity paths". The swarm will flow along these lines.
*   **Fuel:** In later levels, drawing consumes fuel.

### Elements
*   **Black Holes:** High-gravity hazards. They grow as they eat particles. Can go Supernova if fed too much.
*   **Chargers (Prisms):** Particles must pass through these to turn Gold before entering the target.
*   **Portals:** Teleport particles across the map while preserving momentum.
*   **Walls:** Physical barriers. Particles bounce off them (reflect velocity).
*   **Bosses:** Levels ending in 0 or 5. The target moves and emits lethal shockwaves.

### Particle Traits
Particles evolve as they age:
*   **Titans:** Large, slow, generate their own gravity (clumping).
*   **Sparks:** Fast, thin, laser-like.
*   **Ghosts:** Phase through debris and turbulence.
*   **Weavers:** Move in sine-wave patterns.

---

## 🎛️ Sandbox & Customization

The game includes a robust "Sandbox" mode (Sidebar > Sandbox Tools) that exposes the physics variables:

*   **Time Dilation:** Slow down time (`0.1x`) to watch the physics calculation or speed it up (`4x`).
*   **Symmetry:** Draws a mirrored path automatically.
*   **Mouse Gravity:** Turns your cursor into a black hole.
*   **Hyper Trails:** Extends the visual stretching of particles based on velocity.

---

## 📂 Project Structure

```
src/
├── components/
│   ├── Anomalies.tsx       # Floating hazards, spirits, and eyes
│   ├── AudioController.tsx # Web Audio API synth engine
│   ├── Background.tsx      # Nebula shader and floating debris
│   ├── GameCanvas.tsx      # R3F Canvas setup + Post-processing
│   ├── LevelElements.tsx   # Visuals for Walls, Targets, Black Holes
│   ├── SceneManager.tsx    # Main scene logic, path drawing, anomalies
│   └── Swarm.tsx           # THE PHYSICS ENGINE (InstancedMesh logic)
├── constants.ts            # Level generation logic & Physics constants
├── types.ts                # TypeScript interfaces
├── App.tsx                 # UI Overlay, State Management
├── index.tsx               # Entry point
└── index.html              # HTML root
```

## 📄 License

This project is open-source. Feel free to fork, modify, and learn from it.
