import { prisma } from "../../config/prisma";
import { cacheAside, invalidatePattern } from "../../lib/cache";
import { embedText } from "../../lib/embeddings";

export async function listProducts() {
  return cacheAside("products:list", 3600, () => prisma.product.findMany());
}

export async function getProduct(id: string) {
  return cacheAside(`products:${id}`, 3600, () =>
    prisma.product.findUnique({ where: { id } }),
  );
}

async function setEmbedding(
  productId: string,
  name: string,
  description: string,
) {
  const vector = await embedText(`${name} ${description}`);
  await prisma.$executeRawUnsafe(
    `UPDATE "Product" SET embedding = $1::vector WHERE id = $2`,
    `[${vector.join(",")}]`,
    productId,
  );
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  stock: number;
}) {
  const product = await prisma.product.create({ data });
  await setEmbedding(product.id, data.name, data.description);
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
  // Regenerate the embedding whenever text that affects meaning changes —
  // a price/stock-only update doesn't need a new embedding, but we keep
  // this simple and just regenerate whenever name or description is touched.
  if (data.name !== undefined || data.description !== undefined) {
    await setEmbedding(updated.id, updated.name, updated.description);
  }
  await invalidatePattern("products:*");
  return updated;
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  await invalidatePattern("products:*");
}

export async function searchProducts(query: string) {
  return cacheAside(`search:${query}`, 300, async () => {
    const vector = await embedText(query);
    const vectorLiteral = `[${vector.join(",")}]`;

    return prisma.$queryRawUnsafe(
      `SELECT id, name, description, price, stock,
              1 - (embedding <=> $1::vector) AS similarity
       FROM "Product"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 10`,
      vectorLiteral,
    );
  });
}
