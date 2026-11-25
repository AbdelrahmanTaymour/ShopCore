import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { globalRateLimit } from "./middleware/rateLimit";
import { authRouter } from "./modules/auth/routes";
import { productsRouter } from "./modules/products/routes";
import { ordersRouter } from "./modules/orders/routes";
import { webhookRouter } from "./modules/webhooks/routes";
import { errorHandler } from "./middleware/errorHandler";
import { receiveStripeWebhook } from "./modules/webhooks/stripeController";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(globalRateLimit);
  app.use(cors());

  app.use(
    "/api/v1/webhooks",
    express.raw({ type: "application/json" }),
    webhookRouter,
  );

  app.post(
    "/api/v1/webhooks/stripe",
    express.raw({ type: "application/json" }),
    receiveStripeWebhook,
  );

  app.use(
    "/api/v1/webhooks",
    express.raw({ type: "application/json" }),
    webhookRouter,
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/orders", ordersRouter);

  app.use(errorHandler);

  return app;
}
