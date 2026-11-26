import { createServer } from "http";
import { io as ioClient, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import {
  initSocket,
  emitOrderUpdate,
} from "../../src/modules/notifications/socket";
import { env } from "../../src/config/env";

describe("Socket.IO rooms", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;

  beforeAll((done) => {
    httpServer = createServer();
    initSocket(httpServer);
    httpServer.listen(() => {
      port = (httpServer.address() as any).port;
      done();
    });
  });

  afterAll(() => httpServer.close());

  function connectAs(userId: string): Promise<Socket> {
    const token = jwt.sign({ sub: userId }, env.JWT_SECRET);
    return new Promise((resolve) => {
      const socket = ioClient(`http://localhost:${port}`, { auth: { token } });
      socket.on("connect", () => resolve(socket));
    });
  }

  it("rejects a connection without a valid token", (done) => {
    const socket = ioClient(`http://localhost:${port}`, { auth: {} });
    socket.on("connect_error", (err) => {
      expect(err.message).toBe("UNAUTHORIZED");
      socket.close();
      done();
    });
  });

  it("delivers events only to the target user's own room", async () => {
    const userA = await connectAs("user-a");
    const userB = await connectAs("user-b");

    const receivedByA: any[] = [];
    const receivedByB: any[] = [];
    userA.on("order:update", (payload) => receivedByA.push(payload));
    userB.on("order:update", (payload) => receivedByB.push(payload));

    emitOrderUpdate("user-a", {
      eventId: "evt1",
      status: "PAID",
      timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 200));

    expect(receivedByA).toHaveLength(1);
    expect(receivedByA[0]).toMatchObject({ eventId: "evt1", status: "PAID" });
    expect(receivedByB).toHaveLength(0); // user B got nothing

    userA.close();
    userB.close();
  });
});
