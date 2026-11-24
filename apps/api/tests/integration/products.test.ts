import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(
  email: string,
  role: "USER" | "ADMIN" = "USER",
) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "password123" });

  if (role === "ADMIN") {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    // re-login to get a token with the updated role baked in
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "password123" });
    return loginRes.body.token as string;
  }

  return res.body.token as string;
}

describe("Products", () => {
  it("lists products without auth", async () => {
    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("blocks a regular user from creating a product", async () => {
    const token = await registerAndGetToken(`user-${Date.now()}@example.com`);

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Blocked Item", description: "x", price: 9.99, stock: 5 });

    expect(res.status).toBe(403);
  });

  it("allows an admin to create a product", async () => {
    const token = await registerAndGetToken(
      `admin-${Date.now()}@example.com`,
      "ADMIN",
    );

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Admin Item", description: "x", price: 9.99, stock: 5 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Admin Item");
  });
});
