import { Router } from "express";
import * as adminCtrl from "../controllers/contestAdmin.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Apply middleware per-route to avoid blocking other routes
router.get("/:contestId/admin/participants", authenticate, authorize("ORGANIZER"), adminCtrl.getParticipants);
router.get("/:contestId/admin/violations", authenticate, authorize("ORGANIZER"), adminCtrl.getViolations);
router.get("/:contestId/admin/statistics", authenticate, authorize("ORGANIZER"), adminCtrl.getStatistics);
router.get("/:contestId/admin/invited-users", authenticate, authorize("ORGANIZER"), adminCtrl.getInvitedUsers);
router.get("/:contestId/admin/dashboard", authenticate, authorize("ORGANIZER"), adminCtrl.getDashboardData);
router.get("/:contestId/admin/session-stats", authenticate, authorize("ORGANIZER"), adminCtrl.getSessionStatistics);
router.get("/:contestId/admin/unified-participants", authenticate, authorize("ORGANIZER"), adminCtrl.getContestParticipants);
router.get("/:contestId/admin/results", authenticate, authorize("ORGANIZER"), adminCtrl.getSecureContestResults);

export default router;

