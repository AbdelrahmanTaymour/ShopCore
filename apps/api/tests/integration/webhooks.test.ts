import crypto from "crypto";
import request from "supertest";
import { createApp } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/config/prisma";
import { redis } from "../../src/config/redis";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

beforeEach(async () => {
  // These two tests reuse fixed event IDs (needed to test duplicate detection
  // against the *same* ID), so clear any leftover rows from a previous run.
  await prisma.webhookEvent.deleteMany({
    where: { id: { in: ["evt_fixed_123", "evt_concurrent_123"] } },
  });
});

function sign(payload: object, timestamp: number) {
  const body = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto
    .createHmac("sha256", env.WEBHOOK_SIGNING_SECRET)
    .update(signedPayload)
    .digest("hex");
  return { body, signature, timestamp: timestamp.toString() };
}

describe("Webhooks", () => {
  it("accepts a validly signed event", async () => {
    const payload = { eventId: `evt_${Date.now()}`, type: "order.created" };
    const { body, signature, timestamp } = sign(
      payload,
      Math.floor(Date.now() / 1000),
    );

    const res = await request(app)
      .post("/api/v1/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Signature", signature)
      .set("X-Timestamp", timestamp)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(false);
  });

  it("rejects an invalid signature", async () => {
    const payload = { eventId: `evt_${Date.now()}`, type: "order.created" };
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const res = await request(app)
      .post("/api/v1/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Signature", "deadbeef".repeat(8))
      .set("X-Timestamp", timestamp)
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);
  });

  it("rejects a stale timestamp", async () => {
    const payload = { eventId: `evt_${Date.now()}`, type: "order.created" };
    const oldTimestamp = Math.floor(Date.now() / 1000) - 10000;
    const { body, signature, timestamp } = sign(payload, oldTimestamp);

    const res = await request(app)
      .post("/api/v1/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Signature", signature)
      .set("X-Timestamp", timestamp)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("STALE_TIMESTAMP");
  });

  it("treats a repeated event as a successful duplicate", async () => {
    const payload = { eventId: `evt_fixed_123`, type: "order.created" };
    const timestamp = Math.floor(Date.now() / 1000);
    const { body, signature } = sign(payload, timestamp);

    const first = await request(app)
      .post("/api/v1/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Signature", signature)
      .set("X-Timestamp", timestamp.toString())
      .send(body);

    const second = await request(app)
      .post("/api/v1/webhooks")
      .set("Content-Type", "application/json")
      .set("X-Signature", signature)
      .set("X-Timestamp", timestamp.toString())
      .send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
  });

  it("handles concurrent duplicate deliveries without double-processing", async () => {
    const payload = { eventId: `evt_concurrent_123`, type: "order.created" };
    const timestamp = Math.floor(Date.now() / 1000);
    const { body, signature } = sign(payload, timestamp);

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/v1/webhooks")
        .set("Content-Type", "application/json")
        .set("X-Signature", signature)
        .set("X-Timestamp", timestamp.toString())
        .send(body),
      request(app)
        .post("/api/v1/webhooks")
        .set("Content-Type", "application/json")
        .set("X-Signature", signature)
        .set("X-Timestamp", timestamp.toString())
        .send(body),
    ]);

    const duplicateFlags = [a.body.duplicate, b.body.duplicate].sort();
    expect(duplicateFlags).toEqual([false, true]);
  });
});
