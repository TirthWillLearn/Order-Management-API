jest.mock("../../config/db", () => ({ pool: { query: jest.fn() } }));
jest.mock("@sentry/node", () => ({
  init: jest.fn(),
  expressIntegration: jest.fn(() => ({})),
  setupExpressErrorHandler: jest.fn((_app: any) => {}),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db";
import app from "../../app";

const mockQuery = pool.query as jest.Mock;
const JWT_SECRET = "test-secret";

const sellerToken = () =>
  jwt.sign({ id: 10, role: "seller" }, JWT_SECRET);

const buyerToken = () =>
  jwt.sign({ id: 20, role: "buyer" }, JWT_SECRET);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
});

// ─── GET /products ────────────────────────────────────────────────────────────

describe("GET /products", () => {
  it("returns 200 with product list", async () => {
    const rows = [{ id: 1, name: "Widget", price: 9.99, stock: 5, seller_name: "Alice" }];
    mockQuery.mockResolvedValueOnce({ rows });

    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(rows);
  });

  it("returns 400 when minPrice > maxPrice", async () => {
    const res = await request(app).get("/products?minPrice=100&maxPrice=10");
    expect(res.status).toBe(400);
  });

  it("supports pagination query params", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/products?page=2&limit=5");
    expect(res.status).toBe(200);
    const [query, values] = mockQuery.mock.calls[0];
    expect(values).toContain(5);  // limit
    expect(values).toContain(5);  // offset = (2-1)*5
  });
});

// ─── POST /products ───────────────────────────────────────────────────────────

describe("POST /products", () => {
  const validBody = { name: "Widget", description: "Nice", price: 9.99, stock: 10 };

  it("returns 401 without a token", async () => {
    const res = await request(app).post("/products").send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as buyer", async () => {
    const res = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${buyerToken()}`)
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("returns 201 and new product when authenticated as seller", async () => {
    const created = { id: 1, ...validBody, seller_id: 10 };
    mockQuery.mockResolvedValueOnce({ rows: [created] });

    const res = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${sellerToken()}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: "Widget" });
  });
});

// ─── GET /products/dashboard ──────────────────────────────────────────────────

describe("GET /products/dashboard", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/products/dashboard");
    expect(res.status).toBe(401);
  });

  it("returns 403 for buyer", async () => {
    const res = await request(app)
      .get("/products/dashboard")
      .set("Authorization", `Bearer ${buyerToken()}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 with dashboard data for seller", async () => {
    const dashboardRow = { total_revenue: "500.00", total_orders: "10" };
    mockQuery.mockResolvedValueOnce({ rows: [dashboardRow] });

    const res = await request(app)
      .get("/products/dashboard")
      .set("Authorization", `Bearer ${sellerToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(dashboardRow);
  });
});
