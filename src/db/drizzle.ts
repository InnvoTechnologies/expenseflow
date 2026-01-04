import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: '.env' });

const db_url = process.env.DATABASE_URL as string

export const db = drizzle(db_url)