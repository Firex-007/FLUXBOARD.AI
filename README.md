# ⚡ FLUXBOARD.AI

**The "Iron Man HUD" for Electronics Engineering.**

FLUXBOARD.AI is a billion-dollar deep-tech AR-driven digital twin and circuit simulator, designed as a premium, hyper-realistic workspace for electronics engineers and hobbyists. Built for the **PIXEL.GEMINI Hackathon**.

![FluxBoard Banner](banner.png) 

## 🚀 Vision
To bridge the gap between physical breadboards and digital simulation using real-time AI assistance, AR-inspired visualizations, and a robust physics-first engine.

## 🧠 Core Architecture (The 6-Phase System)

### 1. DSU Physics Engine (The Breadboard Bible)
- **Mathematical Grid**: Strict 0.1-inch (2.54mm) grid mapping.
- **Metal Clip Law**: Columns A-E and F-J connected electrically, separated by the center trench.
- **Connectivity**: Managed via a Disjoint Set Union (DSU) graph for active electrical nets.

### 2. AR Scene & Ghost Materials
- **Visuals**: Semi-transparent holographic bodies (`opacity: 0.8`) with glowing neon edges.
- **Hardware Overlay**: Designed to overlay physical hardware without obscuring it.

### 3. Hyper-Realism & Wiring
- **Realistic Mesh**: Chamfered square holes, inner silver metal clips, and printed polarity lines.
- **Mathematical Wires**: Cubic Bezier Curves for physical arcing over the board.
- **Semantic Coloring**: VCC = Red, GND = blue/Black, Signal = Green/Yellow.

### 4. Rigid Body Component Library
- Components are physical objects with strict footprints.
- **Self-Shorting Rule**: ICs must span the center trench.

### 5. SPICE Simulator (`ngspice.wasm`)
- Runs exclusively in a Web Worker to keep the UI thread buttery smooth.

### 6. Gemini AI Circuit Analyst
- **Circuitex Edit Bot**: A floating glassmorphic panel overlaying the AR view.
- **Intelligence**: Monitors netlists, warns of shorts, and explains signal flow using Gemini 1.5 Pro.

## 🛠️ Tech Stack
- **Framework**: Next.js / Vite
- **State Management**: Zustand
- **Physics**: Disjoint Set Union (DSU) Graph
- **AI**: Google Gemini 1.5 Pro / Flash
- **Simulation**: `ngspice.wasm`
- **Styling**: Tailwind CSS (Dark Mode, Glassmorphism, Neon accents)

## 📦 Features implemented
- **Resizable Workspaces**: Drag-to-resize side panels (Upload & Prompt, BOM & Wiring Map).
- **Circuit Library**: Save, load, and local file export/import (`.fluxboard.json`).
- **AI Edit Bot**: Natural language circuit modifications using Gemini.
- **Component expansion**: Support for Diodes, Zener Diodes, Potentiometers, Relays, Buzzers, and Photoresistors.

## 🏁 Getting Started

```bash
# Clone the repository
git clone git@github.com:StarDust-Git-Code/FLUXBOARD.AI.git

# Install dependencies
npm install

# Run the development server
npm run dev
```

---

