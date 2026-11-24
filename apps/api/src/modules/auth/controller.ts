import { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "./schema";
import { register, login } from "./service";

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const token = await register(email, password);
    res.status(201).json({ token });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const token = await login(email, password);
    res.json({ token });
  } catch (err) {
    next(err);
  }
}
