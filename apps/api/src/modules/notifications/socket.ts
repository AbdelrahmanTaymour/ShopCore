import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

let io: Server | undefined;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, { cors: { origin: "*" } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("UNAUTHORIZED"));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      // identity comes from the verified token, never from anything the client sends directly
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const room = `user:${socket.data.userId}`;
    socket.join(room);
    logger.info({ userId: socket.data.userId }, "socket connected");

    socket.on("disconnect", () => {
      logger.info({ userId: socket.data.userId }, "socket disconnected");
    });
  });

  return io;
}

export function emitOrderUpdate(
  userId: string,
  event: { eventId: string; status: string; timestamp: string }
) {
  if (!io) {
    logger.warn({ userId }, "emitOrderUpdate called before initSocket");
    return;
  }
  io.to(`user:${userId}`).emit("order:update", event);
}
