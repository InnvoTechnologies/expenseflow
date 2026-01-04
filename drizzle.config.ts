import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL as string;

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: databaseUrl,
    },
});