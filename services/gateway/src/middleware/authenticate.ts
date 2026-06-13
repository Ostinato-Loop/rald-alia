import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

/**
 * Gateway-level JWT verification.
 * Verifies Bearer token and injects x-user-id downstream.
 * Public routes (auth) are exempt — call this after mounting public routes.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing Bearer token" } });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
    const userId = payload["sub"] as string;
    // Inject user id so downstream services don't need to re-verify
    req.headers["x-user-id"] = userId;
    next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" } });
  }
}
