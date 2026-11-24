import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as orderController from "./controller";

export const ordersRouter: Router = Router();

ordersRouter.use(requireAuth); // every order route requires login
ordersRouter.post("/checkout", orderController.checkout);
ordersRouter.get("/", orderController.listMine);
