import { prisma } from "../../config/prisma";
import { AppError } from "../../middleware/errorHandler";

interface CheckoutItem {
  productId: string;
  quantity: number;
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
        status: "PAID",
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
