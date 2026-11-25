import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { redis } from "../../src/config/redis";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe("Products caching", () => {
  it("caches the product list and invalidates it on write", async () => {
    await redis.del("products:list");

    const first = await request(app).get("/api/v1/products");
    expect(first.status).toBe(200);

    const cached = await redis.get("products:list");
    expect(cached).not.toBeNull();

    // directly create a product to trigger invalidation via the service layer
    const adminEmail = `cache-admin-${Date.now()}@example.com`;
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: adminEmail, password: "password123" });
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: "ADMIN" },
    });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: adminEmail, password: "password123" });
    const token = login.body.token;

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Invalidation Test",
        description: "x",
        price: 1,
        stock: 1,
      });

    const afterWrite = await redis.get("products:list");
    expect(afterWrite).toBeNull();
  });
});
