import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { redis } from "../../config/redis";

export async function deepHealth(_req: Request, res: Response) {
  const memory = process.memoryUsage();

  const redisStart = Date.now();
  await redis.ping();
  const redisLatency = Date.now() - redisStart;

  const poolResult: any = await prisma.$queryRawUnsafe(
    `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()`,
  );

  res.json({
    status: "ok",
    memory: {
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      rssMB: Math.round(memory.rss / 1024 / 1024),
    },
    postgres: {
      activeConnections: Number(poolResult[0].count),
    },
    redis: {
      latencyMs: redisLatency,
    },
  });
}
