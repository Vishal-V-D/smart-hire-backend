import { Router } from "express";
import * as ctrl from "../controllers/secureContest.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// All routes require organizer role

// List organizer's secure contests
router.get("/", authenticate, authorize("ORGANIZER"), ctrl.listSecureContests);

// Get single secure contest details
router.get("/:contestId", authenticate, authorize("ORGANIZER"), ctrl.getSecureContest);

// Update secure contest (including proctoring settings)
router.put("/:contestId", authenticate, authorize("ORGANIZER"), ctrl.updateSecureContest);

// Delete secure contest with cascade (deletes all related data)
router.delete("/:contestId", authenticate, authorize("ORGANIZER"), ctrl.deleteSecureContest);

export default router;
