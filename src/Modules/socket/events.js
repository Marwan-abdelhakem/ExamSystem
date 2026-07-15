export const CHAT_EVENTS = {
  JOIN: "chat:join",
  LEAVE: "chat:leave",
  SEND: "chat:send",
  RECEIVE: "chat:receive",
  TYPING: "chat:typing",
  STOP_TYPING: "chat:stop-typing",
  SEEN: "chat:seen",
  ERROR: "chat:error",
};

export const SOCKET_EVENTS = {
  CONNECT: "connection",
  DISCONNECT: "disconnect",
};

export const CHAT_ACK = {
  SUCCESS: "success",
  FAILED: "failed",
};
