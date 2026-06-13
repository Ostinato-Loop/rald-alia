import "dotenv/config";
import '@rald-alia/observability'; // Must be first — boots OTEL SDK
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port, env: process.env.NODE_ENV }, "ALIA Gateway listening");
});
