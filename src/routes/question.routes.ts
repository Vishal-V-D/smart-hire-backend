import { Router } from "express";
import * as questionCtrl from "../controllers/question.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// Question CRUD (by question ID)
router.patch("/:id", authenticate, authorize("ORGANIZER"), questionCtrl.updateQuestion);
router.delete("/:id", authenticate, authorize("ORGANIZER"), questionCtrl.deleteQuestion);

export default router;
