import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt.util";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("\n🔐 [AUTH] Authenticating request to:", req.method, req.path);
    console.log("🔐 [AUTH] All headers:", JSON.stringify(req.headers, null, 2));

    // 🎫 Only accept Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ [AUTH] Missing or invalid Authorization header");
      console.error("   Received header:", authHeader);
      return res.status(401).json({
        message: "Missing or invalid Authorization header. Format: 'Bearer <token>'",
        details: "Please provide a valid Bearer token in the Authorization header"
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      console.error("❌ [AUTH] No token provided after Bearer");
      return res.status(401).json({ message: "No token provided" });
    }

    console.log("✅ [AUTH] Token extracted, length:", token.length);
    console.log("🔍 [AUTH] Token preview:", token.substring(0, 20) + "...");

    // 🔍 Verify token
    const decoded = verifyJwt(token);
    console.log("✅ [AUTH] Token decoded successfully!");
    console.log("📋 [AUTH] Decoded payload:", JSON.stringify(decoded, null, 2));

    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.error("❌ [AUTH] Token verification failed!");
    console.error("   Error message:", err.message || err);
    console.error("   Full error:", err);
    return res.status(403).json({
      message: "Forbidden: Invalid or expired token",
      error: err.message || "Token verification failed"
    });
  }
};
