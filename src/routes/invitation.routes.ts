import { Router } from "express";
import * as invitationCtrl from "../controllers/invitation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// ============================================
// ORGANIZER ENDPOINTS (Protected)
// ============================================

/**
 * @route   POST /api/invitations
 * @desc    Create single invitation
 * @access  Organizer
 * @body    { assessmentId, email, name?, expiresAt?, sendEmail? }
 */
router.post("/", authenticate, authorize("ORGANIZER"), invitationCtrl.createInvitation);

/**
 * @route   POST /api/invitations/bulk
 * @desc    Bulk invite multiple users
 * @access  Organizer
 * @body    { assessmentId, invitations: [{email, name?}], expiresAt?, sendEmail? }
 */
router.post("/bulk", authenticate, authorize("ORGANIZER"), invitationCtrl.bulkInvite);

/**
 * @route   GET /api/invitations
 * @desc    List invitations with filters
 * @access  Organizer
 * @query   assessmentId, status, search, page, limit
 */
router.get("/", authenticate, authorize("ORGANIZER"), invitationCtrl.listInvitations);

/**
 * @route   GET /api/invitations/stats/:assessmentId
 * @desc    Get invitation statistics for an assessment
 * @access  Organizer
 */
router.get("/stats/:assessmentId", authenticate, authorize("ORGANIZER"), invitationCtrl.getInvitationStats);

/**
 * @route   GET /api/invitations/participants/:assessmentId
 * @desc    List participants (accepted invitations) with full user details
 * @access  Organizer, Admin
 * @query   search, page, limit
 */
router.get("/participants/:assessmentId", authenticate, authorize("ORGANIZER", "ADMIN", "COMPANY"), invitationCtrl.listParticipants);

/**
 * @route   DELETE /api/invitations/bulk
 * @desc    Bulk cancel invitations
 * @access  Organizer
 * @body    { ids: string[] }
 */
router.delete("/bulk", authenticate, authorize("ORGANIZER"), invitationCtrl.bulkCancel);

/**
 * @route   GET /api/invitations/:id
 * @desc    Get single invitation details
 * @access  Organizer
 */
router.get("/:id", authenticate, authorize("ORGANIZER"), invitationCtrl.getInvitation);

/**
 * @route   PATCH /api/invitations/:id
 * @desc    Update invitation
 * @access  Organizer
 * @body    { name?, expiresAt? }
 */
router.patch("/:id", authenticate, authorize("ORGANIZER"), invitationCtrl.updateInvitation);

/**
 * @route   DELETE /api/invitations/:id
 * @desc    Cancel single invitation
 * @access  Organizer
 */
router.delete("/:id", authenticate, authorize("ORGANIZER"), invitationCtrl.cancelInvitation);

/**
 * @route   DELETE /api/invitations/:id/delete
 * @desc    Permanently delete single invitation
 * @access  Organizer
 */
router.delete("/:id/delete", authenticate, authorize("ORGANIZER"), invitationCtrl.deleteInvitation);

/**
 * @route   POST /api/invitations/:id/resend
 * @desc    Resend invitation email
 * @access  Organizer
 */
router.post("/:id/resend", authenticate, authorize("ORGANIZER"), invitationCtrl.resendInvitation);

// ============================================
// CONTESTANT ENDPOINTS
// ============================================

/**
 * @route   POST /api/invitations/verify
 * @desc    Verify invitation token (check if valid)
 * @access  Public
 * @body    { token }
 */
router.post("/verify", invitationCtrl.verifyInvitation);

/**
 * @route   POST /api/invitations/accept
 * @desc    Accept invitation and link to user account
 * @access  Authenticated (any role)
 * @body    { token }
 */
router.post("/accept", authenticate, invitationCtrl.acceptInvitation);

export default router;
