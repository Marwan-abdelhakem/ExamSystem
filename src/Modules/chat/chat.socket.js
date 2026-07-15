import { SOCKET_EVENTS } from "../socket/events.js";

export default function registerChatSocket(io) {
  io.on(SOCKET_EVENTS.CONNECT, (socket) => {
    console.log(`Socket Connected: ${socket.id}`);

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      console.log(`Socket Disconnected: ${socket.id}`);
    });
  });
}

