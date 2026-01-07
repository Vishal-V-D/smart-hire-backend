import { Request, Response } from "express";

export const health = (req: Request, res: Response) => {
  res.json({ status: "ok", service: "user-contest-service", timestamp: new Date().toISOString() });
};
