import { Request, Response } from "express";
import Stripe from "stripe";
import { env } from "../../config/env";
import { processEvent } from "./service";
import { logger } from "../../lib/logger";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function receiveStripeWebhook(req: Request, res: Response) {
  const signature = req.header("stripe-signature");
  if (!signature) return res.status(400).json({ error: "MISSING_SIGNATURE" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, "stripe webhook signature verification failed");
    return res.status(400).json({ error: "INVALID_SIGNATURE" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      const result = await processEvent(event.id, {
        eventId: event.id,
        type: "order.payment_updated",
        data: { orderId, status: "PAID" },
      });
      return res
        .status(200)
        .json({ received: true, duplicate: result.duplicate });
    }
  }

  res.status(200).json({ received: true });
}
