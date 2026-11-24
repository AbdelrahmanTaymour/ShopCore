import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { productsRouter } from "./modules/products/routes";
import { ordersRouter } from "./modules/orders/routes";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/orders", ordersRouter);

  app.use(errorHandler); // must be last

  return app;
}
