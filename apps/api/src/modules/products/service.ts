import { prisma } from "../../config/prisma";

export async function listProducts() {
  return prisma.product.findMany();
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
}) {
  return prisma.product.create({ data });
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number;
  }>,
) {
  return prisma.product.update({ where: { id }, data });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}
