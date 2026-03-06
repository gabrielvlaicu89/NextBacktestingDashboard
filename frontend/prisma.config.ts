import path from "path";
import { config } from "dotenv";

// Load .env.local so Prisma CLI picks up the same variables as Next.js
config({ path: path.resolve(__dirname, ".env.local") });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // DATABASE_URL  — pooled connection (runtime)
    url: env("DATABASE_URL"),
    // DIRECT_URL    — direct connection (migrations bypass PgBouncer)
    directUrl: env("DIRECT_URL"),
  },
});
