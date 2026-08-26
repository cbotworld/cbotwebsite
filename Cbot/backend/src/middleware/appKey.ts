import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

export function requireAppKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("X-App-Key");
  if (!config.appApiKey || key !== config.appApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
