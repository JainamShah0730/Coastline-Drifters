import { Room, Client } from "colyseus";
import { GameState, Player, Vehicle, NodeState, CatchRecord, SurfRecord } from "./schema/GameState";

const NODE_IDS = ["fishing-dock", "surf-beach", "campsite", "bonfire-circle", "overlook", "rest-stop"];

export class CoastlineRoom extends Room<GameState> {
  maxClients = 6;

  onCreate(_options: any) {
    this.setState(new GameState());

    // Pre-create node states
    ["fishing-dock", "surf-beach", "campsite", "overlook", "rest-stop", "bonfire-circle"].forEach(id => {
      const node = new NodeState();
      node.nodeId = id;
      this.state.nodes.set(id, node);
    });

    // ── Player position ────────────────────────────────────────────
    this.onMessage("updatePosition", (client, data: { x: number; y: number; z: number; rotationY: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
      player.rotationY = data.rotationY;
    });

    // ── Vehicle position (driver only) ─────────────────────────────
    this.onMessage("updateVehicle", (client, data: { id: string; x: number; y: number; z: number; rotationY: number; speed: number }) => {
      const vehicle = this.state.vehicles.get(data.id);
      if (!vehicle || vehicle.driverSessionId !== client.sessionId) return;
      vehicle.x = data.x;
      vehicle.y = data.y;
      vehicle.z = data.z;
      vehicle.rotationY = data.rotationY;
      vehicle.speed = data.speed;
    });

    // ── Enter / exit vehicle ───────────────────────────────────────
    this.onMessage("enterVehicle", (client, data: { vehicleId: string }) => {
      const vehicle = this.state.vehicles.get(data.vehicleId);
      if (!vehicle || vehicle.driverSessionId !== "") return; // already occupied
      vehicle.driverSessionId = client.sessionId;
    });

    this.onMessage("exitVehicle", (client, data: { vehicleId: string }) => {
      const vehicle = this.state.vehicles.get(data.vehicleId);
      if (!vehicle || vehicle.driverSessionId !== client.sessionId) return;
      vehicle.driverSessionId = "";
    });

    // ── Activity node enter / exit ─────────────────────────────────
    this.onMessage("enterNode", (client, data: { nodeId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.activeNode = data.nodeId;
    });

    this.onMessage("exitNode", (client, _data: any) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.activeNode = "";
    });

    // ── Node state toggle (e.g. light campfire) ────────────────────
    this.onMessage("toggleNode", (client, data: { nodeId: string; active: boolean }) => {
      const node = this.state.nodes.get(data.nodeId);
      if (node) node.active = data.active;
    });

    this.onMessage("updateNodeCount", (client, data: { nodeId: string; delta: number }) => {
      const node = this.state.nodes.get(data.nodeId);
      if (node) node.count = Math.max(0, node.count + data.delta);
    });

    // ── Fishing minigame ───────────────────────────────────────────
    this.onMessage("catchFish", (client, data: { fishName: string, weight: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        const record = new CatchRecord();
        record.playerName = p.name;
        record.fishName = data.fishName;
        record.weight = data.weight;
        record.timestamp = Date.now();
        this.state.catchLog.push(record);
        
        // Keep log small (last 10)
        if (this.state.catchLog.length > 10) {
          this.state.catchLog.shift();
        }
      }
    });

    this.onMessage("postSurfScore", (client, data: { score: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        const record = new SurfRecord();
        record.playerName = p.name;
        record.score = data.score;
        record.timestamp = Date.now();
        
        this.state.surfLeaderboard.push(record);
        
        // Sort descending and keep top 5
        this.state.surfLeaderboard.sort((a, b) => b.score - a.score);
        if (this.state.surfLeaderboard.length > 5) {
          this.state.surfLeaderboard.pop();
        }
      }
    });

    // ── Time of day ────────────────────────────────────────────────
    this.onMessage("setTimeOfDay", (_client, data: { t: number }) => {
      this.state.timeOfDay = Math.max(0, Math.min(1, data.t));
    });
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options?.name ?? "Drifter";
    player.color = options?.color ?? "#e8a020";
    // Spawn at the bonfire for testing
    player.x = 5;
    player.y = 0.5;
    player.z = 5;
    this.state.players.set(client.sessionId, player);

    // Give the player their own dedicated vehicle
    const v = new Vehicle();
    v.x = player.x + (Math.random() * 4 - 2); // slight offset so they don't exactly stack
    v.z = player.z + (Math.random() * 4 - 2);
    v.color = player.color;
    this.state.vehicles.set(`vehicle-${client.sessionId}`, v);
  }

  onLeave(client: Client, _consented: boolean) {
    console.log(client.sessionId, "left!");
    // Release vehicle if they were driving
    this.state.vehicles.forEach((v) => {
      if (v.driverSessionId === client.sessionId) v.driverSessionId = "";
    });
    this.state.players.delete(client.sessionId);
    // Remove their vehicle
    this.state.vehicles.delete(`vehicle-${client.sessionId}`);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
