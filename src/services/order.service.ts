import { pool } from "../config/db";
import { AppError } from "../utils/AppError";

interface OrderItemInput {
  product_id: number;
  quantity: number;
}

export const createOrderWithTransaction = async (
  buyerId: number,
  items: OrderItemInput[],
) => {
  // Prevent empty orders
  if (!items || items.length === 0) {
    throw new AppError("Order must contain at least one item", 400);
  }

  const client = await pool.connect();

  try {
    // Start DB transaction
    await client.query("BEGIN");

    let totalAmount = 0;

    // Store fetched product data to avoid querying DB twice
    const productMap = new Map<number, { price: number; stock: number }>();

    // Used to detect duplicate products in order
    const productIds = new Set<number>();

    /* ----------------------------------------
       Step 1: Validate order items
       ---------------------------------------- */

    for (const item of items) {
      // Quantity validation
      if (item.quantity <= 0) {
        throw new AppError("Quantity must be greater than 0", 400);
      }

      // Prevent duplicate products in same order
      if (productIds.has(item.product_id)) {
        throw new AppError("Duplicate product in order", 400);
      }

      productIds.add(item.product_id);

      // Lock product row to prevent race conditions
      const productResult = await client.query(
        "SELECT price, stock FROM products WHERE id = $1 FOR UPDATE",
        [item.product_id],
      );

      // Product must exist
      if (productResult.rows.length === 0) {
        throw new AppError("Product not found", 404);
      }

      const product = productResult.rows[0];

      // Save product in map to reuse later
      productMap.set(item.product_id, product);

      // Check if enough stock exists
      if (product.stock < item.quantity) {
        throw new AppError("Insufficient stock", 400);
      }

      // Calculate total order amount
      totalAmount += product.price * item.quantity;
    }

    /* ----------------------------------------
       Step 2: Create order
       ---------------------------------------- */

    const orderResult = await client.query(
      `INSERT INTO orders (buyer_id, total_amount)
       VALUES ($1, $2)
       RETURNING id`,
      [buyerId, totalAmount],
    );

    const orderId = orderResult.rows[0].id;

    /* ----------------------------------------
       Step 3: Insert order items + update stock
       ---------------------------------------- */

    for (const item of items) {
      // Get product data safely from map
      const product = productMap.get(item.product_id);

      // Extra safety check (TypeScript safety)
      if (!product) {
        throw new AppError("Product lookup failed", 500);
      }

      const price = product.price;

      // Save order item snapshot
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, price],
      );

      // Update product stock safely
      const updateResult = await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2 AND stock >= $1`,
        [item.quantity, item.product_id],
      );

      // If no row updated → stock changed concurrently
      if (updateResult.rowCount === 0) {
        throw new AppError("Stock update failed", 400);
      }
    }

    /* ----------------------------------------
       Step 4: Commit transaction
       ---------------------------------------- */

    await client.query("COMMIT");

    return orderId;
  } catch (err) {
    // Rollback transaction on error
    await client.query("ROLLBACK");

    throw err;
  } finally {
    // Always release DB client
    client.release();
  }
};

export const updateOrderStatus = async (
  orderId: number,
  newStatus: string,
  userId: number,
  userRole: string,
) => {
  const allowedStatuses = [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
  ];
  if (!allowedStatuses.includes(newStatus)) {
    throw new AppError("Invalid order status", 400);
  }

  const result = await pool.query(
    "SELECT buyer_id, status FROM orders WHERE id = $1",
    [orderId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Order not found", 404);
  }

  const order = result.rows[0];

  // Cancel rule
  if (newStatus === "cancelled") {
    if (order.buyer_id !== userId) {
      throw new AppError("Only buyer can cancel this order", 403);
    }

    if (order.status !== "pending") {
      throw new AppError("Cannot cancel after confirmation", 400);
    }
  }

  // Seller update rule
  if (newStatus === "confirmed" || newStatus === "shipped") {
    if (userRole !== "seller") {
      throw new AppError("Only seller can update this status", 403);
    }
  }

  // Prevent skipping confirmation
  if (order.status === "pending" && newStatus === "shipped") {
    throw new AppError("Order must be confirmed before shipping", 400);
  }

  const updateResult = await pool.query(
    "UPDATE orders SET status = $1 WHERE id = $2",
    [newStatus, orderId],
  );

  if (updateResult.rowCount === 0) {
    throw new AppError("Order update failed", 500);
  }

  return "Status updated";
};

export const getOrders = async (
  userId: number,
  role: string,
  page: number,
  limit: number,
  status?: string,
) => {
  const offset = (page - 1) * limit;

  const allowedStatuses = [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
  ];
  if (status && !allowedStatuses.includes(status)) {
    throw new AppError("Invalid order status filter", 400);
  }

  let query = `
    SELECT
      o.id,
      o.total_amount,
      o.status,
      o.created_at,
      u.name AS buyer_name
    FROM orders o
    JOIN users u ON o.buyer_id = u.id
  `;

  const values: any[] = [];
  const conditions: string[] = [];

  // Buyer should only see their orders
  if (role === "buyer") {
    values.push(userId);
    conditions.push(`o.buyer_id = $${values.length}`);
  }

  // Status filtering
  if (status) {
    values.push(status);
    conditions.push(`o.status = $${values.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  // Correct SQL order
  query += " ORDER BY o.created_at DESC";

  values.push(limit);
  query += ` LIMIT $${values.length}`;

  values.push(offset);
  query += ` OFFSET $${values.length}`;

  const result = await pool.query(query, values);

  return result.rows;
};

export const getOrderDetails = async (buyerId: number) => {
  const result = await pool.query(
    `
    SELECT
      o.id AS order_id,
      o.status,
      o.total_amount,
      oi.product_id,
      oi.quantity,
      oi.price_at_time
    FROM orders o
    JOIN order_items oi
      ON o.id = oi.order_id
    WHERE o.buyer_id = $1
    ORDER BY o.created_at DESC
    `,
    [buyerId],
  );

  const ordersMap = new Map();

  for (const row of result.rows) {
    if (!ordersMap.has(row.order_id)) {
      ordersMap.set(row.order_id, {
        order_id: row.order_id,
        status: row.status,
        total_amount: row.total_amount,
        items: [],
      });
    }

    ordersMap.get(row.order_id).items.push({
      product_id: row.product_id,
      quantity: row.quantity,
      price_at_time: row.price_at_time,
    });
  }

  return Array.from(ordersMap.values());
};
