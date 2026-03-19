import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";

// ─── Mock Sentry ──────────────────────────────────────────────────────────────
jest.mock("@sentry/node", () => ({
  setUser: jest.fn(),
  captureException: jest.fn(),
  init: jest.fn(),
  expressIntegration: jest.fn(() => ({})),
  setupExpressErrorHandler: jest.fn(),
}));

// ─── authenticate ────────────────────────────────────────────────────────────

describe("authenticate middleware", () => {
  const JWT_SECRET = "test-secret";

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  // Re-require after env is set so JWT_SECRET is picked up
  const getMiddleware = () =>
    require("../middlewares/authMiddleware").authenticate;

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it("returns 401 when no Authorization header", () => {
    const req: any = { headers: {} };
    const res = makeRes();
    const next: NextFunction = jest.fn();
    getMiddleware()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
  });

  it("returns 401 for an invalid token", () => {
    const req: any = { headers: { authorization: "Bearer bad.token.here" } };
    const res = makeRes();
    const next: NextFunction = jest.fn();
    getMiddleware()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
  });

  it("calls next and sets req.user for a valid token", () => {
    const payload = { id: 1, role: "buyer" };
    const token = jwt.sign(payload, JWT_SECRET);
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next: NextFunction = jest.fn();
    getMiddleware()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 1, role: "buyer" });
  });
});

// ─── requireSeller ────────────────────────────────────────────────────────────

describe("requireSeller middleware", () => {
  const { requireSeller } = require("../middlewares/role.middleware");

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it("returns 403 when user is a buyer", () => {
    const req: any = { user: { role: "buyer" } };
    const res = makeRes();
    const next: NextFunction = jest.fn();
    requireSeller(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when req.user is missing", () => {
    const req: any = {};
    const res = makeRes();
    const next: NextFunction = jest.fn();
    requireSeller(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("calls next for a seller", () => {
    const req: any = { user: { role: "seller" } };
    const res = makeRes();
    const next: NextFunction = jest.fn();
    requireSeller(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe("errorHandler middleware", () => {
  const { errorHandler } = require("../middlewares/error.middleware");

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it("responds with AppError statusCode and message", () => {
    const err = new AppError("Forbidden", 403);
    const res = makeRes();
    errorHandler(err, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Forbidden" });
  });

  it("responds 500 for unknown errors", () => {
    const err = new Error("unexpected");
    const res = makeRes();
    errorHandler(err, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error",
    });
  });
});

// ─── validate middleware ──────────────────────────────────────────────────────

// express-validator exports are non-configurable, so we mock the whole module
jest.mock("express-validator", () => ({
  ...jest.requireActual("express-validator"),
  validationResult: jest.fn(),
}));

describe("validate middleware", () => {
  const { validate } = require("../middlewares/validate.middleware");
  const { validationResult } = require("express-validator") as {
    validationResult: jest.Mock;
  };

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it("calls next when no validation errors", () => {
    validationResult.mockReturnValueOnce({ isEmpty: () => true, array: () => [] });

    const req: any = {};
    const res = makeRes();
    const next: NextFunction = jest.fn();
    validate(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 400 when validation errors exist", () => {
    validationResult.mockReturnValueOnce({
      isEmpty: () => false,
      array: () => [{ msg: "Name is required" }],
    });

    const req: any = {};
    const res = makeRes();
    const next: NextFunction = jest.fn();
    validate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: [{ msg: "Name is required" }],
    });
  });
});
