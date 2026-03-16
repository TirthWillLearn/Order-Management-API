import { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import {
  createOrderWithTransaction,
  updateOrderStatus,
  getOrders,
  getOrderDetails,
} from "../services/order.service";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

export const createOrder = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const buyerId = req.user!.id;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError("Items must be a non-empty array", 400);
    }

    for (const item of items) {
      if (!item.product_id || !item.quantity) {
        throw new AppError("Invalid order item", 400);
      }

      if (item.quantity <= 0) {
        throw new AppError("Quantity must be greater than 0", 400);
      }
    }

    const orderId = await createOrderWithTransaction(buyerId, items);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: { orderId },
    });
  },
);

export const changeOrderStatus = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const message = await updateOrderStatus(
      orderId,
      status,
      req.user.id,
      req.user.role,
    );

    res.status(200).json({
      success: true,
      message,
    });
  },
);

export const listOrders = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status as string | undefined;

    const orders = await getOrders(
      req.user.id,
      req.user.role,
      page,
      limit,
      status,
    );

    res.json({
      success: true,
      data: orders,
    });
  },
);

export const getMyOrders = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const buyerId = req.user!.id;

    const orders = await getOrderDetails(buyerId);

    res.json({
      success: true,
      data: orders,
    });
  },
);
