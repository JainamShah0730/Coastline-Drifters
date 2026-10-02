import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { CoastlineRoom } from "./rooms/CoastlineRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("coastline", CoastlineRoom);

gameServer.listen(port).then(() => {
  console.log(`[GameServer] Listening on Port: ${port}`);
});
