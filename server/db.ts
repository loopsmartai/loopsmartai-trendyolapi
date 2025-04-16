import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from "dotenv";

// Load environment variables from .env file if present
dotenv.config();

neonConfig.webSocketConstructor = ws;

// Function to provision database if needed
async function provisionDatabaseIfNeeded() {
  if (!process.env.DATABASE_URL) {
    console.log("Database URL not found, attempting to provision...");
    try {
      // This will throw an error that triggers the create_postgresql_database_tool
      throw new Error(
        "Database provisioning required. Please run 'create_postgresql_database_tool' in your Replit console.",
      );
    } catch (error) {
      console.error("Failed to provision database:", error);
      throw error;
    }
  }
}

// Initialize database with retries
async function initializeDatabase() {
  //await provisionDatabaseIfNeeded();

  let retries = 5;
  while (retries > 0) {
    try {
      const pool = new Pool({
        connectionString:
          "postgresql://neondb_owner:npg_JuTXncihF0B2@ep-cool-fire-a6y2d4e3.us-west-2.aws.neon.tech/neondb?sslmode=require", //process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });
      console.log("Successfully connected to the database");
      return drizzle({ client: pool, schema });
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error(
          "Failed to connect to database after multiple attempts:",
          error,
        );
        throw error;
      }
      console.log(
        `Failed to connect, retrying... (${retries} attempts remaining)`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// Create a database instance
let db: ReturnType<typeof drizzle>;

// Initialize the database
initializeDatabase()
  .then((initializedDb) => {
    if (!initializedDb) {
      throw new Error("Database initialization failed - returned undefined");
    }
    db = initializedDb;
    console.log("Database initialized successfully");
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1); // Exit if database initialization fails
  });

// Export the database instance
export { db };
