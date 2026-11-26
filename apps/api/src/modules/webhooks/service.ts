import { prisma } from "../../config/prisma";
import { emitOrderUpdate } from "../notifications/socket";

interface WebhookPayload {
  eventId: string;
  type: string;
  data?: { orderId?: string; status?: "PAID" | "FAILED" };
}

export async function processEvent(eventId: string, payload: WebhookPayload) {
  let updatedOrder: { id: string; userId: string; status: string } | undefined;

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
        updatedOrder = await tx.order.update({
          where: { id: payload.data.orderId },
          data: { status: payload.data.status },
        });
      }
    });

    // Emit only after the transaction has actually committed,
    // since a rollback would mean this update never happened.
    if (updatedOrder) {
      emitOrderUpdate(updatedOrder.userId, {
        eventId,
        status: updatedOrder.status,
        timestamp: new Date().toISOString(),
      });
    }

    return { duplicate: false };
  } catch (err: any) {
    if (err.code === "P2002") {
      // unique constraint on WebhookEvent.id = we've already processed this event
      return { duplicate: true };
    }
    throw err;
  }
}
