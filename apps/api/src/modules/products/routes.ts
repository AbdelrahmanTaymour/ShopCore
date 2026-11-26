import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as productController from "./controller";

export const productsRouter: Router = Router();

// public reads
productsRouter.get("/search", productController.search);
productsRouter.get("/", productController.list);
productsRouter.get("/:id", productController.get);

// admin-only writes
productsRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  productController.create,
);
productsRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  productController.update,
);
productsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  productController.remove,
);
