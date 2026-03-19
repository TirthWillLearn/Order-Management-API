jest.mock("../../config/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
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
const mockConnect = pool.connect as jest.Mock;
const JWT_SECRET = "test-secret";

const buyerToken = (id = 1) => jwt.sign({ id, role: "buyer" }, JWT_SECRET);
const sellerToken = (id = 5) => jwt.sign({ id, role: "seller" }, JWT_SECRET);

const makeMockClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  mockConnect.mockResolvedValue(client);
  return client;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
});

// ─── POST /orders ─────────────────────────────────────────────────────────────

describe("POST /orders", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).post("/orders").send({ items: [] });
    expect(res.status).toBe(401);
  });

  it("returns 400 when items is empty", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${buyerToken()}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when item has quantity = 0", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ price: 10, stock: 5 }] }); // product

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${buyerToken()}`)
      .send({ items: [{ product_id: 1, quantity: 0 }] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when product not found", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined)     // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // product → not found

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${buyerToken()}`)
      .send({ items: [{ product_id: 99, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("returns 201 on successful order creation", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined)                         // BEGIN
      .mockResolvedValueOnce({ rows: [{ price: 20, stock: 10 }] }) // product
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })             // INSERT order
      .mockResolvedValueOnce(undefined)                         // INSERT order_item
      .mockResolvedValueOnce({ rowCount: 1 })                   // UPDATE stock
      .mockResolvedValueOnce(undefined);                        // COMMIT

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${buyerToken()}`)
      .send({ items: [{ product_id: 1, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBe(7);
  });
});

// ─── GET /orders ──────────────────────────────────────────────────────────────

describe("GET /orders", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });

  it("returns 200 with orders list for buyer", async () => {
    const rows = [{ id: 1, status: "pending", total_amount: "50.00" }];
    mockQuery.mockResolvedValueOnce({ rows });

    const res = await request(app)
      .get("/orders")
      .set("Authorization", `Bearer ${buyerToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(rows);
  });

  it("returns 400 for invalid status filter", async () => {
    const res = await request(app)
      .get("/orders?status=garbage")
      .set("Authorization", `Bearer ${buyerToken()}`);
    expect(res.status).toBe(400);
  });
});

// ─── GET /orders/my-orders ────────────────────────────────────────────────────

describe("GET /orders/my-orders", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/orders/my-orders");
    expect(res.status).toBe(401);
  });

  it("returns 200 with grouped order details", async () => {
    const rows = [
      { order_id: 1, status: "pending", total_amount: "30.00", product_id: 10, quantity: 3, price_at_time: "10.00" },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const res = await request(app)
      .get("/orders/my-orders")
      .set("Authorization", `Bearer ${buyerToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── PATCH /orders/:id/status ─────────────────────────────────────────────────

describe("PATCH /orders/:id/status", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).patch("/orders/1/status").send({ status: "confirmed" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await request(app)
      .patch("/orders/1/status")
      .set("Authorization", `Bearer ${sellerToken()}`)
      .send({ status: "bogus" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch("/orders/999/status")
      .set("Authorization", `Bearer ${sellerToken()}`)
      .send({ status: "confirmed" });
    expect(res.status).toBe(404);
  });

  it("returns 200 when seller confirms order", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ buyer_id: 1, status: "pending" }] }) // SELECT
      .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

    const res = await request(app)
      .patch("/orders/1/status")
      .set("Authorization", `Bearer ${sellerToken()}`)
      .send({ status: "confirmed" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Status updated");
  });

  it("returns 403 when buyer tries to confirm", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ buyer_id: 1, status: "pending" }] });

    const res = await request(app)
      .patch("/orders/1/status")
      .set("Authorization", `Bearer ${buyerToken()}`)
      .send({ status: "confirmed" });
    expect(res.status).toBe(403);
  });
});
