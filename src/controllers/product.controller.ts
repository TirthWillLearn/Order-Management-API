import { Request, Response } from "express";
import * as productService from "../services/product.service";

import { AuthRequest } from "../middlewares/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

export const createProduct = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, description, price, stock } = req.body;
    const sellerID = req.user.id;

    const product = await productService.createProduct(
      name,
      description,
      price,
      stock,
      sellerID,
    );

    res.status(201).json({
      success: true,
      data: product,
    });
  },
);

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;

  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;

  const sellerId = req.query.sellerId ? Number(req.query.sellerId) : undefined;

  const products = await productService.getProducts(
    page,
    limit,
    minPrice,
    maxPrice,
    sellerId,
  );

  res.status(200).json({
    success: true,
    data: products,
  });
});

export const sellerDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const sellerId = req.user.id;

    const data = await productService.getSellerDashboard(sellerId);

    res.status(200).json({
      success: true,
      data,
    });
  },
);
