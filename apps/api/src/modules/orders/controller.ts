import { Response, NextFunction } from "express";
import { AuthedRequest } from "../../middleware/auth";
import { checkoutSchema } from "./schema";
import * as orderService from "./service";

export async function checkout(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { items } = checkoutSchema.parse(req.body);
    const order = await orderService.checkout(req.user!.id, items);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

export async function listMine(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const orders = await orderService.listUserOrders(req.user!.id);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}
