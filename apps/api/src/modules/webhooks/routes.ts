import { Router } from "express";
import { receiveWebhook } from "./controller";

export const webhookRouter: Router = Router();
webhookRouter.post("/", receiveWebhook);
