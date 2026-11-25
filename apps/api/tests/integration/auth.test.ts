import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { redis } from "../../src/config/redis";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe("Auth", () => {
  const email = `test-${Date.now()}@example.com`;

  it("registers a new user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it("rejects duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejects wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});
