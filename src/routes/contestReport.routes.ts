import { Router } from "express";
import * as reportCtrl from "../controllers/contestReport.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Organizer routes
router.post("/:contestId/users/:userId/generate-report", authenticate, authorize("ORGANIZER"), reportCtrl.generateReport);
router.get("/:contestId/users/:userId/report", authenticate, authorize("ORGANIZER"), reportCtrl.getReport);
router.post("/:contestId/generate-all-reports", authenticate, authorize("ORGANIZER"), reportCtrl.generateAllReports);

// User route (can view own report)
router.get("/:contestId/my-report", authenticate, async (req, res) => {
    req.params.userId = (req as any).user.id;
    await reportCtrl.getReport(req, res);
});

export default router;
