import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";

export async function register(email: string, password: string) {
  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, password: hashed },
    });
    return signToken(user.id, user.role);
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED");
    }
    throw err;
  }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  return signToken(user.id, user.role);
}

function signToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, { expiresIn: "1d" });
}
