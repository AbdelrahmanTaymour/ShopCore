import { prisma } from "../../config/prisma";
import { cacheAside, invalidatePattern } from "../../lib/cache";

export async function listProducts() {
  return cacheAside("products:list", 3600, () => prisma.product.findMany());
}

export async function getProduct(id: string) {
  return cacheAside(`products:${id}`, 3600, () =>
    prisma.product.findUnique({ where: { id } }),
  );
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
}) {
  const product = await prisma.product.create({ data });
  await invalidatePattern("products:*");
  return product;
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
  const updated = await prisma.product.update({ where: { id }, data });
  await invalidatePattern("products:*");
  return updated;
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  await invalidatePattern("products:*");
}
