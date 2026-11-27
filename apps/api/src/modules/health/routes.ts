import { Router } from "express";
import { deepHealth } from "./controller";

export const healthRouter: Router = Router();

healthRouter.get("/deep", deepHealth);
