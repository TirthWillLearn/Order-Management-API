import { pool } from "../config/db";

export const findUserByEmail = async (email: string) => {
  const result = await pool.query("Select * from users where email = $1", [
    email,
  ]);
  return result.rows[0];
};

export const createUser = async (
  name: string,
  email: string,
  password: string,
  role: string,
) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [name, email, password, role],
  );
  return result.rows[0];
};
