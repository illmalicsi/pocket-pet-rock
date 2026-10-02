# Pocket Pet Rock

A quirky, deadpan 3D web toy built with **Three.js**, **WebGL**, and **Vite**. Instead of traditional to-do apps or landing pages, you adopt a 3D rock with googly eyes, give it a name, pet it, and watch it react with understated geological humor.

## Features

- **Procedural 3D Rock & Googly Eyes**: Built with an icosahedron base geometry displaced by layered harmonic sine waves for stone lumpiness, with a flattened base and flat-shaded warm stone facets. The googly eyes feature glossy white spheres with pupils that gently wander and jiggle under squish.
- **Damped Spring Physics**: Petting the rock squashes it vertically and bulges it horizontally while keeping the base planted on the ground plane.
- **Drag Rotation & Camera Facing**: Interactive drag-to-spin with decaying angular inertia that gently restores forward facing after a couple seconds of inactivity.
- **Deadpan Dialogue & Personality**: Speech bubble anchored to the rock with witty, understated commentary, pet milestones (10, 25, 50, 100 pets), and backside inspection jokes.
- **Interactions**:
  - **Pet**: Direct tap on the 3D rock or the Pet button.
  - **Feed pebble**: Drops a small procedural pebble from above that falls with gravity, squishes the rock, and is absorbed into its mineral mass.
  - **Stare contest**: Widens the googly eyes for 4 seconds, concluding with a dry victory for the rock because rocks have no eyelids.
  - **Hide**: Uses WebGL local clipping to sink the rock underground until only its googly eyes peek above the surface with darting pupils, before popping back up with an overshoot squish.
  - **Hat**: Cycles through 3D accessories parented to the rock (Gold Crown, Black Top Hat, and Flattened Green Leaf) that move and squish with the stone.
  - **Night Mode**: Smoothly transitions between daytime and night with dimmed cool blue moonlit lighting, a 120-star background field, and sleepy flattened eyelids.
- **Clean Responsive UI**: Pill-shaped action buttons, inline editable rock name, stats counter tracking pets and time together, and system dark/light theme support.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- npm

### Installation

```bash
git clone https://github.com/illmalicsi/pocket-pet-rock.git
cd pocket-pet-rock
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Tech Stack

- **Three.js** - 3D procedural meshes, lighting, clipping planes, particles, and WebGL rendering
- **Vite** - Fast ES-module development and production bundling
- **Vanilla JavaScript & CSS** - Modular architecture without heavy frameworks
