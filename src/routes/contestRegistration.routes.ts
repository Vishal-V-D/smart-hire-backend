import { Router } from "express";
import * as regCtrl from "../controllers/contestRegistration.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Registration routes
router.post(
    "/:contestId/register",
    authenticate,
    regCtrl.registerForContest
);

router.get("/:contestId/check-registration", authenticate, regCtrl.checkRegistration);
router.get("/:contestId/registration/:userId", authenticate, regCtrl.getRegistrationDetails);
router.get("/:contestId/registration/:userId/photo", authenticate, regCtrl.getRegistrationPhoto);

// Session routes
router.post("/:contestId/start", authenticate, regCtrl.startContest);
router.post("/:contestId/finish", authenticate, regCtrl.finishContest);

// Shareable link routes
router.post("/:contestId/share-link", authenticate, authorize("ORGANIZER"), regCtrl.generateShareableLink);
router.get("/join/:code", regCtrl.getContestByLink);

export default router;
