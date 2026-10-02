import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.port, () => console.log(`HabitForge API listening on port ${env.port}`));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
