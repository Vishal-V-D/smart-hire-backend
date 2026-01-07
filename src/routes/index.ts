import { Router } from "express";
import authRoutes from "./auth.routes";
import problemRoutes from "./problem.routes";
import contestRoutes from "./contest.routes";
import { health } from "../controllers/health.controller";

const router = Router();

router.get("/health", health);
router.use("/api/auth", authRoutes);
router.use("/api/problems", problemRoutes);
router.use("/api/contests", contestRoutes);

export default router;
