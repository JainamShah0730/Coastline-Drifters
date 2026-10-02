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

---

## 3. How the Multiplayer State Works (Colyseus API)

The entire multiplayer architecture revolves around the **Colyseus Room** (`CoastlineRoom`) and the **GameState**. 

### The GameState Schema
The server maintains a strictly typed `GameState` tree. The schema includes:
*   `players`: A map of connected players (containing `x, y, z`, `rotationY`, `activeNode`, `name`, `color`).
*   `vehicles`: A map of spawned vans (containing position data, speed, and `driverSessionId`).
*   `nodes`: Interactive points of interest (e.g., fishing docks, campfires).
*   `catchLog` / `surfLeaderboard`: Global arrays tracking minigame high scores.

### State Synchronization Flow (Delta Updates)
1.  **Client Connection:** When a user enters a name and clicks "Start Driving", the client connects to the Colyseus server via WebSocket (`ws://`).
2.  **Server `onJoin`:** The server assigns the user a unique `sessionId`, creates a new `Player` object, spawns a dedicated `Vehicle` for them, and attaches it to the `GameState`.
3.  **Delta Patching:** Colyseus automatically diffs the `GameState` and broadcasts **only the changed bytes (deltas)** to all connected clients 20 times a second.
4.  **Client Rendering:** The React client receives these state patches and updates the local representation. In the 3D world, other players and vehicles are rendered at their synchronized `x, y, z` coordinates.

---

## 4. Client-to-Server API Interactions (Messages)

Instead of traditional REST APIs (like `GET` or `POST`), Coastline Drifters relies entirely on persistent **WebSocket Message passing**.

Here is how the client hits the server APIs:

### A. Movement & Physics
*   **`updatePosition`**: Sent continuously (via `requestAnimationFrame`) by the client to broadcast the player's 3D avatar position.
*   **`updateVehicle`**: Sent continuously by the *driver* of a vehicle to broadcast the physics-simulated position of the van to all other observers.
*   **`enterVehicle` / `exitVehicle`**: Sent when a player presses 'E' near a van. The server verifies if the van is empty and locks the `driverSessionId` to that user.

### B. Interactive Nodes & Minigames
*   **`enterNode`**: Fired when a player physically walks into a specific 3D trigger zone (e.g., the fishing dock). The server updates their `activeNode`, which triggers UI changes on other clients.
*   **`catchFish`**: Fired when a player successfully completes the client-side fishing minigame. The server receives the payload `{ fishName: string, weight: number }`, validates it, and pushes it to the global `catchLog` array.
*   **`postSurfScore`**: Fired when the surfing minigame concludes. The server inserts the score into the `surfLeaderboard` and automatically sorts it to maintain the Top 5 players.

---

## 5. Sub-Systems & Implementation Details

### The Physics System (Rapier)
The game uses a hybrid approach to physics:
1.  **Local Player Physics:** The user's vehicle is simulated locally using `@react-three/rapier` `RigidBody` components. When you press 'W', forces are applied to the physics body directly on your CPU (via WASM).
2.  **Networked Proxies:** Because physics simulation is non-deterministic over a network, only the *driver* actually simulates the vehicle physics. The driver broadcasts their resulting `x, y, z` to the server (`updateVehicle`). Other clients render that vehicle as a "Kinematic" or purely visual mesh that simply interpolates between the coordinates received from the server.

### The UI Architecture (HTML over Canvas)
Rather than building the UI in 3D (WebGL), the project overlays a standard HTML/DOM layer on top of the Three.js canvas. 
*   This is achieved using absolute positioning (`z-10`).
*   React state hooks (`useState`) bridge the gap between 3D events (like walking into a zone) and rendering HTML (like showing the "Press E to Fish" badge).

### The Audio System (Van Radio & Ambience)
*   **Spatial Audio:** The game calculates the distance between the player's avatar and points of interest (using simple Pythagoras theorem `Math.sqrt(dx^2 + dz^2)`). For example, walking near the pond triggers the cricket sound effect dynamically.
*   **Streaming API:** The "Van Radio" feature hooks into standard HTML5 `<audio>` elements, pointing directly to live Icecast/Shoutcast internet radio stream URLs (like Lofi Girl or Synthwave stations).

---

## Summary
Coastline Drifters is a highly decoupled, real-time web application. It leverages the raw performance of WebGL (Three.js) and WebAssembly (Rapier) for rendering and physics, while utilizing Colyseus over WebSockets to maintain a synchronized, low-latency shared reality for multiple users without relying on heavy traditional REST APIs.
