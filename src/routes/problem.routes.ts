import { Router } from "express";
import * as problemCtrl from "../controllers/problem.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { upload, uploadProblemImages } from "../middleware/upload.middleware";

const router = Router();

router.post("/", authenticate, authorize("ORGANIZER"), uploadProblemImages, problemCtrl.createProblem);
router.get("/", authenticate, problemCtrl.listProblems);
router.get("/:id", authenticate, problemCtrl.getProblem);
router.post("/:id/testcases", authenticate, authorize("ORGANIZER"), problemCtrl.addTestCase);
router.put("/:id", authenticate, authorize("ORGANIZER"), problemCtrl.updateProblem);
router.delete("/:id", authenticate, authorize("ORGANIZER"), problemCtrl.deleteProblem);

export default router;
