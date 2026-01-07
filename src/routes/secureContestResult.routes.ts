import { Router } from "express";
import * as controller from "../controllers/secureContestResult.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// 🔒 Protected Routes (Require Auth)
// Ideally, add checkOrganizer middleware here to ensure only the organizer can edit results.
// For now, relying on auth middleware as requested, assuming frontend/business logic handles permission checks.

router.get("/:id", authenticate, controller.getSecureResult);
router.put("/:id", authenticate, controller.updateSecureResult);
router.delete("/:id", authenticate, controller.deleteSecureResult);

export default router;
