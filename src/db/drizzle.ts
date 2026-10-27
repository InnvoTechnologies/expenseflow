import { Pool, types as pgTypes } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env" });

const db_url = process.env.DATABASE_URL as string;

const runtime = globalThis as typeof globalThis & { expenseFlowPool?: Pool };
export const pool =
  runtime.expenseFlowPool ??
  new Pool({
    connectionString: db_url,
    connectionTimeoutMillis: 8000,
    max: 10,
    options: "-c timezone=UTC",
    types: {
      getTypeParser(oid, format) {
        // Existing finance timestamps are stored as UTC without a timezone.
        // Raw pg otherwise interprets them in the host machine's timezone.
        if (oid === 1114 && format !== "binary")
          return (value: string) => new Date(value.replace(" ", "T") + "Z");
        return pgTypes.getTypeParser(oid, format);
      },
    },
  });
if (process.env.NODE_ENV !== "production") runtime.expenseFlowPool = pool;
export const db = drizzle(pool);
