import express, { type Express } from "express";
import { tightHelmet, publicCors, createRateLimiter, RateTier } from '@rald-alia/shared/security';
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import router from "./routes";

const app: Express = express();

app.use(tightHelmet());
app.use(publicCors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(createRateLimiter(RateTier.HIGH));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url?.split("?")[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use("/", router);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

export default app;
