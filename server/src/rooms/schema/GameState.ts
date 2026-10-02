import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// ── Player schema ────────────────────────────────────────────────
export class Player extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "Drifter";

  // World-space transform
  @type("number") x: number = 0;
  @type("number") y: number = 0.5;
  @type("number") z: number = 0;
  @type("number") rotationY: number = 0;

  // Which activity node the player is currently in (empty = driving)
  @type("string") activeNode: string = "";

  @type("string") color: string = "#e8a020";
}

// ── Vehicle schema ───────────────────────────────────────────────
export class Vehicle extends Schema {
  @type("string") driverSessionId: string = "";  // "" = parked/empty

  @type("number") x: number = 5;   // near gas-station spawn
  @type("number") y: number = 0.5;
  @type("number") z: number = 5;
  @type("number") rotationY: number = 0;

  @type("number") speed: number = 0;

  @type("string") color: string = "#e8a020";
}

// ── Node-state schema ────────────────────────────────────────────
// Tracks whether a world node (campfire, fishing dock, etc.) is active
export class NodeState extends Schema {
  @type("string") nodeId: string = "";
  @type("boolean") active: boolean = false;
  // Generic payload for simple flags (fires lit, fish caught count, etc.)
  @type("number") count: number = 0;
}

// ── Catch Log schema ──────────────────────────────────────────────
export class CatchRecord extends Schema {
  @type("string") playerName: string = "";
  @type("string") fishName: string = "";
  @type("number") weight: number = 0;
  @type("number") timestamp: number = 0;
}

// ── Surf Record schema ────────────────────────────────────────────
export class SurfRecord extends Schema {
  @type("string") playerName: string = "";
  @type("number") score: number = 0;
  @type("number") timestamp: number = 0;
}

// ── Root game state ──────────────────────────────────────────────
export class GameState extends Schema {
  @type({ map: Player })  players  = new MapSchema<Player>();
  @type({ map: Vehicle }) vehicles = new MapSchema<Vehicle>();
  @type({ map: NodeState }) nodes  = new MapSchema<NodeState>();
  @type("number") timeOfDay: number = 0.6;  // 0–1, 0.6 = late afternoon

  // Global feed of recent catches
  @type([ CatchRecord ]) catchLog = new ArraySchema<CatchRecord>();

  // Global leaderboard of surf scores
  @type([ SurfRecord ]) surfLeaderboard = new ArraySchema<SurfRecord>();
}
