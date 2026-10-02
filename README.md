# Coastline Drifters — Architecture & Technical Deep Dive

Welcome to the architectural overview for **Coastline Drifters**. This document is structured to provide a comprehensive, high-level breakdown of the tech stack, data flow, APIs, and overall system design of the project, suitable for a technical discussion at a top-tier tech company.

---

## 1. High-Level System Architecture

Coastline Drifters is a real-time multiplayer 3D web game. It follows a classic authoritative-server model for room state management combined with client-side prediction and interpolation for smooth 3D rendering.

The system is split into two primary monoliths:
1.  **The Client (Frontend):** A React-based 3D application rendering the game world and handling user inputs.
2.  **The Server (Backend):** A Node.js server powered by Colyseus, acting as the single source of truth for multiplayer state synchronization.

---

## 2. Tech Stack Overview

### Frontend (Client)
*   **Core:** React 18, TypeScript, Vite (Bundler).
*   **3D Rendering Engine:** 
    *   **Three.js** (Underlying WebGL renderer)
    *   **React Three Fiber (R3F):** A React reconciler for Three.js, allowing us to build the 3D scene using React components.
    *   **React Three Drei:** Helper abstractions (cameras, environment maps, GLTF loaders).
*   **Physics Engine:** **@react-three/rapier** (A React wrapper around the Rapier physics engine, compiled to WebAssembly for high-performance physics simulations like vehicle driving and object collisions).
*   **UI & Styling:** TailwindCSS (for atomic, utility-first styling) and Framer Motion (for fluid UI animations like the HUD and Lobby transitions).
*   **Multiplayer Networking:** Colyseus.js (Client SDK for WebSockets).

### Backend (Server)
*   **Core:** Node.js, Express, TypeScript.
*   **Multiplayer Framework:** **Colyseus** (A dedicated multiplayer framework that handles WebSocket connections, state synchronization, and room lifecycle management).
*   **State Schema:** Colyseus `@colyseus/schema` (Defines strict typed schemas for binary delta-compression, ensuring low bandwidth usage).
