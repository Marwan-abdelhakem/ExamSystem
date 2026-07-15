import { verifyTokin } from "../../Utlis/token.utlis.js";
import UserModel from "../../DB/model/user.model.js";

export default function registerSocketMiddleware(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        console.log(`[Socket Auth] Rejected connection for socket ${socket.id}: No token provided`);
        return next(new Error("Unauthorized"));
      }
      const decoded = verifyTokin({ token });
      const userId = decoded._id || decoded.id;
      const user = await UserModel.findById(userId);
      if (!user) {
        console.log(`[Socket Auth] Rejected connection for socket ${socket.id}: User not found`);
        return next(new Error("User Not Found"));
      }
      socket.user = user;
      next();
    } catch (err) {
      console.log(`[Socket Auth] Rejected connection for socket ${socket.id}: ${err.message}`);
      return next(new Error("Unauthorized"));
    }
  });
}
