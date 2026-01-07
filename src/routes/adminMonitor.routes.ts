import { Router } from "express";
import * as monitorController from "../controllers/monitor.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All admin routes require authentication
router.use(authenticate);

/**
 * 📋 Get all violations for an assessment
 * GET /api/admin/assessments/:assessmentId/violations
 * Query: page, limit, types, sessionId, since
 */
router.get(
    "/assessments/:assessmentId/violations",
    monitorController.getAssessmentViolations
);

/**
 * 📊 Get violation statistics for an assessment
 * GET /api/admin/assessments/:assessmentId/violations/stats
 */
router.get(
    "/assessments/:assessmentId/violations/stats",
    monitorController.getAssessmentViolationStats
);

/**
 * 🔴 Get realtime violations feed (for polling)
 * GET /api/admin/assessments/:assessmentId/violations/realtime
 * Query: since (ISO timestamp)
 */
router.get(
    "/assessments/:assessmentId/violations/realtime",
    monitorController.getRealtimeViolationsFeed
);

export default router;
