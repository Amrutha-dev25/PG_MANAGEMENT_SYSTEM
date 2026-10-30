// Usage: node scripts/setup-mongo.mjs [--reset] [--no-seed]
import { loadEnv, requireEnv } from "./lib-env.mjs";
import { setupMongo, demoPasswords } from "../database/mongodb/setup.mjs";

loadEnv();
requireEnv(["MONGODB_URI", "MONGODB_DB"]);
console.log(`Setting up MongoDB database ${process.env.MONGODB_DB} ...`);
await setupMongo({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB,
  reset: process.argv.includes("--reset"),
  seed: !process.argv.includes("--no-seed"),
  passwords: demoPasswords(),
});
console.log("MongoDB setup complete.");
