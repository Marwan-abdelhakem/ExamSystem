import { Server } from "socket.io";
import registerSocketMiddleware from "./middleware.js";
import registerChatSocket from "../chat/chat.socket.js";

let io;
export default function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  registerSocketMiddleware(io);
  registerChatSocket(io);
  return io;
}

export { io };
