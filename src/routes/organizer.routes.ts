import { Router } from "express";
import { OrganizerController } from "../controllers/organizer.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const organizerController = new OrganizerController();

// All routes require authentication
router.use(authenticate);

// Participant Management
router.get(
    "/contests/:contestId/participants",
    (req, res) => organizerController.getContestParticipants(req, res)
);

router.get(
    "/contests/:contestId/participants/:userId/details",
    (req, res) => organizerController.getParticipantDetails(req, res)
);

// Violation Tracking
router.post(
    "/contests/:contestId/violations",
    (req, res) => organizerController.reportViolation(req, res)
);

router.get(
    "/contests/:contestId/violations/summary",
    (req, res) => organizerController.getViolationSummary(req, res)
);

router.get(
    "/contests/:contestId/violations/alerts",
    (req, res) => organizerController.getViolationAlerts(req, res)
);

// Ban Management
router.post(
    "/contests/:contestId/participants/:userId/ban",
    (req, res) => organizerController.banParticipant(req, res)
);

router.delete(
    "/contests/:contestId/participants/:userId/ban",
    (req, res) => organizerController.unbanParticipant(req, res)
);

// 🔐 ============ ADMIN MANAGEMENT ROUTES ============

// Create admin
router.post(
    "/admins",
    (req, res) => organizerController.createAdmin(req, res)
);

// List all admins
router.get(
    "/admins",
    (req, res) => organizerController.listAdmins(req, res)
);

// Get admin details
router.get(
    "/admins/:id",
    (req, res) => organizerController.getAdminDetails(req, res)
);

// Edit admin
router.put(
    "/admins/:id",
    (req, res) => organizerController.editAdmin(req, res)
);

// Resend login link
router.post(
    "/admins/:id/resend-login-link",
    (req, res) => organizerController.resendLoginLink(req, res)
);

// Reset admin password
router.post(
    "/admins/:id/reset-password",
    (req, res) => organizerController.resetAdminPassword(req, res)
);

// Disable admin
router.put(
    "/admins/:id/disable",
    (req, res) => organizerController.disableAdmin(req, res)
);

// Delete admin
router.delete(
    "/admins/:id",
    (req, res) => organizerController.deleteAdmin(req, res)
);

// 🔐 ============ ADMIN ACCESS MANAGEMENT ROUTES ============

// Grant admin access
router.post(
    "/admins/:id/access",
    (req, res) => organizerController.grantAdminAccess(req, res)
);

// Get admin access details
router.get(
    "/admins/:id/access",
    (req, res) => organizerController.getAdminAccess(req, res)
);

// Update admin access
router.put(
    "/admins/:id/access",
    (req, res) => organizerController.updateAdminAccess(req, res)
);

// Add assessments to admin
router.post(
    "/admins/:id/access/add-assessments",
    (req, res) => organizerController.addAssessmentsToAdmin(req, res)
);

// Remove assessments from admin
router.post(
    "/admins/:id/access/remove-assessments",
    (req, res) => organizerController.removeAssessmentsFromAdmin(req, res)
);

// Revoke all access from admin
router.delete(
    "/admins/:id/access",
    (req, res) => organizerController.revokeAdminAccess(req, res)
);

export default router;
