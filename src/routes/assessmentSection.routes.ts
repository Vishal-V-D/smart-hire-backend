import { Router } from "express";
import * as sectionCtrl from "../controllers/assessmentSection.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Section CRUD (by section ID)
router.patch("/:id", authenticate, authorize("ORGANIZER"), sectionCtrl.updateSection);
router.delete("/:id", authenticate, authorize("ORGANIZER"), sectionCtrl.deleteSection);

// Question endpoints nested under section
router.post("/:sectionId/questions", authenticate, authorize("ORGANIZER"), sectionCtrl.createQuestion);
router.post("/:sectionId/questions/bulk", authenticate, authorize("ORGANIZER"), sectionCtrl.bulkCreateQuestions);
router.post("/:sectionId/sql-questions", authenticate, authorize("ORGANIZER"), sectionCtrl.addSqlQuestions);
router.get("/:sectionId/questions", authenticate, authorize("ORGANIZER"), sectionCtrl.listQuestions);

export default router;
