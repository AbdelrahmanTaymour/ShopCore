import { prisma } from "../../config/prisma";

interface WebhookPayload {
  eventId: string;
  type: string;
  data?: { orderId?: string; status?: "PAID" | "FAILED" };
}

export async function processEvent(eventId: string, payload: WebhookPayload) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({
        data: { id: eventId, status: "PROCESSED" },
      });

      // the actual side effect goes here, inside the same transaction —
      // e.g. tx.order.update(...) based on payload.type / payload.data

      if (
        payload.type === "order.payment_updated" &&
        payload.data?.orderId &&
        payload.data?.status
      ) {
        await tx.order.update({
          where: { id: payload.data.orderId },
          data: { status: payload.data.status },
        });
      }
    });
    return { duplicate: false };
  } catch (err: any) {
    if (err.code === "P2002") {
      // unique constraint on WebhookEvent.id = we've already processed this event
      return { duplicate: true };
    }
    throw err;
  }
}
