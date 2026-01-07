import { Router } from "express";
import * as subCtrl from "../controllers/contestSubmission.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Submission routes
router.post("/:contestId/submit", authenticate, subCtrl.submitCode);
router.get("/:contestId/users/:userId/submissions", authenticate, subCtrl.getUserSubmissions);

// Plagiarism routes
router.post("/webhook/plagiarism", subCtrl.plagiarismWebhook); // No auth (service-to-service)
router.get("/:contestId/users/:userId/plagiarism", authenticate, authorize("ORGANIZER"), subCtrl.getPlagiarismResults);

export default router;
