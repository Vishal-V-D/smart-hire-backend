
import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt.util";
import { UserRole } from "../entities/user.entity"; // Assuming UserRole is in user.entity or wherever defined

export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("\n🔐 [AUTH] Authenticating request to:", req.method, req.path);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJwt(token);
    (req as any).user = decoded;
    console.log(`   👤 User Role: ${(decoded as any).role}, ID: ${(decoded as any).id}`);
    next();
  } catch (err: any) {
    console.error("❌ [AUTH] Token verification failed:", err.message);
    return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
  }
};

export const checkRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      console.error(`❌ [AUTH] Role mismatch. Required: ${roles}, Found: ${user?.role}`);
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};

// Keep existing authenticate export for backward compatibility if needed
export const authenticate = checkAuth;

import { AppDataSource } from "../config/db";
import { User } from "../entities/user.entity";
import { CompanyStatus } from "../entities/Company.entity";

export const checkCompanyPermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    // 1. Organizers bypass checks (Global Admins)
    if (user.role === UserRole.ORGANIZER) {
      return next();
    }

    // 2. Company Admins Check
    if (user.role === UserRole.ADMIN) {
      try {
        const userRepo = AppDataSource.getRepository(User);
        const userEntity = await userRepo.findOne({
          where: { id: user.id },
          relations: ["company"]
        });

        if (!userEntity || !userEntity.company) {
          return res.status(403).json({ message: "Access denied. No company associated." });
        }

        if (userEntity.company.status !== CompanyStatus.APPROVED) {
          return res.status(403).json({ message: "Access denied. Company not approved." });
        }

        const perms = userEntity.company.permissions || {};
        // Check specific permission
        if ((perms as any)[requiredPermission]) {
          return next();
        }

        return res.status(403).json({ message: `Access denied. Requires '${requiredPermission}' permission.` });

      } catch (error) {
        console.error("Permission Check Error", error);
        return res.status(500).json({ message: "Server error checking permissions" });
      }
    }

    return res.status(403).json({ message: "Forbidden: Insufficient role" });
  };
};
