import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

export const requireSeller = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user || req.user.role !== "seller") {
    return res.status(403).json({ message: "Seller access required" });
  }
  next();
};
