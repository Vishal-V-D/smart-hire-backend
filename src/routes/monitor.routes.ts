import { Router } from "express";
import * as monitorCtrl from "../controllers/monitor.controller";

const router = Router();

// ============================================
// MONITORING ENDPOINTS (Public - uses session token)
// ============================================

/**
 * @route   POST /api/contestant/monitor/violation
 * @desc    Record a proctoring violation
 * @access  Public (uses session token)
 * @body    { sessionToken, type, metadata }
 */
router.post("/violation", monitorCtrl.recordViolation);

export default router;
