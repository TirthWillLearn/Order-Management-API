import { pool } from "../config/db";
import { AppError } from "../utils/AppError";

export const createProduct = async (
  name: string,
  description: string,
  price: number,
  stock: number,
  sellerId: number,
) => {
  const result = await pool.query(
    `INSERT INTO products (name, description, price, stock, seller_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, price, stock, seller_id`,
    [name, description, price, stock, sellerId],
  );

  return result.rows[0];
};

export const getSellerDashboard = async (sellerId: number) => {
  const result = await pool.query(
    `
    SELECT 
      COALESCE(SUM(oi.quantity * oi.price_at_time), 0) AS total_revenue,
      COUNT(DISTINCT o.id) AS total_orders
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE p.seller_id = $1
      AND o.status = 'delivered'
    `,
    [sellerId],
  );

  return result.rows[0];
};

export const getProducts = async (
  page: number,
  limit: number,
  minPrice?: number,
  maxPrice?: number,
  sellerId?: number,
) => {
  const offset = (page - 1) * limit;

  // Validate price filters
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new AppError("minPrice cannot be greater than maxPrice", 400);
  }

  let query = `
    SELECT 
      p.id,
      p.name,
      p.price,
      p.stock,
      u.name AS seller_name
    FROM products p
    JOIN users u ON p.seller_id = u.id
  `;

  const conditions: string[] = [];
  const values: (number | string)[] = [];

  if (minPrice !== undefined) {
    values.push(minPrice);
    conditions.push(`p.price >= $${values.length}`);
  }

  if (maxPrice !== undefined) {
    values.push(maxPrice);
    conditions.push(`p.price <= $${values.length}`);
  }

  if (sellerId !== undefined) {
    values.push(sellerId);
    conditions.push(`p.seller_id = $${values.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.created_at DESC";

  values.push(limit);
  query += ` LIMIT $${values.length}`;

  values.push(offset);
  query += ` OFFSET $${values.length}`;

  const result = await pool.query(query, values);

  return result.rows;
};
