import dotenv from "dotenv";
dotenv.config({ path: "./src/config/.env" });

import express from "express";
import http from "http";

import bootStrap from "./src/app.controller.js";
import initializeSocket from "./src/Modules/socket/index.js";

const app = express();

await bootStrap(app, express);

const server = http.createServer(app);

initializeSocket(server);

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server running on ${port}`);
});

export default app;
