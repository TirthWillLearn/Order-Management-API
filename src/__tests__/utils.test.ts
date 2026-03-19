import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { Request, Response, NextFunction } from "express";

// ─── AppError ────────────────────────────────────────────────────────────────

describe("AppError", () => {
  it("sets message and statusCode", () => {
    const err = new AppError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
  });

  it("is an instance of Error", () => {
    const err = new AppError("Bad request", 400);
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── asyncHandler ─────────────────────────────────────────────────────────────

describe("asyncHandler", () => {
  const mockReq = {} as Request;
  const mockRes = {} as Response;

  it("calls the handler function", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(fn);
    const next: NextFunction = jest.fn();
    await wrapped(mockReq, mockRes, next);
    expect(fn).toHaveBeenCalledWith(mockReq, mockRes, next);
  });

  it("calls next with error when handler throws", async () => {
    const error = new Error("boom");
    const fn = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(fn);
    const next: NextFunction = jest.fn();
    await wrapped(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
