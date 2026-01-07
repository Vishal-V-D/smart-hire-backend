import { Router } from "express";
import * as assessmentCtrl from "../controllers/assessment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Assessment CRUD
// ORGANIZER: full access, ADMIN/COMPANY: read-only based on their access level
router.post("/", authenticate, authorize("ORGANIZER"), assessmentCtrl.createAssessment);
router.get("/", authenticate, authorize("ORGANIZER", "ADMIN", "COMPANY"), assessmentCtrl.listAssessments);
router.get("/:id", authenticate, authorize("ORGANIZER", "ADMIN", "COMPANY"), assessmentCtrl.getAssessment);
router.patch("/:id", authenticate, authorize("ORGANIZER"), assessmentCtrl.updateAssessment);
router.delete("/:id", authenticate, authorize("ORGANIZER"), assessmentCtrl.deleteAssessment);
router.post("/:id/publish", authenticate, authorize("ORGANIZER"), assessmentCtrl.publishAssessment);

// Section endpoints nested under assessment
router.post("/:assessmentId/sections", authenticate, authorize("ORGANIZER"), assessmentCtrl.createSection);
router.get("/:assessmentId/sections", authenticate, authorize("ORGANIZER", "ADMIN", "COMPANY"), assessmentCtrl.listSections);
router.put("/:assessmentId/sections/reorder", authenticate, authorize("ORGANIZER"), assessmentCtrl.reorderSections);

// 🕵️ Plagiarism Configuration Management
router.get("/:id/plagiarism-config", authenticate, authorize("ORGANIZER", "ADMIN", "COMPANY"), assessmentCtrl.getPlagiarismConfig);
router.put("/:id/plagiarism-config", authenticate, authorize("ORGANIZER"), assessmentCtrl.updatePlagiarismConfig);
router.post("/:id/plagiarism-config/reset", authenticate, authorize("ORGANIZER"), assessmentCtrl.resetPlagiarismConfig);

export default router;
