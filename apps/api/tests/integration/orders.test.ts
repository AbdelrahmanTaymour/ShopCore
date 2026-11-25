import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { redis } from "../../src/config/redis";

// Checkout calls out to Stripe to create a real Checkout Session. We don't
// want integration tests hitting the network or depending on a real Stripe
// key, so replace the SDK with a fake that returns a fixed session URL.
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest
          .fn()
          .mockResolvedValue({ url: "https://checkout.stripe.com/test-session" }),
      },
    },
  }));
});

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

async function getUserToken() {
  const email = `buyer-${Date.now()}@example.com`;
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "password123" });
  return res.body.token as string;
}

async function createTestProduct(stock: number) {
  return prisma.product.create({
    data: { name: "Checkout Test Item", description: "x", price: 10, stock },
  });
}

describe("Orders — atomic checkout", () => {
  it("decrements stock and creates an order on success", async () => {
    const token = await getUserToken();
    const product = await createTestProduct(10);

    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(30);

    const updated = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(updated?.stock).toBe(7);
  });

  it("rolls back completely when stock is insufficient", async () => {
    const token = await getUserToken();
    const product = await createTestProduct(2);

    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 999 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("OUT_OF_STOCK");

    const unchanged = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(unchanged?.stock).toBe(2); // proves no partial decrement happened
  });

  it("rejects checkout without auth", async () => {
    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .send({
        items: [
          { productId: "00000000-0000-0000-0000-000000000000", quantity: 1 },
        ],
      });

    expect(res.status).toBe(401);
  });
});
