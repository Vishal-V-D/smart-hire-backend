import { Router } from "express";
import * as reportController from "../controllers/assessmentReport.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All report routes require authentication
router.use(authenticate);

/**
 * 📊 Get comprehensive assessment report (all participants)
 * GET /api/admin/assessments/:assessmentId/reports
 * Query: page, limit, status, sortBy, sortOrder, search
 */
router.get(
    "/assessments/:assessmentId/reports",
    reportController.getAssessmentReport
);

/**
 * 📈 Export report as CSV/JSON
 * GET /api/admin/assessments/:assessmentId/reports/export
 * Query: format (csv, xlsx, json)
 */
router.get(
    "/assessments/:assessmentId/reports/export",
    reportController.exportReport
);

/**
 * 👤 Get detailed report for a single participant
 * GET /api/admin/assessments/:assessmentId/reports/participants/:participantId
 */
router.get(
    "/assessments/:assessmentId/reports/participants/:participantId",
    reportController.getParticipantReport
);

/**
 * ✏️ Update participant verdict (admin edit)
 * PATCH /api/admin/assessments/:assessmentId/reports/participants/:participantId/verdict
 * Body: { status, adjustedScore, violationPenalty, notes }
 */
router.patch(
    "/assessments/:assessmentId/reports/participants/:participantId/verdict",
    reportController.updateParticipantVerdict
);

export default router;
