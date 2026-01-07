import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as submitAllCtrl from "../controllers/contestSubmitAll.controller";

const router = Router();

/**
 * Submit all solutions and finish contest
 * POST /api/contests/:contestId/submit-all
 */
router.post("/:contestId/submit-all", authenticate, submitAllCtrl.submitAllAndFinish);

/**
 * Get timer status (remaining time for this user)
 * GET /api/contests/:contestId/timer
 */
router.get("/:contestId/timer", authenticate, submitAllCtrl.getTimerStatus);

export default router;
