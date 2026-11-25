import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(10),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.url(),
  WEBHOOK_SIGNING_SECRET: z.string().min(10),
  STRIPE_SECRET_KEY: z.string().min(10),
  STRIPE_WEBHOOK_SECRET: z.string().min(10),
});

export const env = envSchema.parse(process.env);
