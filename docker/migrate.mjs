import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 1,
});
try {
  await migrate(drizzle(pool), { migrationsFolder: "./migrations" });
  console.log("Database migrations completed successfully.");
} finally {
  await pool.end();
}
