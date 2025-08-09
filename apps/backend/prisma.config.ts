import 'dotenv/config';
import { defineConfig } from "prisma/config";

export default defineConfig({
  migrations: {
    // Use your existing JS seed script
    seed: "node prisma/seed.js",
  },
});
