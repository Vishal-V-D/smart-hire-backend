import { Router } from "express";
import * as contestCtrl from "../controllers/contest.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();
// ✅ Correct order
// Public contest creation removed

router.post("/secure", authenticate, authorize("ORGANIZER"), contestCtrl.createSecureContest); // NEW
router.get("/", contestCtrl.listContests);

// Move special routes ABOVE :id
router.get("/me/created", authenticate, authorize("ORGANIZER"), contestCtrl.getCreatedContests);
router.get("/me/registered", authenticate, authorize("CONTESTANT"), contestCtrl.getRegisteredContests);

router.get("/:id", contestCtrl.getContest); // 👈 keep this LAST
router.get("/:id/proctoring", authenticate, contestCtrl.getProctoringSettings); // 🔒 Get proctoring settings
router.put("/:id", authenticate, authorize("ORGANIZER"), contestCtrl.updateContest);
router.delete("/:id", authenticate, authorize("ORGANIZER"), contestCtrl.deleteContest);
router.post("/:id/problems", authenticate, authorize("ORGANIZER"), contestCtrl.addProblemToContest);
// router.post("/:id/register", authenticate, authorize("CONTESTANT"), contestCtrl.registerForContest); // ❌ Removed: Use contestRegistration.routes.ts
router.delete("/problems/:cpId", authenticate, authorize("ORGANIZER"), contestCtrl.removeProblemFromContest);

export default router;
