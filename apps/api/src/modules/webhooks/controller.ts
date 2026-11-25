import { Request, Response } from "express";
import { verifySignature } from "../../lib/hmac";
import { processEvent } from "./service";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

export async function receiveWebhook(req: Request, res: Response) {
  const signature = req.header("X-Signature");
  const timestamp = req.header("X-Timestamp");
  const rawBody = req.body as Buffer; // raw, because of express.raw() in app.ts

  if (!signature || !timestamp) {
    return res.status(400).json({ error: "MISSING_HEADERS" });
  }

  const check = verifySignature(
    rawBody,
    timestamp,
    signature,
    env.WEBHOOK_SIGNING_SECRET,
  );
  if (!check.valid) {
    logger.warn({ reason: check.reason }, "webhook rejected");
    return res.status(400).json({ error: check.reason });
  }

  const payload = JSON.parse(rawBody.toString());
  const result = await processEvent(payload.eventId, payload);

  // duplicates still get a 2xx — the sender shouldn't keep retrying forever
  return res.status(200).json({ received: true, duplicate: result.duplicate });
}
