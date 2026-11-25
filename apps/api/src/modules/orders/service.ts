import { prisma } from "../../config/prisma";
import { AppError } from "../../middleware/errorHandler";
import { env } from "../../config/env";
import Stripe from "stripe";

interface CheckoutItem {
  productId: string;
  quantity: number;
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function createCheckoutSession(orderId: string, total: number) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `ShopCore Order ${orderId}`, tax_code: "txcd_99999999" },
          unit_amount: Math.round(total * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    success_url: "http://localhost:5173/order-success",
    cancel_url: "http://localhost:5173/order-cancelled",
    metadata: { orderId }, // ties the Stripe session back to our order
    // Our test Stripe account has Managed Payments on by default, which requires
    // an eligible tax_code per product. We are not modeling tax in ShopCore,
    // so disable it for this session.
    managed_payments: { enabled: false },
  } as any);
  return session.url;
}

export async function checkout(userId: string, items: CheckoutItem[]) {
  return prisma.$transaction(async (tx) => {
    let total = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND");
      if (product.stock < item.quantity)
        throw new AppError(409, "OUT_OF_STOCK");

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });

      total += product.price * item.quantity;
      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    return tx.order.create({
      data: {
        userId,
        total,
        // status defaults to PENDING (see schema.prisma); the Stripe webhook
        // flips it to PAID once payment is actually confirmed.
        items: { create: orderItemsData },
      },
      include: { items: true },
    });
  });
}

export async function listUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}
