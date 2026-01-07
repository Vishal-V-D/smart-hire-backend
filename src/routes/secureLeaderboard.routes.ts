import { Router } from "express";
import * as ctrl from "../controllers/secureLeaderboard.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Get leaderboard (authenticated users, visibility depends on settings)
router.get("/:contestId", authenticate, ctrl.getSecureLeaderboard);

// Get config (public - for checking visibility status)
router.get("/:contestId/config", ctrl.getConfig);

// Toggle visibility (organizer only)
router.put("/:contestId/visibility", authenticate, authorize("ORGANIZER"), ctrl.toggleVisibility);

// Update column config (organizer only)
router.put("/:contestId/columns", authenticate, authorize("ORGANIZER"), ctrl.updateColumns);

export default router;
