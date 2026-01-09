import { Router } from "express";
import * as inviteCtrl from "../controllers/contestInvite.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Organizer routes
router.post("/:contestId/invite", authenticate, authorize("ORGANIZER"), inviteCtrl.sendInvitation);
router.post("/:contestId/invite/bulk", authenticate, authorize("ORGANIZER"), inviteCtrl.sendBulkInvitations);
router.post("/:contestId/invite/csv", authenticate, authorize("ORGANIZER"), upload.single('file'), inviteCtrl.sendBulkInvitationsCSV);
router.get("/:contestId/invitations", authenticate, authorize("ORGANIZER"), inviteCtrl.getInvitations);

// Public/User routes
router.get("/invitations/:token/validate", inviteCtrl.validateInviteToken);
router.post("/invitations/:token/accept", authenticate, inviteCtrl.acceptInvitation);

// Organizer management
router.delete("/invitations/:invitationId", authenticate, authorize("ORGANIZER"), inviteCtrl.revokeInvitation);

export default router;
