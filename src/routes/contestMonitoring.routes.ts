import { Router } from "express";
import * as monitorCtrl from "../controllers/contestMonitoring.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Monitoring routes
router.post("/:contestId/violations", authenticate, monitorCtrl.reportViolation);
router.post(
    "/:contestId/monitoring-photos",
    authenticate,
    upload.single("photo"),
    monitorCtrl.uploadMonitoringPhoto
);

router.get("/:contestId/users/:userId/violations", authenticate, authorize("ORGANIZER"), monitorCtrl.getUserViolations);
router.get("/:contestId/users/:userId/flags", authenticate, authorize("ORGANIZER"), monitorCtrl.getFlags);

export default router;
