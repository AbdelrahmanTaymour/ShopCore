import { Response, NextFunction } from "express";
import { AuthedRequest } from "../../middleware/auth";
import { createProductSchema, updateProductSchema } from "./schema";
import * as productService from "./service";
import { AppError } from "../../middleware/errorHandler";

export async function list(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(await productService.listProducts());
  } catch (err) {
    next(err);
  }
}

export async function search(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const q = String(req.query.q ?? "");
    const results = await productService.searchProducts(q);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function get(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id as string;
    const product = await productService.getProduct(id);
    if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND");
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await productService.createProduct(data);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function update(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id as string;
    const data = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct(id, data);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id as string;
    await productService.deleteProduct(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
